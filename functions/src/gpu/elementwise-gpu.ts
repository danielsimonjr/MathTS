/**
 * WebGPU fused element-wise chain.
 *
 * Why a *chain* and not a single op: a lone element-wise op on the GPU is pure
 * transfer tax — upload n floats, do one flop each, read n floats back. A
 * **fused chain** uploads once, runs every op on-device by ping-ponging two
 * storage buffers, and reads back once, so the transfer is amortized across the
 * whole chain.
 *
 * **Read this before reaching for the GPU:** for element-wise chains the GPU is
 * the *fastest* tier (3.2–8.3× over WASM — see the table on
 * `fuseUnaryChainAsync`), but it computes in **f32** where every CPU tier is
 * f64-exact. That is the whole trade, and `enableGpu()` is how a caller consents
 * to it. `fuseUnaryChainAsync` therefore tries the GPU first, but only when the
 * flag is on; with it off (the default) the GPU never runs.
 *
 * An earlier revision of this comment claimed the GPU was ~1.9× *slower* than
 * WASM. That was an artifact of a `Float32Array.from()` in this very file — the
 * generic `Array.from` path, which cost 433 ms at n=2²⁰ where the constructor
 * costs 5.9 ms. Do not re-derive a tier ranking from a single tier's number; see
 * `gpu-vs-wasm.browser.test.ts`, which measures all three in one run.
 *
 * Contract (mirrors the WASM `elementwiseChainDispatch`): a **never-throw**
 * best-effort fast path. It returns `null` — never rejects — whenever the GPU is
 * unavailable, not opted in, the input is too small, or the chain contains an op
 * with no GPU kernel. The caller then falls through to the CPU tiers.
 */

import {
  getGpuDevice,
  getGlobalGPUContext,
  isGpuEnabled,
  GPU_MIN_ELEMENTS,
  ShaderManager,
  BufferPool,
  type GPUContextOptions,
} from '@danielsimonjr/mathts-gpu';

/**
 * IEEE bit patterns, constructed explicitly.
 *
 * WGSL leaves out-of-domain results (`log(x<=0)`, `atanh(|x|>=1)`, division by
 * zero) **indeterminate** — an implementation may return anything. JS is exact:
 * `Math.log(0) === -Infinity`, `Math.atanh(2)` is `NaN`. Without guards the same
 * call could give `-Infinity` on one GPU and garbage on another, and zeros in
 * real data are common. These constants let the kernels pin IEEE semantics so
 * the GPU tier agrees with the CPU tiers on every device, not just the one we
 * happened to test.
 */
const WGSL_IEEE = `
  // NaN / ±Inf are supplied through the UNIFORM, not written as literals.
  //
  // WGSL const-folds \`bitcast<f32>(0x7fc00000u)\` even inside a function body and
  // then rejects the result: "value nan cannot be represented as 'f32'" — a const
  // expression may not BE NaN or Inf. Reading the bit pattern from \`params\` (a
  // runtime uniform) is not const-foldable, so the bitcast survives to runtime.
  // params = (n, nanBits, posInfBits, negInfBits).
  fn nan_f32() -> f32 { return bitcast<f32>(params.y); }
  fn pos_inf() -> f32 { return bitcast<f32>(params.z); }
  fn neg_inf() -> f32 { return bitcast<f32>(params.w); }

  fn safe_log(x: f32) -> f32 {
    if (x < 0.0) { return nan_f32(); }
    if (x == 0.0) { return neg_inf(); }
    return log(x);
  }
  fn safe_atanh(x: f32) -> f32 {
    if (x > 1.0 || x < -1.0) { return nan_f32(); }
    if (x == 1.0) { return pos_inf(); }
    if (x == -1.0) { return neg_inf(); }
    return atanh(x);
  }
  // 1/d with IEEE division-by-zero semantics (JS: 1/0 = +Inf, 1/-0 = -Inf).
  fn safe_recip(d: f32) -> f32 {
    if (d == 0.0) {
      // Distinguish +0 from -0 by its sign bit, as IEEE division does.
      if ((bitcast<u32>(d) & 0x80000000u) != 0u) { return neg_inf(); }
      return pos_inf();
    }
    return 1.0 / d;
  }
`;

const WGSL_OP_BODY = {
  abs: 'return abs(x);',
  sin: 'return sin(x);',
  cos: 'return cos(x);',
  tan: 'return tan(x);',
  exp: 'return exp(x);',
  atan: 'return atan(x);',
  sinh: 'return sinh(x);',
  tanh: 'return tanh(x);',

  // Domain-guarded: WGSL says indeterminate outside the domain; JS does not.
  log: 'return safe_log(x);',
  log2: 'return safe_log(x) * 1.4426950408889634;', // ln(x) / ln(2)
  log10: 'return safe_log(x) * 0.4342944819032518;', // ln(x) / ln(10)
  atanh: 'return safe_atanh(x);',

  sec: 'return safe_recip(cos(x));',
  csc: 'return safe_recip(sin(x));',
  cot: 'return safe_recip(tan(x));',

  // NOTE — `expm1`, `log1p` and `erfc` are DELIBERATELY ABSENT.
  //
  // WGSL has no builtin for any of them. For expm1/log1p the naive identities
  // (`exp(x)-1`, `log(1+x)`) are catastrophically wrong near zero in f32
  // (`1.0 + 1e-8` rounds to exactly 1.0f, so `log(1+x)` returns 0 where the true
  // value is 1e-8 — 100% relative error), and the standard Kahan-compensated
  // forms were implemented and MEASURED on real hardware: still 38% (expm1) and
  // 62% (log1p) max relative error, because the compensation needs an accurate
  // `log()` near 1.0 and the GPU's fast-math `log()` is not.
  //
  // An f32 fast path may be less precise. It may not be WRONG. Chains containing
  // these fall back to the exact WASM/JS tiers.
} as const;

/** Ops that have a GPU kernel. A chain outside this set falls back. */
export type GpuElementwiseOp = keyof typeof WGSL_OP_BODY;

export const GPU_ELEMENTWISE_OPS = Object.keys(WGSL_OP_BODY) as GpuElementwiseOp[];

/** Whether every op in the chain has a GPU kernel. */
export function isGpuChainSupported(ops: readonly string[]): ops is readonly GpuElementwiseOp[] {
  return ops.every((op) => op in WGSL_OP_BODY);
}

const WORKGROUP_SIZE = 256;

/**
 * `n` is passed in a uniform and used as the bounds guard — NOT
 * `arrayLength(&inp)`.
 *
 * This matters: `BufferPool` rounds allocations up to a power of two, so a
 * pooled buffer is routinely *larger* than the data. An `arrayLength` guard
 * would then let threads run past the real data and write garbage into the
 * padding (and, with a differently-sized ping-pong partner, out of bounds).
 * Carrying `n` explicitly makes the kernel correct for any buffer >= n*4 bytes,
 * which is what lets us pool at all.
 */
function wgslFor(op: GpuElementwiseOp): string {
  return `
    @group(0) @binding(0) var<storage, read> inp: array<f32>;
    @group(0) @binding(1) var<storage, read_write> outp: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<u32>; // n, nanBits, +infBits, -infBits

    ${WGSL_IEEE}

    fn apply(x: f32) -> f32 {
      ${WGSL_OP_BODY[op]}
    }

    @compute @workgroup_size(${WORKGROUP_SIZE})
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let i = gid.x;
      if (i >= params.x) { return; }
      outp[i] = apply(inp[i]);
    }
  `;
}

/** Per-device GPU resources, built once and reused. */
interface Resources {
  device: GPUDevice;
  shaders: ShaderManager;
  pool: BufferPool;
}

let resources: Resources | null = null;

/**
 * Acquire the shared `ShaderManager` + `BufferPool` from the `mathts-gpu`
 * foundation, rather than hand-rolling a private pipeline cache and raw
 * `createBuffer` calls. Pipelines are compiled ONCE here (`precompileRegistered`),
 * so no per-call shader compilation, and buffers are recycled instead of being
 * allocated and destroyed on every dispatch.
 */
async function getResources(options?: GPUContextOptions): Promise<Resources | null> {
  const device = await getGpuDevice(options);
  if (!device) return null;

  // A device-lost event evicts the cached device, so a fresh one invalidates these.
  if (resources && resources.device === device) return resources;

  const ctx = getGlobalGPUContext();
  const shaders = new ShaderManager(ctx);
  for (const op of GPU_ELEMENTWISE_OPS) {
    shaders.registerShader(op, wgslFor(op));
  }
  shaders.precompileRegistered();

  resources = { device, shaders, pool: new BufferPool(ctx) };
  return resources;
}

/** Drop the cached shaders/buffers (device loss, or between tests). */
export function resetGpuElementwise(): void {
  resources?.pool.destroy();
  resources = null;
}

/** Options for a GPU element-wise dispatch. */
export interface GpuChainOptions extends GPUContextOptions {
  /**
   * Per-call override of the global `enableGpu()` flag.
   *
   * The global flag is process-wide mutable state: any dependency that calls
   * `enableGpu()` would otherwise change *your* call's behaviour. Passing `gpu`
   * explicitly makes a call self-describing and immune to that.
   */
  gpu?: boolean;
}

/**
 * Run a fused element-wise chain on the GPU.
 *
 * @param ops - the chain, applied left to right (`['sin','exp']` = `exp(sin(x))`)
 * @param xs  - input samples
 * @returns the f32 results, or `null` to signal "fall back to another tier"
 */
export async function elementwiseChainGpuDispatch(
  ops: readonly string[],
  xs: Float64Array | Float32Array,
  options?: GpuChainOptions
): Promise<Float32Array | null> {
  const n = xs.length;

  // Gates — each returns null (never throws) so the caller falls through.
  // An explicit `gpu` option beats the process-global flag.
  const enabled = options?.gpu ?? isGpuEnabled();
  if (!enabled) return null;
  if (ops.length === 0) return null;
  if (n < GPU_MIN_ELEMENTS) return null;
  if (!isGpuChainSupported(ops)) return null;

  const bytes = n * 4;
  const workgroups = Math.ceil(n / WORKGROUP_SIZE);

  let res: Resources | undefined;
  let bufA: GPUBuffer | undefined;
  let bufB: GPUBuffer | undefined;
  let staging: GPUBuffer | undefined;
  let params: GPUBuffer | undefined;
  let scopePopped = false;

  try {
    const r = await getResources(options);
    if (!r) return null;
    res = r;
    const { device, shaders, pool } = r;

    // DEVICE LIMITS — refuse rather than produce zeros.
    //
    // A WebGPU validation error does NOT throw: it is reported asynchronously
    // and *invalidates the command buffer*. `submit()` then does nothing, the
    // staging buffer keeps its spec-mandated zero-initialized contents,
    // `mapAsync` resolves happily, and we would return an array of ZEROS as a
    // successful result — a silently wrong answer, worse than any exception.
    const limits = device.limits;
    if (workgroups > limits.maxComputeWorkgroupsPerDimension) return null;
    if (bytes > limits.maxStorageBufferBindingSize) return null;
    if (bytes > limits.maxBufferSize) return null;

    // `new Float32Array(f64)` — NOT `Float32Array.from(f64)`. `.from()` is the
    // generic Array.from algorithm: it walks the source through the ArrayLike
    // protocol and runs ToNumber per element. The constructor takes the native
    // typed-array-to-typed-array path. Measured at n=2^20: 433ms vs 5.9ms — the
    // `.from()` version billed a 23ms kernel at ~470ms and made the GPU look 19x
    // slower than it is. See gpu-dispatch-overhead.browser.test.ts.
    const input = xs instanceof Float32Array ? xs : new Float32Array(xs);

    // Catch any *other* validation error the limit checks don't predict.
    // Without this, such an error would again surface as a buffer of zeros.
    device.pushErrorScope('validation');

    // Pooled: recycled across calls, and sized >= bytes (the pool rounds up).
    // Safe because the kernel bounds-checks against the `n` uniform, not
    // `arrayLength`.
    bufA = pool.acquireStorageBuffer(bytes, 'chain-a', true, true);
    bufB = pool.acquireStorageBuffer(bytes, 'chain-b', true, true);
    staging = pool.acquireStagingBuffer(bytes, 'chain-staging');
    params = pool.acquireUniformBuffer(16, 'chain-params');

    // Cast: TS's ArrayBufferLike vs @webgpu/types' ArrayBuffer-only BufferSource.
    device.queue.writeBuffer(bufA, 0, input as unknown as BufferSource);
    // IEEE bit patterns ride along in the uniform — see WGSL_IEEE for why they
    // cannot be WGSL literals.
    device.queue.writeBuffer(params, 0, new Uint32Array([n, 0x7fc00000, 0x7f800000, 0xff800000]));

    // ONE encoder for the whole chain: N compute passes, a single submit. This
    // is the fusion — a per-op submit would pay the round-trip N times.
    const encoder = device.createCommandEncoder({ label: 'elementwise-chain' });

    let src = bufA;
    let dst = bufB;
    for (const op of ops) {
      const pipeline = shaders.getRegisteredPipeline(op);
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: src } },
          { binding: 1, resource: { buffer: dst } },
          { binding: 2, resource: { buffer: params } },
        ],
      });
      const pass = encoder.beginComputePass({ label: `chain:${op}` });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroups);
      pass.end();

      // Ping-pong: this pass's output is the next pass's input. After k passes
      // and k swaps, `src` is always the buffer pass k wrote — for every k.
      [src, dst] = [dst, src];
    }

    encoder.copyBufferToBuffer(src, 0, staging, 0, bytes);
    device.queue.submit([encoder.finish()]);

    const validationError = await device.popErrorScope();
    scopePopped = true;
    // The work was invalidated — the readback would be zeros. Fall back.
    if (validationError) return null;

    // Map only the real data: a pooled staging buffer may be larger than `bytes`.
    await staging.mapAsync(GPUMapMode.READ, 0, bytes);
    const out = new Float32Array(staging.getMappedRange(0, bytes).slice(0));
    staging.unmap();
    return out;
  } catch {
    // Device lost, OOM, mapAsync rejection — the GPU is best-effort. Fall back.
    return null;
  } finally {
    // Keep the error-scope stack balanced even when we threw mid-encode.
    if (res && !scopePopped) {
      try {
        await res.device.popErrorScope();
      } catch {
        /* device already gone — nothing to balance */
      }
    }
    // Return buffers to the pool rather than destroying them.
    if (res) {
      if (bufA) res.pool.release(bufA);
      if (bufB) res.pool.release(bufB);
      if (staging) res.pool.release(staging);
      if (params) res.pool.release(params);
    }
  }
}

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

export const GPU_ELEMENTWISE_OPS: readonly GpuElementwiseOp[] = Object.keys(
  WGSL_OP_BODY
) as GpuElementwiseOp[];

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

/** Reductions that can be fused onto the end of a chain. */
export type GpuReduceOp = 'sum' | 'max' | 'min';

// `readonly`: this array is load-bearing in the dispatch guard below, so a consumer
// doing `GPU_REDUCE_OPS.push(...)` would silently change GPU routing.
export const GPU_REDUCE_OPS = ['sum', 'max', 'min'] as const satisfies readonly GpuReduceOp[];

/** Shader-registry keys for the reduce kernels, namespaced away from the op names. */
const reduceKey = (r: GpuReduceOp): string => `reduce:${r}`;

/**
 * Per-reduction identity and combiner.
 *
 * The identity is what an OUT-OF-RANGE lane contributes. It is load-bearing: the
 * final workgroup is almost always ragged (n is rarely a multiple of 256), and
 * seeding those lanes with 0 for a `max` would clamp the answer at 0 for any
 * all-negative input. ±Inf come from the uniform via `pos_inf()`/`neg_inf()` —
 * WGSL cannot spell them as literals (see WGSL_IEEE).
 */
const WGSL_REDUCE: Record<GpuReduceOp, { identity: string; combine: string }> = {
  sum: { identity: '0.0', combine: 'a + b' },
  max: { identity: 'neg_inf()', combine: 'max(a, b)' },
  min: { identity: 'pos_inf()', combine: 'min(a, b)' },
};

/**
 * Tree-reduce one workgroup's slice into a single partial.
 *
 * Bounds-check is against `params.x` (= n), never `arrayLength(&inp)` — the pool
 * rounds buffers UP, so `arrayLength` would fold the uninitialised padding into
 * the result. Same reason as the element-wise kernel.
 *
 * A side benefit worth knowing: this is pairwise summation, so for `sum` it is
 * numerically BETTER-conditioned than the naive sequential `+=` loop it replaces
 * — error grows as O(log n) rather than O(n).
 */
function wgslForReduce(r: GpuReduceOp): string {
  const { identity, combine } = WGSL_REDUCE[r];
  return `
    @group(0) @binding(0) var<storage, read> inp: array<f32>;
    @group(0) @binding(1) var<storage, read_write> partials: array<f32>;
    @group(0) @binding(2) var<uniform> params: vec4<u32>; // n, nanBits, +infBits, -infBits

    ${WGSL_IEEE}

    // NOTE: "shared" is a RESERVED WORD in WGSL — this must not be named that.
    var<workgroup> sdata: array<f32, ${WORKGROUP_SIZE}>;

    fn identity() -> f32 { return ${identity}; }
    fn combine(a: f32, b: f32) -> f32 { return ${combine}; }

    @compute @workgroup_size(${WORKGROUP_SIZE})
    fn main(@builtin(global_invocation_id) gid: vec3<u32>,
            @builtin(local_invocation_id) lid: vec3<u32>,
            @builtin(workgroup_id) wid: vec3<u32>) {
      var v: f32 = identity();
      if (gid.x < params.x) { v = inp[gid.x]; }
      sdata[lid.x] = v;
      workgroupBarrier();

      var s: u32 = ${WORKGROUP_SIZE}u / 2u;
      loop {
        if (s == 0u) { break; }
        if (lid.x < s) { sdata[lid.x] = combine(sdata[lid.x], sdata[lid.x + s]); }
        workgroupBarrier();
        s = s >> 1u;
      }
      if (lid.x == 0u) { partials[wid.x] = sdata[0]; }
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
  for (const r of GPU_REDUCE_OPS) {
    shaders.registerShader(reduceKey(r), wgslForReduce(r));
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
 * Serializes GPU dispatches on this device.
 *
 * `pushErrorScope`/`popErrorScope` is a per-device **LIFO stack**, so two overlapping
 * dispatches interleave destructively: A pushes, B pushes, A submits and pops — and A
 * pops B's scope. Errors are then attributed to the wrong call, and the call that
 * actually failed sees a clean scope and returns its zero-initialised staging buffer as
 * a success (for `sum`, a perfectly plausible-looking number).
 *
 * `await Promise.all([fuseUnaryChainAsync(a), fuseUnaryChainReduceAsync(b, 'sum')])` is
 * an ordinary thing to write, so this is not a theoretical hazard.
 *
 * Serializing costs ~nothing: the work queues on a single hardware device anyway. It
 * also stops the BufferPool from allocating a duplicate buffer set per concurrent
 * caller.
 */
let gpuQueue: Promise<unknown> = Promise.resolve();

function serializeGpu<T>(run: () => Promise<T>): Promise<T> {
  // `.then(run, run)` — a previous dispatch's failure must not skip this one.
  const next = gpuQueue.then(run, run);
  // Never let a rejection poison the chain for everyone behind it.
  gpuQueue = next.catch(() => undefined);
  return next;
}

/**
 * Run a fused element-wise chain on the GPU.
 *
 * @param ops - the chain, applied left to right (`['sin','exp']` = `exp(sin(x))`)
 * @param xs  - input samples
 * @returns the f32 results, or `null` to signal "fall back to another tier"
 */
export function elementwiseChainGpuDispatch(
  ops: readonly string[],
  xs: Float64Array | Float32Array,
  options?: GpuChainOptions
): Promise<Float32Array | null> {
  return serializeGpu(() => chainGpuDispatchImpl(ops, xs, options));
}

async function chainGpuDispatchImpl(
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
  // `scopePushed` is NOT redundant with `scopePopped`. `res` is assigned before the
  // scope is pushed, and the device-limit checks below `return null` in between — so a
  // `finally` gated only on `res` would pop a scope this call never pushed. The scope
  // stack is per-device and LIFO, so that stray pop lands on a CONCURRENT dispatch's
  // scope: its own pop then drains the wrong one and a real validation error goes
  // unobserved — which is precisely the "silently returns zeros" failure the scope
  // exists to catch. Same for a throw from the `new Float32Array(xs)` allocation.
  let scopePushed = false;
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
    scopePushed = true;

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
    if (res && scopePushed && !scopePopped) {
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

/**
 * Apply `ops` on the GPU and **reduce the result on-device**, returning a single
 * number instead of an array.
 *
 * The point is the readback, not the arithmetic: reducing on the device replaces
 * an **n-float** transfer back to the CPU with an **n/256-float** one. Measured
 * end-to-end through THIS function (not a prototype), NVIDIA Pascal,
 * `sum(exp(sin(x)))`:
 *
 * | n         | WASM chain + JS sum | GPU chain + JS sum | fused GPU reduce |
 * | --------- | ------------------- | ------------------ | ---------------- |
 * | 262,144   |             25.6 ms |            16.7 ms |    **9.9 ms**    |
 * | 1,048,576 |             96.8 ms |            34.3 ms |   **25.4 ms**    |
 * | 4,194,304 |            260.0 ms |           100.0 ms |   **72.2 ms**    |
 *
 * **1.35-1.7x** over the shipped GPU path, **2.6-3.8x** over the CPU tier.
 *
 * Quote the **1.39x at n=2^22** if you quote one number: it is the only ratio here that
 * reproduces run to run (1.31-1.39x over four runs). The 1.7x is the n=262,144 row, and
 * that size swings 1.19-2.83x between runs — the GPU work is short enough that fixed
 * costs dominate. A headline should not be a lucky sample.
 *
 * Why not more: a bare-WGSL prototype of this hit ~2x, but it pre-converted its
 * input outside the timed region. The real f64->f32 conversion is an n-scaling cost
 * that BOTH paths pay, so it dilutes the ratio as n grows (the absolute saving is
 * steady: ~28 ms at n=2^22). The prototype's number was not a lie, it was measuring
 * a workload no caller has. Quote the numbers above, not those.
 *
 * **An empty `ops` is declined on purpose.** A *standalone* GPU reduction uploads
 * n floats to produce one number — pure transfer tax, measured 3-9x SLOWER than a
 * plain JS sum. There is no chain to amortise the upload against, so this returns
 * `null` and lets the caller use the CPU, which is genuinely the faster path. The
 * upload is only worth paying for when real work rides along with it.
 *
 * Same never-throw contract as {@link elementwiseChainGpuDispatch}: returns `null`
 * — never rejects — whenever the GPU is unavailable, not opted into, the input is
 * below `GPU_MIN_ELEMENTS`, an op has no kernel, or a device limit is exceeded.
 *
 * Precision: f32, like every GPU path here. For `sum` the tree reduction is
 * pairwise, so its error grows O(log n) rather than the O(n) of a sequential
 * accumulate — it is better-conditioned than the JS loop it replaces, even though
 * it works in f32.
 */
export function elementwiseChainReduceGpuDispatch(
  ops: readonly string[],
  xs: Float64Array | Float32Array,
  reduce: GpuReduceOp,
  options?: GpuChainOptions
): Promise<number | null> {
  return serializeGpu(() => chainReduceGpuDispatchImpl(ops, xs, reduce, options));
}

async function chainReduceGpuDispatchImpl(
  ops: readonly string[],
  xs: Float64Array | Float32Array,
  reduce: GpuReduceOp,
  options?: GpuChainOptions
): Promise<number | null> {
  const n = xs.length;

  const enabled = options?.gpu ?? isGpuEnabled();
  if (!enabled) return null;
  // See the doc comment: a chainless reduction is a measured loss, not a gap.
  if (ops.length === 0) return null;
  if (n < GPU_MIN_ELEMENTS) return null;
  if (!isGpuChainSupported(ops)) return null;
  if (!GPU_REDUCE_OPS.includes(reduce)) return null;

  const bytes = n * 4;
  const workgroups = Math.ceil(n / WORKGROUP_SIZE);
  const partialBytes = workgroups * 4;

  let res: Resources | undefined;
  let bufA: GPUBuffer | undefined;
  let bufB: GPUBuffer | undefined;
  let partials: GPUBuffer | undefined;
  let staging: GPUBuffer | undefined;
  let params: GPUBuffer | undefined;
  // `scopePushed` is NOT redundant with `scopePopped`. `res` is assigned before the
  // scope is pushed, and the device-limit checks below `return null` in between — so a
  // `finally` gated only on `res` would pop a scope this call never pushed. The scope
  // stack is per-device and LIFO, so that stray pop lands on a CONCURRENT dispatch's
  // scope: its own pop then drains the wrong one and a real validation error goes
  // unobserved — which is precisely the "silently returns zeros" failure the scope
  // exists to catch. Same for a throw from the `new Float32Array(xs)` allocation.
  let scopePushed = false;
  let scopePopped = false;

  try {
    const r = await getResources(options);
    if (!r) return null;
    res = r;
    const { device, shaders, pool } = r;

    // Refuse rather than return a wrong answer: a validation error does not throw,
    // it invalidates the command buffer, and the zero-initialised staging buffer
    // would read back as zeros — which for `sum` is a plausible-looking number.
    const limits = device.limits;
    if (workgroups > limits.maxComputeWorkgroupsPerDimension) return null;
    if (bytes > limits.maxStorageBufferBindingSize) return null;
    if (bytes > limits.maxBufferSize) return null;

    const input = xs instanceof Float32Array ? xs : new Float32Array(xs);

    device.pushErrorScope('validation');
    scopePushed = true;

    bufA = pool.acquireStorageBuffer(bytes, 'chain-a', true, true);
    bufB = pool.acquireStorageBuffer(bytes, 'chain-b', true, true);
    partials = pool.acquireStorageBuffer(partialBytes, 'reduce-partials', true, true);
    staging = pool.acquireStagingBuffer(partialBytes, 'reduce-staging');
    params = pool.acquireUniformBuffer(16, 'chain-params');

    device.queue.writeBuffer(bufA, 0, input as unknown as BufferSource);
    device.queue.writeBuffer(params, 0, new Uint32Array([n, 0x7fc00000, 0x7f800000, 0xff800000]));

    // ONE encoder: every chain pass AND the reduction, a single submit. The whole
    // saving would evaporate if the chain were read back between the two.
    const encoder = device.createCommandEncoder({ label: 'elementwise-chain-reduce' });

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
      [src, dst] = [dst, src];
    }

    // `src` is the buffer the LAST chain pass wrote (the ping-pong swaps after
    // each op), so the reduction consumes exactly the chain's output.
    const reducePipeline = shaders.getRegisteredPipeline(reduceKey(reduce));
    const reduceBind = device.createBindGroup({
      layout: reducePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: src } },
        { binding: 1, resource: { buffer: partials } },
        { binding: 2, resource: { buffer: params } },
      ],
    });
    const reducePass = encoder.beginComputePass({ label: `reduce:${reduce}` });
    reducePass.setPipeline(reducePipeline);
    reducePass.setBindGroup(0, reduceBind);
    reducePass.dispatchWorkgroups(workgroups);
    reducePass.end();

    encoder.copyBufferToBuffer(partials, 0, staging, 0, partialBytes);
    device.queue.submit([encoder.finish()]);

    const validationError = await device.popErrorScope();
    scopePopped = true;
    if (validationError) return null;

    // Only `workgroups` floats cross the bus — that is the entire point.
    await staging.mapAsync(GPUMapMode.READ, 0, partialBytes);
    const parts = new Float32Array(staging.getMappedRange(0, partialBytes).slice(0));
    staging.unmap();

    // Combine the partials in f64 on the CPU. There are n/256 of them (16,384 even
    // at n=4M), so this costs microseconds — a second GPU pass would buy nothing
    // and cost another round-trip. Accumulating in f64 also keeps this last step
    // from adding f32 error on top of the kernel's.
    return foldPartials(parts, reduce);
  } catch {
    return null;
  } finally {
    if (res && scopePushed && !scopePopped) {
      try {
        await res.device.popErrorScope();
      } catch {
        /* device already gone — nothing to balance */
      }
    }
    if (res) {
      if (bufA) res.pool.release(bufA);
      if (bufB) res.pool.release(bufB);
      if (partials) res.pool.release(partials);
      if (staging) res.pool.release(staging);
      if (params) res.pool.release(params);
    }
  }
}

/** Fold the per-workgroup partials into the final scalar, accumulating in f64. */
function foldPartials(parts: Float32Array, reduce: GpuReduceOp): number {
  if (reduce === 'sum') {
    let acc = 0;
    for (let i = 0; i < parts.length; i++) acc += parts[i];
    return acc;
  }
  let acc = reduce === 'max' ? -Infinity : Infinity;
  for (let i = 0; i < parts.length; i++) {
    acc = reduce === 'max' ? Math.max(acc, parts[i]) : Math.min(acc, parts[i]);
  }
  return acc;
}

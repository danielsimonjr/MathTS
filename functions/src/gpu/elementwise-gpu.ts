/**
 * WebGPU fused element-wise chain.
 *
 * Why a *chain* and not a single op: a lone element-wise op on the GPU is pure
 * transfer tax — upload n floats, do one flop each, read n floats back. The
 * same memory-bound economics retired element-wise ops from the WASM backend.
 * A **fused chain** uploads once, runs every op in the chain on-device by
 * ping-ponging two storage buffers, and reads back once, so the transfer cost
 * is amortized across the whole chain.
 *
 * Contract (mirrors the WASM `elementwiseChainDispatch`): this is a
 * **never-throw** best-effort fast path. It returns `null` — never rejects —
 * whenever the GPU is unavailable, not opted in, the input is too small, or the
 * chain contains an op with no GPU kernel. The caller then falls through to the
 * existing WASM/JS tiers.
 *
 * Precision: the GPU path computes in **f32** (WGSL has no f64). This is why it
 * is gated behind the explicit `enableGpu()` opt-in.
 */

import {
  getGpuDevice,
  isGpuEnabled,
  GPU_MIN_ELEMENTS,
  type GPUContextOptions,
} from '@danielsimonjr/mathts-gpu';

/**
 * WGSL expressions for each supported op, as a function of `x`.
 *
 * Deliberately a SUBSET of the WASM op set. `erfc` is absent: WGSL has no
 * `erfc` builtin, and hand-rolling a polynomial approximation would silently
 * change the accuracy contract. A chain containing an unsupported op returns
 * `null` and falls back, rather than quietly computing something else.
 */
const WGSL_OP_BODY = {
  abs: 'return abs(x);',
  sin: 'return sin(x);',
  cos: 'return cos(x);',
  tan: 'return tan(x);',
  exp: 'return exp(x);',
  log: 'return log(x);',
  atan: 'return atan(x);',
  sinh: 'return sinh(x);',
  tanh: 'return tanh(x);',
  atanh: 'return atanh(x);',
  log2: 'return log2(x);',
  // WGSL has no log10 builtin; log(x) * 1/ln(10).
  log10: 'return log(x) * 0.4342944819032518;',

  // NOTE — `expm1` and `log1p` are DELIBERATELY ABSENT, like `erfc`.
  //
  // WGSL has no builtin for either. The naive identities (`exp(x)-1`,
  // `log(1+x)`) are catastrophically wrong near zero in f32: `1.0 + 1e-8`
  // rounds to exactly 1.0f, so `log(1+x)` returns 0 where the true value is
  // 1e-8 — a 100% relative error.
  //
  // The standard Kahan-compensated forms were implemented and MEASURED on real
  // hardware (NVIDIA Pascal). They still scored 38% (expm1) and 62% (log1p) max
  // relative error over x in [1e-9, 1e-3], because the compensation relies on
  // `log()` being accurate for arguments near 1.0, and the GPU's fast-math
  // `log()` is not.
  //
  // An f32 fast path is allowed to be less precise. It is not allowed to be
  // WRONG. Chains containing these fall back to the exact WASM/JS tiers.

  sec: 'return 1.0 / cos(x);',
  csc: 'return 1.0 / sin(x);',
  cot: 'return 1.0 / tan(x);',
} as const;

/** Ops that have a GPU kernel. A chain outside this set falls back. */
export type GpuElementwiseOp = keyof typeof WGSL_OP_BODY;

export const GPU_ELEMENTWISE_OPS = Object.keys(WGSL_OP_BODY) as GpuElementwiseOp[];

/** Whether every op in the chain has a GPU kernel. */
export function isGpuChainSupported(ops: readonly string[]): ops is readonly GpuElementwiseOp[] {
  return ops.every((op) => op in WGSL_OP_BODY);
}

const WORKGROUP_SIZE = 256;

function wgslFor(op: GpuElementwiseOp): string {
  return `
    @group(0) @binding(0) var<storage, read> inp: array<f32>;
    @group(0) @binding(1) var<storage, read_write> outp: array<f32>;

    fn apply(x: f32) -> f32 {
      ${WGSL_OP_BODY[op]}
    }

    @compute @workgroup_size(${WORKGROUP_SIZE})
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let i = gid.x;
      if (i >= arrayLength(&inp)) { return; }
      outp[i] = apply(inp[i]);
    }
  `;
}

/** Compiled pipelines are cached per device — shader compilation is expensive. */
const pipelineCache = new WeakMap<GPUDevice, Map<GpuElementwiseOp, GPUComputePipeline>>();

function getPipeline(device: GPUDevice, op: GpuElementwiseOp): GPUComputePipeline {
  let byOp = pipelineCache.get(device);
  if (!byOp) {
    byOp = new Map();
    pipelineCache.set(device, byOp);
  }
  const cached = byOp.get(op);
  if (cached) return cached;

  const pipeline = device.createComputePipeline({
    label: `elementwise:${op}`,
    layout: 'auto',
    compute: {
      module: device.createShaderModule({ code: wgslFor(op), label: `elementwise:${op}` }),
      entryPoint: 'main',
    },
  });
  byOp.set(op, pipeline);
  return pipeline;
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
  options?: GPUContextOptions
): Promise<Float32Array | null> {
  const n = xs.length;

  // Gates — each returns null (never throws) so the caller falls through.
  if (!isGpuEnabled()) return null;
  if (ops.length === 0) return null;
  if (n < GPU_MIN_ELEMENTS) return null;
  if (!isGpuChainSupported(ops)) return null;

  const bytes = n * 4;
  const workgroups = Math.ceil(n / WORKGROUP_SIZE);

  let bufA: GPUBuffer | undefined;
  let bufB: GPUBuffer | undefined;
  let staging: GPUBuffer | undefined;
  let scopePopped = false;
  let device: GPUDevice | undefined;

  try {
    const d = await getGpuDevice(options);
    if (!d) return null;
    device = d;

    // DEVICE LIMITS — refuse rather than produce zeros.
    //
    // This is the subtle one. A WebGPU validation error does NOT throw: it is
    // reported asynchronously and *invalidates the command buffer*. `submit()`
    // then does nothing, the staging buffer keeps its spec-mandated
    // zero-initialized contents, `mapAsync` resolves happily, and we would
    // return an array of ZEROS as a successful result — a silently wrong
    // answer, worse than any exception. Exceeding any of these limits is
    // exactly such an error, so we bail to the CPU tiers instead.
    const limits = device.limits;
    if (workgroups > limits.maxComputeWorkgroupsPerDimension) return null;
    if (bytes > limits.maxStorageBufferBindingSize) return null;
    if (bytes > limits.maxBufferSize) return null;

    const input = xs instanceof Float32Array ? xs : Float32Array.from(xs);

    // Catch any *other* validation error the limit checks above don't predict
    // (a bad bind group, a future shader regression). Without this scope such
    // an error would, again, surface as a buffer full of zeros.
    device.pushErrorScope('validation');

    // Two storage buffers, ping-ponged across the chain: upload once, read once.
    bufA = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: 'chain-a',
    });
    bufB = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: 'chain-b',
    });
    staging = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label: 'chain-staging',
    });

    // Cast: TS's ArrayBufferLike vs @webgpu/types' ArrayBuffer-only
    // BufferSource. Same cast the matrix GPUContext uses for writeBuffer.
    device.queue.writeBuffer(bufA, 0, input as unknown as BufferSource);

    const encoder = device.createCommandEncoder({ label: 'elementwise-chain' });

    let src = bufA;
    let dst = bufB;
    for (const op of ops) {
      const pipeline = getPipeline(device, op);
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: src } },
          { binding: 1, resource: { buffer: dst } },
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

    await staging.mapAsync(GPUMapMode.READ);
    const out = new Float32Array(staging.getMappedRange().slice(0));
    staging.unmap();
    return out;
  } catch {
    // Device lost, OOM, mapAsync rejection — the GPU is best-effort. Fall back.
    return null;
  } finally {
    // Keep the error-scope stack balanced even when we threw mid-encode.
    if (device && !scopePopped) {
      try {
        await device.popErrorScope();
      } catch {
        /* device already gone — nothing to balance */
      }
    }
    // Optional-chained: an early createBuffer failure leaves later ones
    // undefined, and would otherwise leak the ones already created.
    bufA?.destroy();
    bufB?.destroy();
    staging?.destroy();
  }
}

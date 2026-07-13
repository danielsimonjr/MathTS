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
const WGSL_OP_EXPR = {
  abs: 'abs(x)',
  sin: 'sin(x)',
  cos: 'cos(x)',
  tan: 'tan(x)',
  exp: 'exp(x)',
  log: 'log(x)',
  atan: 'atan(x)',
  sinh: 'sinh(x)',
  tanh: 'tanh(x)',
  atanh: 'atanh(x)',
  log2: 'log2(x)',
  // WGSL has no log10 builtin; log(x)/log(10) in f32.
  log10: 'log(x) * 0.4342944819032518',
  // No expm1/log1p builtins. These are the naive identities; near zero they
  // lose relative precision, which is acceptable inside an explicitly-f32,
  // opt-in path but is why the browser test pins their tolerance.
  expm1: 'exp(x) - 1.0',
  log1p: 'log(1.0 + x)',
  sec: '1.0 / cos(x)',
  csc: '1.0 / sin(x)',
  cot: '1.0 / tan(x)',
} as const;

/** Ops that have a GPU kernel. A chain outside this set falls back. */
export type GpuElementwiseOp = keyof typeof WGSL_OP_EXPR;

export const GPU_ELEMENTWISE_OPS = Object.keys(WGSL_OP_EXPR) as GpuElementwiseOp[];

/** Whether every op in the chain has a GPU kernel. */
export function isGpuChainSupported(ops: readonly string[]): ops is GpuElementwiseOp[] {
  return ops.every((op) => op in WGSL_OP_EXPR);
}

const WORKGROUP_SIZE = 256;

function wgslFor(op: GpuElementwiseOp): string {
  return `
    @group(0) @binding(0) var<storage, read> inp: array<f32>;
    @group(0) @binding(1) var<storage, read_write> outp: array<f32>;

    @compute @workgroup_size(${WORKGROUP_SIZE})
    fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
      let i = gid.x;
      if (i >= arrayLength(&inp)) { return; }
      let x = inp[i];
      outp[i] = ${WGSL_OP_EXPR[op]};
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

  try {
    const device = await getGpuDevice(options);
    if (!device) return null;

    const bytes = n * 4;
    const input = xs instanceof Float32Array ? xs : Float32Array.from(xs);

    // Two storage buffers, ping-ponged across the chain: upload once, read once.
    const bufA = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: 'chain-a',
    });
    const bufB = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      label: 'chain-b',
    });
    const staging = device.createBuffer({
      size: bytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label: 'chain-staging',
    });

    try {
      // Cast: TS's ArrayBufferLike vs @webgpu/types' ArrayBuffer-only
      // BufferSource. Same cast the matrix GPUContext uses for writeBuffer.
      device.queue.writeBuffer(bufA, 0, input as unknown as BufferSource);

      const encoder = device.createCommandEncoder({ label: 'elementwise-chain' });
      const workgroups = Math.ceil(n / WORKGROUP_SIZE);

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

        // Ping-pong: this pass's output is the next pass's input.
        [src, dst] = [dst, src];
      }

      // After the swap, `src` holds the final result.
      encoder.copyBufferToBuffer(src, 0, staging, 0, bytes);
      device.queue.submit([encoder.finish()]);

      await staging.mapAsync(GPUMapMode.READ);
      const out = new Float32Array(staging.getMappedRange().slice(0));
      staging.unmap();
      return out;
    } finally {
      bufA.destroy();
      bufB.destroy();
      staging.destroy();
    }
  } catch {
    // Device lost, kernel error, OOM — the GPU is best-effort. Fall back.
    return null;
  }
}

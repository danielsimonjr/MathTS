/**
 * WebGPU FFT — Stockham autosort, radix-2, f32.
 *
 * Why Stockham rather than the textbook Cooley-Tukey the CPU core uses: it is
 * **self-sorting**. Each pass reads one buffer and scatters into another, so the output
 * comes out in natural order with **no bit-reversal permutation pass** — and a bit-reversal
 * is a pure memory shuffle, which is the one thing a GPU is worst at. The ping-pong between
 * two buffers is also exactly the access pattern the hardware wants.
 *
 * ### Is it worth it? (see `FFT_GPU_MIN_ELEMENTS` for the full table)
 *
 * Chrome / NVIDIA Pascal, warm JIT, against `fftCoreFloat64` — the flat f64 core that
 * `parallelFFT` runs on this thread:
 *
 * | n         | CPU f64  | GPU f32  | speedup   |
 * | --------- | -------- | -------- | --------- |
 * | 65,536    | 16.8 ms  | 14.4 ms  | 1.17×     |
 * | 262,144   | 53.4 ms  | 24.0 ms  | **2.23×** |
 * | 1,048,576 | 253.1 ms | 79.7 ms  | **3.18×** |
 * | 2,097,152 | 399.9 ms | 116.3 ms | **3.44×** |
 *
 * (~2.2-3.4x, and the ratio is genuinely noisy run to run — regenerate it with
 * `gpu-fft-bench.browser.test.ts` rather than trusting a single hero number. f32 error is
 * ~4e-7 peak-relative at every size above.)
 *
 * Two things decided the design:
 *
 *  - **The threshold is 262,144, NOT `GPU_MIN_ELEMENTS`.** At 65,536 the GPU wins by 1.17×,
 *    which is inside the noise and nowhere near enough to justify dropping f64 for f32. An
 *    FFT makes log2(n) passes over the data, so it amortises the upload more slowly than the
 *    memory-bound element-wise chain does. Sharing one threshold would have been convenient
 *    and wrong.
 *  - **f32 accuracy holds.** Error growth across log2(n) stages was the real risk — it is why
 *    an f32 FFT is a harder sell than an f32 element-wise chain. Measured ~4e-7 relative to
 *    the spectrum's peak magnitude even at 20 stages, a few times f32 epsilon. Stockham is
 *    numerically well-behaved; the error did not compound.
 *
 * An earlier revision of this comment claimed 5.0-8.5x. That came from a COLD-JIT CPU
 * baseline and from comparing against a CPU path `parallelFFT` did not actually take. Both
 * are fixed; the numbers above are warm, and measured against the path it really runs.
 *
 * Same never-throw contract as the rest of the GPU surface: returns `null` — never rejects —
 * whenever the GPU is unavailable, not opted into, the input is below threshold, not a power
 * of two, or a device limit is exceeded. The caller then uses the exact f64 CPU path.
 *
 * @packageDocumentation
 */

import {
  getGpuDevice,
  getGlobalGPUContext,
  isGpuEnabled,
  ShaderManager,
  BufferPool,
  serializeGpu,
  type GPUContextOptions,
} from '@danielsimonjr/mathts-gpu';

/** Threads per workgroup. Each thread owns one butterfly, so a pass covers n/2 threads. */
const WORKGROUP_SIZE = 64;

/**
 * The FFT needs a HIGHER bar than `GPU_MIN_ELEMENTS` (65,536).
 *
 * Measured against the flat f64 core with a warm JIT (Chrome, NVIDIA Pascal):
 *
 * | n         | CPU f64  | GPU f32  | speedup   |
 * | --------- | -------- | -------- | --------- |
 * | 65,536    | 16.8 ms  | 14.4 ms  | **1.17×** |  <- not worth trading f64 for
 * | 262,144   | 53.4 ms  | 24.0 ms  | **2.23×** |  <- threshold
 * | 1,048,576 | 253.1 ms | 79.7 ms  | 3.18×     |
 * | 2,097,152 | 399.9 ms | 116.3 ms | 3.44×     |
 *
 * At `GPU_MIN_ELEMENTS` the GPU wins by 1.17× — inside the noise, and nowhere near enough to
 * justify dropping from f64 to f32. The element-wise chain can use 65,536 because it is
 * memory-bound and the GPU pulls away immediately; an FFT does log2(n) passes over the data,
 * so the upload is amortised more slowly. A shared threshold would have been convenient and
 * wrong.
 */
const FFT_GPU_MIN_ELEMENTS = 262_144;

const SHADER_KEY = 'fft:stockham';

/**
 * One Stockham radix-2 pass.
 *
 * `params = (n, ns, inverse, _)` where `ns` doubles from 1 to n/2 across the passes.
 *
 * Thread `i` in [0, n/2) combines `src[i]` and `src[i + n/2]` through a twiddle, then
 * SCATTERS the two butterfly outputs to `idxD` and `idxD + ns`. That scatter is what makes
 * the result naturally ordered — it is the whole reason there is no bit-reversal pass.
 *
 * Bounds are guarded against `params.x` (= n), never `arrayLength(&src)`. For THIS kernel
 * `bytes = n * 8` is always a power of two, so the pool happens not to pad — but relying on
 * that would make the kernel silently wrong the day the allocation strategy changes. Carrying
 * `n` explicitly is correct for any buffer >= n*8 bytes.
 */
const STOCKHAM_WGSL = `
  @group(0) @binding(0) var<storage, read> src: array<vec2<f32>>;
  @group(0) @binding(1) var<storage, read_write> dst: array<vec2<f32>>;
  @group(0) @binding(2) var<uniform> params: vec4<u32>; // n, ns, inverse, _

  fn cmul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
    return vec2<f32>(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
  }

  @compute @workgroup_size(${WORKGROUP_SIZE})
  fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let n = params.x;
    let ns = params.y;
    let half = n / 2u;
    let i = gid.x;
    if (i >= half) { return; }

    // -1 forward, +1 inverse — the same sign convention as the CPU core, so the two
    // implementations agree on which direction is which.
    let sgn = select(-1.0, 1.0, params.z == 1u);
    let angle = sgn * 2.0 * 3.14159265358979323846 * f32(i % ns) / f32(ns * 2u);
    let tw = vec2<f32>(cos(angle), sin(angle));

    let v0 = src[i];
    let v1 = cmul(src[i + half], tw);

    let idxD = (i / ns) * ns * 2u + (i % ns);
    dst[idxD] = v0 + v1;
    dst[idxD + ns] = v0 - v1;
  }
`;

interface Resources {
  device: GPUDevice;
  shaders: ShaderManager;
  pool: BufferPool;
  /** Per-stage uniform buffers, keyed by `${n}:${inverse}` — `ns` differs per pass. */
  stageUniforms: Map<string, GPUBuffer[]>;
}

let resources: Resources | null = null;

async function getResources(options?: GPUContextOptions): Promise<Resources | null> {
  const device = await getGpuDevice(options);
  if (!device) return null;
  if (resources && resources.device === device) return resources;

  // A new device means the old one was lost. Its buffers are gone with it, but the JS-side
  // pool and uniform cache would otherwise linger holding dead handles.
  if (resources) resetGpuFft();

  const ctx = getGlobalGPUContext();
  const shaders = new ShaderManager(ctx);
  shaders.registerShader(SHADER_KEY, STOCKHAM_WGSL);
  shaders.precompileRegistered();

  resources = { device, shaders, pool: new BufferPool(ctx), stageUniforms: new Map() };
  return resources;
}

/** Drop cached shaders/buffers (device loss, or between tests). */
export function resetGpuFft(): void {
  if (!resources) return;
  for (const bufs of resources.stageUniforms.values()) bufs.forEach((b) => b.destroy());
  resources.pool.destroy();
  resources = null;
}

/**
 * The uniform for each pass differs only in `ns`, so they are built once per (n, inverse)
 * and reused. A real caller transforms the same length over and over (a spectrogram, a
 * filter bank), so this is the common case, not an optimisation for a benchmark.
 */
function stageUniformsFor(res: Resources, n: number, inverse: boolean): GPUBuffer[] {
  const key = `${n}:${inverse ? 1 : 0}`;
  const cached = res.stageUniforms.get(key);
  if (cached) return cached;

  const stages = Math.log2(n);
  const bufs: GPUBuffer[] = [];
  for (let s = 0, ns = 1; s < stages; s++, ns *= 2) {
    const u = res.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      label: `fft-stage-${s}`,
    });
    res.device.queue.writeBuffer(u, 0, new Uint32Array([n, ns, inverse ? 1 : 0, 0]));
    bufs.push(u);
  }
  res.stageUniforms.set(key, bufs);
  return bufs;
}

const isPowerOf2 = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

/** Options for the GPU FFT. `gpu` overrides the process-global `enableGpu()` flag. */
export interface GpuFftOptions extends GPUContextOptions {
  /** Force the GPU on/off for this call, ignoring the global flag. */
  gpu?: boolean;
}

/** Result of a GPU FFT: f32-precision values widened into the f64 container. */
export interface GpuFftResult {
  real: Float64Array;
  imag: Float64Array;
}

/**
 * Run an FFT on the GPU.
 *
 * `real`/`imag` must be the same length, a power of two, and at least `FFT_GPU_MIN_ELEMENTS`
 * (262,144) — below that the GPU's margin (1.17× at 65,536) does not justify dropping f64 for
 * f32, so this declines and the caller keeps the exact CPU path.
 *
 * Returns `null` rather than throwing whenever it cannot or should not run, so the caller
 * simply falls through to the exact f64 CPU path.
 *
 * Precision: f32 (~4e-7 relative to the spectrum's peak, measured through 20 stages).
 * `enableGpu()` is how a caller consents to that.
 */
export function fftGpuDispatch(
  real: Float64Array,
  imag: Float64Array,
  inverse = false,
  options?: GpuFftOptions
): Promise<GpuFftResult | null> {
  // The cheap gates run OUTSIDE the serialization queue, deliberately.
  //
  // `parallelFFT` calls this on EVERY invocation, including with the GPU off (the default)
  // and at tiny sizes. If the gates lived inside `serializeGpu`, a 1,024-point CPU-only
  // transform would join the process-global GPU promise chain and wait behind whatever
  // 150 ms GPU dispatch happened to be in flight. A pure-CPU call must never acquire a
  // GPU-global serialization dependency.
  const n = real.length;
  if (!(options?.gpu ?? isGpuEnabled())) return Promise.resolve(null);
  if (imag.length !== n) return Promise.resolve(null);
  if (n < FFT_GPU_MIN_ELEMENTS) return Promise.resolve(null); // below this the GPU is ~1.17x: not worth f32
  if (!isPowerOf2(n)) return Promise.resolve(null); // radix-2 only; the CPU handles chirp-z

  return serializeGpu(() => fftGpuDispatchImpl(real, imag, inverse, options));
}

async function fftGpuDispatchImpl(
  real: Float64Array,
  imag: Float64Array,
  inverse: boolean,
  options?: GpuFftOptions
): Promise<GpuFftResult | null> {
  // The cheap gates already ran in `fftGpuDispatch`, before the serialization queue.
  const n = real.length;

  const bytes = n * 8; // vec2<f32>
  const workgroups = Math.ceil(n / 2 / WORKGROUP_SIZE);

  let res: Resources | undefined;
  let bufA: GPUBuffer | undefined;
  let bufB: GPUBuffer | undefined;
  let staging: GPUBuffer | undefined;
  let scopePushed = false;
  let scopePopped = false;

  try {
    const r = await getResources(options);
    if (!r) return null;
    res = r;
    const { device, shaders, pool } = r;

    // Refuse rather than return a wrong answer. A WebGPU validation error does NOT throw: it
    // invalidates the command buffer, submit() does nothing, and the zero-initialised staging
    // buffer reads back as ZEROS — which for an FFT is a silently empty spectrum.
    const limits = device.limits;
    if (workgroups > limits.maxComputeWorkgroupsPerDimension) return null;
    if (bytes > limits.maxStorageBufferBindingSize) return null;
    if (bytes > limits.maxBufferSize) return null;

    const stageUniforms = stageUniformsFor(r, n, inverse);

    // Interleave into vec2<f32>. Constructor-based conversion only — `Float32Array.from()`
    // on a typed array is the generic per-element path and costs ~73x more.
    const input = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      input[i * 2] = real[i];
      input[i * 2 + 1] = imag[i];
    }

    device.pushErrorScope('validation');
    scopePushed = true;

    bufA = pool.acquireStorageBuffer(bytes, 'fft-a', true, true);
    bufB = pool.acquireStorageBuffer(bytes, 'fft-b', true, true);
    staging = pool.acquireStagingBuffer(bytes, 'fft-staging');

    device.queue.writeBuffer(bufA, 0, input as unknown as BufferSource);

    const pipeline = shaders.getRegisteredPipeline(SHADER_KEY);

    // ONE encoder for all log2(n) passes, ONE submit. A submit per stage would pay the
    // round-trip 20 times at n=2^20 and give the whole win back.
    const encoder = device.createCommandEncoder({ label: 'fft-stockham' });
    let src = bufA;
    let dst = bufB;
    for (let s = 0; s < stageUniforms.length; s++) {
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: src } },
          { binding: 1, resource: { buffer: dst } },
          { binding: 2, resource: { buffer: stageUniforms[s] } },
        ],
      });
      const pass = encoder.beginComputePass({ label: `fft-stage-${s}` });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(workgroups);
      pass.end();
      // Ping-pong: after `s` passes, `src` is the buffer pass `s` wrote — for every s.
      [src, dst] = [dst, src];
    }

    encoder.copyBufferToBuffer(src, 0, staging, 0, bytes);
    device.queue.submit([encoder.finish()]);

    const validationError = await device.popErrorScope();
    scopePopped = true;
    if (validationError) return null; // the readback would be zeros — fall back

    await staging.mapAsync(GPUMapMode.READ, 0, bytes);
    const packed = new Float32Array(staging.getMappedRange(0, bytes).slice(0));
    staging.unmap();

    // De-interleave, widening f32 values into the f64 container the API promises.
    const outRe = new Float64Array(n);
    const outIm = new Float64Array(n);
    const scale = inverse ? 1 / n : 1; // the CPU core scales the inverse by 1/n; match it
    for (let i = 0; i < n; i++) {
      outRe[i] = packed[i * 2] * scale;
      outIm[i] = packed[i * 2 + 1] * scale;
    }
    return { real: outRe, imag: outIm };
  } catch {
    // Device lost, OOM, mapAsync rejection — the GPU is best-effort. Fall back.
    return null;
  } finally {
    // Keep the error-scope stack balanced. `scopePushed` is NOT redundant: `res` is assigned
    // before the push and the limit checks return in between, so a `finally` gated only on
    // `res` would pop a scope this call never pushed — landing on a concurrent dispatch's.
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
      if (staging) res.pool.release(staging);
    }
  }
}

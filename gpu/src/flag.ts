/**
 * Global WebGPU opt-in flag.
 *
 * The GPU tier is **OFF by default** and must be turned on explicitly. This is
 * a deliberate opt-in rather than an automatic optimization, because the GPU
 * path computes in **32-bit float** (WGSL has no f64): silently routing an f64
 * API onto a GPU would be a precision change the caller never asked for.
 *
 * The flag gates *implicit* routing — code paths where a caller invokes an
 * ordinary function and the library decides, underneath, to use the GPU.
 * (Explicitly-named entry points like `gpuMatmul` are their own opt-in.)
 */

let gpuEnabled = false;

/** Opt in to the f32 WebGPU acceleration tier. Off by default. */
export function enableGpu(): void {
  gpuEnabled = true;
}

/** Opt back out of the WebGPU tier. */
export function disableGpu(): void {
  gpuEnabled = false;
}

/** Whether the caller has opted in to the f32 WebGPU tier. */
export function isGpuEnabled(): boolean {
  return gpuEnabled;
}

/**
 * Minimum element count before a GPU dispatch is worth its upload/readback
 * cost. Below this, the transfer dominates and the CPU paths win — the same
 * reason element-wise ops were retired from the WASM backend.
 *
 * This is the canonical value; it is measured, not guessed (see the browser
 * benchmark in `tools/benchmark/gpu/`).
 */
export const GPU_MIN_ELEMENTS = 65536;

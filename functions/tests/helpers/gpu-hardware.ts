/**
 * Adapter classification for the WebGPU browser suite, and the f32 tolerances
 * that depend on it.
 *
 * CI deliberately makes WebGPU *available* on the runner (`.github/workflows/ci.yml`
 * installs Mesa lavapipe; Chromium in practice serves a SwiftShader adapter). That
 * is the right call — every WGSL kernel really compiles and executes there, so
 * correctness is genuinely covered on CI. But it means `requestAdapter()` returns
 * non-null on a CPU rasterizer, so `skipIf(!adapter)` does NOT skip, and two
 * classes of assertion break:
 *
 *  1. **Performance.** On a software rasterizer the "GPU" is the CPU plus extra
 *     copies. It loses to SIMD WASM. Gate perf assertions on `REAL_GPU`.
 *
 *  2. **Accuracy.** WGSL does not require correctly-rounded transcendentals. The
 *     spec's accuracy contract for `sin`/`cos` is an ABSOLUTE error of 2^-11
 *     (~4.9e-4) over [-π, π] — and SwiftShader spends that allowance where NVIDIA
 *     does not. Measured on CI: `sin` 1.4e-4 and `cos` 1.9e-4 relative error,
 *     versus ~6e-8 on a Pascal card. Both are conformant.
 *
 *     Our tolerances were calibrated on NVIDIA hardware, so they encoded *one
 *     vendor's* accuracy rather than the *standard's*. That is the same trap as
 *     writing a self-referential oracle: the bound has to come from the contract,
 *     not from whatever the machine on your desk happens to do.
 */

/** Software renderers that present as an ordinary GPU adapter. */
const SOFTWARE_ADAPTER = /llvmpipe|lavapipe|swiftshader|softwar|basic render|warp/i;

/**
 * True only for a physical GPU.
 *
 * `isFallbackAdapter` alone is not enough: a browser backed by a software Vulkan
 * ICD reports a perfectly ordinary adapter, so the info strings are sniffed too.
 * Unknown/empty info counts as software — the conservative direction, since a
 * false positive costs a flaky CI failure while a false negative only skips a
 * perf check.
 */
export async function isRealGpu(adapter: GPUAdapter | null): Promise<boolean> {
  if (!adapter) return false;
  if (adapter.isFallbackAdapter) return false;

  const info: GPUAdapterInfo | undefined = adapter.info ?? (await adapter.requestAdapterInfo?.());
  if (!info) return false;

  const haystack = [info.vendor, info.architecture, info.device, info.description]
    .filter(Boolean)
    .join(' ');
  if (!haystack.trim()) return false;

  return !SOFTWARE_ADAPTER.test(haystack);
}

const currentAdapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;

/** Resolved once: is this suite running on real silicon? */
export const REAL_GPU: boolean = await isRealGpu(currentAdapter);

/**
 * Relative-error bound for a single f32 transcendental kernel.
 *
 * Real GPU: 1e-4 — loose against the ~6e-8 actually measured on Pascal, but tight
 * enough to catch a broken kernel (a wrong formula misses by orders of magnitude,
 * not by a factor of two).
 *
 * Software: 1e-3 — ~5x headroom over the worst observed (cos, 1.9e-4) and still
 * far inside WGSL's own 4.9e-4 absolute allowance. This is not a threshold widened
 * to make a red run green; it is the bound the *specification* actually promises.
 */
export const F32_REL_TOL = REAL_GPU ? 1e-4 : 1e-3;

/** Same, for chains of 3+ ops where per-op error compounds. */
export const F32_REL_TOL_CHAIN = REAL_GPU ? 1e-3 : 1e-2;

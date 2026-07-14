/**
 * Distinguishes a REAL GPU from a software (CPU-emulated) adapter.
 *
 * CI deliberately installs Mesa lavapipe so that WebGPU is *available* in the
 * browser job (`.github/workflows/ci.yml`: `mesa-vulkan-drivers`,
 * `GALLIUM_DRIVER=llvmpipe`). That is the right call — it lets every WGSL kernel
 * actually compile and run, so correctness is genuinely covered on CI.
 *
 * But it means `navigator.gpu.requestAdapter()` returns non-null on a CPU
 * rasterizer, so `skipIf(!adapter)` does NOT skip in CI. Any *performance*
 * assertion therefore runs against llvmpipe, where the "GPU" is just the CPU with
 * extra copies — it will lose to SIMD WASM, not beat it.
 *
 * So: gate PERFORMANCE assertions on `isRealGpu`, and leave CORRECTNESS
 * assertions ungated. Never widen a perf budget to accommodate a software
 * adapter — that hides a real regression on real hardware.
 */

/** Software renderers that masquerade as a GPU adapter. */
const SOFTWARE_ADAPTER = /llvmpipe|lavapipe|swiftshader|softwar|basic render|warp/i;

/**
 * True only for a physical GPU.
 *
 * `isFallbackAdapter` alone is not enough: a browser backed by a software Vulkan
 * ICD reports a perfectly ordinary adapter, so we also sniff the adapter info
 * strings. Unknown/empty info is treated as software — the conservative
 * direction, since the cost of a false positive is a flaky CI failure and the
 * cost of a false negative is only a skipped perf check.
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

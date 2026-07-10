/**
 * Shared GPU device singleton.
 *
 * All library consumers (matrix, and later functions) share ONE GPU device.
 * Concurrent first-callers coalesce onto a single in-flight initialization
 * promise; the result is cached. Never throws — an unavailable device
 * (no adapter, unsupported environment, init failure) resolves to `null`.
 */

import { getGlobalGPUContext, type GPUContextOptions } from './GPUContext.js';

let inFlightDevice: Promise<GPUDevice | null> | null = null;

/**
 * Get the shared GPU device, or `null` if unavailable. Coalesces concurrent
 * calls onto one in-flight promise and caches the result. Never rejects.
 */
export function getGpuDevice(options?: GPUContextOptions): Promise<GPUDevice | null> {
  if (inFlightDevice) {
    return inFlightDevice;
  }
  inFlightDevice = (async () => {
    const ctx = getGlobalGPUContext();
    try {
      const ok = await ctx.initialize(options);
      return ok ? ctx.getDevice() : null;
    } catch {
      return null;
    }
  })();
  return inFlightDevice;
}

/**
 * Clear the cached device promise so the next `getGpuDevice()` re-initializes.
 * Use after a device-lost event, or between tests.
 */
export function resetGpuDevice(): void {
  inFlightDevice = null;
}

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
      if (!ok) return null;
      const device = ctx.getDevice();

      // Device loss is recoverable, but only if we stop handing out the corpse.
      // Without this, a lost device stays cached forever: every later call
      // rebuilds buffers, submits, waits for a rejected map, and falls back —
      // the GPU tier is permanently dead with a per-call latency tax. Dropping
      // the cache lets the next caller re-acquire a fresh device.
      void device.lost.then(() => {
        resetGpuDevice();
      });

      return device;
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

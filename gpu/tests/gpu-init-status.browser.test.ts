/**
 * Browser smoke for G15 / #835 — Chromium with `navigator.gpu` but no adapter
 * must not surface GPUContext.status === 'error' after a clean init attempt.
 */
import { describe, it, expect } from 'vitest';
import {
  enableGpu,
  hasWebGPU,
  hasWebGPUSurface,
  initializeGlobalGPU,
  initializeGlobalGPUWithReason,
  getGlobalGPUContext,
  isGpuEnabled,
} from '../src/index.js';

const adapter =
  typeof navigator !== 'undefined' && 'gpu' in navigator
    ? await navigator.gpu.requestAdapter().catch(() => null)
    : null;
const HAS_ADAPTER = adapter !== null;

describe('#835 WebGPU init status in Chromium', () => {
  it('after enableGpu + initializeGlobalGPU, status is never error', async () => {
    enableGpu();
    expect(isGpuEnabled()).toBe(true);

    const init = await initializeGlobalGPU();
    const ctx = getGlobalGPUContext();
    const status = ctx.status;

    expect(typeof init).toBe('boolean');
    expect(status === 'error').toBe(false);

    if (!init) {
      expect(status).toBe('unavailable');
      expect(hasWebGPU()).toBe(false);
    } else {
      expect(status).toBe('ready');
      expect(hasWebGPU()).toBe(true);
    }

    const withReason = await initializeGlobalGPUWithReason();
    if (HAS_ADAPTER) {
      expect(withReason.ok).toBe(true);
    } else if (hasWebGPUSurface()) {
      expect(withReason).toEqual({ ok: false, reason: 'unavailable' });
    }
  });
});

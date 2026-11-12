/**
 * Dogfood G15 — #759 (Node quiet fallback) and #835 (status vs hasWebGPU).
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  hasWebGPU,
  isBrowser,
  getGpuDevice,
  initializeGlobalGPU,
  initializeGlobalGPUWithReason,
  GPUContext,
  enableGpu,
  isGpuEnabled,
  detectGPUCapabilities,
  isGPUSuitableForMatrixOps,
  getGlobalGPUContext,
  destroyGlobalGPU,
} from '../src/index.js';

describe('#759 GPU quiet fallback in Node without WebGPU', () => {
  afterEach(() => {
    destroyGlobalGPU();
  });

  it('matches the issue repro: init false, status unavailable, caps helpers safe', async () => {
    enableGpu();
    expect(isBrowser()).toBe(false);
    expect(hasWebGPU()).toBe(false);

    expect(await getGpuDevice()).toBeNull();
    expect(await initializeGlobalGPU()).toBe(false);

    const ctx = new GPUContext();
    expect(await ctx.initialize()).toBe(false);
    expect(ctx.status).toBe('unavailable');
    expect(ctx.lastError).toBeNull();

    expect(isGPUSuitableForMatrixOps()).toBe(false);

    const caps = await detectGPUCapabilities();
    expect(caps.supported).toBe(false);
  });

  it('initializeGlobalGPUWithReason reports unavailable, not error', async () => {
    const result = await initializeGlobalGPUWithReason();
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(getGlobalGPUContext().status).toBe('unavailable');
  });

  it('enableGpu does not change unavailable outcome', () => {
    enableGpu();
    expect(isGpuEnabled()).toBe(true);
  });
});

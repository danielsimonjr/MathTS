import { describe, it, expect } from 'vitest';
import { GPUContext, getGlobalGPUContext } from '../src/GPUContext.js';

describe('GPUContext (headless Node)', () => {
  it('getDevice throws before initialization', () => {
    const ctx = new GPUContext();
    expect(() => ctx.getDevice()).toThrow(/not initialized/);
  });

  it('initialize resolves false in Node without throwing', async () => {
    const ctx = new GPUContext();
    await expect(ctx.initialize()).resolves.toBe(false);
  });

  it('concurrent initialize calls share one result and never throw', async () => {
    const ctx = new GPUContext();
    const [a, b] = await Promise.all([ctx.initialize(), ctx.initialize()]);
    expect(a).toBe(false);
    expect(b).toBe(false);
  });

  it('getGlobalGPUContext returns a stable singleton', () => {
    expect(getGlobalGPUContext()).toBe(getGlobalGPUContext());
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { getGpuDevice, resetGpuDevice } from '../src/device.js';

describe('getGpuDevice (headless Node)', () => {
  afterEach(() => resetGpuDevice());

  it('resolves to null without throwing when no GPU is present', async () => {
    await expect(getGpuDevice()).resolves.toBeNull();
  });

  it('coalesces concurrent calls onto one in-flight promise', () => {
    const p1 = getGpuDevice();
    const p2 = getGpuDevice();
    expect(p1).toBe(p2);
  });

  it('resetGpuDevice clears the cached promise', async () => {
    const p1 = getGpuDevice();
    await p1;
    resetGpuDevice();
    const p2 = getGpuDevice();
    expect(p2).not.toBe(p1);
  });
});

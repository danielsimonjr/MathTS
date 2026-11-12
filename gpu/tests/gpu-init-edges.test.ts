/**
 * G15 edge probes: null adapter vs a rejected request, one in-flight init,
 * device loss then re-init, and a warning that stays off unless opted in.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GPUContext, initializeGlobalGPUWithReason, destroyGlobalGPU } from '../src/GPUContext.js';
import {
  disableGpuUnavailableWarnings,
  enableGpuUnavailableWarnings,
  hasWebGPU,
  resetWebGPUAvailabilityCache,
} from '../src/detect.js';
import { stubGlobal, unstubAllGlobals } from './helpers/stub-global.js';

function stubGpu(requestAdapter: ReturnType<typeof vi.fn>): void {
  stubGlobal('navigator', { gpu: { requestAdapter } });
}

function adapterWithDevice(requestDevice: ReturnType<typeof vi.fn>) {
  return {
    info: { vendor: 'test', architecture: '', device: 'test', description: '' },
    limits: {
      maxBufferSize: 1,
      maxComputeWorkgroupSizeX: 16,
      maxComputeWorkgroupSizeY: 16,
      maxComputeWorkgroupSizeZ: 1,
      maxStorageBufferBindingSize: 1,
      maxComputeInvocationsPerWorkgroup: 256,
      maxComputeWorkgroupsPerDimension: 256,
    },
    features: new Set<string>(),
    requestDevice,
  };
}

afterEach(() => {
  destroyGlobalGPU();
  disableGpuUnavailableWarnings();
  resetWebGPUAvailabilityCache();
  unstubAllGlobals();
});

describe('GPU init edges', () => {
  it('requestAdapter null is unavailable, quiet, and clears hasWebGPU', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const requestAdapter = vi.fn().mockResolvedValue(null);
    stubGpu(requestAdapter);

    const ctx = new GPUContext();
    const [a, b] = await Promise.all([ctx.initialize(), ctx.initialize()]);

    expect(a).toBe(false);
    expect(b).toBe(false);
    expect(requestAdapter).toHaveBeenCalledTimes(1);
    expect(requestAdapter).toHaveBeenCalledWith({ powerPreference: 'high-performance' });
    expect(ctx.status).toBe('unavailable');
    expect(ctx.lastError).toBeNull();
    expect(hasWebGPU()).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('enableGpuUnavailableWarnings logs the null-adapter path once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    enableGpuUnavailableWarnings();
    stubGpu(vi.fn().mockResolvedValue(null));

    const ctx = new GPUContext();
    await ctx.initialize();
    await ctx.initialize();

    expect(ctx.status).toBe('unavailable');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('a rejected requestAdapter is an error and does not clear hasWebGPU', async () => {
    stubGpu(vi.fn().mockRejectedValue(new Error('adapter exploded')));
    const ctx = new GPUContext();
    expect(await ctx.initialize()).toBe(false);
    expect(ctx.status).toBe('error');
    expect(ctx.lastError?.message).toBe('adapter exploded');
    expect(hasWebGPU()).toBe(true);

    const reason = await initializeGlobalGPUWithReason();
    expect(reason).toEqual({ ok: false, reason: 'error' });
  });

  it('a rejected requestDevice stays an error after a live adapter', async () => {
    stubGpu(
      vi
        .fn()
        .mockResolvedValue(
          adapterWithDevice(vi.fn().mockRejectedValue(new Error('device exploded')))
        )
    );
    const ctx = new GPUContext();
    expect(await ctx.initialize()).toBe(false);
    expect(ctx.status).toBe('error');
    expect(ctx.lastError?.message).toBe('device exploded');
    expect(hasWebGPU()).toBe(true);
  });

  it('a ready context does not request the adapter again', async () => {
    const requestAdapter = vi.fn().mockResolvedValue(
      adapterWithDevice(
        vi.fn().mockResolvedValue({
          queue: { onSubmittedWorkDone: vi.fn() },
          lost: new Promise(() => {}),
          onuncapturederror: null,
        })
      )
    );
    stubGpu(requestAdapter);
    const ctx = new GPUContext();
    expect(await ctx.initialize()).toBe(true);
    expect(await ctx.initialize()).toBe(true);
    expect(requestAdapter).toHaveBeenCalledTimes(1);
    expect(ctx.status).toBe('ready');
    expect(ctx.lastError).toBeNull();
  });

  it('device loss is status lost, and a later initialize can become ready', async () => {
    let lose: (info: { reason: GPUDeviceLostReason; message: string }) => void = () => {};
    const first = {
      queue: { onSubmittedWorkDone: vi.fn() },
      lost: new Promise<{ reason: GPUDeviceLostReason; message: string }>((resolve) => {
        lose = resolve;
      }),
      onuncapturederror: null,
    };
    const second = {
      queue: { onSubmittedWorkDone: vi.fn() },
      lost: new Promise(() => {}),
      onuncapturederror: null,
    };
    const requestDevice = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    stubGpu(vi.fn().mockResolvedValue(adapterWithDevice(requestDevice)));

    const ctx = new GPUContext();
    expect(await ctx.initialize()).toBe(true);
    lose({ reason: 'unknown', message: 'device gone' });
    await Promise.resolve();
    expect(ctx.status).toBe('lost');
    expect(ctx.lastError?.message).toBe('device gone');

    expect(await ctx.initialize()).toBe(true);
    expect(ctx.status).toBe('ready');
    expect(ctx.lastError).toBeNull();
    expect(requestDevice).toHaveBeenCalledTimes(2);
  });
});

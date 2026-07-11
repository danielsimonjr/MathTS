import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GPUContext } from '../src/GPUContext.js';

describe('GPUContext (mocked WebGPU)', () => {
  let originalNavigator: any;
  let originalGPUBufferUsage: any;
  let originalGPUMapMode: any;

  beforeEach(() => {
    // Stub WebGPU constants
    originalGPUBufferUsage = (globalThis as any).GPUBufferUsage;
    (globalThis as any).GPUBufferUsage = {
      MAP_READ: 1,
      MAP_WRITE: 2,
      COPY_SRC: 4,
      COPY_DST: 8,
      INDEX: 16,
      VERTEX: 32,
      UNIFORM: 64,
      STORAGE: 128,
      INDIRECT: 256,
      QUERY_RESOLVE: 512,
    };

    originalGPUMapMode = (globalThis as any).GPUMapMode;
    (globalThis as any).GPUMapMode = {
      READ: 1,
      WRITE: 2,
    };

    // Save original navigator if exists
    originalNavigator = globalThis.navigator;

    // Create a robust mock for navigator.gpu
    const mockDevice = {
      queue: {
        submit: vi.fn(),
        writeBuffer: vi.fn(),
        onSubmittedWorkDone: vi.fn().mockResolvedValue(undefined),
      },
      createCommandEncoder: vi.fn().mockReturnValue({
        beginComputePass: vi.fn().mockReturnValue({
          setPipeline: vi.fn(),
          setBindGroup: vi.fn(),
          dispatchWorkgroups: vi.fn(),
          end: vi.fn(),
        }),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn().mockReturnValue({}), // Mock GPUCommandBuffer
      }),
      createBuffer: vi.fn().mockImplementation((desc) => ({
        size: desc.size,
        usage: desc.usage,
        mapAsync: vi.fn().mockResolvedValue(undefined),
        getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(desc.size)),
        unmap: vi.fn(),
        destroy: vi.fn(),
      })),
      createComputePipeline: vi.fn().mockReturnValue({}),
      createShaderModule: vi.fn().mockReturnValue({}),
      createBindGroup: vi.fn().mockReturnValue({}),
      destroy: vi.fn(),
      // Use a promise that doesn't resolve immediately to avoid status changing to 'lost'
      lost: new Promise(() => {}),
      onuncapturederror: null,
    };

    const mockAdapter = {
      info: {
        vendor: 'mock-vendor',
        architecture: 'mock-arch',
        device: 'mock-device',
        description: 'mock-desc',
      },
      limits: {
        maxBufferSize: 256 * 1024 * 1024,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
        maxStorageBufferBindingSize: 128 * 1024 * 1024,
        maxComputeInvocationsPerWorkgroup: 256,
        maxComputeWorkgroupsPerDimension: 65535,
      },
      features: new Set(['shader-f16']),
      isFallbackAdapter: false,
      requestDevice: vi.fn().mockResolvedValue(mockDevice),
    };

    // Setup global navigator mock
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();

    if (originalGPUBufferUsage !== undefined) {
      (globalThis as any).GPUBufferUsage = originalGPUBufferUsage;
    } else {
      delete (globalThis as any).GPUBufferUsage;
    }

    if (originalGPUMapMode !== undefined) {
      (globalThis as any).GPUMapMode = originalGPUMapMode;
    } else {
      delete (globalThis as any).GPUMapMode;
    }
  });

  it('initializes successfully when WebGPU is available', async () => {
    const ctx = new GPUContext();
    expect(ctx.status).toBe('uninitialized');
    expect(ctx.isReady).toBe(false);

    const success = await ctx.initialize();

    expect(success).toBe(true);
    expect(ctx.status).toBe('ready');
    expect(ctx.isReady).toBe(true);
    expect(ctx.getDevice()).toBeDefined();
    expect(ctx.getQueue()).toBeDefined();

    // Capabilities should be populated
    expect(ctx.capabilities?.supported).toBe(true);
    expect(ctx.capabilities?.maxBufferSize).toBe(256 * 1024 * 1024);
  });

  it('destroys context correctly', async () => {
    const ctx = new GPUContext();
    await ctx.initialize();

    expect(ctx.isReady).toBe(true);
    ctx.destroy();

    expect(ctx.isReady).toBe(false);
    expect(ctx.status).toBe('uninitialized');
    expect(() => ctx.getDevice()).toThrow(/not initialized/);
  });

  it('creates buffers correctly', async () => {
    const ctx = new GPUContext();
    await ctx.initialize();

    // The constants correspond to GPUBufferUsage
    // STORAGE = 128 (0x0080), COPY_SRC = 4 (0x0004), COPY_DST = 8 (0x0008), MAP_READ = 1 (0x0001)

    const buffer = ctx.createBuffer(1024, 12, 'TestBuffer'); // COPY_SRC | COPY_DST
    expect(buffer.size).toBe(1024);
    expect(buffer.usage).toBe(12);

    const storageBuffer = ctx.createStorageBuffer(2048, 'Storage');
    // STORAGE | COPY_SRC | COPY_DST = 128 | 4 | 8 = 140
    expect(storageBuffer.size).toBe(2048);
    expect(storageBuffer.usage).toBe(140);

    const readOnlyStorage = ctx.createStorageBuffer(512, 'ReadOnly', true, false);
    // STORAGE | COPY_SRC = 128 | 4 = 132
    expect(readOnlyStorage.usage).toBe(132);

    const stagingBuffer = ctx.createStagingBuffer(256, 'Staging');
    // MAP_READ | COPY_DST = 1 | 8 = 9
    expect(stagingBuffer.size).toBe(256);
    expect(stagingBuffer.usage).toBe(9);
  });

  it('handles commands correctly', async () => {
    const ctx = new GPUContext();
    await ctx.initialize();

    const encoder = ctx.createCommandEncoder('TestEncoder');
    expect(encoder).toBeDefined();

    const buffer = ctx.createBuffer(16, 8); // COPY_DST

    // Test writeBuffer
    const data = new Float32Array([1, 2, 3, 4]);
    ctx.writeBuffer(buffer, data);
    expect(ctx.getQueue().writeBuffer).toHaveBeenCalledWith(buffer, 0, data, undefined, undefined);

    // Test readBuffer
    const result = await ctx.readBuffer(buffer);
    expect(result).toBeDefined();

    // Test submitCommands
    ctx.submitCommands([]);
    expect(ctx.getQueue().submit).toHaveBeenCalledWith([]);

    // Test wait
    await ctx.waitForCompletion();
    expect(ctx.getQueue().onSubmittedWorkDone).toHaveBeenCalled();
  });

  it('handles initialization failure gracefully', async () => {
    // Override adapter mock to return null
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue(null),
      },
    });

    const ctx = new GPUContext();
    const success = await ctx.initialize();

    expect(success).toBe(false);
    expect(ctx.status).toBe('error');
    expect(ctx.lastError).toBeDefined();
    expect(ctx.lastError?.message).toMatch(/adapter/i);
  });

  it('handles device failure gracefully', async () => {
    // Override adapter mock to return an adapter but fail device creation
    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({
          info: {},
          limits: {},
          features: new Set(),
          requestDevice: vi.fn().mockResolvedValue(null),
        }),
      },
    });

    const ctx = new GPUContext();
    const success = await ctx.initialize();

    expect(success).toBe(false);
    expect(ctx.status).toBe('error');
    expect(ctx.lastError).toBeDefined();
    expect(ctx.lastError?.message).toMatch(/device/i);
  });

  it('handles device lost events', async () => {
    let lostCallback: any;

    // Override the lost promise to be controllable
    const mockDevice = {
      queue: { onSubmittedWorkDone: vi.fn() },
      lost: new Promise((resolve) => {
        lostCallback = resolve;
      }),
      onuncapturederror: null,
    };

    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({
          info: {},
          limits: {},
          features: new Set(),
          requestDevice: vi.fn().mockResolvedValue(mockDevice),
        }),
      },
    });

    const ctx = new GPUContext();
    const eventHandler = vi.fn();
    ctx.onDeviceLost(eventHandler);

    await ctx.initialize();

    expect(ctx.status).toBe('ready');

    // Simulate device lost
    lostCallback({ reason: 'destroyed', message: 'Test device lost' });

    // Wait for the promise resolution to propagate
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(ctx.status).toBe('lost');
    expect(eventHandler).toHaveBeenCalledWith({ reason: 'destroyed', message: 'Test device lost' });
  });

  it('handles uncaptured errors', async () => {
    const mockDevice: any = {
      queue: { onSubmittedWorkDone: vi.fn() },
      lost: new Promise(() => {}),
      onuncapturederror: null,
    };

    vi.stubGlobal('navigator', {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue({
          info: {},
          limits: {},
          features: new Set(),
          requestDevice: vi.fn().mockResolvedValue(mockDevice),
        }),
      },
    });

    const ctx = new GPUContext();
    await ctx.initialize();

    expect(mockDevice.onuncapturederror).toBeDefined();

    // Simulate error
    const testError = new Error('Out of memory');
    mockDevice.onuncapturederror({ error: testError });

    expect(ctx.lastError).toBeDefined();
    expect(ctx.lastError?.message).toContain('Out of memory');
  });
});

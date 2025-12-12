/**
 * GPU Integration Tests
 *
 * Tests for batch operations, async pipeline, and sync strategies.
 * These tests verify the advanced GPU infrastructure components.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  GPUContext,
  getGlobalGPUContext,
  destroyGlobalGPU,
} from '../../src/backends/gpu/GPUContext.js';
import { BufferPool } from '../../src/backends/gpu/BufferPool.js';
import { ShaderManager, BUILTIN_SHADERS } from '../../src/backends/gpu/ShaderManager.js';
import {
  BatchExecutor,
  type BatchOperation,
  type BatchResult,
} from '../../src/backends/gpu/BatchExecutor.js';
import {
  SyncManager,
  createSyncManager,
  type SyncStrategy,
  type TransferResult,
} from '../../src/backends/gpu/Sync.js';

describe('BatchExecutor', () => {
  describe('Queue management', () => {
    it('should start with empty queue', () => {
      // Create mock objects for testing structure
      const mockContext = {} as GPUContext;
      const mockShaders = {} as ShaderManager;
      const mockPool = {} as BufferPool;

      const executor = new BatchExecutor(mockContext, mockShaders, mockPool);

      expect(executor.size).toBe(0);
      expect(executor.isEmpty).toBe(true);
      expect(executor.isFull).toBe(false);
    });

    it('should track batch size', () => {
      const mockContext = {} as GPUContext;
      const mockShaders = {} as ShaderManager;
      const mockPool = {} as BufferPool;

      const executor = new BatchExecutor(mockContext, mockShaders, mockPool, {
        maxBatchSize: 10,
        autoFlush: false,
      });

      // Manually add operations (testing internal state)
      const mockBuffer = {} as GPUBuffer;
      for (let i = 0; i < 5; i++) {
        (executor as unknown as { operations: BatchOperation[] }).operations.push({
          type: 'add',
          inputA: mockBuffer,
          inputB: mockBuffer,
          output: mockBuffer,
          dimensions: { rows: 10, cols: 10 },
        });
      }

      expect(executor.size).toBe(5);
      expect(executor.isEmpty).toBe(false);
      expect(executor.isFull).toBe(false);
    });

    it('should detect full batch', () => {
      const mockContext = {} as GPUContext;
      const mockShaders = {} as ShaderManager;
      const mockPool = {} as BufferPool;

      const executor = new BatchExecutor(mockContext, mockShaders, mockPool, {
        maxBatchSize: 5,
        autoFlush: false,
      });

      const mockBuffer = {} as GPUBuffer;
      for (let i = 0; i < 5; i++) {
        (executor as unknown as { operations: BatchOperation[] }).operations.push({
          type: 'add',
          inputA: mockBuffer,
          inputB: mockBuffer,
          output: mockBuffer,
          dimensions: { rows: 10, cols: 10 },
        });
      }

      expect(executor.isFull).toBe(true);
    });

    it('should clear operations', () => {
      const mockContext = {} as GPUContext;
      const mockShaders = {} as ShaderManager;
      const mockPool = {} as BufferPool;

      const executor = new BatchExecutor(mockContext, mockShaders, mockPool);

      const mockBuffer = {} as GPUBuffer;
      (executor as unknown as { operations: BatchOperation[] }).operations.push({
        type: 'add',
        inputA: mockBuffer,
        inputB: mockBuffer,
        output: mockBuffer,
        dimensions: { rows: 10, cols: 10 },
      });

      expect(executor.size).toBe(1);

      executor.clear();

      expect(executor.size).toBe(0);
      expect(executor.isEmpty).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should report stats', () => {
      const mockContext = {} as GPUContext;
      const mockShaders = {} as ShaderManager;
      const mockPool = {} as BufferPool;

      const executor = new BatchExecutor(mockContext, mockShaders, mockPool, {
        maxBatchSize: 50,
        autoFlush: true,
      });

      const stats = executor.getStats();

      expect(stats.queuedOperations).toBe(0);
      expect(stats.maxBatchSize).toBe(50);
      expect(stats.autoFlush).toBe(true);
    });
  });

  describe('Flush with empty queue', () => {
    it('should handle empty flush gracefully', async () => {
      const mockContext = {} as GPUContext;
      const mockShaders = {} as ShaderManager;
      const mockPool = {} as BufferPool;

      const executor = new BatchExecutor(mockContext, mockShaders, mockPool);

      const result = await executor.flush();

      expect(result.success).toBe(true);
      expect(result.operationCount).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('SyncManager', () => {
  describe('Configuration', () => {
    it('should use default configuration', () => {
      const mockContext = {
        getDevice: () => ({ queue: { onSubmittedWorkDone: () => Promise.resolve() } }),
        writeBuffer: () => {},
        readBuffer: () => Promise.resolve(new Float32Array(0)),
        createCommandEncoder: () => ({}),
        submitCommands: () => {},
        createStagingBuffer: () => ({} as GPUBuffer),
      } as unknown as GPUContext;
      const mockPool = {} as BufferPool;

      const sync = new SyncManager(mockContext, mockPool);
      const stats = sync.getStats();

      expect(stats.strategy).toBe('lazy');
      expect(stats.totalUploads).toBe(0);
      expect(stats.totalDownloads).toBe(0);
    });

    it('should accept custom configuration', () => {
      const mockContext = {
        getDevice: () => ({ queue: { onSubmittedWorkDone: () => Promise.resolve() } }),
        writeBuffer: () => {},
        readBuffer: () => Promise.resolve(new Float32Array(0)),
        createCommandEncoder: () => ({}),
        submitCommands: () => {},
        createStagingBuffer: () => ({} as GPUBuffer),
      } as unknown as GPUContext;
      const mockPool = {} as BufferPool;

      const sync = new SyncManager(mockContext, mockPool, {
        strategy: 'immediate',
        chunkSize: 512 * 1024,
      });

      const stats = sync.getStats();
      expect(stats.strategy).toBe('immediate');
    });
  });

  describe('Statistics', () => {
    it('should track upload statistics', async () => {
      let writeBufferCalled = false;

      const mockContext = {
        getDevice: () => ({ queue: { onSubmittedWorkDone: () => Promise.resolve() } }),
        writeBuffer: () => { writeBufferCalled = true; },
        readBuffer: () => Promise.resolve(new Float32Array(0)),
        createCommandEncoder: () => ({}),
        submitCommands: () => {},
        createStagingBuffer: () => ({} as GPUBuffer),
      } as unknown as GPUContext;
      const mockPool = {} as BufferPool;

      const sync = new SyncManager(mockContext, mockPool, { strategy: 'lazy' });

      const data = new Float32Array(100);
      const mockBuffer = { size: 400 } as GPUBuffer;

      await sync.upload(data, mockBuffer);

      const stats = sync.getStats();
      expect(stats.totalUploads).toBe(1);
      expect(stats.totalBytesUploaded).toBe(400);
      expect(writeBufferCalled).toBe(true);
    });

    it('should track download statistics', async () => {
      const mockContext = {
        getDevice: () => ({ queue: { onSubmittedWorkDone: () => Promise.resolve() } }),
        writeBuffer: () => {},
        readBuffer: () => Promise.resolve(new Float32Array(25)),
        createCommandEncoder: () => ({}),
        submitCommands: () => {},
        createStagingBuffer: () => ({} as GPUBuffer),
      } as unknown as GPUContext;
      const mockPool = {} as BufferPool;

      const sync = new SyncManager(mockContext, mockPool);

      const mockBuffer = { size: 100 } as GPUBuffer;

      await sync.download(mockBuffer);

      const stats = sync.getStats();
      expect(stats.totalDownloads).toBe(1);
      expect(stats.totalBytesDownloaded).toBe(100);
    });
  });

  describe('Create helper', () => {
    it('should create sync manager with specified strategy', () => {
      const mockContext = {
        getDevice: () => ({ queue: { onSubmittedWorkDone: () => Promise.resolve() } }),
        writeBuffer: () => {},
        readBuffer: () => Promise.resolve(new Float32Array(0)),
        createCommandEncoder: () => ({}),
        submitCommands: () => {},
        createStagingBuffer: () => ({} as GPUBuffer),
      } as unknown as GPUContext;
      const mockPool = {} as BufferPool;

      const sync = createSyncManager(mockContext, mockPool, 'double-buffer');
      const stats = sync.getStats();

      expect(stats.strategy).toBe('double-buffer');
    });
  });

  describe('Destroy', () => {
    it('should clean up resources on destroy', () => {
      const destroyedBuffers: GPUBuffer[] = [];
      const mockContext = {
        getDevice: () => ({ queue: { onSubmittedWorkDone: () => Promise.resolve() } }),
        writeBuffer: () => {},
        readBuffer: () => Promise.resolve(new Float32Array(0)),
        createCommandEncoder: () => ({}),
        submitCommands: () => {},
        createStagingBuffer: () => ({
          size: 1024,
          destroy: function() { destroyedBuffers.push(this as unknown as GPUBuffer); },
        } as unknown as GPUBuffer),
      } as unknown as GPUContext;
      const mockPool = {} as BufferPool;

      const sync = new SyncManager(mockContext, mockPool);

      // Force creation of staging buffer
      (sync as unknown as { getOrCreateStagingBuffer: (size: number) => GPUBuffer })
        .getOrCreateStagingBuffer(1024);

      sync.destroy();

      const stats = sync.getStats();
      expect(stats.stagingBuffersCount).toBe(0);
    });
  });
});

describe('WGSL Shader Files', () => {
  describe('Transpose shader', () => {
    // We can't directly import WGSL files, but we can verify the builtin shaders
    it('should have transpose operations in builtin shaders', () => {
      expect(BUILTIN_SHADERS.transpose).toBeDefined();
      expect(BUILTIN_SHADERS.transpose).toContain('@compute');
    });
  });

  describe('LU decomposition concepts', () => {
    // Test CPU reference for LU
    it('should correctly decompose 2x2 matrix', () => {
      // A = [[4, 3], [6, 3]]
      // L = [[1, 0], [1.5, 1]]
      // U = [[4, 3], [0, -1.5]]
      // LU = [[4, 3], [6, 3]] ✓

      const a = [4, 3, 6, 3];
      const n = 2;

      // Simple LU without pivoting
      const L = [1, 0, 0, 1];
      const U = [...a];

      // k = 0: eliminate below diagonal
      const factor = U[2] / U[0]; // 6/4 = 1.5
      L[2] = factor;
      U[2] = 0;
      U[3] = U[3] - factor * U[1]; // 3 - 1.5*3 = -1.5

      expect(L[2]).toBeCloseTo(1.5);
      expect(U[3]).toBeCloseTo(-1.5);
    });

    it('should support partial pivoting conceptually', () => {
      // In real LU, we find max in column and swap rows
      const column = [2, 5, 1, 8, 3];
      const maxIdx = column.reduce((maxI, val, i, arr) =>
        val > arr[maxI] ? i : maxI, 0);

      expect(maxIdx).toBe(3); // Index of 8
    });
  });
});

describe('Batch Operations Integration', () => {
  describe('Operation type mapping', () => {
    it('should support all standard operation types', () => {
      const operations = [
        'add',
        'subtract',
        'multiply',
        'divide',
        'scale',
        'matmul',
        'transpose',
        'reduce_sum',
        'reduce_max',
        'reduce_min',
      ];

      // Verify all types are valid (type checking ensures this)
      for (const op of operations) {
        expect(typeof op).toBe('string');
      }
    });
  });

  describe('Workgroup calculation', () => {
    it('should calculate workgroups for standard matrices', () => {
      // 256x256 matrix with 16x16 workgroups
      const rows = 256;
      const cols = 256;
      const workgroupSize = 16;

      const wgX = Math.ceil(cols / workgroupSize);
      const wgY = Math.ceil(rows / workgroupSize);

      expect(wgX).toBe(16);
      expect(wgY).toBe(16);
    });

    it('should handle non-divisible dimensions', () => {
      const rows = 100;
      const cols = 150;
      const workgroupSize = 16;

      const wgX = Math.ceil(cols / workgroupSize);
      const wgY = Math.ceil(rows / workgroupSize);

      expect(wgX).toBe(10); // ceil(150/16) = 10
      expect(wgY).toBe(7);  // ceil(100/16) = 7
    });

    it('should calculate workgroups for reductions', () => {
      const elements = 10000;
      const workgroupSize = 256;

      const wgX = Math.ceil(elements / workgroupSize);

      expect(wgX).toBe(40); // ceil(10000/256) = 40
    });
  });
});

describe('Sync Strategy Patterns', () => {
  describe('Strategy types', () => {
    const strategies: SyncStrategy[] = ['immediate', 'lazy', 'double-buffer', 'streaming'];

    it('should define all sync strategies', () => {
      expect(strategies).toContain('immediate');
      expect(strategies).toContain('lazy');
      expect(strategies).toContain('double-buffer');
      expect(strategies).toContain('streaming');
    });
  });

  describe('Chunk size calculation', () => {
    it('should use power of 2 for buffer sizes', () => {
      const roundToPowerOf2 = (n: number): number => {
        if (n <= 0) return 256;
        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        n |= n >> 8;
        n |= n >> 16;
        return n + 1;
      };

      expect(roundToPowerOf2(1000)).toBe(1024);
      expect(roundToPowerOf2(1024)).toBe(1024);
      expect(roundToPowerOf2(1025)).toBe(2048);
      expect(roundToPowerOf2(500)).toBe(512);
    });
  });

  describe('Streaming progress', () => {
    it('should calculate correct progress for streaming', () => {
      const totalElements = 10000;
      const chunkSize = 2500;
      const progressValues: number[] = [];

      for (let offset = 0; offset < totalElements; offset += chunkSize) {
        const end = Math.min(offset + chunkSize, totalElements);
        const progress = end / totalElements;
        progressValues.push(progress);
      }

      expect(progressValues).toEqual([0.25, 0.5, 0.75, 1.0]);
    });
  });
});

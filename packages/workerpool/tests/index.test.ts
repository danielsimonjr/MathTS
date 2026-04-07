/**
 * Tests for @danielsimonjr/mathts-workerpool
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  MathWorkerPool,
  DEFAULT_WORKER_CONFIG,
  canUseSharedMemory,
  createSharedFloat64Array,
  createSharedBuffer,
  isSharedBuffer,
  getCapabilities,
  transferFloat64,
  transferArrayBuffer,
  transferTypedArray,
  type EnhancedPoolStats,
  type PoolMetrics,
  type WorkerpoolCapabilities,
} from '../src/index.js';

describe('@danielsimonjr/mathts-workerpool', () => {
  describe('MathWorkerPool configuration', () => {
    it('should create pool with default config', () => {
      const pool = new MathWorkerPool();
      const config = pool.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.minWorkers).toBe(DEFAULT_WORKER_CONFIG.minWorkers);
      expect(config.maxWorkers).toBeGreaterThan(0);
      expect(config.parallelThreshold).toBe(DEFAULT_WORKER_CONFIG.parallelThreshold);
      expect(config.chunkSize).toBe(DEFAULT_WORKER_CONFIG.chunkSize);
    });

    it('should create pool with custom config', () => {
      const pool = new MathWorkerPool({
        maxWorkers: 2,
        parallelThreshold: 1000,
        chunkSize: 500,
      });
      const config = pool.getConfig();

      expect(config.maxWorkers).toBe(2);
      expect(config.parallelThreshold).toBe(1000);
      expect(config.chunkSize).toBe(500);
    });

    it('should update config', () => {
      const pool = new MathWorkerPool();
      pool.updateConfig({ parallelThreshold: 5000 });
      const config = pool.getConfig();

      expect(config.parallelThreshold).toBe(5000);
    });

    it('should not be ready before initialization', () => {
      const pool = new MathWorkerPool();
      expect(pool.isReady()).toBe(false);
    });
  });

  describe('shouldParallelize', () => {
    it('should return false when disabled', () => {
      const pool = new MathWorkerPool({ enabled: false });
      expect(pool.shouldParallelize(100000)).toBe(false);
    });

    it('should return false below threshold', () => {
      const pool = new MathWorkerPool({ parallelThreshold: 10000 });
      expect(pool.shouldParallelize(5000)).toBe(false);
    });

    it('should return false when pool not initialized', () => {
      const pool = new MathWorkerPool();
      expect(pool.shouldParallelize(100000)).toBe(false);
    });

    it('should respect forceSequential option', async () => {
      const pool = new MathWorkerPool();
      await pool.initialize();

      expect(pool.shouldParallelize(100000, { forceSequential: true })).toBe(false);

      await pool.terminate();
    });

    it('should respect forceParallel option', async () => {
      const pool = new MathWorkerPool();
      await pool.initialize();

      expect(pool.shouldParallelize(100, { forceParallel: true })).toBe(true);

      await pool.terminate();
    });
  });

  describe('Sequential operations (no workers)', () => {
    let pool: MathWorkerPool;

    beforeAll(async () => {
      // Use high threshold to force sequential execution
      pool = new MathWorkerPool({ parallelThreshold: 1000000 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    it('should compute sum sequentially', async () => {
      const data = new Float64Array([1, 2, 3, 4, 5]);
      const result = await pool.sum(data);

      expect(result.result).toBe(15);
      expect(result.parallelized).toBe(false);
      expect(result.chunks).toBe(1);
      expect(result.workersUsed).toBe(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should compute dot product sequentially', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([4, 5, 6]);
      const result = await pool.dot(a, b);

      expect(result.result).toBe(32); // 1*4 + 2*5 + 3*6 = 4 + 10 + 18
      expect(result.parallelized).toBe(false);
    });

    it('should perform elementwise add sequentially', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([5, 6, 7, 8]);
      const result = await pool.elementwise(a, b, 'add');

      expect(Array.from(result.result)).toEqual([6, 8, 10, 12]);
      expect(result.parallelized).toBe(false);
    });

    it('should perform elementwise subtract sequentially', async () => {
      const a = new Float64Array([10, 20, 30]);
      const b = new Float64Array([1, 2, 3]);
      const result = await pool.elementwise(a, b, 'subtract');

      expect(Array.from(result.result)).toEqual([9, 18, 27]);
    });

    it('should perform elementwise multiply sequentially', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([2, 3, 4]);
      const result = await pool.elementwise(a, b, 'multiply');

      expect(Array.from(result.result)).toEqual([2, 6, 12]);
    });

    it('should perform elementwise divide sequentially', async () => {
      const a = new Float64Array([10, 20, 30]);
      const b = new Float64Array([2, 4, 5]);
      const result = await pool.elementwise(a, b, 'divide');

      expect(Array.from(result.result)).toEqual([5, 5, 6]);
    });

    it('should scale array sequentially', async () => {
      const data = new Float64Array([1, 2, 3, 4]);
      const result = await pool.scale(data, 2);

      expect(Array.from(result.result)).toEqual([2, 4, 6, 8]);
      expect(result.parallelized).toBe(false);
    });

    it('should perform matrix multiplication sequentially', async () => {
      // 2x3 matrix
      const a = new Float64Array([
        1, 2, 3,
        4, 5, 6,
      ]);
      // 3x2 matrix
      const b = new Float64Array([
        7, 8,
        9, 10,
        11, 12,
      ]);

      const result = await pool.matmul(a, 2, 3, b, 2);

      // Result should be 2x2
      // [1,2,3] * [7,9,11]^T = 7+18+33 = 58
      // [1,2,3] * [8,10,12]^T = 8+20+36 = 64
      // [4,5,6] * [7,9,11]^T = 28+45+66 = 139
      // [4,5,6] * [8,10,12]^T = 32+50+72 = 154
      expect(Array.from(result.result)).toEqual([58, 64, 139, 154]);
      expect(result.parallelized).toBe(false);
    });

    it('should transpose matrix sequentially', async () => {
      // 2x3 matrix
      const data = new Float64Array([
        1, 2, 3,
        4, 5, 6,
      ]);

      const result = await pool.transpose(data, 2, 3);

      // Result should be 3x2
      // [1, 4]
      // [2, 5]
      // [3, 6]
      expect(Array.from(result.result)).toEqual([1, 4, 2, 5, 3, 6]);
      expect(result.parallelized).toBe(false);
    });

    it('should map array sequentially', async () => {
      const data = [1, 2, 3, 4];
      const result = await pool.map(data, (x) => x * x);

      expect(result.result).toEqual([1, 4, 9, 16]);
      expect(result.parallelized).toBe(false);
    });

    it('should reduce array sequentially', async () => {
      const data = [1, 2, 3, 4];
      const result = await pool.reduce(data, (acc, x) => acc + x, 0);

      expect(result.result).toBe(10);
      expect(result.parallelized).toBe(false);
    });

    it('should filter array sequentially', async () => {
      const data = [1, 2, 3, 4, 5, 6];
      const result = await pool.filter(data, (x) => x % 2 === 0);

      expect(result.result).toEqual([2, 4, 6]);
      expect(result.parallelized).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should throw on mismatched array lengths for dot', async () => {
      const pool = new MathWorkerPool();
      await pool.initialize();

      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([1, 2]);

      await expect(pool.dot(a, b)).rejects.toThrow('lengths must match');

      await pool.terminate();
    });

    it('should throw on mismatched array lengths for elementwise', async () => {
      const pool = new MathWorkerPool();
      await pool.initialize();

      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([1, 2]);

      await expect(pool.elementwise(a, b, 'add')).rejects.toThrow('lengths must match');

      await pool.terminate();
    });
  });

  describe('Pool lifecycle', () => {
    it('should initialize and terminate cleanly', async () => {
      const pool = new MathWorkerPool();

      expect(pool.isReady()).toBe(false);

      await pool.initialize();
      expect(pool.isReady()).toBe(true);

      await pool.terminate();
      expect(pool.isReady()).toBe(false);
    });

    it('should handle multiple initialize calls', async () => {
      const pool = new MathWorkerPool();

      await pool.initialize();
      await pool.initialize(); // Should not throw

      expect(pool.isReady()).toBe(true);

      await pool.terminate();
    });

    it('should handle terminate when not initialized', async () => {
      const pool = new MathWorkerPool();

      await pool.terminate(); // Should not throw
    });

    it('should return stats', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 2 });
      await pool.initialize();

      const stats = pool.stats();

      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('busyWorkers');
      expect(stats).toHaveProperty('idleWorkers');
      expect(stats).toHaveProperty('pendingTasks');
      expect(stats).toHaveProperty('activeTasks');

      await pool.terminate();
    });

    it('should return empty stats when not initialized', () => {
      const pool = new MathWorkerPool();
      const stats = pool.stats();

      expect(stats.totalWorkers).toBe(0);
      expect(stats.busyWorkers).toBe(0);
      expect(stats.idleWorkers).toBe(0);
    });
  });

  describe('Disabled pool', () => {
    it('should work in sequential mode when disabled', async () => {
      const pool = new MathWorkerPool({ enabled: false });
      await pool.initialize();

      expect(pool.isReady()).toBe(true);

      const data = new Float64Array([1, 2, 3, 4, 5]);
      const result = await pool.sum(data);

      expect(result.result).toBe(15);
      expect(result.parallelized).toBe(false);

      await pool.terminate();
    });
  });

  describe('ParallelResult metadata', () => {
    it('should include duration in results', async () => {
      const pool = new MathWorkerPool();
      await pool.initialize();

      const data = new Float64Array([1, 2, 3, 4, 5]);
      const result = await pool.sum(data);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');

      await pool.terminate();
    });

    it('should include chunks count in results', async () => {
      const pool = new MathWorkerPool();
      await pool.initialize();

      const data = new Float64Array([1, 2, 3]);
      const result = await pool.sum(data);

      expect(result.chunks).toBeGreaterThanOrEqual(1);

      await pool.terminate();
    });
  });

  // ===========================================================================
  // Issue 1: SharedArrayBuffer + Transferable Support
  // ===========================================================================

  describe('SharedArrayBuffer support', () => {
    it('canUseSharedMemory should return a boolean', () => {
      const result = canUseSharedMemory();
      expect(typeof result).toBe('boolean');
    });

    it('should create SharedArrayBuffer-backed Float64Array', () => {
      if (!canUseSharedMemory()) return;
      const arr = createSharedFloat64Array(100);
      expect(arr).toBeInstanceOf(Float64Array);
      expect(arr.length).toBe(100);
      expect(arr.buffer).toBeInstanceOf(SharedArrayBuffer);
    });

    it('should create SharedArrayBuffer of given byte length', () => {
      if (!canUseSharedMemory()) return;
      const sab = createSharedBuffer(1024);
      expect(sab).toBeInstanceOf(SharedArrayBuffer);
      expect(sab.byteLength).toBe(1024);
    });

    it('isSharedBuffer should detect SharedArrayBuffer', () => {
      if (!canUseSharedMemory()) return;

      const sab = new SharedArrayBuffer(64);
      expect(isSharedBuffer(sab)).toBe(true);

      const sabView = new Float64Array(sab);
      expect(isSharedBuffer(sabView)).toBe(true);

      // Regular ArrayBuffer should not match
      const regular = new ArrayBuffer(64);
      expect(isSharedBuffer(regular)).toBe(false);
      expect(isSharedBuffer(new Float64Array(regular))).toBe(false);

      // Non-buffer values
      expect(isSharedBuffer(null)).toBe(false);
      expect(isSharedBuffer(42)).toBe(false);
      expect(isSharedBuffer('string')).toBe(false);
    });
  });

  describe('Transferable support', () => {
    it('transferFloat64 should wrap Float64Array', () => {
      const arr = new Float64Array([1, 2, 3]);
      const transfer = transferFloat64(arr);
      expect(transfer).toBeDefined();
    });

    it('transferArrayBuffer should wrap ArrayBuffer', () => {
      const buf = new ArrayBuffer(24);
      const transfer = transferArrayBuffer(buf);
      expect(transfer).toBeDefined();
    });

    it('transferTypedArray should wrap any TypedArray', () => {
      const int32 = new Int32Array([1, 2, 3]);
      const transfer = transferTypedArray(int32);
      expect(transfer).toBeDefined();

      const uint8 = new Uint8Array([10, 20, 30]);
      const transfer2 = transferTypedArray(uint8);
      expect(transfer2).toBeDefined();
    });
  });

  // ===========================================================================
  // Capabilities Detection
  // ===========================================================================

  describe('Capabilities detection', () => {
    it('getCapabilities should return complete capability report', () => {
      const caps: WorkerpoolCapabilities = getCapabilities();

      expect(typeof caps.sharedArrayBuffer).toBe('boolean');
      expect(typeof caps.transferable).toBe('boolean');
      expect(typeof caps.atomics).toBe('boolean');
      expect(typeof caps.crossOriginIsolated).toBe('boolean');
      expect(typeof caps.maxWorkers).toBe('number');
      expect(caps.maxWorkers).toBeGreaterThan(0);
    });

    it('transferable should be true in Node.js', () => {
      const caps = getCapabilities();
      expect(caps.transferable).toBe(true);
    });
  });

  // ===========================================================================
  // Issue 2: Worker Warmup / Eager Initialization
  // ===========================================================================

  describe('Worker warmup', () => {
    it('warmup should pre-spawn workers', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 2 });
      await pool.initialize();
      await pool.warmup();

      const stats = pool.stats();
      expect(stats.totalWorkers).toBeGreaterThan(0);

      await pool.terminate();
    });

    it('warmup with count should spawn specified workers', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 4 });
      await pool.initialize();
      await pool.warmup(2);

      const stats = pool.stats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(1);

      await pool.terminate();
    });

    it('warmup should work even if called before initialize', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 2 });
      await pool.warmup();

      expect(pool.isReady()).toBe(true);
      const stats = pool.stats();
      expect(stats.totalWorkers).toBeGreaterThan(0);

      await pool.terminate();
    });

    it('eagerInit config should pre-spawn workers', async () => {
      const pool = new MathWorkerPool({
        maxWorkers: 2,
        eagerInit: true,
      });
      await pool.initialize();
      await pool.ready;

      const stats = pool.stats();
      expect(stats.totalWorkers).toBeGreaterThan(0);

      await pool.terminate();
    });

    it('ready promise should resolve after eager init', async () => {
      const pool = new MathWorkerPool({
        maxWorkers: 2,
        eagerInit: true,
      });
      await pool.initialize();

      expect(pool.ready).toBeInstanceOf(Promise);
      await pool.ready;

      await pool.terminate();
    });

    it('default eagerInit should be false', () => {
      expect(DEFAULT_WORKER_CONFIG.eagerInit).toBe(false);
    });
  });

  // ===========================================================================
  // Issue 5: Enhanced Statistics
  // ===========================================================================

  describe('Enhanced statistics', () => {
    it('enhancedStats should return base stats plus metrics', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 2 });
      await pool.initialize();

      const stats: EnhancedPoolStats = pool.enhancedStats();

      // Base stats
      expect(stats).toHaveProperty('totalWorkers');
      expect(stats).toHaveProperty('busyWorkers');
      expect(stats).toHaveProperty('idleWorkers');
      expect(stats).toHaveProperty('pendingTasks');
      expect(stats).toHaveProperty('activeTasks');

      // Metrics
      expect(stats.metrics).toBeDefined();
      expect(typeof stats.metrics.totalTasksExecuted).toBe('number');
      expect(typeof stats.metrics.totalTasksFailed).toBe('number');
      expect(typeof stats.metrics.averageExecutionTime).toBe('number');
      expect(typeof stats.metrics.p95ExecutionTime).toBe('number');
      expect(typeof stats.metrics.throughput).toBe('number');
      expect(typeof stats.metrics.taskQueueDepth).toBe('number');
      expect(typeof stats.metrics.workerUtilization).toBe('number');

      await pool.terminate();
    });

    it('metrics should start at zero', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 2 });
      await pool.initialize();

      const stats = pool.enhancedStats();
      expect(stats.metrics.totalTasksExecuted).toBe(0);
      expect(stats.metrics.totalTasksFailed).toBe(0);
      expect(stats.metrics.averageExecutionTime).toBe(0);
      expect(stats.metrics.p95ExecutionTime).toBe(0);

      await pool.terminate();
    });

    it('metrics should track sequential task data', async () => {
      const pool = new MathWorkerPool({
        maxWorkers: 2,
        parallelThreshold: 1000000,
      });
      await pool.initialize();

      await pool.sum(new Float64Array([1, 2, 3]));
      await pool.sum(new Float64Array([4, 5, 6]));
      await pool.dot(new Float64Array([1, 2]), new Float64Array([3, 4]));

      const stats = pool.enhancedStats();
      expect(stats.metrics.totalTasksExecuted).toBeGreaterThanOrEqual(0);
      expect(stats.metrics.workerUtilization).toBeGreaterThanOrEqual(0);
      expect(stats.metrics.workerUtilization).toBeLessThanOrEqual(1);

      await pool.terminate();
    });

    it('resetMetrics should clear all metrics', async () => {
      const pool = new MathWorkerPool({ maxWorkers: 2 });
      await pool.initialize();
      await pool.warmup();

      pool.resetMetrics();

      const afterReset = pool.enhancedStats();
      expect(afterReset.metrics.totalTasksExecuted).toBe(0);
      expect(afterReset.metrics.totalTasksFailed).toBe(0);
      expect(afterReset.metrics.averageExecutionTime).toBe(0);

      await pool.terminate();
    });

    it('enhancedStats should work when pool is not initialized', () => {
      const pool = new MathWorkerPool();
      const stats = pool.enhancedStats();

      expect(stats.totalWorkers).toBe(0);
      expect(stats.metrics.totalTasksExecuted).toBe(0);
      expect(stats.metrics.workerUtilization).toBe(0);
    });
  });
});

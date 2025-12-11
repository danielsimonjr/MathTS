/**
 * Tests for @mathts/workerpool
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  MathWorkerPool,
  DEFAULT_WORKER_CONFIG,
} from '../src/index.js';

describe('@mathts/workerpool', () => {
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
});

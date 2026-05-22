/**
 * ComputePool Tests
 *
 * Tests for the ComputePool wrapper around MathWorkerPool.
 * Since MathWorkerPool is tested extensively in @danielsimonjr/mathts-workerpool,
 * these tests focus on the ComputePool interface and sequential fallback behavior.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  ComputePool,
  computePool,
  DEFAULT_POOL_CONFIG,
  Transfer,
} from '../src/ComputePool.js';
import type { ParallelResult, ComputePoolConfig } from '../src/ComputePool.js';

describe('ComputePool', () => {
  describe('Configuration', () => {
    it('should create pool with default configuration', () => {
      const pool = new ComputePool();
      const config = pool.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.minWorkers).toBe(DEFAULT_POOL_CONFIG.minWorkers);
      expect(config.maxWorkers).toBeGreaterThan(0);
      expect(config.thresholdElements).toBe(DEFAULT_POOL_CONFIG.thresholdElements);
      expect(config.chunkSize).toBe(DEFAULT_POOL_CONFIG.chunkSize);
    });

    it('should create pool with custom configuration', () => {
      const pool = new ComputePool({
        maxWorkers: 2,
        thresholdElements: 5000,
        chunkSize: 1000,
        enabled: true,
      });
      const config = pool.getConfig();

      expect(config.maxWorkers).toBe(2);
      expect(config.thresholdElements).toBe(5000);
      expect(config.chunkSize).toBe(1000);
    });

    it('should update configuration', () => {
      const pool = new ComputePool();
      pool.updateConfig({ thresholdElements: 25000 });
      const config = pool.getConfig();

      expect(config.thresholdElements).toBe(25000);
    });

    it('should preserve unmodified config values', () => {
      const pool = new ComputePool({
        maxWorkers: 4,
        chunkSize: 2000,
      });
      pool.updateConfig({ thresholdElements: 100 });
      const config = pool.getConfig();

      expect(config.maxWorkers).toBe(4);
      expect(config.chunkSize).toBe(2000);
      expect(config.thresholdElements).toBe(100);
    });
  });

  describe('Pool Lifecycle', () => {
    it('should not be ready before initialization', () => {
      const pool = new ComputePool();
      expect(pool.isReady()).toBe(false);
    });

    it('should be ready after initialization', async () => {
      const pool = new ComputePool();
      await pool.initialize();
      expect(pool.isReady()).toBe(true);
      await pool.terminate();
    });

    it('should handle multiple initialize calls gracefully', async () => {
      const pool = new ComputePool();
      await pool.initialize();
      await pool.initialize(); // Should not throw

      expect(pool.isReady()).toBe(true);
      await pool.terminate();
    });

    it('should not be ready after termination', async () => {
      const pool = new ComputePool();
      await pool.initialize();
      await pool.terminate();

      expect(pool.isReady()).toBe(false);
    });

    it('should handle terminate on uninitialized pool', async () => {
      const pool = new ComputePool();
      await pool.terminate(); // Should not throw
    });
  });

  describe('shouldParallelize', () => {
    let pool: ComputePool;

    beforeEach(async () => {
      pool = new ComputePool({ thresholdElements: 1000 });
      await pool.initialize();
    });

    afterEach(async () => {
      await pool.terminate();
    });

    it('should return false below threshold', () => {
      expect(pool.shouldParallelize(500)).toBe(false);
    });

    it('should return true at or above threshold', () => {
      expect(pool.shouldParallelize(1000)).toBe(true);
      expect(pool.shouldParallelize(10000)).toBe(true);
    });
  });

  describe('Pool Stats', () => {
    it('should return stats when initialized', async () => {
      const pool = new ComputePool({ maxWorkers: 2 });
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
      const pool = new ComputePool();
      const stats = pool.stats();

      expect(stats.totalWorkers).toBe(0);
      expect(stats.busyWorkers).toBe(0);
      expect(stats.idleWorkers).toBe(0);
    });
  });

  describe('Sequential Operations (no parallelization)', () => {
    let pool: ComputePool;

    beforeAll(async () => {
      // Use very high threshold to force sequential execution
      pool = new ComputePool({ thresholdElements: 1000000 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    describe('Sum', () => {
      it('should compute sum correctly', async () => {
        const data = new Float64Array([1, 2, 3, 4, 5]);
        const result = await pool.sum(data);

        expect(result.result).toBe(15);
        expect(result.parallelized).toBe(false);
        expect(result.chunks).toBe(1);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle empty array', async () => {
        const data = new Float64Array(0);
        const result = await pool.sum(data);

        expect(result.result).toBe(0);
      });

      it('should handle negative numbers', async () => {
        const data = new Float64Array([-1, -2, 3, 4]);
        const result = await pool.sum(data);

        expect(result.result).toBe(4);
      });
    });

    describe('Dot Product', () => {
      it('should compute dot product correctly', async () => {
        const a = new Float64Array([1, 2, 3]);
        const b = new Float64Array([4, 5, 6]);
        const result = await pool.dot(a, b);

        // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
        expect(result.result).toBe(32);
        expect(result.parallelized).toBe(false);
      });

      it('should handle zero vectors', async () => {
        const a = new Float64Array([0, 0, 0]);
        const b = new Float64Array([1, 2, 3]);
        const result = await pool.dot(a, b);

        expect(result.result).toBe(0);
      });
    });

    describe('Element-wise Operations', () => {
      it('should add arrays element-wise', async () => {
        const a = new Float64Array([1, 2, 3]);
        const b = new Float64Array([4, 5, 6]);
        const result = await pool.add(a, b);

        expect(Array.from(result.result)).toEqual([5, 7, 9]);
        expect(result.parallelized).toBe(false);
      });

      it('should subtract arrays element-wise', async () => {
        const a = new Float64Array([10, 20, 30]);
        const b = new Float64Array([1, 2, 3]);
        const result = await pool.subtract(a, b);

        expect(Array.from(result.result)).toEqual([9, 18, 27]);
      });

      it('should multiply arrays element-wise', async () => {
        const a = new Float64Array([1, 2, 3]);
        const b = new Float64Array([2, 3, 4]);
        const result = await pool.multiply(a, b);

        expect(Array.from(result.result)).toEqual([2, 6, 12]);
      });

      it('should divide arrays element-wise', async () => {
        const a = new Float64Array([10, 20, 30]);
        const b = new Float64Array([2, 4, 5]);
        const result = await pool.divide(a, b);

        expect(Array.from(result.result)).toEqual([5, 5, 6]);
      });
    });

    describe('Scale', () => {
      it('should scale array by scalar', async () => {
        const data = new Float64Array([1, 2, 3, 4]);
        const result = await pool.scale(data, 2);

        expect(Array.from(result.result)).toEqual([2, 4, 6, 8]);
        expect(result.parallelized).toBe(false);
      });

      it('should handle zero scalar', async () => {
        const data = new Float64Array([1, 2, 3]);
        const result = await pool.scale(data, 0);

        expect(Array.from(result.result)).toEqual([0, 0, 0]);
      });

      it('should handle negative scalar', async () => {
        const data = new Float64Array([1, 2, 3]);
        const result = await pool.scale(data, -2);

        expect(Array.from(result.result)).toEqual([-2, -4, -6]);
      });
    });

    describe('Matrix Operations', () => {
      it('should multiply matrices correctly', async () => {
        // 2x3 * 3x2 = 2x2
        const a = new Float64Array([1, 2, 3, 4, 5, 6]);
        const b = new Float64Array([7, 8, 9, 10, 11, 12]);

        const result = await pool.matmul(a, 2, 3, b, 2);

        // [1,2,3] * [7,9,11]^T = 7+18+33 = 58
        // [1,2,3] * [8,10,12]^T = 8+20+36 = 64
        // [4,5,6] * [7,9,11]^T = 28+45+66 = 139
        // [4,5,6] * [8,10,12]^T = 32+50+72 = 154
        expect(Array.from(result.result)).toEqual([58, 64, 139, 154]);
        expect(result.parallelized).toBe(false);
      });

      it('should transpose matrix correctly', async () => {
        // 2x3 matrix
        const data = new Float64Array([1, 2, 3, 4, 5, 6]);

        const result = await pool.transpose(data, 2, 3);

        // Transposed to 3x2
        expect(Array.from(result.result)).toEqual([1, 4, 2, 5, 3, 6]);
        expect(result.parallelized).toBe(false);
      });

      it('should compute matrix-vector multiplication', async () => {
        // 2x3 matrix * 3x1 vector
        const matrix = new Float64Array([1, 2, 3, 4, 5, 6]);
        const vector = new Float64Array([1, 2, 3]);

        const result = await pool.matvec(matrix, 2, 3, vector);

        // [1,2,3] * [1,2,3] = 1+4+9 = 14
        // [4,5,6] * [1,2,3] = 4+10+18 = 32
        expect(Array.from(result.result)).toEqual([14, 32]);
      });

      it('should compute outer product', async () => {
        const a = new Float64Array([1, 2]);
        const b = new Float64Array([3, 4, 5]);

        const result = await pool.outer(a, b);

        // [[1*3, 1*4, 1*5], [2*3, 2*4, 2*5]] = [[3,4,5], [6,8,10]]
        expect(Array.from(result.result)).toEqual([3, 4, 5, 6, 8, 10]);
      });
    });

    describe('Statistical Operations', () => {
      it('should compute min and max', async () => {
        const data = new Float64Array([3, 1, 4, 1, 5, 9, 2, 6]);
        const result = await pool.minMax(data);

        expect(result.result.min).toBe(1);
        expect(result.result.max).toBe(9);
        expect(result.result.minIdx).toBe(1);
        expect(result.result.maxIdx).toBe(5);
      });

      it('should compute variance, mean, and std', async () => {
        const data = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);
        const result = await pool.variance(data);

        expect(result.result.mean).toBe(5);
        expect(result.result.variance).toBe(4);
        expect(result.result.std).toBe(2);
      });

      it('should compute mean', async () => {
        const data = new Float64Array([1, 2, 3, 4, 5]);
        const result = await pool.mean(data);

        expect(result.result).toBe(3);
      });

      it('should compute std', async () => {
        const data = new Float64Array([2, 4, 4, 4, 5, 5, 7, 9]);
        const result = await pool.std(data);

        expect(result.result).toBe(2);
      });

      it('should find min', async () => {
        const data = new Float64Array([5, 3, 8, 1, 9]);
        const result = await pool.min(data);

        expect(result.result).toBe(1);
      });

      it('should find max', async () => {
        const data = new Float64Array([5, 3, 8, 1, 9]);
        const result = await pool.max(data);

        expect(result.result).toBe(9);
      });

      it('should compute norm', async () => {
        const data = new Float64Array([3, 4]); // sqrt(9 + 16) = 5
        const result = await pool.norm(data);

        expect(result.result).toBe(5);
      });

      it('should compute distance', async () => {
        const a = new Float64Array([0, 0]);
        const b = new Float64Array([3, 4]);
        const result = await pool.distance(a, b);

        expect(result.result).toBe(5);
      });

      it('should compute histogram', async () => {
        const data = new Float64Array([1, 1, 2, 2, 2, 3, 3, 4, 5]);
        const result = await pool.histogram(data, 5, 1, 5);

        expect(result.result.length).toBe(5);
        // Values 1-2: 2 ones, then 2s and 3s, then 3s, 4, 5
        expect(result.result.reduce((a, b) => a + b)).toBe(9); // All values counted
      });
    });

    describe('Unary Operations', () => {
      it('should compute abs', async () => {
        const data = new Float64Array([-1, 2, -3, 4]);
        const result = await pool.abs(data);

        expect(Array.from(result.result)).toEqual([1, 2, 3, 4]);
      });

      it('should compute sqrt', async () => {
        const data = new Float64Array([1, 4, 9, 16]);
        const result = await pool.sqrt(data);

        expect(Array.from(result.result)).toEqual([1, 2, 3, 4]);
      });

      it('should compute negate', async () => {
        const data = new Float64Array([1, -2, 3]);
        const result = await pool.negate(data);

        expect(Array.from(result.result)).toEqual([-1, 2, -3]);
      });

      it('should compute square', async () => {
        const data = new Float64Array([1, 2, 3, 4]);
        const result = await pool.square(data);

        expect(Array.from(result.result)).toEqual([1, 4, 9, 16]);
      });

      it('should compute exp', async () => {
        const data = new Float64Array([0, 1]);
        const result = await pool.exp(data);

        expect(result.result[0]).toBeCloseTo(1);
        expect(result.result[1]).toBeCloseTo(Math.E);
      });

      it('should compute log', async () => {
        const data = new Float64Array([1, Math.E]);
        const result = await pool.log(data);

        expect(result.result[0]).toBeCloseTo(0);
        expect(result.result[1]).toBeCloseTo(1);
      });

      it('should compute sin', async () => {
        const data = new Float64Array([0, Math.PI / 2]);
        const result = await pool.sin(data);

        expect(result.result[0]).toBeCloseTo(0);
        expect(result.result[1]).toBeCloseTo(1);
      });

      it('should compute cos', async () => {
        const data = new Float64Array([0, Math.PI]);
        const result = await pool.cos(data);

        expect(result.result[0]).toBeCloseTo(1);
        expect(result.result[1]).toBeCloseTo(-1);
      });

      it('should compute tan', async () => {
        const data = new Float64Array([0, Math.PI / 4]);
        const result = await pool.tan(data);

        expect(result.result[0]).toBeCloseTo(0);
        expect(result.result[1]).toBeCloseTo(1);
      });
    });

    describe('Generic Operations', () => {
      it('should map array', async () => {
        const data = [1, 2, 3, 4];
        const result = await pool.map(data, (x: number) => x * 2);

        expect(result.result).toEqual([2, 4, 6, 8]);
        expect(result.parallelized).toBe(false);
      });

      it('should reduce array', async () => {
        const data = [1, 2, 3, 4];
        const result = await pool.reduce(data, (acc: number, x: number) => acc + x, 0);

        expect(result.result).toBe(10);
      });

      it('should filter array', async () => {
        const data = [1, 2, 3, 4, 5, 6];
        const result = await pool.filter(data, (x: number) => x % 2 === 0);

        expect(result.result).toEqual([2, 4, 6]);
      });

      it('should find element', async () => {
        const data = [1, 2, 3, 4, 5];
        const result = await pool.find(data, (x: number) => x > 3);

        expect(result.result.found).toBe(true);
        expect(result.result.value).toBe(4);
        expect(result.result.index).toBe(3);
      });

      it('should return not found when element does not exist', async () => {
        const data = [1, 2, 3];
        const result = await pool.find(data, (x: number) => x > 10);

        expect(result.result.found).toBe(false);
      });

      it('should sort array', async () => {
        const data = [3, 1, 4, 1, 5, 9, 2, 6];
        const result = await pool.sort(data);

        expect(result.result).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
      });

      it('should sort with custom comparator', async () => {
        const data = [3, 1, 4, 1, 5, 9, 2, 6];
        const result = await pool.sort(data, (a, b) => b - a); // Descending

        expect(result.result).toEqual([9, 6, 5, 4, 3, 2, 1, 1]);
      });
    });
  });

  describe('ParallelResult Metadata', () => {
    let pool: ComputePool;

    beforeAll(async () => {
      pool = new ComputePool({ thresholdElements: 1000000 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    it('should include duration in results', async () => {
      const data = new Float64Array([1, 2, 3]);
      const result = await pool.sum(data);

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include chunks count in results', async () => {
      const data = new Float64Array([1, 2, 3]);
      const result = await pool.sum(data);

      expect(result.chunks).toBe(1);
    });

    it('should indicate non-parallelized execution', async () => {
      const data = new Float64Array([1, 2, 3]);
      const result = await pool.sum(data);

      expect(result.parallelized).toBe(false);
    });
  });

  describe('Global computePool Instance', () => {
    it('should export a default computePool instance', () => {
      expect(computePool).toBeDefined();
      expect(computePool).toBeInstanceOf(ComputePool);
    });

    it('should have default configuration', () => {
      const config = computePool.getConfig();
      expect(config.enabled).toBe(true);
    });
  });

  describe('Transfer Export', () => {
    it('should export Transfer class', () => {
      expect(Transfer).toBeDefined();
    });
  });

  describe('Worker Pool Access', () => {
    it('should provide access to underlying MathWorkerPool', async () => {
      const pool = new ComputePool();
      await pool.initialize();

      const workerPool = pool.getWorkerPool();
      expect(workerPool).toBeDefined();
      expect(workerPool.isReady()).toBe(true);

      await pool.terminate();
    });
  });

  describe('Error Handling', () => {
    let pool: ComputePool;

    beforeAll(async () => {
      pool = new ComputePool({ thresholdElements: 1000000 });
      await pool.initialize();
    });

    afterAll(async () => {
      await pool.terminate();
    });

    it('should throw on mismatched lengths for dot', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([1, 2]);

      await expect(pool.dot(a, b)).rejects.toThrow();
    });

    it('should throw on mismatched lengths for elementwise', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([1, 2]);

      await expect(pool.elementwise(a, b, 'add')).rejects.toThrow();
    });

    it('should throw on mismatched lengths for distance', async () => {
      const a = new Float64Array([1, 2]);
      const b = new Float64Array([1, 2, 3]);

      await expect(pool.distance(a, b)).rejects.toThrow();
    });

    it('should throw on invalid matrix dimensions for matvec', async () => {
      const matrix = new Float64Array([1, 2, 3, 4]);
      const vector = new Float64Array([1, 2, 3]); // cols doesn't match vector length

      await expect(pool.matvec(matrix, 2, 2, vector)).rejects.toThrow();
    });
  });

  describe('Disabled Pool', () => {
    it('should work in sequential mode when disabled', async () => {
      const pool = new ComputePool({ enabled: false });
      await pool.initialize();

      expect(pool.isReady()).toBe(true);

      const data = new Float64Array([1, 2, 3, 4, 5]);
      const result = await pool.sum(data);

      expect(result.result).toBe(15);
      expect(result.parallelized).toBe(false);

      await pool.terminate();
    });
  });

  // ===========================================================================
  // Bitwise Operations (Int32Array) — both the worker-dispatched path
  // (above threshold) and the in-process fallback (below threshold).
  //
  // Tests use a small custom threshold so we can exercise the parallel
  // path on 100-element fixtures rather than 50_000-element ones.
  // ===========================================================================

  describe('Bitwise Operations (Int32Array)', () => {
    /** Build an Int32Array of `length` with edge values + xorshift fill. */
    function buildInt32Fixture(length: number, seed = 1): Int32Array {
      const data = new Int32Array(length);
      const edges = [0, 1, -1, 0x7fffffff, -0x80000000, 0xff, -2, 0b10101010];
      let s = seed;
      for (let i = 0; i < length; i++) {
        if (i < edges.length) {
          data[i] = edges[i];
        } else {
          s ^= s << 13;
          s ^= s >>> 17;
          s ^= s << 5;
          data[i] = s | 0;
        }
      }
      return data;
    }

    /** Apply a JS bitwise operator element-wise — the test oracle. */
    function oracleBinary(
      a: Int32Array,
      b: Int32Array,
      op: 'bitAnd' | 'bitOr' | 'bitXor' | 'leftShift' | 'rightArithShift' | 'rightLogShift'
    ): Int32Array {
      const out = new Int32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        switch (op) {
          case 'bitAnd': out[i] = a[i] & b[i]; break;
          case 'bitOr': out[i] = a[i] | b[i]; break;
          case 'bitXor': out[i] = a[i] ^ b[i]; break;
          case 'leftShift': out[i] = a[i] << b[i]; break;
          case 'rightArithShift': out[i] = a[i] >> b[i]; break;
          case 'rightLogShift': out[i] = a[i] >>> b[i]; break;
        }
      }
      return out;
    }

    function oracleScalar(
      a: Int32Array,
      s: number,
      op: 'leftShift' | 'rightArithShift' | 'rightLogShift'
    ): Int32Array {
      const out = new Int32Array(a.length);
      for (let i = 0; i < a.length; i++) {
        switch (op) {
          case 'leftShift': out[i] = a[i] << s; break;
          case 'rightArithShift': out[i] = a[i] >> s; break;
          case 'rightLogShift': out[i] = a[i] >>> s; break;
        }
      }
      return out;
    }

    describe('Above threshold (worker-dispatched)', () => {
      let pool: ComputePool;

      beforeAll(async () => {
        // Force parallel path: low threshold + small chunk so a 100-element
        // input produces multiple chunks (>1).
        pool = new ComputePool({
          maxWorkers: 3,
          thresholdElements: 10,
          chunkSize: 7,
        });
        await pool.initialize();
      }, 60_000);

      afterAll(async () => {
        await pool.terminate();
      });

      it('bitAnd dispatches to workers and matches oracle', async () => {
        const a = buildInt32Fixture(100, 1);
        const b = buildInt32Fixture(100, 2);
        const r = await pool.bitAnd(a, b);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleBinary(a, b, 'bitAnd')));
      });

      it('bitOr dispatches to workers and matches oracle', async () => {
        const a = buildInt32Fixture(100, 3);
        const b = buildInt32Fixture(100, 4);
        const r = await pool.bitOr(a, b);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleBinary(a, b, 'bitOr')));
      });

      it('bitXor dispatches to workers and matches oracle', async () => {
        const a = buildInt32Fixture(100, 5);
        const b = buildInt32Fixture(100, 6);
        const r = await pool.bitXor(a, b);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleBinary(a, b, 'bitXor')));
      });

      it('bitNot dispatches to workers and matches oracle', async () => {
        const a = buildInt32Fixture(100, 7);
        const r = await pool.bitNot(a);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        const expected = new Int32Array(100);
        for (let i = 0; i < 100; i++) expected[i] = ~a[i];
        expect(Array.from(r.result)).toEqual(Array.from(expected));
      });

      it('leftShift (Int32 × Int32) dispatches and matches oracle', async () => {
        const a = buildInt32Fixture(100, 8);
        const b = buildInt32Fixture(100, 9);
        const r = await pool.leftShift(a, b);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleBinary(a, b, 'leftShift')));
      });

      it('leftShift (Int32 × scalar) dispatches and matches oracle', async () => {
        const a = buildInt32Fixture(100, 10);
        const r = await pool.leftShift(a, 3);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleScalar(a, 3, 'leftShift')));
      });

      it('rightArithShift (Int32 × Int32) dispatches and matches oracle', async () => {
        const a = buildInt32Fixture(100, 11);
        const b = buildInt32Fixture(100, 12);
        const r = await pool.rightArithShift(a, b);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleBinary(a, b, 'rightArithShift')));
      });

      it('rightArithShift (Int32 × scalar) dispatches and matches oracle', async () => {
        const a = buildInt32Fixture(100, 13);
        const r = await pool.rightArithShift(a, 4);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleScalar(a, 4, 'rightArithShift')));
      });

      it('rightLogShift (Int32 × Int32) dispatches and matches oracle', async () => {
        const a = buildInt32Fixture(100, 14);
        const b = buildInt32Fixture(100, 15);
        const r = await pool.rightLogShift(a, b);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleBinary(a, b, 'rightLogShift')));
      });

      it('rightLogShift (Int32 × scalar) dispatches and matches oracle', async () => {
        const a = buildInt32Fixture(100, 16);
        const r = await pool.rightLogShift(a, 7);

        expect(r.parallelized).toBe(true);
        expect(r.chunks).toBeGreaterThan(1);
        expect(Array.from(r.result)).toEqual(Array.from(oracleScalar(a, 7, 'rightLogShift')));
      });

      it('result is a fresh Int32Array (not a Float64Array)', async () => {
        const a = buildInt32Fixture(100, 17);
        const b = buildInt32Fixture(100, 18);
        const r = await pool.bitAnd(a, b);
        expect(r.result).toBeInstanceOf(Int32Array);
      });
    });

    describe('Below threshold (in-process fallback)', () => {
      let pool: ComputePool;

      beforeAll(async () => {
        // Very high threshold forces every call to fall back.
        pool = new ComputePool({ thresholdElements: 1_000_000 });
        await pool.initialize();
      });

      afterAll(async () => {
        await pool.terminate();
      });

      it('bitAnd runs in-process below threshold', async () => {
        const a = Int32Array.from([0b1100, 0b1010, 0b1111]);
        const b = Int32Array.from([0b1010, 0b1100, 0b0101]);
        const r = await pool.bitAnd(a, b);
        expect(r.parallelized).toBe(false);
        expect(r.chunks).toBe(1);
        expect(Array.from(r.result)).toEqual([0b1000, 0b1000, 0b0101]);
      });

      it('bitOr runs in-process below threshold', async () => {
        const a = Int32Array.from([0b1100, 0b0001]);
        const b = Int32Array.from([0b0011, 0b1000]);
        const r = await pool.bitOr(a, b);
        expect(r.parallelized).toBe(false);
        expect(Array.from(r.result)).toEqual([0b1111, 0b1001]);
      });

      it('bitXor runs in-process below threshold', async () => {
        const a = Int32Array.from([0b1100, 0b1010]);
        const b = Int32Array.from([0b1010, 0b1010]);
        const r = await pool.bitXor(a, b);
        expect(r.parallelized).toBe(false);
        expect(Array.from(r.result)).toEqual([0b0110, 0]);
      });

      it('bitNot runs in-process below threshold', async () => {
        const a = Int32Array.from([0, -1, 1, 0x7fffffff]);
        const r = await pool.bitNot(a);
        expect(r.parallelized).toBe(false);
        expect(Array.from(r.result)).toEqual([-1, 0, -2, -0x80000000]);
      });

      it('leftShift (scalar) runs in-process below threshold', async () => {
        const a = Int32Array.from([1, 2, 3, 4]);
        const r = await pool.leftShift(a, 2);
        expect(r.parallelized).toBe(false);
        expect(Array.from(r.result)).toEqual([4, 8, 12, 16]);
      });

      it('rightArithShift (Int32) runs in-process below threshold', async () => {
        const a = Int32Array.from([-8, 8, 16]);
        const b = Int32Array.from([1, 1, 2]);
        const r = await pool.rightArithShift(a, b);
        expect(r.parallelized).toBe(false);
        expect(Array.from(r.result)).toEqual([-4, 4, 4]);
      });

      it('rightLogShift (scalar) runs in-process below threshold', async () => {
        const a = Int32Array.from([-1, -2, 4]);
        const r = await pool.rightLogShift(a, 1);
        expect(r.parallelized).toBe(false);
        // -1 >>> 1 = 0x7fffffff
        expect(Array.from(r.result)).toEqual([0x7fffffff, 0x7fffffff, 2]);
      });

      it('throws on length mismatch (bitAnd)', async () => {
        const a = Int32Array.from([1, 2, 3]);
        const b = Int32Array.from([1, 2]);
        await expect(pool.bitAnd(a, b)).rejects.toThrow('lengths must match');
      });

      it('throws on length mismatch (leftShift with Int32 b)', async () => {
        const a = Int32Array.from([1, 2, 3]);
        const b = Int32Array.from([1, 2]);
        await expect(pool.leftShift(a, b)).rejects.toThrow('lengths must match');
      });
    });
  });
});

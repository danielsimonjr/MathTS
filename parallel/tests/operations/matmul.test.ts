/**
 * Parallel Matrix Operations Tests
 *
 * Tests for parallelMatmul, parallelMatvec, parallelTranspose, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  parallelMatmul,
  parallelMatvec,
  parallelTranspose,
  parallelOuter,
  parallelDot,
} from '../../src/operations/matmul.js';
import { ComputePool } from '../../src/ComputePool.js';

describe('Parallel Matrix Operations', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool({ thresholdElements: 1000000 }); // Force sequential for predictable testing
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  describe('parallelMatmul', () => {
    it('should multiply 2x2 matrices', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([5, 6, 7, 8]);

      const result = await parallelMatmul(a, 2, 2, b, 2, { pool });

      // [[1,2],[3,4]] * [[5,6],[7,8]] = [[19,22],[43,50]]
      expect(Array.from(result.result)).toEqual([19, 22, 43, 50]);
    });

    it('should multiply rectangular matrices', async () => {
      // 2x3 * 3x2 = 2x2
      const a = new Float64Array([1, 2, 3, 4, 5, 6]);
      const b = new Float64Array([7, 8, 9, 10, 11, 12]);

      const result = await parallelMatmul(a, 2, 3, b, 2, { pool });

      // Result should be 2x2
      expect(result.result.length).toBe(4);
      expect(Array.from(result.result)).toEqual([58, 64, 139, 154]);
    });

    it('should handle identity matrix multiplication', async () => {
      // Identity matrix
      const identity = new Float64Array([1, 0, 0, 1]);
      const a = new Float64Array([5, 6, 7, 8]);

      const result = await parallelMatmul(identity, 2, 2, a, 2, { pool });

      expect(Array.from(result.result)).toEqual([5, 6, 7, 8]);
    });

    it('should handle zero matrix', async () => {
      const zero = new Float64Array(4); // All zeros
      const a = new Float64Array([1, 2, 3, 4]);

      const result = await parallelMatmul(zero, 2, 2, a, 2, { pool });

      expect(Array.from(result.result)).toEqual([0, 0, 0, 0]);
    });

    it('should provide execution metadata', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([5, 6, 7, 8]);

      const result = await parallelMatmul(a, 2, 2, b, 2, { pool });

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('parallelized');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('parallelMatvec', () => {
    it('should multiply matrix by vector', async () => {
      // 2x3 matrix * 3x1 vector = 2x1 vector
      const matrix = new Float64Array([1, 2, 3, 4, 5, 6]);
      const vector = new Float64Array([1, 2, 3]);

      const result = await parallelMatvec(matrix, 2, 3, vector, { pool });

      // [1,2,3] · [1,2,3] = 1+4+9 = 14
      // [4,5,6] · [1,2,3] = 4+10+18 = 32
      expect(Array.from(result.result)).toEqual([14, 32]);
    });

    it('should handle identity matrix', async () => {
      const identity = new Float64Array([1, 0, 0, 1]);
      const vector = new Float64Array([3, 4]);

      const result = await parallelMatvec(identity, 2, 2, vector, { pool });

      expect(Array.from(result.result)).toEqual([3, 4]);
    });

    it('should handle zero vector', async () => {
      const matrix = new Float64Array([1, 2, 3, 4]);
      const vector = new Float64Array([0, 0]);

      const result = await parallelMatvec(matrix, 2, 2, vector, { pool });

      expect(Array.from(result.result)).toEqual([0, 0]);
    });
  });

  describe('parallelTranspose', () => {
    it('should transpose 2x3 to 3x2', async () => {
      const data = new Float64Array([1, 2, 3, 4, 5, 6]);

      const result = await parallelTranspose(data, 2, 3, { pool });

      // Original: [[1,2,3],[4,5,6]]
      // Transposed: [[1,4],[2,5],[3,6]]
      expect(Array.from(result.result)).toEqual([1, 4, 2, 5, 3, 6]);
    });

    it('should transpose square matrix', async () => {
      const data = new Float64Array([1, 2, 3, 4]);

      const result = await parallelTranspose(data, 2, 2, { pool });

      expect(Array.from(result.result)).toEqual([1, 3, 2, 4]);
    });

    it('should be self-inverse', async () => {
      const data = new Float64Array([1, 2, 3, 4, 5, 6]);

      const transposed = await parallelTranspose(data, 2, 3, { pool });
      const backAgain = await parallelTranspose(transposed.result, 3, 2, { pool });

      expect(Array.from(backAgain.result)).toEqual(Array.from(data));
    });
  });

  describe('parallelOuter', () => {
    it('should compute outer product', async () => {
      const a = new Float64Array([1, 2]);
      const b = new Float64Array([3, 4, 5]);

      const result = await parallelOuter(a, b, { pool });

      // [[1*3, 1*4, 1*5], [2*3, 2*4, 2*5]]
      expect(Array.from(result.result)).toEqual([3, 4, 5, 6, 8, 10]);
    });

    it('should handle single element vectors', async () => {
      const a = new Float64Array([2]);
      const b = new Float64Array([3]);

      const result = await parallelOuter(a, b, { pool });

      expect(Array.from(result.result)).toEqual([6]);
    });
  });

  describe('parallelDot', () => {
    it('should compute dot product', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([4, 5, 6]);

      const result = await parallelDot(a, b, { pool });

      // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(result.result).toBe(32);
    });

    it('should return 0 for orthogonal vectors', async () => {
      const a = new Float64Array([1, 0]);
      const b = new Float64Array([0, 1]);

      const result = await parallelDot(a, b, { pool });

      expect(result.result).toBe(0);
    });

    it('should compute squared norm', async () => {
      const a = new Float64Array([3, 4]);

      const result = await parallelDot(a, a, { pool });

      // 3² + 4² = 9 + 16 = 25
      expect(result.result).toBe(25);
    });
  });
});

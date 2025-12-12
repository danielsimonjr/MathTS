/**
 * Parallel Element-wise Operations Tests
 *
 * Tests for parallelAdd, parallelSubtract, parallelMultiply, etc.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  parallelAdd,
  parallelSubtract,
  parallelMultiply,
  parallelDivide,
  parallelScale,
  parallelAbs,
  parallelNegate,
  parallelSquare,
  parallelSqrt,
  parallelExp,
  parallelLog,
  parallelSin,
  parallelCos,
  parallelElementwise,
  parallelUnary,
} from '../../src/operations/elementwise.js';
import { ComputePool } from '../../src/ComputePool.js';

describe('Parallel Element-wise Operations', () => {
  let pool: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool({ thresholdElements: 1000000 });
    await pool.initialize();
  });

  afterAll(async () => {
    await pool.terminate();
  });

  describe('Binary Operations', () => {
    it('should add arrays element-wise', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([5, 6, 7, 8]);

      const result = await parallelAdd(a, b, { pool });

      expect(Array.from(result.result)).toEqual([6, 8, 10, 12]);
    });

    it('should subtract arrays element-wise', async () => {
      const a = new Float64Array([10, 20, 30, 40]);
      const b = new Float64Array([1, 2, 3, 4]);

      const result = await parallelSubtract(a, b, { pool });

      expect(Array.from(result.result)).toEqual([9, 18, 27, 36]);
    });

    it('should multiply arrays element-wise', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([2, 3, 4, 5]);

      const result = await parallelMultiply(a, b, { pool });

      expect(Array.from(result.result)).toEqual([2, 6, 12, 20]);
    });

    it('should divide arrays element-wise', async () => {
      const a = new Float64Array([10, 20, 30, 40]);
      const b = new Float64Array([2, 4, 5, 8]);

      const result = await parallelDivide(a, b, { pool });

      expect(Array.from(result.result)).toEqual([5, 5, 6, 5]);
    });

    it('should scale array by scalar', async () => {
      const data = new Float64Array([1, 2, 3, 4]);

      const result = await parallelScale(data, 3, { pool });

      expect(Array.from(result.result)).toEqual([3, 6, 9, 12]);
    });

    it('should handle negative scalar', async () => {
      const data = new Float64Array([1, 2, 3]);

      const result = await parallelScale(data, -2, { pool });

      expect(Array.from(result.result)).toEqual([-2, -4, -6]);
    });

    it('should use generic elementwise function', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([4, 5, 6]);

      const addResult = await parallelElementwise(a, b, 'add', { pool });
      const mulResult = await parallelElementwise(a, b, 'multiply', { pool });

      expect(Array.from(addResult.result)).toEqual([5, 7, 9]);
      expect(Array.from(mulResult.result)).toEqual([4, 10, 18]);
    });
  });

  describe('Unary Operations', () => {
    it('should compute absolute value', async () => {
      const data = new Float64Array([-1, 2, -3, 4, -5]);

      const result = await parallelAbs(data, { pool });

      expect(Array.from(result.result)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should negate array', async () => {
      const data = new Float64Array([1, -2, 3, -4]);

      const result = await parallelNegate(data, { pool });

      expect(Array.from(result.result)).toEqual([-1, 2, -3, 4]);
    });

    it('should square array', async () => {
      const data = new Float64Array([1, 2, 3, 4]);

      const result = await parallelSquare(data, { pool });

      expect(Array.from(result.result)).toEqual([1, 4, 9, 16]);
    });

    it('should compute square root', async () => {
      const data = new Float64Array([1, 4, 9, 16]);

      const result = await parallelSqrt(data, { pool });

      expect(Array.from(result.result)).toEqual([1, 2, 3, 4]);
    });

    it('should compute exponential', async () => {
      const data = new Float64Array([0, 1, 2]);

      const result = await parallelExp(data, { pool });

      expect(result.result[0]).toBeCloseTo(1);
      expect(result.result[1]).toBeCloseTo(Math.E);
      expect(result.result[2]).toBeCloseTo(Math.E ** 2);
    });

    it('should compute natural log', async () => {
      const data = new Float64Array([1, Math.E, Math.E ** 2]);

      const result = await parallelLog(data, { pool });

      expect(result.result[0]).toBeCloseTo(0);
      expect(result.result[1]).toBeCloseTo(1);
      expect(result.result[2]).toBeCloseTo(2);
    });

    it('should compute sine', async () => {
      const data = new Float64Array([0, Math.PI / 6, Math.PI / 2]);

      const result = await parallelSin(data, { pool });

      expect(result.result[0]).toBeCloseTo(0);
      expect(result.result[1]).toBeCloseTo(0.5);
      expect(result.result[2]).toBeCloseTo(1);
    });

    it('should compute cosine', async () => {
      const data = new Float64Array([0, Math.PI / 3, Math.PI]);

      const result = await parallelCos(data, { pool });

      expect(result.result[0]).toBeCloseTo(1);
      expect(result.result[1]).toBeCloseTo(0.5);
      expect(result.result[2]).toBeCloseTo(-1);
    });

    it('should use generic unary function', async () => {
      const data = new Float64Array([1, 2, 3]);

      const sqResult = await parallelUnary(data, 'square', { pool });
      const negResult = await parallelUnary(data, 'negate', { pool });

      expect(Array.from(sqResult.result)).toEqual([1, 4, 9]);
      expect(Array.from(negResult.result)).toEqual([-1, -2, -3]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty arrays', async () => {
      const a = new Float64Array(0);
      const b = new Float64Array(0);

      const result = await parallelAdd(a, b, { pool });

      expect(result.result.length).toBe(0);
    });

    it('should handle single element', async () => {
      const a = new Float64Array([5]);
      const b = new Float64Array([3]);

      const result = await parallelMultiply(a, b, { pool });

      expect(Array.from(result.result)).toEqual([15]);
    });

    it('should preserve special values', async () => {
      const data = new Float64Array([Infinity, -Infinity, 0]);

      const result = await parallelAbs(data, { pool });

      expect(result.result[0]).toBe(Infinity);
      expect(result.result[1]).toBe(Infinity);
      expect(result.result[2]).toBe(0);
    });
  });

  describe('Execution Metadata', () => {
    it('should include duration', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([4, 5, 6]);

      const result = await parallelAdd(a, b, { pool });

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should indicate parallelization status', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([4, 5, 6]);

      const result = await parallelAdd(a, b, { pool });

      expect(typeof result.parallelized).toBe('boolean');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  parallelStatVariance,
  parallelStatStd,
  parallelStatNorm,
  parallelStatDistance,
  parallelStatCorr,
  parallelStatMAD,
  parallelStatQuantile,
  parallelStatHistogram,
} from '../src/typed/statistics.js';

describe('statistics typed functions - extended synchronous paths', () => {
  describe('parallelStatVariance - variadic', () => {
    it('should compute variance of two numbers', () => {
      const result = parallelStatVariance(2, 4);
      expect(result).toBe(2);
    });

    it('should compute variance of three numbers', () => {
      const result = parallelStatVariance(2, 4, 6);
      expect(result).toBeCloseTo(4, 10);
    });
  });

  describe('parallelStatNorm - p-norm', () => {
    it('should compute L2 norm (p=2)', () => {
      const data = new Float64Array([3, 4]);
      expect(parallelStatNorm(data, 2)).toBe(5);
    });

    it('should compute L1 norm (p=1, Manhattan)', () => {
      const data = new Float64Array([3, -4]);
      expect(parallelStatNorm(data, 1)).toBe(7);
    });

    it('should compute Infinity norm (max)', () => {
      const data = new Float64Array([3, -7, 5]);
      expect(parallelStatNorm(data, Infinity)).toBe(7);
    });

    it('should compute -Infinity norm (min)', () => {
      const data = new Float64Array([3, 7, 5]);
      expect(parallelStatNorm(data, -Infinity)).toBe(3);
    });

    it('should compute general p-norm (p=3)', () => {
      const data = new Float64Array([1, 2, 3]);
      const expected = Math.pow(1 + 8 + 27, 1/3);
      expect(parallelStatNorm(data, 3)).toBeCloseTo(expected, 10);
    });

    it('should work with number array and p-norm', () => {
      expect(parallelStatNorm([3, 4], 2)).toBe(5);
    });
  });

  describe('parallelStatDistance - variadic', () => {
    it('should compute 2D distance from four numbers', () => {
      expect(parallelStatDistance(0, 0, 3, 4)).toBe(5);
    });

    it('should compute zero distance for same point', () => {
      expect(parallelStatDistance(1, 2, 1, 2)).toBe(0);
    });
  });

  describe('parallelStatCorr', () => {
    it('should compute perfect positive correlation', async () => {
      const x = new Float64Array([1, 2, 3, 4, 5]);
      const y = new Float64Array([2, 4, 6, 8, 10]);
      const result = await parallelStatCorr(x, y);
      expect(result).toBeCloseTo(1.0, 10);
    });

    it('should compute perfect negative correlation', async () => {
      const x = new Float64Array([1, 2, 3, 4, 5]);
      const y = new Float64Array([10, 8, 6, 4, 2]);
      const result = await parallelStatCorr(x, y);
      expect(result).toBeCloseTo(-1.0, 10);
    });
  });

  describe('parallelStatMAD', () => {
    it('should compute mean absolute deviation', async () => {
      const data = new Float64Array([2, 4, 6, 8]);
      const result = await parallelStatMAD(data);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should compute MAD for number array', async () => {
      const result = await parallelStatMAD([1, 1, 1, 1]);
      expect(result).toBe(0);
    });
  });

  describe('parallelStatQuantile', () => {
    it('should compute median (quantile 0.5)', async () => {
      const result = await parallelStatQuantile([1, 2, 3, 4, 5], 0.5);
      expect(result).toBe(3);
    });

    it('should compute Q1 (quantile 0.25)', async () => {
      const result = await parallelStatQuantile([1, 2, 3, 4, 5, 6, 7, 8], 0.25);
      expect(typeof result).toBe('number');
    });
  });

  describe('parallelStatHistogram', () => {
    it('should compute histogram with number array', async () => {
      const result = await parallelStatHistogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);
    });
  });
});

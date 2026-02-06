import { describe, it, expect } from 'vitest';
import {
  parallelStatSum,
  parallelStatMean,
  parallelStatMin,
  parallelStatMax,
  parallelStatMode,
  parallelStatProd,
  parallelStatCumsum,
  parallelStatMedian,
  typedStatistics,
} from '../src/typed/statistics.js';

describe('statistics typed functions - synchronous paths', () => {
  describe('parallelStatSum', () => {
    it('should sum two numbers', () => {
      expect(parallelStatSum(1, 2)).toBe(3);
    });
    it('should sum three numbers', () => {
      expect(parallelStatSum(1, 2, 3)).toBe(6);
    });
    it('should sum four numbers', () => {
      expect(parallelStatSum(1, 2, 3, 4)).toBe(10);
    });
    it('should sum number array (async)', async () => {
      const result = await parallelStatSum([1, 2, 3, 4, 5]);
      expect(result).toBe(15);
    });
  });

  describe('parallelStatMean', () => {
    it('should compute mean of two numbers', () => {
      expect(parallelStatMean(2, 4)).toBe(3);
    });
    it('should compute mean of three numbers', () => {
      expect(parallelStatMean(1, 2, 3)).toBe(2);
    });
    it('should compute mean of array (async)', async () => {
      const result = await parallelStatMean([10, 20, 30]);
      expect(result).toBe(20);
    });
  });

  describe('parallelStatMin', () => {
    it('should find min of two numbers', () => {
      expect(parallelStatMin(3, 1)).toBe(1);
    });
    it('should find min of array (async)', async () => {
      const result = await parallelStatMin([5, 2, 8, 1, 9]);
      expect(result).toBe(1);
    });
  });

  describe('parallelStatMax', () => {
    it('should find max of two numbers', () => {
      expect(parallelStatMax(3, 1)).toBe(3);
    });
    it('should find max of array (async)', async () => {
      const result = await parallelStatMax([5, 2, 8, 1, 9]);
      expect(result).toBe(9);
    });
  });

  describe('parallelStatMode', () => {
    it('should find mode of array', () => {
      const result = parallelStatMode([1, 2, 2, 3, 3, 3]);
      expect(result).toContain(3);
    });
    it('should handle multiple modes', () => {
      const result = parallelStatMode([1, 1, 2, 2]);
      expect(result).toContain(1);
      expect(result).toContain(2);
    });
  });

  describe('parallelStatProd', () => {
    it('should compute product of array', () => {
      expect(parallelStatProd([1, 2, 3, 4])).toBe(24);
    });
    it('should handle zero', () => {
      expect(parallelStatProd([1, 2, 0, 4])).toBe(0);
    });
  });

  describe('parallelStatCumsum', () => {
    it('should compute cumulative sum', () => {
      expect(parallelStatCumsum([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
    });
    it('should handle single element', () => {
      expect(parallelStatCumsum([5])).toEqual([5]);
    });
  });

  describe('parallelStatMedian', () => {
    it('should compute median of odd-length array (async)', async () => {
      const result = await parallelStatMedian([3, 1, 2]);
      expect(result).toBe(2);
    });
    it('should compute median of even-length array (async)', async () => {
      const result = await parallelStatMedian([1, 2, 3, 4]);
      expect(result).toBe(2.5);
    });
  });

  describe('typedStatistics object', () => {
    it('should contain expected function keys', () => {
      expect(typedStatistics).toHaveProperty('sum');
      expect(typedStatistics).toHaveProperty('mean');
      expect(typedStatistics).toHaveProperty('min');
      expect(typedStatistics).toHaveProperty('max');
      expect(typedStatistics).toHaveProperty('mode');
      expect(typedStatistics).toHaveProperty('prod');
      expect(typedStatistics).toHaveProperty('cumsum');
      expect(typedStatistics).toHaveProperty('median');
    });
  });
});

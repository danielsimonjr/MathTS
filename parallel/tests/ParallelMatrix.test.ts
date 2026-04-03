import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ParallelMatrix } from '../src/ParallelMatrix.js';

describe('ParallelMatrix', () => {
  // Force sequential mode for all tests
  beforeAll(() => {
    ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
  });

  afterAll(async () => {
    await ParallelMatrix.terminate();
  });

  describe('configure()', () => {
    it('should update config', () => {
      ParallelMatrix.configure({ minSizeForParallel: 500, useSharedMemory: false });
      // If it does not throw, configuration succeeded
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
    });
  });

  describe('multiply() sequential fallback', () => {
    it('should multiply 2x2 matrices', async () => {
      // A = [[1,2],[3,4]], B = [[5,6],[7,8]]
      // C = [[19,22],[43,50]]
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([5, 6, 7, 8]);
      const result = await ParallelMatrix.multiply(a, 2, 2, b, 2, 2);
      expect(result[0]).toBeCloseTo(19);
      expect(result[1]).toBeCloseTo(22);
      expect(result[2]).toBeCloseTo(43);
      expect(result[3]).toBeCloseTo(50);
    });

    it('should multiply 2x3 * 3x2 matrices', async () => {
      // A = [[1,2,3],[4,5,6]], B = [[7,8],[9,10],[11,12]]
      // C = [[58,64],[139,154]]
      const a = new Float64Array([1, 2, 3, 4, 5, 6]);
      const b = new Float64Array([7, 8, 9, 10, 11, 12]);
      const result = await ParallelMatrix.multiply(a, 2, 3, b, 3, 2);
      expect(result).toHaveLength(4);
      expect(result[0]).toBeCloseTo(58);
      expect(result[1]).toBeCloseTo(64);
      expect(result[2]).toBeCloseTo(139);
      expect(result[3]).toBeCloseTo(154);
    });

    it('should handle identity multiplication', async () => {
      // A * I = A for 2x2
      const a = new Float64Array([3, 7, 1, 5]);
      const identity = new Float64Array([1, 0, 0, 1]);
      const result = await ParallelMatrix.multiply(a, 2, 2, identity, 2, 2);
      expect(result[0]).toBeCloseTo(3);
      expect(result[1]).toBeCloseTo(7);
      expect(result[2]).toBeCloseTo(1);
      expect(result[3]).toBeCloseTo(5);
    });
  });

  describe('add() sequential fallback', () => {
    it('should add two arrays element-wise', async () => {
      const a = new Float64Array([1, 2, 3, 4]);
      const b = new Float64Array([5, 6, 7, 8]);
      const result = await ParallelMatrix.add(a, b, 4);
      expect(result[0]).toBeCloseTo(6);
      expect(result[1]).toBeCloseTo(8);
      expect(result[2]).toBeCloseTo(10);
      expect(result[3]).toBeCloseTo(12);
    });

    it('should handle negative numbers', async () => {
      const a = new Float64Array([-1, 0, 1]);
      const b = new Float64Array([1, 0, -1]);
      const result = await ParallelMatrix.add(a, b, 3);
      expect(result[0]).toBeCloseTo(0);
      expect(result[1]).toBeCloseTo(0);
      expect(result[2]).toBeCloseTo(0);
    });
  });

  describe('transpose() sequential fallback', () => {
    it('should transpose 2x3 to 3x2', async () => {
      // [[1,2,3],[4,5,6]] -> [[1,4],[2,5],[3,6]]
      const data = new Float64Array([1, 2, 3, 4, 5, 6]);
      const result = await ParallelMatrix.transpose(data, 2, 3);
      expect(result).toHaveLength(6);
      expect(result[0]).toBeCloseTo(1);
      expect(result[1]).toBeCloseTo(4);
      expect(result[2]).toBeCloseTo(2);
      expect(result[3]).toBeCloseTo(5);
      expect(result[4]).toBeCloseTo(3);
      expect(result[5]).toBeCloseTo(6);
    });

    it('should transpose 1x1 matrix', async () => {
      const data = new Float64Array([42]);
      const result = await ParallelMatrix.transpose(data, 1, 1);
      expect(result[0]).toBeCloseTo(42);
    });
  });

  describe('terminate()', () => {
    it('should terminate cleanly', async () => {
      await ParallelMatrix.terminate();
      // Should not throw
    });
  });
});

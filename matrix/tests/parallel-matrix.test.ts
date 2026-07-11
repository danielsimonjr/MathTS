/**
 * Parallel Matrix Operations Tests
 * @module @danielsimonjr/mathts-matrix/tests/parallel-matrix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import {
  parallelMatrixAbs,
  parallelMatrixAdd,
  initializeParallelMatrix,
  terminateParallelMatrix,
} from '../src/parallel-matrix.js';

// Mock the parallel worker pool to avoid spinning up real workers
vi.mock('@danielsimonjr/mathts-parallel', () => {
  return {
    computePool: {
      initialize: vi.fn().mockResolvedValue(undefined),
      terminate: vi.fn().mockResolvedValue(undefined),
      abs: vi.fn().mockImplementation(async (data: Float64Array) => {
        // Return a mocked ParallelResult
        const result = new Float64Array(data.length);
        for (let i = 0; i < data.length; i++) {
          result[i] = Math.abs(data[i]);
        }
        return { result, timeMs: 1 };
      }),
      add: vi.fn().mockImplementation(async (a: Float64Array, b: Float64Array) => {
        const result = new Float64Array(a.length);
        for (let i = 0; i < a.length; i++) {
          result[i] = a[i] + b[i];
        }
        return { result, timeMs: 1 };
      }),
    },
  };
});

describe('parallel-matrix operations', () => {
  beforeEach(async () => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('pool management', () => {
    it('should initialize and terminate computePool', async () => {
      const parallelModule = await import('@danielsimonjr/mathts-parallel');

      await initializeParallelMatrix();
      expect(parallelModule.computePool.initialize).toHaveBeenCalled();

      await terminateParallelMatrix();
      expect(parallelModule.computePool.terminate).toHaveBeenCalled();
    });
  });

  describe('parallelMatrixAbs', () => {
    it('should calculate absolute values for DenseMatrix', async () => {
      let m = new DenseMatrix(2, 2);
      m = m.set(0, 0, -1);
      m = m.set(0, 1, 2);
      m = m.set(1, 0, -3);
      m = m.set(1, 1, 4);

      const result = await parallelMatrixAbs(m) as DenseMatrix;
      const parallelModule = await import('@danielsimonjr/mathts-parallel');

      expect(parallelModule.computePool.abs).toHaveBeenCalledTimes(1);

      expect(result.rows).toBe(2);
      expect(result.cols).toBe(2);
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(0, 1)).toBe(2);
      expect(result.get(1, 0)).toBe(3);
      expect(result.get(1, 1)).toBe(4);
    });

    it('should calculate absolute values for Float64Array directly', async () => {
      const arr = new Float64Array([-1.5, 2.5, -3.0]);

      const result = await parallelMatrixAbs(arr) as Float64Array;
      const parallelModule = await import('@danielsimonjr/mathts-parallel');

      expect(parallelModule.computePool.abs).toHaveBeenCalledTimes(1);
      expect(result[0]).toBe(1.5);
      expect(result[1]).toBe(2.5);
      expect(result[2]).toBe(3.0);
    });

    it('should fallback to scalar math for numbers', () => {
      const result = parallelMatrixAbs(-42.5) as number;

      // Scalar numbers bypass parallel pool
      expect(result).toBe(42.5);
    });
  });

  describe('parallelMatrixAdd', () => {
    it('should add two DenseMatrices', async () => {
      let m1 = new DenseMatrix(2, 2);
      m1 = m1.set(0, 0, 1);
      m1 = m1.set(0, 1, 2);
      m1 = m1.set(1, 0, 3);
      m1 = m1.set(1, 1, 4);

      let m2 = new DenseMatrix(2, 2);
      m2 = m2.set(0, 0, 10);
      m2 = m2.set(0, 1, 20);
      m2 = m2.set(1, 0, 30);
      m2 = m2.set(1, 1, 40);

      const result = await parallelMatrixAdd(m1, m2) as DenseMatrix;
      const parallelModule = await import('@danielsimonjr/mathts-parallel');

      expect(parallelModule.computePool.add).toHaveBeenCalledTimes(1);

      expect(result.get(0, 0)).toBe(11);
      expect(result.get(0, 1)).toBe(22);
      expect(result.get(1, 0)).toBe(33);
      expect(result.get(1, 1)).toBe(44);
    });

    it('should add scalar to DenseMatrix', async () => {
      let m = new DenseMatrix(2, 2);
      m = m.set(0, 0, 1);
      m = m.set(0, 1, 2);
      m = m.set(1, 0, 3);
      m = m.set(1, 1, 4);

      const result = await parallelMatrixAdd(m, 5) as DenseMatrix;

      expect(result.get(0, 0)).toBe(6);
      expect(result.get(0, 1)).toBe(7);
      expect(result.get(1, 0)).toBe(8);
      expect(result.get(1, 1)).toBe(9);
    });

    it('should throw error on dimension mismatch', async () => {
      const m1 = new DenseMatrix(2, 2);
      const m2 = new DenseMatrix(3, 3);

      await expect(parallelMatrixAdd(m1, m2)).rejects.toThrow(/Matrix dimensions must match/);
    });

    it('should add two Float64Arrays', async () => {
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([10, 20, 30]);

      const result = await parallelMatrixAdd(a, b) as Float64Array;

      expect(result[0]).toBe(11);
      expect(result[1]).toBe(22);
      expect(result[2]).toBe(33);
    });

    it('should fallback to scalar addition for numbers', () => {
      const result = parallelMatrixAdd(10, 5) as number;
      expect(result).toBe(15);
    });
  });
});

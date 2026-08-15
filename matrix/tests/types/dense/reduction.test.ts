import { describe, it, expect } from 'vitest';
import { sum, mean, min, max, norm, trace } from '../../../src/types/dense/reduction.js';
import { DenseMatrix } from '../../../src/types/DenseMatrix.js';

describe('DenseMatrix Reductions', () => {
  describe('sum', () => {
    it('should compute sum of a 2x2 matrix', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4]
      ]);
      expect(sum(m)).toBe(10);
    });

    it('should compute sum of a zero matrix', () => {
      const m = DenseMatrix.zeros(3, 3);
      expect(sum(m)).toBe(0);
    });

    it('should compute sum with negative numbers', () => {
      const m = DenseMatrix.fromArray([
        [-1, -2],
        [3, 4]
      ]);
      expect(sum(m)).toBe(4);
    });
  });

  describe('mean', () => {
    it('should compute mean of a 2x2 matrix', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4]
      ]);
      expect(mean(m)).toBe(2.5); // 10 / 4
    });

    it('should compute mean of a zero matrix', () => {
      const m = DenseMatrix.zeros(2, 2);
      expect(mean(m)).toBe(0);
    });
  });

  describe('min', () => {
    it('should find the minimum value in a matrix', () => {
      const m = DenseMatrix.fromArray([
        [5, 2],
        [9, 1]
      ]);
      expect(min(m)).toBe(1);
    });

    it('should handle negative numbers', () => {
      const m = DenseMatrix.fromArray([
        [-5, -2],
        [9, -10]
      ]);
      expect(min(m)).toBe(-10);
    });
  });

  describe('max', () => {
    it('should find the maximum value in a matrix', () => {
      const m = DenseMatrix.fromArray([
        [5, 2],
        [9, 1]
      ]);
      expect(max(m)).toBe(9);
    });

    it('should handle negative numbers', () => {
      const m = DenseMatrix.fromArray([
        [-5, -2],
        [-9, -10]
      ]);
      expect(max(m)).toBe(-2);
    });
  });

  describe('norm', () => {
    it('should compute the Frobenius norm of a matrix', () => {
      const m = DenseMatrix.fromArray([
        [3, 4]
      ]);
      expect(norm(m)).toBe(5); // sqrt(3^2 + 4^2) = sqrt(9 + 16) = sqrt(25) = 5
    });

    it('should handle negative numbers', () => {
      const m = DenseMatrix.fromArray([
        [-3, -4]
      ]);
      expect(norm(m)).toBe(5);
    });

    it('should compute norm of a zero matrix', () => {
      const m = DenseMatrix.zeros(2, 2);
      expect(norm(m)).toBe(0);
    });
  });

  describe('trace', () => {
    it('should compute the trace of a square matrix', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9]
      ]);
      expect(trace(m)).toBe(15); // 1 + 5 + 9
    });

    it('should throw an error for non-square matrices', () => {
      const m = DenseMatrix.zeros(2, 3);
      expect(() => trace(m)).toThrow('Trace is only defined for square matrices');
    });
  });
});

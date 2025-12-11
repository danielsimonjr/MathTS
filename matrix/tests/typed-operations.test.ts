/**
 * Tests for typed matrix operations
 */

import { describe, it, expect } from 'vitest';
import {
  DenseMatrix,
  // Typed operations
  matrix,
  identity,
  zeros,
  ones,
  diag,
  add,
  subtract,
  multiply,
  divide,
  transpose,
  sum,
  mean,
  norm,
  trace,
  abs,
  sqrt,
  square,
  size,
  row,
  column,
} from '../src/index.js';

describe('Typed Matrix Operations', () => {
  describe('Matrix creation functions', () => {
    it('should create matrix from array', () => {
      const m = matrix([[1, 2], [3, 4]]) as DenseMatrix;
      expect(m.rows).toBe(2);
      expect(m.cols).toBe(2);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(4);
    });

    it('should create identity matrix', () => {
      const m = identity(3) as DenseMatrix;
      expect(m.rows).toBe(3);
      expect(m.cols).toBe(3);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(0, 1)).toBe(0);
      expect(m.get(1, 1)).toBe(1);
    });

    it('should create zeros matrix', () => {
      const m = zeros(2, 3) as DenseMatrix;
      expect(m.rows).toBe(2);
      expect(m.cols).toBe(3);
      expect(m.get(0, 0)).toBe(0);
      expect(m.get(1, 2)).toBe(0);
    });

    it('should create ones matrix', () => {
      const m = ones(2, 2) as DenseMatrix;
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(1);
    });

    it('should create diagonal matrix', () => {
      const m = diag([1, 2, 3]) as DenseMatrix;
      expect(m.rows).toBe(3);
      expect(m.cols).toBe(3);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(2);
      expect(m.get(2, 2)).toBe(3);
      expect(m.get(0, 1)).toBe(0);
    });
  });

  describe('Matrix arithmetic', () => {
    const m1 = DenseMatrix.fromArray([[1, 2], [3, 4]]);
    const m2 = DenseMatrix.fromArray([[5, 6], [7, 8]]);

    it('should add matrices', () => {
      const result = add(m1, m2) as DenseMatrix;
      expect(result.get(0, 0)).toBe(6);
      expect(result.get(0, 1)).toBe(8);
      expect(result.get(1, 0)).toBe(10);
      expect(result.get(1, 1)).toBe(12);
    });

    it('should add matrix and scalar', () => {
      const result = add(m1, 10) as DenseMatrix;
      expect(result.get(0, 0)).toBe(11);
      expect(result.get(1, 1)).toBe(14);
    });

    it('should subtract matrices', () => {
      const result = subtract(m2, m1) as DenseMatrix;
      expect(result.get(0, 0)).toBe(4);
      expect(result.get(1, 1)).toBe(4);
    });

    it('should multiply matrices (matmul)', () => {
      const result = multiply(m1, m2) as DenseMatrix;
      // [[1,2],[3,4]] * [[5,6],[7,8]]
      // [1*5+2*7, 1*6+2*8] = [19, 22]
      // [3*5+4*7, 3*6+4*8] = [43, 50]
      expect(result.get(0, 0)).toBe(19);
      expect(result.get(0, 1)).toBe(22);
      expect(result.get(1, 0)).toBe(43);
      expect(result.get(1, 1)).toBe(50);
    });

    it('should scale matrix by scalar', () => {
      const result = multiply(m1, 2) as DenseMatrix;
      expect(result.get(0, 0)).toBe(2);
      expect(result.get(1, 1)).toBe(8);
    });

    it('should divide matrix by scalar', () => {
      const result = divide(m1, 2) as DenseMatrix;
      expect(result.get(0, 0)).toBe(0.5);
      expect(result.get(1, 1)).toBe(2);
    });

    it('should transpose matrix', () => {
      const m = DenseMatrix.fromArray([[1, 2, 3], [4, 5, 6]]);
      const result = transpose(m) as DenseMatrix;
      expect(result.rows).toBe(3);
      expect(result.cols).toBe(2);
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(0, 1)).toBe(4);
      expect(result.get(2, 0)).toBe(3);
    });
  });

  describe('Matrix reductions', () => {
    const m = DenseMatrix.fromArray([[1, 2], [3, 4]]);

    it('should compute sum', () => {
      const result = sum(m);
      expect(result).toBe(10);
    });

    it('should compute mean', () => {
      const result = mean(m);
      expect(result).toBe(2.5);
    });

    it('should compute Frobenius norm', () => {
      const result = norm(m);
      // sqrt(1 + 4 + 9 + 16) = sqrt(30) ≈ 5.477
      expect(result).toBeCloseTo(Math.sqrt(30), 5);
    });

    it('should compute trace', () => {
      const result = trace(m);
      expect(result).toBe(5); // 1 + 4
    });
  });

  describe('Element-wise operations', () => {
    const m = DenseMatrix.fromArray([[-1, 2], [-3, 4]]);

    it('should compute absolute value', () => {
      const result = abs(m) as DenseMatrix;
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(1, 0)).toBe(3);
    });

    it('should compute square', () => {
      const result = square(m) as DenseMatrix;
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(0, 1)).toBe(4);
    });

    it('should compute square root', () => {
      const m2 = DenseMatrix.fromArray([[1, 4], [9, 16]]);
      const result = sqrt(m2) as DenseMatrix;
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(0, 1)).toBe(2);
      expect(result.get(1, 1)).toBe(4);
    });
  });

  describe('Matrix query operations', () => {
    const m = DenseMatrix.fromArray([[1, 2, 3], [4, 5, 6]]);

    it('should get matrix size', () => {
      const s = size(m) as number[];
      expect(s).toEqual([2, 3]);
    });

    it('should get row', () => {
      const r = row(m, 0) as DenseMatrix;
      expect(r.rows).toBe(1);
      expect(r.cols).toBe(3);
      expect(r.get(0, 0)).toBe(1);
      expect(r.get(0, 2)).toBe(3);
    });

    it('should get column', () => {
      const c = column(m, 1) as DenseMatrix;
      expect(c.rows).toBe(2);
      expect(c.cols).toBe(1);
      expect(c.get(0, 0)).toBe(2);
      expect(c.get(1, 0)).toBe(5);
    });
  });

  describe('Polymorphic dispatch', () => {
    it('should add numbers', () => {
      const result = add(1, 2);
      expect(result).toBe(3);
    });

    it('should multiply numbers', () => {
      const result = multiply(3, 4);
      expect(result).toBe(12);
    });

    it('should handle mixed types (number + number)', () => {
      const result = add(1, 2);
      expect(result).toBe(3);
    });
  });
});

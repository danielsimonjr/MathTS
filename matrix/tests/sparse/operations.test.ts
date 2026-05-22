/**
 * Sparse Matrix Operations Tests
 *
 * Tests for sparse matrix arithmetic and linear algebra operations.
 */

import { describe, it, expect } from 'vitest';
import { SparseMatrix } from '../../src/types/SparseMatrix.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

describe('Sparse Matrix Operations', () => {
  // Helper to compare sparse matrices
  function expectSparseEqual(
    actual: SparseMatrix,
    expected: SparseMatrix,
    tolerance = 1e-10
  ): void {
    expect(actual.rows).toBe(expected.rows);
    expect(actual.cols).toBe(expected.cols);

    for (let i = 0; i < actual.rows; i++) {
      for (let j = 0; j < actual.cols; j++) {
        expect(Math.abs(actual.get(i, j) - expected.get(i, j))).toBeLessThan(tolerance);
      }
    }
  }

  // Helper to compare sparse with dense
  function expectMatchesDense(sparse: SparseMatrix, dense: DenseMatrix, tolerance = 1e-10): void {
    expect(sparse.rows).toBe(dense.rows);
    expect(sparse.cols).toBe(dense.cols);

    for (let i = 0; i < sparse.rows; i++) {
      for (let j = 0; j < sparse.cols; j++) {
        expect(Math.abs(sparse.get(i, j) - dense.get(i, j))).toBeLessThan(tolerance);
      }
    }
  }

  describe('Addition', () => {
    it('should add two sparse matrices', () => {
      const a = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const b = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 3 },
        { row: 2, col: 2, value: 4 },
      ]);

      const result = a.add(b);

      expect(result.get(0, 0)).toBe(4); // 1 + 3
      expect(result.get(1, 1)).toBe(2);
      expect(result.get(2, 2)).toBe(4);
    });

    it('should handle cancellation in addition', () => {
      const a = SparseMatrix.fromCOO(2, 2, [{ row: 0, col: 0, value: 5 }]);

      const b = SparseMatrix.fromCOO(2, 2, [{ row: 0, col: 0, value: -5 }]);

      const result = a.add(b);

      expect(result.nnz).toBe(0);
      expect(result.get(0, 0)).toBe(0);
    });

    it('should add sparse and dense matrices', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const dense = new DenseMatrix(2, 2, [
        [1, 2],
        [3, 4],
      ]);

      const result = sparse.add(dense);

      expect(result.get(0, 0)).toBe(2); // 1 + 1
      expect(result.get(0, 1)).toBe(2); // 0 + 2
      expect(result.get(1, 0)).toBe(3); // 0 + 3
      expect(result.get(1, 1)).toBe(6); // 2 + 4
    });

    it('should throw on dimension mismatch', () => {
      const a = SparseMatrix.zeros(3, 3);
      const b = SparseMatrix.zeros(3, 4);

      expect(() => a.add(b)).toThrow();
    });
  });

  describe('Subtraction', () => {
    it('should subtract two sparse matrices', () => {
      const a = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 5 },
        { row: 1, col: 1, value: 3 },
      ]);

      const b = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 2 },
        { row: 0, col: 1, value: 1 },
      ]);

      const result = a.subtract(b);

      expect(result.get(0, 0)).toBe(3); // 5 - 2
      expect(result.get(0, 1)).toBe(-1); // 0 - 1
      expect(result.get(1, 1)).toBe(3); // 3 - 0
    });
  });

  describe('Scalar Multiplication', () => {
    it('should scale sparse matrix', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const result = sparse.scale(3);

      expect(result.get(0, 0)).toBe(3);
      expect(result.get(1, 1)).toBe(6);
      expect(result.nnz).toBe(2);
    });

    it('should return zero matrix when scaled by zero', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const result = sparse.scale(0);

      expect(result.nnz).toBe(0);
    });

    it('should negate matrix', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 5 },
        { row: 1, col: 1, value: -3 },
      ]);

      const result = sparse.negate();

      expect(result.get(0, 0)).toBe(-5);
      expect(result.get(1, 1)).toBe(3);
    });
  });

  describe('Element-wise Multiplication', () => {
    it('should multiply sparse matrices element-wise', () => {
      const a = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 2 },
        { row: 0, col: 1, value: 3 },
        { row: 1, col: 0, value: 4 },
      ]);

      const b = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 5 },
        { row: 1, col: 0, value: 2 },
        { row: 1, col: 1, value: 3 },
      ]);

      const result = a.multiplyElementwise(b);

      expect(result.get(0, 0)).toBe(10); // 2 * 5
      expect(result.get(0, 1)).toBe(0); // 3 * 0
      expect(result.get(1, 0)).toBe(8); // 4 * 2
      expect(result.get(1, 1)).toBe(0); // 0 * 3
    });

    it('should maintain sparsity in element-wise multiplication', () => {
      const a = SparseMatrix.identity(10);
      const b = SparseMatrix.identity(10);

      const result = a.multiplyElementwise(b);

      expect(result.nnz).toBe(10);
    });
  });

  describe('Matrix Multiplication', () => {
    it('should multiply sparse matrices', () => {
      // A = [[1, 2], [3, 4]]
      // B = [[5, 6], [7, 8]]
      // A * B = [[19, 22], [43, 50]]
      const a = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 1, value: 2 },
        { row: 1, col: 0, value: 3 },
        { row: 1, col: 1, value: 4 },
      ]);

      const b = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 5 },
        { row: 0, col: 1, value: 6 },
        { row: 1, col: 0, value: 7 },
        { row: 1, col: 1, value: 8 },
      ]);

      const result = a.multiply(b);

      expect(result.get(0, 0)).toBe(19);
      expect(result.get(0, 1)).toBe(22);
      expect(result.get(1, 0)).toBe(43);
      expect(result.get(1, 1)).toBe(50);
    });

    it('should multiply sparse identity with matrix', () => {
      const eye = SparseMatrix.identity(3);
      const a = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 2, value: 2 },
        { row: 1, col: 1, value: 3 },
        { row: 2, col: 0, value: 4 },
      ]);

      const result = eye.multiply(a);

      expectSparseEqual(result, a);
    });

    it('should multiply sparse by dense matrix', () => {
      const sparse = SparseMatrix.fromCOO(2, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 2, value: 2 },
        { row: 1, col: 1, value: 3 },
      ]);

      const dense = new DenseMatrix(3, 2, [
        [1, 2],
        [3, 4],
        [5, 6],
      ]);

      const result = sparse.multiply(dense);

      // [1, 0, 2] * [[1,2],[3,4],[5,6]] = [1+10, 2+12] = [11, 14]
      // [0, 3, 0] * [[1,2],[3,4],[5,6]] = [9, 12]
      expect(result.get(0, 0)).toBe(11);
      expect(result.get(0, 1)).toBe(14);
      expect(result.get(1, 0)).toBe(9);
      expect(result.get(1, 1)).toBe(12);
    });

    it('should handle non-square matrix multiplication', () => {
      const a = SparseMatrix.fromCOO(2, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 1, value: 2 },
        { row: 1, col: 2, value: 3 },
      ]);

      const b = SparseMatrix.fromCOO(3, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 0, value: 3 },
      ]);

      const result = a.multiply(b);

      expect(result.rows).toBe(2);
      expect(result.cols).toBe(2);
      expect(result.get(0, 0)).toBe(1); // 1*1 + 2*0 + 0*3
      expect(result.get(0, 1)).toBe(4); // 1*0 + 2*2 + 0*0
      expect(result.get(1, 0)).toBe(9); // 0*1 + 0*0 + 3*3
      expect(result.get(1, 1)).toBe(0); // 0*0 + 0*2 + 3*0
    });

    it('should throw on incompatible dimensions', () => {
      const a = SparseMatrix.zeros(2, 3);
      const b = SparseMatrix.zeros(4, 2);

      expect(() => a.multiply(b)).toThrow();
    });
  });

  describe('Transpose', () => {
    it('should transpose sparse matrix', () => {
      const sparse = SparseMatrix.fromCOO(2, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 2, value: 2 },
        { row: 1, col: 1, value: 3 },
      ]);

      const result = sparse.transpose();

      expect(result.rows).toBe(3);
      expect(result.cols).toBe(2);
      expect(result.get(0, 0)).toBe(1);
      expect(result.get(1, 1)).toBe(3);
      expect(result.get(2, 0)).toBe(2);
    });

    it('should preserve sparsity in transpose', () => {
      const sparse = SparseMatrix.identity(5);
      const result = sparse.transpose();

      expect(result.nnz).toBe(5);
      expectSparseEqual(result, sparse);
    });
  });

  describe('Reduction Operations', () => {
    it('should compute sum of non-zeros', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 2, value: 3 },
      ]);

      expect(sparse.sum()).toBe(6);
    });

    it('should compute Frobenius norm', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 3 },
        { row: 1, col: 1, value: 4 },
      ]);

      expect(sparse.norm()).toBe(5); // sqrt(9 + 16)
    });

    it('should compute trace', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 1, value: 5 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 2, value: 3 },
      ]);

      expect(sparse.trace()).toBe(6); // 1 + 2 + 3
    });

    it('should throw trace error for non-square', () => {
      const sparse = SparseMatrix.zeros(2, 3);
      expect(() => sparse.trace()).toThrow();
    });
  });

  describe('Map Operations', () => {
    it('should map over non-zeros', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const result = sparse.mapNonZeros((v) => v * 10);

      expect(result.get(0, 0)).toBe(10);
      expect(result.get(1, 1)).toBe(20);
      expect(result.nnz).toBe(2);
    });

    it('should remove zeros in mapNonZeros', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const result = sparse.mapNonZeros((v) => (v > 1 ? v : 0));

      expect(result.nnz).toBe(1);
      expect(result.get(0, 0)).toBe(0);
      expect(result.get(1, 1)).toBe(2);
    });
  });

  describe('Dense ↔ Sparse Conversion Roundtrip', () => {
    it('should preserve values in roundtrip', () => {
      const original = new DenseMatrix(3, 3, [
        [1, 0, 2],
        [0, 3, 0],
        [4, 0, 5],
      ]);

      const sparse = SparseMatrix.fromDense(original);
      const recovered = sparse.toDense();

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(recovered.get(i, j)).toBe(original.get(i, j));
        }
      }
    });

    it('should handle fully dense matrix', () => {
      const original = new DenseMatrix(2, 2, [
        [1, 2],
        [3, 4],
      ]);

      const sparse = SparseMatrix.fromDense(original);

      expect(sparse.nnz).toBe(4);
      expect(sparse.sparsity).toBe(0);

      const recovered = sparse.toDense();
      expectMatchesDense(sparse, original);
    });

    it('should handle fully sparse (zero) matrix', () => {
      const original = DenseMatrix.zeros(3, 3);

      const sparse = SparseMatrix.fromDense(original);

      expect(sparse.nnz).toBe(0);
      expect(sparse.sparsity).toBe(1);

      const recovered = sparse.toDense();

      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          expect(recovered.get(i, j)).toBe(0);
        }
      }
    });
  });

  describe('Correctness vs Dense Reference', () => {
    it('should match dense addition', () => {
      const denseA = new DenseMatrix(3, 3, [
        [1, 0, 2],
        [0, 3, 0],
        [4, 0, 5],
      ]);

      const denseB = new DenseMatrix(3, 3, [
        [0, 1, 0],
        [2, 0, 3],
        [0, 4, 0],
      ]);

      const sparseA = SparseMatrix.fromDense(denseA);
      const sparseB = SparseMatrix.fromDense(denseB);

      const denseResult = denseA.add(denseB);
      const sparseResult = sparseA.add(sparseB);

      expectMatchesDense(sparseResult, denseResult);
    });

    it('should match dense multiplication', () => {
      const denseA = new DenseMatrix(2, 3, [
        [1, 0, 2],
        [0, 3, 0],
      ]);

      const denseB = new DenseMatrix(3, 2, [
        [1, 2],
        [3, 4],
        [5, 6],
      ]);

      const sparseA = SparseMatrix.fromDense(denseA);
      const sparseB = SparseMatrix.fromDense(denseB);

      const denseResult = denseA.multiply(denseB);
      const sparseResult = sparseA.multiply(sparseB);

      expectMatchesDense(sparseResult, denseResult);
    });

    it('should match dense transpose', () => {
      const dense = new DenseMatrix(2, 3, [
        [1, 0, 2],
        [0, 3, 0],
      ]);

      const sparse = SparseMatrix.fromDense(dense);

      const denseT = dense.transpose();
      const sparseT = sparse.transpose();

      expectMatchesDense(sparseT, denseT);
    });
  });
});

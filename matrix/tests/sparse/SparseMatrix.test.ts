/**
 * SparseMatrix Tests
 *
 * Tests for CSR format sparse matrix storage, element access,
 * and conversion operations.
 */

import { describe, it, expect } from 'vitest';
import { SparseMatrix, isSparseMatrix } from '../../src/types/SparseMatrix.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

describe('SparseMatrix', () => {
  describe('Construction', () => {
    it('should create empty sparse matrix', () => {
      const sparse = SparseMatrix.zeros(3, 4);
      expect(sparse.rows).toBe(3);
      expect(sparse.cols).toBe(4);
      expect(sparse.nnz).toBe(0);
      expect(sparse.sparsity).toBe(1);
    });

    it('should create sparse matrix from CSR components', () => {
      // 3x3 matrix with 3 non-zeros:
      // [1, 0, 2]
      // [0, 0, 3]
      // [0, 0, 0]
      const values = new Float64Array([1, 2, 3]);
      const colIndices = new Int32Array([0, 2, 2]);
      const rowPointers = new Int32Array([0, 2, 3, 3]);

      const sparse = new SparseMatrix(3, 3, values, colIndices, rowPointers);

      expect(sparse.rows).toBe(3);
      expect(sparse.cols).toBe(3);
      expect(sparse.nnz).toBe(3);
      expect(sparse.get(0, 0)).toBe(1);
      expect(sparse.get(0, 1)).toBe(0);
      expect(sparse.get(0, 2)).toBe(2);
      expect(sparse.get(1, 2)).toBe(3);
    });

    it('should throw on invalid CSR structure', () => {
      // Wrong rowPointers length
      expect(() => {
        new SparseMatrix(
          3,
          3,
          new Float64Array([1, 2]),
          new Int32Array([0, 1]),
          new Int32Array([0, 1]) // Should be length 4
        );
      }).toThrow();

      // Mismatched values/colIndices
      expect(() => {
        new SparseMatrix(
          3,
          3,
          new Float64Array([1, 2, 3]),
          new Int32Array([0, 1]), // Should match values length
          new Int32Array([0, 1, 2, 3])
        );
      }).toThrow();
    });
  });

  describe('Static Factory Methods', () => {
    it('should create from dense matrix', () => {
      const dense = new DenseMatrix(3, 3, [
        [1, 0, 2],
        [0, 0, 3],
        [4, 0, 0],
      ]);

      const sparse = SparseMatrix.fromDense(dense);

      expect(sparse.nnz).toBe(4);
      expect(sparse.get(0, 0)).toBe(1);
      expect(sparse.get(0, 2)).toBe(2);
      expect(sparse.get(1, 2)).toBe(3);
      expect(sparse.get(2, 0)).toBe(4);
    });

    it('should create from dense matrix with drop tolerance', () => {
      const dense = new DenseMatrix(2, 2, [
        [1, 0.001],
        [0.0001, 2],
      ]);

      const sparse = SparseMatrix.fromDense(dense, 0.01);

      expect(sparse.nnz).toBe(2);
      expect(sparse.get(0, 0)).toBe(1);
      expect(sparse.get(0, 1)).toBe(0); // Dropped
      expect(sparse.get(1, 0)).toBe(0); // Dropped
      expect(sparse.get(1, 1)).toBe(2);
    });

    it('should create from COO format', () => {
      const entries = [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 2, value: 2 },
        { row: 1, col: 1, value: 3 },
        { row: 2, col: 0, value: 4 },
      ];

      const sparse = SparseMatrix.fromCOO(3, 3, entries);

      expect(sparse.nnz).toBe(4);
      expect(sparse.get(0, 0)).toBe(1);
      expect(sparse.get(0, 2)).toBe(2);
      expect(sparse.get(1, 1)).toBe(3);
      expect(sparse.get(2, 0)).toBe(4);
    });

    it('should create identity matrix', () => {
      const eye = SparseMatrix.identity(4);

      expect(eye.nnz).toBe(4);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          expect(eye.get(i, j)).toBe(i === j ? 1 : 0);
        }
      }
    });

    it('should create diagonal matrix', () => {
      const diag = SparseMatrix.diag([1, 2, 3, 4]);

      expect(diag.nnz).toBe(4);
      expect(diag.get(0, 0)).toBe(1);
      expect(diag.get(1, 1)).toBe(2);
      expect(diag.get(2, 2)).toBe(3);
      expect(diag.get(3, 3)).toBe(4);
    });

    it('should handle zero in diagonal', () => {
      const diag = SparseMatrix.diag([1, 0, 3]);

      expect(diag.nnz).toBe(2);
      expect(diag.get(0, 0)).toBe(1);
      expect(diag.get(1, 1)).toBe(0);
      expect(diag.get(2, 2)).toBe(3);
    });
  });

  describe('Element Access', () => {
    it('should get elements correctly', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 2, value: 2 },
        { row: 2, col: 1, value: 3 },
      ]);

      expect(sparse.get(0, 0)).toBe(1);
      expect(sparse.get(0, 1)).toBe(0);
      expect(sparse.get(0, 2)).toBe(0);
      expect(sparse.get(1, 0)).toBe(0);
      expect(sparse.get(1, 1)).toBe(0);
      expect(sparse.get(1, 2)).toBe(2);
      expect(sparse.get(2, 0)).toBe(0);
      expect(sparse.get(2, 1)).toBe(3);
      expect(sparse.get(2, 2)).toBe(0);
    });

    it('should throw on out-of-bounds access', () => {
      const sparse = SparseMatrix.zeros(3, 3);
      expect(() => sparse.get(-1, 0)).toThrow();
      expect(() => sparse.get(0, -1)).toThrow();
      expect(() => sparse.get(3, 0)).toThrow();
      expect(() => sparse.get(0, 3)).toThrow();
    });

    it('should set elements (immutable - returns new matrix)', () => {
      const sparse = SparseMatrix.zeros(3, 3);
      const sparse2 = sparse.set(0, 0, 5);

      expect(sparse.get(0, 0)).toBe(0); // Original unchanged
      expect(sparse2.get(0, 0)).toBe(5);
      expect(sparse2.nnz).toBe(1);
    });

    it('should update existing element', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [{ row: 0, col: 0, value: 1 }]);
      const sparse2 = sparse.set(0, 0, 5);

      expect(sparse2.get(0, 0)).toBe(5);
      expect(sparse2.nnz).toBe(1);
    });

    it('should remove element when setting to zero', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);
      const sparse2 = sparse.set(0, 0, 0);

      expect(sparse2.get(0, 0)).toBe(0);
      expect(sparse2.nnz).toBe(1);
    });
  });

  describe('Properties', () => {
    it('should compute sparsity correctly', () => {
      const sparse = SparseMatrix.fromCOO(4, 4, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 2, value: 3 },
        { row: 3, col: 3, value: 4 },
      ]);

      expect(sparse.nnz).toBe(4);
      expect(sparse.density).toBeCloseTo(4 / 16);
      expect(sparse.sparsity).toBeCloseTo(1 - 4 / 16);
    });

    it('should report isSquare correctly', () => {
      expect(SparseMatrix.zeros(3, 3).isSquare).toBe(true);
      expect(SparseMatrix.zeros(3, 4).isSquare).toBe(false);
    });

    it('should report isVector correctly', () => {
      expect(SparseMatrix.zeros(1, 5).isVector).toBe(true);
      expect(SparseMatrix.zeros(5, 1).isVector).toBe(true);
      expect(SparseMatrix.zeros(3, 3).isVector).toBe(false);
    });
  });

  describe('Row/Column/Slice Operations', () => {
    it('should get row as sparse matrix', () => {
      const sparse = SparseMatrix.fromCOO(3, 4, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 2, value: 2 },
        { row: 1, col: 1, value: 3 },
        { row: 2, col: 3, value: 4 },
      ]);

      const row0 = sparse.row(0);
      expect(row0.rows).toBe(1);
      expect(row0.cols).toBe(4);
      expect(row0.nnz).toBe(2);
      expect(row0.get(0, 0)).toBe(1);
      expect(row0.get(0, 2)).toBe(2);
    });

    it('should get column as sparse matrix', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 1, value: 1 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 0, value: 3 },
      ]);

      const col1 = sparse.column(1);
      expect(col1.rows).toBe(3);
      expect(col1.cols).toBe(1);
      expect(col1.nnz).toBe(2);
      expect(col1.get(0, 0)).toBe(1);
      expect(col1.get(1, 0)).toBe(2);
      expect(col1.get(2, 0)).toBe(0);
    });

    it('should slice submatrix', () => {
      const sparse = SparseMatrix.fromCOO(4, 4, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 2, value: 3 },
        { row: 3, col: 3, value: 4 },
      ]);

      const sub = sparse.slice({ rowStart: 1, rowEnd: 3, colStart: 1, colEnd: 3 });

      expect(sub.rows).toBe(2);
      expect(sub.cols).toBe(2);
      expect(sub.get(0, 0)).toBe(2);
      expect(sub.get(1, 1)).toBe(3);
    });

    it('should get diagonal', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 1, value: 5 },
        { row: 1, col: 1, value: 2 },
        { row: 2, col: 2, value: 3 },
      ]);

      const diag = sparse.diagonal();

      expect(diag.rows).toBe(3);
      expect(diag.cols).toBe(1);
      expect(diag.get(0, 0)).toBe(1);
      expect(diag.get(1, 0)).toBe(2);
      expect(diag.get(2, 0)).toBe(3);
    });
  });

  describe('Conversion', () => {
    it('should convert to dense matrix', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 2, value: 2 },
        { row: 1, col: 1, value: 3 },
        { row: 2, col: 0, value: 4 },
      ]);

      const dense = sparse.toDense();

      expect(dense.rows).toBe(3);
      expect(dense.cols).toBe(3);
      expect(dense.get(0, 0)).toBe(1);
      expect(dense.get(0, 1)).toBe(0);
      expect(dense.get(0, 2)).toBe(2);
      expect(dense.get(1, 1)).toBe(3);
      expect(dense.get(2, 0)).toBe(4);
    });

    it('should convert to nested array', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const arr = sparse.toArray();

      expect(arr).toEqual([
        [1, 0],
        [0, 2],
      ]);
    });

    it('should get CSR components', () => {
      const values = new Float64Array([1, 2, 3]);
      const colIndices = new Int32Array([0, 2, 1]);
      const rowPointers = new Int32Array([0, 2, 3, 3]);

      const sparse = new SparseMatrix(3, 3, values, colIndices, rowPointers);
      const csr = sparse.getCSR();

      expect(Array.from(csr.values)).toEqual([1, 2, 3]);
      expect(Array.from(csr.colIndices)).toEqual([0, 2, 1]);
      expect(Array.from(csr.rowPointers)).toEqual([0, 2, 3, 3]);
    });

    it('should clone matrix', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const clone = sparse.clone();

      expect(clone.get(0, 0)).toBe(1);
      expect(clone.get(1, 1)).toBe(2);

      // Verify independence
      const modified = clone.set(0, 0, 99);
      expect(sparse.get(0, 0)).toBe(1); // Original unchanged
      expect(modified.get(0, 0)).toBe(99);
    });
  });

  describe('Iteration', () => {
    it('should iterate over non-zero entries', () => {
      const sparse = SparseMatrix.fromCOO(3, 3, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 2, value: 2 },
        { row: 2, col: 1, value: 3 },
      ]);

      const entries = Array.from(sparse.entries());

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({ row: 0, col: 0, value: 1 });
      expect(entries[1]).toEqual({ row: 1, col: 2, value: 2 });
      expect(entries[2]).toEqual({ row: 2, col: 1, value: 3 });
    });

    it('should iterate over non-zero values', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 1 },
        { row: 1, col: 1, value: 2 },
      ]);

      const values = Array.from(sparse.values());

      expect(values).toEqual([1, 2]);
    });

    it('should support for...of iteration', () => {
      const sparse = SparseMatrix.fromCOO(2, 2, [
        { row: 0, col: 0, value: 5 },
        { row: 1, col: 1, value: 10 },
      ]);

      const values: number[] = [];
      for (const val of sparse) {
        values.push(val);
      }

      expect(values).toEqual([5, 10]);
    });
  });

  describe('Type Guard', () => {
    it('should identify SparseMatrix instances', () => {
      const sparse = SparseMatrix.zeros(3, 3);
      const dense = DenseMatrix.zeros(3, 3);

      expect(isSparseMatrix(sparse)).toBe(true);
      expect(isSparseMatrix(dense)).toBe(false);
      expect(isSparseMatrix(null)).toBe(false);
      expect(isSparseMatrix({})).toBe(false);
    });
  });
});

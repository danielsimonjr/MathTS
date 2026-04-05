/**
 * DenseMatrix Tests
 * @module @danielsimonjr/mathts-matrix/tests/DenseMatrix
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';

describe('DenseMatrix', () => {
  describe('construction', () => {
    it('should create a zero matrix with dimensions', () => {
      const m = new DenseMatrix(3, 4);
      expect(m.rows).toBe(3);
      expect(m.cols).toBe(4);
      expect(m.get(0, 0)).toBe(0);
      expect(m.get(2, 3)).toBe(0);
    });

    it('should create from nested array', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(m.rows).toBe(2);
      expect(m.cols).toBe(3);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(0, 2)).toBe(3);
      expect(m.get(1, 1)).toBe(5);
    });

    it('should create from flat array', () => {
      const m = DenseMatrix.fromFlat(2, 3, [1, 2, 3, 4, 5, 6]);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(0, 2)).toBe(3);
      expect(m.get(1, 0)).toBe(4);
    });

    it('should create from Float64Array', () => {
      const data = new Float64Array([1, 2, 3, 4]);
      const m = new DenseMatrix(2, 2, data);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(4);
    });

    it('should throw on dimension mismatch', () => {
      expect(() => DenseMatrix.fromFlat(2, 3, [1, 2, 3])).toThrow();
    });

    it('should throw on negative dimensions', () => {
      expect(() => new DenseMatrix(-1, 3)).toThrow();
    });
  });

  describe('static factory methods', () => {
    it('should create zeros matrix', () => {
      const m = DenseMatrix.zeros(3, 3);
      expect(m.get(0, 0)).toBe(0);
      expect(m.get(2, 2)).toBe(0);
    });

    it('should create ones matrix', () => {
      const m = DenseMatrix.ones(2, 3);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 2)).toBe(1);
    });

    it('should create identity matrix', () => {
      const m = DenseMatrix.identity(3);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(1);
      expect(m.get(2, 2)).toBe(1);
      expect(m.get(0, 1)).toBe(0);
      expect(m.get(1, 0)).toBe(0);
    });

    it('should create diagonal matrix', () => {
      const m = DenseMatrix.diag([1, 2, 3]);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(1, 1)).toBe(2);
      expect(m.get(2, 2)).toBe(3);
      expect(m.get(0, 1)).toBe(0);
    });

    it('should create filled matrix', () => {
      const m = DenseMatrix.fill(2, 2, 7);
      expect(m.get(0, 0)).toBe(7);
      expect(m.get(1, 1)).toBe(7);
    });

    it('should create random matrix', () => {
      const m = DenseMatrix.random(3, 3);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const v = m.get(i, j);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThan(1);
        }
      }
    });
  });

  describe('properties', () => {
    it('should report size correctly', () => {
      const m = DenseMatrix.zeros(3, 4);
      expect(m.size).toEqual({ rows: 3, cols: 4 });
      expect(m.length).toBe(12);
    });

    it('should detect square matrices', () => {
      expect(DenseMatrix.zeros(3, 3).isSquare).toBe(true);
      expect(DenseMatrix.zeros(3, 4).isSquare).toBe(false);
    });

    it('should detect vectors', () => {
      expect(DenseMatrix.zeros(1, 5).isRowVector).toBe(true);
      expect(DenseMatrix.zeros(5, 1).isColumnVector).toBe(true);
      expect(DenseMatrix.zeros(1, 5).isVector).toBe(true);
      expect(DenseMatrix.zeros(5, 1).isVector).toBe(true);
      expect(DenseMatrix.zeros(3, 3).isVector).toBe(false);
    });
  });

  describe('element access', () => {
    it('should get elements with O(1) access', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(m.get(0, 0)).toBe(1);
      expect(m.get(0, 2)).toBe(3);
      expect(m.get(1, 1)).toBe(5);
    });

    it('should throw on out of bounds access', () => {
      const m = DenseMatrix.zeros(3, 3);
      expect(() => m.get(-1, 0)).toThrow(RangeError);
      expect(() => m.get(0, 3)).toThrow(RangeError);
      expect(() => m.get(3, 0)).toThrow(RangeError);
    });

    it('should set elements immutably', () => {
      const m1 = DenseMatrix.zeros(2, 2);
      const m2 = m1.set(0, 0, 5);

      expect(m1.get(0, 0)).toBe(0); // Original unchanged
      expect(m2.get(0, 0)).toBe(5); // New matrix has value
    });
  });

  describe('row and column access', () => {
    it('should extract row as view', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);

      const row = m.row(1);
      expect(row.rows).toBe(1);
      expect(row.cols).toBe(3);
      expect(row.get(0, 0)).toBe(4);
      expect(row.get(0, 1)).toBe(5);
      expect(row.get(0, 2)).toBe(6);
    });

    it('should extract column', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);

      const col = m.column(1);
      expect(col.rows).toBe(3);
      expect(col.cols).toBe(1);
      expect(col.get(0, 0)).toBe(2);
      expect(col.get(1, 0)).toBe(5);
      expect(col.get(2, 0)).toBe(8);
    });

    it('should throw on invalid row/column index', () => {
      const m = DenseMatrix.zeros(3, 3);
      expect(() => m.row(-1)).toThrow(RangeError);
      expect(() => m.row(3)).toThrow(RangeError);
      expect(() => m.column(-1)).toThrow(RangeError);
      expect(() => m.column(3)).toThrow(RangeError);
    });
  });

  describe('slicing', () => {
    it('should slice submatrix', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
      ]);

      const sub = m.slice({ rowStart: 0, rowEnd: 2, colStart: 1, colEnd: 3 });
      expect(sub.rows).toBe(2);
      expect(sub.cols).toBe(2);
      expect(sub.get(0, 0)).toBe(2);
      expect(sub.get(0, 1)).toBe(3);
      expect(sub.get(1, 0)).toBe(6);
      expect(sub.get(1, 1)).toBe(7);
    });

    it('should use defaults for missing slice params', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const sub = m.slice({ rowEnd: 1 });
      expect(sub.rows).toBe(1);
      expect(sub.cols).toBe(3);
    });

    it('should extract diagonal', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);

      const diag = m.diagonal();
      expect(diag.length).toBe(3);
      expect(diag.get(0, 0)).toBe(1);
      expect(diag.get(1, 0)).toBe(5);
      expect(diag.get(2, 0)).toBe(9);
    });

    it('should extract off-diagonal', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);

      const superDiag = m.diagonal(1);
      expect(superDiag.length).toBe(2);
      expect(superDiag.get(0, 0)).toBe(2);
      expect(superDiag.get(1, 0)).toBe(6);

      const subDiag = m.diagonal(-1);
      expect(subDiag.length).toBe(2);
      expect(subDiag.get(0, 0)).toBe(4);
      expect(subDiag.get(1, 0)).toBe(8);
    });
  });

  describe('arithmetic operations', () => {
    it('should add matrices', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);

      const c = a.add(b);
      expect(c.get(0, 0)).toBe(6);
      expect(c.get(0, 1)).toBe(8);
      expect(c.get(1, 0)).toBe(10);
      expect(c.get(1, 1)).toBe(12);
    });

    it('should subtract matrices', () => {
      const a = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);
      const b = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const c = a.subtract(b);
      expect(c.get(0, 0)).toBe(4);
      expect(c.get(0, 1)).toBe(4);
      expect(c.get(1, 0)).toBe(4);
      expect(c.get(1, 1)).toBe(4);
    });

    it('should multiply element-wise', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [2, 3],
        [4, 5],
      ]);

      const c = a.multiplyElementwise(b);
      expect(c.get(0, 0)).toBe(2);
      expect(c.get(0, 1)).toBe(6);
      expect(c.get(1, 0)).toBe(12);
      expect(c.get(1, 1)).toBe(20);
    });

    it('should multiply matrices', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);

      const c = a.multiply(b);
      expect(c.get(0, 0)).toBe(19); // 1*5 + 2*7
      expect(c.get(0, 1)).toBe(22); // 1*6 + 2*8
      expect(c.get(1, 0)).toBe(43); // 3*5 + 4*7
      expect(c.get(1, 1)).toBe(50); // 3*6 + 4*8
    });

    it('should multiply non-square matrices', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]); // 2×3

      const b = DenseMatrix.fromArray([
        [7, 8],
        [9, 10],
        [11, 12],
      ]); // 3×2

      const c = a.multiply(b); // 2×2
      expect(c.rows).toBe(2);
      expect(c.cols).toBe(2);
      expect(c.get(0, 0)).toBe(58); // 1*7 + 2*9 + 3*11
      expect(c.get(0, 1)).toBe(64); // 1*8 + 2*10 + 3*12
    });

    it('should throw on dimension mismatch', () => {
      const a = DenseMatrix.zeros(2, 3);
      const b = DenseMatrix.zeros(2, 2);

      expect(() => a.add(b)).toThrow();
      expect(() => a.multiply(b)).toThrow();
    });

    it('should scale by scalar', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const scaled = m.scale(2);
      expect(scaled.get(0, 0)).toBe(2);
      expect(scaled.get(0, 1)).toBe(4);
      expect(scaled.get(1, 0)).toBe(6);
      expect(scaled.get(1, 1)).toBe(8);
    });

    it('should transpose matrix', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const t = m.transpose();
      expect(t.rows).toBe(3);
      expect(t.cols).toBe(2);
      expect(t.get(0, 0)).toBe(1);
      expect(t.get(1, 0)).toBe(2);
      expect(t.get(2, 0)).toBe(3);
      expect(t.get(0, 1)).toBe(4);
    });

    it('should negate matrix', () => {
      const m = DenseMatrix.fromArray([
        [1, -2],
        [-3, 4],
      ]);

      const neg = m.negate();
      expect(neg.get(0, 0)).toBe(-1);
      expect(neg.get(0, 1)).toBe(2);
      expect(neg.get(1, 0)).toBe(3);
      expect(neg.get(1, 1)).toBe(-4);
    });
  });

  describe('reduction operations', () => {
    it('should compute sum', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      expect(m.sum()).toBe(10);
    });

    it('should compute mean', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      expect(m.mean()).toBe(2.5);
    });

    it('should compute min', () => {
      const m = DenseMatrix.fromArray([
        [3, 1],
        [4, 2],
      ]);
      expect(m.min()).toBe(1);
    });

    it('should compute max', () => {
      const m = DenseMatrix.fromArray([
        [3, 1],
        [4, 2],
      ]);
      expect(m.max()).toBe(4);
    });

    it('should compute Frobenius norm', () => {
      const m = DenseMatrix.fromArray([
        [3, 4],
      ]);
      expect(m.norm()).toBe(5); // sqrt(9 + 16) = 5
    });

    it('should compute trace', () => {
      const m = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ]);
      expect(m.trace()).toBe(15); // 1 + 5 + 9
    });

    it('should throw trace error for non-square', () => {
      const m = DenseMatrix.zeros(2, 3);
      expect(() => m.trace()).toThrow();
    });
  });

  describe('conversion', () => {
    it('should convert to nested array', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const arr = m.toArray();
      expect(arr).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it('should convert to flat array', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      expect(m.toFlatArray()).toEqual([1, 2, 3, 4]);
    });

    it('should clone matrix', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const c = m.clone();
      expect(c.toArray()).toEqual(m.toArray());

      // Should be independent
      const c2 = c.set(0, 0, 99);
      expect(m.get(0, 0)).toBe(1);
      expect(c2.get(0, 0)).toBe(99);
    });
  });

  describe('iteration', () => {
    it('should iterate over entries', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const entries = Array.from(m.entries());
      expect(entries).toEqual([
        { row: 0, col: 0, value: 1 },
        { row: 0, col: 1, value: 2 },
        { row: 1, col: 0, value: 3 },
        { row: 1, col: 1, value: 4 },
      ]);
    });

    it('should iterate over values', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      expect(Array.from(m.values())).toEqual([1, 2, 3, 4]);
    });

    it('should support for...of', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const values: number[] = [];
      for (const v of m) {
        values.push(v);
      }
      expect(values).toEqual([1, 2, 3, 4]);
    });
  });

  describe('map operations', () => {
    it('should map elements', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const squared = m.map((v) => v * v);
      expect(squared.toArray()).toEqual([
        [1, 4],
        [9, 16],
      ]);
    });

    it('should map with indices', () => {
      const m = DenseMatrix.zeros(2, 2);

      const indexed = m.map((_, r, c) => r * 10 + c);
      expect(indexed.toArray()).toEqual([
        [0, 1],
        [10, 11],
      ]);
    });

    it('should forEach without return', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      let sum = 0;
      m.forEach((v) => {
        sum += v;
      });
      expect(sum).toBe(10);
    });
  });

  describe('equality', () => {
    it('should check equality', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const c = DenseMatrix.fromArray([
        [1, 2],
        [3, 5],
      ]);

      expect(a.equals(b)).toBe(true);
      expect(a.equals(c)).toBe(false);
    });

    it('should check equality with tolerance', () => {
      const a = DenseMatrix.fromArray([[1.0]]);
      const b = DenseMatrix.fromArray([[1.0000001]]);

      expect(a.equals(b)).toBe(false);
      expect(a.equals(b, 1e-6)).toBe(true);
    });

    it('should return false for different dimensions', () => {
      const a = DenseMatrix.zeros(2, 2);
      const b = DenseMatrix.zeros(2, 3);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('should format matrix for display', () => {
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const str = m.toString();
      expect(str).toContain('1');
      expect(str).toContain('4');
      expect(str.split('\n').length).toBe(2);
    });
  });
});

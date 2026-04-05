/**
 * JSBackend Tests
 * @module @danielsimonjr/mathts-matrix/tests/JSBackend
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { JSBackend, jsBackend } from '../src/backends/JSBackend.js';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { backendRegistry } from '../src/backends/Backend.js';

describe('JSBackend', () => {
  let backend: JSBackend;

  beforeAll(() => {
    backend = new JSBackend();
  });

  describe('availability', () => {
    it('should always be available', () => {
      expect(backend.isAvailable()).toBe(true);
    });

    it('should initialize without error', async () => {
      await expect(backend.initialize()).resolves.toBeUndefined();
    });

    it('should have type "js"', () => {
      expect(backend.type).toBe('js');
    });
  });

  describe('element-wise operations', () => {
    it('should add matrices', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);

      const c = backend.add(a, b);
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

      const c = backend.subtract(a, b);
      expect(c.toArray()).toEqual([
        [4, 4],
        [4, 4],
      ]);
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

      const c = backend.multiplyElementwise(a, b);
      expect(c.toArray()).toEqual([
        [2, 6],
        [12, 20],
      ]);
    });

    it('should divide element-wise', () => {
      const a = DenseMatrix.fromArray([
        [4, 9],
        [16, 25],
      ]);
      const b = DenseMatrix.fromArray([
        [2, 3],
        [4, 5],
      ]);

      const c = backend.divideElementwise(a, b);
      expect(c.toArray()).toEqual([
        [2, 3],
        [4, 5],
      ]);
    });

    it('should scale by scalar', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const c = backend.scale(a, 3);
      expect(c.toArray()).toEqual([
        [3, 6],
        [9, 12],
      ]);
    });

    it('should compute absolute value', () => {
      const a = DenseMatrix.fromArray([
        [-1, 2],
        [3, -4],
      ]);

      const c = backend.abs(a);
      expect(c.toArray()).toEqual([
        [1, 2],
        [3, 4],
      ]);
    });

    it('should negate matrix', () => {
      const a = DenseMatrix.fromArray([
        [1, -2],
        [-3, 4],
      ]);

      const c = backend.negate(a);
      expect(c.toArray()).toEqual([
        [-1, 2],
        [3, -4],
      ]);
    });

    it('should throw on dimension mismatch', () => {
      const a = DenseMatrix.zeros(2, 3);
      const b = DenseMatrix.zeros(3, 2);

      expect(() => backend.add(a, b)).toThrow();
      expect(() => backend.subtract(a, b)).toThrow();
      expect(() => backend.multiplyElementwise(a, b)).toThrow();
    });
  });

  describe('matrix multiplication', () => {
    it('should multiply square matrices', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const b = DenseMatrix.fromArray([
        [5, 6],
        [7, 8],
      ]);

      const c = backend.multiply(a, b);
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

      const c = backend.multiply(a, b); // 2×2
      expect(c.rows).toBe(2);
      expect(c.cols).toBe(2);
      expect(c.get(0, 0)).toBe(58); // 1*7 + 2*9 + 3*11
      expect(c.get(0, 1)).toBe(64); // 1*8 + 2*10 + 3*12
    });

    it('should compute vector-matrix multiplication', () => {
      const v = DenseMatrix.fromArray([[1, 2, 3]]); // 1×3 row vector
      const m = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
        [5, 6],
      ]); // 3×2

      const result = backend.multiply(v, m);
      expect(result.rows).toBe(1);
      expect(result.cols).toBe(2);
      expect(result.get(0, 0)).toBe(22); // 1*1 + 2*3 + 3*5
      expect(result.get(0, 1)).toBe(28); // 1*2 + 2*4 + 3*6
    });

    it('should throw on incompatible dimensions', () => {
      const a = DenseMatrix.zeros(2, 3);
      const b = DenseMatrix.zeros(2, 3);

      expect(() => backend.multiply(a, b)).toThrow();
    });

    it('should handle identity multiplication', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      const i = DenseMatrix.identity(2);

      const ai = backend.multiply(a, i);
      const ia = backend.multiply(i, a);

      expect(ai.equals(a)).toBe(true);
      expect(ia.equals(a)).toBe(true);
    });
  });

  describe('transpose', () => {
    it('should transpose square matrix', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);

      const t = backend.transpose(a);
      expect(t.toArray()).toEqual([
        [1, 3],
        [2, 4],
      ]);
    });

    it('should transpose rectangular matrix', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const t = backend.transpose(a);
      expect(t.rows).toBe(3);
      expect(t.cols).toBe(2);
      expect(t.toArray()).toEqual([
        [1, 4],
        [2, 5],
        [3, 6],
      ]);
    });

    it('should be its own inverse', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const tt = backend.transpose(backend.transpose(a));
      expect(tt.equals(a)).toBe(true);
    });
  });

  describe('reduction operations', () => {
    it('should compute sum', () => {
      const a = DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ]);
      expect(backend.sum(a)).toBe(10);
    });

    it('should sum along axis 0 (columns)', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const colSums = backend.sumAxis(a, 0);
      expect(colSums.rows).toBe(1);
      expect(colSums.cols).toBe(3);
      expect(colSums.toFlatArray()).toEqual([5, 7, 9]);
    });

    it('should sum along axis 1 (rows)', () => {
      const a = DenseMatrix.fromArray([
        [1, 2, 3],
        [4, 5, 6],
      ]);

      const rowSums = backend.sumAxis(a, 1);
      expect(rowSums.rows).toBe(2);
      expect(rowSums.cols).toBe(1);
      expect(rowSums.toFlatArray()).toEqual([6, 15]);
    });

    it('should compute Frobenius norm', () => {
      const a = DenseMatrix.fromArray([
        [3, 4],
      ]);
      expect(backend.norm(a)).toBe(5); // sqrt(9 + 16)
    });

    it('should compute dot product of row vectors', () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[4, 5, 6]]);

      expect(backend.dot(a, b)).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('should compute dot product of column vectors', () => {
      const a = DenseMatrix.fromArray([[1], [2], [3]]);
      const b = DenseMatrix.fromArray([[4], [5], [6]]);

      expect(backend.dot(a, b)).toBe(32);
    });

    it('should throw on non-vector dot product', () => {
      const a = DenseMatrix.zeros(2, 2);
      const b = DenseMatrix.zeros(2, 2);

      expect(() => backend.dot(a, b)).toThrow();
    });

    it('should throw on mismatched vector lengths', () => {
      const a = DenseMatrix.fromArray([[1, 2, 3]]);
      const b = DenseMatrix.fromArray([[1, 2]]);

      expect(() => backend.dot(a, b)).toThrow();
    });
  });

  describe('backend registry', () => {
    beforeAll(() => {
      // Manually register JS backend for tests (normally done via index.ts import)
      backendRegistry.register(jsBackend);
    });

    it('should have JS backend registered', () => {
      expect(backendRegistry.has('js')).toBe(true);
    });

    it('should return JS backend', () => {
      expect(backendRegistry.get('js')).toBe(jsBackend);
    });

    it('should select JS backend for small matrices', () => {
      const selected = backendRegistry.selectBackend(100);
      expect(selected.type).toBe('js');
    });
  });

  describe('numerical accuracy', () => {
    it('should handle large matrix multiplication', () => {
      const n = 50;
      const a = DenseMatrix.random(n, n);
      const i = DenseMatrix.identity(n);

      const ai = backend.multiply(a, i);
      expect(ai.equals(a, 1e-10)).toBe(true);
    });

    it('should maintain numerical stability', () => {
      // Test with numbers that could cause floating point issues
      const a = DenseMatrix.fromArray([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      const b = DenseMatrix.fromArray([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);

      const c = backend.add(a, b);
      expect(c.get(0, 0)).toBeCloseTo(0.2, 10);
      expect(c.get(1, 1)).toBeCloseTo(0.8, 10);
    });

    it('should handle very small values', () => {
      const a = DenseMatrix.fromArray([[1e-15]]);
      const b = DenseMatrix.fromArray([[1e-15]]);

      const c = backend.multiply(a, b);
      expect(c.get(0, 0)).toBeCloseTo(1e-30, 35);
    });

    it('should handle very large values', () => {
      const a = DenseMatrix.fromArray([[1e15]]);
      const b = DenseMatrix.fromArray([[2]]);

      const c = backend.multiply(a, b);
      expect(c.get(0, 0)).toBe(2e15);
    });
  });
});

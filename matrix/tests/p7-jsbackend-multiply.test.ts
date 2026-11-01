/**
 * P7-8 pins: flat-storage JSBackend.multiply, including 0 × Infinity.
 */
import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { jsBackend } from '../src/backends/JSBackend.js';

describe('P7-8 JSBackend.multiply flat reads', () => {
  it('3×2 by 2×2 golden', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    const B = DenseMatrix.fromArray([
      [7, 8],
      [9, 10],
    ]);
    const C = jsBackend.multiply(A, B);
    expect(C.toArray()).toEqual([
      [25, 28],
      [57, 64],
      [89, 100],
    ]);
  });

  it('0 × Infinity is NaN (IEEE; the loop does not skip zeros)', () => {
    const A = DenseMatrix.fromArray([[0, 1]]);
    const B = DenseMatrix.fromArray([[Infinity], [2]]);
    const C = jsBackend.multiply(A, B);
    expect(Number.isNaN(C.get(0, 0))).toBe(true);
  });

  it('dimension mismatch throws', () => {
    const A = DenseMatrix.fromArray([[1, 2]]);
    const B = DenseMatrix.fromArray([[3], [4], [5]]);
    expect(() => jsBackend.multiply(A, B)).toThrow();
  });
});

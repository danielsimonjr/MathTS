/**
 * Coverage-gap tests for the compat shims.
 *
 * Each test targets a real, previously-untested branch in `compat/src/shims.ts`
 * and asserts the mathjs-compatible behaviour (pass-through identity, empty
 * constructors, determinant edge cases, matrix-object `size`). These are
 * behavioural assertions, not coverage stunts.
 */

import { describe, it, expect } from 'vitest';
import {
  fraction,
  bignumber,
  matrix,
  sparse,
  det,
  size,
  Fraction,
  BigNumber,
  DenseMatrix,
  SparseMatrix,
} from '../src/index.js';

describe('factory pass-through (mathjs returns the same instance)', () => {
  it('fraction() returns the same Fraction instance unchanged', () => {
    const original = new Fraction(3, 7);
    const f = fraction(original);
    expect(f).toBe(original);
    expect(f.numerator).toBe(3n);
    expect(f.denominator).toBe(7n);
  });

  it('bignumber() returns the same BigNumber instance unchanged', () => {
    const original = BigNumber.fromNumber(123);
    const bn = bignumber(original);
    expect(bn).toBe(original);
    expect(bn.valueOf()).toBe(123);
  });

  it('matrix() passes a DenseMatrix instance through unchanged', () => {
    const original = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
    ]);
    const m = matrix(original);
    expect(m).toBe(original);
  });

  it('matrix() passes a SparseMatrix instance through unchanged', () => {
    const original = SparseMatrix.fromDense(
      DenseMatrix.fromArray([
        [1, 0],
        [0, 4],
      ])
    );
    const m = matrix(original);
    expect(m).toBe(original);
  });
});

describe('empty constructors (mathjs returns an empty matrix)', () => {
  it('sparse() with no data returns an empty SparseMatrix', () => {
    const s = sparse();
    expect(s).toBeInstanceOf(SparseMatrix);
    expect(s.rows).toBe(0);
    expect(s.cols).toBe(0);
  });
});

describe('det() remaining branches', () => {
  it('returns 1 for the 0x0 (empty) matrix', () => {
    // det of the empty matrix is the empty product = 1 (matches mathjs).
    expect(det(DenseMatrix.zeros(0, 0))).toBe(1);
  });

  it('throws a TypeError when given a SparseMatrix', () => {
    const s = SparseMatrix.fromDense(
      DenseMatrix.fromArray([
        [1, 2],
        [3, 4],
      ])
    );
    expect(() => det(s as unknown as DenseMatrix)).toThrow(TypeError);
    expect(() => det(s as unknown as DenseMatrix)).toThrow(
      'Expected DenseMatrix or 2D array'
    );
  });

  it('returns 0 for a 4x4 singular matrix (LU pivot underflow path)', () => {
    // Rows 3 and 4 are identical => rank-deficient => determinant 0.
    // 4x4 forces the LU code path (n > 3) and the maxVal < 1e-12 short-circuit.
    const d = det([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [9, 10, 11, 12],
    ]);
    expect(d).toBe(0);
  });
});

describe('size() on matrix objects (not arrays)', () => {
  it('returns [rows, cols] for a DenseMatrix', () => {
    const m = DenseMatrix.zeros(2, 5);
    expect(size(m)).toEqual([2, 5]);
  });

  it('returns [rows, cols] for a SparseMatrix', () => {
    const s = SparseMatrix.zeros(3, 4);
    expect(size(s)).toEqual([3, 4]);
  });
});

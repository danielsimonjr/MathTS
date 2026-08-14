/**
 * Tests for matrix/src/operations/qr-family.ts
 *
 * Verifies the properties of LQ, RQ, and QL decompositions:
 *   - A = L·Q, A = R·Q, A = Q·L
 *   - L is lower-triangular, R is upper-triangular
 *   - Q has orthonormal rows (for LQ, RQ) or orthonormal columns (for QL)
 */

import { describe, it, expect } from 'vitest';
import { lq, rq, ql } from '../../src/operations/qr-family.js';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';

/** Multiply two DenseMatrices and return a plain 2D array. */
function mul(a: DenseMatrix, b: DenseMatrix): number[][] {
  return a.multiply(b).toArray();
}

/** Assert that two 2D arrays match within tolerance. */
function expectClose(got: number[][], want: number[][]): void {
  expect(got.length).toBe(want.length);
  for (let i = 0; i < got.length; i++) {
    expect(got[i].length).toBe(want[i].length);
    for (let j = 0; j < got[i].length; j++) {
      expect(got[i][j]).toBeCloseTo(want[i][j], 9);
    }
  }
}

/** Verify Qᵀ·Q = I_k. */
function expectOrthonormalColumns(Q: DenseMatrix): void {
  const qtq = Q.transpose().multiply(Q).toArray();
  const k = qtq.length;
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      expect(qtq[i][j]).toBeCloseTo(i === j ? 1 : 0, 8);
    }
  }
}

/** Verify Q·Qᵀ = I_k. */
function expectOrthonormalRows(Q: DenseMatrix): void {
  expectOrthonormalColumns(Q.transpose());
}

/** Verify R is upper trapezoidal (entries below the main diagonal in its "square" part are zero). */
function expectUpperTriangular(R: DenseMatrix, tol = 1e-9): void {
  const r = R.toArray();
  const m = R.rows;
  const n = R.cols;
  for (let i = 0; i < r.length; i++) {
    const startJ = 0;
    const endJ = Math.min(r[i].length, i - Math.max(0, m - n));
    for (let j = startJ; j < endJ; j++) {
      expect(Math.abs(r[i][j])).toBeLessThan(tol);
    }
  }
}

/** Verify L is lower trapezoidal (entries above the main diagonal in its "square" part are zero). */
function expectLowerTriangular(L: DenseMatrix, tol = 1e-9): void {
  const l = L.toArray();
  const m = L.rows;
  const n = L.cols;
  for (let i = 0; i < l.length; i++) {
    for (let j = i + Math.max(0, n - m) + 1; j < l[i].length; j++) {
      expect(Math.abs(l[i][j])).toBeLessThan(tol);
    }
  }
}

describe('rq', () => {
  it('handles a square matrix', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { R, Q } = rq(A);
    expectClose(mul(R, Q), A.toArray());
    expectUpperTriangular(R);
    expectOrthonormalRows(Q);
  });

  it('handles a tall matrix (m > n)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const { R, Q } = rq(A);
    expectClose(mul(R, Q), A.toArray());
    expectUpperTriangular(R);
    expectOrthonormalRows(Q);
  });

  it('handles a wide matrix (m < n)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { R, Q } = rq(A);
    expectClose(mul(R, Q), A.toArray());
    expectUpperTriangular(R);
    expectOrthonormalRows(Q);
  });
});

describe('lq', () => {
  it('handles a square matrix', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { L, Q } = lq(A);
    expectClose(mul(L, Q), A.toArray());
    expectLowerTriangular(L);
    expectOrthonormalRows(Q);
  });

  it('handles a tall matrix (m > n)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const { L, Q } = lq(A);
    expectClose(mul(L, Q), A.toArray());
    expectLowerTriangular(L);
    expectOrthonormalRows(Q);
  });

  it('handles a wide matrix (m < n)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { L, Q } = lq(A);
    expectClose(mul(L, Q), A.toArray());
    expectLowerTriangular(L);
    expectOrthonormalRows(Q);
  });
});

describe('ql', () => {
  it('handles a square matrix', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { Q, L } = ql(A);
    expectClose(mul(Q, L), A.toArray());
    expectLowerTriangular(L);
    expectOrthonormalColumns(Q);
  });

  it('handles a tall matrix (m > n)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const { Q, L } = ql(A);
    expectClose(mul(Q, L), A.toArray());
    expectLowerTriangular(L);
    expectOrthonormalColumns(Q);
  });

  it('handles a wide matrix (m < n)', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { Q, L } = ql(A);
    expectClose(mul(Q, L), A.toArray());
    expectLowerTriangular(L);
    expectOrthonormalColumns(Q);
  });
});

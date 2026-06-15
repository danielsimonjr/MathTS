/**
 * Tests for matrix/src/operations/qr.ts
 *
 * Classical Gram-Schmidt QR with re-orthogonalisation. We verify the two
 * defining properties on both 'reduced' and 'full' modes:
 *   - A = Q · R  (reconstruction)
 *   - Qᵀ · Q = I (orthonormal columns)
 *   - R is upper-triangular
 * plus the degenerate (empty / rank-deficient) edge cases that exercise the
 * fallback branches.
 */

import { describe, it, expect } from 'vitest';
import { qr } from '../../src/operations/qr.js';
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

/** Verify R is upper-triangular (entries below the diagonal are ~0). */
function expectUpperTriangular(R: DenseMatrix, tol = 1e-9): void {
  const r = R.toArray();
  for (let i = 0; i < r.length; i++) {
    for (let j = 0; j < Math.min(i, r[i].length); j++) {
      expect(Math.abs(r[i][j])).toBeLessThan(tol);
    }
  }
}

describe('qr — reduced (thin) mode', () => {
  it('reconstructs a square full-rank matrix: A = Q·R', () => {
    const A = DenseMatrix.fromArray([
      [12, -51, 4],
      [6, 167, -68],
      [-4, 24, -41],
    ]);
    const { Q, R } = qr(A);
    expect(Q.rows).toBe(3);
    expect(Q.cols).toBe(3);
    expect(R.rows).toBe(3);
    expect(R.cols).toBe(3);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
    expectUpperTriangular(R);
  });

  it('reconstructs a tall matrix (m > n): Q is m×n, R is n×n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    const { Q, R } = qr(A);
    expect(Q.rows).toBe(4);
    expect(Q.cols).toBe(2);
    expect(R.rows).toBe(2);
    expect(R.cols).toBe(2);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
    expectUpperTriangular(R);
  });

  it('reconstructs a wide matrix (m < n): Q is m×m, R is m×n', () => {
    const A = DenseMatrix.fromArray([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    const { Q, R } = qr(A);
    expect(Q.rows).toBe(2);
    expect(Q.cols).toBe(2);
    expect(R.rows).toBe(2);
    expect(R.cols).toBe(4);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
    expectUpperTriangular(R);
  });

  it('handles a 1×1 matrix', () => {
    const A = DenseMatrix.fromArray([[5]]);
    const { Q, R } = qr(A);
    expectClose(mul(Q, R), [[5]]);
    expect(Q.get(0, 0)).toBeCloseTo(1);
    expect(R.get(0, 0)).toBeCloseTo(5);
  });

  it('produces a positive R diagonal for an identity matrix', () => {
    const A = DenseMatrix.identity(4);
    const { Q, R } = qr(A);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
  });
});

describe('qr — full mode', () => {
  it('returns a square Q (m×m) for a tall matrix and reconstructs A', () => {
    const A = DenseMatrix.fromArray([
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    const { Q, R } = qr(A, { mode: 'full' });
    expect(Q.rows).toBe(3);
    expect(Q.cols).toBe(3);
    expect(R.rows).toBe(3);
    expect(R.cols).toBe(2);
    expectClose(mul(Q, R), A.toArray());
    // Q is fully orthogonal (Qᵀ·Q = I_3).
    expectOrthonormalColumns(Q);
    expectUpperTriangular(R);
  });

  it('full mode on a square matrix equals reduced reconstruction', () => {
    const A = DenseMatrix.fromArray([
      [2, -2, 18],
      [2, 1, 0],
      [1, 2, 0],
    ]);
    const { Q, R } = qr(A, { mode: 'full' });
    expect(Q.cols).toBe(3);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
  });
});

describe('qr — degenerate / edge cases', () => {
  it('handles a zero-row matrix (m=0) in reduced mode', () => {
    const A = new DenseMatrix(0, 3, new Float64Array(0));
    const { Q, R } = qr(A);
    expect(Q.rows).toBe(0);
    expect(R.rows).toBe(0);
    expect(R.cols).toBe(3);
  });

  it('handles a zero-column matrix (n=0) in reduced mode', () => {
    const A = new DenseMatrix(3, 0, new Float64Array(0));
    const { Q, R } = qr(A);
    expect(Q.rows).toBe(3);
    expect(Q.cols).toBe(0);
    expect(R.cols).toBe(0);
  });

  it('handles an empty matrix in full mode (returns identity Q)', () => {
    const A = new DenseMatrix(0, 0, new Float64Array(0));
    const { Q, R } = qr(A, { mode: 'full' });
    expect(Q.rows).toBe(0);
    expect(R.rows).toBe(0);
    expect(R.cols).toBe(0);
  });

  it('handles a rank-deficient matrix (duplicate columns) and still reconstructs A', () => {
    // Column 1 == column 0 → rank 1. The rank-deficient branch must produce
    // an orthonormal Q whose product with R still recovers A.
    const A = DenseMatrix.fromArray([
      [1, 1, 0],
      [1, 1, 0],
      [1, 1, 1],
    ]);
    const { Q, R } = qr(A);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
  });

  it('handles a fully zero matrix (every column rank-deficient)', () => {
    const A = DenseMatrix.zeros(3, 3);
    const { Q, R } = qr(A);
    // A is all zeros → Q·R must be all zeros.
    expectClose(mul(Q, R), A.toArray());
    // Q columns are still orthonormal (chosen from the canonical basis).
    expectOrthonormalColumns(Q);
  });

  it('full mode extends Q with orthonormal columns for a rank-deficient tall matrix', () => {
    const A = DenseMatrix.fromArray([
      [1, 1],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    const { Q, R } = qr(A, { mode: 'full' });
    expect(Q.rows).toBe(4);
    expect(Q.cols).toBe(4);
    expectClose(mul(Q, R), A.toArray());
    expectOrthonormalColumns(Q);
  });
});

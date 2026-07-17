/**
 * Oracle regression: linear-algebra extension — rank-revealing pivoted QR,
 * the RQ/QL/LQ decomposition family, and the Hager/Higham `condest` 1-norm
 * condition estimator.
 *
 * Oracle strategy (implementation-independent, per feedback-oracle-tests):
 * conventions for pivoting/sign/ordering vary across libraries, so we never
 * pin raw Q/R/L entries or the exact permutation. Instead we assert the
 * structural properties any correct decomposition must satisfy:
 *   - orthogonality (`Qᵀ·Q = I` or `Q·Qᵀ = I`)
 *   - triangularity (upper/lower, exact zeros where required)
 *   - reconstruction (`A[:, P] = Q·R`, `A = R·Q`, `A = Q·L`, `A = L·Q`)
 *   - rank / non-increasing |diag(R)| (Businger-Golub pivoting property)
 *   - condest bracketed against numpy's exact `cond(A, 1)` and sanity checks
 *     on the identity and a near-singular matrix.
 *
 * numpy/scipy reference values (see task spec):
 *   A = [[1,2,3],[4,5,6],[7,8,10]]
 *   scipy pivoted-QR: |diag R| ≈ [12.04, 1.05, 0.24], column order P=[2,0,1]
 *     (order not asserted — tie-breaking differs across implementations)
 *   numpy.linalg.cond(A, 1) = 133.0
 */
import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../src/types/DenseMatrix.js';
import { qrPivoted } from '../src/operations/qr-pivoted.js';
import { rq, ql, lq } from '../src/operations/qr-family.js';
import { condest } from '../src/operations/condest.js';

const TOL_ORTHO = 1e-10;
const TOL_RECON = 1e-9;

const A = DenseMatrix.fromArray([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 10],
]);

const RANK_DEFICIENT = DenseMatrix.fromArray([
  [1, 2, 3],
  [2, 4, 6], // = 2 * row0
  [1, 0, 1],
]);

/** max_{i,j} |M1[i,j] - M2[i,j]| for equal-shaped DenseMatrix. */
function maxAbsDiff(M1: DenseMatrix, M2: DenseMatrix): number {
  expect(M1.rows).toBe(M2.rows);
  expect(M1.cols).toBe(M2.cols);
  let maxErr = 0;
  for (let i = 0; i < M1.rows; i++) {
    for (let j = 0; j < M1.cols; j++) {
      const err = Math.abs(M1.get(i, j) - M2.get(i, j));
      if (err > maxErr) maxErr = err;
    }
  }
  return maxErr;
}

/** ‖Qᵀ·Q - I‖_max (columns orthonormal). */
function orthoErrorCols(Q: DenseMatrix): number {
  const QtQ = Q.transpose().multiply(Q);
  return maxAbsDiff(QtQ, DenseMatrix.identity(QtQ.rows));
}

/** ‖Q·Qᵀ - I‖_max (rows orthonormal). */
function orthoErrorRows(Q: DenseMatrix): number {
  const QQt = Q.multiply(Q.transpose());
  return maxAbsDiff(QQt, DenseMatrix.identity(QQt.rows));
}

/** True iff M[i,j] == 0 (exactly) for all j < i (strictly upper-triangular check). */
function isUpperTriangular(M: DenseMatrix): boolean {
  for (let i = 0; i < M.rows; i++) {
    for (let j = 0; j < Math.min(i, M.cols); j++) {
      if (M.get(i, j) !== 0) return false;
    }
  }
  return true;
}

/** True iff M[i,j] == 0 (exactly) for all j > i (strictly lower-triangular check). */
function isLowerTriangular(M: DenseMatrix): boolean {
  for (let i = 0; i < M.rows; i++) {
    for (let j = i + 1; j < M.cols; j++) {
      if (M.get(i, j) !== 0) return false;
    }
  }
  return true;
}

/** Permute the columns of `A` according to index array `P`: result[:, j] = A[:, P[j]]. */
function permuteColumns(M: DenseMatrix, P: number[]): DenseMatrix {
  const data = new Float64Array(M.rows * M.cols);
  for (let i = 0; i < M.rows; i++) {
    for (let j = 0; j < M.cols; j++) {
      data[i * M.cols + j] = M.get(i, P[j]);
    }
  }
  return new DenseMatrix(M.rows, M.cols, data);
}

describe('qrPivoted (rank-revealing column-pivoted QR)', () => {
  it('Q is orthonormal (Qᵀ·Q = I)', () => {
    const { Q } = qrPivoted(A);
    expect(orthoErrorCols(Q)).toBeLessThan(TOL_ORTHO);
  });

  it('R is upper-triangular', () => {
    const { R } = qrPivoted(A);
    expect(isUpperTriangular(R)).toBe(true);
  });

  it('|diag(R)| is non-increasing', () => {
    const { R } = qrPivoted(A);
    const k = Math.min(R.rows, R.cols);
    const diag = Array.from({ length: k }, (_, i) => Math.abs(R.get(i, i)));
    for (let i = 1; i < diag.length; i++) {
      expect(diag[i]).toBeLessThanOrEqual(diag[i - 1] + 1e-9);
    }
  });

  it('reconstructs A[:, P] = Q · R', () => {
    const { Q, R, P } = qrPivoted(A);
    const reconstructed = Q.multiply(R);
    const permuted = permuteColumns(A, P);
    expect(maxAbsDiff(reconstructed, permuted)).toBeLessThan(TOL_RECON);
  });

  it('detects full rank (rank = 3) for a well-conditioned 3x3', () => {
    const { rank } = qrPivoted(A);
    expect(rank).toBe(3);
  });

  it('detects rank deficiency (rank = 2) when a row is a scalar multiple of another', () => {
    const { rank } = qrPivoted(RANK_DEFICIENT);
    expect(rank).toBe(2);
  });

  it('P is a valid permutation of 0..n-1', () => {
    const { P } = qrPivoted(A);
    expect([...P].sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });
});

describe('rq (A = R · Q)', () => {
  it('R is upper-triangular and Q has orthonormal rows', () => {
    const { R, Q } = rq(A);
    expect(isUpperTriangular(R)).toBe(true);
    expect(orthoErrorRows(Q)).toBeLessThan(TOL_ORTHO);
  });

  it('reconstructs A = R · Q', () => {
    const { R, Q } = rq(A);
    const reconstructed = R.multiply(Q);
    expect(maxAbsDiff(reconstructed, A)).toBeLessThan(TOL_RECON);
  });
});

describe('ql (A = Q · L)', () => {
  it('L is lower-triangular and Q has orthonormal columns', () => {
    const { Q, L } = ql(A);
    expect(isLowerTriangular(L)).toBe(true);
    expect(orthoErrorCols(Q)).toBeLessThan(TOL_ORTHO);
  });

  it('reconstructs A = Q · L', () => {
    const { Q, L } = ql(A);
    const reconstructed = Q.multiply(L);
    expect(maxAbsDiff(reconstructed, A)).toBeLessThan(TOL_RECON);
  });
});

describe('lq (A = L · Q)', () => {
  it('L is lower-triangular and Q has orthonormal rows', () => {
    const { L, Q } = lq(A);
    expect(isLowerTriangular(L)).toBe(true);
    expect(orthoErrorRows(Q)).toBeLessThan(TOL_ORTHO);
  });

  it('reconstructs A = L · Q', () => {
    const { L, Q } = lq(A);
    const reconstructed = L.multiply(Q);
    expect(maxAbsDiff(reconstructed, A)).toBeLessThan(TOL_RECON);
  });
});

describe('rq on a non-square (wide) matrix', () => {
  // RQ's "R is upper-triangular" property only holds top-anchored (R[i,j]=0
  // for j<i) when m <= n (wide/square) — LAPACK's dgerqf documents that for
  // m > n (tall) the triangular block is instead bottom-anchored, shifted
  // down by (m-n) rows (an upper-TRAPEZOIDAL, not upper-triangular, shape).
  // Reduced RQ is naturally well-posed for wide inputs, mirroring how
  // reduced QR is naturally well-posed for tall inputs — so the top-anchored
  // check below is only exercised on a wide matrix here.
  const WIDE = DenseMatrix.fromArray([
    [1, 2, 3],
    [4, 5, 7],
  ]);

  it('rq reconstructs A = R · Q for a wide matrix', () => {
    const { R, Q } = rq(WIDE);
    expect(isUpperTriangular(R)).toBe(true);
    expect(orthoErrorRows(Q)).toBeLessThan(TOL_ORTHO);
    expect(maxAbsDiff(R.multiply(Q), WIDE)).toBeLessThan(TOL_RECON);
  });
});

describe('ql/lq on a non-square (tall) matrix', () => {
  const TALL = DenseMatrix.fromArray([
    [1, 2],
    [3, 4],
    [5, 7],
  ]);

  it('ql reconstructs A = Q · L for a tall matrix', () => {
    const { Q, L } = ql(TALL);
    expect(isLowerTriangular(L)).toBe(true);
    expect(orthoErrorCols(Q)).toBeLessThan(TOL_ORTHO);
    expect(maxAbsDiff(Q.multiply(L), TALL)).toBeLessThan(TOL_RECON);
  });

  it('lq reconstructs A = L · Q for a tall matrix', () => {
    const { L, Q } = lq(TALL);
    expect(isLowerTriangular(L)).toBe(true);
    expect(orthoErrorRows(Q)).toBeLessThan(TOL_ORTHO);
    expect(maxAbsDiff(L.multiply(Q), TALL)).toBeLessThan(TOL_RECON);
  });
});

describe('condest (Hager/Higham 1-norm condition estimate)', () => {
  it('brackets numpy.linalg.cond(A, 1) = 133.0 within a factor of ~3 (lower bound)', () => {
    const estimate = condest(A, 1);
    expect(estimate).toBeGreaterThanOrEqual(44);
    expect(estimate).toBeLessThanOrEqual(133 * 1.05);
  });

  it('condest(I) ≈ 1', () => {
    const estimate = condest(DenseMatrix.identity(4), 1);
    expect(estimate).toBeCloseTo(1, 6);
  });

  it('is large (> 1e6) for a near-singular matrix', () => {
    const nearSingular = DenseMatrix.fromArray([
      [1, 1],
      [1, 1 + 1e-8],
    ]);
    expect(condest(nearSingular, 1)).toBeGreaterThan(1e6);
  });

  it('defaults p to 1', () => {
    expect(condest(A)).toBeCloseTo(condest(A, 1), 10);
  });

  it('throws for non-square input', () => {
    const rect = DenseMatrix.fromArray([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(() => condest(rect)).toThrow();
  });

  it('throws for unsupported p', () => {
    expect(() => condest(A, 2)).toThrow();
  });
});

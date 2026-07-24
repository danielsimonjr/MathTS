/**
 * Rank-Revealing Pivoted QR Decomposition (Businger-Golub column pivoting)
 *
 * Computes `A[:, P] = Q · R` via Householder reflections, choosing at each
 * step the remaining column of largest norm as the next pivot. This is the
 * classical column-pivoted QR (LAPACK `dgeqp3`'s algorithm, simplified —
 * exact remaining-column-norm recomputation rather than the cheaper
 * downdating formula, since these matrices are small): it guarantees
 * `|R[0,0]| ≥ |R[1,1]| ≥ … ≥ |R[k-1,k-1]|`, which makes `R`'s diagonal a
 * reliable numerical-rank indicator — unlike the plain (unpivoted)
 * Gram-Schmidt `qr()` in this directory, whose diagonal can be small for an
 * early column purely by column order, not by rank deficiency.
 *
 * Reuses the Householder helpers in `./common.js` (already exercised by
 * `svd.ts`/`schur.ts`) rather than re-deriving reflection algebra here.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { eye, householder, applyHouseholderLeft, applyHouseholderRight } from './common.js';

export interface QRPivotedResult {
  /** Orthonormal Q factor (m × k, k = min(m, n)). */
  Q: DenseMatrix;
  /** Upper-triangular R factor (k × n) with |diag(R)| non-increasing. */
  R: DenseMatrix;
  /** Column permutation: `P[j]` is the original column index now at position `j`, so `A[:, P] = Q · R`. */
  P: number[];
  /** Numerical rank: count of `i` with `|R[i,i]| > tolerance · |R[0,0]|`. */
  rank: number;
}

export interface QRPivotedOptions {
  /** Relative rank tolerance (default `1e-10`). */
  tolerance?: number;
}

/**
 * Compute the column-pivoted rank-revealing QR decomposition of `A`.
 *
 * @param A    - Input matrix (m × n).
 * @param opts - Optional rank tolerance.
 */
export function qrPivoted(A: DenseMatrix, opts?: QRPivotedOptions): QRPivotedResult {
  const m = A.rows;
  const n = A.cols;
  const tol = opts?.tolerance ?? 1e-10;
  const k = Math.min(m, n);

  if (m === 0 || n === 0) {
    return {
      Q: DenseMatrix.identity(m),
      R: DenseMatrix.zeros(k, n),
      P: Array.from({ length: n }, (_, i) => i),
      rank: 0,
    };
  }

  // Working copy (row-major number[][], mirrors A's contents).
  const W = A.toArray();
  // Accumulates Q = H_0 · H_1 · … · H_{k-1} (product of Householder reflectors).
  const Qacc = eye(m);
  const perm = Array.from({ length: n }, (_, i) => i);

  const colNormSq = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += W[i][j] * W[i][j];
    colNormSq[j] = s;
  }

  for (let c = 0; c < k; c++) {
    // --- Pivot: bring the remaining column of largest norm to position c ---
    let pivotCol = c;
    let maxNorm = colNormSq[c];
    for (let j = c + 1; j < n; j++) {
      if (colNormSq[j] > maxNorm) {
        maxNorm = colNormSq[j];
        pivotCol = j;
      }
    }
    if (pivotCol !== c) {
      for (let i = 0; i < m; i++) {
        const t = W[i][c];
        W[i][c] = W[i][pivotCol];
        W[i][pivotCol] = t;
      }
      const tn = colNormSq[c];
      colNormSq[c] = colNormSq[pivotCol];
      colNormSq[pivotCol] = tn;
      const tp = perm[c];
      perm[c] = perm[pivotCol];
      perm[pivotCol] = tp;
    }

    // --- Householder reflection zeroing W[c+1..m-1][c] ---
    const col: number[] = [];
    for (let i = c; i < m; i++) col.push(W[i][c]);
    // degenerateBeta=2: for a column already antiparallel to e_1 (sigma===0,
    // x[0]<0), the only valid *orthogonal* reflection is H = I - 2·e1·e1ᵀ
    // (beta ∈ {0, 2} are the sole solutions to (1-beta)² = 1). The shared
    // helper's default (-2, tuned for eig/svd's degenerate-branch usage,
    // which never triggers it on a length-1 sub-column) is NOT orthogonal
    // here — a length-1 sub-column is exactly this degenerate case, and it
    // is reached on this algorithm's last pivot step whenever that trailing
    // diagonal entry is negative.
    const { v, beta } = householder(col, 2);
    if (beta !== 0) {
      applyHouseholderLeft(W, v, beta, c, c);
      applyHouseholderRight(Qacc, v, beta, 0, c);
    }

    // --- Recompute remaining column norms from the (now partially
    //     triangularized) working copy, restricted to rows c+1..m-1 ---
    for (let j = c + 1; j < n; j++) {
      let s = 0;
      for (let i = c + 1; i < m; i++) s += W[i][j] * W[i][j];
      colNormSq[j] = s;
    }
  }

  // Clean up sub-diagonal floating-point noise left by the reflections.
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < Math.min(i, n); j++) {
      W[i][j] = 0;
    }
  }

  const rData = new Float64Array(k * n);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < n; j++) rData[i * n + j] = W[i][j];
  }

  const qData = new Float64Array(m * k);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < k; j++) qData[i * k + j] = Qacc[i][j];
  }

  const r00 = Math.abs(rData[0] ?? 0);
  let rank = 0;
  if (r00 > 0) {
    for (let i = 0; i < k; i++) {
      if (Math.abs(rData[i * n + i]) > tol * r00) rank++;
    }
  }

  return {
    Q: new DenseMatrix(m, k, qData),
    R: new DenseMatrix(k, n, rData),
    P: perm,
    rank,
  };
}

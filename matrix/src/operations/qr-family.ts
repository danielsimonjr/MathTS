/**
 * QR-family decompositions: LQ, RQ, QL
 *
 * Each is derived from the existing Gram-Schmidt `qr()` primitive in this
 * directory via the standard flip/transpose reductions (Golub & Van Loan,
 * *Matrix Computations*, §5.2):
 *
 *   - **LQ** (`A = L·Q`, L lower-triangular): `qr(Aᵀ)` transposed — no flips
 *     needed. If `Aᵀ = Q₁·R₁` then `A = R₁ᵀ·Q₁ᵀ`, so `L = R₁ᵀ`, `Q = Q₁ᵀ`.
 *   - **RQ** (`A = R·Q`, R upper-triangular): reverse `A`'s row order,
 *     transpose, run `qr()`, then un-flip the resulting factors.
 *   - **QL** (`A = Q·L`, L lower-triangular): reverse `A`'s column order,
 *     run `qr()`, then un-flip the resulting factors.
 *
 * All three share `qr()`'s reduced-QR convention: for an m×n input the thin
 * factor pairing is (m×k, k×n) with k = min(m, n).
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { qr } from './qr.js';

export interface LQResult {
  /** Lower-triangular (trapezoidal) factor. m × k, k = min(m, n). */
  L: DenseMatrix;
  /** Orthonormal-row factor (Q · Qᵀ = I). k × n. */
  Q: DenseMatrix;
}

export interface RQResult {
  /** Upper-triangular (trapezoidal) factor. m × k, k = min(m, n). */
  R: DenseMatrix;
  /** Orthonormal-row factor (Q · Qᵀ = I). k × n. */
  Q: DenseMatrix;
}

export interface QLResult {
  /** Orthonormal-column factor (Qᵀ · Q = I). m × k, k = min(m, n). */
  Q: DenseMatrix;
  /** Lower-triangular (trapezoidal) factor. k × n. */
  L: DenseMatrix;
}

/** Reverse the row order of `M`. */
function flipRows(M: DenseMatrix): DenseMatrix {
  const m = M.rows;
  const n = M.cols;
  const src = M.toFloat64Array();
  const data = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      data[i * n + j] = src[(m - 1 - i) * n + j];
    }
  }
  return new DenseMatrix(m, n, data);
}

/** Reverse the column order of `M`. */
function flipCols(M: DenseMatrix): DenseMatrix {
  const m = M.rows;
  const n = M.cols;
  const src = M.toFloat64Array();
  const data = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      data[i * n + j] = src[i * n + (n - 1 - j)];
    }
  }
  return new DenseMatrix(m, n, data);
}

/**
 * LQ decomposition: `A = L · Q` with `L` lower-triangular and `Q` having
 * orthonormal rows (`Q · Qᵀ = I`).
 */
export function lq(A: DenseMatrix): LQResult {
  const { Q: Q1, R: R1 } = qr(A.transpose(), { mode: 'reduced' });
  return { L: R1.transpose(), Q: Q1.transpose() };
}

/**
 * RQ decomposition: `A = R · Q` with `R` upper-triangular and `Q` having
 * orthonormal rows (`Q · Qᵀ = I`).
 */
export function rq(A: DenseMatrix): RQResult {
  const B = flipRows(A).transpose();
  const { Q: Q1, R: R1 } = qr(B, { mode: 'reduced' });
  const R = flipCols(flipRows(R1.transpose()));
  const Q = flipRows(Q1.transpose());
  return { R, Q };
}

/**
 * QL decomposition: `A = Q · L` with `Q` having orthonormal columns
 * (`Qᵀ · Q = I`) and `L` lower-triangular.
 */
export function ql(A: DenseMatrix): QLResult {
  const B = flipCols(A);
  const { Q: Q1, R: R1 } = qr(B, { mode: 'reduced' });
  const L = flipCols(flipRows(R1));
  const Q = flipCols(Q1);
  return { Q, L };
}

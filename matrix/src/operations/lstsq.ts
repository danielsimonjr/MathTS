/**
 * Linear least squares by Householder QR.
 *
 * Solves `min ||A x - b||_2` for an overdetermined or square full-rank `A`
 * (rows >= columns). Each Householder reflection is applied to `A` and to
 * `b` in place, so the factor Q is never formed.
 */

import { decompositionInputToNestedArray, type DecompositionMatrixInput } from './as-packed.js';

/** Machine epsilon for double precision (2^-52). */
const LSTSQ_EPS = 2.220446049250313e-16;

/**
 * Least-squares solution of `A x ≈ b` by Householder QR.
 *
 * @param A - `DenseMatrix`, nested `number[][]`, square `Float64Array`, or `{ data, rows, cols }`.
 *   Must have at least as many rows as columns.
 * @param b - Right-hand side with one entry per row of `A`.
 * @returns The `n`-vector `x` that minimises `||A x - b||_2`.
 * @throws {RangeError} if `A` has fewer rows than columns, if `b` has the wrong length, or if an entry is not finite.
 * @throws {Error} if `A` is rank-deficient (use `pinv` for the minimum-norm solution).
 */
export function lstsq(A: DecompositionMatrixInput, b: readonly number[]): number[] {
  const rows = decompositionInputToNestedArray(A);
  const m = rows.length;
  const n = m === 0 ? 0 : rows[0].length;

  if (m < n) {
    throw new RangeError(
      `lstsq needs rows >= columns (got ${m}x${n}); use pinv for an underdetermined system`
    );
  }
  if (b.length !== m) {
    throw new RangeError(`lstsq: b has length ${b.length}, expected ${m}`);
  }

  // Row-major working copy of A and the right-hand side.
  const R = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    if (rows[i].length !== n) {
      throw new TypeError('lstsq: A must be a rectangular matrix');
    }
    for (let j = 0; j < n; j++) {
      const v = rows[i][j];
      if (!Number.isFinite(v)) throw new RangeError('lstsq: A has a non-finite entry');
      R[i * n + j] = v;
    }
  }
  const y = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    if (!Number.isFinite(b[i])) throw new RangeError('lstsq: b has a non-finite entry');
    y[i] = b[i];
  }

  // Householder reduction: column k is mapped onto alpha * e_k.
  for (let k = 0; k < n; k++) {
    let norm2 = 0;
    for (let i = k; i < m; i++) norm2 += R[i * n + k] * R[i * n + k];
    const norm = Math.sqrt(norm2);
    const alpha = R[k * n + k] > 0 ? -norm : norm;

    const v = new Float64Array(m - k);
    for (let i = k; i < m; i++) v[i - k] = R[i * n + k];
    v[0] -= alpha;

    let vv = 0;
    for (let i = 0; i < v.length; i++) vv += v[i] * v[i];
    if (vv === 0) {
      // Column is already alpha * e_k (or zero): nothing to reflect.
      R[k * n + k] = alpha;
      continue;
    }

    // Apply H = I - 2 v v^T / (v^T v) to the trailing columns and to y.
    for (let j = k; j < n; j++) {
      let s = 0;
      for (let i = k; i < m; i++) s += v[i - k] * R[i * n + j];
      const f = (2 * s) / vv;
      for (let i = k; i < m; i++) R[i * n + j] -= f * v[i - k];
    }
    let sy = 0;
    for (let i = k; i < m; i++) sy += v[i - k] * y[i];
    const fy = (2 * sy) / vv;
    for (let i = k; i < m; i++) y[i] -= fy * v[i - k];
  }

  // Rank check on the diagonal of R, relative to its largest entry.
  let maxDiag = 0;
  for (let k = 0; k < n; k++) maxDiag = Math.max(maxDiag, Math.abs(R[k * n + k]));
  const tol = Math.max(m, n) * LSTSQ_EPS * maxDiag;
  for (let k = 0; k < n; k++) {
    if (!(Math.abs(R[k * n + k]) > tol)) {
      throw new Error(
        'lstsq: matrix is rank-deficient; use pinv(A) * b for the minimum-norm solution'
      );
    }
  }

  // Back substitution on the upper-triangular R.
  const x = new Array<number>(n).fill(0);
  for (let k = n - 1; k >= 0; k--) {
    let s = y[k];
    for (let j = k + 1; j < n; j++) s -= R[k * n + j] * x[j];
    x[k] = s / R[k * n + k];
  }
  return x;
}

/**
 * Condition-number ESTIMATE (Hager/Higham 1-norm power-iteration estimator)
 *
 * Estimates `‖A‖₁ · ‖A⁻¹‖₁` without ever forming `A⁻¹` explicitly — Hager's
 * algorithm (Hager 1984; Higham 1988's practical refinement) needs only the
 * ability to apply `A⁻¹` and `A⁻ᵀ` to a vector, which is done here via the
 * existing `lu()` primitive's triangular factors (forward/back substitution,
 * O(n²) per application vs. O(n³) to form `A⁻¹` or run the SVD-based exact
 * `cond()` in `svd.ts`). The result is an ESTIMATE — typically a lower bound
 * on the true `‖A⁻¹‖₁`, usually within a small constant factor — not the
 * exact value.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { lu } from './lu.js';

/** Solve `A x = b` given `A`'s LU factors (`P · A = L · U`). */
function luSolve(
  L: Float64Array,
  U: Float64Array,
  perm: number[],
  n: number,
  b: number[]
): number[] {
  const pb = new Array<number>(n);
  for (let i = 0; i < n; i++) pb[i] = b[perm[i]];

  // Forward substitution: L y = P·b (L is unit lower-triangular).
  const y = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = pb[i];
    for (let j = 0; j < i; j++) s -= L[i * n + j] * y[j];
    y[i] = s;
  }

  // Back substitution: U x = y (U is upper-triangular).
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= U[i * n + j] * x[j];
    x[i] = s / U[i * n + i];
  }
  return x;
}

/** Solve `Aᵀ x = b` reusing `A`'s LU factors (`P·A = L·U` ⇒ `Aᵀ = Uᵀ·Lᵀ·P`). */
function luSolveTranspose(
  L: Float64Array,
  U: Float64Array,
  perm: number[],
  n: number,
  b: number[]
): number[] {
  // Forward substitution: Uᵀ z = b (lower-triangular).
  const z = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let j = 0; j < i; j++) s -= U[j * n + i] * z[j];
    z[i] = s / U[i * n + i];
  }

  // Back substitution: Lᵀ w = z (unit upper-triangular).
  const w = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = z[i];
    for (let j = i + 1; j < n; j++) s -= L[j * n + i] * w[j];
    w[i] = s;
  }

  // Undo the row permutation: w[i] corresponds to x[perm[i]].
  const x = new Array<number>(n);
  for (let i = 0; i < n; i++) x[perm[i]] = w[i];
  return x;
}

/**
 * Hager's 1-norm power-iteration estimator for `‖B‖₁`, given only the
 * ability to apply `B` and `Bᵀ` to a vector. Converges in a handful of
 * iterations; capped at 5 per Higham's practical guidance.
 */
function hagerNormEstimate(
  applyB: (v: number[]) => number[],
  applyBT: (v: number[]) => number[],
  n: number
): number {
  let x = new Array<number>(n).fill(1 / n);
  let gamma = 0;
  let lastIndex = -1;

  for (let iter = 0; iter < 5; iter++) {
    const y = applyB(x);
    let newGamma = 0;
    for (const v of y) newGamma += Math.abs(v);
    if (iter > 0 && newGamma <= gamma) break;
    gamma = newGamma;

    const xi = y.map((v) => (v >= 0 ? 1 : -1));
    const z = applyBT(xi);

    let maxIndex = 0;
    let maxAbs = Math.abs(z[0]);
    for (let i = 1; i < n; i++) {
      if (Math.abs(z[i]) > maxAbs) {
        maxAbs = Math.abs(z[i]);
        maxIndex = i;
      }
    }
    if (iter > 0 && maxIndex === lastIndex) break;
    lastIndex = maxIndex;

    x = new Array<number>(n).fill(0);
    x[maxIndex] = 1;
  }
  return gamma;
}

/**
 * Estimate the 1-norm condition number `‖A‖₁ · ‖A⁻¹‖₁` of a square matrix.
 *
 * This is an ESTIMATE (Hager/Higham power iteration), not the exact
 * condition number that `cond()` (in `svd.ts`) computes via a full SVD —
 * `condest` is O(n²)-per-iteration and avoids forming `A⁻¹`, at the cost of
 * being a (typically close) lower-bound estimate rather than an exact value.
 *
 * @param A - Square input matrix.
 * @param p - Only the 1-norm (`p = 1`, the default) is currently implemented.
 * @throws {Error} if `A` is not square, or `p !== 1`.
 */
export function condest(A: DenseMatrix, p: number = 1): number {
  if (p !== 1) {
    throw new Error(`condest: only the 1-norm estimator (p=1) is implemented (got p=${p})`);
  }
  const n = A.rows;
  if (A.cols !== n) {
    throw new Error(`condest: matrix must be square (got ${A.rows}×${A.cols})`);
  }
  if (n === 0) return 0;

  // ‖A‖₁ = max absolute column sum.
  const flat = A.toFloat64Array();
  let norm1A = 0;
  for (let j = 0; j < n; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) colSum += Math.abs(flat[i * n + j]);
    if (colSum > norm1A) norm1A = colSum;
  }
  if (norm1A === 0) return 0;

  let L: Float64Array;
  let U: Float64Array;
  let perm: number[];
  try {
    const factors = lu(A);
    L = factors.L.toFloat64Array();
    U = factors.U.toFloat64Array();
    perm = factors.P;
  } catch {
    return Infinity; // exactly singular
  }

  const norm1Inv = hagerNormEstimate(
    (v) => luSolve(L, U, perm, n, v),
    (v) => luSolveTranspose(L, U, perm, n, v),
    n
  );

  return norm1A * norm1Inv;
}

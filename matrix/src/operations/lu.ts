/**
 * LU Decomposition (DenseMatrix primitive)
 *
 * Doolittle's algorithm with partial (row) pivoting. Factorises a square
 * matrix A into P · A = L · U where:
 *   - L is unit lower-triangular (1s on the diagonal).
 *   - U is upper-triangular.
 *   - P is returned as a row-permutation array: P[i] is the original-row
 *     index now at position i after pivoting.
 *
 * Usage:
 *   const { L, U, P } = lu(A);
 *   // P[i] gives the original row moved to position i, so P · A = L · U.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';

export interface LUResult {
  /** Unit lower-triangular factor L. */
  L: DenseMatrix;
  /** Upper-triangular factor U. */
  U: DenseMatrix;
  /** Row permutation array of length n. P[i] is the original-row index now at position i. */
  P: number[];
}

/**
 * Perform LU decomposition with partial pivoting on a square `DenseMatrix`.
 *
 * Implements Doolittle's algorithm in compact form: the working array stores
 * L below the diagonal (unit diagonal implicit) and U on and above it.
 *
 * @throws {Error} if `A` is not square.
 * @throws {Error} if `A` is singular (zero pivot encountered).
 */
export function lu(A: DenseMatrix): LUResult {
  const n = A.rows;
  if (A.cols !== n) {
    throw new Error(`lu: matrix must be square (got ${A.rows}×${A.cols})`);
  }

  // Working copy in row-major order. We overwrite this in place with the
  // compact LU factorisation (L below diagonal, U on and above diagonal).
  const flat = A.toFloat64Array();
  const W = new Float64Array(flat);

  const perm = new Array<number>(n);
  for (let i = 0; i < n; i++) perm[i] = i;

  for (let k = 0; k < n; k++) {
    // --- Partial pivot: find the row with the largest absolute value in column k ---
    let pivotRow = k;
    let pivotVal = Math.abs(W[k * n + k]);
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(W[i * n + k]);
      if (v > pivotVal) {
        pivotVal = v;
        pivotRow = i;
      }
    }

    if (pivotVal === 0) {
      throw new Error('lu: matrix is singular (zero pivot encountered)');
    }

    // --- Swap rows in W and perm ---
    if (pivotRow !== k) {
      for (let j = 0; j < n; j++) {
        const tmp = W[k * n + j];
        W[k * n + j] = W[pivotRow * n + j];
        W[pivotRow * n + j] = tmp;
      }
      const tmpP = perm[k];
      perm[k] = perm[pivotRow];
      perm[pivotRow] = tmpP;
    }

    // --- Eliminate below the pivot ---
    const pivot = W[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor = W[i * n + k] / pivot;
      W[i * n + k] = factor; // store L[i,k] (unit diagonal is implicit)
      for (let j = k + 1; j < n; j++) {
        W[i * n + j] -= factor * W[k * n + j];
      }
    }
  }

  // --- Extract L (unit lower-triangular) and U (upper-triangular) ---
  const lData = new Float64Array(n * n);
  const uData = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    lData[i * n + i] = 1; // unit diagonal
    for (let j = 0; j < i; j++) {
      lData[i * n + j] = W[i * n + j];
    }
    for (let j = i; j < n; j++) {
      uData[i * n + j] = W[i * n + j];
    }
  }

  return {
    L: new DenseMatrix(n, n, lData),
    U: new DenseMatrix(n, n, uData),
    P: perm,
  };
}

/**
 * Solve the dense linear system `A · x = b` using a precomputed LU factorisation
 * (from {@link lu}), where `P · A = L · U`.
 *
 * Applies the row permutation to `b` (`(P·b)[i] = b[P[i]]`), forward-substitutes
 * the unit-lower-triangular `L`, then back-substitutes the upper-triangular `U`.
 * Each call is O(n²), so factor **once** with `lu()` and call `luSolve` repeatedly
 * to solve many right-hand sides against the same matrix — the pattern the stiff
 * Rosenbrock/RODAS ODE steps use (the iteration matrix is solved against 3–6
 * successive RHS per step).
 *
 * @param fac An `LUResult` produced by {@link lu}.
 * @param b   Right-hand side vector of length `n` (`number[]` or `Float64Array`).
 * @returns   The solution vector `x` as a `number[]` of length `n`.
 * @throws {Error} if `b.length` does not equal the factor dimension `n`.
 */
export function luSolve(fac: LUResult, b: ArrayLike<number>): number[] {
  const n = fac.P.length;
  if (b.length !== n) {
    throw new Error(
      `luSolve: right-hand side length ${b.length} does not match factor dimension ${n}`
    );
  }
  const L = fac.L.toFloat64Array();
  const U = fac.U.toFloat64Array();
  const P = fac.P;

  // Forward substitution: L·y = P·b (L is unit lower-triangular, so no diagonal division).
  const y = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = b[P[i]];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s;
  }

  // Back substitution: U·x = y.
  const x = new Array<number>(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= U[i * n + k] * x[k];
    x[i] = s / U[i * n + i];
  }
  return x;
}

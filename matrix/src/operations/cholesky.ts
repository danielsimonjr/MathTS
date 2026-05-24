/**
 * Cholesky Decomposition (DenseMatrix primitive)
 *
 * Right-looking algorithm. Factorises a symmetric positive-definite (SPD)
 * matrix A into A = L · Lᵀ where L is lower-triangular.
 *
 * Usage:
 *   const { L } = cholesky(A);
 *   // A ≈ L · L^T  (to floating-point precision)
 */

import { DenseMatrix } from '../types/DenseMatrix.js';

export interface CholeskyResult {
  /** Lower-triangular Cholesky factor L such that A = L · Lᵀ. */
  L: DenseMatrix;
}

/**
 * Compute the Cholesky decomposition of the symmetric positive-definite
 * `DenseMatrix` A such that A = L · Lᵀ.
 *
 * @throws {Error} if `A` is not square.
 * @throws {Error} if `A` is not positive definite (non-positive diagonal pivot).
 */
export function cholesky(A: DenseMatrix): CholeskyResult {
  const n = A.rows;
  if (A.cols !== n) {
    throw new Error(`cholesky: matrix must be square (got ${A.rows}×${A.cols})`);
  }

  const src = A.toFloat64Array();
  const lData = new Float64Array(n * n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = src[i * n + j];
      for (let k = 0; k < j; k++) {
        sum -= lData[i * n + k] * lData[j * n + k];
      }
      if (i === j) {
        if (sum <= 0) {
          throw new Error('cholesky: matrix is not positive definite');
        }
        lData[i * n + j] = Math.sqrt(sum);
      } else {
        const ljj = lData[j * n + j];
        if (ljj === 0) {
          throw new Error('cholesky: matrix is not positive definite');
        }
        lData[i * n + j] = sum / ljj;
      }
    }
  }

  return { L: new DenseMatrix(n, n, lData) };
}

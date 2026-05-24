/**
 * Moore-Penrose Pseudoinverse (DenseMatrix primitive)
 *
 * Computes the pseudoinverse A⁺ of a DenseMatrix A via full SVD with
 * rcond·max(S) singular-value thresholding.
 *
 * Algorithm:
 *   1. Full SVD:   A = U · diag(S) · Vᵀ   (A is m×n)
 *      U: m×m orthogonal, V: n×n orthogonal, S: min(m,n) values (descending).
 *   2. Threshold:  s_inv_i = 1/s_i  if  s_i > rcond·max(S),  else 0.
 *   3. Build:      A⁺ = V · diag(s_inv) · Uᵀ   (shape: n×m).
 *
 * Satisfies all four Moore-Penrose identities within numerical precision:
 *   A · A⁺ · A  = A
 *   A⁺ · A · A⁺ = A⁺
 *   (A · A⁺)ᵀ   = A · A⁺
 *   (A⁺ · A)ᵀ   = A⁺ · A
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { svd } from './svd.js';

export interface PinvOptions {
  /**
   * Relative condition threshold for singular-value truncation.
   * A singular value s_i is treated as zero when s_i ≤ rcond · max(S).
   * Default: 1e-10.
   */
  rcond?: number;
}

/**
 * Compute the Moore-Penrose pseudoinverse of a DenseMatrix.
 *
 * @param A    - Input matrix (m × n).
 * @param opts - Optional rcond threshold (default 1e-10).
 * @returns    A⁺, the pseudoinverse of A (n × m).
 */
export function pinv(A: DenseMatrix, opts?: PinvOptions): DenseMatrix {
  const rcond = opts?.rcond ?? 1e-10;
  const m = A.rows;
  const n = A.cols;

  if (m === 0 || n === 0) {
    // Empty matrix: pseudoinverse is n×m zero matrix.
    return DenseMatrix.zeros(n, m);
  }

  // Convert DenseMatrix to number[][] for the SVD primitive.
  const matrix2D = A.toArray();

  // Full SVD: A = U · diag(S) · Vᵀ
  // U: m×m, V: n×n, S: min(m,n) values in descending order.
  const { U, S, V } = svd(matrix2D, { tolerance: 1e-12 });

  // Threshold singular values: keep s_i only when s_i > rcond · max(S).
  const maxS = S.length > 0 ? S[0] : 0; // S is in descending order
  const Sinv = S.map((s) => (s > rcond * maxS ? 1 / s : 0));

  // Build A⁺ = V · diag(Sinv) · Uᵀ   (shape: n × m)
  const k = S.length; // min(m, n)
  const pinvData = new Float64Array(n * m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        // V[i][l] * Sinv[l] * U[j][l]   (Uᵀ[l][j] = U[j][l])
        sum += V[i][l] * Sinv[l] * U[j][l];
      }
      pinvData[i * m + j] = sum;
    }
  }

  return new DenseMatrix(n, m, pinvData);
}

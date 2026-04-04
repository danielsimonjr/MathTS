/**
 * WASM-accelerated Singular Value Decomposition
 *
 * Provides SVD computation with optional WASM acceleration.
 * The Rust WASM crate currently exposes eigenvalue operations but not
 * a direct SVD implementation. For symmetric matrices, SVD can be
 * derived from eigendecomposition (singular values = |eigenvalues|).
 *
 * Strategy:
 *   - Symmetric matrices: WASM eig -> derive SVD
 *   - General matrices: JS Golub-Reinsch bidiagonalization (svd.ts)
 *
 * @packageDocumentation
 */

import { svd, type SVDResult, type SVDOptions } from './svd.js';
import { eigWasm } from './eig-wasm.js';

/**
 * Threshold: minimum matrix dimension for WASM acceleration.
 */
const WASM_SVD_THRESHOLD = 16;

/**
 * Check if a matrix is symmetric within tolerance
 */
function isSymmetric(matrix: number[][], tolerance: number = 1e-10): boolean {
  const n = matrix.length;
  if (n === 0) return true;
  if (matrix[0].length !== n) return false;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(matrix[i][j] - matrix[j][i]) > tolerance) {
        return false;
      }
    }
  }
  return true;
}

/**
 * WASM-accelerated SVD.
 *
 * For symmetric matrices, uses WASM eigendecomposition to derive SVD.
 * For general matrices, falls back to the JavaScript Golub-Reinsch algorithm.
 *
 * @param matrix - Input matrix (m x n) as 2D array
 * @param options - SVD computation options
 * @returns SVD decomposition { U, S, V, rank }
 */
export async function svdWasm(
  matrix: number[][],
  options?: SVDOptions
): Promise<SVDResult> {
  const m = matrix.length;
  const n = matrix[0]?.length ?? 0;

  if (m === 0 || n === 0) {
    return { U: [], S: [], V: [], rank: 0 };
  }

  // Only use WASM path for square symmetric matrices above threshold
  if (m !== n || !isSymmetric(matrix) || n < WASM_SVD_THRESHOLD) {
    return svd(matrix, options);
  }

  try {
    // For symmetric A, SVD is related to eigendecomposition:
    //   A = V * diag(eigenvalues) * V^T
    //   SVD: A = U * S * V^T  where S = |eigenvalues|
    const eigResult = await eigWasm(matrix, {
      tolerance: options?.tolerance,
      computeVectors: true,
    });

    // Build SVD from eigendecomposition
    const eigenvalues = eigResult.values;
    const eigenvectors = eigResult.vectors;

    // Sort by absolute eigenvalue descending
    const indices = Array.from({ length: n }, (_, i) => i);
    indices.sort(
      (a, b) =>
        Math.sqrt(eigenvalues[b].re ** 2 + eigenvalues[b].im ** 2) -
        Math.sqrt(eigenvalues[a].re ** 2 + eigenvalues[a].im ** 2)
    );

    // Singular values are absolute eigenvalues
    const S = indices.map((i) => {
      const ev = eigenvalues[i];
      return Math.sqrt(ev.re * ev.re + ev.im * ev.im);
    });

    // For symmetric matrix, U and V differ only in sign for negative eigenvalues
    const V = new Array(n).fill(null).map((_, row) =>
      indices.map((i) => eigenvectors[i][row])
    );

    const U = new Array(n).fill(null).map((_, row) =>
      indices.map((i) => {
        const sign = eigenvalues[i].re >= 0 ? 1 : -1;
        return sign * eigenvectors[i][row];
      })
    );

    // Rank estimation
    const rankTolerance = options?.rankTolerance ?? 1e-10;
    const maxS = S[0] || 0;
    let rank = 0;
    for (const s of S) {
      if (s > rankTolerance * maxS) {
        rank++;
      }
    }

    return { U, S, V, rank };
  } catch {
    // Fall back to JS
    return svd(matrix, options);
  }
}

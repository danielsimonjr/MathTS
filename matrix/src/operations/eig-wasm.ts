/**
 * `eigWasm` / `eigvalsWasm` / `spectralRadiusWasm` — thin wrappers kept for API
 * compatibility (consumed by `tensor` and `linalg`).
 *
 * The WASM eig path was RETIRED and REMOVED (2026-07-01): the AssemblyScript Jacobi
 * (symmetric) / Hessenberg+Francis (general) kernels were scalar + async and measured
 * 0.2–0.7× of the pure-JS path, worsening with size (~5× slower at 128²) — see
 * `tools/benchmarks/decomp-audit`. Since a genuinely fast version would be a from-scratch
 * SIMD implementation (not the removed scalar code), these now simply delegate to the
 * synchronous JS `eig` / `eigvals` / `powerIteration`. The `async` signature is retained so
 * existing callers (which `await`) are unaffected.
 *
 * @packageDocumentation
 */

import { eig, eigvals, powerIteration, type EigResult, type EigOptions } from './eig.js';

/**
 * Eigendecomposition. Delegates to the JS {@link eig} (WASM path retired — see file header).
 */
export async function eigWasm(matrix: number[][], options?: EigOptions): Promise<EigResult> {
  const n = matrix.length;
  if (n === 0) {
    return { values: [], vectors: [], vectorsIm: [], isSymmetric: true };
  }
  for (let i = 0; i < n; i++) {
    if (matrix[i].length !== n) {
      throw new Error('Matrix must be square');
    }
  }
  return eig(matrix, options);
}

/**
 * Eigenvalues only. Delegates to the JS {@link eigvals} (WASM path retired).
 */
export async function eigvalsWasm(
  matrix: number[][],
  options?: Omit<EigOptions, 'computeVectors'>
): Promise<Array<{ re: number; im: number }>> {
  return eigvals(matrix, options);
}

/**
 * Spectral radius (|largest eigenvalue|). Delegates to the JS {@link powerIteration}
 * (WASM path retired).
 */
export async function spectralRadiusWasm(
  matrix: number[][],
  options?: { maxIterations?: number; tolerance?: number }
): Promise<number> {
  const result = powerIteration(matrix, options);
  return Math.abs(result.value);
}

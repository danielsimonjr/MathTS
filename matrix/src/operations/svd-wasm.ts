/**
 * `svdWasm` — thin wrapper kept for API compatibility (consumed by `tensor` and `linalg`).
 *
 * The WASM SVD path was RETIRED and REMOVED (2026-07-01): the AssemblyScript one-sided
 * Jacobi kernel was scalar + async and measured 0.4–0.7× of the pure-JS Golub-Reinsch
 * {@link svd}, worsening with size — see `tools/benchmarks/decomp-audit`. It now delegates
 * to the JS `svd`, truncated to the **thin / economy** form (`U` is `m×k`, `V` is `n×k`,
 * `k = min(m, n)`) so the result shape is unchanged. The `async` signature is retained so
 * existing callers (which `await`) are unaffected.
 *
 * @packageDocumentation
 */

import { svd, type SVDResult, type SVDOptions } from './svd.js';

/** Count singular values above the rank tolerance. */
function estimateRank(s: number[], rankTolerance: number): number {
  let rank = 0;
  for (const sv of s) {
    if (sv > rankTolerance) rank++;
  }
  return rank;
}

/** Truncate a full SVD result to the thin form (first `k` columns). */
function toThin(full: SVDResult, k: number, rankTolerance: number): SVDResult {
  const S = full.S.slice(0, k);
  return {
    U: full.U.map((row) => row.slice(0, k)),
    S,
    V: full.V.map((row) => row.slice(0, k)),
    rank: estimateRank(S, rankTolerance),
  };
}

/**
 * Thin SVD. Delegates to the JS {@link svd} and truncates to the economy form
 * (WASM path retired — see file header).
 *
 * @param matrix - Input matrix (m x n) as a row-major 2D array
 * @param options - SVD options; `rankTolerance` controls the rank estimate
 * @returns thin SVD `{ U (m x k), S (k), V (n x k), rank }`
 */
export async function svdWasm(matrix: number[][], options?: SVDOptions): Promise<SVDResult> {
  const m = matrix.length;
  const n = matrix[0]?.length ?? 0;
  if (m === 0 || n === 0) {
    return { U: [], S: [], V: [], rank: 0 };
  }
  const k = Math.min(m, n);
  const rankTolerance = options?.rankTolerance ?? 1e-10;
  return toThin(svd(matrix, options), k, rankTolerance);
}

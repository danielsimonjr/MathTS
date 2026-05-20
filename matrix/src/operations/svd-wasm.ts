/**
 * WASM-accelerated Singular Value Decomposition.
 *
 * Routes through the Rust WASM crate's direct one-sided Jacobi SVD
 * (`svd` export) for any real `m x n` matrix, and falls back to the
 * synchronous JavaScript Golub-Reinsch {@link svd} when the WASM module is
 * unavailable.
 *
 * Unlike the synchronous {@link svd} (which returns the *full* `m x m` /
 * `n x n` factors), `svdWasm` always returns the **thin / economy** form —
 * `U` is `m x k`, `V` is `n x k`, `k = min(m, n)` — on both the WASM and the
 * fallback path, so callers get a stable result shape.
 *
 * @packageDocumentation
 */

import { svd, type SVDResult, type SVDOptions } from './svd.js';
import { RustWasmLoader } from '../backends/RustWasmLoader.js';

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
 * WASM-accelerated thin SVD. Always safe to call — falls back to the
 * synchronous JS SVD when the Rust WASM module is not available.
 *
 * @param matrix - Input matrix (m x n) as a row-major 2D array
 * @param options - SVD options; `rankTolerance` controls the rank estimate
 * @returns thin SVD `{ U (m x k), S (k), V (n x k), rank }`
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

  const k = Math.min(m, n);
  const rankTolerance = options?.rankTolerance ?? 1e-10;

  const loader = RustWasmLoader.getInstance();
  const ready = loader.isLoaded || (await loader.load());
  const wasm = ready ? loader.getExports() : null;

  if (!wasm || typeof wasm.svd !== 'function') {
    // Rust WASM unavailable — synchronous JS SVD, truncated to the thin form.
    return toThin(svd(matrix, options), k, rankTolerance);
  }

  try {
    loader.resetAllocator();

    const flat = new Float64Array(m * n);
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) flat[i * n + j] = matrix[i][j];
    }

    const aPtr = loader.writeF64(flat);
    const uPtr = loader.allocF64(m * k);
    const sPtr = loader.allocF64(k);
    const vPtr = loader.allocF64(n * k);
    const workPtr = loader.allocF64(wasm.svdWorkSize(m, n));

    const status = wasm.svd(aPtr, m, n, uPtr, sPtr, vPtr, workPtr);
    if (status < 0) {
      return toThin(svd(matrix, options), k, rankTolerance);
    }

    const uFlat = loader.readF64(uPtr, m * k);
    const sFlat = loader.readF64(sPtr, k);
    const vFlat = loader.readF64(vPtr, n * k);

    const U: number[][] = [];
    for (let i = 0; i < m; i++) {
      U.push(Array.from(uFlat.subarray(i * k, i * k + k)));
    }
    const V: number[][] = [];
    for (let i = 0; i < n; i++) {
      V.push(Array.from(vFlat.subarray(i * k, i * k + k)));
    }
    const S = Array.from(sFlat);

    return { U, S, V, rank: estimateRank(S, rankTolerance) };
  } catch {
    // Any marshalling / instantiation failure — fall back to JS.
    return toThin(svd(matrix, options), k, rankTolerance);
  }
}

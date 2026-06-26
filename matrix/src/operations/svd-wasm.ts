/**
 * WASM-accelerated Singular Value Decomposition.
 *
 * Routes through the AssemblyScript binary's one-sided Jacobi SVD
 * (`matrix_svd` export, `assembly/src/ops/svd.ts`) for any real `m x n`
 * matrix, and falls back to the synchronous JavaScript Golub-Reinsch
 * {@link svd} when the WASM module is unavailable. (Phase 7b: repointed off
 * the retired Rust crate; singular values are bit-identical to the JS
 * reference per the 7a parity validation.)
 *
 * Unlike the synchronous {@link svd} (which returns the *full* `m x m` /
 * `n x n` factors), `svdWasm` always returns the **thin / economy** form —
 * `U` is `m x k`, `V` is `n x k`, `k = min(m, n)` — on both the WASM and the
 * fallback path, so callers get a stable result shape.
 *
 * @packageDocumentation
 */

import { svd, type SVDResult, type SVDOptions } from './svd.js';
import { wasmLoader } from '../backends/WasmLoader.js';

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
 * synchronous JS SVD when the AssemblyScript WASM module is not available.
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

  // Use the shared (AS-default) loader. Load on first use; any failure
  // (e.g. binary missing in this environment) drops to the JS fallback.
  let module = wasmLoader.getModule();
  if (!module) {
    try {
      module = await wasmLoader.load();
    } catch {
      module = null;
    }
  }

  if (!module || typeof module.matrix_svd !== 'function') {
    // AS WASM unavailable — synchronous JS SVD, truncated to the thin form.
    return toThin(svd(matrix, options), k, rankTolerance);
  }

  const flat = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) flat[i * n + j] = matrix[i][j];
  }

  const aAlloc = wasmLoader.allocateFloat64Array(flat);
  try {
    // matrix_svd returns a managed Float64Array header packing
    // [ U(m*k) | S(k) | V(n*k) ] (U row-major m×k, V row-major n×k).
    const packedPtr = module.matrix_svd(aAlloc.ptr, m, n);
    const packed = wasmLoader.readReturnedFloat64Array(packedPtr);
    if (packed.length < m * k + k + n * k) {
      return toThin(svd(matrix, options), k, rankTolerance);
    }

    const uFlat = packed.subarray(0, m * k);
    const sFlat = packed.subarray(m * k, m * k + k);
    const vFlat = packed.subarray(m * k + k, m * k + k + n * k);

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
  } finally {
    wasmLoader.free(aAlloc.ptr);
    wasmLoader.resetRustAllocator();
  }
}

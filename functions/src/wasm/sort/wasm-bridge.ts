/**
 * WASM dispatch bridge for sort kernels — Slice 5.7a.
 *
 * Kernels covered:
 *   - `sort_f64`    — in-place ascending sort (NaN-last, returns same array).
 *   - `argsort_f64` — return Int32Array of permutation indices (NaN-last).
 *   - `rank_f64`    — return Int32Array of ranks (0-indexed, NaN-last).
 *
 * Dispatch (for arrays ≥ WASM_SORT_THRESHOLD = 16 384 elements):
 *   - `sort_f64` uses the AS managed kernel — now an INTROSORT (3-way quicksort +
 *     median-of-3 + heapsort fallback), so duplicate-heavy input is O(n log n)
 *     (the old Lomuto quicksort degraded to O(n²)); value-sort stays bit-identical.
 *   - `argsort_f64` / `rank_f64` are repointed to AS (Rust→AS Phase 6): the AS
 *     index sort now uses a STABLE total-order comparator (value, then original
 *     index), so for tied values it returns the same permutation as the JS stable
 *     reference (verified Phase 6 — exact match on tie-heavy + NaN input).
 *
 * Any thrown error is swallowed and the JS fallback runs — WASM is an
 * optimisation, not a correctness requirement.
 */

import {
  getWasm,
  isAsWasm,
  withAsF64,
  asReadReturnedF64,
  asReadReturnedI32,
  type RawWasm,
} from '../bridges/common.js';

// ---------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------

/** Minimum element count for WASM acceleration. */
export const WASM_SORT_THRESHOLD = 16384;

// ---------------------------------------------------------------------------
// Pure-JS fallback implementations
// ---------------------------------------------------------------------------

/** NaN-last comparator matching the original Rust `cmp_f64_nan_last`. */
function cmpNanLast(a: number, b: number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  if (a === b) return 0;
  // At least one is NaN.
  if (Number.isNaN(a) && Number.isNaN(b)) return 0;
  if (Number.isNaN(a)) return 1;
  return -1;
}

/** JS fallback: sort Float64Array in-place (NaN-last). Returns same array. */
export function sortF64JS(data: Float64Array): Float64Array {
  // Float64Array.prototype.sort uses locale-based comparison — we need a custom comparator.
  // Sort a copy of values as a regular Array so we can use a comparator, then write back.
  const arr = Array.from(data);
  arr.sort(cmpNanLast);
  for (let i = 0; i < arr.length; i++) data[i] = arr[i];
  return data;
}

/** JS fallback: return argsort permutation (NaN-last). */
export function argsortF64JS(data: Float64Array): Int32Array {
  const n = data.length;
  const indices = new Int32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;
  // Sort indices by data value.
  const arr = Array.from(indices);
  arr.sort((i, j) => cmpNanLast(data[i], data[j]));
  for (let k = 0; k < n; k++) indices[k] = arr[k];
  return indices;
}

/** JS fallback: return rank array (NaN-last). */
export function rankF64JS(data: Float64Array): Int32Array {
  const n = data.length;
  const argsort = argsortF64JS(data);
  const rank = new Int32Array(n);
  for (let k = 0; k < n; k++) rank[argsort[k]] = k;
  return rank;
}

// ---------------------------------------------------------------------------
// WASM-dispatched public API
// ---------------------------------------------------------------------------

/**
 * Sort `data` in place (ascending, NaN-last).
 * Returns the same array for convenience.
 * Uses WASM above {@link WASM_SORT_THRESHOLD}.
 */
export function sortF64Dispatch(data: Float64Array): Float64Array {
  const n = data.length;

  if (n >= WASM_SORT_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: sort_f64(data) sorts in place and returns the array.
        // Value-sort is bit-identical to JS regardless of stability.
        const sorted = withAsF64(wasm, [data], (mod, [h]) =>
          asReadReturnedF64(mod, (mod['sort_f64'] as (d: number) => number)(h))
        );
        if (sorted && sorted.length === n) {
          data.set(sorted);
          return data;
        }
      } catch {
        // fall through
      }
    }
  }
  return sortF64JS(data);
}

/**
 * Return the argsort permutation for `data` (NaN-last) — STABLE.
 * After the call, `data[result[0]] ≤ data[result[1]] ≤ …`; equal values keep
 * their original input order, matching the JS stable reference.
 *
 * Uses the AS managed kernel above {@link WASM_SORT_THRESHOLD}: the AS index
 * sort now breaks value ties by original index (a strict total order), so it
 * yields the identical permutation to the JS stable sort on tie-heavy input
 * (verified Phase 6). Falls back to JS when wasm is unavailable / on any error.
 */
export function argsortF64Dispatch(data: Float64Array): Int32Array {
  const n = data.length;
  if (n >= WASM_SORT_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: argsort_f64(data) -> Int32Array of indices.
        const idx = withAsF64(wasm, [data], (mod, [h]) =>
          asReadReturnedI32(mod, (mod['argsort_f64'] as (d: number) => number)(h))
        );
        if (idx && idx.length === n) return idx;
      } catch {
        // fall through
      }
    }
  }
  return argsortF64JS(data);
}

/**
 * Return the rank array for `data` (0-indexed, NaN-last) — STABLE.
 * `result[i]` = position of `data[i]` in the sorted array.
 *
 * Uses the AS managed kernel above {@link WASM_SORT_THRESHOLD} (derived from the
 * stable AS argsort, so it matches the JS stable reference on ties — verified
 * Phase 6). Falls back to JS when wasm is unavailable / on any error.
 */
export function rankF64Dispatch(data: Float64Array): Int32Array {
  const n = data.length;
  if (n >= WASM_SORT_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: rank_f64(data) -> Int32Array of ranks.
        const ranks = withAsF64(wasm, [data], (mod, [h]) =>
          asReadReturnedI32(mod, (mod['rank_f64'] as (d: number) => number)(h))
        );
        if (ranks && ranks.length === n) return ranks;
      } catch {
        // fall through
      }
    }
  }
  return rankF64JS(data);
}

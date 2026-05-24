/**
 * WASM dispatch bridge for sort kernels — Slice 5.7a.
 *
 * Kernels covered:
 *   - `sort_f64`    — in-place ascending sort (NaN-last, returns same array).
 *   - `argsort_f64` — return Int32Array of permutation indices (NaN-last).
 *   - `rank_f64`    — return Int32Array of ranks (0-indexed, NaN-last).
 *
 * Dispatch order (for arrays ≥ WASM_SORT_THRESHOLD = 16 384 elements):
 *   1. Probe Rust export (`sort_f64` / `argsort_f64` / `rank_f64`).
 *   2. If absent, probe AS export (same name, typed-array ABI).
 *   3. Fall back to pure-JS implementation.
 *
 * Any thrown error is swallowed and the JS fallback runs — WASM is an
 * optimisation, not a correctness requirement.
 */

import { wasmLoader } from '../WasmLoader.js';

// ---------------------------------------------------------------------------
// Threshold
// ---------------------------------------------------------------------------

/** Minimum element count for WASM acceleration. */
export const WASM_SORT_THRESHOLD = 16384;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getWasm() {
  try {
    return wasmLoader.getModule();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure-JS fallback implementations
// ---------------------------------------------------------------------------

/** NaN-last comparator matching Rust's cmp_f64_nan_last. */
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
    const wasm = getWasm();
    if (wasm) {
      // --- Rust pointer-ABI ---
      const rustFn = (wasm as unknown as Record<string, unknown>)['sort_f64'];
      if (typeof rustFn === 'function') {
        try {
          const alloc = wasmLoader.allocateFloat64Array(data);
          try {
            const ret = (rustFn as (ptr: number, n: number) => number)(alloc.ptr, n);
            if (ret >= 0) {
              data.set(alloc.array);
              return data;
            }
          } finally {
            wasmLoader.free(alloc.ptr);
          }
        } catch {
          // fall through
        }
      }
      // --- AS typed-array ABI ---
      const asFn = (wasm as unknown as Record<string, unknown>)['sort_f64'];
      if (typeof asFn === 'function') {
        try {
          (asFn as (d: Float64Array) => Float64Array)(data);
          return data;
        } catch {
          // fall through
        }
      }
    }
  }
  return sortF64JS(data);
}

/**
 * Return the argsort permutation for `data` (NaN-last).
 * After the call, `data[result[0]] ≤ data[result[1]] ≤ …`
 * Uses WASM above {@link WASM_SORT_THRESHOLD}.
 */
export function argsortF64Dispatch(data: Float64Array): Int32Array {
  const n = data.length;

  if (n >= WASM_SORT_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      // --- Rust pointer-ABI ---
      const rustFn = (wasm as unknown as Record<string, unknown>)['argsort_f64'];
      if (typeof rustFn === 'function') {
        try {
          const inAlloc = wasmLoader.allocateFloat64Array(data);
          const outAlloc = wasmLoader.allocateInt32ArrayEmpty(n);
          try {
            const ret = (rustFn as (dataPtr: number, n: number, outPtr: number) => number)(
              inAlloc.ptr,
              n,
              outAlloc.ptr
            );
            if (ret >= 0) {
              return new Int32Array(outAlloc.array);
            }
          } finally {
            wasmLoader.free(inAlloc.ptr);
            wasmLoader.free(outAlloc.ptr);
          }
        } catch {
          // fall through
        }
      }
      // --- AS typed-array ABI ---
      const asFn = (wasm as unknown as Record<string, unknown>)['argsort_f64'];
      if (typeof asFn === 'function') {
        try {
          return (asFn as (d: Float64Array) => Int32Array)(data);
        } catch {
          // fall through
        }
      }
    }
  }
  return argsortF64JS(data);
}

/**
 * Return the rank array for `data` (0-indexed, NaN-last).
 * `result[i]` = position of `data[i]` in the sorted array.
 * Uses WASM above {@link WASM_SORT_THRESHOLD}.
 */
export function rankF64Dispatch(data: Float64Array): Int32Array {
  const n = data.length;

  if (n >= WASM_SORT_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      // --- Rust pointer-ABI ---
      const rustFn = (wasm as unknown as Record<string, unknown>)['rank_f64'];
      if (typeof rustFn === 'function') {
        try {
          const inAlloc = wasmLoader.allocateFloat64Array(data);
          const outAlloc = wasmLoader.allocateInt32ArrayEmpty(n);
          try {
            const ret = (rustFn as (dataPtr: number, n: number, outPtr: number) => number)(
              inAlloc.ptr,
              n,
              outAlloc.ptr
            );
            if (ret >= 0) {
              return new Int32Array(outAlloc.array);
            }
          } finally {
            wasmLoader.free(inAlloc.ptr);
            wasmLoader.free(outAlloc.ptr);
          }
        } catch {
          // fall through
        }
      }
      // --- AS typed-array ABI ---
      const asFn = (wasm as unknown as Record<string, unknown>)['rank_f64'];
      if (typeof asFn === 'function') {
        try {
          return (asFn as (d: Float64Array) => Int32Array)(data);
        } catch {
          // fall through
        }
      }
    }
  }
  return rankF64JS(data);
}

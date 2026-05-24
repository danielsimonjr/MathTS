/**
 * WASM dispatch bridge for the tridiagonal-solve hot loop (Slice 3.10b).
 *
 * One kernel is exposed:
 *   - `tridiag_solve_f64` — O(n) Thomas algorithm for a tridiagonal system
 *
 * Behavior:
 *   - When `wasmLoader.getModule()` returns null (module not loaded or
 *     load failed), the helper returns the JS fallback result without
 *     throwing.
 *   - When the loaded module exposes the Rust export, we marshal the
 *     Float64Array operands into WASM-owned memory, run the kernel, and
 *     return a JS-side copy of the result.
 *   - When only the AS export is present (the AS binary is loaded), we
 *     pass the Float64Array references directly via the `_as`-named
 *     variant.
 *   - Any thrown error is swallowed and the JS fallback runs — the
 *     WASM tier is an optimisation, not a correctness requirement.
 *
 * Threshold:
 *   The marshal cost (four memcpys in + one out) pays off when the O(n)
 *   inner loop is large enough.  A knot-count of ≥ 1024 is the
 *   empirically-chosen break-even point; see
 *   `tools/benchmark/wasm/tridiag.bench.ts`.
 */

import { wasmLoader, type WasmModule } from '../WasmLoader.js';

/**
 * Knot-count threshold above which we attempt the WASM tridiag kernel.
 * Gated on the length of `diag` (== number of unknowns).
 */
export const WASM_TRIDIAG_THRESHOLD = 1024;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getWasm(): WasmModule | null {
  try {
    return wasmLoader.getModule();
  } catch {
    return null;
  }
}

/**
 * Pure-JS Thomas algorithm — used as the below-threshold / no-WASM fallback.
 *
 * Solves a tridiagonal system A·x = rhs in O(n).
 *
 * @param diag  - main diagonal,   length n
 * @param lower - sub-diagonal,    length n-1
 * @param upper - super-diagonal,  length n-1
 * @param rhs   - right-hand side, length n
 * @returns solution x, length n
 */
export function tridiagSolveJS(
  diag: Float64Array,
  lower: Float64Array,
  upper: Float64Array,
  rhs: Float64Array
): Float64Array {
  const n = diag.length;
  if (n === 0) return new Float64Array(0);
  if (n === 1) {
    const out = new Float64Array(1);
    out[0] = rhs[0] / diag[0];
    return out;
  }

  const c = new Float64Array(n - 1); // modified super-diagonal
  const d = new Float64Array(n); //     modified rhs

  c[0] = upper[0] / diag[0];
  d[0] = rhs[0] / diag[0];

  for (let i = 1; i < n - 1; i++) {
    const m = diag[i] - lower[i - 1] * c[i - 1];
    c[i] = upper[i] / m;
    d[i] = (rhs[i] - lower[i - 1] * d[i - 1]) / m;
  }

  const mLast = diag[n - 1] - lower[n - 2] * c[n - 2];
  d[n - 1] = (rhs[n - 1] - lower[n - 2] * d[n - 2]) / mLast;

  const x = new Float64Array(n);
  x[n - 1] = d[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    x[i] = d[i] - c[i] * x[i + 1];
  }
  return x;
}

// Rust-backend function type signature (pointer-style calling convention).
type RustTridiagFn = (
  diagPtr: number,
  lowerPtr: number,
  upperPtr: number,
  rhsPtr: number,
  n: number,
  outPtr: number
) => number;

// AS-backend function type signature (typed-array calling convention).
type ASTridiagFn = (
  diag: Float64Array,
  lower: Float64Array,
  upper: Float64Array,
  rhs: Float64Array
) => Float64Array;

// ---------------------------------------------------------------------------
// Public dispatch helper
// ---------------------------------------------------------------------------

/**
 * Solve a tridiagonal system via WASM when `diag.length` is at or above
 * the threshold, otherwise falls back to the inline JS Thomas algorithm.
 *
 * @param diag  - main diagonal,   length n
 * @param lower - sub-diagonal,    length n-1
 * @param upper - super-diagonal,  length n-1
 * @param rhs   - right-hand side, length n
 * @returns solution Float64Array of length n
 */
export function tridiagSolveDispatch(
  diag: Float64Array,
  lower: Float64Array,
  upper: Float64Array,
  rhs: Float64Array
): Float64Array {
  const n = diag.length;
  if (n >= WASM_TRIDIAG_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        // Try Rust backend first (pointer-style).
        const rustFn = (wasm as unknown as Record<string, unknown>)['tridiag_solve_f64'] as
          | RustTridiagFn
          | undefined;
        if (typeof rustFn === 'function') {
          const diagAlloc = wasmLoader.allocateFloat64Array(diag);
          const lowerAlloc = wasmLoader.allocateFloat64Array(lower);
          const upperAlloc = wasmLoader.allocateFloat64Array(upper);
          const rhsAlloc = wasmLoader.allocateFloat64Array(rhs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(
              diagAlloc.ptr,
              lowerAlloc.ptr,
              upperAlloc.ptr,
              rhsAlloc.ptr,
              n,
              outAlloc.ptr
            );
            if (written === n) {
              // Copy out before releasing pool memory.
              return new Float64Array(outAlloc.array);
            }
            // written < 0 means singular — fall through to JS
          } finally {
            wasmLoader.release(diagAlloc.ptr, true);
            wasmLoader.release(lowerAlloc.ptr, true);
            wasmLoader.release(upperAlloc.ptr, true);
            wasmLoader.release(rhsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }

        // Try AS backend (typed-array calling convention, `_as` suffix key).
        const asFn = (wasm as unknown as Record<string, unknown>)['tridiag_solve_f64_as'] as
          | ASTridiagFn
          | undefined;
        if (typeof asFn === 'function') {
          const result = asFn(diag, lower, upper, rhs);
          if (result.length === n) {
            return new Float64Array(result);
          }
          // length 0 means singular — fall through to JS
        }
      } catch {
        // Fall through to JS
      }
    }
  }
  return tridiagSolveJS(diag, lower, upper, rhs);
}

/**
 * Test-only hook — re-exported so tests can reset loader state
 * without importing WasmLoader directly.
 */
export function resetTridiagWasm(): void {
  wasmLoader.reset();
}

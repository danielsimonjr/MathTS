/**
 * WASM dispatch bridge for the tridiagonal-solve and divided-difference
 * hot loops (Slices 3.10b and 5.5).
 *
 * Two kernels are exposed:
 *   - `tridiag_solve_f64`      — O(n) Thomas algorithm for a tridiagonal system
 *   - `divided_difference_f64` — O(n²) Newton divided-difference table
 *
 * Behavior:
 *   - When `wasmLoader.getModule()` returns null (module not loaded or
 *     load failed) or the loaded module is not the AS binary, the helper
 *     returns the JS fallback result without throwing.
 *   - When the AS binary is loaded, we marshal the Float64Array operands
 *     into AS managed arrays, run the kernel, and return a JS-side copy of
 *     the result.
 *   - Any thrown error is swallowed and the JS fallback runs — the
 *     WASM tier is an optimisation, not a correctness requirement.
 *   - The legacy Rust pointer-ABI path was removed from this bridge in the
 *     Rust→AS migration Phase 5 functions cutover.
 *
 * Threshold:
 *   The marshal cost (four memcpys in + one out) pays off when the O(n)
 *   inner loop is large enough.  A knot-count of ≥ 1024 is the
 *   empirically-chosen break-even point; see
 *   `tools/benchmark/wasm/tridiag.bench.ts`.
 */

import { wasmLoader } from '../WasmLoader.js';
import {
  getWasm,
  isAsWasm,
  withAsF64,
  asReadReturnedF64,
  type RawWasm,
} from '../bridges/common.js';

/**
 * Knot-count threshold above which we attempt the WASM tridiag kernel.
 * Gated on the length of `diag` (== number of unknowns).
 */
export const WASM_TRIDIAG_THRESHOLD = 1024;

/**
 * Knot-count threshold above which we attempt the WASM divided-difference
 * kernel.  The O(n²) table is large enough to benefit from WASM at ≥ 256
 * knots; below that, marshal overhead dominates.
 */
export const WASM_INTERP_THRESHOLD = 256;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: tridiag_solve_f64(diag, lower, upper, rhs) -> Float64Array
        // (length 0 on singular).
        const result = withAsF64(wasm, [diag, lower, upper, rhs], (mod, [hd, hl, hu, hr]) =>
          asReadReturnedF64(
            mod,
            (mod['tridiag_solve_f64'] as (a: number, b: number, c: number, d: number) => number)(
              hd,
              hl,
              hu,
              hr
            )
          )
        );
        if (result && result.length === n) return result;
        // length !== n (singular) — fall through to JS
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

// ---------------------------------------------------------------------------
// Divided-difference kernel (Slice 5.5)
// ---------------------------------------------------------------------------

/**
 * Pure-JS Newton divided-difference computation — used as the
 * below-threshold / no-WASM fallback.
 *
 * Given n distinct nodes (xs, ys), returns a Float64Array of n Newton-form
 * coefficients c_0 … c_{n-1} such that:
 *
 *   P(x) = c_0 + c_1·(x-x_0) + c_2·(x-x_0)(x-x_1) + …
 *
 * Throws `RangeError` when any two x-values are equal (degenerate input).
 *
 * @param xs - interpolation nodes (distinct)
 * @param ys - function values at xs
 * @returns Newton-form coefficient array of length n
 */
export function dividedDifferenceJS(xs: Float64Array, ys: Float64Array): Float64Array {
  const n = xs.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = ys[i];

  for (let j = 1; j < n; j++) {
    for (let i = n - 1; i >= j; i--) {
      const denom = xs[i] - xs[i - j];
      if (denom === 0) {
        throw new RangeError('divided_difference: duplicate x-values (degenerate input)');
      }
      out[i] = (out[i] - out[i - 1]) / denom;
    }
  }
  return out;
}

/**
 * Compute Newton divided-difference coefficients via WASM when
 * `xs.length` is at or above WASM_INTERP_THRESHOLD, otherwise falls
 * back to the inline JS implementation.
 *
 * @param xs - interpolation nodes (distinct), length n
 * @param ys - function values at xs, length n
 * @returns Newton-form coefficient Float64Array of length n
 * @throws RangeError on duplicate x-values (JS path only; WASM path
 *         falls back to JS on error return)
 */
export function dividedDifferenceDispatch(xs: Float64Array, ys: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_INTERP_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: divided_difference_f64(xs, ys) -> Float64Array
        // (length 0 on duplicate xs).
        const result = withAsF64(wasm, [xs, ys], (mod, [hx, hy]) =>
          asReadReturnedF64(
            mod,
            (mod['divided_difference_f64'] as (a: number, b: number) => number)(hx, hy)
          )
        );
        if (result && result.length === n) return result;
        // length !== n → duplicate xs → fall through to JS (which will throw)
      } catch {
        // Fall through to JS
      }
    }
  }
  return dividedDifferenceJS(xs, ys);
}

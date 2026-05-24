/**
 * WASM dispatch bridge for polynomial hot-loop kernels.
 *
 * Two kernels are exposed:
 *   - `poly_mul_f64`     — O(n·m) coefficient convolution
 *   - `poly_div_mod_f64` — polynomial long division (returns concat [quot|rem])
 *
 * Behavior:
 *   - When `wasmLoader.getModule()` returns null (module not loaded or
 *     load failed), every helper here returns the JS fallback result
 *     without throwing.
 *   - When the loaded module exposes the matching Rust export, we
 *     marshal the Float64Array operands into WASM-owned memory, run
 *     the kernel, and return a JS-side copy of the result.
 *   - When only the AS export is present (the AS binary is loaded),
 *     we pass the Float64Array references directly via the `_as`-named
 *     variant (see `WasmModule` interface entries).
 *   - Any thrown error is swallowed and the JS fallback runs — the
 *     WASM tier is an optimisation, not a correctness requirement.
 *
 * Threshold:
 *   The marshal cost (two memcpys in + one out) pays off when the
 *   O(n·m) inner loop is large enough. A polynomial length ≥ 256
 *   coefficients is the empirically-chosen break-even point; see
 *   `tools/benchmark/wasm/poly.bench.ts`.
 */

import { wasmLoader, type WasmModule } from '../WasmLoader.js';

/**
 * Coefficient-count threshold above which we attempt the WASM kernel.
 * For `poly_mul_f64`, we gate on either operand reaching this length;
 * for `poly_div_mod_f64`, we gate on `num.length`.
 */
export const WASM_POLY_THRESHOLD = 256;

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

/** Inline JS multiply — used as the below-threshold / no-WASM fallback. */
function polyMulJS(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length === 0 || b.length === 0) return new Float64Array([0]);
  const out = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      out[i + j] += a[i] * b[j];
    }
  }
  return out;
}

/**
 * Inline JS long division — used as the below-threshold / no-WASM fallback.
 * Returns `{ quotient, remainder }`.
 */
function polyDivModJS(
  num: Float64Array,
  den: Float64Array
): { quotient: Float64Array; remainder: Float64Array } {
  if (den.length === 0) throw new Error('Division by zero polynomial');
  if (num.length < den.length) {
    return {
      quotient: new Float64Array([0]),
      remainder: new Float64Array(num),
    };
  }
  const qLen = num.length - den.length + 1;
  const work = new Float64Array(num);
  const quotient = new Float64Array(qLen);
  const bn = den[den.length - 1];
  for (let ii = 0; ii < qLen; ii++) {
    const i = num.length - 1 - ii;
    quotient[i - den.length + 1] = work[i] / bn;
    for (let j = 0; j < den.length; j++) {
      work[i - den.length + 1 + j] -= quotient[i - den.length + 1] * den[j];
    }
  }
  const rLen = den.length > 1 ? den.length - 1 : 0;
  return {
    quotient,
    remainder: rLen > 0 ? work.slice(0, rLen) : new Float64Array([0]),
  };
}

// Rust-backend function type signatures.
type RustMulFn = (aPtr: number, aLen: number, bPtr: number, bLen: number, outPtr: number) => number;

type RustDivModFn = (
  numPtr: number,
  numLen: number,
  denPtr: number,
  denLen: number,
  outPtr: number
) => number;

// AS-backend function type signatures (Float64Array calling convention).
type ASMulFn = (a: Float64Array, b: Float64Array) => Float64Array;
type ASDivModFn = (num: Float64Array, den: Float64Array) => Float64Array;

// ---------------------------------------------------------------------------
// Public dispatch helpers
// ---------------------------------------------------------------------------

/**
 * Multiply two polynomials `a` and `b` via WASM when either operand
 * length exceeds the threshold, otherwise falls back to inline JS.
 *
 * Returns a `Float64Array` of length `a.length + b.length - 1`.
 */
export function polyMulDispatch(a: Float64Array, b: Float64Array): Float64Array {
  const bigEnough = a.length >= WASM_POLY_THRESHOLD || b.length >= WASM_POLY_THRESHOLD;
  if (bigEnough) {
    const wasm = getWasm();
    if (wasm) {
      try {
        // Try Rust backend first (pointer-style).
        const rustFn = (wasm as unknown as Record<string, unknown>)['poly_mul_f64'] as
          | RustMulFn
          | undefined;
        if (typeof rustFn === 'function') {
          const outLen = a.length + b.length - 1;
          const aAlloc = wasmLoader.allocateFloat64Array(a);
          const bAlloc = wasmLoader.allocateFloat64Array(b);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(outLen);
          try {
            rustFn(aAlloc.ptr, a.length, bAlloc.ptr, b.length, outAlloc.ptr);
            return new Float64Array(outAlloc.array);
          } finally {
            wasmLoader.release(aAlloc.ptr, true);
            wasmLoader.release(bAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }

        // Try AS backend (typed-array calling convention, `_as` suffix key).
        const asFn = (wasm as unknown as Record<string, unknown>)['poly_mul_f64_as'] as
          | ASMulFn
          | undefined;
        if (typeof asFn === 'function') {
          return new Float64Array(asFn(a, b));
        }
      } catch {
        // Fall through to JS
      }
    }
  }
  return polyMulJS(a, b);
}

/**
 * Divide polynomial `num` by `den` via WASM when `num.length` exceeds
 * the threshold, otherwise falls back to inline JS.
 *
 * Returns `{ quotient: Float64Array, remainder: Float64Array }`.
 */
export function polyDivModDispatch(
  num: Float64Array,
  den: Float64Array
): { quotient: Float64Array; remainder: Float64Array } {
  if (den.length === 0) throw new Error('Division by zero polynomial');

  const bigEnough = num.length >= WASM_POLY_THRESHOLD;
  if (bigEnough) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['poly_div_mod_f64'] as
          | RustDivModFn
          | undefined;
        if (typeof rustFn === 'function') {
          const qLen = num.length >= den.length ? num.length - den.length + 1 : 0;
          const rLen = den.length > 1 ? den.length - 1 : 0;
          const totalLen = qLen + rLen;
          const maxOutLen = Math.max(totalLen, num.length, 1);
          const numAlloc = wasmLoader.allocateFloat64Array(num);
          const denAlloc = wasmLoader.allocateFloat64Array(den);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(maxOutLen);
          try {
            const written = rustFn(
              numAlloc.ptr,
              num.length,
              denAlloc.ptr,
              den.length,
              outAlloc.ptr
            );
            // The Rust kernel writes [quotient (qLen) | remainder (rLen)].
            const actualQLen = num.length >= den.length ? num.length - den.length + 1 : 0;
            const actualRLen = written - actualQLen;
            // Copy out before releasing pool memory.
            const flatCopy = new Float64Array(written);
            flatCopy.set(new Float64Array(outAlloc.array.buffer, outAlloc.ptr, written));
            return {
              quotient: actualQLen > 0 ? flatCopy.slice(0, actualQLen) : new Float64Array([0]),
              remainder: actualRLen > 0 ? flatCopy.slice(actualQLen) : new Float64Array([0]),
            };
          } finally {
            wasmLoader.release(numAlloc.ptr, true);
            wasmLoader.release(denAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }

        // AS backend (`_as` suffix).
        const asFn = (wasm as unknown as Record<string, unknown>)['poly_div_mod_f64_as'] as
          | ASDivModFn
          | undefined;
        if (typeof asFn === 'function') {
          const flat = asFn(num, den);
          const actualQLen = num.length >= den.length ? num.length - den.length + 1 : 0;
          const actualRLen = flat.length - actualQLen;
          return {
            quotient: actualQLen > 0 ? flat.slice(0, actualQLen) : new Float64Array([0]),
            remainder: actualRLen > 0 ? flat.slice(actualQLen) : new Float64Array([0]),
          };
        }
      } catch {
        // Fall through to JS
      }
    }
  }

  return polyDivModJS(num, den);
}

/**
 * Test-only hook — re-exported so tests can reset loader state
 * without importing WasmLoader directly.
 */
export function resetPolyWasm(): void {
  wasmLoader.reset();
}

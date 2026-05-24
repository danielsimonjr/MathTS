/**
 * WASM dispatch bridge for Bessel J/Y array kernels (Slice 3.10c-1).
 *
 * Kernels exposed:
 *   - `bessel_j0_f64` — J0(x) applied element-wise over a Float64Array
 *   - `bessel_j1_f64` — J1(x) applied element-wise
 *   - `bessel_j_f64`  — J_n(x) applied element-wise (fixed integer order n)
 *   - `bessel_y0_f64` — Y0(x) applied element-wise
 *   - `bessel_y1_f64` — Y1(x) applied element-wise
 *   - `bessel_y_f64`  — Y_n(x) applied element-wise (fixed integer order n)
 *
 * Behavior:
 *   - When `wasmLoader.getModule()` returns null the helper returns the JS
 *     fallback result without throwing.
 *   - When the loaded module exposes the Rust export, operands are marshalled
 *     into WASM-owned memory, the kernel runs, and a JS-side copy is returned.
 *   - AS-backend parity is **deferred** (Slice 3.10c-2 TODO below).  If no
 *     Rust kernel is found the JS fallback runs transparently.
 *   - Any thrown error is swallowed and the JS fallback runs — the WASM tier
 *     is an optimisation, not a correctness requirement.
 *
 * TODO (Slice 3.10c-2 — deferred): Add AssemblyScript parity port in
 *   `assembly/src/special.ts` and register `bessel_j0_f64_as` etc. in
 *   WasmLoader.ts.  The `_as`-suffix probe below is already wired so the
 *   bridge will automatically pick up the AS variant once it lands.
 *
 * Threshold:
 *   The pointer-marshal overhead (2 memcpys in + 1 out) pays off for arrays
 *   of ≥ 1024 elements.  Verified empirically; see
 *   `tools/benchmark/wasm/special.bench.ts`.
 */

import { wasmLoader, type WasmModule } from '../WasmLoader.js';

/**
 * Element-count threshold above which we attempt the WASM Bessel kernels.
 */
export const WASM_SPECIAL_THRESHOLD = 1024;

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

// Rust-backend function type signatures (pointer-style calling convention).
type RustJ01Fn = (xsPtr: number, n: number, outPtr: number) => number;
type RustJnFn = (order: number, xsPtr: number, nElems: number, outPtr: number) => number;

// ---------------------------------------------------------------------------
// Pure-JS fallback implementations
// ---------------------------------------------------------------------------

/** JS fallback: J0(x) for all x. */
export function besselJ0JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _besselJ0(xs[i]);
  }
  return out;
}

/** JS fallback: J1(x) for all x. */
export function besselJ1JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _besselJ1(xs[i]);
  }
  return out;
}

/** JS fallback: J_n(x) for all x. */
export function besselJnJS(n: number, xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _besselJn(n, xs[i]);
  }
  return out;
}

/** JS fallback: Y0(x) for all x (NaN for x ≤ 0). */
export function besselY0JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _besselY0(xs[i]);
  }
  return out;
}

/** JS fallback: Y1(x) for all x (NaN for x ≤ 0). */
export function besselY1JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _besselY1(xs[i]);
  }
  return out;
}

/** JS fallback: Y_n(x) for all x (NaN for x ≤ 0). */
export function besselYnJS(n: number, xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _besselYn(n, xs[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public dispatch helpers
// ---------------------------------------------------------------------------

/** Dispatch J0 over an array — WASM above threshold, JS below. */
export function besselJ0Dispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['bessel_j0_f64'] as
          | RustJ01Fn
          | undefined;
        if (typeof rustFn === 'function') {
          const xsAlloc = wasmLoader.allocateFloat64Array(xs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(xsAlloc.ptr, n, outAlloc.ptr);
            if (written === n) {
              return new Float64Array(outAlloc.array);
            }
          } finally {
            wasmLoader.release(xsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return besselJ0JS(xs);
}

/** Dispatch J1 over an array — WASM above threshold, JS below. */
export function besselJ1Dispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['bessel_j1_f64'] as
          | RustJ01Fn
          | undefined;
        if (typeof rustFn === 'function') {
          const xsAlloc = wasmLoader.allocateFloat64Array(xs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(xsAlloc.ptr, n, outAlloc.ptr);
            if (written === n) {
              return new Float64Array(outAlloc.array);
            }
          } finally {
            wasmLoader.release(xsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return besselJ1JS(xs);
}

/** Dispatch J_order over an array — WASM above threshold, JS below. */
export function besselJDispatch(order: number, xs: Float64Array): Float64Array {
  // J0 and J1 have dedicated kernels.
  if (order === 0) return besselJ0Dispatch(xs);
  if (order === 1) return besselJ1Dispatch(xs);

  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['bessel_j_f64'] as
          | RustJnFn
          | undefined;
        if (typeof rustFn === 'function') {
          const xsAlloc = wasmLoader.allocateFloat64Array(xs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(order, xsAlloc.ptr, n, outAlloc.ptr);
            if (written === n) {
              return new Float64Array(outAlloc.array);
            }
          } finally {
            wasmLoader.release(xsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return besselJnJS(order, xs);
}

/** Dispatch Y0 over an array — WASM above threshold, JS below. */
export function besselY0Dispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['bessel_y0_f64'] as
          | RustJ01Fn
          | undefined;
        if (typeof rustFn === 'function') {
          const xsAlloc = wasmLoader.allocateFloat64Array(xs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(xsAlloc.ptr, n, outAlloc.ptr);
            if (written === n) {
              return new Float64Array(outAlloc.array);
            }
          } finally {
            wasmLoader.release(xsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return besselY0JS(xs);
}

/** Dispatch Y1 over an array — WASM above threshold, JS below. */
export function besselY1Dispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['bessel_y1_f64'] as
          | RustJ01Fn
          | undefined;
        if (typeof rustFn === 'function') {
          const xsAlloc = wasmLoader.allocateFloat64Array(xs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(xsAlloc.ptr, n, outAlloc.ptr);
            if (written === n) {
              return new Float64Array(outAlloc.array);
            }
          } finally {
            wasmLoader.release(xsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return besselY1JS(xs);
}

/** Dispatch Y_order over an array — WASM above threshold, JS below. */
export function besselYDispatch(order: number, xs: Float64Array): Float64Array {
  // Y0 and Y1 have dedicated kernels.
  if (order === 0) return besselY0Dispatch(xs);
  if (order === 1) return besselY1Dispatch(xs);

  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['bessel_y_f64'] as
          | RustJnFn
          | undefined;
        if (typeof rustFn === 'function') {
          const xsAlloc = wasmLoader.allocateFloat64Array(xs);
          const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
          try {
            const written = rustFn(order, xsAlloc.ptr, n, outAlloc.ptr);
            if (written === n) {
              return new Float64Array(outAlloc.array);
            }
          } finally {
            wasmLoader.release(xsAlloc.ptr, true);
            wasmLoader.release(outAlloc.ptr, true);
          }
        }
      } catch {
        // fall through
      }
    }
  }
  return besselYnJS(order, xs);
}

/**
 * Test-only hook — re-exported so tests can reset loader state
 * without importing WasmLoader directly.
 */
export function resetBesselWasm(): void {
  wasmLoader.reset();
}

// ---------------------------------------------------------------------------
// Internal scalar implementations (mirrors typed/special.ts besselXScalar)
// These are used by the JS fallback loops so this file is self-contained.
// ---------------------------------------------------------------------------

function _besselJ0(x: number): number {
  x = Math.abs(x);
  if (x < 8.0) {
    const y = x * x;
    const a1 =
      57568490574.0 +
      y *
        (-13362590354.0 +
          y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const a2 =
      57568490411.0 +
      y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y))));
    return a1 / a2;
  }
  const z = 8.0 / x;
  const y = z * z;
  const xx = x - 0.785398164;
  const a1 =
    1.0 +
    y *
      (-0.001098628627 +
        y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)));
  const a2 =
    -0.01562499995 +
    y *
      (0.0001430488765 +
        y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934935152)));
  return Math.sqrt(0.636619772 / x) * (Math.cos(xx) * a1 - z * Math.sin(xx) * a2);
}

function _besselJ1(x: number): number {
  const sign = x < 0.0 ? -1.0 : 1.0;
  x = Math.abs(x);
  if (x < 8.0) {
    const y = x * x;
    const a1 =
      x *
      (72362614232.0 +
        y *
          (-7895059235.0 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const a2 =
      144725228442.0 +
      y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return (sign * a1) / a2;
  }
  const z = 8.0 / x;
  const y = z * z;
  const xx = x - 2.356194491;
  const a1 =
    1.0 +
    y * (0.00183105 + y * (-0.00003516396496 + y * (0.000002457520174 - y * 0.0000002404127372)));
  const a2 =
    0.04687499995 +
    y *
      (-0.0002002690873 +
        y * (0.000008449199096 + y * (-0.0000008820898866 + y * 0.0000001057874125)));
  return sign * Math.sqrt(0.636619772 / x) * (Math.cos(xx) * a1 - z * Math.sin(xx) * a2);
}

function _besselJn(n: number, x: number): number {
  const ni = Math.abs(Math.round(n));
  const sign = n < 0 && ni % 2 !== 0 ? -1.0 : 1.0;
  if (ni === 0) return sign * _besselJ0(x);
  if (ni === 1) return sign * _besselJ1(x);
  if (Math.abs(x) < 1e-15) return 0.0;
  if (ni <= 20 || Math.abs(x) > ni) {
    // Forward recurrence
    let jPrev = _besselJ0(x);
    let jCurr = _besselJ1(x);
    for (let k = 1; k < ni; k++) {
      const jNext = ((2.0 * k) / x) * jCurr - jPrev;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return sign * jCurr;
  }
  // Miller backward recurrence
  const extra = Math.max(10, Math.floor(Math.sqrt(40.0 * ni)));
  const nStart = ni + 2 * extra;
  let jNext = 0.0;
  let jCurr = 1.0;
  let resultVal = 0.0;
  let sum = 0.0;
  for (let k = nStart; k >= 0; k--) {
    const jPrev = ((2.0 * (k + 1)) / x) * jCurr - jNext;
    jNext = jCurr;
    jCurr = jPrev;
    if (k === ni) resultVal = jNext;
    if (k % 2 === 0) sum += jCurr;
  }
  sum = 2.0 * sum - jCurr;
  return sign * (resultVal / sum);
}

function _besselY0(x: number): number {
  if (x <= 0.0) return NaN;
  if (x < 8.0) {
    const y = x * x;
    const a1 =
      -2957821389.0 +
      y *
        (7062834065.0 +
          y * (-512359803.6 + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
    const a2 =
      40076544269.0 +
      y * (745249964.8 + y * (7189466.438 + y * (47447.2647 + y * (226.1030244 + y))));
    return a1 / a2 + 0.636619772 * _besselJ0(x) * Math.log(x);
  }
  const z = 8.0 / x;
  const y = z * z;
  const xx = x - 0.785398164;
  const a1 =
    1.0 +
    y *
      (-0.001098628627 +
        y * (0.00002734510407 + y * (-0.000002073370639 + y * 0.0000002093887211)));
  const a2 =
    -0.01562499995 +
    y *
      (0.0001430488765 +
        y * (-0.000006911147651 + y * (0.0000007621095161 - y * 0.0000000934935152)));
  return Math.sqrt(0.636619772 / x) * (Math.sin(xx) * a1 + z * Math.cos(xx) * a2);
}

function _besselY1(x: number): number {
  if (x <= 0.0) return NaN;
  if (x < 8.0) {
    const y = x * x;
    const a1 =
      x *
      (-4900604943000.0 +
        y *
          (1275274390000.0 +
            y * (-51534381390.0 + y * (734926455.1 + y * (-4237922.726 + y * 8511.937935)))));
    const a2 =
      24909857380000.0 +
      y *
        (424441966400.0 +
          y * (3733650367.0 + y * (22459040.02 + y * (102042.605 + y * (354.9632885 + y)))));
    return a1 / a2 + 0.636619772 * (_besselJ1(x) * Math.log(x) - 1.0 / x);
  }
  const z = 8.0 / x;
  const y = z * z;
  const xx = x - 2.356194491;
  const a1 =
    1.0 +
    y * (0.00183105 + y * (-0.00003516396496 + y * (0.000002457520174 - y * 0.0000002404127372)));
  const a2 =
    0.04687499995 +
    y *
      (-0.0002002690873 +
        y * (0.000008449199096 + y * (-0.0000008820898866 + y * 0.0000001057874125)));
  return Math.sqrt(0.636619772 / x) * (Math.sin(xx) * a1 + z * Math.cos(xx) * a2);
}

function _besselYn(n: number, x: number): number {
  if (x <= 0.0) return NaN;
  const ni = Math.abs(Math.round(n));
  const sign = n < 0 && ni % 2 !== 0 ? -1.0 : 1.0;
  if (ni === 0) return sign * _besselY0(x);
  if (ni === 1) return sign * _besselY1(x);
  // Forward recurrence
  let yPrev = _besselY0(x);
  let yCurr = _besselY1(x);
  for (let k = 1; k < ni; k++) {
    const yNext = ((2.0 * k) / x) * yCurr - yPrev;
    yPrev = yCurr;
    yCurr = yNext;
  }
  return sign * yCurr;
}

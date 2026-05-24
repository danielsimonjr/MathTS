/**
 * WASM dispatch bridge for Bessel J/Y and Airy Ai/Bi array kernels.
 *
 * Kernels exposed (Bessel — Slice 3.10c-1; Airy — Slice 4.9):
 *   - `bessel_j0_f64` — J0(x) applied element-wise over a Float64Array
 *   - `bessel_j1_f64` — J1(x) applied element-wise
 *   - `bessel_j_f64`  — J_n(x) applied element-wise (fixed integer order n)
 *   - `bessel_y0_f64` — Y0(x) applied element-wise
 *   - `bessel_y1_f64` — Y1(x) applied element-wise
 *   - `bessel_y_f64`  — Y_n(x) applied element-wise (fixed integer order n)
 *   - `airy_ai_f64`   — Ai(x) applied element-wise
 *   - `airy_bi_f64`   — Bi(x) applied element-wise
 *
 * Dispatch order (for arrays ≥ WASM_SPECIAL_THRESHOLD = 1024 elements):
 *   1. Probe Rust export (pointer-style ABI).
 *   2. If absent, probe AS export (`*_as` suffix, typed-array ABI).
 *   3. Fall back to pure-JS implementation.
 *
 * AS parity (Slice 4.9): `assembly/src/special.ts` implements all 8 kernels
 *   with the same algorithms.  The `_as`-suffix probes below pick them up
 *   automatically when the AS WASM binary is loaded
 *   (MATHJS_WASM_BACKEND=assemblyscript).
 *
 * Any thrown error is swallowed and the JS fallback runs — the WASM tier
 * is an optimisation, not a correctness requirement.
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

/** JS fallback: Ai(x) for all x. */
export function airyAiJS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _airyAi(xs[i]);
  }
  return out;
}

/** JS fallback: Bi(x) for all x. */
export function airyBiJS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = _airyBi(xs[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public dispatch helpers
// ---------------------------------------------------------------------------

/** Dispatch J0 over an array — Rust WASM above threshold, then AS, then JS. */
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
        // fall through to AS probe
      }
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['bessel_j0_f64_as'] as
          | ((xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') return asFn(xs);
      } catch {
        // fall through to JS
      }
    }
  }
  return besselJ0JS(xs);
}

/** Dispatch J1 over an array — Rust WASM above threshold, then AS, then JS. */
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
        // fall through to AS probe
      }
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['bessel_j1_f64_as'] as
          | ((xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') return asFn(xs);
      } catch {
        // fall through to JS
      }
    }
  }
  return besselJ1JS(xs);
}

/** Dispatch J_order over an array — Rust WASM, then AS, then JS. */
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
        // fall through to AS probe
      }
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['bessel_jn_f64_as'] as
          | ((n: number, xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') return asFn(order, xs);
      } catch {
        // fall through to JS
      }
    }
  }
  return besselJnJS(order, xs);
}

/** Dispatch Y0 over an array — Rust WASM, then AS, then JS. */
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
        // fall through to AS probe
      }
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['bessel_y0_f64_as'] as
          | ((xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') return asFn(xs);
      } catch {
        // fall through to JS
      }
    }
  }
  return besselY0JS(xs);
}

/** Dispatch Y1 over an array — Rust WASM, then AS, then JS. */
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
        // fall through to AS probe
      }
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['bessel_y1_f64_as'] as
          | ((xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') return asFn(xs);
      } catch {
        // fall through to JS
      }
    }
  }
  return besselY1JS(xs);
}

/** Dispatch Y_order over an array — Rust WASM, then AS, then JS. */
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
        // fall through to AS probe
      }
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['bessel_yn_f64_as'] as
          | ((n: number, xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') return asFn(order, xs);
      } catch {
        // fall through to JS
      }
    }
  }
  return besselYnJS(order, xs);
}

/** Dispatch Ai(x) over an array — WASM above threshold, JS below. */
export function airyAiDispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      // Probe Rust (pointer-style)
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['airy_ai_f64'] as
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
        // fall through to AS probe
      }
      // Probe AS (typed-array style)
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['airy_ai_f64_as'] as
          | ((xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') {
          return asFn(xs);
        }
      } catch {
        // fall through to JS
      }
    }
  }
  return airyAiJS(xs);
}

/** Dispatch Bi(x) over an array — WASM above threshold, JS below. */
export function airyBiDispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm();
    if (wasm) {
      // Probe Rust (pointer-style)
      try {
        const rustFn = (wasm as unknown as Record<string, unknown>)['airy_bi_f64'] as
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
        // fall through to AS probe
      }
      // Probe AS (typed-array style)
      try {
        const asFn = (wasm as unknown as Record<string, unknown>)['airy_bi_f64_as'] as
          | ((xs: Float64Array) => Float64Array)
          | undefined;
        if (typeof asFn === 'function') {
          return asFn(xs);
        }
      } catch {
        // fall through to JS
      }
    }
  }
  return airyBiJS(xs);
}

/**
 * Test-only hook — re-exported so tests can reset loader state
 * without importing WasmLoader directly.
 */
export function resetBesselWasm(): void {
  wasmLoader.reset();
}

/**
 * Test-only alias for Airy reset (uses same singleton).
 */
export function resetAiryWasm(): void {
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

// ---------------------------------------------------------------------------
// Airy scalar implementations (mirrors special/functions.rs :: airy_ai/bi)
// ---------------------------------------------------------------------------

// Ai(0) = 1/(3^{2/3}·Γ(2/3))
const _AI0 = 0.35502805388781723926;
// −Ai′(0) = 1/(3^{1/3}·Γ(1/3))
const _AI_PRIME0 = 0.25881940379280679841;
// Switch-over for asymptotic expansion
const _XBIG = 4.5;
// Asymptotic coefficients c_k (k = 0..6)
const _AIRY_C = [
  1.0,
  5.0 / 72.0,
  385.0 / 10368.0,
  85085.0 / 2239488.0,
  37182145.0 / 644972544.0,
  5765760010.25 / 61917364224.0,
  1519768071625.0 / 8918845788160.0,
];

/** Airy function Ai(x) — small |x|: power series (DLMF §9.2.2). */
function _airyAiSeries(x: number): number {
  const x3 = x * x * x;
  let f = 1.0;
  let g = x;
  let fTerm = 1.0;
  let gTerm = x;
  let factF = 1.0;
  let factG = 1.0;
  let prodF = 1.0;
  let prodG = 1.0;
  for (let k = 1; k <= 30; k++) {
    factF *= (3 * k - 2) * (3 * k - 1) * (3 * k);
    factG *= (3 * k - 1) * (3 * k) * (3 * k + 1);
    prodF *= 3 * k - 2;
    prodG *= 3 * k - 1;
    fTerm *= x3;
    gTerm *= x3;
    const df = (fTerm * prodF) / factF;
    const dg = (gTerm * prodG) / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  return _AI0 * f - _AI_PRIME0 * g;
}

/** Airy function Ai(x) — large positive x: asymptotic decay (DLMF §9.7.3). */
function _airyAiLargePos(x: number): number {
  const xp = Math.pow(x, 0.25);
  const zeta = (2.0 / 3.0) * x * Math.sqrt(x);
  let p = 0.0;
  let zk = 1.0;
  let sign = 1.0;
  for (const ck of _AIRY_C) {
    p += (sign * ck) / zk;
    zk *= zeta;
    sign = -sign;
  }
  return (Math.exp(-zeta) * p) / (2.0 * Math.sqrt(Math.PI) * xp);
}

/** Airy function Ai(x) — large negative x: oscillatory asymptotic (DLMF §9.7.5). */
function _airyAiLargeNeg(x: number): number {
  const ax = Math.abs(x);
  const axp = Math.pow(ax, 0.25);
  const zeta = (2.0 / 3.0) * ax * Math.sqrt(ax);
  const theta = zeta - Math.PI / 4.0;
  let p = 0.0;
  let q = 0.0;
  let zk = 1.0;
  let sign = 1.0;
  for (let k = 0; k < _AIRY_C.length; k++) {
    if (k % 2 === 0) p += (sign * _AIRY_C[k]) / zk;
    else q += (sign * _AIRY_C[k]) / zk;
    zk *= zeta;
    sign = -sign;
  }
  return (Math.sin(theta) * p + Math.cos(theta) * q) / (Math.sqrt(Math.PI) * axp);
}

function _airyAi(x: number): number {
  if (x > _XBIG) return _airyAiLargePos(x);
  if (x < -_XBIG) return _airyAiLargeNeg(x);
  return _airyAiSeries(x);
}

/** Airy function Bi(x) — small |x|: power series. */
function _airyBiSeries(x: number): number {
  const x3 = x * x * x;
  let f = 1.0;
  let g = x;
  let fTerm = 1.0;
  let gTerm = x;
  let factF = 1.0;
  let factG = 1.0;
  let prodF = 1.0;
  let prodG = 1.0;
  for (let k = 1; k <= 30; k++) {
    factF *= (3 * k - 2) * (3 * k - 1) * (3 * k);
    factG *= (3 * k - 1) * (3 * k) * (3 * k + 1);
    prodF *= 3 * k - 2;
    prodG *= 3 * k - 1;
    fTerm *= x3;
    gTerm *= x3;
    const df = (fTerm * prodF) / factF;
    const dg = (gTerm * prodG) / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  return Math.sqrt(3.0) * (_AI0 * f + _AI_PRIME0 * g);
}

/** Airy function Bi(x) — large positive x: asymptotic growth (DLMF §9.7.3). */
function _airyBiLargePos(x: number): number {
  const xp = Math.pow(x, 0.25);
  const zeta = (2.0 / 3.0) * x * Math.sqrt(x);
  let p = 0.0;
  let zk = 1.0;
  for (const ck of _AIRY_C) {
    p += ck / zk;
    zk *= zeta;
  }
  return (Math.exp(zeta) * p) / (Math.sqrt(Math.PI) * xp);
}

/** Airy function Bi(x) — large negative x: oscillatory asymptotic (DLMF §9.7.5). */
function _airyBiLargeNeg(x: number): number {
  const ax = Math.abs(x);
  const axp = Math.pow(ax, 0.25);
  const zeta = (2.0 / 3.0) * ax * Math.sqrt(ax);
  const theta = zeta + Math.PI / 4.0;
  let p = 0.0;
  let q = 0.0;
  let zk = 1.0;
  let sign = 1.0;
  for (let k = 0; k < _AIRY_C.length; k++) {
    if (k % 2 === 0) p += (sign * _AIRY_C[k]) / zk;
    else q += (sign * _AIRY_C[k]) / zk;
    zk *= zeta;
    sign = -sign;
  }
  return (Math.cos(theta) * p + Math.sin(theta) * q) / (Math.sqrt(Math.PI) * axp);
}

function _airyBi(x: number): number {
  if (x > _XBIG) return _airyBiLargePos(x);
  if (x < -_XBIG) return _airyBiLargeNeg(x);
  return _airyBiSeries(x);
}

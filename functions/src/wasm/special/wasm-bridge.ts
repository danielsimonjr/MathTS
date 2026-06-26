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

import { wasmLoader } from '../WasmLoader.js';
import {
  getWasm,
  isRustWasm,
  isAsWasm,
  withAsF64,
  asReadReturnedF64,
  makeUnaryArrayDispatch,
  type RawWasm,
} from '../bridges/common.js';

/**
 * Element-count threshold above which we attempt the WASM Bessel kernels.
 */
export const WASM_SPECIAL_THRESHOLD = 1024;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Rust-backend function type signatures (pointer-style calling convention).
// The Carlson R-forms + incomplete-elliptic kernels share the uniform
// (ptr1..ptrN, n, outPtr) ABI handled generically by `multiArrayDispatch`.
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

/**
 * Dispatch J0/J1/Y0/Y1 — and the order-fixed J_n/Y_n — over an array.
 * Rust pointer kernel (gated) → AS managed kernel → JS. All AS special kernels
 * here bit-/tol-match the JS reference to ≤1e-12 (verified Phase 3b), so they
 * are repointed via the shared `makeUnaryArrayDispatch` factory.
 */
export const besselJ0Dispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'bessel_j0_f64',
  js: besselJ0JS,
});
export const besselJ1Dispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'bessel_j1_f64',
  js: besselJ1JS,
});

/** Order-`n` (`n ≥ 2`) variant of an AS managed `<name>(order, xs)` kernel. */
function besselOrderDispatch(
  order: number,
  xs: Float64Array,
  rustName: string,
  asName: string,
  js: (n: number, xs: Float64Array) => Float64Array
): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm) {
      try {
        if (isRustWasm(wasm)) {
          const rustFn = wasm[rustName] as RustJnFn | undefined;
          if (typeof rustFn === 'function') {
            const xsAlloc = wasmLoader.allocateFloat64Array(xs);
            const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
            try {
              const written = rustFn(order, xsAlloc.ptr, n, outAlloc.ptr);
              if (written === n) return new Float64Array(outAlloc.array);
            } finally {
              wasmLoader.release(xsAlloc.ptr, true);
              wasmLoader.release(outAlloc.ptr, true);
            }
          }
        } else if (isAsWasm(wasm)) {
          // AS managed ABI: <asName>(order, xs) -> Float64Array.
          const out = withAsF64(wasm, [xs], (mod, [h]) =>
            asReadReturnedF64(mod, (mod[asName] as (o: number, x: number) => number)(order, h))
          );
          if (out) return out;
        }
      } catch {
        // fall through to JS
      }
    }
  }
  return js(order, xs);
}

/** Dispatch J_order over an array — Rust WASM, then AS managed, then JS. */
export function besselJDispatch(order: number, xs: Float64Array): Float64Array {
  if (order === 0) return besselJ0Dispatch(xs);
  if (order === 1) return besselJ1Dispatch(xs);
  return besselOrderDispatch(order, xs, 'bessel_j_f64', 'bessel_jn_f64', besselJnJS);
}

export const besselY0Dispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'bessel_y0_f64',
  js: besselY0JS,
});
export const besselY1Dispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'bessel_y1_f64',
  js: besselY1JS,
});

/** Dispatch Y_order over an array — Rust WASM, then AS managed, then JS. */
export function besselYDispatch(order: number, xs: Float64Array): Float64Array {
  if (order === 0) return besselY0Dispatch(xs);
  if (order === 1) return besselY1Dispatch(xs);
  return besselOrderDispatch(order, xs, 'bessel_y_f64', 'bessel_yn_f64', besselYnJS);
}

/**
 * Dispatch Ai(x) / Bi(x) over an array.
 *
 * The Rust pointer kernel is kept (gated). The AS managed Airy kernels are
 * deliberately NOT routed to: in the asymptotic region (|x|>5) they diverge
 * from the JS reference by ~1e-6 relative (verified Phase 3b) — above the 1e-12
 * bar — so under the AS binary these fall through to the validated JS series /
 * asymptotic implementation. Re-enable once assembly/src's Airy asymptotic
 * matches JS.
 */
export function airyAiDispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isRustWasm(wasm)) {
      const out = runRustUnarySpecial(wasm, 'airy_ai_f64', xs);
      if (out) return out;
    }
  }
  return airyAiJS(xs);
}

export function airyBiDispatch(xs: Float64Array): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isRustWasm(wasm)) {
      const out = runRustUnarySpecial(wasm, 'airy_bi_f64', xs);
      if (out) return out;
    }
  }
  return airyBiJS(xs);
}

/** Rust pointer-ABI runner: `<name>(xsPtr, n, outPtr) -> written`; null unless written===n. */
function runRustUnarySpecial(wasm: RawWasm, name: string, xs: Float64Array): Float64Array | null {
  const rustFn = wasm[name] as RustJ01Fn | undefined;
  if (typeof rustFn !== 'function') return null;
  const n = xs.length;
  const xsAlloc = wasmLoader.allocateFloat64Array(xs);
  const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
  try {
    const written = rustFn(xsAlloc.ptr, n, outAlloc.ptr);
    return written === n ? new Float64Array(outAlloc.array) : null;
  } catch {
    return null;
  } finally {
    wasmLoader.release(xsAlloc.ptr, true);
    wasmLoader.release(outAlloc.ptr, true);
  }
}

// ---------------------------------------------------------------------------
// lgamma array kernel (Slice 5.8)
//
// lgamma(x) = log Gamma(x).  Poles at non-positive integers → +Infinity.
// Negative non-integer: reflection formula already handled in both Rust and AS.
// ---------------------------------------------------------------------------

/** JS fallback: lgamma(x) = log Gamma(x) for all x. */
function _lgamma(x: number): number {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    const sinPiX = Math.abs(Math.sin(Math.PI * x));
    if (sinPiX === 0) return Infinity;
    return Math.log(Math.PI / sinPiX) - _lgamma(1 - x);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  const xm1 = x - 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (xm1 + i);
  const t = xm1 + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a);
}

/** JS fallback: lgamma(x) applied element-wise. */
export function lgammaJS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _lgamma(xs[i]);
  return out;
}

/**
 * Dispatch lgamma over an array — Rust WASM above threshold, then AS, then JS.
 *
 * For arrays ≥ WASM_SPECIAL_THRESHOLD (1024):
 *   1. Probe Rust `lgamma_f64` (pointer-style).
 *   2. If absent, probe AS `lgamma_f64` (typed-array style, suffix `_as`).
 *   3. Fall back to pure-JS `lgammaJS`.
 */
export const lgammaDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'lgamma_f64',
  js: lgammaJS,
});

// ===========================================================================
// Carlson Symmetric Forms — Slice 6.4
//
// JS fallbacks mirror the duplication-theorem algorithm from
// wasm-rust/crates/mathts-wasm/src/special/functions.rs :: carlson_*.
// Numerical Recipes §6.11; tolerance 0.0015; ≤ 30 iterations.
// ===========================================================================

function _carlsonRC(x: number, y: number): number {
  // RC is RF(x, y, y) — pure duplication, no external sum accumulation.
  // Algorithm: Carlson (1995) §2, duplication theorem for RC.
  // Reference: DLMF §19.20.3 — RC(x, y) = (1/2)∫_0^∞ (t+x)^{-1/2}(t+y)^{-1} dt
  if (x < 0 || y <= 0) return NaN;
  let xx = x;
  let yy = y;
  for (let i = 0; i < 50; i++) {
    const lam = 2.0 * Math.sqrt(xx * yy) + yy;
    xx = (xx + lam) / 4.0;
    yy = (yy + lam) / 4.0;
    const ave = (xx + 2.0 * yy) / 3.0;
    const dx = (ave - xx) / ave;
    const dy = (ave - yy) / ave;
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
      // Taylor series for RC (Carlson 1995, eq. 2.7)
      const s = dx * dx * (3.0 + dx * (1.0 + dx * (0.75 + dx * (9.0 / 22.0))));
      return (1.0 + s) / Math.sqrt(ave);
    }
  }
  return 1.0 / Math.sqrt(yy);
}

function _carlsonRF(x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z < 0) return NaN;
  let xx = x;
  let yy = y;
  let zz = z;
  for (let i = 0; i < 50; i++) {
    const sx = Math.sqrt(xx);
    const sy = Math.sqrt(yy);
    const sz = Math.sqrt(zz);
    const lam = sx * sy + sy * sz + sz * sx;
    xx = (xx + lam) / 4.0;
    yy = (yy + lam) / 4.0;
    zz = (zz + lam) / 4.0;
    const ave = (xx + yy + zz) / 3.0;
    const dx = (ave - xx) / ave;
    const dy = (ave - yy) / ave;
    const dz = (ave - zz) / ave;
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10 && Math.abs(dz) < 1e-10) {
      const e2 = dx * dy - dz * dz;
      const e3 = dx * dy * dz;
      return (
        (1.0 + e2 * (-0.1 + (3.0 / 44.0) * e2 - (9.0 / 52.0) * e3) + e3 / 14.0) / Math.sqrt(ave)
      );
    }
  }
  return 1.0 / Math.sqrt(zz);
}

function _carlsonRD(x: number, y: number, z: number): number {
  if (x < 0 || y < 0 || z <= 0) return NaN;
  if (x === 0 && y === 0) return NaN;
  // Degenerate case: x=y=z — algorithm converges prematurely; return exact value.
  if (x === y && y === z) return Math.pow(x, -1.5);
  let xx = x;
  let yy = y;
  let zz = z;
  let sum = 0.0;
  let fac = 1.0;
  for (let i = 0; i < 50; i++) {
    const sx = Math.sqrt(xx);
    const sy = Math.sqrt(yy);
    const sz = Math.sqrt(zz);
    const lam = sx * sy + sy * sz + sz * sx;
    sum += fac / (sz * (zz + lam));
    fac /= 4.0;
    xx = (xx + lam) / 4.0;
    yy = (yy + lam) / 4.0;
    zz = (zz + lam) / 4.0;
    const ave = (xx + yy + 3.0 * zz) / 5.0;
    const dx = (ave - xx) / ave;
    const dy = (ave - yy) / ave;
    const dz = (ave - zz) / ave;
    if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10 && Math.abs(dz) < 1e-10) {
      const xy = dx * dy;
      const xz = dx * dz;
      const yz = dy * dz;
      const z2 = dz * dz;
      const e2 = xy - xz - yz - z2;
      const e3 = xy * dz + dz * (xz + yz);
      const e4 = xy * z2;
      const e5 = dz * z2 * dz;
      return (
        3.0 * sum +
        (fac *
          (1.0 +
            e2 * (-3.0 / 14.0) +
            e3 / 6.0 +
            e2 * e2 * (9.0 / 88.0) +
            e4 * (-45.0 / 132.0) -
            e5 * (5.0 / 44.0) +
            e3 * e2 * (-3.0 / 44.0))) /
          (ave * ave * Math.sqrt(ave))
      );
    }
  }
  return 3.0 * sum + fac / (zz * zz * Math.sqrt(zz));
}

function _carlsonRJ(x: number, y: number, z: number, p: number): number {
  if (x < 0 || y < 0 || z < 0 || p === 0) return NaN;
  let xx = x;
  let yy = y;
  let zz = z;
  let pp = p;
  let sum = 0.0;
  let fac = 1.0;
  for (let i = 0; i < 50; i++) {
    const sx = Math.sqrt(xx);
    const sy = Math.sqrt(yy);
    const sz = Math.sqrt(zz);
    const lam = sx * sy + sy * sz + sz * sx;
    const alpha = pp * (sx + sy + sz) + sx * sy * sz;
    const beta = pp * (pp + lam) * (pp + lam);
    sum += fac * _carlsonRC(alpha * alpha, beta);
    fac /= 4.0;
    xx = (xx + lam) / 4.0;
    yy = (yy + lam) / 4.0;
    zz = (zz + lam) / 4.0;
    pp = (pp + lam) / 4.0;
    const ave = (xx + yy + zz + pp + pp) / 5.0;
    const dx = (ave - xx) / ave;
    const dy = (ave - yy) / ave;
    const dz = (ave - zz) / ave;
    const dp = (ave - pp) / ave;
    if (
      Math.abs(dx) < 1e-10 &&
      Math.abs(dy) < 1e-10 &&
      Math.abs(dz) < 1e-10 &&
      Math.abs(dp) < 1e-10
    ) {
      const xyz = dx * dy + dy * dz + dz * dx;
      const p2 = dp * dp;
      const e2 = xyz - 3.0 * p2;
      const e3 = dx * dy * dz + 2.0 * xyz * dp - 3.0 * p2 * dp;
      const e4 = (2.0 * dx * dy * dz + xyz * dp + 3.0 * p2 * dp) * dp;
      const e5 = dx * dy * dz * p2;
      return (
        3.0 * sum +
        (fac *
          (1.0 +
            e2 * (-3.0 / 14.0) +
            e3 / 6.0 +
            e2 * e2 * (9.0 / 88.0) -
            e4 * (45.0 / 132.0) +
            e5 * (-5.0 / 44.0) +
            e3 * e2 * (-3.0 / 44.0))) /
          (ave * ave * Math.sqrt(ave))
      );
    }
  }
  return 3.0 * sum + fac / (pp * pp * Math.sqrt(pp));
}

// ---------------------------------------------------------------------------
// Incomplete elliptic integrals via Carlson forms
// ---------------------------------------------------------------------------

function _ellipticFIncomplete(phi: number, m: number): number {
  if (phi === 0) return 0;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const s2 = s * s;
  const y = 1.0 - m * s2;
  if (y < 0) return NaN;
  return s * _carlsonRF(c * c, y, 1.0);
}

function _ellipticEIncomplete(phi: number, m: number): number {
  if (phi === 0) return 0;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const s2 = s * s;
  const c2 = c * c;
  const y = 1.0 - m * s2;
  if (y < 0) return NaN;
  return s * _carlsonRF(c2, y, 1.0) - (m / 3.0) * s * s2 * _carlsonRD(c2, y, 1.0);
}

function _ellipticPiIncomplete(n: number, phi: number, m: number): number {
  if (phi === 0) return 0;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const s2 = s * s;
  const c2 = c * c;
  const y = 1.0 - m * s2;
  const q = 1.0 - n * s2;
  if (y < 0 || q <= 0) return NaN;
  return s * _carlsonRF(c2, y, 1.0) + (n / 3.0) * s * s2 * _carlsonRJ(c2, y, 1.0, q);
}

// ---------------------------------------------------------------------------
// JS fallback array implementations
// ---------------------------------------------------------------------------

export function carlsonRCJS(xs: Float64Array, ys: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRC(xs[i], ys[i]);
  return out;
}

export function carlsonRFJS(xs: Float64Array, ys: Float64Array, zs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRF(xs[i], ys[i], zs[i]);
  return out;
}

export function carlsonRDJS(xs: Float64Array, ys: Float64Array, zs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRD(xs[i], ys[i], zs[i]);
  return out;
}

export function carlsonRJJS(
  xs: Float64Array,
  ys: Float64Array,
  zs: Float64Array,
  ps: Float64Array
): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRJ(xs[i], ys[i], zs[i], ps[i]);
  return out;
}

export function ellipticFIncompleteJS(phis: Float64Array, ms: Float64Array): Float64Array {
  const out = new Float64Array(phis.length);
  for (let i = 0; i < phis.length; i++) out[i] = _ellipticFIncomplete(phis[i], ms[i]);
  return out;
}

export function ellipticEIncompleteJS(phis: Float64Array, ms: Float64Array): Float64Array {
  const out = new Float64Array(phis.length);
  for (let i = 0; i < phis.length; i++) out[i] = _ellipticEIncomplete(phis[i], ms[i]);
  return out;
}

export function ellipticPiIncompleteJS(
  ns: Float64Array,
  phis: Float64Array,
  ms: Float64Array
): Float64Array {
  const out = new Float64Array(ns.length);
  for (let i = 0; i < ns.length; i++) out[i] = _ellipticPiIncomplete(ns[i], phis[i], ms[i]);
  return out;
}

// ---------------------------------------------------------------------------
// Scalar exports (for TypedFunction scalar overloads)
// ---------------------------------------------------------------------------

export function carlsonRCScalar(x: number, y: number): number {
  return _carlsonRC(x, y);
}
export function carlsonRFScalar(x: number, y: number, z: number): number {
  return _carlsonRF(x, y, z);
}
export function carlsonRDScalar(x: number, y: number, z: number): number {
  return _carlsonRD(x, y, z);
}
export function carlsonRJScalar(x: number, y: number, z: number, p: number): number {
  return _carlsonRJ(x, y, z, p);
}
export function ellipticFIncompleteScalar(phi: number, m: number): number {
  return _ellipticFIncomplete(phi, m);
}
export function ellipticEIncompleteScalar(phi: number, m: number): number {
  return _ellipticEIncomplete(phi, m);
}
export function ellipticPiIncompleteScalar(n: number, phi: number, m: number): number {
  return _ellipticPiIncomplete(n, phi, m);
}

// ---------------------------------------------------------------------------
// WASM dispatch helpers — Carlson R-forms (Slice 6.4)
//
// Multi-array Rust kernels use pointer-style ABI with multiple input ptrs.
// AS kernels use typed-array calling convention (same function signatures
// as the AS exports in assembly/src/special.ts).
// ---------------------------------------------------------------------------

/**
 * Shared multi-array dispatch for the Carlson R-forms and incomplete elliptic
 * integrals. All share the uniform ABI: Rust pointer `fn(ptr1..ptrN, n, outPtr)
 * -> written`; AS managed `fn(h1..hN) -> Float64Array`. Rust is gated behind
 * `isRustWasm`; under AS the managed call is used; otherwise JS. All AS kernels
 * here tol-match the JS reference to ≤1e-12 (verified Phase 3b).
 */
function multiArrayDispatch(
  name: string,
  inputs: Float64Array[],
  js: () => Float64Array
): Float64Array {
  const n = inputs[0].length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm) {
      try {
        if (isRustWasm(wasm)) {
          const rustFn = wasm[name] as ((...a: number[]) => number) | undefined;
          if (typeof rustFn === 'function') {
            const allocs = inputs.map((a) => wasmLoader.allocateFloat64Array(a));
            const outAlloc = wasmLoader.allocateFloat64ArrayEmpty(n);
            try {
              const written = rustFn(...allocs.map((a) => a.ptr), n, outAlloc.ptr);
              if (written === n) return new Float64Array(outAlloc.array);
            } finally {
              for (const a of allocs) wasmLoader.release(a.ptr, true);
              wasmLoader.release(outAlloc.ptr, true);
            }
          }
        } else if (isAsWasm(wasm)) {
          const out = withAsF64(wasm, inputs, (mod, headers) =>
            asReadReturnedF64(mod, (mod[name] as (...h: number[]) => number)(...headers))
          );
          if (out) return out;
        }
      } catch {
        /* fall through to JS */
      }
    }
  }
  return js();
}

/** Dispatch RC(x, y) element-wise — Rust (gated) → AS managed → JS. */
export function carlsonRCDispatch(xs: Float64Array, ys: Float64Array): Float64Array {
  return multiArrayDispatch('carlson_rc_f64', [xs, ys], () => carlsonRCJS(xs, ys));
}

/** Dispatch RF(x, y, z) element-wise. */
export function carlsonRFDispatch(
  xs: Float64Array,
  ys: Float64Array,
  zs: Float64Array
): Float64Array {
  return multiArrayDispatch('carlson_rf_f64', [xs, ys, zs], () => carlsonRFJS(xs, ys, zs));
}

/** Dispatch RD(x, y, z) element-wise. */
export function carlsonRDDispatch(
  xs: Float64Array,
  ys: Float64Array,
  zs: Float64Array
): Float64Array {
  return multiArrayDispatch('carlson_rd_f64', [xs, ys, zs], () => carlsonRDJS(xs, ys, zs));
}

/** Dispatch RJ(x, y, z, p) element-wise. */
export function carlsonRJDispatch(
  xs: Float64Array,
  ys: Float64Array,
  zs: Float64Array,
  ps: Float64Array
): Float64Array {
  return multiArrayDispatch('carlson_rj_f64', [xs, ys, zs, ps], () => carlsonRJJS(xs, ys, zs, ps));
}

/** Dispatch F(φ, m) element-wise. */
export function ellipticFIncompleteDispatch(phis: Float64Array, ms: Float64Array): Float64Array {
  return multiArrayDispatch('elliptic_f_incomplete_f64', [phis, ms], () =>
    ellipticFIncompleteJS(phis, ms)
  );
}

/** Dispatch E(φ, m) (incomplete) element-wise. */
export function ellipticEIncompleteDispatch(phis: Float64Array, ms: Float64Array): Float64Array {
  return multiArrayDispatch('elliptic_e_incomplete_f64', [phis, ms], () =>
    ellipticEIncompleteJS(phis, ms)
  );
}

/** Dispatch Π(n, φ, m) element-wise. */
export function ellipticPiIncompleteDispatch(
  ns: Float64Array,
  phis: Float64Array,
  ms: Float64Array
): Float64Array {
  return multiArrayDispatch('elliptic_pi_incomplete_f64', [ns, phis, ms], () =>
    ellipticPiIncompleteJS(ns, phis, ms)
  );
}

export function resetCarlsonWasm(): void {
  wasmLoader.reset();
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

/**
 * Test-only alias for Elliptic reset (uses same singleton).
 */
export function resetEllipticWasm(): void {
  wasmLoader.reset();
}

/**
 * Test-only alias for lgamma reset (uses same singleton).
 */
export function resetLgammaWasm(): void {
  wasmLoader.reset();
}

// ---------------------------------------------------------------------------
// Elliptic K / E — pure-JS fallbacks (Slice 5.3)
//
// K(m) via AGM: K = π / (2·agm(1, √(1−m)))
// E(m) via Carlson-Bulirsch AGM (same iteration, accumulates Σ 2^k·c_k²)
//
// Domain: m ∈ [0, 1).  K(1)=+∞, E(1)=1.  m<0 or m>1 → NaN.
// ---------------------------------------------------------------------------

/** JS implementation of K(m) — complete elliptic integral of the first kind. */
function _ellipticK(m: number): number {
  if (isNaN(m)) return NaN;
  if (m < 0.0 || m > 1.0) return NaN;
  if (m === 1.0) return Infinity;
  if (m === 0.0) return Math.PI / 2.0;
  let a = 1.0;
  let b = Math.sqrt(1.0 - m);
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2.0;
    const bNew = Math.sqrt(a * b);
    if (Math.abs(aNew - bNew) < 1e-16 * aNew) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  return Math.PI / (2.0 * a);
}

/** JS implementation of E(m) — complete elliptic integral of the second kind. */
function _ellipticE(m: number): number {
  if (isNaN(m)) return NaN;
  if (m < 0.0 || m > 1.0) return NaN;
  if (m === 0.0) return Math.PI / 2.0;
  if (m === 1.0) return 1.0;
  let a = 1.0;
  let b = Math.sqrt(1.0 - m);
  let sum = m; // 2^0 · c_0² = m (c_0 = √m, c_0² = m)
  let pow2 = 1.0;
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2.0;
    const bNew = Math.sqrt(a * b);
    const cNew = (a - b) / 2.0;
    pow2 *= 2.0;
    sum += pow2 * cNew * cNew;
    if (Math.abs(cNew) < 1e-16 * aNew) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  const k = Math.PI / (2.0 * a);
  return k * (1.0 - 0.5 * sum);
}

/** JS fallback: K(m) applied element-wise. */
export function ellipticKJS(ms: Float64Array): Float64Array {
  const out = new Float64Array(ms.length);
  for (let i = 0; i < ms.length; i++) {
    out[i] = _ellipticK(ms[i]);
  }
  return out;
}

/** JS fallback: E(m) applied element-wise. */
export function ellipticEJS(ms: Float64Array): Float64Array {
  const out = new Float64Array(ms.length);
  for (let i = 0; i < ms.length; i++) {
    out[i] = _ellipticE(ms[i]);
  }
  return out;
}

/** Dispatch K(m) over an array — Rust (gated) → AS managed → JS. */
export const ellipticKDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'elliptic_k_f64',
  js: ellipticKJS,
});

/** Dispatch E(m) over an array — Rust (gated) → AS managed → JS. */
export const ellipticEDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'elliptic_e_f64',
  js: ellipticEJS,
});

// ---------------------------------------------------------------------------
// Internal scalar implementations (mirrors typed/special.ts besselXScalar)
// These are used by the JS fallback loops so this file is self-contained.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bessel J/Y JS fallback — ascending series (|x| <= 13) + Hankel asymptotic.
// Mirrors assembly/src/special.ts and functions/src/typed/special.ts (kept in
// sync; validated to <1e-9 vs mpmath). These run on the main thread, so unlike
// the special.ts scalars they may share module-level helpers/constants.
// ---------------------------------------------------------------------------
const _SF_GAMMA = 0.5772156649015328606;
const _SF_2_PI = 0.63661977236758134308;
const _SF_1_PI = 0.31830988618379067154;
const _BESSEL_SERIES_MAX = 13.0;

function _besselHankel(nu: number, x: number, wantY: boolean): number {
  const mu = 4 * nu * nu;
  let P = 1.0;
  let Q = 0.0;
  let a = 1.0;
  let xk = 1.0;
  let prevMag = Infinity;
  for (let k = 1; k <= 40; k++) {
    const t1 = 2 * k - 1;
    a = (a * (mu - t1 * t1)) / (8 * k);
    xk *= x;
    const t = a / xk;
    if (Math.abs(t) > prevMag) break;
    prevMag = Math.abs(t);
    const m4 = k & 3;
    const s = m4 === 1 || m4 === 0 ? 1.0 : -1.0;
    if ((k & 1) === 1) Q += s * t;
    else P += s * t;
  }
  const chi = x - (nu * 0.5 + 0.25) * Math.PI;
  const amp = Math.sqrt(2.0 / (Math.PI * x));
  return wantY
    ? amp * (P * Math.sin(chi) + Q * Math.cos(chi))
    : amp * (P * Math.cos(chi) - Q * Math.sin(chi));
}

function _besselJ0Series(x: number): number {
  const z = -0.25 * x * x;
  let term = 1.0;
  let sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * k);
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return sum;
}

function _besselJ1Series(x: number): number {
  const z = -0.25 * x * x;
  let term = 1.0;
  let sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * (k + 1));
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return 0.5 * x * sum;
}

function _besselY0Series(x: number): number {
  const z = 0.25 * x * x;
  let u = 1.0;
  let h = 0.0;
  let s = 0.0;
  let sign = 1.0;
  for (let k = 1; k <= 80; k++) {
    u *= z / (k * k);
    h += 1 / k;
    s += sign * h * u;
    sign = -sign;
    if (k > 2 && Math.abs(h * u) <= Math.abs(s) * 1e-17) break;
  }
  return _SF_2_PI * ((Math.log(0.5 * x) + _SF_GAMMA) * _besselJ0Series(x) + s);
}

function _besselY1Series(x: number): number {
  const z = -0.25 * x * x;
  let v = 0.5 * x;
  let hk = 0.0;
  let hk1 = 1.0;
  let s = (hk + hk1) * v;
  for (let k = 1; k <= 80; k++) {
    v *= z / (k * (k + 1));
    hk += 1 / k;
    hk1 += 1 / (k + 1);
    s += (hk + hk1) * v;
    if (k > 2 && Math.abs((hk + hk1) * v) <= Math.abs(s) * 1e-17) break;
  }
  return (
    _SF_2_PI * (Math.log(0.5 * x) + _SF_GAMMA) * _besselJ1Series(x) - _SF_2_PI / x - _SF_1_PI * s
  );
}

function _besselJ0(x: number): number {
  const ax = Math.abs(x);
  return ax <= _BESSEL_SERIES_MAX ? _besselJ0Series(ax) : _besselHankel(0, ax, false);
}

function _besselJ1(x: number): number {
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1;
  const val = ax <= _BESSEL_SERIES_MAX ? _besselJ1Series(ax) : _besselHankel(1, ax, false);
  return sign * val;
}

function _besselY0(x: number): number {
  if (x <= 0.0) return NaN;
  return x <= _BESSEL_SERIES_MAX ? _besselY0Series(x) : _besselHankel(0, x, true);
}

function _besselY1(x: number): number {
  if (x <= 0.0) return NaN;
  return x <= _BESSEL_SERIES_MAX ? _besselY1Series(x) : _besselHankel(1, x, true);
}

function _besselJn(n: number, x: number): number {
  const ni = Math.abs(Math.round(n));
  const sign = n < 0 && ni % 2 !== 0 ? -1.0 : 1.0;
  if (ni === 0) return sign * _besselJ0(x);
  if (ni === 1) return sign * _besselJ1(x);
  if (Math.abs(x) < 1e-15) return 0.0;
  // Upward recurrence is stable only when x > n; else use Miller's backward.
  if (Math.abs(x) > ni) {
    let jPrev = _besselJ0(x);
    let jCurr = _besselJ1(x);
    for (let k = 1; k < ni; k++) {
      const jNext = ((2.0 * k) / x) * jCurr - jPrev;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return sign * jCurr;
  }
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
    if (k === ni) resultVal = jCurr; // jCurr = J_k after the assignment
    if (k % 2 === 0) sum += jCurr;
  }
  sum = 2.0 * sum - jCurr;
  return sign * (resultVal / sum);
}

function _besselYn(n: number, x: number): number {
  if (x <= 0.0) return NaN;
  const ni = Math.abs(Math.round(n));
  const sign = n < 0 && ni % 2 !== 0 ? -1.0 : 1.0;
  if (ni === 0) return sign * _besselY0(x);
  if (ni === 1) return sign * _besselY1(x);
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
// Airy scalar JS fallback — series for |x| <= 5, asymptotic with recurrence-
// generated u_k coefficients (DLMF 9.7.2) beyond.
// ---------------------------------------------------------------------------
const _AI0 = 0.35502805388781723926;
const _AI_PRIME0 = 0.25881940379280679841;
const _XBIG = 5.0;
const _AIRY_U = ((): number[] => {
  const u = [1];
  for (let k = 1; k <= 12; k++) {
    u.push((u[k - 1] * ((6 * k - 5) * (6 * k - 3) * (6 * k - 1))) / ((2 * k - 1) * 216 * k));
  }
  return u;
})();

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
  for (let k = 1; k <= 40; k++) {
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
  for (let k = 1; k <= 40; k++) {
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

// Positive x: Ai ~ e^{-z}/(2 sqrt(pi) x^{1/4}) Sum (-1)^k u_k/z^k;
//             Bi ~ e^{z}/(sqrt(pi) x^{1/4}) Sum u_k/z^k.
function _airyAsymPos(x: number, isAi: boolean): number {
  const xp = Math.pow(x, 0.25);
  const zeta = (2.0 / 3.0) * x * Math.sqrt(x);
  let p = 0.0;
  let zk = 1.0;
  let sign = 1.0;
  let prevMag = Infinity;
  for (const uk of _AIRY_U) {
    const t = uk / zk;
    if (Math.abs(t) > prevMag) break;
    prevMag = Math.abs(t);
    p += isAi ? sign * t : t;
    zk *= zeta;
    sign = -sign;
  }
  const sp = Math.sqrt(Math.PI);
  return isAi ? (Math.exp(-zeta) * p) / (2.0 * sp * xp) : (Math.exp(zeta) * p) / (sp * xp);
}

// Negative x: theta = z - pi/4; P = Sum (-1)^j u_{2j}/z^{2j}, Q = Sum (-1)^j u_{2j+1}/z^{2j+1}.
//   Ai(-|x|) = (cos t P + sin t Q)/(sqrt(pi) |x|^{1/4}); Bi(-|x|) = (-sin t P + cos t Q)/...
function _airyAsymNeg(x: number, isAi: boolean): number {
  const ax = Math.abs(x);
  const axp = Math.pow(ax, 0.25);
  const zeta = (2.0 / 3.0) * ax * Math.sqrt(ax);
  let P = 0.0;
  let Q = 0.0;
  let pTerm = Infinity;
  let qTerm = Infinity;
  const half = Math.floor((_AIRY_U.length - 1) / 2);
  for (let k = 0; k <= half; k++) {
    const t = ((k % 2 === 0 ? 1 : -1) * _AIRY_U[2 * k]) / Math.pow(zeta, 2 * k);
    if (Math.abs(t) > Math.abs(pTerm)) break;
    P += t;
    pTerm = t;
  }
  for (let k = 0; k <= half - 1; k++) {
    const t = ((k % 2 === 0 ? 1 : -1) * _AIRY_U[2 * k + 1]) / Math.pow(zeta, 2 * k + 1);
    if (Math.abs(t) > Math.abs(qTerm)) break;
    Q += t;
    qTerm = t;
  }
  const theta = zeta - Math.PI / 4.0;
  const sp = Math.sqrt(Math.PI);
  return isAi
    ? (Math.cos(theta) * P + Math.sin(theta) * Q) / (sp * axp)
    : (-Math.sin(theta) * P + Math.cos(theta) * Q) / (sp * axp);
}

function _airyAi(x: number): number {
  if (x > _XBIG) return _airyAsymPos(x, true);
  if (x < -_XBIG) return _airyAsymNeg(x, true);
  return _airyAiSeries(x);
}

function _airyBi(x: number): number {
  if (x > _XBIG) return _airyAsymPos(x, false);
  if (x < -_XBIG) return _airyAsymNeg(x, false);
  return _airyBiSeries(x);
}

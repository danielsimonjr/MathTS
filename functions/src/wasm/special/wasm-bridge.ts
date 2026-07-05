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
 *   1. AS managed kernel (the binary the functions package bundles).
 *   2. Fall back to pure-JS implementation.
 *
 * AS parity (Slice 4.9): `assembly/src/special.ts` implements the Bessel/Y and
 *   lgamma/elliptic kernels with the same algorithms, validated ≤1e-12 vs the JS
 *   reference. (Airy is the exception — see `airyAiDispatch`/`airyBiDispatch`,
 *   which stay on JS pending a Phase 6 AS asymptotic fix.) The legacy
 *   native-pointer path was removed from this bridge in the Phase 5 AS cutover.
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
  isAsWasm,
  withAsF64,
  asReadReturnedF64,
  makeUnaryArrayDispatch,
  type RawWasm,
} from '../bridges/common.js';
import {
  _lgamma,
  besselJ0Scalar,
  besselJ1Scalar,
  besselJScalar,
  besselY0Scalar,
  besselY1Scalar,
  besselYScalar,
  airyAiScalar,
  airyBiScalar,
  ellipticKScalar,
  ellipticECompleteScalar,
} from './scalars.js';

/**
 * Element-count threshold above which we attempt the WASM Bessel kernels.
 */
export const WASM_SPECIAL_THRESHOLD = 1024;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Pure-JS fallback implementations
// ---------------------------------------------------------------------------

// The element-wise JS fallbacks below delegate to the canonical scalars in
// ./scalars.ts (the single source of truth shared with typed/special.ts), so
// the ≥-threshold array fallback can never numerically diverge from the scalar
// / sub-threshold path.

/** JS fallback: J0(x) for all x. */
export function besselJ0JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = besselJ0Scalar(xs[i]);
  }
  return out;
}

/** JS fallback: J1(x) for all x. */
export function besselJ1JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = besselJ1Scalar(xs[i]);
  }
  return out;
}

/** JS fallback: J_n(x) for all x. */
export function besselJnJS(n: number, xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = besselJScalar(n, xs[i]);
  }
  return out;
}

/** JS fallback: Y0(x) for all x (NaN for x ≤ 0). */
export function besselY0JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = besselY0Scalar(xs[i]);
  }
  return out;
}

/** JS fallback: Y1(x) for all x (NaN for x ≤ 0). */
export function besselY1JS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = besselY1Scalar(xs[i]);
  }
  return out;
}

/** JS fallback: Y_n(x) for all x (NaN for x ≤ 0). */
export function besselYnJS(n: number, xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = besselYScalar(n, xs[i]);
  }
  return out;
}

/** JS fallback: Ai(x) for all x. */
export function airyAiJS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = airyAiScalar(xs[i]);
  }
  return out;
}

/** JS fallback: Bi(x) for all x. */
export function airyBiJS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    out[i] = airyBiScalar(xs[i]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public dispatch helpers
// ---------------------------------------------------------------------------

/**
 * Dispatch J0/J1/Y0/Y1 — and the order-fixed J_n/Y_n — over an array.
 * AS managed kernel → JS. All AS special kernels here bit-/tol-match the JS
 * reference to ≤1e-12 (verified Phase 3b), so they are repointed via the shared
 * `makeUnaryArrayDispatch` factory.
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
  asName: string,
  js: (n: number, xs: Float64Array) => Float64Array
): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        // AS managed ABI: <asName>(order, xs) -> Float64Array.
        const out = withAsF64(wasm, [xs], (mod, [h]) =>
          asReadReturnedF64(mod, (mod[asName] as (o: number, x: number) => number)(order, h))
        );
        if (out) return out;
      } catch {
        // fall through to JS
      }
    }
  }
  return js(order, xs);
}

/** Dispatch J_order over an array — AS managed, then JS. */
export function besselJDispatch(order: number, xs: Float64Array): Float64Array {
  if (order === 0) return besselJ0Dispatch(xs);
  if (order === 1) return besselJ1Dispatch(xs);
  return besselOrderDispatch(order, xs, 'bessel_jn_f64', besselJnJS);
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

/** Dispatch Y_order over an array — AS managed, then JS. */
export function besselYDispatch(order: number, xs: Float64Array): Float64Array {
  if (order === 0) return besselY0Dispatch(xs);
  if (order === 1) return besselY1Dispatch(xs);
  return besselOrderDispatch(order, xs, 'bessel_yn_f64', besselYnJS);
}

/**
 * Dispatch Ai(x) / Bi(x) over an array — AS managed → JS (Phase 6).
 *
 * The AS Airy asymptotic kernel now mirrors the JS reference exactly: its
 * asymptotic sum is capped at the same 13-term (u_0..u_12) truncation as the
 * JS `_airyAsymPos` / `_airyAsymNeg` table (see `AIRY_U_MAX` in
 * assembly/src/special.ts). Previously the AS kernel generated u_k by recurrence
 * and ran to its own optimal truncation (k≈15 near x≈5), diverging ~1e-7 from
 * the JS value it is meant to match. With the cap, AS vs JS agree to ≈4e-16
 * (relative) across the |x|>5 region (verified Phase 6), so these are repointed
 * via the shared `makeUnaryArrayDispatch` factory (JS fallback retained).
 */
export const airyAiDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'airy_ai_f64',
  js: airyAiJS,
});

export const airyBiDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'airy_bi_f64',
  js: airyBiJS,
});

// ---------------------------------------------------------------------------
// lgamma array kernel (Slice 5.8)
//
// lgamma(x) = log Gamma(x).  Poles at non-positive integers → +Infinity.
// Negative non-integer: reflection formula already handled in both the AS
// kernel and the JS fallback.
// ---------------------------------------------------------------------------

/** JS fallback: lgamma(x) applied element-wise (canonical `_lgamma`). */
export function lgammaJS(xs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _lgamma(xs[i]);
  return out;
}

/**
 * Dispatch lgamma over an array — AS managed above threshold, then JS.
 *
 * For arrays ≥ WASM_SPECIAL_THRESHOLD (1024):
 *   1. AS managed `lgamma_f64` kernel (the binary the functions package bundles).
 *   2. Fall back to pure-JS `lgammaJS`.
 */
export const lgammaDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'lgamma_f64',
  js: lgammaJS,
});

// ===========================================================================
// Carlson Symmetric Forms — Slice 6.4
//
// JS fallbacks mirror the duplication-theorem algorithm from the original native
// `special/functions :: carlson_*` (removed in the migration).
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
// Multi-array AS kernels use the managed typed-array calling convention (same
// function signatures as the AS exports in assembly/src/special.ts), marshalled
// via the shared `withAsF64` helper.
// ---------------------------------------------------------------------------

/**
 * Shared multi-array dispatch for the Carlson R-forms and incomplete elliptic
 * integrals. All share the AS managed ABI: `fn(h1..hN) -> Float64Array`. Under
 * the AS binary the managed call is used; otherwise JS. All AS kernels here
 * tol-match the JS reference to ≤1e-12 (verified Phase 3b).
 */
function multiArrayDispatch(
  name: string,
  inputs: Float64Array[],
  js: () => Float64Array
): Float64Array {
  const n = inputs[0].length;
  if (n >= WASM_SPECIAL_THRESHOLD) {
    const wasm = getWasm() as unknown as RawWasm | null;
    if (wasm && isAsWasm(wasm)) {
      try {
        const out = withAsF64(wasm, inputs, (mod, headers) =>
          asReadReturnedF64(mod, (mod[name] as (...h: number[]) => number)(...headers))
        );
        if (out) return out;
      } catch {
        /* fall through to JS */
      }
    }
  }
  return js();
}

/** Dispatch RC(x, y) element-wise — AS managed → JS. */
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

/** JS fallback: K(m) applied element-wise (canonical `ellipticKScalar`). */
export function ellipticKJS(ms: Float64Array): Float64Array {
  const out = new Float64Array(ms.length);
  for (let i = 0; i < ms.length; i++) {
    out[i] = ellipticKScalar(ms[i]);
  }
  return out;
}

/** JS fallback: E(m) applied element-wise (canonical `ellipticECompleteScalar`). */
export function ellipticEJS(ms: Float64Array): Float64Array {
  const out = new Float64Array(ms.length);
  for (let i = 0; i < ms.length; i++) {
    out[i] = ellipticECompleteScalar(ms[i]);
  }
  return out;
}

/** Dispatch K(m) over an array — AS managed → JS. */
export const ellipticKDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'elliptic_k_f64',
  js: ellipticKJS,
});

/** Dispatch E(m) over an array — AS managed → JS. */
export const ellipticEDispatch = makeUnaryArrayDispatch({
  threshold: WASM_SPECIAL_THRESHOLD,
  name: 'elliptic_e_f64',
  js: ellipticEJS,
});

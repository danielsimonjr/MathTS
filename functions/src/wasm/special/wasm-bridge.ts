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
 * Dispatch order (arrays at or above each export's `WASM_SPECIAL_THRESHOLD`):
 *   1. If `wasmPolicyAllows(<kernel>, n)` is true (`functions/src/wasm/policy.ts`,
 *      measured 2026-09-26 with two Node runs of
 *      `node tools/benchmark/wasm/run-node.mjs opt-in`), call the AS managed kernel.
 *   2. Otherwise run the pure-JS implementation (including when the module is loaded).
 *
 * AS parity (Slice 4.9): `assembly/src/special.ts` implements the Bessel/Y and
 *   lgamma/elliptic kernels with the same algorithms, validated ≤1e-12 vs the JS
 *   reference. (Airy was the last holdout — its AS asymptotic series needed the
 *   Phase 6 truncation cap, after which AS vs JS agree to ≈4e-16; see the note
 *   above `airyAiDispatch`, which now routes to AS like its siblings.) The legacy
 *   native-pointer path was removed from this bridge in the Phase 5 AS cutover.
 *
 * Any thrown error is swallowed and the JS fallback runs — the WASM tier
 * is an optimisation, not a correctness requirement.
 *
 * Threshold constant:
 *   `WASM_SPECIAL_THRESHOLD` (1024) is when the bridge is consulted; only kernels
 *   listed in `wasmPolicyAllows` actually call AS (today `lgamma_f64` at n ≥ 1_048_576;
 *   Bessel/Airy/elliptic/Carlson exports are absent from the policy and stay JS).
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
  cosPiScalar,
  sinPiScalar,
  besselJUnderflows,
  besselYLogBound,
  besselIPlan,
  besselKGate,
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
import { wasmPolicyAllows } from '../policy.js';
import { MAX_BESSEL_J_SWEEP, MAX_RECURRENCE_ORDER, assertArrayWork } from '../../utils/limits.js';

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

/** The largest order that an AS kernel takes: its order is an i32. */
const AS_MAX_ORDER = 2147483647;

/**
 * Whether the AS `bessel_jn_f64` kernel gives the JS result for `order`. The kernel takes an
 * i32, so a non-integer or larger order would wrap or truncate. Its downward sweep has the
 * limit of the JS scalar and aborts above it, so an order whose sweep exceeds that limit stays
 * on the JS path, which throws the RangeError (or returns 0 for a small x) for each element.
 */
function besselJKernelTakes(order: number): boolean {
  if (!Number.isInteger(order)) return false;
  return besselJSweepStart(Math.abs(order)) <= MAX_BESSEL_J_SWEEP;
}

/** Whether the AS `bessel_yn_f64` kernel gives the JS result for `order` (an i32 integer). */
function besselYKernelTakes(order: number): boolean {
  return Number.isInteger(order) && Math.abs(order) <= AS_MAX_ORDER;
}

// ---------------------------------------------------------------------------
// Work bound of one array call (#1132)
// ---------------------------------------------------------------------------

/** The order above which `besselJScalar` and `besselYScalar` throw a RangeError by themselves. */
const SCALAR_ORDER_LIMIT = 2_500_000_000;

/** One downward-sweep step costs this many upward steps (the ratio of the two limits). */
const SWEEP_WEIGHT = MAX_RECURRENCE_ORDER / MAX_BESSEL_J_SWEEP;

/** The start order of the downward sweep of `besselJScalar` for the integer order `ni`. */
function besselJSweepStart(ni: number): number {
  return ni + 2 * Math.max(10, Math.ceil(Math.sqrt(40 * ni)));
}

/**
 * Recurrence steps that `besselJScalar(ni, x)` or `besselYScalar(ni, x)` runs for an integer
 * order `ni` in `[2, 2.5e9]`, in units of one upward step. A call that ends at once (a NaN or
 * infinite x, a zero result, a non-positive x for Y) and a call that throws by itself count 0.
 */
function besselElementSteps(kind: 'besselJ' | 'besselY', ni: number, x: number): number {
  if (!Number.isFinite(x)) return 0;
  const ax = Math.abs(x);
  if (kind === 'besselY') {
    if (x <= 0) return 0;
    // The overflow bound of besselYScalar returns -Infinity before any loop.
    if (besselYLogBound(ni, x) > 709.79) return 0;
    // Past k = 2x every step multiplies Y_k by more than 3, so the value overflows within
    // about 2000 more steps, and the scalar ends there.
    return Math.min(ni, 2 * Math.ceil(ax) + 2000);
  }
  // The zero bound and the power series of besselJScalar: no loop of the order.
  if (ax < 1e-15) return 0;
  if (besselJUnderflows(ni, ax)) return 0;
  if (ax > ni) return ni;
  const start = besselJSweepStart(ni);
  return start > MAX_BESSEL_J_SWEEP ? 0 : start * SWEEP_WEIGHT;
}

/**
 * Recurrence steps that `besselJScalar(nu, x)` or `besselYScalar(nu, x)` runs for a non-integer
 * order `nu` of absolute value at most 2.5e9, in units of one upward step. The zero and overflow
 * bounds, the O(1) Hankel shortcut and a non-positive or non-finite x count 0, as in the scalar.
 * Below x = 25 the Temme engine runs two loops of about `an - x + 1.5` steps. From x = 25 the
 * Hankel start runs one recurrence of `an` steps (J of an order at most x, or Y), and two for a
 * negative order and for J of an order above x (CF1 and the Y recurrence).
 */
function besselRealElementSteps(kind: 'besselJ' | 'besselY', nu: number, x: number): number {
  if (!(x > 0) || x === Infinity) return 0;
  const an = Math.abs(nu);
  const bound = besselYLogBound(an, x);
  if (kind === 'besselJ') {
    if (nu > 0) {
      if (besselJUnderflows(an, x)) return 0;
    } else if (Math.log(Math.abs(sinPiScalar(an))) + bound > 709.79) {
      return 0;
    }
  } else if (nu > 0) {
    if (bound > 709.79) return 0;
  } else {
    const c = cosPiScalar(an);
    if (c !== 0 && Math.log(Math.abs(c)) + bound > 709.79) return 0;
  }
  if (x > 1e5 && x > 4 * an * an) return 0;
  if (x < 25) return 2 * Math.max(0, an - x + 1.5);
  return nu < 0 || (kind === 'besselJ' && an > x) ? 2 * an : an;
}

/**
 * Throw a RangeError when one array call of `besselJ` or `besselY` needs more recurrence steps
 * than `MAX_RECURRENCE_ORDER`, the budget of one call (about 20 s). The scalar limits bound one
 * element, so an array of 1024 elements at order 2.4e9 ran for hours, and a non-integer order
 * (`besselJ(1e9 + 0.5, xs)`) ran one full recurrence per element. An integer order below 2
 * runs none. An element whose own call throws keeps its own message.
 *
 * @param kind - `'besselJ'` or `'besselY'`
 * @param n - Order
 * @param xs - Arguments
 * @throws RangeError if the total work is above the maximum
 */
export function assertBesselArrayWork(
  kind: 'besselJ' | 'besselY',
  n: number,
  xs: Float64Array
): void {
  // Olver's large-order expansion needs a fixed number of operations per element.
  if (Math.abs(n) >= 1000000) return;

  const ni = Math.abs(n);
  if (!Number.isInteger(n)) {
    // A NaN or infinite order gives NaN at once, and an order above the limit throws in the scalar.
    if (!Number.isFinite(n) || ni > SCALAR_ORDER_LIMIT) return;
    // One element runs at most 2 ni + 3 steps (besselRealElementSteps).
    if ((2 * ni + 3) * xs.length <= MAX_RECURRENCE_ORDER) return;
    let realSteps = 0;
    for (let i = 0; i < xs.length; i++) {
      realSteps += besselRealElementSteps(kind, n, xs[i]);
    }
    assertArrayWork(kind, n, xs.length, Math.ceil(realSteps), MAX_RECURRENCE_ORDER);
    return;
  }
  if (ni < 2 || ni > SCALAR_ORDER_LIMIT) return;
  // Most calls pass here: the largest possible total is within the budget.
  const perElement = kind === 'besselY' ? ni : Math.max(ni, besselJSweepStart(ni) * SWEEP_WEIGHT);
  if (perElement * xs.length <= MAX_RECURRENCE_ORDER) return;
  let steps = 0;
  for (let i = 0; i < xs.length; i++) {
    steps += besselElementSteps(kind, ni, xs[i]);
  }
  assertArrayWork(kind, n, xs.length, Math.ceil(steps), MAX_RECURRENCE_ORDER);
}

/**
 * Throw a RangeError when one array call of `besselI` needs more than `MAX_RECURRENCE_ORDER`
 * steps in total, as `assertBesselArrayWork` does for J and Y. One element runs the product and
 * the series (`besselIPlan`: nu + 2 m steps, 0 when a gate returns at once) and, for a negative
 * real order, the recurrence of K (at most an steps, and it ends within 2000 steps past 2 x).
 * An order above the limit and a NaN or infinite order are the scalar's.
 */
export function assertBesselIArrayWork(n: number, xs: Float64Array): void {
  const an = Math.abs(n);
  if (!Number.isFinite(n) || an > SCALAR_ORDER_LIMIT) return;
  // m <= x / 2, so one element runs at most an + |x| steps: most calls pass here.
  let xmax = 0;
  for (let i = 0; i < xs.length; i++) {
    const ax = Math.abs(xs[i]);
    if (ax > xmax && ax < Infinity) xmax = ax;
  }
  if ((an + xmax) * xs.length <= MAX_RECURRENCE_ORDER) return;
  const integer = Number.isInteger(n);
  let steps = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const ax = Math.abs(x);
    if (!(ax > 0) || ax === Infinity || (x < 0 && !integer)) continue;
    const plan = besselIPlan(an, ax);
    steps += plan[1];
    if (n < 0 && !integer) steps += Math.min(an, 2 * Math.ceil(ax) + 2000);
  }
  assertArrayWork('besselI', n, xs.length, Math.ceil(steps), MAX_RECURRENCE_ORDER);
}

/**
 * The array guard of besselK: the recurrence runs about |n| steps for each element that the gate
 * (`besselKGate`) does not decide, and the total is held to MAX_RECURRENCE_ORDER. An order
 * above the limit is left to the scalar (its gate or its RangeError).
 */
export function assertBesselKArrayWork(n: number, xs: Float64Array): void {
  const an = Math.abs(n);
  if (!Number.isFinite(n) || an > SCALAR_ORDER_LIMIT || an * xs.length <= MAX_RECURRENCE_ORDER) {
    return;
  }
  let steps = 0;
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    if (x > 0 && x < Infinity && besselKGate(an, x, 1) === 0) steps += an;
  }
  assertArrayWork('besselK', n, xs.length, Math.ceil(steps), MAX_RECURRENCE_ORDER);
}

/** Order-`n` (`n ≥ 2`) variant of an AS managed `<name>(order, xs)` kernel. */
function besselOrderDispatch(
  order: number,
  xs: Float64Array,
  asName: string,
  js: (n: number, xs: Float64Array) => Float64Array,
  kernelTakes: (order: number) => boolean
): Float64Array {
  const n = xs.length;
  if (n >= WASM_SPECIAL_THRESHOLD && kernelTakes(order) && wasmPolicyAllows(asName, n)) {
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
  return besselOrderDispatch(order, xs, 'bessel_jn_f64', besselJnJS, besselJKernelTakes);
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
  return besselOrderDispatch(order, xs, 'bessel_yn_f64', besselYnJS, besselYKernelTakes);
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
 * Dispatch lgamma over an array — bridge at WASM_SPECIAL_THRESHOLD, AS only when
 * `wasmPolicyAllows('lgamma_f64', n)` (n ≥ 1_048_576 per `policy.ts`), else `lgammaJS`.
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

/**
 * Compute the Carlson integral RC(x, y) for each pair of elements, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with `x < 0` or `y <= 0` gives NaN.
 */
export function carlsonRCJS(xs: Float64Array, ys: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRC(xs[i], ys[i]);
  return out;
}

/**
 * Compute the Carlson integral RF(x, y, z) for each element triple, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with a negative argument gives NaN.
 */
export function carlsonRFJS(xs: Float64Array, ys: Float64Array, zs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRF(xs[i], ys[i], zs[i]);
  return out;
}

/**
 * Compute the Carlson integral RD(x, y, z) for each element triple, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with `x < 0`, `y < 0`, `z <= 0`, or `x` and `y` both 0 gives NaN.
 */
export function carlsonRDJS(xs: Float64Array, ys: Float64Array, zs: Float64Array): Float64Array {
  const out = new Float64Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = _carlsonRD(xs[i], ys[i], zs[i]);
  return out;
}

/**
 * Compute the Carlson integral RJ(x, y, z, p) for each element set, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with a negative `x`, `y` or `z`, or with `p` equal to 0, gives NaN.
 */
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

/**
 * Compute the incomplete elliptic integral of the first kind F(phi | m) for each element
 * pair, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with `1 - m sin^2(phi) < 0` gives NaN.
 */
export function ellipticFIncompleteJS(phis: Float64Array, ms: Float64Array): Float64Array {
  const out = new Float64Array(phis.length);
  for (let i = 0; i < phis.length; i++) out[i] = _ellipticFIncomplete(phis[i], ms[i]);
  return out;
}

/**
 * Compute the incomplete elliptic integral of the second kind E(phi | m) for each element
 * pair, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with `1 - m sin^2(phi) < 0` gives NaN.
 */
export function ellipticEIncompleteJS(phis: Float64Array, ms: Float64Array): Float64Array {
  const out = new Float64Array(phis.length);
  for (let i = 0; i < phis.length; i++) out[i] = _ellipticEIncomplete(phis[i], ms[i]);
  return out;
}

/**
 * Compute the incomplete elliptic integral of the third kind Pi(n; phi | m) for each
 * element set, in JavaScript.
 *
 * The function reads element `i` of each input array and writes element `i` of a new
 * array. It does not change the inputs.
 * An element with `1 - m sin^2(phi) < 0` or `1 - n sin^2(phi) <= 0` gives NaN.
 */
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

/** Return the Carlson integral RC(x, y). The result is NaN if `x < 0` or `y <= 0`. */
export function carlsonRCScalar(x: number, y: number): number {
  return _carlsonRC(x, y);
}
/** Return the Carlson integral RF(x, y, z). The result is NaN if an argument is negative. */
export function carlsonRFScalar(x: number, y: number, z: number): number {
  return _carlsonRF(x, y, z);
}
/**
 * Return the Carlson integral RD(x, y, z).
 *
 * The result is NaN if `x < 0`, `y < 0`, `z <= 0`, or `x` and `y` are both 0.
 */
export function carlsonRDScalar(x: number, y: number, z: number): number {
  return _carlsonRD(x, y, z);
}
/**
 * Return the Carlson integral RJ(x, y, z, p).
 *
 * The result is NaN if `x`, `y` or `z` is negative, or if `p` is 0.
 */
export function carlsonRJScalar(x: number, y: number, z: number, p: number): number {
  return _carlsonRJ(x, y, z, p);
}
/**
 * Return the incomplete elliptic integral of the first kind F(phi | m).
 *
 * The result is 0 if `phi` is 0, and NaN if `1 - m sin^2(phi) < 0`.
 */
export function ellipticFIncompleteScalar(phi: number, m: number): number {
  return _ellipticFIncomplete(phi, m);
}
/**
 * Return the incomplete elliptic integral of the second kind E(phi | m).
 *
 * The result is 0 if `phi` is 0, and NaN if `1 - m sin^2(phi) < 0`.
 */
export function ellipticEIncompleteScalar(phi: number, m: number): number {
  return _ellipticEIncomplete(phi, m);
}
/**
 * Return the incomplete elliptic integral of the third kind Pi(n; phi | m).
 *
 * The result is 0 if `phi` is 0. It is NaN if `1 - m sin^2(phi) < 0` or
 * `1 - n sin^2(phi) <= 0`.
 */
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
  if (n >= WASM_SPECIAL_THRESHOLD && wasmPolicyAllows(name, n)) {
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

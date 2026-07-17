/* eslint-disable no-loss-of-precision -- the Glaisher-Kinkelin constant (Barnes
   G asymptotic expansion) is written at full precision and rounds to the
   nearest IEEE-754 double, matching the pattern in typed/special.ts. */
/**
 * Niche special functions: polylogarithm, Struve H/L, Kelvin ber/bei (order
 * 0), and the Barnes G-function.
 *
 * These are lower-traffic special functions with narrower validity domains
 * than the Bessel/Airy/elliptic families in `typed/special.ts`. They follow
 * the same plain-exported-function pattern as `hypergeometric.ts` and
 * `polygamma-orthopoly.ts` — pure `number -> number` (or `number, number ->
 * number`) math, no typed-function array/WASM dispatch overloads.
 *
 * @packageDocumentation
 */

import { _lgamma } from '../wasm/special/scalars.js';

/** 64-bit float (default for decimals) */
type f64 = number;

/** Hard cap on the number of series terms accumulated. */
const MAX_TERMS = 10000;

/** Relative convergence tolerance: stop once |term| < RELTOL * |sum|. */
const RELTOL = 1e-16;

// =============================================================================
// Polylogarithm
// =============================================================================

/**
 * Polylogarithm Li_s(z), computed via its defining series (DLMF 25.12.10):
 *
 *   Li_s(z) = sum_{k=1}^inf z^k / k^s
 *
 * which converges for `|z| < 1` (any real `s`). Analytic continuation to
 * `|z| >= 1` (needed for e.g. the dilogarithm's reflection formulas) is
 * **out of scope** — this throws rather than silently returning a wrong or
 * divergent value.
 *
 * Special value: `Li_1(z) = -ln(1 - z)`.
 *
 * @param s - Order (any real number)
 * @param z - Argument, must satisfy `|z| < 1`
 * @returns Li_s(z)
 * @throws {Error} If `|z| >= 1`
 *
 * @example
 * polylog(2, 0.5) // ~0.5822405265 (dilogarithm)
 * polylog(1, 0.5) // ~0.6931471806 (= -ln(0.5) = ln 2)
 */
export function polylog(s: f64, z: f64): f64 {
  if (Math.abs(z) >= 1) {
    throw new Error('polylog: only |z| < 1 is supported (analytic continuation not implemented)');
  }
  if (z === 0) return 0;

  let sum: f64 = 0;
  let zk: f64 = 1;
  for (let k = 1; k <= MAX_TERMS; k++) {
    zk *= z;
    const term = zk / Math.pow(k, s);
    sum += term;
    if (k > 1 && Math.abs(term) < Math.abs(sum) * RELTOL) break;
  }
  return sum;
}

// =============================================================================
// Struve H and modified Struve L functions
// =============================================================================

/**
 * Struve function H_v(z), via its power series (DLMF 11.2.1):
 *
 *   H_v(z) = sum_{k=0}^inf (-1)^k / (Gamma(k+3/2) Gamma(k+v+3/2)) * (z/2)^(2k+v+1)
 *
 * Evaluated by the standard term-recurrence ratio
 * `term_{k+1}/term_k = -(z/2)^2 / ((k+3/2)(k+v+3/2))`, seeded by a single
 * pair of `lgamma` evaluations (avoids recomputing Gamma at every order and
 * avoids overflow from large individual Gamma values).
 *
 * Valid for `z >= 0` and `v > -3/2` (so that `Gamma(v+3/2)` has no pole).
 *
 * @param v - Order (real, `v > -3/2`)
 * @param z - Argument (real, `z >= 0`)
 * @returns H_v(z)
 *
 * @example
 * struveH(0, 1) // ~0.5686566270
 * struveH(1, 2) // ~0.6467637283
 */
export function struveH(v: f64, z: f64): f64 {
  if (z < 0) {
    throw new Error('struveH: z must be >= 0');
  }
  if (z === 0) return 0;

  const halfZ = z / 2;
  const logHalfZ = Math.log(halfZ);
  let term = Math.exp((v + 1) * logHalfZ - _lgamma(1.5) - _lgamma(v + 1.5));
  let sum = term;
  for (let k = 0; k < MAX_TERMS; k++) {
    const ratio = -(halfZ * halfZ) / ((k + 1.5) * (k + v + 1.5));
    term *= ratio;
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * RELTOL) break;
  }
  return sum;
}

/**
 * Modified Struve function L_v(z), via its power series (DLMF 11.2.1):
 *
 *   L_v(z) = sum_{k=0}^inf 1 / (Gamma(k+3/2) Gamma(k+v+3/2)) * (z/2)^(2k+v+1)
 *
 * Same as `struveH` but without the alternating `(-1)^k` sign, so every term
 * is positive and the series grows monotonically for `z > 0` (like a
 * modified Bessel function).
 *
 * Valid for `z >= 0` and `v > -3/2`.
 *
 * @param v - Order (real, `v > -3/2`)
 * @param z - Argument (real, `z >= 0`)
 * @returns L_v(z)
 *
 * @example
 * struveL(0, 1) // ~0.7102431859
 */
export function struveL(v: f64, z: f64): f64 {
  if (z < 0) {
    throw new Error('struveL: z must be >= 0');
  }
  if (z === 0) return 0;

  const halfZ = z / 2;
  const logHalfZ = Math.log(halfZ);
  let term = Math.exp((v + 1) * logHalfZ - _lgamma(1.5) - _lgamma(v + 1.5));
  let sum = term;
  for (let k = 0; k < MAX_TERMS; k++) {
    const ratio = (halfZ * halfZ) / ((k + 1.5) * (k + v + 1.5));
    term *= ratio;
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * RELTOL) break;
  }
  return sum;
}

// =============================================================================
// Kelvin functions ber, bei (order 0)
// =============================================================================

/**
 * Kelvin function ber(x) (order 0), via its power series (DLMF 10.65.1):
 *
 *   ber(x) = sum_{k=0}^inf (-1)^k (x/2)^(4k) / ((2k)!)^2
 *
 * Evaluated by the term-recurrence ratio
 * `term_{k+1}/term_k = -(x/2)^4 / ((2k+1)(2k+2))^2`.
 *
 * @param x - Argument (real)
 * @returns ber(x)
 *
 * @example
 * kelvinBer(0) // 1
 * kelvinBer(2) // ~0.7517341827
 */
export function kelvinBer(x: f64): f64 {
  const halfX = x / 2;
  const halfX4 = halfX * halfX * halfX * halfX;
  let term = 1;
  let sum = term;
  for (let k = 0; k < MAX_TERMS; k++) {
    const denom = (2 * k + 1) * (2 * k + 2);
    term *= -halfX4 / (denom * denom);
    sum += term;
    if (k > 0 && Math.abs(term) < Math.abs(sum) * RELTOL) break;
  }
  return sum;
}

/**
 * Kelvin function bei(x) (order 0), via its power series (DLMF 10.65.1):
 *
 *   bei(x) = sum_{k=0}^inf (-1)^k (x/2)^(4k+2) / ((2k+1)!)^2
 *
 * Evaluated by the term-recurrence ratio
 * `term_{k+1}/term_k = -(x/2)^4 / ((2k+2)(2k+3))^2`.
 *
 * @param x - Argument (real)
 * @returns bei(x)
 *
 * @example
 * kelvinBei(0) // 0
 * kelvinBei(2) // ~0.9722916273
 */
export function kelvinBei(x: f64): f64 {
  const halfX = x / 2;
  const halfX4 = halfX * halfX * halfX * halfX;
  let term = halfX * halfX;
  let sum = term;
  for (let k = 0; k < MAX_TERMS; k++) {
    const denom = (2 * k + 2) * (2 * k + 3);
    term *= -halfX4 / (denom * denom);
    sum += term;
    if (k > 0 && Math.abs(term) < Math.abs(sum) * RELTOL) break;
  }
  return sum;
}

// =============================================================================
// Barnes G-function
// =============================================================================

/** ln(Glaisher-Kinkelin constant A), to full double precision. */
const LN_GLAISHER_A = 0.248754477033784192937342748704521307739020497964;

/** Bernoulli numbers B_4, B_6, B_8, B_10 (used by the ln(G) asymptotic tail). */
const BERNOULLI_TAIL = [-1 / 30, 1 / 42, -1 / 30, 5 / 66];

/** Argument threshold (post-shift) above which the asymptotic expansion is machine-accurate. */
const BARNES_SHIFT_THRESHOLD = 16;

/**
 * ln G(y+1) via the DLMF 5.17.5 asymptotic expansion, for `y` already shifted
 * large enough (see `barnesG`) that the series has converged to machine
 * precision:
 *
 *   ln G(y+1) = y^2/2 * ln(y) - 3y^2/4 + y/2 * ln(2*pi) - 1/12 * ln(y)
 *               + (1/12 - ln A) + sum_{k>=1} B_{2k+2} / (4k(k+1) y^(2k))
 */
function lnBarnesGAsymptotic(y: f64): f64 {
  let sum =
    (y * y * Math.log(y)) / 2 -
    (3 * y * y) / 4 +
    (y / 2) * Math.log(2 * Math.PI) -
    Math.log(y) / 12 +
    (1 / 12 - LN_GLAISHER_A);
  let y2k = y * y;
  for (let k = 1; k <= BERNOULLI_TAIL.length; k++) {
    sum += BERNOULLI_TAIL[k - 1] / (4 * k * (k + 1) * y2k);
    y2k *= y * y;
  }
  return sum;
}

/**
 * Barnes G-function G(z), for real `z > 0`.
 *
 * Uses the functional equation `G(z+1) = Gamma(z) * G(z)` to shift `z` up
 * until it is large enough for the asymptotic expansion of `ln G` (DLMF
 * 5.17.5) to converge to machine precision, then unwinds the shift:
 *
 *   ln G(z) = ln G(z + n) - sum_{k=0}^{n-1} lgamma(z + k)
 *
 * Verified against `mpmath.barnesg` (dps=25) to relative error ~1e-14 across
 * the anchored integer/half-integer test values. Not extended to `z <= 0`
 * (Barnes G has zeros/sign changes on the non-positive real axis that this
 * shift-and-asymptotic approach does not handle) — that domain is out of
 * scope.
 *
 * Known integer values: `G(1) = G(2) = 1`, and in general
 * `G(n+3) = prod_{k=1}^{n} k!` for nonnegative integers `n`
 * (e.g. `G(4) = 2`, `G(5) = 12`, `G(6) = 288`).
 *
 * @param z - Argument (real, `z > 0`)
 * @returns G(z)
 * @throws {Error} If `z <= 0`
 *
 * @example
 * barnesG(4) // 2 (= 1!)
 * barnesG(5) // 12 (= 1! * 2!)
 * barnesG(4.5) // ~4.1862532590
 */
export function barnesG(z: f64): f64 {
  if (z <= 0) {
    throw new Error('barnesG: only z > 0 is supported');
  }

  let shifted = z;
  let sumLgamma = 0;
  while (shifted < BARNES_SHIFT_THRESHOLD) {
    sumLgamma += _lgamma(shifted);
    shifted += 1;
  }
  const y = shifted - 1;
  const lnG = lnBarnesGAsymptotic(y) - sumLgamma;
  return Math.exp(lnG);
}

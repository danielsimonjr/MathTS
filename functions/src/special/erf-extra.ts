/**
 * Inverse and scaled error functions, and Dawson's integral.
 *
 * - `erfinv` / `erfcinv`: Newton iteration seeded from `normalQuantile`, with
 *   the complementary branch used for `|y| > 1/2` to avoid cancellation.
 * - `erfcx`: scaled complementary error function `e^{x²} erfc(x)`.
 * - `dawson`: Dawson's integral `F(x) = e^{-x²} ∫₀ˣ e^{t²} dt`.
 *
 * Scalar kernels only (number in, number out).
 */

import { normalQuantile } from '../distribution-functions.js';
import { erfcScalar } from '../wasm/special/scalars.js';

const SQRT_PI = Math.sqrt(Math.PI);
const TWO_OVER_SQRT_PI = 2 / SQRT_PI;

/** `erf(x)`: Taylor series for |x| ≤ 2, otherwise `1 − erfc(x)`. */
function erfScalarLocal(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (Math.abs(x) > 2) return 1 - erfcScalar(x);
  const x2 = x * x;
  let term = x;
  let sum = x;
  for (let n = 1; n < 200; n += 1) {
    term *= -x2 / n;
    const add = term / (2 * n + 1);
    sum += add;
    if (add === 0 || Math.abs(add) <= 1e-17 * Math.abs(sum)) break;
  }
  return TWO_OVER_SQRT_PI * sum;
}

/** Largest argument for which `e^{x²}` stays finite. */
const ERFCX_OVERFLOW_NEG = -26.64;
/** Above this, the asymptotic expansion of `erfcx` is used. */
const ERFCX_ASYMPTOTIC_MIN = 25;

/** Four-term asymptotic series of `erfcx(x)` for large positive x. */
function erfcxAsymptotic(x: number): number {
  const u = 1 / (2 * x * x);
  return (1 - u + 3 * u * u - 15 * u * u * u) / (x * SQRT_PI);
}

/**
 * Scaled complementary error function `erfcx(x) = e^{x²} erfc(x)`.
 *
 * @example
 * erfcx(0) // 1
 * erfcx(1) // 0.42758357615580705
 */
export function erfcx(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < ERFCX_OVERFLOW_NEG) return Infinity;
  if (x > ERFCX_ASYMPTOTIC_MIN) return erfcxAsymptotic(x);
  return Math.exp(x * x) * erfcScalar(x);
}

/** `erfcinv(z)` for `z ∈ (0, 1)`, Newton on `ln erfcx(x) − x² − ln z`. */
function erfcinvCore(z: number): number {
  const logZ = Math.log(z);
  let x = Math.sqrt(-logZ);
  for (let it = 0; it < 100; it += 1) {
    // g(x) = ln erfc(x) − ln z,  g'(x) = −(2/√π)/erfcx(x)
    const scaled = erfcx(x);
    const g = Math.log(scaled) - x * x - logZ;
    const dx = g * scaled * (SQRT_PI / 2);
    x += dx;
    if (Math.abs(dx) <= 1e-15 * Math.max(1, Math.abs(x))) break;
  }
  return x;
}

/**
 * Inverse error function: `erf(erfinv(y)) = y` for `y ∈ [−1, 1]`.
 *
 * @example
 * erfinv(0)          // 0
 * erfinv(0.5)        // 0.4769362762044699
 * erfinv(1)          // Infinity
 */
export function erfinv(y: number): number {
  if (Number.isNaN(y) || y < -1 || y > 1) return NaN;
  if (y === 0) return 0;
  if (y === 1) return Infinity;
  if (y === -1) return -Infinity;
  const ay = Math.abs(y);
  if (ay > 0.5) {
    const x = erfcinvCore(1 - ay);
    return y < 0 ? -x : x;
  }
  // Newton on erf(x) − y, seeded from the normal quantile.
  let x = normalQuantile((1 + y) / 2) / Math.SQRT2;
  for (let it = 0; it < 10; it += 1) {
    const fp = TWO_OVER_SQRT_PI * Math.exp(-x * x);
    const dx = (erfScalarLocal(x) - y) / fp;
    x -= dx;
    if (Math.abs(dx) <= 1e-17 * Math.max(1, Math.abs(x))) break;
  }
  return x;
}

/**
 * Inverse complementary error function: `erfc(erfcinv(y)) = y` for `y ∈ [0, 2]`.
 *
 * @example
 * erfcinv(1)  // 0
 * erfcinv(0)  // Infinity
 */
export function erfcinv(y: number): number {
  if (Number.isNaN(y) || y < 0 || y > 2) return NaN;
  if (y === 0) return Infinity;
  if (y === 2) return -Infinity;
  if (y === 1) return 0;
  if (y > 1) return -erfcinvCore(2 - y);
  return erfcinvCore(y);
}

/**
 * Dawson's integral `F(x) = e^{-x²} ∫₀ˣ e^{t²} dt`.
 *
 * Uses the positive series `F(x) = e^{-x²} Σ x^{2n+1}/(n!(2n+1))` for |x| ≤ 25
 * (no cancellation) and a four-term asymptotic expansion beyond.
 *
 * @example
 * dawson(0)  // 0
 * dawson(1)  // 0.5380795069127684
 */
export function dawson(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const ax = Math.abs(x);
  let value: number;
  if (ax > ERFCX_ASYMPTOTIC_MIN) {
    const u = 1 / (2 * ax * ax);
    value = (1 + u + 3 * u * u + 15 * u * u * u) / (2 * ax);
  } else {
    const x2 = ax * ax;
    let a = ax; // x^{2n+1} / n!
    let sum = ax;
    for (let n = 1; n < 2000; n += 1) {
      a = (a * x2) / n;
      const term = a / (2 * n + 1);
      sum += term;
      if (term <= 1e-17 * sum) break;
    }
    value = sum * Math.exp(-x2);
  }
  return x < 0 ? -value : value;
}

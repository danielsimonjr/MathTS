/**
 * Spherical Bessel functions j_n, y_n, i_n, k_n, Hankel functions of real order,
 * and the first positive zeros of J_ν.
 *
 * Conventions: `j_n(x) = √(π/2x) J_{n+1/2}(x)`, `y_n` likewise from Y, `i_n = √(π/2x) I_{n+1/2}(x)`,
 * `k_n = √(π/2x) K_{n+1/2}(x)` (so `k_0(x) = (π/2) e^{-x}/x`).
 */

import { Complex } from '@danielsimonjr/mathts-core';
import { besselJ, besselY } from '../typed/special.js';
import { assertLoopOrder, MAX_SPHERICAL_BESSEL_ORDER } from '../utils/limits.js';

/** Largest `k * max(1, |nu|)` that `besselJZeros` accepts (the cost grows with this product). */
const MAX_ZEROS_WORK = 100_000_000;

/** Largest zero count that `besselJZeros` accepts. */
const MAX_ZEROS_COUNT = 7_000_000;

function asNumber(value: unknown, name: string): number {
  if (typeof value !== 'number') {
    throw new TypeError(`${name}: expected a scalar result`);
  }
  return value;
}

function assertOrder(n: number, name: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${name}: order must be a non-negative integer`);
  }
}

/** The rescale factor of the downward sweep and its natural logarithm (ln 1e150). */
const SHIFT = 1e-150;
const LN_SHIFT = 150 * Math.LN10;

/** Largest k̃ of the upward sweep of k_n before it is rescaled by 1e-290, and ln 1e290. */
const K_SCALE_LIMIT = 1e290;
const LN_K_SCALE = 290 * Math.LN10;

/** ln of the largest double: a result with a larger logarithm is Infinity. */
const LN_MAX_DOUBLE = 709.78;

/** A result with a logarithm below this value rounds to 0 (ln of half the smallest double). */
const LN_MIN_DOUBLE = -745.2;

/**
 * Miller's downward recurrence `f_{k-1} = a_k f_k + sign · f_{k+1}` with `a_k = (2k+1)/x`.
 *
 * Returns `r = f_n / f_0` and `r1 = f_n / f_1` up to a power of ten: the sweep multiplies its
 * live values by 1e-150 whenever they grow past 1e150, and `shifts` counts the rescales that came
 * after `f_n` was captured. `f_n` itself is not rescaled, so it cannot underflow early, and the
 * exact ratios are `r · 1e-150^shifts` and `r1 · 1e-150^shifts`. The caller multiplies one of
 * them by the exact `f_0` or `f_1`.
 */
function millerDownward(
  n: number,
  x: number,
  sign: 1 | -1
): { r: number; r1: number; shifts: number } {
  const big = Math.max(n, Math.abs(x));
  assertLoopOrder('sphericalBessel', 'max(n, |x|)', big, MAX_SPHERICAL_BESSEL_ORDER);
  const start = Math.ceil(big) + 30 + Math.ceil(Math.sqrt(40 * (big + 1)));
  // Only f_n and f_0 are needed, so the sweep keeps two live values and the one at order n.
  let fk = 1; // f_k
  let fk1 = 0; // f_{k+1}
  let fn = 0;
  let shifts = 0;
  for (let k = start; k >= 1; k -= 1) {
    let prev = ((2 * k + 1) / x) * fk + sign * fk1;
    if (k - 1 === n) fn = prev;
    if (Math.abs(prev) > 1e150) {
      prev *= SHIFT;
      fk *= SHIFT;
      fk1 *= SHIFT;
      if (k - 1 <= n) shifts += 1;
    }
    fk1 = fk;
    fk = prev;
  }
  return { r: fn / fk, r1: fn / fk1, shifts };
}

/**
 * `f_n(x)` for `|x| < 1` and `n ≥ 1`, from the power series
 * `x^n / (2n+1)!! · Σ_k (sign · x²/2)^k / (k! (2n+3)(2n+5)…(2n+2k+1))`
 * (`sign` is −1 for j_n and +1 for i_n). The prefactor is a product of factors below 1/3, so
 * it reaches 0 within about 700 steps, and the result is then 0, the correctly rounded value.
 * The Miller sweep cannot serve here: its coefficients `(2k+1)/x` overflow for a tiny `x`.
 */
function smallXSeries(n: number, x: number, sign: 1 | -1): number {
  let pre = 1;
  for (let k = 1; k <= n; k += 1) {
    pre *= x / (2 * k + 1);
    if (pre === 0) return 0;
  }
  const h = (sign * x * x) / 2;
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 200; k += 1) {
    term *= h / (k * (2 * n + 2 * k + 1));
    sum += term;
    if (Math.abs(term) <= 1e-17 * Math.abs(sum)) break;
  }
  return pre * sum;
}

/** ln i_0(x) = x − ln(2x) + ln(1 − e^{−2x}) for x > 0. */
function lnSphBesselI0(x: number): number {
  return x - Math.log(2 * x) + Math.log1p(-Math.exp(-2 * x));
}

/** j_n(x): upward recurrence for x > n, a series for |x| < 1, Miller downward otherwise. */
function sphBesselJ(n: number, x: number): number {
  if (x === 0) return n === 0 ? 1 : 0;
  const j0 = Math.sin(x) / x;
  if (n === 0) return j0;
  if (Math.abs(x) < 1) return smallXSeries(n, x, -1);
  if (x > n) {
    const j1 = Math.sin(x) / (x * x) - Math.cos(x) / x;
    let jm = j0;
    let j = j1;
    for (let k = 1; k < n; k += 1) {
      const next = ((2 * k + 1) / x) * j - jm;
      if (Number.isNaN(next)) return NaN;
      jm = j;
      j = next;
    }
    return j;
  }
  const { r, r1, shifts } = millerDownward(n, x, -1);
  // j_n = r · 1e-150^shifts · j_0 = r1 · 1e-150^shifts · j_1. Near a zero of sin x the exact j_0
  // is a rounding error and the computed f_0 is all cancellation, so the larger of j_0 and j_1
  // sets the scale (they have no common zero). Both are at most 1 in size, so an underflow of
  // the factor is the result.
  const j1 = Math.sin(x) / (x * x) - Math.cos(x) / x;
  const useFirst = Math.abs(j1) > Math.abs(j0);
  let ratio = useFirst ? r1 : r;
  for (let s = 0; s < shifts && ratio !== 0; s += 1) ratio *= SHIFT;
  return ratio * (useFirst ? j1 : j0);
}

/**
 * y_n(x): upward recurrence (stable for Y), on |x|. The first infinity is the result: for
 * k > |x| every y_k has one sign (negative for x > 0) and grows, and the next step would be
 * Infinity − Infinity. Negative x uses y_n(−x) = (−1)^{n+1} y_n(x).
 */
function sphBesselY(n: number, x: number): number {
  if (x === 0) return -Infinity;
  const ax = Math.abs(x);
  const parity = x < 0 && n % 2 === 0 ? -1 : 1;
  const y0 = -Math.cos(ax) / ax;
  if (n === 0) return parity * y0;
  let ym = y0;
  let y = -Math.cos(ax) / (ax * ax) - Math.sin(ax) / ax;
  for (let k = 1; k < n; k += 1) {
    const next = ((2 * k + 1) / ax) * y - ym;
    if (!Number.isFinite(next)) return parity * next;
    ym = y;
    y = next;
  }
  return parity * y;
}

/**
 * i_n(x): Miller downward recurrence (I is the minimal solution), on |x| with the parity
 * i_n(−x) = (−1)^n i_n(x). The result is `r · 1e-150^shifts · i_0`. When the scaled ratio and
 * i_0 are both representable the product is exact to a rounding. Otherwise (a tiny ratio, or
 * `i_0 = Infinity` from x ≈ 710) the product is formed in logarithms, with a relative error of
 * about `|ln result| · 1e-16`; the result then underflows to 0 or overflows to Infinity at its
 * true place.
 */
function sphBesselI(n: number, x: number): number {
  if (x === 0) return n === 0 ? 1 : 0;
  if (x < 0) return (n % 2 === 0 ? 1 : -1) * sphBesselI(n, -x);
  if (n === 0) {
    // sinh(x) is Infinity from x = 710.5, where i_0(x) = sinh(x) / x is still a double (up to x = 716.2).
    if (x === Infinity) return Infinity;
    const first = Math.sinh(x) / x;
    return Number.isFinite(first) ? first : Math.exp(lnSphBesselI0(x));
  }
  if (x < 1) return smallXSeries(n, x, 1);
  const { r, shifts } = millerDownward(n, x, 1);
  let ratio = r;
  let left = shifts;
  while (left > 0 && Math.abs(ratio) > 1e-140) {
    ratio *= SHIFT;
    left -= 1;
  }
  const i0 = Math.sinh(x) / x;
  if (left === 0 && Number.isFinite(i0)) return ratio * i0;
  if (r === 0) return 0;
  return Math.sign(r) * Math.exp(Math.log(Math.abs(r)) - shifts * LN_SHIFT + lnSphBesselI0(x));
}

/**
 * k_n(x) for x < 0: upward recurrence on the unscaled values (k_n is not real-analytic there,
 * and the terms do not keep one sign, so there is no early exit on overflow).
 */
function sphBesselKNegative(n: number, x: number): number {
  const k0 = (Math.PI / 2) * (Math.exp(-x) / x);
  if (n === 0) return k0;
  let km = k0;
  let k = k0 * (1 + 1 / x);
  for (let j = 1; j < n; j += 1) {
    const next = km + ((2 * j + 1) / x) * k;
    km = k;
    k = next;
  }
  return k;
}

/**
 * An upper bound of `Σ_{1<=j<n} ln(1 + (2j+1)/x)`, the growth of ln k̃ from order 1 to order n.
 * The closed form of the integral carries one unit of margin for its rounding error.
 */
function lnGrowthBound(n: number, x: number): number {
  const plain = (n * n - 1) / x;
  if (x > 1e12) return plain;
  const f = (t: number): number => ((x + 1 + 2 * t) / 2) * (Math.log1p((1 + 2 * t) / x) - 1);
  return Math.min(plain, f(n) - f(1) + 1);
}

/**
 * k_n(x): upward recurrence (stable for K) on the scaled values `k̃_n = e^x k_n`, which start
 * at `k̃_0 = (π/2)/x` and do not underflow for a large x. The sweep rescales by 1e-290 when
 * `k̃` passes 1e290 and counts the rescales. For x > 0 every term is positive, so the first
 * infinity is Infinity, and the sweep ends with Infinity as soon as the logarithm of the true
 * value passes ln(max double).
 */
function sphBesselK(n: number, x: number): number {
  if (x === 0) return Infinity;
  if (x < 0) return sphBesselKNegative(n, x);
  if (x === Infinity) return 0;
  const s0 = Math.PI / 2 / x;
  let km = s0;
  let k = n === 0 ? s0 : s0 * (1 + 1 / x);
  // k̃_{j+1} = k̃_{j-1} + a_j k̃_j <= (1 + a_j) k̃_j because k̃ grows with j, so
  // ln k̃_n <= ln k̃_1 + Σ_{1<=j<n} ln(1 + a_j) with a_j = (2j+1)/x. The sum is at most the
  // integral from 1 to n (the terms grow), which has the closed form F(n) − F(1) with
  // F(t) = ((x + 1 + 2t)/2) (ln(1 + (2t+1)/x) − 1), and at most Σ a_j = (n² − 1)/x (ln(1+a) <= a;
  // the closed form loses its digits for x above 1e12, where that bound is tight). A bound below
  // the smallest double ends the sweep at once with the correctly rounded 0, also for n near x,
  // where the plain bound is 0 and the sweep took 19 s (`sphericalBesselK(1.8e9, 1.8e9)`).
  if (n >= 2 && Math.log(k) + lnGrowthBound(n, x) - x < LN_MIN_DOUBLE) return 0;
  let scales = 0;
  for (let j = 1; j < n; j += 1) {
    const next = km + ((2 * j + 1) / x) * k;
    if (!(next < Infinity)) return next;
    km = k;
    k = next;
    if (k > K_SCALE_LIMIT) {
      k /= K_SCALE_LIMIT;
      km /= K_SCALE_LIMIT;
      scales += 1;
      if (scales * LN_K_SCALE + Math.log(k) - x > LN_MAX_DOUBLE) return Infinity;
    }
  }
  if (scales === 0) {
    // Two halves keep the first factor from underflowing before the second one is applied.
    const half = Math.exp(-x / 2);
    return k * half * half;
  }
  return Math.exp(Math.log(k) + scales * LN_K_SCALE - x);
}

/** Spherical Bessel function of the first kind `j_n(x)`. */
export function sphericalBesselJ(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselJ');
  assertLoopOrder('sphericalBesselJ', 'n', n, MAX_SPHERICAL_BESSEL_ORDER);
  return typeof x !== 'number' || Number.isNaN(x) ? NaN : sphBesselJ(n, x);
}

/** Spherical Bessel function of the second kind `y_n(x)`. */
export function sphericalBesselY(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselY');
  assertLoopOrder('sphericalBesselY', 'n', n, MAX_SPHERICAL_BESSEL_ORDER);
  return typeof x !== 'number' || Number.isNaN(x) ? NaN : sphBesselY(n, x);
}

/** Modified spherical Bessel function of the first kind `i_n(x)`. */
export function sphericalBesselI(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselI');
  assertLoopOrder('sphericalBesselI', 'n', n, MAX_SPHERICAL_BESSEL_ORDER);
  return typeof x !== 'number' || Number.isNaN(x) ? NaN : sphBesselI(n, x);
}

/** Modified spherical Bessel function of the second kind `k_n(x)`. */
export function sphericalBesselK(n: number, x: number): number {
  assertOrder(n, 'sphericalBesselK');
  assertLoopOrder('sphericalBesselK', 'n', n, MAX_SPHERICAL_BESSEL_ORDER);
  return typeof x !== 'number' || Number.isNaN(x) ? NaN : sphBesselK(n, x);
}

/** Hankel function of the first kind `H¹_ν(x) = J_ν(x) + i Y_ν(x)`. */
export function hankelH1(nu: number, x: number): Complex {
  const j = asNumber(besselJ(nu, x), 'hankelH1');
  const y = asNumber(besselY(nu, x), 'hankelH1');
  return new Complex(j, y);
}

/** Hankel function of the second kind `H²_ν(x) = J_ν(x) − i Y_ν(x)`. */
export function hankelH2(nu: number, x: number): Complex {
  const j = asNumber(besselJ(nu, x), 'hankelH2');
  const y = asNumber(besselY(nu, x), 'hankelH2');
  return new Complex(j, -y);
}

/** d/dx J_ν(x) = (J_{ν−1}(x) − J_{ν+1}(x)) / 2, with J_{−1} = −J_1. */
function besselJDerivative(nu: number, x: number): number {
  const jPrev =
    nu === 0
      ? -asNumber(besselJ(1, x), 'besselJZeros')
      : asNumber(besselJ(nu - 1, x), 'besselJZeros');
  const jNext = asNumber(besselJ(nu + 1, x), 'besselJZeros');
  return (jPrev - jNext) / 2;
}

/**
 * First `k` positive zeros of `J_ν(x)`, via McMahon's asymptotic guess refined by Newton.
 *
 * @example
 * besselJZeros(0, 2) // [2.404825557695773, 5.520078110286311]
 */
export function besselJZeros(nu: number, k: number): number[] {
  if (!Number.isInteger(k) || k < 1) {
    throw new RangeError('besselJZeros: k must be a positive integer');
  }
  assertLoopOrder('besselJZeros', 'k', k, MAX_ZEROS_COUNT);
  assertLoopOrder(
    'besselJZeros',
    'k * max(1, |nu|)',
    k * Math.max(1, Math.abs(nu)),
    MAX_ZEROS_WORK
  );
  const mu = 4 * nu * nu;
  const zeros: number[] = [];
  for (let s = 1; s <= k; s += 1) {
    const beta = (s + nu / 2 - 0.25) * Math.PI;
    const b8 = 8 * beta;
    let x = beta - (mu - 1) / b8 - (4 * (mu - 1) * (7 * mu - 31)) / (3 * b8 * b8 * b8);
    for (let it = 0; it < 100; it += 1) {
      const dx = asNumber(besselJ(nu, x), 'besselJZeros') / besselJDerivative(nu, x);
      x -= dx;
      if (Math.abs(dx) <= 1e-15 * Math.max(1, Math.abs(x))) break;
    }
    zeros.push(x);
  }
  return zeros;
}

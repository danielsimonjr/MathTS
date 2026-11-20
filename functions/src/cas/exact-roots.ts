/**
 * Exact roots of a polynomial of degree 1 or 2, and the exact power rule for a decimal literal.
 *
 * A coefficient that a person typed (`0.1`, `1e-20`) is a decimal. Its shortest round-trip text
 * (`String(c)`) names that decimal exactly, so the module reads each coefficient as the rational
 * `m / 10^k` of that text and works with bigint arithmetic. A coefficient that the computer
 * rounded (`1/3` is `0.3333333333333333`) has too many digits for that. The module reads it as a
 * small fraction when one agrees to rounding size, and gives up otherwise. The roots are then
 * exact: `1e-30 / 1e-20` is `1e-10`, not the quotient of two rounded doubles, and `x^2 - 0.5`
 * has the roots `+-sqrt(2)/2`.
 *
 * The module imports only the exact rational arithmetic, so the solver and `integrate` share it.
 */

import { type Rat, ratNormalize, ratAdd, ratSub, ratMul, ratDiv, RAT_ZERO } from './rat.js';

/** The largest integer that the radicand of a root may have: the split below reads it as a number. */
const MAX_RADICAND = Number.MAX_SAFE_INTEGER;

/** The most significant digits of a double that a person could have typed: every such decimal round-trips. */
const MAX_TYPED_DIGITS = 15;
/** The largest denominator of a fraction that stands for a rounded coefficient (`1/3`, `7/12`). */
const MAX_COEFFICIENT_DENOMINATOR = 10_000;

/** A decimal text such as `0.5`, `-12`, `1e-20` or `2.5e3` as a rational, or null when it is none. */
export function decimalTextToRat(text: string): Rat | null {
  const m = /^(-?)(\d*)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(text);
  if (m === null || (m[2] === '' && m[3] === undefined)) return null;
  const fraction = m[3] ?? '';
  const digits = BigInt(`${m[2] === '' ? '0' : m[2]}${fraction}`);
  const exponent = Number(m[4] ?? '0') - fraction.length;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10_000) return null;
  const signed = m[1] === '-' ? -digits : digits;
  return exponent >= 0
    ? ratNormalize(signed * 10n ** BigInt(exponent), 1n)
    : ratNormalize(signed, 10n ** BigInt(-exponent));
}

/** The number of significant digits in the shortest text of a double. */
function significantDigits(text: string): number {
  const mantissa = text.replace(/^-/, '').replace(/e.*$/, '').replace('.', '');
  return mantissa.replace(/^0+/, '').replace(/0+$/, '').length;
}

/**
 * The small fraction `n/d` (`d` up to the limit) whose correctly rounded value is `x`, or null.
 * The match is exact: `0.3333333333333333` is `1/3`, and `0.30000000000000004` (one ulp above
 * the double of 3/10) is no fraction.
 */
function smallFraction(x: number): Rat | null {
  let h1 = 1n;
  let h0 = 0n;
  let k1 = 0n;
  let k0 = 1n;
  let rest = Math.abs(x);
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(rest);
    const h2 = BigInt(a) * h1 + h0;
    const k2 = BigInt(a) * k1 + k0;
    if (k2 > BigInt(MAX_COEFFICIENT_DENOMINATOR)) return null;
    if (Number(h2) / Number(k2) === Math.abs(x)) {
      return ratNormalize(x < 0 ? -h2 : h2, k2);
    }
    [h0, h1, k0, k1] = [h1, h2, k1, k2];
    const frac = rest - a;
    if (frac === 0) return null;
    rest = 1 / frac;
  }
  return null;
}

/**
 * A coefficient as a rational: the decimal that a person typed (at most 15 significant digits), or
 * the small fraction that a rounded value stands for (`0.3333333333333333` is `1/3`). Null for a
 * value that is not finite, has no such reading (`pi`), or is zero-sized noise.
 */
export function coefficientRat(c: number): Rat | null {
  if (!Number.isFinite(c)) return null;
  if (c === 0) return RAT_ZERO;
  const text = String(c);
  if (significantDigits(text) <= MAX_TYPED_DIGITS) return decimalTextToRat(text);
  return smallFraction(c);
}

/** A rational as text: `3`, `-1/2`. */
export function ratText(r: Rat): string {
  return r.den === 1n ? String(r.num) : `${r.num}/${r.den}`;
}

const isNegative = (r: Rat): boolean => r.num < 0n;

/**
 * The root `-c0/c1` of `c0 + c1*x` as the double nearest to the exact quotient of the two
 * coefficients (`1e-30 / 1e-20` gives `1e-10`), or null when a coefficient has no exact reading
 * (see {@link coefficientRat}) or `c1` is 0.
 *
 * The quotient is computed with 30 significant digits by bigint division, and `Number` rounds that
 * decimal text correctly, so the result is the correctly rounded root unless the exact quotient lies
 * within 1e-30 (relative) of a midpoint between two doubles.
 */
export function exactLinearRoot(c0: number, c1: number): number | null {
  const a = coefficientRat(c0);
  const b = coefficientRat(c1);
  if (a === null || b === null || b.num === 0n) return null;
  if (a.num === 0n) return 0;
  const q = ratDiv(a, b); // c0 / c1; the root is -q
  const magnitude = q.num < 0n ? -q.num : q.num;
  // Scale so that magnitude * 10^k / den has at least 30 digits.
  const k = Math.max(0, 30 + String(q.den).length - String(magnitude).length);
  const scaled = (magnitude * 10n ** BigInt(k)) / q.den;
  const root = Number(`${q.num < 0n ? '' : '-'}${scaled}e-${k}`);
  return Number.isFinite(root) ? root + 0 : null;
}

/**
 * The exact text of the root `-c0/c1` of `c0 + c1*x`: `3`, `-1/2`. Null when a coefficient has no
 * exact reading (see {@link coefficientRat}) or `c1` is 0.
 */
export function exactLinearText(c0: number, c1: number): string | null {
  const a = coefficientRat(c0);
  const b = coefficientRat(c1);
  if (a === null || b === null || b.num === 0n) return null;
  return ratText(ratDiv(ratSub(RAT_ZERO, a), b));
}

/** Split `d = k^2 * m` with `m` square-free, for a safe integer `d >= 1`. */
function squareFreeSplit(d: number): { k: number; m: number } {
  let rest = d;
  let k = 1;
  let m = 1;
  const limit = Math.floor(Math.cbrt(d)) + 1;
  for (let p = 2; p <= limit && p * p <= rest; p++) {
    let e = 0;
    while (rest % p === 0) {
      rest /= p;
      e++;
    }
    k *= p ** Math.floor(e / 2);
    if (e % 2 === 1) m *= p;
  }
  // `rest` has no prime factor up to the cube root of `d`, so it is 1, a prime, a product of two
  // primes, or the square of a prime.
  const root = Math.round(Math.sqrt(rest));
  if (root * root === rest) k *= root;
  else m *= rest;
  return { k, m };
}

/** The exact real roots of a quadratic, as text, and whether they are irrational. */
export interface ExactQuadratic {
  /** The real roots in ascending order: `n`, `n/d`, `p - sqrt(m)/d`, `p + sqrt(m)/d`; `[]` for none. */
  texts: string[];
  /** True when the roots are irrational (they hold a radical). */
  irrational: boolean;
}

/** The radical part `q*sqrt(m)` as text for the positive rational `q = n/d`. */
function radicalText(q: Rat, m: number): string {
  const top = q.num === 1n ? `sqrt(${m})` : `${q.num}*sqrt(${m})`;
  return q.den === 1n ? top : `${top}/${q.den}`;
}

/**
 * The exact real roots of `c + b*x + a*x^2` (dense ascending coefficients of degree 2), or null
 * when a coefficient is not finite or the radicand is too large to split (above 2^53 - 1).
 *
 * With `D = b^2 - 4ac` on integer coefficients: `D < 0` gives no real root; `D = 0` gives
 * `-b/(2a)`; a square `D` gives two fractions; any other `D = k^2 * m` (`m` square-free) gives
 * `-b/(2a) -+ (k/(2|a|))*sqrt(m)`, written `p - R` and `p + R` (or `-R` and `R` when `p` is 0).
 */
export function exactQuadraticRoots(dense: readonly number[]): ExactQuadratic | null {
  if (dense.length !== 3) return null;
  const rats = dense.map(coefficientRat);
  if (rats.some((r) => r === null)) return null;
  let [c, b, a] = rats as [Rat, Rat, Rat];
  if (a.num === 0n) return null;
  if (isNegative(a)) {
    c = ratSub(RAT_ZERO, c);
    b = ratSub(RAT_ZERO, b);
    a = ratSub(RAT_ZERO, a);
  }
  const two: Rat = { num: 2n, den: 1n };
  const four: Rat = { num: 4n, den: 1n };
  // D = b^2 - 4ac as a rational; the roots are -b/(2a) -+ sqrt(D)/(2a).
  const disc = ratSub(ratMul(b, b), ratMul(four, ratMul(a, c)));
  const mid = ratDiv(ratSub(RAT_ZERO, b), ratMul(two, a)); // p = -b/(2a)
  if (isNegative(disc)) return { texts: [], irrational: false };
  if (disc.num === 0n) return { texts: [ratText(mid)], irrational: false };
  // sqrt(D) with D = n/d: sqrt(n*d)/d, so split the integer n*d.
  const radicand = disc.num * disc.den;
  if (radicand > BigInt(MAX_RADICAND)) return null;
  const { k, m } = squareFreeSplit(Number(radicand));
  // sqrt(D)/(2a) = k*sqrt(m) / (d * 2a)
  const q = ratDiv({ num: BigInt(k), den: 1n }, ratMul({ num: disc.den, den: 1n }, ratMul(two, a)));
  if (m === 1) {
    return {
      texts: [ratText(ratSub(mid, q)), ratText(ratAdd(mid, q))],
      irrational: false,
    };
  }
  const radical = radicalText(q, m);
  const texts =
    mid.num === 0n
      ? [`-${radical}`, radical]
      : [`${ratText(mid)} - ${radical}`, `${ratText(mid)} + ${radical}`];
  return { texts, irrational: true };
}

/**
 * The text of `c * x^k / q` for the power rule: the integral of `literal * x^(k-1)` (the number
 * `literal` is a decimal text such as `0.5`) is `literal/k * x^k`, written as `x^k`, `p*x^k`,
 * `x^k/q` or `p*x^k/q` for the reduced fraction `p/q`, and `x` for `k = 1`.
 */
export function powerRuleText(literal: string, k: number, varName: string): string | null {
  const c = decimalTextToRat(literal);
  if (c === null || !Number.isInteger(k) || k < 1) return null;
  const f = ratDiv(c, ratNormalize(BigInt(k), 1n));
  if (f.num === 0n) return '0';
  const power = k === 1 ? varName : `${varName}^${k}`;
  if (f.num === 1n && f.den === 1n) return power;
  const top = f.num === 1n ? power : `${f.num}*${power}`;
  return f.den === 1n ? top : `${top}/${f.den}`;
}

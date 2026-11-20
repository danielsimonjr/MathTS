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

import { type Rat, ratNormalize, ratDiv, RAT_ZERO } from './rat.js';

/** The most significant digits of a double that a person could have typed: every such decimal round-trips. */
const MAX_TYPED_DIGITS = 15;
/** The largest denominator of a fraction that stands for a rounded coefficient (`1/3`, `7/12`). */
const MAX_COEFFICIENT_DENOMINATOR = 10_000;
/** A fraction stands for a rounded coefficient when they agree to this fraction of the coefficient. */
const COEFFICIENT_FRACTION_TOLERANCE = 1e-15;

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

/** The small fraction `n/d` (`d` up to the limit) that agrees with `x` to rounding size, or null. */
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
    if (
      Math.abs(Math.abs(x) - Number(h2) / Number(k2)) <=
      COEFFICIENT_FRACTION_TOLERANCE * Math.abs(x)
    ) {
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

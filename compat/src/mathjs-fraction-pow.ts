/**
 * Fraction×Fraction `pow` for callers that need the exact-rational helper.
 * The algorithm lives on core `rationalPow` (#1551).
 */

import { Complex, Fraction, rationalPow } from '@danielsimonjr/mathts-core';

const NON_RATIONAL = 'Result of pow is non-rational and cannot be expressed as a fraction';

function isPowZeroAtInfinity(x: number, y: number): boolean {
  return Math.abs(x) < 1 && (y === Infinity || y === -Infinity);
}

function numberFractionFallback(x: number, y: number, predictable: boolean): number | Complex {
  if (predictable && !Number.isInteger(y) && x < 0) {
    try {
      const yFrac = new Fraction(y);
      const yNum = yFrac.valueOf();
      if (y === yNum || Math.abs((y - yNum) / y) < 1e-14) {
        if (yFrac.denominator % 2n === 1n) {
          return (yFrac.numerator % 2n === 0n ? 1 : -1) * Math.pow(-x, y);
        }
      }
    } catch {
      /* non-finite y */
    }
  }
  if (predictable && ((x < -1 && y === Infinity) || (x > -1 && x < 0 && y === -Infinity))) {
    return NaN;
  }
  if (Number.isInteger(y) || x >= 0 || predictable) {
    return Math.pow(x, y);
  }
  if (isPowZeroAtInfinity(x, y)) return 0;
  return new Complex(x, 0).pow(y);
}

/**
 * mathjs `pow` when either operand is a Fraction.
 */
export function mathjsPowFractionPair(
  base: Fraction | number,
  exponent: Fraction | number,
  predictable: boolean,
  fraction: (n: number) => Fraction
): Fraction | number | Complex {
  const x = base instanceof Fraction ? base : fraction(base as number);
  const y = exponent instanceof Fraction ? exponent : fraction(exponent as number);

  // mathjs 15.3.0 never returns a real root of a negative Fraction with a
  // non-integer exponent (principal Complex, or throw when `predictable`).
  if (x.numerator < 0n && y.denominator !== 1n) {
    if (predictable) throw new Error(NON_RATIONAL);
    return numberFractionFallback(x.valueOf(), y.valueOf(), predictable);
  }
  const result = rationalPow(x, y);
  if (result != null) return result;
  if (predictable) throw new Error(NON_RATIONAL);
  return numberFractionFallback(x.valueOf(), y.valueOf(), predictable);
}

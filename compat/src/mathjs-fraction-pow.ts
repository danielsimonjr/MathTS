/**
 * mathjs 15.3.0 Fraction `pow` semantics for the compat layer only (#1551).
 * Native `factory_pow` does not handle rational exponents on MathTS Fractions.
 */

import { Complex, Fraction } from '@danielsimonjr/mathts-core';

const PRIME_WHEEL_STEPS = [2n, 4n, 2n, 4n, 6n, 2n, 6n] as const;

function primeFactorExponents(n: bigint): Map<bigint, bigint> {
  const factors = new Map<bigint, bigint>();
  if (n <= 1n) {
    factors.set(n, 1n);
    return factors;
  }
  const add = (p: bigint) => factors.set(p, (factors.get(p) ?? 0n) + 1n);
  let num = n;
  while (num % 2n === 0n) {
    add(2n);
    num /= 2n;
  }
  while (num % 3n === 0n) {
    add(3n);
    num /= 3n;
  }
  while (num % 5n === 0n) {
    add(5n);
    num /= 5n;
  }
  let p = 7n;
  let stepIdx = 0;
  while (p * p <= num) {
    while (num % p === 0n) {
      add(p);
      num /= p;
    }
    p += PRIME_WHEEL_STEPS[stepIdx]!;
    stepIdx = (stepIdx + 1) % PRIME_WHEEL_STEPS.length;
  }
  if (num > 1n) add(num);
  return factors;
}

function powRational(base: Fraction, exp: Fraction): Fraction | null {
  const Pn = exp.numerator;
  const Pd = exp.denominator;
  if (Pd === 1n) {
    if (Pn < 0n) {
      const negExp = -Pn;
      return new Fraction(base.denominator ** negExp, base.numerator ** negExp);
    }
    return base.pow(Pn);
  }
  if (base.numerator < 0n) return null;

  const N = primeFactorExponents(base.numerator < 0n ? -base.numerator : base.numerator);
  const D = primeFactorExponents(base.denominator);

  let n = 1n;
  let d = 1n;
  for (const [k, count] of N) {
    if (k === 1n) continue;
    if (k === 0n) {
      n = 0n;
      break;
    }
    let e = count * Pn;
    if (e % Pd !== 0n) return null;
    e /= Pd;
    n *= k ** e;
  }
  for (const [k, count] of D) {
    if (k === 1n) continue;
    let e = count * Pn;
    if (e % Pd !== 0n) return null;
    e /= Pd;
    d *= k ** e;
  }
  if (Pn < 0n) return new Fraction(d, n);
  return new Fraction(n, d);
}

function isPowZeroAtInfinity(x: number, y: number): boolean {
  return Math.abs(x) < 1 && (y === Infinity || y === -Infinity);
}

function powNumber(x: number, y: number): number {
  return Math.pow(x, y);
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
    return powNumber(x, y);
  }
  if (isPowZeroAtInfinity(x, y)) return 0;
  return new Complex(x, 0).pow(y);
}

const NON_RATIONAL = 'Result of pow is non-rational and cannot be expressed as a fraction';

/**
 * mathjs `pow` when either operand is a Fraction (compat instances only).
 */
export function mathjsPowFractionPair(
  base: Fraction | number,
  exponent: Fraction | number,
  predictable: boolean,
  fraction: (n: number) => Fraction
): Fraction | number | Complex {
  const x = base instanceof Fraction ? base : fraction(base as number);
  const y = exponent instanceof Fraction ? exponent : fraction(exponent as number);

  const result = powRational(x, y);
  if (result != null) return result;
  if (predictable) throw new Error(NON_RATIONAL);
  return numberFractionFallback(x.valueOf(), y.valueOf(), predictable);
}

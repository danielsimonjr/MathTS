/**
 * Polymorphic scalar arithmetic over core's numeric primitives.
 *
 * This module is the load-bearing dependency for relocating the feature-complete
 * `Unit` class into `core` (see `docs/superpowers/plans/2026-07-03-unit-merge.md`).
 * The Unit factory is closed over injected `addScalar`/`subtractScalar`/… helpers
 * that must operate uniformly over `number | bigint | Complex | Fraction |
 * BigNumber`. Core already owns those numeric types; this module gives it the
 * type-agnostic scalar operations to go with them, built ONLY on core primitives
 * (no typed-function dispatch, no functions-package plumbing).
 *
 * ## Dispatch strategy
 *
 * When at least one operand is a "rich" type (Complex/Fraction/BigNumber), both
 * operands are promoted to the richest common domain (Complex ≻ BigNumber ≻
 * Fraction) and a single same-type method is invoked (`a.add(b)`). Because operand
 * order is preserved in `a.op(b)`, commutative and non-commutative operations use
 * the identical code path — `subtractScalar(3, i)` promotes `3 → 3+0i` first, then
 * computes `(3+0i) − i` in the right order. Same-type operands (the only case the
 * Unit's internal arithmetic actually produces) stay exact.
 */
import { DEFAULT_CONFIG } from '../config.js';
import { nearlyEqual } from '../number.js';
import { BigNumber } from '../types/bignumber.js';
import { Complex } from '../types/complex.js';
import { Fraction } from '../types/fraction.js';

/** Any scalar core can do arithmetic on. */
export type NumericScalar = number | bigint | Complex | Fraction | BigNumber;

function isPrimitive(v: NumericScalar): v is number | bigint {
  return typeof v === 'number' || typeof v === 'bigint';
}

// --- promotion: lift any scalar into a specific rich domain --------------------

function asComplex(v: NumericScalar): Complex {
  return v instanceof Complex ? v : new Complex(number(v), 0);
}

function asBigNumber(v: NumericScalar): BigNumber {
  if (v instanceof BigNumber) return v;
  if (typeof v === 'bigint') return BigNumber.fromBigInt(v);
  return BigNumber.fromNumber(number(v));
}

function asFraction(v: NumericScalar): Fraction {
  if (v instanceof Fraction) return v;
  if (typeof v === 'number' || typeof v === 'bigint') return new Fraction(v);
  return new Fraction(number(v));
}

// --- binary operations ---------------------------------------------------------

/** Add two scalar values, `x + y`. */
export function addScalar(x: NumericScalar, y: NumericScalar): NumericScalar {
  if (typeof x === 'number' && typeof y === 'number') return x + y;
  if (typeof x === 'bigint' && typeof y === 'bigint') return x + y;
  if (isPrimitive(x) && isPrimitive(y)) return Number(x) + Number(y);
  if (x instanceof Complex || y instanceof Complex) return asComplex(x).add(asComplex(y));
  if (x instanceof BigNumber || y instanceof BigNumber) return asBigNumber(x).add(asBigNumber(y));
  return asFraction(x).add(asFraction(y));
}

/** Subtract two scalar values, `x − y` (order preserved through promotion). */
export function subtractScalar(x: NumericScalar, y: NumericScalar): NumericScalar {
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  if (typeof x === 'bigint' && typeof y === 'bigint') return x - y;
  if (isPrimitive(x) && isPrimitive(y)) return Number(x) - Number(y);
  if (x instanceof Complex || y instanceof Complex) return asComplex(x).subtract(asComplex(y));
  if (x instanceof BigNumber || y instanceof BigNumber)
    return asBigNumber(x).subtract(asBigNumber(y));
  return asFraction(x).subtract(asFraction(y));
}

/** Multiply two scalar values, `x · y`. */
export function multiplyScalar(x: NumericScalar, y: NumericScalar): NumericScalar {
  if (typeof x === 'number' && typeof y === 'number') return x * y;
  if (typeof x === 'bigint' && typeof y === 'bigint') return x * y;
  if (isPrimitive(x) && isPrimitive(y)) return Number(x) * Number(y);
  if (x instanceof Complex || y instanceof Complex) return asComplex(x).multiply(asComplex(y));
  if (x instanceof BigNumber || y instanceof BigNumber)
    return asBigNumber(x).multiply(asBigNumber(y));
  return asFraction(x).multiply(asFraction(y));
}

/** Divide two scalar values, `x ÷ y` (order preserved through promotion). */
export function divideScalar(x: NumericScalar, y: NumericScalar): NumericScalar {
  if (typeof x === 'number' && typeof y === 'number') return x / y;
  if (typeof x === 'bigint' && typeof y === 'bigint') return x / y;
  if (isPrimitive(x) && isPrimitive(y)) return Number(x) / Number(y);
  if (x instanceof Complex || y instanceof Complex) return asComplex(x).divide(asComplex(y));
  if (x instanceof BigNumber || y instanceof BigNumber)
    return asBigNumber(x).divide(asBigNumber(y));
  return asFraction(x).divide(asFraction(y));
}

/**
 * Raise `base` to the power `exp`, treating `exp` as a real exponent.
 *
 * The exact `.pow()` of an exact type (Fraction/BigNumber) only supports INTEGER
 * exponents. A non-integer exponent of an exact base is generally irrational, so
 * it cannot stay exact — those cases fall back to double-precision `Math.pow`,
 * returning a plain `number`. (Without this guard, `BigNumber.pow(0.5)` silently
 * returned 1 and `Fraction.pow(0.5)` threw `BigInt(0.5)`.)
 */
export function pow(base: NumericScalar, exp: NumericScalar): NumericScalar {
  if (base instanceof Complex) return base.pow(exp instanceof Complex ? exp : number(exp));
  if (base instanceof BigNumber || base instanceof Fraction) {
    const n = typeof exp === 'bigint' ? exp : number(exp);
    if (typeof n === 'bigint' || Number.isInteger(n)) return base.pow(n);
    return Math.pow(number(base), n);
  }
  if (typeof base === 'bigint' && typeof exp === 'bigint') return base ** exp;
  return Math.pow(number(base), number(exp));
}

// --- unary operations ----------------------------------------------------------

/** Absolute value. `abs(Complex)` returns the magnitude (a real number). */
export function abs(x: NumericScalar): NumericScalar {
  if (typeof x === 'number') return Math.abs(x);
  if (typeof x === 'bigint') return x < 0n ? -x : x;
  return x.abs();
}

/** Round toward zero (truncate). Complex components are truncated independently. */
export function fix(x: NumericScalar): NumericScalar {
  if (typeof x === 'number') return Math.trunc(x);
  if (typeof x === 'bigint') return x;
  if (x instanceof Complex) return new Complex(Math.trunc(x.re), Math.trunc(x.im));
  return x.sign() >= 0 ? x.floor() : x.ceil();
}

/**
 * Round to the nearest integer, half toward +∞ — matching `Math.round` and
 * `Fraction.round`. `BigNumber.round` defaults to half-away-from-zero, so it is
 * given `'halfCeil'` explicitly; otherwise negative half-integers would round
 * type-dependently (`round(-2.5)` = −2 for number/Fraction but −3 for BigNumber).
 * Complex components are rounded independently.
 */
export function round(x: NumericScalar): NumericScalar {
  if (typeof x === 'number') return Math.round(x);
  if (typeof x === 'bigint') return x;
  if (x instanceof Complex) return new Complex(Math.round(x.re), Math.round(x.im));
  if (x instanceof BigNumber) return x.round(0, 'halfCeil');
  return x.round();
}

// --- comparison + predicates ---------------------------------------------------

/**
 * Equality. Floating-point operands compare with the configured tolerance
 * (`relTol`/`absTol`); exact types (Fraction, BigNumber) compare exactly —
 * tolerance is meaningless for an exact rational/decimal.
 */
export function equal(
  x: NumericScalar,
  y: NumericScalar,
  relTol: number = DEFAULT_CONFIG.relTol,
  absTol: number = DEFAULT_CONFIG.absTol
): boolean {
  if (typeof x === 'bigint' && typeof y === 'bigint') return x === y;
  if (isPrimitive(x) && isPrimitive(y)) return nearlyEqual(Number(x), Number(y), relTol, absTol);
  if (x instanceof Complex || y instanceof Complex) return asComplex(x).equals(asComplex(y));
  if (x instanceof Fraction && y instanceof Fraction) return x.equals(y);
  if (x instanceof BigNumber && y instanceof BigNumber) return x.equals(y);
  // mixed exact/primitive (e.g. Fraction vs number) — compare as reals w/ tolerance
  return nearlyEqual(number(x), number(y), relTol, absTol);
}

/**
 * True for values math treats as real-numeric: `number`, `bigint`, `boolean`,
 * `Fraction`, `BigNumber`. Mirrors mathjs semantics — `boolean` counts (it
 * coerces to 0/1), while `Complex` is intentionally NOT numeric (callers test it
 * separately), so `isNumeric(complex)` is `false`. The relocated Unit uses this as
 * its value-type gate (`isNumeric(value) || isComplex(value)`), and mathjs accepts
 * `new Unit(true)` — so booleans must pass.
 */
export function isNumeric(x: unknown): boolean {
  return (
    typeof x === 'number' ||
    typeof x === 'bigint' ||
    typeof x === 'boolean' ||
    x instanceof Fraction ||
    x instanceof BigNumber
  );
}

/**
 * Convert any scalar to a plain JS `number`. A non-real `Complex` (nonzero
 * imaginary part) has no real-number value and throws.
 */
export function number(x: NumericScalar): number {
  if (typeof x === 'number') return x;
  if (typeof x === 'bigint') return Number(x);
  if (x instanceof Fraction) return x.toNumber();
  if (x instanceof BigNumber) return x.toNumber();
  if (x.im !== 0) {
    throw new TypeError(`Cannot convert ${x.toString()} to a number: imaginary part is nonzero`);
  }
  return x.re;
}

/**
 * Unit value comparison shared by every relational Unit path in the typed layer
 * (#1552). The Unit constructor stores `value` in SI base units already, so no
 * prefix conversion is needed before comparing — the historical bug was comparing
 * the values with `===` (a reference compare for BigNumber/Fraction objects) and
 * casting them to `number` for ordering. These helpers compare the values with
 * the scalar semantics of `equal` / `compare` instead.
 */
import { equal as coreEqual, isBigNumber, isFraction } from '@danielsimonjr/mathts-core';

interface ScalarComparable {
  compare(other: unknown): number;
}

interface UnitLike {
  equalBase(other: unknown): boolean;
  value: unknown;
}

const asUnit = (u: unknown): UnitLike => u as UnitLike;

/**
 * Order the numeric values of two same-base Units: -1, 0, or 1. Numbers and
 * bigints compare numerically; BigNumber and Fraction use their own `compare`.
 */
export function unitValueCompare(x: unknown, y: unknown): number {
  if (typeof x === 'number' && typeof y === 'number') {
    return x > y ? 1 : x < y ? -1 : 0;
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    return x > y ? 1 : x < y ? -1 : 0;
  }
  if (isBigNumber(x) && isBigNumber(y)) {
    return (x as unknown as ScalarComparable).compare(y);
  }
  if (isFraction(x) && isFraction(y)) {
    return (x as unknown as ScalarComparable).compare(y);
  }
  const xn = Number(x);
  const yn = Number(y);
  return xn > yn ? 1 : xn < yn ? -1 : 0;
}

/**
 * Whether two same-base Units measure one quantity. The values are compared with
 * the scalar `equal` semantics (tolerance for numbers, `.equals` for BigNumber,
 * Fraction, and Complex), never with `===`.
 */
export function unitValueEqual(x: unknown, y: unknown): boolean {
  if (typeof x === 'number' && typeof y === 'number') {
    return coreEqual(x, y) as boolean;
  }
  if (typeof x === 'bigint' && typeof y === 'bigint') {
    return x === y;
  }
  if (isBigNumber(x) && isBigNumber(y)) {
    return (x as unknown as ScalarComparable).compare(y) === 0;
  }
  if (isFraction(x) && isFraction(y)) {
    return (x as unknown as ScalarComparable).compare(y) === 0;
  }
  return unitValueCompare(x, y) === 0;
}

/**
 * Whether two Units measure one quantity. Throws the mathjs error when the
 * dimensions differ, matching `equal(unit('50 cm'), unit('5 kg'))` in mathjs.
 */
export function unitsEqual(a: unknown, b: unknown): boolean {
  if (!asUnit(a).equalBase(b)) {
    throw new Error('Cannot compare units with different base');
  }
  return unitValueEqual(asUnit(a).value, asUnit(b).value);
}

/**
 * Comparison sign of two dimensionally-compatible Units (throws the mathjs error
 * when the dimensions differ).
 */
export function unitsCompare(a: unknown, b: unknown): number {
  if (!asUnit(a).equalBase(b)) {
    throw new Error('Cannot compare units with different base');
  }
  return unitValueCompare(asUnit(a).value, asUnit(b).value);
}

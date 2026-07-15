/**
 * Compares two BigNumbers.
 * @param {BigNumber} a - First value to compare
 * @param {BigNumber} b - Second value to compare
 * @param {number} [relTol=1e-09] - The relative tolerance, indicating the maximum allowed difference relative to the larger absolute value. Must be greater than 0.
 * @param {number} [absTol=0] - The minimum absolute tolerance, useful for comparisons near zero. Must be at least 0.
 * @returns {boolean} whether the two numbers are nearly equal
 * @throws {Error} If `relTol` is less than or equal to 0.
 * @throws {Error} If `absTol` is less than 0.
 *
 * @example
 * nearlyEqual(1.000000001, 1.0, 1e-9);            // true
 * nearlyEqual(1.000000002, 1.0, 0);            // false
 * nearlyEqual(1.0, 1.009, undefined, 0.02);       // true
 * nearlyEqual(0.000000001, 0.0, undefined, 1e-8); // true
 */
/**
 * Internal structural contract for the BigNumber values compared here. Inputs
 * are accepted as `unknown` (callers pass a variety of duck-typed BigNumber
 * shapes) and narrowed to this contract for the actual comparison.
 *
 * Uses MathTS core's BigNumber method names (`equals`/`sub`/`greaterThanOrEqual`/
 * `lessThanOrEqual`), not decimal.js's (`eq`/`minus`/`gte`/`lte`) — core's BigNumber
 * does not implement the latter, so the old decimal.js-shaped calls crashed every
 * BigNumber comparison (compare/smaller/larger/equal, and thus median/sort).
 */
interface BigNumberLike {
  isNaN(): boolean;
  isFinite(): boolean;
  equals(other: BigNumberLike): boolean;
  sub(other: BigNumberLike): BigNumberLike;
  mul(factor: number): BigNumberLike;
  abs(): BigNumberLike;
  greaterThanOrEqual(other: BigNumberLike): boolean;
  lessThanOrEqual(other: BigNumberLike | number): boolean;
}

export function nearlyEqual(a: unknown, b: unknown, relTol = 1e-9, absTol = 0): boolean {
  if (relTol <= 0) {
    throw new Error('Relative tolerance must be greater than 0');
  }

  if (absTol < 0) {
    throw new Error('Absolute tolerance must be at least 0');
  }

  const x = a as BigNumberLike;
  const y = b as BigNumberLike;

  // NaN
  if (x.isNaN() || y.isNaN()) {
    return false;
  }

  if (!x.isFinite() || !y.isFinite()) {
    return x.equals(y);
  }
  // use "==" operator, handles infinities
  if (x.equals(y)) {
    return true;
  }
  // abs(a-b) <= max(relTol * max(abs(a), abs(b)), absTol).
  // `diff <= max(P, Q)` is equivalent to `diff <= P || diff <= Q`, which avoids constructing a
  // BigNumber from the plain-number absTol (core's BigNumber has no number-arg constructor).
  const ax = x.abs();
  const ay = y.abs();
  const maxAbs = ax.greaterThanOrEqual(ay) ? ax : ay;
  const relBound = maxAbs.mul(relTol);
  const diff = x.sub(y).abs();
  return diff.lessThanOrEqual(relBound) || diff.lessThanOrEqual(absTol);
}

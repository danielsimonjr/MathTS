import { BigNumber } from '@danielsimonjr/mathts-core';

/**
 * The square root of the sum of the squares of real values, `sqrt(sum(x^2))`, where at least one
 * value is a BigNumber (#1255). A number value is converted to a BigNumber. Core
 * `BigNumber.hypotN` shifts the exponents before it squares, so no square goes out of range and
 * no value is rounded before it is squared.
 *
 * A NaN value gives NaN. Else an infinite value gives Infinity.
 */
export function bigHypot(values: readonly (number | BigNumber)[]): BigNumber {
  return BigNumber.hypotN(values.map((v) => (typeof v === 'number' ? BigNumber.fromNumber(v) : v)));
}

/**
 * The smallest sum of p-th powers of numbers that keeps its digits. A term below 2^-1022 is
 * subnormal, so it is rounded to a multiple of 2^-1074. A sum of at least 2^-969 hides that error.
 */
const P_NORM_SUM_MIN = 2 ** -969;

/** True when a sum of p-th powers of numbers did not overflow and did not lose digits (#1255). */
export function pNormSumInRange(sum: number): boolean {
  return sum >= P_NORM_SUM_MIN && sum < Infinity;
}

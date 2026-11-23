import { BigNumber, SQUARES_SAFE_MIN } from '@danielsimonjr/mathts-core';

/**
 * The square root of the sum of the squares of real values, `sqrt(sum(x^2))`, where at least one
 * value is a BigNumber (#1255). A number value is converted to a BigNumber. Core
 * `BigNumber.hypotN` shifts the exponents before it squares, so no square goes out of range and
 * no value is rounded before it is squared.
 *
 * An infinite value gives Infinity, also with a NaN. Else a NaN value gives NaN (#1259).
 */
export function bigHypot(values: readonly (number | BigNumber)[]): BigNumber {
  return BigNumber.hypotN(values.map((v) => (typeof v === 'number' ? BigNumber.fromNumber(v) : v)));
}

/** True when a sum of p-th powers of numbers did not overflow and did not lose digits (#1255). */
export function pNormSumInRange(sum: number): boolean {
  return sum >= SQUARES_SAFE_MIN && sum < Infinity;
}

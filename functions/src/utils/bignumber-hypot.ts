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

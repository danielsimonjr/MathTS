import type { BigNumber } from '@danielsimonjr/mathts-core';
import { splitNumber } from '../number.js';
import { nearlyEqual } from './nearlyEqual.js';

/** The message of a decimal count that is not an integer, as in mathjs. */
export const ROUND_DECIMALS_NOT_INTEGER = 'Number of decimals in function round must be an integer';

/**
 * Round a BigNumber to `decimals` places after the point, as mathjs does. The typed `round` and
 * the factory `round` share this kernel.
 *
 * A value nearly equal to its rounding at the `relTol` exponent takes that rounding first, so a
 * round-off error such as 2.3449999999999999999 rounds as 2.345. A decimal count at or above that
 * exponent rounds the value as it is. A decimal count that is not an integer throws a TypeError.
 */
export function roundBigNumberDecimals(
  x: BigNumber,
  decimals: number,
  relTol: number,
  absTol: number
): BigNumber {
  if (!Number.isInteger(decimals)) {
    throw new TypeError(ROUND_DECIMALS_NOT_INTEGER);
  }
  const epsilonExponent = Math.abs(splitNumber(relTol).exponent);
  if (decimals >= epsilonExponent) {
    return x.toDecimalPlaces(decimals);
  }
  const xEpsilon = x.toDecimalPlaces(epsilonExponent);
  const xSelected = nearlyEqual(x, xEpsilon, relTol, absTol) ? xEpsilon : x;
  return xSelected.toDecimalPlaces(decimals);
}

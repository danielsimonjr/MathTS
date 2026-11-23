import type { BigNumber, RoundingMode } from '../types/bignumber.js';
import { splitNumber } from '../number.js';
import { nearlyEqualBigNumber } from './nearly-equal-bignumber.js';

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
  absTol: number,
  mode?: RoundingMode
): BigNumber {
  if (!Number.isInteger(decimals)) {
    throw new TypeError(ROUND_DECIMALS_NOT_INTEGER);
  }
  const epsilonExponent = Math.abs(splitNumber(relTol).exponent);
  if (decimals >= epsilonExponent) {
    return x.toDecimalPlaces(decimals, mode);
  }
  const xEpsilon = x.toDecimalPlaces(epsilonExponent, mode);
  const xSelected = nearlyEqualBigNumber(x, xEpsilon, relTol, absTol) ? xEpsilon : x;
  return xSelected.toDecimalPlaces(decimals, mode);
}

import { isNumber, isBigNumber } from '../../utils/is.js';
/**
 * Change last argument dim from one-based to zero-based.
 */
export function dimToZeroBase(dim: unknown): unknown {
  if (isNumber(dim)) {
    return dim - 1;
  } else if (isBigNumber(dim)) {
    return (dim as unknown as { minus(n: number): unknown }).minus(1);
  } else {
    return dim;
  }
}

/**
 * Return `true` if the value is a number or a BigNumber.
 * @param n - The value to test.
 */
export function isNumberOrBigNumber(n: unknown): boolean {
  return isNumber(n) || isBigNumber(n);
}

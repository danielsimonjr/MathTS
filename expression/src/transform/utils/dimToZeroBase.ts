import { isNumber, isBigNumber } from '../../utils/is.js';

interface BigNumberDim {
  sub?(n: number): unknown;
  minus?(n: number): unknown;
}

/**
 * Convert a one-based dimension to zero-based.
 * Numbers are shifted with `- 1`. BigNumbers use `.sub(1)` (MathTS core)
 * and fall back to decimal.js `.minus(1)` when that is the only subtract API.
 * Any other value is returned unchanged.
 */
export function dimToZeroBase(dim: unknown): unknown {
  if (isNumber(dim)) {
    return dim - 1;
  } else if (isBigNumber(dim)) {
    const bn = dim as BigNumberDim;
    // MathTS BigNumber implements `.sub`; decimal.js-shaped values implement `.minus`.
    if (typeof bn.sub === 'function') {
      return bn.sub(1);
    }
    if (typeof bn.minus === 'function') {
      return bn.minus(1);
    }
    return dim;
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

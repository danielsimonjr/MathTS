import { isInteger } from '../../utils/number.js';
import { product } from '../../utils/product.js';
import { assertLoopOrder } from '../../utils/limits.js';

/**
 * Return the number of ways to choose `k` items from `n` items, without order.
 *
 * The loop alternates multiplication and division to keep intermediate values exact as long
 * as possible.
 *
 * @throws TypeError if `n` or `k` is not a non-negative integer, or if `k > n`.
 * @throws RangeError if `n` is not a safe integer, or if `min(k, n - k)` is above the loop bound
 */
export function combinationsNumber(n: number, k: number): number {
  if (!isInteger(n) || n < 0) {
    throw new TypeError('Positive integer value expected in function combinations');
  }
  if (!isInteger(k) || k < 0) {
    throw new TypeError('Positive integer value expected in function combinations');
  }
  if (k > n) {
    throw new TypeError('k must be less than or equal to n');
  }

  // Above 2^53 the counter `++nextnumerator` does not change the value, so the loop never ends.
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(
      `combinations: n must be a safe integer (at most ${Number.MAX_SAFE_INTEGER})`
    );
  }

  const nMinusk = n - k;
  assertLoopOrder('combinations', 'min(k, n - k)', Math.min(k, nMinusk));

  let answer = 1;
  const firstnumerator = k < nMinusk ? nMinusk + 1 : k + 1;
  let nextdivisor = 2;
  const lastdivisor = k < nMinusk ? k : nMinusk;
  // balance multiplications and divisions to try to keep intermediate values
  // in exact-integer range as long as possible
  for (let nextnumerator = firstnumerator; nextnumerator <= n; ++nextnumerator) {
    answer *= nextnumerator;
    while (nextdivisor <= lastdivisor && answer % nextdivisor === 0) {
      answer /= nextdivisor;
      ++nextdivisor;
    }
  }
  // for big n, k, floating point may have caused weirdness in remainder
  if (nextdivisor <= lastdivisor) {
    answer /= product(nextdivisor, lastdivisor);
  }
  return answer;
}
combinationsNumber.signature = 'number, number';

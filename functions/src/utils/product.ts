/**
 * Return the product of the integers from `i` to `n`. The result is 1 if `n < i`.
 *
 * @param {number} i
 *  @param {number} n
 *  @returns {number} product of i to n
 */
export function product(i: number, n: number): number {
  if (n < i) {
    return 1;
  }

  if (n === i) {
    return n;
  }

  // The midpoint of i and n. `n - i` is exact for safe integers, and `(n + i) / 2` is not: the
  // sum rounds above 2^53 and the recursion would not end.
  const half = i + Math.floor((n - i) / 2);
  return product(i, half) * product(half + 1, n);
}

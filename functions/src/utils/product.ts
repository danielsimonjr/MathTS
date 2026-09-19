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

  const half = (n + i) >> 1; // divide (n + i) by 2 and truncate to integer
  return product(i, half) * product(half + 1, n);
}

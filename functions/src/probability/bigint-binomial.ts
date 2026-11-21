/**
 * Exact bigint binomial coefficient and range product. The BigNumber functions of
 * `typed/probability.ts` and the number-theory sequences use them, and the caller rounds the
 * result one time. Not exported from the package barrel.
 */

/**
 * Exact binomial coefficient `C(n, k)` as a bigint: 0 when `k < 0` or `k > n`. The loop runs
 * `min(k, n - k)` steps, and each division is exact (a partial result is a binomial coefficient).
 */
export function binomialBigInt(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  const steps = k < n - k ? k : n - k;
  let c = 1n;
  for (let i = 1n; i <= steps; i++) {
    c = (c * (n - steps + i)) / i;
  }
  return c;
}

/**
 * The product `lo * (lo + 1) * ... * hi` as a bigint: 1 when `hi < lo`. The range splits at its
 * midpoint, as `product` does for numbers, so both factors stay about the same size and the
 * multiplications are fast.
 */
export function rangeProductBigInt(lo: bigint, hi: bigint): bigint {
  if (hi < lo) return 1n;
  if (hi === lo) return lo;
  const mid = lo + (hi - lo) / 2n;
  return rangeProductBigInt(lo, mid) * rangeProductBigInt(mid + 1n, hi);
}

/** 2^1024: every value at or above it is Infinity, because Number.MAX_VALUE < 2^1024. */
const MULTINOMIAL_LIMIT = 1n << 1024n;

/** Operation counter for tests: the number of binomial steps of one call. */
export interface MultinomialStats {
  steps: number;
}

/**
 * Exact multinomial of positive integers, as a product of binomials
 * C(total + a, min(a, total)). The partial products are exact integers. Each
 * step multiplies the running product by at least 2, and the product carries
 * across entries, so the loop stops after about 1024 steps in total. The result
 * is Infinity when the exact value rounds to Infinity.
 *
 * @param parts - Positive integer counts, already validated by the caller
 * @param stats - Optional counter that receives the number of binomial steps
 * @returns The multinomial coefficient, correctly rounded to a double
 */
export function multinomialExact(parts: readonly number[], stats?: MultinomialStats): number {
  let total = 0n;
  let result = 1n;
  for (const ai of parts) {
    const a = BigInt(ai);
    const n = total + a;
    const j = a < total ? a : total;
    let binom = 1n;
    for (let i = 1n; i <= j; i++) {
      if (stats !== undefined) stats.steps++;
      binom = (binom * (n - j + i)) / i;
      // mathjs 15.3.0 (#3790): the product overflows to NaN once a binomial step is out of range.
      if (result * binom >= MULTINOMIAL_LIMIT) return NaN;
    }
    result *= binom;
    total = n;
  }
  return Number(result);
}

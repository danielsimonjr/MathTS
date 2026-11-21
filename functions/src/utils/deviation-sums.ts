/**
 * The sums of the second, third and fourth powers of the deviations of a sample, with every digit
 * kept for data of any magnitude (#1280). `describe` and the D'Agostino test share this code.
 */
import { divideByScale, scaleForVariance } from '@danielsimonjr/mathts-core';

/** The sums of the 2nd, 3rd and 4th powers of the deviations from the mean. */
export interface DeviationSums {
  /** Sum of `(x - mean)^2`. */
  m2: number;
  /** Sum of `(x - mean)^3`. */
  m3: number;
  /** Sum of `(x - mean)^4`. */
  m4: number;
}

/**
 * The sums of the second, third and fourth powers of the deviations of `a` from `mean`.
 *
 * @param a - The sample.
 * @param mean - The mean of `a`.
 * @returns The three sums, in the units of `a` to the power 2, 3 and 4.
 *
 * @example
 * ```ts
 * deviationSums([1, 2, 3], 2); // { m2: 2, m3: 0, m4: 2 }
 * ```
 */
export function deviationSums(a: readonly number[], mean: number): DeviationSums {
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of a) {
    const d = v - mean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  return { m2, m3, m4 };
}

/**
 * The sums of {@link deviationSums} for a statistic that does not change when the data is divided
 * by a positive constant (a skewness, a kurtosis). The plain sums are returned (same bits) when
 * the population variance `m2 / n` is inside `[2^-400, 2^400]`. Else the sample is divided by one
 * exact power of 2 and the sums are formed again. The third and fourth powers leave the range
 * much earlier than the squares do, and a variance of 0 can come from squares that underflowed.
 * The returned sums are those of the scaled data, so the caller must not multiply them back.
 *
 * @param a - The sample.
 * @param meanOf - The mean function of the caller. It gives the plain path its bits.
 * @param plain - The plain sums, when the caller has them already.
 * @returns The plain sums, or the sums of the sample divided by an exact power of 2.
 *
 * @example
 * ```ts
 * const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
 * scaledDeviationSums([1, 2, 3], mean); // { m2: 2, m3: 0, m4: 2 }
 * ```
 */
export function scaledDeviationSums(
  a: number[],
  meanOf: (x: number[]) => number,
  plain: DeviationSums = deviationSums(a, meanOf(a))
): DeviationSums {
  const scale = scaleForVariance(plain.m2 / a.length, a);
  if (scale === 1) return plain;
  const data = divideByScale(a, scale);
  return deviationSums(data, meanOf(data));
}

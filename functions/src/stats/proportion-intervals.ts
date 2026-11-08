/**
 * Proportion intervals and rater agreement.
 *
 * - `wilsonInterval`: Wilson score interval for a binomial proportion.
 * - `newcombePairedInterval`: Newcombe (1998) method 10 for a paired difference.
 * - `cohensKappa`: Cohen's kappa for a square agreement matrix.
 */
import { normalQuantile } from '../distribution-functions.js';

/**
 * Computes the Wilson score interval for a binomial proportion.
 * The lower bound is exactly 0 at 0 successes, and the upper bound is exactly 1 at n.
 * @param successes Number of successes, an integer in [0, n].
 * @param n Number of trials, a positive integer.
 * @param confidence Confidence level in (0, 1).
 * @returns The interval bounds.
 */
export function wilsonInterval(
  successes: number,
  n: number,
  confidence = 0.95
): { lower: number; upper: number } {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError('n must be a positive integer');
  }
  if (!Number.isInteger(successes) || successes < 0 || successes > n) {
    throw new RangeError('successes must be an integer in [0, n]');
  }
  if (!(confidence > 0 && confidence < 1)) {
    throw new RangeError('confidence must be in (0, 1)');
  }

  const z = normalQuantile(1 - (1 - confidence) / 2);
  const z2 = z * z;
  const p = successes / n;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;

  const lower = successes === 0 ? 0 : Math.max(0, centre - half);
  const upper = successes === n ? 1 : Math.min(1, centre + half);
  return { lower, upper };
}

/**
 * Computes the Newcombe (1998) method 10 interval for the difference of two
 * paired proportions, (b - c) / n. The table holds the paired counts:
 * a = both positive, b = first only, c = second only, d = both negative.
 * @param table Paired counts, non-negative integers with a positive total.
 * @param confidence Confidence level in (0, 1).
 * @returns The difference and its interval, clipped to [-1, 1].
 */
export function newcombePairedInterval(
  table: { a: number; b: number; c: number; d: number },
  confidence = 0.95
): { diff: number; lower: number; upper: number } {
  const { a, b, c, d } = table;
  if ([a, b, c, d].some((value) => !Number.isInteger(value) || value < 0)) {
    throw new RangeError('table cells must be non-negative integers');
  }
  const n = a + b + c + d;
  if (n === 0) {
    throw new RangeError('table must contain at least one observation');
  }

  const w1 = wilsonInterval(a + b, n, confidence);
  const w2 = wilsonInterval(a + c, n, confidence);
  const p1 = (a + b) / n;
  const p2 = (a + c) / n;
  const diff = p1 - p2;

  let num = a * d - b * c;
  if (num > 0) num = Math.max(num - n / 2, 0);
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  const phi = den === 0 ? 0 : num / den;

  const dl2 = (p1 - w1.lower) ** 2;
  const du2 = (w1.upper - p1) ** 2;
  const el2 = (p2 - w2.lower) ** 2;
  const eu2 = (w2.upper - p2) ** 2;

  const lower = diff - Math.sqrt(Math.max(0, dl2 - 2 * phi * Math.sqrt(dl2 * eu2) + eu2));
  const upper = diff + Math.sqrt(Math.max(0, du2 - 2 * phi * Math.sqrt(du2 * el2) + el2));
  return { diff, lower: Math.max(-1, lower), upper: Math.min(1, upper) };
}

/**
 * Computes Cohen's kappa for a square agreement matrix of counts.
 * @param matrix Square, non-empty matrix of non-negative finite counts.
 * @returns Kappa, or NaN when the chance agreement is 1.
 */
export function cohensKappa(matrix: readonly (readonly number[])[]): number {
  const size = matrix.length;
  if (size === 0) {
    throw new RangeError('matrix must be a non-empty square matrix');
  }
  const rowSums = new Array<number>(size).fill(0);
  const colSums = new Array<number>(size).fill(0);
  let total = 0;
  let trace = 0;

  for (let i = 0; i < size; i++) {
    const row = matrix[i];
    if (row === undefined || row.length !== size) {
      throw new RangeError('matrix must be square');
    }
    for (let j = 0; j < size; j++) {
      const value = row[j] as number;
      if (!Number.isFinite(value) || value < 0) {
        throw new RangeError('matrix cells must be non-negative finite numbers');
      }
      rowSums[i] = (rowSums[i] as number) + value;
      colSums[j] = (colSums[j] as number) + value;
      total += value;
      if (i === j) trace += value;
    }
  }
  if (total === 0) {
    throw new RangeError('matrix total must be positive');
  }

  let expected = 0;
  for (let i = 0; i < size; i++) expected += (rowSums[i] as number) * (colSums[i] as number);
  const po = trace / total;
  const pe = expected / (total * total);
  // pe = 1 only when every rating falls in one cell, so po = 1 and the ratio is 0/0 = NaN.
  return (po - pe) / (1 - pe);
}

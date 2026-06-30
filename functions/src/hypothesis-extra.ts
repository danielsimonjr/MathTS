/**
 * Additional hypothesis tests (Wave B / bridge C9).
 *
 * Each reuses existing machinery — `variance` (typed), `skewness`/`kurtosis`
 * (Wave A descriptive stats), and the standalone distribution CDFs — rather than
 * re-deriving statistics or tail probabilities. Results follow the existing
 * `{ statistic, pValue, … }` shape used in `typed/hypothesis.ts`.
 */
import { variance as _variance } from './typed/arithmetic.js';
import { skewness, kurtosis } from './descriptive-stats.js';
import { fCDF, chiSquaredCDF } from './distribution-functions.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const sampleVar = (x: number[]): number => _variance(x) as number; // default: unbiased (n−1)

export interface FTestResult {
  statistic: number;
  pValue: number;
  df1: number;
  df2: number;
}

/**
 * Two-sample F-test for equality of variances. `F = s²₁ / s²₂` on sample
 * variances; two-sided p-value `2·min(F_cdf, 1−F_cdf)`.
 */
export function fTest(x: Vec, y: Vec): FTestResult {
  const a = arr(x);
  const b = arr(y);
  const df1 = a.length - 1;
  const df2 = b.length - 1;
  const statistic = sampleVar(a) / sampleVar(b);
  const lower = fCDF(statistic, df1, df2);
  const pValue = 2 * Math.min(lower, 1 - lower);
  return { statistic, pValue, df1, df2 };
}

export interface JarqueBeraResult {
  statistic: number;
  pValue: number;
  skewness: number;
  kurtosis: number;
}

/**
 * Jarque–Bera test of normality from sample skewness `S` and excess kurtosis `K`:
 * `JB = n/6·(S² + K²/4)`, asymptotically χ²(2). Bridges descriptive stats ↔ tests.
 */
export function jarqueBera(x: Vec): JarqueBeraResult {
  const a = arr(x);
  const n = a.length;
  const s = skewness(a); // population (SciPy bias=true)
  const k = kurtosis(a); // excess
  const statistic = (n / 6) * (s * s + (k * k) / 4);
  const pValue = 1 - chiSquaredCDF(statistic, 2);
  return { statistic, pValue, skewness: s, kurtosis: k };
}

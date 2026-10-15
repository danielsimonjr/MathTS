/**
 * Ordinary least-squares regression (Wave D / regression primitives).
 * Bridges statistics ↔ linear algebra; reuses core's pairwise sums + the `studentTTwoSidedP` tail
 * for the slope's significance test. Matches `scipy.stats.linregress`.
 */
import { pairwiseDot, pairwiseSum, sumSquaredDeviations } from '@danielsimonjr/mathts-core';
import { studentTTwoSidedP } from './distribution-functions.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));

/** The least-squares line through `(x, y)` and the sums its inference needs. */
export interface LineFit {
  slope: number;
  intercept: number;
  rValue: number;
  /** Mean of x. */
  mx: number;
  /** Σ(x − x̄)². */
  sxx: number;
  /** Residual sum of squares Σ(y − ŷ)², summed from the residuals themselves. */
  rss: number;
}

/**
 * Fit `y ≈ slope·x + intercept` by least squares, with every sum pairwise (core's stable sums).
 * The residual sum of squares is summed from the residuals, never formed as `syy − slope·sxy`
 * (`syy·(1 − r²)`): that difference cancels on a near-exact fit, and goes negative when r rounds
 * above 1, which made the slope standard error NaN. Callers check lengths and n ≥ 3.
 * Shared by `linearRegression` and `linregress`.
 */
export function fitLine(a: number[], b: number[]): LineFit {
  const n = a.length;
  const mx = pairwiseSum(a) / n;
  const my = pairwiseSum(b) / n;
  const dx = a.map((v) => v - mx);
  const dy = b.map((v) => v - my);
  const sxx = sumSquaredDeviations(a);
  const syy = sumSquaredDeviations(b);
  const sxy = pairwiseDot(dx, dy);
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rValue = sxy / Math.sqrt(sxx * syy);
  const residuals = b.map((v, i) => v - (slope * a[i] + intercept));
  const rss = pairwiseDot(residuals, residuals);
  return { slope, intercept, rValue, mx, sxx, rss };
}

/** Result of `linearRegression`: the fitted line and its statistics. */
export interface LinregressResult {
  slope: number;
  intercept: number;
  rValue: number;
  rSquared: number;
  pValue: number;
  stdErr: number;
}

/**
 * Simple linear regression `y ≈ slope·x + intercept` by ordinary least squares.
 * `rValue` is Pearson's r; `pValue` is the two-sided test of slope = 0 (t with
 * n−2 df); `stdErr` is the standard error of the slope,
 * √(Σ(y − ŷ)² / ((n − 2)·Σ(x − x̄)²)), from the residuals. Mirrors `scipy.stats.linregress`.
 */
export function linearRegression(x: Vec, y: Vec): LinregressResult {
  const a = arr(x);
  const b = arr(y);
  const n = a.length;
  if (b.length !== n) throw new Error(`linearRegression: length mismatch ${n} vs ${b.length}`);
  if (n < 3)
    throw new Error('linearRegression: need at least 3 points for a slope significance test');
  const { slope, intercept, rValue, sxx, rss } = fitLine(a, b);
  if (sxx === 0) throw new Error('linearRegression: predictor x has zero variance');
  const df = n - 2;
  // Residual mean square → slope standard error; t-test for slope = 0.
  const stdErr = Math.sqrt(rss / df / sxx);
  const t = slope / stdErr;
  const pValue = studentTTwoSidedP(t, df);
  return { slope, intercept, rValue, rSquared: rValue * rValue, pValue, stdErr };
}

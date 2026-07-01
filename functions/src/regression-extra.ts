/**
 * Ordinary least-squares regression (Wave D / regression primitives).
 * Bridges statistics ↔ linear algebra; reuses `mean` + the `studentTCDF` connector
 * for the slope's significance test. Matches `scipy.stats.linregress`.
 */
import { mean as _mean } from './typed/arithmetic.js';
import { studentTCDF } from './distribution-functions.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const mean = (x: number[]): number => _mean(x) as number;

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
 * n−2 df); `stdErr` is the standard error of the slope. Mirrors
 * `scipy.stats.linregress`.
 */
export function linearRegression(x: Vec, y: Vec): LinregressResult {
  const a = arr(x);
  const b = arr(y);
  const n = a.length;
  if (b.length !== n) throw new Error(`linearRegression: length mismatch ${n} vs ${b.length}`);
  if (n < 3)
    throw new Error('linearRegression: need at least 3 points for a slope significance test');
  const mx = mean(a);
  const my = mean(b);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = a[i] - mx;
    const dy = b[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx === 0) throw new Error('linearRegression: predictor x has zero variance');
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const rValue = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  // residual mean square → slope standard error; t-test for slope = 0
  const stdErr = Math.sqrt((syy - slope * sxy) / df / sxx);
  const t = slope / stdErr;
  const pValue = 2 * (1 - studentTCDF(Math.abs(t), df));
  return { slope, intercept, rValue, rSquared: rValue * rValue, pValue, stdErr };
}

/**
 * Ordinary least-squares regression (Wave D / regression primitives).
 * Bridges statistics ↔ linear algebra; reuses core's pairwise sums + the `studentTTwoSidedP` tail
 * for the slope's significance test. Matches `scipy.stats.linregress`.
 */
import {
  divideByScale,
  pairwiseDot,
  pairwiseSum,
  powerOfTwoScaleOf,
  SQUARES_SAFE_MIN,
  sumSquaredDeviations,
} from '@danielsimonjr/mathts-core';
import { studentTTwoSidedP } from './distribution-functions.js';
import { numberVector } from './typed/number-matrix.js';

type Vec = readonly number[] | Float64Array;

/** The least-squares line through `(x, y)` and the sums its inference needs. */
export interface LineFit {
  slope: number;
  intercept: number;
  rValue: number;
  /** Mean of x. */
  mx: number;
  /** Σ(x − x̄)². */
  sxx: number;
  /** Σ(y − ȳ)². */
  syy: number;
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
  return { slope, intercept, rValue, mx, sxx, syy, rss };
}

/** The smallest normal double: a product of two sums below it has lost digits. */
const MIN_NORMAL = 2 ** -1022;

/** A {@link LineFit} and the exact powers of 2 by which x and y were divided before the fit. */
export interface ScaledLineFit {
  /** The fit of `x / sx` and `y / sy`. With `sx = sy = 1` it is the fit of the data. */
  fit: LineFit;
  /** The scale of x, a power of 2. */
  sx: number;
  /** The scale of y, a power of 2. */
  sy: number;
}

/**
 * {@link fitLine} for data of any magnitude (#1280). The fit of the data is kept (same bits) when
 * both sums of squares keep their digits (each is at least `SQUARES_SAFE_MIN`) and their product
 * is a normal double: no square lost digits, and `rValue` does not divide by an underflowed or
 * an overflowed product. Else x and y are each divided by their own exact power of 2 and fitted
 * again: the correlation does not change, and {@link unscaleLinregress} gives the slope, the
 * intercept and the standard errors back in the units of the data. A predictor that is
 * constant stays constant (`sxx = 0`). The sums are not multiplied back: they leave the range
 * that the scale gave them.
 */
export function fitLineScaled(a: number[], b: number[]): ScaledLineFit {
  const plain = fitLine(a, b);
  const product = plain.sxx * plain.syy;
  if (
    plain.sxx >= SQUARES_SAFE_MIN &&
    plain.syy >= SQUARES_SAFE_MIN &&
    product >= MIN_NORMAL &&
    product <= Number.MAX_VALUE
  ) {
    return { fit: plain, sx: 1, sy: 1 };
  }
  const sx = powerOfTwoScaleOf(a);
  const sy = powerOfTwoScaleOf(b);
  if (sx === 1 && sy === 1) return { fit: plain, sx, sy };
  return { fit: fitLine(divideByScale(a, sx), divideByScale(b, sy)), sx, sy };
}

/**
 * The result of {@link linregressFromFit} on a {@link ScaledLineFit}, in the units of the data:
 * the slope and its standard error times `sy / sx`, the intercept times `sy`. The correlation,
 * R² and the p-value do not depend on the units.
 */
export function unscaleLinregress(
  r: LinregressResult,
  s: { sx: number; sy: number }
): LinregressResult {
  if (s.sx === 1 && s.sy === 1) return r;
  const ratio = s.sy / s.sx;
  return {
    ...r,
    slope: r.slope * ratio,
    intercept: r.intercept * s.sy,
    stdErr: r.stdErr * ratio,
  };
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
  const a = numberVector('linearRegression', x);
  const b = numberVector('linearRegression', y);
  const n = a.length;
  if (b.length !== n) throw new Error(`linearRegression: length mismatch ${n} vs ${b.length}`);
  if (n < 3)
    throw new Error('linearRegression: need at least 3 points for a slope significance test');
  const scaled = fitLineScaled(a, b);
  if (scaled.fit.sxx === 0) throw new Error('linearRegression: predictor x has zero variance');
  return unscaleLinregress(linregressFromFit(scaled.fit, n), scaled);
}

/**
 * Slope inference from an existing {@link LineFit} (`sxx > 0`, `n ≥ 3`): R², the slope standard
 * error and the two-sided slope p-value. Lets `linregress` fit once and reuse the fit for the
 * intercept standard error instead of fitting a second time through `linearRegression`.
 */
export function linregressFromFit(fit: LineFit, n: number): LinregressResult {
  const { slope, intercept, rValue, sxx, rss } = fit;
  const df = n - 2;
  // Residual mean square → slope standard error; t-test for slope = 0.
  const stdErr = Math.sqrt(rss / df / sxx);
  // SciPy `linregress` uses r-based t with a denominator guard (`TINY`), not slope/stdErr
  // (which is 0 on an exact fit and would flush p to 0).
  const TINY = 1e-20;
  const r = Math.max(-1, Math.min(1, rValue));
  const t = r * Math.sqrt(df / ((1 - r + TINY) * (1 + r + TINY)));
  const pValue = studentTTwoSidedP(t, df);
  return { slope, intercept, rValue, rSquared: rValue * rValue, pValue, stdErr };
}

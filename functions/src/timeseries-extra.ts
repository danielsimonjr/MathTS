/**
 * Time-series basics (Wave D) — a near-absent domain in the gap analysis.
 * Reuses `mean`/`variance` and the `cov` connector rather than re-deriving moments.
 * Bridges signal ↔ statistics (the statistical ACF, distinct from the signal-domain
 * `autoCorrelation`).
 */
import { mean as _mean } from './typed/arithmetic.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const mean = (x: number[]): number => _mean(x) as number;

/**
 * Simple moving average over a trailing window of size `w`. Returns an array of
 * length `n − w + 1` (the "valid" convolution, like `numpy.convolve(..., 'valid')`).
 */
export function movingAverage(x: Vec, w: number): number[] {
  const a = arr(x);
  if (w <= 0 || w > a.length) throw new Error(`movingAverage: window ${w} out of range`);
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i];
    if (i >= w) sum -= a[i - w];
    if (i >= w - 1) out.push(sum / w);
  }
  return out;
}

/**
 * Exponentially-weighted moving average with smoothing factor `alpha ∈ (0,1]`
 * (`yₜ = α·xₜ + (1−α)·yₜ₋₁`, seeded with `x₀`). Matches `pandas.ewm(alpha=…,
 * adjust=False).mean()`. Output has the same length as the input.
 */
export function ewma(x: Vec, alpha: number): number[] {
  const a = arr(x);
  if (alpha <= 0 || alpha > 1) throw new Error('ewma: alpha must be in (0, 1]');
  if (a.length === 0) throw new Error('ewma: input series is empty');
  const out = new Array<number>(a.length);
  let prev = a[0];
  out[0] = prev;
  for (let i = 1; i < a.length; i++) {
    prev = alpha * a[i] + (1 - alpha) * prev;
    out[i] = prev;
  }
  return out;
}

/**
 * Remove a trend from `x`. `'linear'` (default) subtracts the least-squares line;
 * `'constant'` subtracts the mean. Matches `scipy.signal.detrend`.
 */
export function detrend(x: Vec, type: 'linear' | 'constant' = 'linear'): number[] {
  const a = arr(x);
  const n = a.length;
  if (type === 'constant') {
    const m = mean(a);
    return a.map((v) => v - m);
  }
  // A linear fit needs ≥2 points; for 0 or 1 points the exact fit leaves zero
  // residual (was slope = 0/0 = NaN poisoning the whole output).
  if (n < 2) return a.map(() => 0);
  // linear least-squares fit y = slope·t + intercept, t = 0..n−1
  const t = Array.from({ length: n }, (_, i) => i);
  const mt = mean(t);
  const my = mean(a);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (t[i] - mt) * (a[i] - my);
    sxx += (t[i] - mt) * (t[i] - mt);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mt;
  return a.map((v, i) => v - (slope * t[i] + intercept));
}

/**
 * Autocorrelation function up to `nlags` (inclusive), biased estimator
 * (÷n, like `statsmodels.tsa.stattools.acf`). `acf[0] = 1`.
 */
export function acf(x: Vec, nlags: number): number[] {
  const a = arr(x);
  const n = a.length;
  if (nlags < 0 || nlags >= n)
    throw new Error(`acf: nlags ${nlags} out of range for series length ${n}`);
  const m = mean(a);
  const dev = a.map((v) => v - m);
  let c0 = 0;
  for (let i = 0; i < n; i++) c0 += dev[i] * dev[i];
  if (c0 === 0) throw new Error('acf: series has zero variance');
  const out = new Array<number>(nlags + 1);
  for (let k = 0; k <= nlags; k++) {
    let ck = 0;
    for (let i = 0; i < n - k; i++) ck += dev[i] * dev[i + k];
    out[k] = ck / c0;
  }
  return out;
}

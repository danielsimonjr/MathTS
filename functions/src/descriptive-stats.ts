/**
 * Descriptive-statistics composites (Wave A of the domain gap analysis).
 *
 * These are thin, exact compositions over primitives that already exist in the
 * package — `mean`, `std`, `variance`, `sum` (typed) and `quantileSeq` (factory).
 * Nothing here re-implements a reduction the library already provides; each
 * function is the missing *connector* identified in
 * `docs/roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md`.
 *
 * Conventions match NumPy/SciPy defaults (verified against an oracle):
 *   - `skewness`/`kurtosis` use population central moments (SciPy `bias=true`),
 *     with an opt-in sample bias correction.
 *   - `kurtosis` returns excess kurtosis (SciPy `fisher=true`) by default.
 *   - `cov`/`corrcoef` use `ddof=1` (sample) like `numpy.cov` and treat each row
 *     as an observation, each column as a variable (the data-matrix convention).
 *   - `zscore` uses population std (`ddof=0`); `sem` uses sample std (`ddof=1`).
 */
import { mean as _mean, std as _std, sum as _sum } from './typed/arithmetic.js';
import { quantileSeq as _quantileSeqRaw } from './factories/index.js';
import { studentTCDF as _studentTCDF } from './distribution-functions.js';
import { normalCDF as _normalCDF } from './typed/distributions.js';

const _quantileSeq = _quantileSeqRaw as (data: readonly number[], p: number) => number;

type Vec = readonly number[] | Float64Array;

const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const mean = (x: number[]): number => _mean(x) as number;
const stdPop = (x: number[]): number => _std(x, 'uncorrected') as number;
const stdSample = (x: number[]): number => _std(x) as number; // default is unbiased (n-1)
const sum = (x: number[]): number => _sum(x) as number;

/** k-th central moment `E[(x − mean)^k]` (population, ÷n) — the shared core. */
function centralMoment(x: number[], k: number): number {
  if (x.length === 0) return NaN;
  const m = mean(x);
  let acc = 0;
  for (let i = 0; i < x.length; i++) acc += Math.pow(x[i] - m, k);
  return acc / x.length;
}

/**
 * Ranks of the data with tie handling (SciPy `rankdata`, default `'average'`):
 * tied values receive the mean of the ranks they span. Ranks are 1-based.
 */
export function rankdata(x: Vec): number[] {
  const a = arr(x);
  const n = a.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i] - a[j]);
  const ranks = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && a[order[j]] === a[order[i]]) j++;
    const avg = (i + 1 + j) / 2; // mean of 1-based ranks i+1 … j
    for (let k = i; k < j; k++) ranks[order[k]] = avg;
    i = j;
  }
  return ranks;
}

/**
 * Spearman rank correlation coefficient ρ — the Pearson correlation of the
 * rank-transformed inputs (ties broken by average ranks via {@link rankdata}).
 * Unlike Pearson, it measures any MONOTONIC relationship, so a monotonic
 * non-linear pair (e.g. `y = x²` on positives) gives ρ = 1. Result is in [−1, 1].
 *
 * @throws if the inputs differ in length or a rank vector is constant.
 */
export function spearman(x: Vec, y: Vec): number {
  const rx = rankdata(x);
  const ry = rankdata(y);
  const n = rx.length;
  if (n !== ry.length) throw new Error('spearman: inputs must have equal length');
  if (n === 0) return NaN;
  const mx = mean(rx);
  const my = mean(ry);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = rx[i] - mx;
    const dy = ry[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) {
    throw new Error('spearman: a rank vector is constant; correlation undefined');
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Geometric mean: `exp(mean(ln x))` (stable form). All entries must be > 0. */
export function gmean(x: Vec): number {
  const a = arr(x);
  if (a.length === 0) return NaN; // empty is undefined (graceful NaN, numpy parity)
  if (a.some((v) => v <= 0)) throw new Error('gmean: all entries must be > 0');
  return Math.exp(mean(a.map(Math.log)));
}

/** Harmonic mean: `n / Σ(1/xᵢ)`. All entries must be > 0. */
export function hmean(x: Vec): number {
  const a = arr(x);
  if (a.length === 0) return NaN; // empty is undefined (graceful NaN, numpy parity)
  if (a.some((v) => v <= 0)) throw new Error('hmean: all entries must be > 0');
  return a.length / sum(a.map((v) => 1 / v));
}

/** Raw or central k-th moment. `central` (default true) subtracts the mean first. */
export function moment(x: Vec, k: number, central = true): number {
  const a = arr(x);
  if (!central) {
    if (a.length === 0) return NaN;
    return mean(a.map((v) => Math.pow(v, k)));
  }
  return centralMoment(a, k);
}

/**
 * Skewness (third standardized moment). Population estimator by default
 * (SciPy `bias=true`); pass `{ bias: false }` for the sample-corrected G₁.
 */
export function skewness(x: Vec, opts: { bias?: boolean } = {}): number {
  const a = arr(x);
  const n = a.length;
  const m2 = centralMoment(a, 2); // NaN for empty (graceful) — the m2===0 guard skips it
  if (m2 === 0) throw new Error('skewness: variance is zero (constant input); skewness undefined');
  const m3 = centralMoment(a, 3);
  const g1 = m3 / Math.pow(m2, 1.5);
  if (opts.bias === false) {
    // Sample correction (SciPy G₁) is undefined for n ≤ 2 — SciPy returns nan.
    if (n <= 2) return NaN;
    return (Math.sqrt(n * (n - 1)) / (n - 2)) * g1;
  }
  return g1;
}

/**
 * Kurtosis. Excess kurtosis by default (SciPy `fisher=true`, subtracts 3);
 * pass `{ fisher: false }` for Pearson's kurtosis. Population estimator by
 * default; `{ bias: false }` applies the sample correction.
 */
export function kurtosis(x: Vec, opts: { fisher?: boolean; bias?: boolean } = {}): number {
  const a = arr(x);
  const n = a.length;
  const m2 = centralMoment(a, 2); // NaN for empty (graceful) — the m2===0 guard skips it
  if (m2 === 0) throw new Error('kurtosis: variance is zero (constant input); kurtosis undefined');
  const m4 = centralMoment(a, 4);
  let g2 = m4 / (m2 * m2); // Pearson's kurtosis
  if (opts.bias === false) {
    // Sample correction is undefined for n ≤ 3 — SciPy returns nan.
    if (n <= 3) return NaN;
    g2 = ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 - 3 * (n - 1)) + 3;
  }
  return opts.fisher === false ? g2 : g2 - 3;
}

/** Interquartile range: `Q3 − Q1` via `quantileSeq`. */
export function iqr(x: Vec): number {
  const a = arr(x);
  return (_quantileSeq(a, 0.75) as number) - (_quantileSeq(a, 0.25) as number);
}

/** Standard error of the mean: `sampleStd / √n`. */
export function sem(x: Vec): number {
  const a = arr(x);
  if (a.length === 0) return NaN;
  return stdSample(a) / Math.sqrt(a.length);
}

/**
 * Z-scores: `(xᵢ − mean) / std`, using population std (SciPy `zscore` default,
 * `ddof=0`). Returns an array the same length as the input.
 */
export function zscore(x: Vec): number[] {
  const a = arr(x);
  if (a.length === 0) return []; // empty in → empty out (graceful)
  const m = mean(a);
  const s = stdPop(a);
  if (s === 0) throw new Error('zscore: standard deviation is zero (constant input)');
  return a.map((v) => (v - m) / s);
}

/**
 * Covariance.
 *   - `cov(x, y)` → scalar sample covariance of two equal-length vectors.
 *   - `cov(matrix)` → covariance matrix; rows are observations, columns are
 *     variables (NumPy `rowvar=false`). `ddof` defaults to 1 (sample).
 */
export function cov(x: Vec | number[][], y?: Vec, ddof = 1): number | number[][] {
  if (y !== undefined) {
    const a = arr(x as Vec);
    const b = arr(y);
    if (a.length !== b.length) throw new Error(`cov: length mismatch ${a.length} vs ${b.length}`);
    if (a.length <= ddof)
      throw new Error(`cov: need more than ddof=${ddof} observations (got n=${a.length})`);
    const ma = mean(a);
    const mb = mean(b);
    let acc = 0;
    for (let i = 0; i < a.length; i++) acc += (a[i] - ma) * (b[i] - mb);
    return acc / (a.length - ddof);
  }
  // matrix form: rows = observations, columns = variables
  const M = (x as number[][]).map((r) => Array.from(r));
  const nObs = M.length;
  if (nObs <= ddof)
    throw new Error(`cov: need more than ddof=${ddof} observations (got n=${nObs})`);
  const nVar = M[0].length;
  const cols = Array.from({ length: nVar }, (_, j) => M.map((r) => r[j]));
  const means = cols.map(mean);
  const out: number[][] = Array.from({ length: nVar }, () => new Array<number>(nVar).fill(0));
  for (let i = 0; i < nVar; i++) {
    for (let j = i; j < nVar; j++) {
      let acc = 0;
      for (let k = 0; k < nObs; k++) acc += (cols[i][k] - means[i]) * (cols[j][k] - means[j]);
      const c = acc / (nObs - ddof);
      out[i][j] = c;
      out[j][i] = c;
    }
  }
  return out;
}

/**
 * Correlation-coefficient matrix from {@link cov} (rows = observations,
 * columns = variables). Diagonal is 1; off-diagonals are Pearson r.
 */
export function corrcoef(matrix: number[][]): number[][] {
  const c = cov(matrix) as number[][];
  const n = c.length;
  const d = c.map((row, i) => Math.sqrt(row[i]));
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => c[i][j] / (d[i] * d[j]))
  );
}

/**
 * Kendall's τ_b rank correlation coefficient — a tie-corrected measure of
 * ordinal association based on the difference between concordant and discordant
 * pairs. Complements {@link spearman} (rank Pearson) and Pearson `corr`.
 * Returns τ_b = (P − Q) / √((n₀ − n₁)(n₀ − n₂)), matching `scipy.stats.kendalltau`
 * (`variant='b'`, its default), where n₀ = n(n−1)/2 and n₁/n₂ are the tie-pair
 * counts in x and y respectively.
 *
 * @example kendallTau([1,2,3,4,5], [2,1,4,3,5]) // 0.6
 */
export function kendallTau(x: Vec, y: Vec): number {
  const n = x.length;
  if (n !== y.length) throw new Error('kendallTau: inputs must have equal length');
  if (n < 2) return NaN;
  let P = 0;
  let Q = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = Math.sign(x[j] - x[i]) * Math.sign(y[j] - y[i]);
      if (s > 0) P++;
      else if (s < 0) Q++;
    }
  }
  const n0 = (n * (n - 1)) / 2;
  const tiePairs = (arr: Vec): number => {
    const counts = new Map<number, number>();
    for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
    let s = 0;
    for (const c of counts.values()) s += (c * (c - 1)) / 2;
    return s;
  };
  const n1 = tiePairs(x);
  const n2 = tiePairs(y);
  const denom = Math.sqrt((n0 - n1) * (n0 - n2));
  if (denom === 0) return NaN;
  return (P - Q) / denom;
}

// ===========================================================================
// Regression & inference — Wave B (statistics gap-closure)
// ===========================================================================

/** Two-tailed Student-t p-value: 2·(1 − T_df(|t|)). */
function _tTwoTail(t: number, df: number): number {
  return 2 * (1 - (_studentTCDF(Math.abs(t), df) as number));
}

/** Result of a simple linear regression with inference. */
export interface LinRegressResult {
  slope: number;
  intercept: number;
  rValue: number;
  pValue: number;
  stdErr: number;
  interceptStdErr: number;
}

/**
 * OLS simple linear regression **with inference** — `y ≈ slope·x + intercept`,
 * plus the correlation coefficient, the slope p-value (t-test, df = n−2), and
 * the slope/intercept standard errors. Matches `scipy.stats.linregress`.
 */
export function linregress(x: Vec, y: Vec): LinRegressResult {
  const n = x.length;
  if (n !== y.length) throw new Error('linregress: x and y must have equal length');
  if (n < 3) throw new Error('linregress: need at least 3 points for inference');
  const xa = Array.from(x);
  const ya = Array.from(y);
  const xbar = mean(xa);
  const ybar = mean(ya);
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xa[i] - xbar;
    const dy = ya[i] - ybar;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const slope = sxy / sxx;
  const intercept = ybar - slope * xbar;
  const rValue = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  const s2 = (syy - slope * sxy) / df;
  const stdErr = Math.sqrt(s2 / sxx);
  const interceptStdErr = Math.sqrt(s2 * (1 / n + (xbar * xbar) / sxx));
  return {
    slope,
    intercept,
    rValue,
    pValue: _tTwoTail(slope / stdErr, df),
    stdErr,
    interceptStdErr,
  };
}

// ===========================================================================
// Correlation TESTS (coefficient + p-value) — Wave C
// ===========================================================================

/** A correlation coefficient with its two-tailed significance p-value. */
export interface CorrelationTestResult {
  coefficient: number;
  pValue: number;
}

/** t-test p-value for a correlation coefficient r on df = n−2. */
function _corrTPValue(r: number, n: number): number {
  const df = n - 2;
  if (df <= 0 || Math.abs(r) >= 1) return Math.abs(r) >= 1 ? 0 : 1;
  const t = r * Math.sqrt(df / (1 - r * r));
  return _tTwoTail(t, df);
}

/** Pearson correlation coefficient of two equal-length vectors. */
function _pearson(x: Vec, y: Vec): number {
  const xa = Array.from(x);
  const ya = Array.from(y);
  const n = xa.length;
  if (n !== ya.length) throw new Error('pearsonr: inputs must have equal length');
  const mx = mean(xa);
  const my = mean(ya);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xa[i] - mx;
    const dy = ya[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Pearson correlation **test** (coefficient + two-tailed p, t-test). `scipy.stats.pearsonr`. */
export function pearsonr(x: Vec, y: Vec): CorrelationTestResult {
  const r = _pearson(x, y);
  return { coefficient: r, pValue: _corrTPValue(r, x.length) };
}

/** Spearman rank-correlation **test** (rho + two-tailed p, t-test). `scipy.stats.spearmanr`. */
export function spearmanr(x: Vec, y: Vec): CorrelationTestResult {
  const rho = spearman(x, y);
  return { coefficient: rho, pValue: _corrTPValue(rho, x.length) };
}

/**
 * Kendall's τ **test** — τ_b coefficient and two-tailed p via the normal
 * approximation `z = 3τ√(n(n−1)) / √(2(2n+5))` (standard large-sample form;
 * scipy's small-n exact p is version/table-specific).
 */
export function kendalltau(x: Vec, y: Vec): CorrelationTestResult {
  const tau = kendallTau(x, y);
  const n = x.length;
  const z = (3 * tau * Math.sqrt(n * (n - 1))) / Math.sqrt(2 * (2 * n + 5));
  return { coefficient: tau, pValue: 2 * (1 - (_normalCDF(Math.abs(z)) as number)) };
}

// ===========================================================================
// Descriptive conveniences — Wave D
// ===========================================================================

/** Peak-to-peak / statistical range: max − min. (`np.ptp`; `range` is taken.) */
export function ptp(x: Vec): number {
  const a = Array.from(x);
  if (a.length === 0) return NaN;
  let lo = a[0];
  let hi = a[0];
  for (const v of a) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
}

/** Coefficient of variation: population-std / mean (`scipy.stats.variation`, ddof=0). */
export function variation(x: Vec): number {
  const a = Array.from(x);
  return stdPop(a) / mean(a);
}

/** Trimmed mean — drop `proportion` of the sorted data from each tail. `scipy.stats.trim_mean`. */
export function trimmedMean(x: Vec, proportion: number): number {
  if (proportion < 0 || proportion >= 0.5) {
    throw new Error('trimmedMean: proportion must be in [0, 0.5)');
  }
  const a = Array.from(x).sort((p, q) => p - q);
  const k = Math.floor(a.length * proportion);
  return mean(a.slice(k, a.length - k));
}

/** Summary statistics bundle (`scipy.stats.describe`): sample variance (ddof=1); biased Fisher skew/kurtosis. */
export interface DescribeResult {
  nobs: number;
  min: number;
  max: number;
  mean: number;
  variance: number;
  skewness: number;
  kurtosis: number;
}

export function describe(x: Vec): DescribeResult {
  const a = Array.from(x);
  const n = a.length;
  if (n < 1) throw new Error('describe: input must be non-empty');
  const m = mean(a);
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  let lo = a[0];
  let hi = a[0];
  for (const v of a) {
    const d = v - m;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const mu2 = m2 / n;
  return {
    nobs: n,
    min: lo,
    max: hi,
    mean: m,
    variance: m2 / (n - 1),
    skewness: m3 / n / Math.pow(mu2, 1.5),
    kurtosis: m4 / n / (mu2 * mu2) - 3,
  };
}

/** Histogram counts and bin edges (`np.histogram`) — `bins` equal-width bins over [min, max]. */
export interface HistogramResult {
  counts: number[];
  edges: number[];
}

export function histogram(x: Vec, bins = 10): HistogramResult {
  const a = Array.from(x);
  if (a.length === 0) throw new Error('histogram: input must be non-empty');
  if (!Number.isInteger(bins) || bins < 1)
    throw new Error('histogram: bins must be a positive integer');
  let lo = a[0];
  let hi = a[0];
  for (const v of a) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const width = (hi - lo) / bins;
  const edges = Array.from({ length: bins + 1 }, (_, i) => lo + i * width);
  const counts = new Array<number>(bins).fill(0);
  for (const v of a) {
    let idx = Math.floor((v - lo) / width);
    if (idx === bins) idx = bins - 1;
    if (idx >= 0 && idx < bins) counts[idx]++;
  }
  return { counts, edges };
}

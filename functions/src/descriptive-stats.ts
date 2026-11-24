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
import { nativeMatrixRows, type NativeMatrixInput } from './matrix/native-matrix-rows.js';
import {
  divideByScale,
  powerOfTwoScaleOf,
  scaleForVariance,
  SQUARES_SAFE_MIN,
} from '@danielsimonjr/mathts-core';
import { mean as _mean, std as _std, sum as _sum } from './typed/arithmetic.js';
import { deviationSums, scaledDeviationSums } from './utils/deviation-sums.js';
import { quantileSeq as _quantileSeqRaw } from './factories/index.js';
import { studentTCDF as _studentTCDF } from './distribution-functions.js';
import { betaincScalar } from './wasm/special/scalars.js';
import { fitLineScaled, linregressFromFit, unscaleLinregress } from './regression-extra.js';
import { normalCDF as _normalCDF } from './typed/distributions.js';
import { kendallPExact, kendallShouldUseExact } from './kendall-exact.js';
import { hasNaN, numberVector } from './typed/number-matrix.js';
import { assertAllocSize } from './utils/limits.js';
import { readSkip } from './statistics/numeric-data.js';

const _quantileSeq = _quantileSeqRaw as (
  data: readonly number[],
  p: number,
  opts?: { skipNaN?: boolean }
) => number;

/** Options of the functions that follow the NaN policy of `mean` and `median`. */
export interface NaNPolicyOptions {
  /** Omit NaN values. `±Infinity` is kept. */
  skipNaN?: boolean;
  /** Pandas spelling of {@link NaNPolicyOptions.skipNaN}. */
  skipna?: boolean;
}

function skipOf(opts: NaNPolicyOptions | undefined): boolean {
  // A last argument that is not an object (an Array.map index, null) is no options.
  if (opts === null || typeof opts !== 'object') return false;
  return readSkip(opts) ?? false;
}

type Vec = readonly number[] | Float64Array;

const mean = (x: number[]): number => _mean(x) as number;
const stdPop = (x: number[]): number => _std(x, 'uncorrected') as number;
const stdSample = (x: number[]): number => _std(x) as number; // default is unbiased (n-1)
const sum = (x: number[]): number => _sum(x) as number;

/**
 * `a` with its population variance `m2`, or a copy of `a` divided by an exact power of 2 and the
 * variance of that copy, when `m2` is outside `[2^-400, 2^400]` (#1280). The third and fourth
 * powers of the deviations leave the range much earlier than the squares do (`kurtosis` was
 * NaN for data of order 2^-270 and of order 2^300), and a variance of 0 can come from squares
 * that underflowed. The skewness and the kurtosis do not change when the data is multiplied by a
 * positive constant, so the scale is not applied to the result. Data inside the window keeps its
 * plain path, bit for bit. Constant data stays constant (variance 0), and a NaN or an infinite
 * value has no scale.
 */
function momentInput(a: number[], m2: number): { data: number[]; m2: number } {
  const scale = scaleForVariance(m2, a);
  if (scale === 1) return { data: a, m2 };
  const data = divideByScale(a, scale);
  return { data, m2: centralMoment(data, 2) };
}

/** k-th central moment `E[(x − mean)^k]` (population, ÷n) — the shared core. */
function centralMoment(x: number[], k: number): number {
  if (x.length === 0) return NaN;
  const m = mean(x);
  let acc = 0;
  // Plain multiplications for the common k = 2, 3, 4 (skewness/kurtosis/variance); Math.pow otherwise.
  if (k === 2) {
    for (let i = 0; i < x.length; i++) {
      const d = x[i] - m;
      acc += d * d;
    }
  } else if (k === 3) {
    for (let i = 0; i < x.length; i++) {
      const d = x[i] - m;
      acc += d * d * d;
    }
  } else if (k === 4) {
    for (let i = 0; i < x.length; i++) {
      const d = x[i] - m;
      const d2 = d * d;
      acc += d2 * d2;
    }
  } else {
    for (let i = 0; i < x.length; i++) acc += Math.pow(x[i] - m, k);
  }
  return acc / x.length;
}

/**
 * Ranks of the data with tie handling (SciPy `rankdata`, default `'average'`):
 * tied values receive the mean of the ranks they span. Ranks are 1-based.
 */
export function rankdata(x: Vec): number[] {
  const a = numberVector('rankdata', x);
  const n = a.length;
  // SciPy `nan_policy='propagate'`: a NaN has no rank, so no entry has one. NaN breaks the
  // sort comparator, and `NaN === NaN` is false, so the tie scan below would not advance.
  if (hasNaN(a)) return new Array<number>(n).fill(NaN);
  const order = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[i] - a[j]);
  const ranks = new Array<number>(n);
  for (let i = 0; i < n;) {
    let j = i + 1;
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
  x = numberVector('spearman', x);
  y = numberVector('spearman', y);
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
  const a = numberVector('gmean', x);
  if (a.length === 0) return NaN; // empty is undefined (graceful NaN, numpy parity)
  if (a.some((v) => v <= 0)) throw new Error('gmean: all entries must be > 0');
  return Math.exp(mean(a.map(Math.log)));
}

/** Harmonic mean: `n / Σ(1/xᵢ)`. All entries must be > 0. */
export function hmean(x: Vec): number {
  const a = numberVector('hmean', x);
  if (a.length === 0) return NaN; // empty is undefined (graceful NaN, numpy parity)
  if (a.some((v) => v <= 0)) throw new Error('hmean: all entries must be > 0');
  return a.length / sum(a.map((v) => 1 / v));
}

/** Raw or central k-th moment. `central` (default true) subtracts the mean first. */
export function moment(x: Vec, k: number, central = true): number {
  const a = numberVector('moment', x);
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
  const raw = numberVector('skewness', x);
  const n = raw.length;
  // NaN for empty (graceful) — the m2===0 guard skips it
  const { data: a, m2 } = momentInput(raw, centralMoment(raw, 2));
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
  const raw = numberVector('kurtosis', x);
  const n = raw.length;
  // NaN for empty (graceful) — the m2===0 guard skips it
  const { data: a, m2 } = momentInput(raw, centralMoment(raw, 2));
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
export function iqr(x: Vec, opts?: NaNPolicyOptions): number {
  const skipNaN = skipOf(opts);
  // quantileSeq has an exact path and reads a nested array, so iqr keeps its input as is.
  const a = (Array.isArray(x) ? x : Array.from(x)) as number[];
  return (
    (_quantileSeq(a, 0.75, { skipNaN }) as number) - (_quantileSeq(a, 0.25, { skipNaN }) as number)
  );
}

/** Standard error of the mean: `sampleStd / √n`. */
export function sem(x: Vec): number {
  const a = numberVector('sem', x);
  if (a.length === 0) return NaN;
  return stdSample(a) / Math.sqrt(a.length);
}

/**
 * Z-scores: `(xᵢ − mean) / std`, using population std (SciPy `zscore` default,
 * `ddof=0`). Returns an array the same length as the input.
 */
export function zscore(x: Vec): number[] {
  const a = numberVector('zscore', x);
  if (a.length === 0) return []; // empty in → empty out (graceful)
  const m = mean(a);
  const s = stdPop(a);
  if (s === 0) throw new Error('zscore: standard deviation is zero (constant input)');
  return a.map((v) => (v - m) / s);
}

/**
 * Layout option for the matrix forms of {@link cov} and {@link corrcoef}.
 *   - `rowvar: false` (default) — rows are observations, columns are variables.
 *     This is the MathTS layout and matches NumPy `rowvar=False`.
 *   - `rowvar: true` — rows are variables, columns are observations. This is the
 *     NumPy default `np.cov` / `np.corrcoef` layout (`rowvar=True`).
 */
export interface CovLayoutOptions {
  rowvar?: boolean;
}

/** Transpose a rectangular number matrix (rows ↔ columns). */
function transposeMatrix(M: number[][]): number[][] {
  const nCols = M.length === 0 ? 0 : M[0].length;
  return Array.from({ length: nCols }, (_, j) => M.map((r) => r[j]));
}

/** Throw a `RangeError` unless every row of `M` has the length of row 0. */
function assertRectangular(M: number[][], fn: string): void {
  for (let i = 1; i < M.length; i++) {
    if (M[i].length !== M[0].length) {
      throw new RangeError(
        `${fn}: row ${i} has ${M[i].length} values but row 0 has ${M[0].length}; every row needs the same length`
      );
    }
  }
}

function covarianceProduct(
  a: number[],
  b: number[],
  ma: number,
  mb: number,
  scale: number
): number {
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc += (a[i] - ma) * (b[i] - mb);
  return acc * scale;
}

function stableCovariance(a: number[], b: number[], ma: number, mb: number, scale: number): number {
  const plain = covarianceProduct(a, b, ma, mb, scale);
  if (Number.isFinite(plain) && Math.abs(plain) >= SQUARES_SAFE_MIN) return plain;

  const sa = powerOfTwoScaleOf(a);
  const sb = powerOfTwoScaleOf(b);
  if (sa === 1 && sb === 1) return plain;
  const x = divideByScale(a, sa);
  const y = divideByScale(b, sb);
  const normalized = covarianceProduct(x, y, mean(x), mean(y), scale);
  const larger = Math.max(sa, sb);
  const smaller = Math.min(sa, sb);
  const first = normalized * larger;
  return Number.isFinite(first) ? first * smaller : normalized * smaller * larger;
}

/**
 * Covariance.
 *   - `cov(x, y)` → scalar sample covariance of two equal-length vectors.
 *   - `cov(x)` with a 1-D array → scalar sample variance (one variable, NumPy `np.cov`).
 *   - `cov(matrix)` → covariance matrix; rows are observations, columns are
 *     variables (NumPy `rowvar=false`). `ddof` defaults to 1 (sample).
 *   - `cov(matrix, undefined, ddof, { rowvar: true })` → rows are variables,
 *     columns are observations (NumPy `rowvar=True`, the NumPy default).
 *     `rowvar` applies to the matrix form only; `rowvar: true` with two vectors throws
 *     (`rowvar: false` is the default layout, so it is accepted).
 *   - Rows of unequal length throw a `RangeError` in either layout.
 */
export function cov(
  x: Vec | number[][],
  y?: Vec,
  ddof = 1,
  opts: CovLayoutOptions = {}
): number | number[][] {
  if (y !== undefined) {
    if (opts.rowvar === true) {
      throw new Error('cov: rowvar applies to the matrix form only (pass one matrix)');
    }
    const a = numberVector('cov', x as Vec);
    const b = numberVector('cov', y);
    if (a.length !== b.length) throw new Error(`cov: length mismatch ${a.length} vs ${b.length}`);
    if (a.length <= ddof)
      throw new Error(`cov: need more than ddof=${ddof} observations (got n=${a.length})`);
    // NumPy np.cov scales by the reciprocal (c *= true_divide(1, fact)), so this does too.
    return stableCovariance(a, b, mean(a), mean(b), 1 / (a.length - ddof));
  }
  // A 1-D array is one variable (NumPy np.cov): its covariance with itself is the
  // sample variance. Only the first element decides the form, so a flat array of
  // non-numbers reaches numberVector and throws instead of taking the matrix branch.
  const isMatrixInput = x.length > 0 && (Array.isArray(x[0]) || ArrayBuffer.isView(x[0]));
  if (!isMatrixInput) return cov(x as Vec, x as Vec, ddof) as number;
  // matrix form: rows = observations, columns = variables (rowvar=false)
  const input = (x as number[][]).map((r, i) => numberVector(`cov row ${i}`, r));
  assertRectangular(input, 'cov');
  const M = opts.rowvar === true ? transposeMatrix(input) : input;
  const nObs = M.length;
  if (nObs <= ddof)
    throw new Error(`cov: need more than ddof=${ddof} observations (got n=${nObs})`);
  const nVar = M[0].length;
  const cols = Array.from({ length: nVar }, (_, j) => M.map((r) => r[j]));
  const means = cols.map(mean);
  const scale = 1 / (nObs - ddof);
  const out: number[][] = Array.from({ length: nVar }, () => new Array<number>(nVar).fill(0));
  for (let i = 0; i < nVar; i++) {
    for (let j = i; j < nVar; j++) {
      const c = stableCovariance(cols[i], cols[j], means[i], means[j], scale);
      out[i][j] = c;
      out[j][i] = c;
    }
  }
  return out;
}

/**
 * Correlation-coefficient matrix from {@link cov}. Diagonal is 1; off-diagonals
 * are Pearson r.
 *   - default (`rowvar: false`): rows = observations, columns = variables.
 *   - `{ rowvar: true }`: rows = variables, columns = observations, the NumPy
 *     `np.corrcoef` layout. `corrcoef([[1,2,3],[4,5,6]], { rowvar: true })`
 *     returns the 2×2 matrix `[[1,1],[1,1]]`.
 */
export function corrcoef(
  matrixInput: NativeMatrixInput<number[][]>,
  opts: CovLayoutOptions = {}
): number[][] {
  const matrix: number[][] = nativeMatrixRows(matrixInput);
  matrix.forEach((r, i) => numberVector(`corrcoef row ${i}`, r));
  const c = cov(matrix, undefined, 1, opts) as number[][];
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
function _kendallTauCore(
  x: Vec,
  y: Vec
): { tau: number; P: number; Q: number; hasTies: boolean; n: number } {
  const n = x.length;
  if (n !== y.length) throw new Error('kendallTau: inputs must have equal length');
  if (n < 2) return { tau: NaN, P: 0, Q: 0, hasTies: false, n };
  // SciPy `nan_policy='propagate'`: `Math.sign(NaN)` is NaN, and the pair count skipped it.
  if (hasNaN(x) || hasNaN(y)) {
    return { tau: NaN, P: 0, Q: 0, hasTies: false, n };
  }
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
  const hasTies = n1 > 0 || n2 > 0;
  if (denom === 0) return { tau: NaN, P, Q, hasTies, n };
  return { tau: (P - Q) / denom, P, Q, hasTies, n };
}

/** Kendall's rank correlation τ for paired samples (τ only; use `kendalltau` for p-value). */
export function kendallTau(x: Vec, y: Vec): number {
  x = numberVector('kendallTau', x);
  y = numberVector('kendallTau', y);
  return _kendallTauCore(x, y).tau;
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
 *
 * Slope inference (p-value, slope standard error) is delegated to
 * {@link linregressFromFit} (`studentTTwoSidedP`, same incomplete-beta tail as SciPy
 * `t.sf`). Unlike `linearRegression`, a zero-variance predictor does not throw.
 */
export function linregress(x: Vec, y: Vec): LinRegressResult {
  const xs = numberVector('linregress x', x);
  const ys = numberVector('linregress y', y);
  const n = xs.length;
  if (n !== ys.length) throw new Error('linregress: x and y must have equal length');
  if (n < 3) throw new Error('linregress: need at least 3 points for inference');
  const scaled = fitLineScaled(xs, ys);
  const fit = scaled.fit;
  if (fit.sxx === 0) {
    const nan = Number.NaN;
    return {
      slope: nan,
      intercept: nan,
      rValue: nan,
      pValue: nan,
      stdErr: nan,
      interceptStdErr: nan,
    };
  }
  const df = n - 2;
  const s2 = fit.rss / df;
  const interceptStdErr = Math.sqrt(s2 * (1 / n + (fit.mx * fit.mx) / fit.sxx));
  // The fit may be of data divided by exact powers of 2 (#1280): the result is in the units of
  // the data again.
  const base = unscaleLinregress(linregressFromFit(fit, n), scaled);
  return {
    slope: base.slope,
    intercept: base.intercept,
    rValue: base.rValue,
    pValue: base.pValue,
    stdErr: base.stdErr,
    interceptStdErr: interceptStdErr * scaled.sy,
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

/** SciPy `pearsonr` two-sided p from Beta(n/2−1, n/2−1) on (−1, 1). */
function _pearsonPValue(r: number, n: number): number {
  const ab = n / 2 - 1;
  if (n < 3 || !Number.isFinite(r)) return NaN;
  const t = (Math.abs(r) + 1) / 2;
  // SciPy `pearsonr` is Beta.sf on (−1, 1). A clamped |r| = 1 makes the upper
  // argument 0 and the regularized beta a hard 0; one ulp inside the endpoint
  // stays in the representable tail (the perfect-line sample lands there).
  const complement = t >= 1 ? Number.EPSILON : 1 - t;
  if (t > 0.5) return 2 * betaincScalar(ab, ab, complement);
  return 2 * (1 - betaincScalar(ab, ab, t));
}

/** Pearson r with scaled norms (matches SciPy `pearsonr`, avoids r === 1 flush). */
function _pearson(x: Vec, y: Vec): number {
  const xa = numberVector('pearsonr', x);
  const ya = numberVector('pearsonr', y);
  const n = xa.length;
  if (n !== ya.length) throw new Error('pearsonr: inputs must have equal length');
  const mx = mean(xa);
  const my = mean(ya);
  let xmax = 0;
  let ymax = 0;
  const xm = new Array<number>(n);
  const ym = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    xm[i] = xa[i] - mx;
    ym[i] = ya[i] - my;
    xmax = Math.max(xmax, Math.abs(xm[i]));
    ymax = Math.max(ymax, Math.abs(ym[i]));
  }
  let normxm = 0;
  let normym = 0;
  for (let i = 0; i < n; i++) {
    if (xmax > 0) {
      const s = xm[i] / xmax;
      normxm += s * s;
    }
    if (ymax > 0) {
      const s = ym[i] / ymax;
      normym += s * s;
    }
  }
  normxm = Math.sqrt(normxm) * xmax;
  normym = Math.sqrt(normym) * ymax;
  if (normxm === 0 || normym === 0) return NaN;
  let dot = 0;
  for (let i = 0; i < n; i++) dot += (xm[i] / normxm) * (ym[i] / normym);
  return Math.max(-1, Math.min(1, dot));
}

/** Pearson correlation **test** (coefficient + two-tailed p, t-test). `scipy.stats.pearsonr`. */
export function pearsonr(x: Vec, y: Vec): CorrelationTestResult {
  x = numberVector('pearsonr', x);
  y = numberVector('pearsonr', y);
  const r = _pearson(x, y);
  return { coefficient: r, pValue: _pearsonPValue(r, x.length) };
}

/** t-test p-value for rank correlations (asymptotic; Kendall defaults to exact at small n). */
function _corrTPValue(r: number, n: number): number {
  const df = n - 2;
  if (df <= 0) return NaN;
  const TINY = 1e-20;
  const ar = Math.max(-1, Math.min(1, r));
  const t = ar * Math.sqrt(df / ((1 - ar + TINY) * (1 + ar + TINY)));
  return _tTwoTail(t, df);
}

/** Spearman rank-correlation **test** (rho + two-tailed p, t-test). `scipy.stats.spearmanr`. */
export function spearmanr(x: Vec, y: Vec): CorrelationTestResult {
  x = numberVector('spearmanr', x);
  y = numberVector('spearmanr', y);
  const rho = spearman(x, y);
  return { coefficient: rho, pValue: _corrTPValue(rho, x.length) };
}

/**
 * Kendall's τ **test** — τ_b coefficient; p-value matches SciPy `method='auto'`
 * (exact enumeration for n ≤ 33 without ties, else normal approximation).
 */
export function kendalltau(x: Vec, y: Vec): CorrelationTestResult {
  x = numberVector('kendalltau', x);
  y = numberVector('kendalltau', y);
  const { tau, Q, hasTies, n } = _kendallTauCore(x, y);
  if (n >= 2 && (hasNaN(x) || hasNaN(y))) {
    return { coefficient: NaN, pValue: NaN };
  }
  if (!hasTies && kendallShouldUseExact(n, Q)) {
    const n0 = (n * (n - 1)) / 2;
    return { coefficient: tau, pValue: kendallPExact(n, Math.min(Q, n0 - Q)) };
  }
  const z = (3 * tau * Math.sqrt(n * (n - 1))) / Math.sqrt(2 * (2 * n + 5));
  return { coefficient: tau, pValue: 2 * (1 - (_normalCDF(Math.abs(z)) as number)) };
}

/** Result of {@link kendallTauTest}: the τ_b coefficient plus its p-value. */
export interface KendallTauTestResult {
  tau: number;
  pValue: number;
}

/**
 * Kendall's τ **test** (hypothesis-test naming convenience) — identical to
 * {@link kendalltau} (τ_b coefficient + two-tailed normal-approximation
 * p-value), just returning `{ tau, pValue }` instead of `{ coefficient,
 * pValue }` to match the `*Test` result-object convention used by
 * `mannWhitneyTest`/`kolmogorovSmirnovTest`/etc. Does not duplicate the
 * coefficient/p-value logic — delegates to `kendalltau`.
 *
 * @example kendallTauTest([1,2,3,4,5], [1,2,3,4,5]) // { tau: 1, pValue: <small> }
 */
export function kendallTauTest(x: Vec, y: Vec): KendallTauTestResult {
  x = numberVector('kendallTauTest', x);
  y = numberVector('kendallTauTest', y);
  const { coefficient, pValue } = kendalltau(x, y);
  return { tau: coefficient, pValue };
}

// ===========================================================================
// Descriptive conveniences — Wave D
// ===========================================================================

/** Peak-to-peak / statistical range: max − min. (`np.ptp`; `range` is taken.) */
export function ptp(x: Vec, opts?: NaNPolicyOptions): number {
  const skipNaN = skipOf(opts);
  const a = numberVector('ptp', x);
  if (a.length === 0) return NaN;
  let lo = Infinity;
  let hi = -Infinity;
  let seen = false;
  for (const v of a) {
    if (v !== v) {
      if (skipNaN) continue;
      return NaN;
    }
    if (!seen) {
      lo = hi = v;
      seen = true;
      continue;
    }
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return seen ? hi - lo : NaN;
}

/** Coefficient of variation: population-std / mean (`scipy.stats.variation`, ddof=0). */
export function variation(x: Vec): number {
  const a = numberVector('variation', x);
  return stdPop(a) / mean(a);
}

/** Trimmed mean — drop `proportion` of the sorted data from each tail. `scipy.stats.trim_mean`. */
export function trimmedMean(x: Vec, proportion: number): number {
  if (proportion < 0 || proportion >= 0.5) {
    throw new Error('trimmedMean: proportion must be in [0, 0.5)');
  }
  const a = numberVector('trimmedMean', x).sort((p, q) => p - q);
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
  /** Sample standard deviation (ddof = 1), like pandas `Series.describe`. */
  std: number;
  /** 25th / 50th / 75th percentiles via `quantileSeq` (NumPy `linear`). */
  q25: number;
  q50: number;
  q75: number;
  skewness: number;
  kurtosis: number;
}

/**
 * Return summary statistics of `x`, as `scipy.stats.describe` does.
 *
 * The variance is the sample variance (ddof = 1). The skewness and the excess kurtosis are
 * the biased estimates.
 *
 * The default NaN policy follows `scipy.stats.describe` (`nan_policy='propagate'`): a NaN in `x`
 * gives `nobs = x.length` and NaN in every other field. With `{ skipNaN: true }`, the result is
 * `describe` of the values that are not NaN, and `nobs` counts them. If none remain, `nobs` is 0
 * and the other fields are NaN. `Infinity` is kept, which differs from SciPy `nan_policy='omit'`.
 *
 * @param x - The sample.
 * @param opts - `{ skipNaN?: boolean; skipna?: boolean }`. The two names are aliases.
 * @throws Error if `x` is empty.
 * @throws TypeError if `opts` is not a plain object, holds an unknown option, or holds a
 *   non-boolean or conflicting `skipNaN` / `skipna`.
 */
export function describe(x: Vec, opts?: { skipNaN?: boolean; skipna?: boolean }): DescribeResult {
  let skip = false;
  if (opts !== undefined) {
    if (opts === null || typeof opts !== 'object' || (opts as object).constructor !== Object) {
      throw new TypeError('describe: options must be an object with skipNaN or skipna (boolean)');
    }
    // for...in also sees inherited keys, which readSkip reads too.
    for (const key in opts) {
      if (key !== 'skipNaN' && key !== 'skipna') {
        throw new TypeError(
          `describe: unknown option "${key}"; the options are skipNaN and skipna (boolean)`
        );
      }
    }
    skip = readSkip(opts) ?? false;
  }
  let a = numberVector('describe', x);
  if (a.length < 1) throw new Error('describe: input must be non-empty');
  let hasNaN = false;
  for (const v of a) {
    if (v !== v) {
      hasNaN = true;
      break;
    }
  }
  if (hasNaN) {
    const kept = skip ? a.filter((v) => v === v) : [];
    if (kept.length === 0) {
      return {
        nobs: skip ? 0 : a.length,
        min: NaN,
        max: NaN,
        mean: NaN,
        variance: NaN,
        std: NaN,
        q25: NaN,
        q50: NaN,
        q75: NaN,
        skewness: NaN,
        kurtosis: NaN,
      };
    }
    a = kept;
  }
  const n = a.length;
  const m = mean(a);
  let lo = a[0];
  let hi = a[0];
  for (const v of a) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const plain = deviationSums(a, m);
  const variance = plain.m2 / (n - 1);
  // The std of the sample, and the skewness and the kurtosis, keep every digit when the squares
  // are subnormal or the powers leave the range (#1280): see `momentInput`. A sample of one value
  // keeps the NaN variance, so its std stays NaN.
  const std =
    n > 1 && !(plain.m2 >= SQUARES_SAFE_MIN && plain.m2 < Infinity)
      ? stdSample(a)
      : Math.sqrt(variance);
  const moments = scaledDeviationSums(a, mean, plain);
  const mu2 = moments.m2 / n;
  return {
    nobs: n,
    min: lo,
    max: hi,
    mean: m,
    variance,
    std,
    q25: _quantileSeq(a, 0.25) as number,
    q50: _quantileSeq(a, 0.5) as number,
    q75: _quantileSeq(a, 0.75) as number,
    skewness: moments.m3 / n / Math.pow(mu2, 1.5),
    kurtosis: moments.m4 / n / (mu2 * mu2) - 3,
  };
}

/** Histogram counts and bin edges (`np.histogram`) — `bins` equal-width bins over [min, max]. */
export interface HistogramResult {
  counts: number[];
  edges: number[];
}

/**
 * Count the values of `x` in `bins` equal-width bins from the minimum to the maximum.
 *
 * The last bin includes the maximum. If all values are equal, the range is that value
 * plus and minus 0.5.
 *
 * NaN throws, as `numpy.histogram`. With `{ skipNaN: true }` or `{ skipna: true }`, NaN is omitted.
 * An infinite value throws, because the range is not finite.
 *
 * @throws Error if `x` is empty (after the NaN skip), has NaN, or has an infinite value; if `bins` is not a positive integer.
 */
export function histogram(x: Vec, bins = 10, opts?: NaNPolicyOptions): HistogramResult {
  const skipNaN = skipOf(opts);
  let a = numberVector('histogram', x);
  if (a.some((v) => v !== v)) {
    if (!skipNaN) {
      throw new Error('histogram: input contains NaN; pass { skipNaN: true } to omit it');
    }
    a = a.filter((v) => v === v);
  }
  if (a.length === 0) throw new Error('histogram: input must be non-empty');
  if (!Number.isInteger(bins) || bins < 1)
    throw new Error('histogram: bins must be a positive integer');
  assertAllocSize('histogram', [bins + 1]);
  let lo = a[0];
  let hi = a[0];
  for (const v of a) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    throw new Error('histogram: the range of the input is not finite');
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

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

/** Geometric mean: `exp(mean(ln x))` (stable form). All entries must be > 0. */
export function gmean(x: Vec): number {
  const a = arr(x);
  if (a.length === 0) return NaN;
  return Math.exp(mean(a.map(Math.log)));
}

/** Harmonic mean: `n / Σ(1/xᵢ)`. */
export function hmean(x: Vec): number {
  const a = arr(x);
  if (a.length === 0) return NaN;
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
  const m2 = centralMoment(a, 2);
  const m3 = centralMoment(a, 3);
  const g1 = m3 / Math.pow(m2, 1.5);
  if (opts.bias === false && n > 2) {
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
  const m2 = centralMoment(a, 2);
  const m4 = centralMoment(a, 4);
  let g2 = m4 / (m2 * m2); // Pearson's kurtosis
  if (opts.bias === false && n > 3) {
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
  const m = mean(a);
  const s = stdPop(a);
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
    const ma = mean(a);
    const mb = mean(b);
    let acc = 0;
    for (let i = 0; i < a.length; i++) acc += (a[i] - ma) * (b[i] - mb);
    return acc / (a.length - ddof);
  }
  // matrix form: rows = observations, columns = variables
  const M = (x as number[][]).map((r) => Array.from(r));
  const nObs = M.length;
  const nVar = nObs > 0 ? M[0].length : 0;
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

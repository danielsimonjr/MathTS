/**
 * Additional hypothesis tests (Wave B / bridge C9).
 *
 * Each reuses existing machinery — `variance` (typed), `skewness`/`kurtosis`
 * (Wave A descriptive stats), and the standalone distribution CDFs — rather than
 * re-deriving statistics or tail probabilities. Results follow the existing
 * `{ statistic, pValue, … }` shape used in `typed/hypothesis.ts`.
 */
import { variance as _variance } from './typed/arithmetic.js';
import { skewness, kurtosis, rankdata } from './descriptive-stats.js';
import { fCDF, chiSquaredCDF } from './distribution-functions.js';
import { normalCDF as _normalCDF } from './typed/distributions.js';
import { lgamma as _lgamma } from './typed/special.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const sampleVar = (x: number[]): number => _variance(x) as number; // default: unbiased (n−1)
const normalCDF = (z: number): number => _normalCDF(z) as number;
const lgamma = (n: number): number => _lgamma(n) as number;
/** Σ(t³−t) over tie groups — the tie-correction term shared by rank tests. */
function tieTerm(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  let term = 0;
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j] === sorted[i]) j++;
    const t = j - i;
    term += t * t * t - t;
    i = j;
  }
  return term;
}

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

export interface KruskalResult {
  statistic: number;
  pValue: number;
  df: number;
}

/**
 * Kruskal–Wallis H-test (nonparametric one-way ANOVA on ranks). Pools all groups,
 * ranks via {@link rankdata}, and corrects for ties; H is asymptotically χ²(k−1).
 */
export function kruskalWallis(...groups: Vec[]): KruskalResult {
  const arrs = groups.map(arr).filter((g) => g.length > 0);
  const pooled = arrs.flat();
  const N = pooled.length;
  const ranks = rankdata(pooled);
  let offset = 0;
  let sumRanksSq = 0;
  for (const g of arrs) {
    let rsum = 0;
    for (let i = 0; i < g.length; i++) rsum += ranks[offset + i];
    sumRanksSq += (rsum * rsum) / g.length;
    offset += g.length;
  }
  let H = (12 / (N * (N + 1))) * sumRanksSq - 3 * (N + 1);
  const correction = 1 - tieTerm(pooled) / (N * N * N - N);
  if (correction !== 0) H /= correction;
  const df = arrs.length - 1;
  return { statistic: H, pValue: 1 - chiSquaredCDF(H, df), df };
}

export interface WilcoxonResult {
  statistic: number;
  pValue: number;
  zStatistic: number;
}

/**
 * Wilcoxon signed-rank test (paired, or one-sample vs 0). Drops zero differences,
 * ranks |d|, and uses the normal approximation with continuity correction
 * (matching `scipy.stats.wilcoxon(mode='approx', correction=True)`). Statistic is
 * `min(W⁺, W⁻)`.
 */
export function wilcoxon(x: Vec, y?: Vec): WilcoxonResult {
  const a = arr(x);
  const diffs = (y !== undefined ? arr(y) : null) ? a.map((v, i) => v - arr(y as Vec)[i]) : a;
  const d = diffs.filter((v) => v !== 0);
  const n = d.length;
  const ranks = rankdata(d.map(Math.abs));
  let wPlus = 0;
  let wMinus = 0;
  for (let i = 0; i < n; i++) {
    if (d[i] > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  }
  const statistic = Math.min(wPlus, wMinus);
  const mn = (n * (n + 1)) / 4;
  const se = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tieTerm(d.map(Math.abs)) / 48);
  const corr = 0.5 * Math.sign(statistic - mn);
  const zStatistic = (statistic - mn - corr) / se;
  return { statistic, pValue: 2 * normalCDF(-Math.abs(zStatistic)), zStatistic };
}

export interface FisherExactResult {
  oddsRatio: number;
  pValue: number;
}

/** log C(n, k) via lgamma — stable for the hypergeometric enumeration below. */
function logChoose(n: number, k: number): number {
  if (k < 0 || k > n) return -Infinity;
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
}

/**
 * Fisher's exact test on a 2×2 table `[[a, b], [c, d]]`. Two-sided p-value by the
 * total-probability method (sum of hypergeometric probabilities no greater than the
 * observed table's), matching `scipy.stats.fisher_exact`. `oddsRatio` is the sample
 * ratio `ad/bc` (SciPy reports the conditional-MLE estimate; the p-value matches).
 */
export function fisherExact(table: readonly [readonly number[], readonly number[]]): FisherExactResult {
  const [[a, b], [c, d]] = table;
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const N = a + b + c + d;
  const logHyper = (k: number): number => logChoose(r1, k) + logChoose(r2, c1 - k) - logChoose(N, c1);
  const logPObs = logHyper(a);
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  let p = 0;
  for (let k = lo; k <= hi; k++) {
    const lp = logHyper(k);
    if (lp <= logPObs + 1e-7) p += Math.exp(lp);
  }
  const oddsRatio = b * c === 0 ? Infinity : (a * d) / (b * c);
  return { oddsRatio, pValue: Math.min(1, p) };
}

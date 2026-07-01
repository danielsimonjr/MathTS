/**
 * Additional hypothesis tests (Wave B / bridge C9).
 *
 * Each reuses existing machinery — `variance` (typed), `skewness`/`kurtosis`
 * (Wave A descriptive stats), and the standalone distribution CDFs — rather than
 * re-deriving statistics or tail probabilities. Results follow the existing
 * `{ statistic, pValue, … }` shape used in `typed/hypothesis.ts`.
 */
import { variance as _variance, mean as _mean } from './typed/arithmetic.js';
import { skewness, kurtosis, rankdata } from './descriptive-stats.js';
import { fCDF, chiSquaredCDF } from './distribution-functions.js';
import { normalCDF as _normalCDF, normalPDF as _normalPDF } from './typed/distributions.js';
import { lgamma as _lgamma } from './typed/special.js';

type Vec = readonly number[] | Float64Array;
const arr = (x: Vec): number[] => (Array.isArray(x) ? (x as number[]) : Array.from(x));
const sampleVar = (x: number[]): number => _variance(x) as number; // default: unbiased (n−1)
const mean = (x: number[]): number => _mean(x) as number;
const normalCDF = (z: number): number => _normalCDF(z) as number;
const normalPDF = (z: number): number => _normalPDF(z) as number;
const lgamma = (n: number): number => _lgamma(n) as number;

/** Composite Simpson quadrature (synchronous) — the package `romberg`/`gaussQuad`
 *  are async parallel-first, unusable for the nested synchronous integration below. */
function simpson(f: (x: number) => number, a: number, b: number, n = 512): number {
  const m = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 === 0 ? 2 : 4) * f(a + i * h);
  return (s * h) / 3;
}
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
  if (a.length < 2 || b.length < 2)
    throw new Error('fTest: each sample needs at least 2 observations');
  const df1 = a.length - 1;
  const df2 = b.length - 1;
  const vb = sampleVar(b);
  if (vb === 0) throw new Error('fTest: denominator sample has zero variance');
  const statistic = sampleVar(a) / vb;
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
  if (n < 2) throw new Error('jarqueBera: need at least 2 observations');
  const s = skewness(a); // population (SciPy bias=true); throws on constant input
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
  if (arrs.length < 2) throw new Error('kruskalWallis: need at least 2 non-empty groups');
  const pooled = arrs.flat();
  const N = pooled.length;
  if (N < 2) throw new Error('kruskalWallis: need at least 2 pooled observations');
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
  const yy = y !== undefined ? arr(y) : undefined;
  if (yy !== undefined && yy.length !== a.length)
    throw new Error(`wilcoxon: paired samples must have equal length (${a.length} vs ${yy.length})`);
  const diffs = yy !== undefined ? a.map((v, i) => v - yy[i]) : a;
  const d = diffs.filter((v) => v !== 0);
  const n = d.length;
  if (n === 0) throw new Error('wilcoxon: all differences are zero (test undefined)');
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

// --- Studentized range distribution + Tukey's HSD (Wave D / remaining) ----------

/** Probability that the range of `k` standard normals is ≤ `w` (the inner integral). */
function rangeProb(w: number, k: number): number {
  if (w <= 0) return 0;
  const integrand = (z: number): number =>
    k * normalPDF(z) * Math.pow(normalCDF(z) - normalCDF(z - w), k - 1);
  return Math.min(1, Math.max(0, simpson(integrand, -8.5, 8.5, 240)));
}

/**
 * CDF of the studentized range distribution with `k` groups and `df` degrees of
 * freedom — `scipy.stats.studentized_range.cdf`. Integrates the range probability
 * against the χ-scaled denominator density (synchronous Simpson + normalCDF/normalPDF).
 */
export function studentizedRangeCDF(q: number, k: number, df: number): number {
  if (!(k >= 2)) throw new Error('studentizedRangeCDF: k (number of groups) must be >= 2');
  if (q <= 0) return 0;
  if (!Number.isFinite(df)) return rangeProb(q, k);
  if (!(df > 0)) throw new Error('studentizedRangeCDF: df must be > 0');
  const nu = df;
  const logc = (nu / 2) * Math.log(nu) - (nu / 2 - 1) * Math.log(2) - lgamma(nu / 2);
  const fU = (u: number): number => Math.exp(logc + (nu - 1) * Math.log(u) - (nu * u * u) / 2);
  // Upper integration bound for the χ-scaled denominator density fU. The heuristic
  // `1 + 12/√nu` under-covers the tail for small nu, which would silently bias the CDF
  // low; extend umax until [1e-5, umax] captures ~all of fU's unit mass. This probe uses
  // fU alone (cheap) — no nested rangeProb — so it does not blow up the hot path.
  let umax = 1 + 12 / Math.sqrt(nu);
  for (let iter = 0; iter < 20 && simpson(fU, 1e-5, umax, 120) < 1 - 1e-6; iter++) umax *= 1.5;
  return Math.min(1, Math.max(0, simpson((u) => fU(u) * rangeProb(q * u, k), 1e-5, umax, 120)));
}

/** Quantile (inverse CDF) of the studentized range distribution, via bisection. */
export function studentizedRangeQuantile(p: number, k: number, df: number): number {
  if (!(p > 0 && p < 1)) throw new Error('studentizedRangeQuantile: p must be in (0, 1)');
  let lo = 0;
  // Bracket p by expanding hi geometrically until CDF(hi) >= p, rather than assuming a
  // fixed [0, 100] that silently clamps large quantiles to ~100 (unconverged).
  let hi = 1;
  for (let iter = 0; studentizedRangeCDF(hi, k, df) < p; iter++) {
    if (iter >= 60)
      throw new Error(`studentizedRangeQuantile: failed to bracket p=${p} (CDF plateaued below p)`);
    hi *= 2;
  }
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (studentizedRangeCDF(mid, k, df) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TukeyComparison {
  groups: [number, number];
  meanDifference: number;
  qStatistic: number;
  pValue: number;
  reject: boolean;
}

/**
 * Tukey's HSD (honestly significant difference) post-hoc test across `groups`.
 * Pooled within-group variance, Tukey–Kramer standard errors for unbalanced groups;
 * p-values from the studentized range distribution. Mirrors `scipy.stats.tukey_hsd`.
 */
export function tukeyHSD(groups: Vec[], alpha = 0.05): TukeyComparison[] {
  const gs = groups.map(arr);
  const k = gs.length;
  if (k < 2) throw new Error('tukeyHSD: need at least 2 groups');
  const means = gs.map(mean);
  const N = gs.reduce((s, g) => s + g.length, 0);
  const dfErr = N - k;
  if (dfErr <= 0)
    throw new Error('tukeyHSD: residual df must be > 0 (groups must hold more observations than groups)');
  // pooled mean square error
  const sse = gs.reduce((s, g) => s + sampleVar(g) * (g.length - 1), 0);
  const mse = sse / dfErr;
  const qCrit = studentizedRangeQuantile(1 - alpha, k, dfErr);
  const out: TukeyComparison[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const diff = means[i] - means[j];
      const se = Math.sqrt((mse / 2) * (1 / gs[i].length + 1 / gs[j].length)); // Tukey–Kramer
      const q = Math.abs(diff) / se;
      out.push({
        groups: [i, j],
        meanDifference: diff,
        qStatistic: q,
        pValue: 1 - studentizedRangeCDF(q, k, dfErr),
        reject: q > qCrit,
      });
    }
  }
  return out;
}

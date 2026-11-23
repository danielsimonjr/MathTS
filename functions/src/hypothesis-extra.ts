/**
 * Additional hypothesis tests (Wave B / bridge C9).
 *
 * Each reuses existing machinery — `variance` (typed), `skewness`/`kurtosis`
 * (Wave A descriptive stats), and the standalone distribution CDFs — rather than
 * re-deriving statistics or tail probabilities. Results follow the existing
 * `{ statistic, pValue, … }` shape used in `typed/hypothesis.ts`.
 */
import { divideByScale, scaleForVariance } from '@danielsimonjr/mathts-core';
import { variance as _variance, mean as _mean } from './typed/arithmetic.js';
import { skewness, kurtosis, rankdata } from './descriptive-stats.js';
import { chiSquaredSF, fCDF, fSF } from './distribution-functions.js';
import { normalCDF as _normalCDF, normalPDF as _normalPDF } from './typed/distributions.js';
import { lgamma as _lgamma } from './typed/special.js';
import { assertNumberScalar, hasNaN, numberVector } from './typed/number-matrix.js';
import { assertLoopOrder } from './utils/limits.js';

type Vec = readonly number[] | Float64Array;
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
  for (let i = 0; i < sorted.length;) {
    let j = i + 1; // `NaN === NaN` is false: start past `i` so the scan always advances
    while (j < sorted.length && sorted[j] === sorted[i]) j++;
    const t = j - i;
    term += t * t * t - t;
    i = j;
  }
  return term;
}

/**
 * Result of `fTest`: the F statistic, the two-sided p-value, and the degrees of freedom
 * `df1 = n1 - 1` and `df2 = n2 - 1`.
 */
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
  const a = numberVector('fTest', x);
  const b = numberVector('fTest', y);
  if (a.length < 2 || b.length < 2)
    throw new Error('fTest: each sample needs at least 2 observations');
  const df1 = a.length - 1;
  const df2 = b.length - 1;
  let va = sampleVar(a);
  let vb = sampleVar(b);
  // Each variance has its own exact power of 2 as a scale: the smaller sample can underflow while
  // the larger one is of order 1, and a variance that underflowed to 0 gave a wrong error (#1280).
  // F = (va' / vb') * (sa / sb)^2, and the two multiplications keep the intermediate in range.
  const sa = scaleForVariance(va, a);
  const sb = scaleForVariance(vb, b);
  if (sa !== 1) va = sampleVar(divideByScale(a, sa));
  if (sb !== 1) vb = sampleVar(divideByScale(b, sb));
  if (vb === 0) throw new Error('fTest: denominator sample has zero variance');
  const ratio = sa / sb;
  const statistic = (va / vb) * ratio * ratio;
  const lower = fCDF(statistic, df1, df2);
  const upper = fSF(statistic, df1, df2);
  const pValue = Math.min(1, 2 * Math.min(lower, upper));
  return { statistic, pValue, df1, df2 };
}

/**
 * Result of `jarqueBera`: the JB statistic, its p-value, and the sample skewness and
 * excess kurtosis.
 */
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
  const a = numberVector('jarqueBera', x);
  const n = a.length;
  if (n < 2) throw new Error('jarqueBera: need at least 2 observations');
  const s = skewness(a); // population (SciPy bias=true); throws on constant input
  const k = kurtosis(a); // excess
  const statistic = (n / 6) * (s * s + (k * k) / 4);
  const pValue = chiSquaredSF(statistic, 2);
  return { statistic, pValue, skewness: s, kurtosis: k };
}

/**
 * Result of `kruskalWallis`: the tie-corrected H statistic, its p-value, and the degrees
 * of freedom.
 */
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
  const arrs = groups.map((g) => numberVector('kruskalWallis', g)).filter((g) => g.length > 0);
  if (arrs.length < 2) throw new Error('kruskalWallis: need at least 2 non-empty groups');
  const pooled = arrs.flat();
  const N = pooled.length;
  if (hasNaN(pooled)) return { statistic: NaN, pValue: NaN, df: arrs.length - 1 };
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
  return { statistic: H, pValue: chiSquaredSF(H, df), df };
}

/**
 * Result of `wilcoxon`: the statistic `min(W+, W-)`, the two-sided p-value, and the
 * normal-approximation z statistic (without a continuity correction).
 */
export interface WilcoxonResult {
  statistic: number;
  pValue: number;
  zStatistic: number;
}

/**
 * Two-sided exact signed-rank p-value for `n` nonzero differences without ties:
 * `2 * P(W <= w)`, capped at 1. The null distribution counts the subsets of the ranks `1..n`
 * by their sum, so the counts need `n(n+1)/2 + 1` entries and are exact doubles for `n <= 50`.
 */
function signedRankExactP(n: number, w: number): number {
  const max = (n * (n + 1)) / 2;
  const counts = new Float64Array(max + 1);
  counts[0] = 1;
  for (let r = 1; r <= n; r++) {
    for (let s = max; s >= r; s--) counts[s] += counts[s - r];
  }
  let cumulative = 0;
  for (let s = 0; s <= Math.floor(w); s++) cumulative += counts[s];
  return Math.min(1, (2 * cumulative) / 2 ** n);
}

/**
 * Two-sided permutation p-value of `W+` for the ranks `ranks` (ties and zeros give ranks that
 * the exact distribution does not cover): every one of the `2^n` sign assignments is
 * enumerated, so the result is deterministic. A relative tolerance of 1e-14 on the observed
 * sum decides which sums count as equal, as in `scipy.stats.permutation_test`.
 */
function signedRankPermutationP(ranks: readonly number[], observed: number): number {
  const n = ranks.length;
  const sums = new Float64Array(2 ** n);
  let size = 1; // sums[0] = 0 is the assignment where every rank has a negative sign
  for (const r of ranks) {
    for (let i = 0; i < size; i++) sums[size + i] = sums[i] + r;
    size *= 2;
  }
  const gamma = 1e-14 * Math.abs(observed);
  let less = 0;
  let greater = 0;
  for (let i = 0; i < size; i++) {
    if (sums[i] <= observed + gamma) less++;
    if (sums[i] >= observed - gamma) greater++;
  }
  return Math.min(1, (2 * Math.min(less, greater)) / size);
}

/**
 * Wilcoxon signed-rank test (paired, or one-sample vs 0). Drops zero differences,
 * ranks |d|, and chooses the p-value method as `scipy.stats.wilcoxon(x, y)` does with its
 * defaults (SciPy 1.16: `zero_method='wilcox'`, `correction=False`, `method='auto'`):
 *
 * - more than 50 differences (zeros included): the normal approximation;
 * - no zeros and no ties among |d|: the exact distribution of the signed-rank sum;
 * - up to 13 differences with zeros or ties: the permutation distribution over all sign
 *   assignments;
 * - otherwise: the normal approximation, with the tie correction of the variance.
 *
 * The normal approximation has no continuity correction. Statistic is `min(W⁺, W⁻)`.
 */
export function wilcoxon(x: Vec, y?: Vec): WilcoxonResult {
  const a = numberVector('wilcoxon', x);
  const yy = y !== undefined ? numberVector('wilcoxon', y) : undefined;
  if (yy !== undefined && yy.length !== a.length)
    throw new Error(
      `wilcoxon: paired samples must have equal length (${a.length} vs ${yy.length})`
    );
  const diffs = yy !== undefined ? a.map((v, i) => v - yy[i]) : a;
  if (hasNaN(diffs)) return { statistic: NaN, pValue: NaN, zStatistic: NaN };
  const nAll = diffs.length;
  const d = diffs.filter((v) => v !== 0);
  const n = d.length;
  if (n === 0) {
    // SciPy 1.16.3 (method 'auto'): the permutation path for 2 to 13 differences gives p = 1,
    // and the normal approximation for more gives 0 / 0. A single difference has no permutation.
    if (nAll < 2) throw new Error('wilcoxon: all differences are zero (test undefined)');
    return { statistic: 0, pValue: nAll <= 13 ? 1 : NaN, zStatistic: NaN };
  }
  const absD = d.map(Math.abs);
  const ranks = rankdata(absD);
  let wPlus = 0;
  let wMinus = 0;
  for (let i = 0; i < n; i++) {
    if (d[i] > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  }
  const statistic = Math.min(wPlus, wMinus);
  const tie = tieTerm(absD);
  const mn = (n * (n + 1)) / 4;
  const se = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24 - tie / 48);
  const zStatistic = (statistic - mn) / se;
  const hasZerosOrTies = n < nAll || tie > 0;
  let pValue: number;
  if (nAll > 50) pValue = 2 * normalCDF(-Math.abs(zStatistic));
  else if (!hasZerosOrTies) pValue = signedRankExactP(n, statistic);
  else if (nAll <= 13) pValue = signedRankPermutationP(ranks, wPlus);
  else pValue = 2 * normalCDF(-Math.abs(zStatistic));
  return { statistic, pValue, zStatistic };
}

/** Result of `fisherExact`: the sample odds ratio and the two-sided p-value. */
export interface FisherExactResult {
  oddsRatio: number;
  pValue: number;
}

/**
 * Rescale factor of the `fisherExact` walk and its reciprocal. They are powers of two, so a
 * rescale is exact.
 */
const FISHER_SHIFT = 2 ** 400;
const FISHER_TINY = 2 ** -400;

/**
 * Maximum number of steps of the `fisherExact` walk (measured: about 50 ns for each step at
 * full machine load, so the maximum takes about 20 s).
 */
const FISHER_MAX_STEPS = 400_000_000;

/** A table counts when its probability is at most the observed one times this (SciPy: 1e-14). */
const FISHER_TOLERANCE = 1 + 1e-14;

/**
 * P(k + step) / P(k) for the 2×2 table with `k` in the first cell, row total `r1`, column
 * total `c1` and `e = r2 - c1` (the last cell is `e + k`). `step` is 1 or -1. The ratio is a
 * quotient of integers, so it needs no log-gamma.
 */
function fisherRatio(r1: number, c1: number, e: number, k: number, step: number): number {
  return step === 1
    ? ((r1 - k) * (c1 - k)) / ((k + 1) * (e + k + 1))
    : (k * (e + k)) / ((r1 - k + 1) * (c1 - k + 1));
}

/**
 * Walk from the mode table to `end` in the direction `step` and add to `sums`: `sums[0]` is the
 * sum of all tables in units of the mode table, and `sums[1]` is the sum of the tables that
 * count, in units of the observed table. A probability is `term * 2^(-400 * scale)` in units of
 * the mode table, with `term` in [2^-400, 1], and the observed one is
 * `observed * 2^(-400 * observedScale)`. This is a module function with number parameters,
 * because a closure that writes to variables of `fisherExact` ran many times slower in V8.
 */
function fisherWalk(
  r1: number,
  c1: number,
  e: number,
  mode: number,
  end: number,
  step: number,
  observed: number,
  observedScale: number,
  sums: Float64Array
): void {
  const perObserved = 1 / observed;
  let total = 0;
  let counted = sums[1];
  let term = 1;
  let scale = 0;
  for (let k = mode; k !== end; k += step) {
    term *= fisherRatio(r1, c1, e, k, step);
    if (term < FISHER_TINY) {
      term *= FISHER_SHIFT;
      if (++scale > observedScale + 1) break; // below 2^-400 of the observed probability
    }
    if (scale === 0) total += term;
    if (scale < observedScale - 1) continue; // above 2^400 times the observed probability
    const units =
      scale === observedScale
        ? term * perObserved
        : scale > observedScale
          ? term * FISHER_TINY * perObserved
          : term * FISHER_SHIFT * perObserved;
    if (units <= FISHER_TOLERANCE) {
      counted += units;
      if (units <= 1e-17 * counted) break; // the terms fall away from the mode
    }
  }
  sums[0] += total;
  sums[1] = counted;
}

/**
 * Fisher's exact test on a 2×2 table `[[a, b], [c, d]]`. Two-sided p-value by the
 * total-probability method (sum of hypergeometric probabilities no greater than the
 * observed table's), matching `scipy.stats.fisher_exact`. `oddsRatio` is the sample
 * ratio `ad/bc` (SciPy reports the conditional-MLE estimate; the p-value matches).
 *
 * The probability of the table with `k` in the first cell rises to the mode of the
 * hypergeometric distribution and falls after it, and the ratio of two neighbours is a
 * quotient of integers. So the function walks away from the mode in both directions and keeps
 * each probability as a running product relative to the mode table. It needs no log-gamma,
 * whose rounding error grows with the counts (about 1e-5 at counts of 1e9). A product that
 * falls below 2^-400 is multiplied by 2^400 and the number of rescales is kept, so a
 * probability far below the smallest double keeps its full precision, and the only rounding
 * to a subnormal is in the result. The cost grows with the standard deviation of the
 * distribution and with the distance of the observed table from the mode, not with the size of
 * the counts.
 *
 * As in SciPy, a table counts when its probability is at most the observed one times
 * `1 + 1e-14`. The result is 0 only when the p-value is below half of the smallest double.
 *
 * @throws A `RangeError` when an entry is not a non-negative integer (SciPy casts a float to
 *   an integer without a message, but a count has no meaning for 3.7), when the smaller
 *   of the first row total and the first column total is above 2^53 - 1, when the sum of
 *   the entries is not finite, or when the walk needs more than 400,000,000 steps (counts above
 *   about 1e14 in each cell).
 */
export function fisherExact(
  table: readonly [readonly number[], readonly number[]]
): FisherExactResult {
  const [[a, b], [c, d]] = table;
  // SciPy raises for a negative entry. A NaN or an infinite entry made the old loop run forever.
  for (const v of [a, b, c, d]) {
    assertNumberScalar('fisherExact', v);
    if (!(Number.isInteger(v) && v >= 0)) {
      throw new RangeError('fisherExact: every table entry must be a non-negative integer');
    }
  }
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const c2 = b + d;
  const N = r1 + r2;
  const lo = Math.max(0, c1 - r2);
  const hi = Math.min(r1, c1);
  // `k++` does not change a `k` above 2^53, so a loop over `k` would not end.
  if (hi > Number.MAX_SAFE_INTEGER) {
    throw new RangeError(
      `fisherExact: a marginal total of ${hi} exceeds the supported maximum of 2^53 - 1`
    );
  }
  // An infinite sum gives a NaN mode, and the walk from a NaN mode would not end.
  if (!Number.isFinite(N)) {
    throw new RangeError('fisherExact: the sum of the table entries must be finite');
  }
  const oddsRatio = b * c === 0 ? Infinity : (a * d) / (b * c);
  // Serfling: the observed table has a probability of at most exp(-2 t^2 / (n (1 - (n - 1) / N))),
  // where t is its distance from the mean and n is a marginal total. At most 2^53 tables count,
  // each with at most that probability, so when the exponent is below -800 the p-value is below
  // 2^53 exp(-800), which is less than half of the smallest double: the correct result is 0.
  const spread = Math.min(...[r1, r2, c1, c2].map((n) => n * (1 - (n - 1) / N)));
  const distance = Math.abs(a - r1 * (c1 / N));
  if (spread > 0 && 2 * distance * distance > 800 * spread) return { oddsRatio, pValue: 0 };
  const e = r2 - c1;
  // The mode is floor((c1 + 1)(r1 + 1) / (N + 2)). Rounding can move the quotient across an
  // integer, so the two loops move the estimate to the table that no neighbour exceeds.
  let mode = Math.min(hi, Math.max(lo, Math.floor((c1 + 1) * ((r1 + 1) / (N + 2)))));
  while (mode < hi && fisherRatio(r1, c1, e, mode, 1) > 1) mode++;
  while (mode > lo && fisherRatio(r1, c1, e, mode, -1) > 1) mode--;
  // The walk goes three times from the mode to the observed table, and it sums the body of the
  // distribution, about 8.5 standard deviations on each side of the mode.
  const deviation = Math.sqrt((r1 / N) * (r2 / N) * c1 * (c2 / Math.max(N - 1, 1)));
  assertLoopOrder(
    'fisherExact',
    'the number of steps for this table (3 * distance from the mode + 17 * standard deviation)',
    Math.round(3 * Math.abs(a - mode) + 17 * deviation),
    FISHER_MAX_STEPS
  );

  // The probability of the observed table is observed * 2^(-400 * observedScale) in units of
  // the mode table.
  let observed = 1;
  let observedScale = 0;
  const toObserved = a > mode ? 1 : -1;
  for (let k = mode; k !== a; k += toObserved) {
    observed *= fisherRatio(r1, c1, e, k, toObserved);
    if (observed < FISHER_TINY) {
      observed *= FISHER_SHIFT;
      // Below 2^-1200 of the mode probability, 2^53 tables sum to less than 2^-1075: the result is 0.
      if (++observedScale > 2) return { oddsRatio, pValue: 0 };
    }
  }
  // Every table has at most the probability of the mode table, so every table counts.
  if (observedScale === 0 && observed * FISHER_TOLERANCE >= 1) return { oddsRatio, pValue: 1 };

  const sums = new Float64Array([1, 0]); // the mode table is in the sum of all tables
  fisherWalk(r1, c1, e, mode, hi, 1, observed, observedScale, sums);
  fisherWalk(r1, c1, e, mode, lo, -1, observed, observedScale, sums);
  // One rounding to a subnormal at most: the product before the power of two is above 2^-460.
  const pValue = observed * (sums[1] / sums[0]) * 2 ** (-400 * observedScale);
  return { oddsRatio, pValue: Math.min(1, pValue) };
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
  if (Number.isNaN(q) || Number.isNaN(k) || Number.isNaN(df)) return NaN;
  if (!(k >= 2)) throw new Error('studentizedRangeCDF: k (number of groups) must be >= 2');
  if (q <= 0) return 0;
  // The range of infinitely many standard normals is infinite. No finite q bounds the range.
  if (k === Infinity) return q === Infinity ? 1 : 0;
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
  return Math.min(
    1,
    Math.max(
      0,
      simpson((u) => fU(u) * rangeProb(q * u, k), 1e-5, umax, 120)
    )
  );
}

/** Quantile (inverse CDF) of the studentized range distribution, via bisection. */
export function studentizedRangeQuantile(p: number, k: number, df: number): number {
  if (Number.isNaN(p) || Number.isNaN(k) || Number.isNaN(df)) return NaN;
  if (!(p > 0 && p < 1)) throw new Error('studentizedRangeQuantile: p must be in (0, 1)');
  if (!(k >= 2)) throw new Error('studentizedRangeQuantile: k (number of groups) must be >= 2');
  // The CDF is 0 at every finite q when k is infinite, so every quantile is Infinity.
  if (k === Infinity) return Infinity;
  let lo = 0;
  // Bracket p by expanding hi geometrically until CDF(hi) >= p, rather than assuming a
  // fixed [0, 100] that silently clamps large quantiles to ~100 (unconverged).
  let hi = 1;
  // A NaN CDF value fails every `< p` test, so the bisection would collapse to 0 silently.
  const cdf = (q: number): number => {
    const value = studentizedRangeCDF(q, k, df);
    if (Number.isNaN(value)) throw new Error(`studentizedRangeQuantile: CDF is NaN at q=${q}`);
    return value;
  };
  for (let iter = 0; cdf(hi) < p; iter++) {
    if (iter >= 60)
      throw new Error(`studentizedRangeQuantile: failed to bracket p=${p} (CDF plateaued below p)`);
    hi *= 2;
  }
  // 45 bisections give ~hi/2^45 ≈ 1e-13 resolution — far tighter than any practical
  // tolerance, and each iteration is an expensive nested Simpson integral, so keep the
  // count modest.
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * One pairwise comparison from `tukeyHSD`.
 *
 * `groups` holds the two group indices. `reject` is true if the q statistic is above the
 * critical value for `alpha`.
 */
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
  const gs = groups.map((g) => numberVector('tukeyHSD', g));
  const k = gs.length;
  if (k < 2) throw new Error('tukeyHSD: need at least 2 groups');
  const means = gs.map(mean);
  const N = gs.reduce((s, g) => s + g.length, 0);
  const dfErr = N - k;
  if (dfErr <= 0)
    throw new Error(
      'tukeyHSD: residual df must be > 0 (groups must hold more observations than groups)'
    );
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

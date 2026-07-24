/**
 * Statistical Hypothesis Tests
 *
 * Provides common statistical tests returning test statistics and p-values:
 * - studentTTest: one-sample and two-sample t-test
 * - chiSquareTest: chi-square goodness of fit
 * - anova: one-way ANOVA
 * - kolmogorovSmirnovTest: Kolmogorov-Smirnov test
 * - mannWhitneyTest: Mann-Whitney U test
 * - shapiroWilkTest: Shapiro-Wilk normality test
 * - principalComponentAnalysis: PCA dimensionality reduction
 *
 * Worker-dispatch policy (Slice 3.10):
 * - chiSquareTest (1D): element-wise reduction via applyKernel2 + sum above threshold.
 * - kolmogorovSmirnovTest: sort on main thread; post-sort CDF-compare loop via
 *   applyKernel (serialised normal-CDF) above threshold when no custom CDF is given.
 * - mannWhitneyTest: sort on main thread; rank-sum via parallel dot above threshold.
 * - shapiroWilkTest: sort on main thread; W-numerator dot-product via parallel dot
 *   above threshold.
 *
 * Bootstrap fan-out (Slice 5.11):
 * - All four two-sample / goodness-of-fit tests accept `{ bootstrap: N }`.
 * - When set, N permuted resamples are drawn from the combined data pool and the
 *   statistic is recomputed for each.  The N tasks are fanned out via
 *   `Promise.all` so the JS event-loop can interleave them (embarrassingly
 *   parallel at the microtask level; each individual run uses the existing
 *   Slice-3.10 worker dispatch if the resample is large enough).
 * - `bootstrapSeed` enables fully deterministic resampling via Mulberry32 PRNG.
 *
 * @packageDocumentation
 */

import { computePool } from '@danielsimonjr/mathts-parallel';
import { sortF64Dispatch, WASM_SORT_THRESHOLD } from '../wasm/sort/wasm-bridge.js';
import { erfcScalar } from './special.js';
import { studentTQuantile, normalQuantile } from '../distribution-functions.js';
import { multipleTest } from '../stats/inference-extra.js';

// =============================================================================
// Type Definitions
// =============================================================================

/** 64-bit float */
type f64 = number;

export interface TTestResult {
  statistic: f64;
  pValue: f64;
  degreesOfFreedom: f64;
}

export interface ChiSquareResult {
  statistic: f64;
  pValue: f64;
  degreesOfFreedom: f64;
}

export interface AnovaResult {
  fStatistic: f64;
  pValue: f64;
  dfBetween: f64;
  dfWithin: f64;
}

export interface KSTestResult {
  statistic: f64;
  pValue: f64;
}

export interface MannWhitneyResult {
  uStatistic: f64;
  pValue: f64;
}

export interface ShapiroWilkResult {
  statistic: f64;
  pValue: f64;
}

export interface PCAResult {
  components: f64[][];
  explained: f64[];
  scores: f64[][];
}

// =============================================================================
// Bootstrap types (Slice 5.11)
// =============================================================================

/**
 * Options for bootstrap resampling.  When `bootstrap` is set, the test is run
 * on `bootstrap` independent permutations of the combined sample data, and the
 * results are aggregated into a `*BootstrapResult` object.
 *
 * @example
 * const r = await kolmogorovSmirnovTest(s1, s2, { bootstrap: 200, bootstrapSeed: 42 });
 * // r.pValueEmpirical  — fraction of permuted statistics ≥ base statistic
 */
export interface BootstrapOptions {
  /**
   * Number of permutation-resampled test runs to execute.
   * `0` or `undefined` = fall back to the ordinary (non-bootstrap) result.
   */
  bootstrap?: number;
  /**
   * Integer seed for the Mulberry32 PRNG so that permutations are
   * deterministic across runs.  When omitted Math.random() is used.
   */
  bootstrapSeed?: number;
}

export interface KSBootstrapResult {
  /** D statistic from the original (un-permuted) samples. */
  statistic: f64;
  /** Fraction of permuted statistics ≥ original statistic (two-tailed). */
  pValueEmpirical: f64;
  /** Raw permuted D statistics. */
  bootstrapStatistics: Float64Array;
  bootstrapMean: f64;
  bootstrapStd: f64;
}

export interface MWBootstrapResult {
  /** U statistic from the original (un-permuted) samples. */
  uStatistic: f64;
  /** Fraction of permuted U statistics ≥ original U statistic. */
  pValueEmpirical: f64;
  /** Raw permuted U statistics. */
  bootstrapStatistics: Float64Array;
  bootstrapMean: f64;
  bootstrapStd: f64;
}

export interface SWBootstrapResult {
  /** W statistic from the original (un-permuted) samples. */
  statistic: f64;
  /**
   * Fraction of permuted W statistics ≤ original W statistic.
   * (Small W indicates non-normality, so we count ≤.)
   */
  pValueEmpirical: f64;
  /** Raw permuted W statistics. */
  bootstrapStatistics: Float64Array;
  bootstrapMean: f64;
  bootstrapStd: f64;
}

export interface ChiSquareBootstrapResult {
  /** chi² statistic from the original (un-permuted) samples. */
  statistic: f64;
  /** Fraction of permuted statistics ≥ original statistic. */
  pValueEmpirical: f64;
  /** Raw permuted chi² statistics. */
  bootstrapStatistics: Float64Array;
  bootstrapMean: f64;
  bootstrapStd: f64;
}

// =============================================================================
// Worker-dispatch threshold (Slice 3.10)
// =============================================================================

/**
 * Minimum sample / category count before routing the statistical computation
 * (post-sort reductions for KS/MW/SW; element-wise reduction for chiSquare)
 * through the ComputePool worker pool.
 */
const HYPOTHESIS_THRESHOLD = 4096;

// =============================================================================
// Mulberry32 seeded PRNG (Slice 5.11)
// =============================================================================

/**
 * Create a Mulberry32 PRNG seeded with `seed`.
 *
 * Returns a closure yielding U[0,1) floats.  Period: 2^32.
 * NOT cryptographically secure.
 *
 * Reference: Tommy Ettinger, https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 * Canonical implementation: tensor/src/operations/random.ts
 */
function _makeMulberry32(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    z = (z ^ (z >>> 14)) >>> 0;
    return z / 0x100000000;
  };
}

/**
 * Fisher-Yates in-place shuffle of a Float64Array using a provided PRNG.
 */
function _shuffle(arr: Float64Array, rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

/**
 * Aggregate an array of bootstrap statistics into summary fields.
 */
function _bootstrapSummary(stats: Float64Array): {
  bootstrapMean: f64;
  bootstrapStd: f64;
} {
  const n = stats.length;
  if (n === 0) return { bootstrapMean: NaN, bootstrapStd: NaN };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += stats[i];
  const mean = sum / n;
  let sq = 0;
  for (let i = 0; i < n; i++) sq += (stats[i] - mean) ** 2;
  const std = n > 1 ? Math.sqrt(sq / (n - 1)) : 0;
  return { bootstrapMean: mean, bootstrapStd: std };
}

// =============================================================================
// Internal Helpers
// =============================================================================

function _mean(arr: f64[]): f64 {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

function _variance(arr: f64[], ddof: number = 1): f64 {
  const m = _mean(arr);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += (arr[i] - m) ** 2;
  return sum / (arr.length - ddof);
}

/**
 * Error function erf(x).
 */
function _erf(x: f64): f64 {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * a);
  const y =
    1.0 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/**
 * Log-gamma function using Lanczos approximation.
 */
function _lgamma(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - _lgamma(1 - x);
  }
  x -= 1;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let sum = c[0];
  for (let i = 1; i < 9; i++) sum += c[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

/**
 * Regularized lower incomplete gamma function P(a, x).
 */
function _gammainc(a: f64, x: f64): f64 {
  if (x < 0) return NaN;
  if (x === 0) return 0;

  if (x < a + 1) {
    let sum = 1.0 / a;
    let term = 1.0 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - _lgamma(a));
  } else {
    const TINY = 1e-30;
    const b0 = x + 1 - a;
    let c = 1.0 / TINY;
    let d = 1.0 / b0;
    let f = d;
    for (let n = 1; n < 300; n++) {
      const an = n * (a - n);
      const bn = x + 2 * n + 1 - a;
      d = bn + an * d;
      if (Math.abs(d) < TINY) d = TINY;
      c = bn + an / c;
      if (Math.abs(c) < TINY) c = TINY;
      d = 1.0 / d;
      const delta = d * c;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-14) break;
    }
    const Q = f * Math.exp(-x + a * Math.log(x) - _lgamma(a));
    return 1 - Q;
  }
}

/**
 * Regularized incomplete beta function I_x(a,b).
 */
function _betainc(x: f64, a: f64, b: f64): f64 {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - _betainc(1 - x, b, a);
  }

  const lnBeta = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  const TINY = 1e-30;
  let c = 1.0;
  let d = 1.0 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1.0 / d;
  let f = d;

  for (let m = 1; m <= 200; m++) {
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1.0 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1.0 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1.0 / d;
    f *= d * c;

    numerator = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1.0 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1.0 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1.0 / d;
    const delta = d * c;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return front * f;
}

/**
 * Two-tailed p-value from t-distribution using incomplete beta.
 */
function _tPValue(t: f64, df: f64): f64 {
  const x = df / (df + t * t);
  const ib = _betainc(x, df / 2, 0.5);
  return ib;
}

/**
 * Standard normal CDF.
 */
function _normalCDF(x: f64): f64 {
  return 0.5 * (1 + _erf(x / Math.SQRT2));
}

/**
 * Upper-tail p-value from chi-squared distribution.
 */
function _chiSquaredPValue(x: f64, df: f64): f64 {
  return 1 - _gammainc(df / 2, x / 2);
}

/**
 * Upper-tail p-value from F-distribution.
 */
function _fPValue(f: f64, d1: f64, d2: f64): f64 {
  return 1 - _betainc((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2);
}

/**
 * Binomial coefficient C(n, k), computed via the standard multiplicative
 * iteration (exact for the small n used here — well within double precision).
 */
function _binomCoeff(n: number, k: number): f64 {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

// =============================================================================
// studentTTest
// =============================================================================

/**
 * Student's t-test.
 *
 * One-sample: test if sample mean differs from 0 (or provide second argument as null).
 * Two-sample: Welch's t-test (unequal variances) comparing two independent samples.
 *
 * @param sample1 - First sample
 * @param sample2 - Second sample (omit for one-sample test)
 * @returns Test result with statistic, pValue, degreesOfFreedom
 *
 * @example
 * studentTTest([1, 2, 3, 4, 5]) // one-sample test
 * studentTTest([1, 2, 3], [4, 5, 6]) // two-sample test
 */
export function studentTTest(sample1: f64[], sample2?: f64[]): TTestResult {
  if (sample1.length < 2) throw new Error('studentTTest: sample1 must have at least 2 elements');

  if (sample2 === undefined || sample2 === null) {
    // One-sample t-test (test against mu=0)
    const n = sample1.length;
    const m = _mean(sample1);
    const s = Math.sqrt(_variance(sample1));
    const t = m / (s / Math.sqrt(n));
    const df = n - 1;
    return { statistic: t, pValue: _tPValue(t, df), degreesOfFreedom: df };
  }

  if (sample2.length < 2) throw new Error('studentTTest: sample2 must have at least 2 elements');

  // Welch's two-sample t-test
  const n1 = sample1.length;
  const n2 = sample2.length;
  const m1 = _mean(sample1);
  const m2 = _mean(sample2);
  const v1 = _variance(sample1);
  const v2 = _variance(sample2);
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  const t = (m1 - m2) / se;

  // Welch-Satterthwaite degrees of freedom
  const num = (v1 / n1 + v2 / n2) ** 2;
  const den = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  const df = num / den;

  return { statistic: t, pValue: _tPValue(t, df), degreesOfFreedom: df };
}

// =============================================================================
// chiSquareTest
// =============================================================================

/**
 * Chi-square goodness-of-fit test (1D) or independence test (2D contingency table).
 *
 * 1D form: tests whether observed frequencies match expected frequencies.
 *   chi2 = sum((O_i - E_i)^2 / E_i), df = length - 1.
 *
 * 2D form: when called with a single 2D `observed` array (rows x cols),
 *   tests independence of two categorical variables. Expected cell counts
 *   are auto-computed from row totals * col totals / grand total.
 *   chi2 = sum_{i,j} ((O_ij - E_ij)^2 / E_ij), df = (rows-1) * (cols-1).
 *
 * Worker dispatch (Slice 3.10): For the 1D form with ≥ 4096 categories the
 * element-wise reduction `(o-e)²/e` is computed via `applyKernel2` + `sum`
 * on the worker pool. The 2D form stays on the main thread (reduction over a
 * 2D grid — marshal cost dominates).
 *
 * Bootstrap (Slice 5.11): When `opts.bootstrap > 0`, the observed counts are
 * resampled with replacement from a multinomial distribution (preserving the
 * total count), the statistic is re-computed for each resample, and the
 * empirical p-value is the fraction of resampled statistics ≥ the base.
 *
 * Complementary to (NOT a duplicate of) `chi2Contingency`
 * (`stats/inference-extra.js`): this function's 2D form is a plain
 * independence test, while `chi2Contingency` is the
 * `scipy.stats.chi2_contingency`-parity contingency test, adding the Yates
 * continuity correction (2x2 tables), an expected-frequency table, and
 * Cramér's V effect size.
 *
 * @param observed - 1D observed counts, OR 2D contingency table (rows x cols)
 * @param expected - 1D expected counts (required for 1D form; omit for 2D)
 * @param opts     - Optional bootstrap settings
 * @returns Chi-square test result (or bootstrap result when `opts.bootstrap > 0`)
 *
 * @example
 * chiSquareTest([10, 20, 30], [20, 20, 20])     // 1D goodness-of-fit
 * chiSquareTest([[10, 20], [30, 40]])           // 2D independence test
 * chiSquareTest([10, 20, 30], [20, 20, 20], { bootstrap: 500 }) // bootstrap
 */
export async function chiSquareTest(
  observed: f64[] | f64[][],
  expected?: f64[],
  opts?: BootstrapOptions
): Promise<ChiSquareResult | ChiSquareBootstrapResult> {
  // 2D contingency table form — stays on main thread
  if (Array.isArray(observed[0])) {
    const obs2d = observed as f64[][];
    const rows = obs2d.length;
    if (rows < 2) throw new Error('chiSquareTest: contingency table needs >= 2 rows');
    const cols = obs2d[0].length;
    if (cols < 2) throw new Error('chiSquareTest: contingency table needs >= 2 cols');
    for (let i = 0; i < rows; i++) {
      if (obs2d[i].length !== cols) {
        throw new Error('chiSquareTest: contingency table must be rectangular');
      }
    }

    const rowTotals = new Array<f64>(rows).fill(0);
    const colTotals = new Array<f64>(cols).fill(0);
    let grand = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const v = obs2d[i][j];
        rowTotals[i] += v;
        colTotals[j] += v;
        grand += v;
      }
    }
    if (grand <= 0) throw new Error('chiSquareTest: contingency table sum must be positive');

    let statistic = 0;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const e = (rowTotals[i] * colTotals[j]) / grand;
        if (e <= 0) continue; // skip zero-expected cells
        const o = obs2d[i][j];
        statistic += ((o - e) * (o - e)) / e;
      }
    }
    const df = (rows - 1) * (cols - 1);
    return { statistic, pValue: _chiSquaredPValue(statistic, df), degreesOfFreedom: df };
  }

  // 1D goodness-of-fit form
  const obs1d = observed as f64[];
  if (!expected) {
    throw new Error('chiSquareTest: 1D form requires expected array');
  }
  if (obs1d.length !== expected.length) {
    throw new Error('chiSquareTest: observed and expected must have the same length');
  }
  if (obs1d.length < 2) {
    throw new Error('chiSquareTest: need at least 2 categories');
  }

  // Validate expected values upfront (cannot be deferred to workers)
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] <= 0) throw new Error('chiSquareTest: expected values must be positive');
  }

  const df = obs1d.length - 1;
  const n = obs1d.length;
  // `expected` is narrowed to f64[] by the guard above; capture it in a const so
  // the narrowing is visible inside the nested bootstrap closure below.
  const expectedSafe = expected;

  // --- Worker-dispatch path: element-wise (o-e)²/e reduction via pool --------
  let baseStatistic: f64;
  if (n >= HYPOTHESIS_THRESHOLD && computePool.shouldParallelize(n, 'chiSquareTest')) {
    const obsF64 = new Float64Array(obs1d);
    const expF64 = new Float64Array(expected);
    const perElem = await computePool.applyKernel2(
      obsF64,
      expF64,
      '(o, e) => (o - e) * (o - e) / e'
    );
    const sumResult = await computePool.sum(perElem.result);
    baseStatistic = sumResult.result;
  } else {
    // --- Sequential fallback -------------------------------------------------
    baseStatistic = 0;
    for (let i = 0; i < n; i++) {
      baseStatistic += (obs1d[i] - expected[i]) ** 2 / expected[i];
    }
  }

  const baseResult: ChiSquareResult = {
    statistic: baseStatistic,
    pValue: _chiSquaredPValue(baseStatistic, df),
    degreesOfFreedom: df,
  };

  // --- Bootstrap path (Slice 5.11) ------------------------------------------
  const B = opts?.bootstrap ?? 0;
  if (B <= 0) return baseResult;

  // Build cumulative expected probability distribution for multinomial sampling.
  let totalExpected = 0;
  for (let i = 0; i < n; i++) totalExpected += expected[i];
  const cumProbs = new Float64Array(n);
  let cum = 0;
  for (let i = 0; i < n; i++) {
    cum += expected[i] / totalExpected;
    cumProbs[i] = cum;
  }

  // Total observed count — resample this many draws.
  let totalObs = 0;
  for (let i = 0; i < n; i++) totalObs += obs1d[i];

  const rng = opts?.bootstrapSeed !== undefined ? _makeMulberry32(opts.bootstrapSeed) : Math.random;

  /**
   * Draw one multinomial resample: draw `totalObs` times from the expected
   * distribution, compute the chi² statistic against `expected`.
   */
  function _chiSquareBootstrapOnce(): f64 {
    const resampled = new Float64Array(n);
    for (let d = 0; d < totalObs; d++) {
      const u = rng();
      // Binary search in cumProbs
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumProbs[mid] < u) lo = mid + 1;
        else hi = mid;
      }
      resampled[lo]++;
    }
    let stat = 0;
    for (let i = 0; i < n; i++) {
      stat += (resampled[i] - expectedSafe[i]) ** 2 / expectedSafe[i];
    }
    return stat;
  }

  const bootstrapStats = new Float64Array(B);
  // Fan out B resamples using Promise.all for event-loop concurrency.
  const tasks = Array.from({ length: B }, (_, idx) =>
    Promise.resolve().then(() => {
      bootstrapStats[idx] = _chiSquareBootstrapOnce();
    })
  );
  await Promise.all(tasks);

  let countGe = 0;
  for (let i = 0; i < B; i++) {
    if (bootstrapStats[i] >= baseStatistic) countGe++;
  }
  const pValueEmpirical = countGe / B;
  const { bootstrapMean, bootstrapStd } = _bootstrapSummary(bootstrapStats);

  return {
    statistic: baseStatistic,
    pValueEmpirical,
    bootstrapStatistics: bootstrapStats,
    bootstrapMean,
    bootstrapStd,
  } satisfies ChiSquareBootstrapResult;
}

// =============================================================================
// anova
// =============================================================================

/**
 * One-way ANOVA (Analysis of Variance).
 *
 * Tests whether the means of multiple groups are equal.
 *
 * @param groups - Array of sample arrays (at least 2 groups)
 * @returns ANOVA result with F-statistic and p-value
 *
 * @example
 * anova([[1, 2, 3], [4, 5, 6], [7, 8, 9]])
 */
export function anova(groups: f64[][]): AnovaResult {
  if (groups.length < 2) throw new Error('anova: need at least 2 groups');

  const k = groups.length;
  let N = 0;
  let grandSum = 0;

  const groupMeans: f64[] = [];
  const groupSizes: number[] = [];

  for (const group of groups) {
    if (group.length < 1) throw new Error('anova: each group must have at least 1 element');
    groupSizes.push(group.length);
    N += group.length;
    const m = _mean(group);
    groupMeans.push(m);
    for (const x of group) grandSum += x;
  }

  const grandMean = grandSum / N;

  // Sum of squares between groups
  let ssBetween = 0;
  for (let i = 0; i < k; i++) {
    ssBetween += groupSizes[i] * (groupMeans[i] - grandMean) ** 2;
  }

  // Sum of squares within groups
  let ssWithin = 0;
  for (let i = 0; i < k; i++) {
    for (const x of groups[i]) {
      ssWithin += (x - groupMeans[i]) ** 2;
    }
  }

  const dfBetween = k - 1;
  const dfWithin = N - k;

  if (dfWithin <= 0) throw new Error('anova: insufficient degrees of freedom');

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  const fStatistic = msWithin === 0 ? (ssBetween === 0 ? 0 : Infinity) : msBetween / msWithin;
  const pValue = _fPValue(fStatistic, dfBetween, dfWithin);

  return { fStatistic, pValue, dfBetween, dfWithin };
}

// =============================================================================
// kolmogorovSmirnovTest
// =============================================================================

/**
 * Kolmogorov-Smirnov test for goodness of fit.
 *
 * One-sample test against the standard normal distribution (default),
 * or provide a custom CDF function.
 *
 * Worker dispatch (Slice 3.10): When no custom CDF is supplied and
 * `sample.length >= 4096`, the sort stays on the main thread but the
 * per-element normal-CDF evaluation is dispatched via `applyKernel`.
 * Max-reduction of |D+| and |D-| is done on the main thread from the
 * returned CDF values (O(n) but cheap vs. O(n log n) sort).
 * When a custom CDF closure is given, the parallel path is skipped
 * (closures cannot be serialised into worker threads).
 *
 * Bootstrap (Slice 5.11): When `opts.bootstrap > 0`, the sample is resampled
 * with replacement (parametric bootstrap from the empirical distribution),
 * and the D statistic is recomputed against the same CDF for each resample.
 * Empirical p-value = fraction of bootstrap D values ≥ base D.
 *
 * @param sample - Array of observations
 * @param cdfFn  - CDF function to test against (default: standard normal)
 * @param opts   - Optional bootstrap settings
 * @returns K-S test result
 *
 * @example
 * kolmogorovSmirnovTest([0.1, 0.5, 0.9], (x) => x) // test against uniform(0,1)
 * kolmogorovSmirnovTest(data, undefined, { bootstrap: 200, bootstrapSeed: 1 })
 */
export async function kolmogorovSmirnovTest(
  sample: f64[],
  cdfFn?: (x: f64) => f64,
  opts?: BootstrapOptions
): Promise<KSTestResult | KSBootstrapResult> {
  if (sample.length < 1) throw new Error('kolmogorovSmirnovTest: sample must be non-empty');
  if (cdfFn !== undefined && cdfFn !== null && typeof cdfFn !== 'function') {
    // One-sample test against a CDF *function* — guard the common mistake of
    // passing a second sample array (this is not a two-sample KS test).
    throw new TypeError(
      'kolmogorovSmirnovTest: cdfFn must be a CDF function (this is a one-sample test)'
    );
  }

  const n = sample.length;
  // Sort — WASM-accelerated above WASM_SORT_THRESHOLD (16 K elements).
  const sorted = new Float64Array(n);
  for (let i = 0; i < n; i++) sorted[i] = sample[i];
  sortF64Dispatch(sorted);

  let cdfValues: Float64Array;

  // --- Worker-dispatch path: normal CDF only (no custom closure) -------------
  if (
    !cdfFn &&
    n >= HYPOTHESIS_THRESHOLD &&
    computePool.shouldParallelize(n, 'kolmogorovSmirnovTest')
  ) {
    // Serialize the normal CDF into a worker-safe kernel (no free variables).
    const kernelSrc =
      '(x) => { ' +
      'const sign = x < 0 ? -1 : 1; ' +
      'const a = Math.abs(x / 1.4142135623730951); ' +
      'const t = 1.0 / (1.0 + 0.3275911 * a); ' +
      'const y = 1.0 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a); ' +
      'return 0.5 * (1 + sign * y); }';
    const result = await computePool.applyKernel(sorted, kernelSrc);
    cdfValues = result.result;
  } else {
    // --- Sequential path (custom CDF or below threshold) ---------------------
    const cdf = cdfFn || _normalCDF;
    cdfValues = new Float64Array(n);
    for (let i = 0; i < n; i++) cdfValues[i] = cdf(sorted[i]);
  }

  // Max-reduction of D+ and D- — O(n), stays on main thread
  let dMax = 0;
  for (let i = 0; i < n; i++) {
    const cdfVal = cdfValues[i];
    const dPlus = Math.abs((i + 1) / n - cdfVal);
    const dMinus = Math.abs(cdfVal - i / n);
    dMax = Math.max(dMax, dPlus, dMinus);
  }

  // Approximate p-value using Kolmogorov distribution
  // P(D_n > d) ~ 2 * sum_{k=1}^{inf} (-1)^{k+1} * exp(-2k^2 * n * d^2)
  const sqrtN = Math.sqrt(n);
  const z = (sqrtN + 0.12 + 0.11 / sqrtN) * dMax;
  let pValue = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * z * z);
    pValue += term;
    if (Math.abs(term) < 1e-15) break;
  }
  pValue = Math.max(0, Math.min(1, pValue));

  const baseResult: KSTestResult = { statistic: dMax, pValue };

  // --- Bootstrap path (Slice 5.11) ------------------------------------------
  const B = opts?.bootstrap ?? 0;
  if (B <= 0) return baseResult;

  const rng = opts?.bootstrapSeed !== undefined ? _makeMulberry32(opts.bootstrapSeed) : Math.random;
  const cdf = cdfFn || _normalCDF;

  /**
   * One bootstrap iteration: resample with replacement, sort, compute D.
   */
  function _ksBootstrapOnce(): f64 {
    const resample = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      resample[i] = sorted[Math.floor(rng() * n)];
    }
    resample.sort();
    let d = 0;
    for (let i = 0; i < n; i++) {
      const cv = cdf(resample[i]);
      d = Math.max(d, Math.abs((i + 1) / n - cv), Math.abs(cv - i / n));
    }
    return d;
  }

  const bootstrapStats = new Float64Array(B);
  const tasks = Array.from({ length: B }, (_, idx) =>
    Promise.resolve().then(() => {
      bootstrapStats[idx] = _ksBootstrapOnce();
    })
  );
  await Promise.all(tasks);

  let countGe = 0;
  for (let i = 0; i < B; i++) {
    if (bootstrapStats[i] >= dMax) countGe++;
  }
  const pValueEmpirical = countGe / B;
  const { bootstrapMean, bootstrapStd } = _bootstrapSummary(bootstrapStats);

  return {
    statistic: dMax,
    pValueEmpirical,
    bootstrapStatistics: bootstrapStats,
    bootstrapMean,
    bootstrapStd,
  } satisfies KSBootstrapResult;
}

// =============================================================================
// Mann-Whitney exact null distribution (Phase 4, Task 2b)
// =============================================================================

/**
 * Frequency table of the exact (no-ties) Mann-Whitney U null distribution for
 * group sizes `n1`, `n2`: `counts[u]` = number of distinct rank arrangements
 * giving rank-sum-derived U = u, for u in [0, n1*n2].
 *
 * Recurrence (Mann & Whitney 1947): C(n1,n2)[u] = C(n1-1,n2)[u-n2] +
 * C(n1,n2-1)[u], with C(a,0) = C(0,b) = the single-point mass at u=0. Built
 * bottom-up over the (n1+1) x (n2+1) grid; total memory/work is bounded by
 * `n1*n2` (this is only invoked when n1*n2 <= 400 — see `mannWhitneyTest`).
 */
function _mwUCounts(n1: number, n2: number): Float64Array {
  const table: Float64Array[][] = [];
  for (let i = 0; i <= n1; i++) {
    const row: Float64Array[] = [];
    for (let j = 0; j <= n2; j++) {
      const maxU = i * j;
      const arr = new Float64Array(maxU + 1);
      if (i === 0 || j === 0) {
        arr[0] = 1;
      } else {
        const prevI = table[i - 1][j];
        const prevJ = row[j - 1];
        for (let u = 0; u <= maxU; u++) {
          let val = 0;
          const uShift = u - j;
          if (uShift >= 0 && uShift < prevI.length) val += prevI[uShift];
          if (u < prevJ.length) val += prevJ[u];
          arr[u] = val;
        }
      }
      row.push(arr);
    }
    table.push(row);
  }
  return table[n1][n2];
}

/**
 * Exact two-sided Mann-Whitney p-value for group sizes `n1`, `n2` and observed
 * `U = min(U1, U2)` (no ties). Matches `scipy.stats.mannwhitneyu(...,
 * method='exact')`.
 *
 * `U` is <= n1*n2/2 by construction (it is the min of the two complementary
 * U statistics), so `P(U1 <= U) <= 0.5 <= P(U1 >= U)` by the symmetry of the
 * null distribution about n1*n2/2 — the two-sided p is therefore
 * `2 * P(U1 <= U)`, capped at 1.
 */
function _mwExactPValue(n1: number, n2: number, U: number): f64 {
  const counts = _mwUCounts(n1, n2);
  let total = 0;
  for (let k = 0; k < counts.length; k++) total += counts[k];
  let cumLe = 0;
  for (let k = 0; k <= U; k++) cumLe += counts[k];
  return Math.min(1, 2 * (cumLe / total));
}

// =============================================================================
// mannWhitneyTest
// =============================================================================

/**
 * Mann-Whitney U test (Wilcoxon rank-sum test).
 *
 * Non-parametric test for whether two independent samples are drawn
 * from the same distribution.
 *
 * Worker dispatch (Slice 3.10): When the combined sample has ≥ 4096 elements,
 * the sort stays on the main thread but the rank-sum for group 1 is computed
 * via a parallel dot-product `dot(ranks, groupIndicator)` on the pool.
 *
 * @param sample1 - First sample
 * @param sample2 - Second sample
 * @param opts    - Optional bootstrap settings
 * @returns Mann-Whitney test result
 *
 * @example
 * mannWhitneyTest([1, 2, 3], [4, 5, 6])
 * mannWhitneyTest(s1, s2, { bootstrap: 200, bootstrapSeed: 7 })
 */
export async function mannWhitneyTest(
  sample1: f64[],
  sample2: f64[],
  opts?: BootstrapOptions
): Promise<MannWhitneyResult | MWBootstrapResult> {
  if (sample1.length < 1 || sample2.length < 1) {
    throw new Error('mannWhitneyTest: both samples must be non-empty');
  }

  const n1 = sample1.length;
  const n2 = sample2.length;
  const nTotal = n1 + n2;

  // Combine and rank — WASM-sort-accelerated above WASM_SORT_THRESHOLD.
  const combined: { value: f64; group: number }[] = [];
  for (const v of sample1) combined.push({ value: v, group: 1 });
  for (const v of sample2) combined.push({ value: v, group: 2 });

  if (nTotal >= WASM_SORT_THRESHOLD) {
    // Use WASM argsort on the value vector, then reorder.
    const vals = new Float64Array(nTotal);
    for (let k = 0; k < nTotal; k++) vals[k] = combined[k].value;
    const { argsortF64Dispatch } = await import('../wasm/sort/wasm-bridge.js');
    const idx = argsortF64Dispatch(vals);
    const sortedCombined: { value: f64; group: number }[] = new Array(nTotal);
    for (let k = 0; k < nTotal; k++) sortedCombined[k] = combined[idx[k]];
    combined.length = 0;
    for (let k = 0; k < nTotal; k++) combined.push(sortedCombined[k]);
  } else {
    combined.sort((a, b) => a.value - b.value);
  }

  // Assign ranks with tie handling
  const ranksArr = new Float64Array(nTotal);
  let hasTies = false;
  let i = 0;
  while (i < nTotal) {
    let j = i;
    while (j < nTotal && combined[j].value === combined[i].value) j++;
    if (j - i > 1) hasTies = true;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) ranksArr[k] = avgRank;
    i = j;
  }

  let R1: f64;

  // --- Worker-dispatch path: parallel dot of ranks × group-1 indicator ------
  if (nTotal >= HYPOTHESIS_THRESHOLD && computePool.shouldParallelize(nTotal, 'mannWhitneyTest')) {
    const indicator = new Float64Array(nTotal);
    for (let k = 0; k < nTotal; k++) indicator[k] = combined[k].group === 1 ? 1 : 0;
    const dotResult = await computePool.dot(ranksArr, indicator);
    R1 = dotResult.result;
  } else {
    // --- Sequential fallback -------------------------------------------------
    R1 = 0;
    for (let k = 0; k < nTotal; k++) {
      if (combined[k].group === 1) R1 += ranksArr[k];
    }
  }

  const U1 = R1 - (n1 * (n1 + 1)) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);

  // p-value: exact small-n Mann-Whitney U-distribution when n1*n2 <= 400 and
  // there are no ties (matches scipy method='exact'); otherwise the normal
  // approximation (unchanged — also scipy's fallback when ties are present).
  let pValue: f64;
  if (n1 * n2 <= 400 && !hasTies) {
    pValue = _mwExactPValue(n1, n2, U);
  } else {
    const mu = (n1 * n2) / 2;
    const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
    const z = sigma === 0 ? 0 : (U - mu) / sigma;
    pValue = Math.min(1, 2 * _normalCDF(z)); // two-tailed
  }

  const baseResult: MannWhitneyResult = { uStatistic: U, pValue };

  // --- Bootstrap path (Slice 5.11) ------------------------------------------
  const B = opts?.bootstrap ?? 0;
  if (B <= 0) return baseResult;

  // Build combined pool as Float64Array for permutation bootstrap.
  const combinedPool = new Float64Array(nTotal);
  for (let k = 0; k < nTotal; k++) combinedPool[k] = combined[k].value;

  const rng = opts?.bootstrapSeed !== undefined ? _makeMulberry32(opts.bootstrapSeed) : Math.random;

  /**
   * Compute Mann-Whitney U statistic for a given split of a pre-sorted
   * combined array. The first `n1` elements are treated as group 1.
   * (Pure sequential — fast enough per iteration.)
   */
  function _mwUFromPermutation(perm: Float64Array): f64 {
    // Sort the permutation array
    const tmp = perm.slice();
    tmp.sort();

    // Assign ranks with tie handling
    const r = new Float64Array(nTotal);
    let ii = 0;
    while (ii < nTotal) {
      let jj = ii;
      while (jj < nTotal && tmp[jj] === tmp[ii]) jj++;
      const avgR = (ii + 1 + jj) / 2;
      for (let kk = ii; kk < jj; kk++) r[kk] = avgR;
      ii = jj;
    }

    // rank-sum for group 1 (first n1 elements of perm, not tmp)
    // We need to map perm values back to ranks.
    // Build value→rank index from the sorted array.
    // Since we use avg ranks, we can do a simpler approach:
    // create sorted copy with original indices to map back.
    const indexed = Array.from({ length: nTotal }, (_, k) => ({
      val: perm[k],
      origIdx: k,
    })).sort((a, b) => a.val - b.val);

    // Re-assign avg ranks by value
    const rankByOrig = new Float64Array(nTotal);
    let kk = 0;
    while (kk < nTotal) {
      let ll = kk;
      while (ll < nTotal && indexed[ll].val === indexed[kk].val) ll++;
      const avgR = (kk + 1 + ll) / 2;
      for (let mm = kk; mm < ll; mm++) rankByOrig[indexed[mm].origIdx] = avgR;
      kk = ll;
    }

    let r1 = 0;
    for (let k = 0; k < n1; k++) r1 += rankByOrig[k];
    const u1 = r1 - (n1 * (n1 + 1)) / 2;
    const u2 = n1 * n2 - u1;
    return Math.min(u1, u2);
  }

  const bootstrapStats = new Float64Array(B);
  const tasks = Array.from({ length: B }, (_, idx) =>
    Promise.resolve().then(() => {
      // Permute combined pool and take first n1 as group 1.
      const perm = combinedPool.slice();
      _shuffle(perm, rng);
      bootstrapStats[idx] = _mwUFromPermutation(perm);
    })
  );
  await Promise.all(tasks);

  let countGe = 0;
  for (let i2 = 0; i2 < B; i2++) {
    if (bootstrapStats[i2] >= U) countGe++;
  }
  const pValueEmpirical = countGe / B;
  const { bootstrapMean, bootstrapStd } = _bootstrapSummary(bootstrapStats);

  return {
    uStatistic: U,
    pValueEmpirical,
    bootstrapStatistics: bootstrapStats,
    bootstrapMean,
    bootstrapStd,
  } satisfies MWBootstrapResult;
}

// =============================================================================
// shapiroWilkTest
// =============================================================================

/**
 * Shapiro-Wilk test for normality.
 *
 * Tests the null hypothesis that the data is normally distributed.
 * Implementation uses the simplified algorithm for sample sizes up to 5000.
 *
 * Worker dispatch (Slice 3.10): When `sample.length >= 4096`, the sort stays
 * on the main thread but the W-statistic numerator dot-product
 * `dot(coefficients, sorted_values)` is computed via the pool.
 *
 * @param sample - Array of observations (3 to 5000 elements)
 * @param opts   - Optional bootstrap settings
 * @returns Shapiro-Wilk test result
 *
 * @example
 * shapiroWilkTest([1, 2, 3, 4, 5])
 * shapiroWilkTest(data, { bootstrap: 100, bootstrapSeed: 42 })
 */
export async function shapiroWilkTest(
  sample: f64[],
  opts?: BootstrapOptions
): Promise<ShapiroWilkResult | SWBootstrapResult> {
  const n = sample.length;
  if (n < 3) throw new Error('shapiroWilkTest: need at least 3 observations');
  if (n > 5000) throw new Error('shapiroWilkTest: maximum 5000 observations');

  // Sort — WASM-accelerated above WASM_SORT_THRESHOLD (16 K elements).
  const sorted = new Float64Array(n);
  for (let k = 0; k < n; k++) sorted[k] = sample[k];
  sortF64Dispatch(sorted);

  const m = _mean(Array.from(sorted));

  // Compute S^2
  let ss = 0;
  for (const x of sorted) ss += (x - m) ** 2;

  if (ss === 0) {
    // All values identical — return early (bootstrap undefined for constant data)
    const baseResult: ShapiroWilkResult = { statistic: 1, pValue: 1 };
    return baseResult;
  }

  // Shapiro-Wilk coefficients per Royston (1995), algorithm AS R94: Blom expected
  // normal order statistics m_i, with polynomial-corrected tail weights a_n (and
  // a_{n-1} for n > 5) and φ-renormalized interior. The former plain-Blom
  // normalization (a = m/‖m‖, no tail correction) biased W low — 0.9014 vs
  // scipy's 0.9166 on an 8-point sample, a 1.7% error in a published statistic.
  const aArr: f64[] = new Array(n).fill(0);
  if (n === 3) {
    // Exact for n = 3: a = (−1/√2, 0, 1/√2).
    aArr[0] = -Math.SQRT1_2;
    aArr[2] = Math.SQRT1_2;
  } else {
    const mArr: f64[] = new Array(n);
    let mm = 0;
    for (let i = 0; i < n; i++) {
      const mi = _approxProbit((i + 1 - 0.375) / (n + 0.25));
      mArr[i] = mi;
      mm += mi * mi;
    }
    const u = 1 / Math.sqrt(n);
    const rmm = Math.sqrt(mm);
    const an =
      -2.706056 * u ** 5 +
      4.434685 * u ** 4 -
      2.07119 * u ** 3 -
      0.147981 * u * u +
      0.221157 * u +
      mArr[n - 1] / rmm;
    if (n > 5) {
      const an1 =
        -3.582633 * u ** 5 +
        5.682633 * u ** 4 -
        1.752461 * u ** 3 -
        0.293762 * u * u +
        0.042981 * u +
        mArr[n - 2] / rmm;
      const phi =
        (mm - 2 * mArr[n - 1] ** 2 - 2 * mArr[n - 2] ** 2) / (1 - 2 * an * an - 2 * an1 * an1);
      const rphi = Math.sqrt(phi);
      for (let i = 2; i < n - 2; i++) aArr[i] = mArr[i] / rphi;
      aArr[n - 1] = an;
      aArr[0] = -an;
      aArr[n - 2] = an1;
      aArr[1] = -an1;
    } else {
      const phi = (mm - 2 * mArr[n - 1] ** 2) / (1 - 2 * an * an);
      const rphi = Math.sqrt(phi);
      for (let i = 1; i < n - 1; i++) aArr[i] = mArr[i] / rphi;
      aArr[n - 1] = an;
      aArr[0] = -an;
    }
  }

  const aF64 = new Float64Array(aArr);

  let b: f64;

  // --- Worker-dispatch path: parallel dot(a, sorted) -------------------------
  if (n >= HYPOTHESIS_THRESHOLD && computePool.shouldParallelize(n, 'shapiroWilkTest')) {
    const dotResult = await computePool.dot(aF64, sorted);
    b = dotResult.result;
  } else {
    // --- Sequential fallback -------------------------------------------------
    b = 0;
    for (let idx = 0; idx < n; idx++) b += aF64[idx] * sorted[idx];
  }

  const W = (b * b) / ss;

  // p-value per Royston (1995) AS R94, branched on n. (The former constants
  // −1.2725 + 1.0521·ln n were the Shapiro-FRANCIA normalization, not the
  // Shapiro-Wilk one — wrong test's transform.)
  let pValue: f64;
  if (n === 3) {
    // Exact small-sample distribution: p = (6/π)(asin(√W) − asin(√¾)).
    pValue = (6 / Math.PI) * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75)));
  } else if (n <= 11) {
    const g = -2.273 + 0.459 * n;
    const arg = g - Math.log(1 - W);
    if (arg <= 0) {
      pValue = 0; // extreme non-normality — transform out of domain
    } else {
      const mu1 = 0.544 - 0.39978 * n + 0.025054 * n * n - 0.0006714 * n ** 3;
      const sigma1 = Math.exp(1.3822 - 0.77857 * n + 0.062767 * n * n - 0.0020322 * n ** 3);
      pValue = 1 - _normalCDF((-Math.log(arg) - mu1) / sigma1);
    }
  } else {
    const lnN = Math.log(n);
    const mu1 = -1.5861 - 0.31082 * lnN - 0.083751 * lnN * lnN + 0.0038915 * lnN ** 3;
    const sigma1 = Math.exp(-0.4803 - 0.082676 * lnN + 0.0030302 * lnN * lnN);
    pValue = 1 - _normalCDF((Math.log(1 - W) - mu1) / sigma1);
  }

  const baseResult: ShapiroWilkResult = { statistic: W, pValue: Math.max(0, Math.min(1, pValue)) };

  // --- Bootstrap path (Slice 5.11) ------------------------------------------
  const B = opts?.bootstrap ?? 0;
  if (B <= 0) return baseResult;

  const rng = opts?.bootstrapSeed !== undefined ? _makeMulberry32(opts.bootstrapSeed) : Math.random;

  /**
   * Compute the Shapiro-Wilk W statistic for a resample of `sorted`.
   * The resample is drawn with replacement from the original sorted data.
   */
  function _swBootstrapOnce(): f64 {
    const resample = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      resample[i] = sorted[Math.floor(rng() * n)];
    }
    resample.sort();

    let mR = 0;
    for (let i = 0; i < n; i++) mR += resample[i];
    mR /= n;

    let ssR = 0;
    for (let i = 0; i < n; i++) ssR += (resample[i] - mR) ** 2;
    if (ssR === 0) return 1;

    let bR = 0;
    for (let idx = 0; idx < n; idx++) bR += aF64[idx] * resample[idx];
    return (bR * bR) / ssR;
  }

  const bootstrapStats = new Float64Array(B);
  const tasks = Array.from({ length: B }, (_, idx) =>
    Promise.resolve().then(() => {
      bootstrapStats[idx] = _swBootstrapOnce();
    })
  );
  await Promise.all(tasks);

  // Small W → non-normal, so empirical p-value = fraction of resampled W ≤ base W
  let countLe = 0;
  for (let i = 0; i < B; i++) {
    if (bootstrapStats[i] <= W) countLe++;
  }
  const pValueEmpirical = countLe / B;
  const { bootstrapMean, bootstrapStd } = _bootstrapSummary(bootstrapStats);

  return {
    statistic: W,
    pValueEmpirical,
    bootstrapStatistics: bootstrapStats,
    bootstrapMean,
    bootstrapStd,
  } satisfies SWBootstrapResult;
}

/**
 * Approximate inverse normal CDF (probit function).
 */
function _approxProbit(p: f64): f64 {
  // Rational approximation (Beasley-Springer-Moro)
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: f64;
  let r: f64;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

// =============================================================================
// principalComponentAnalysis
// =============================================================================

/**
 * Principal Component Analysis (PCA).
 *
 * Reduces dimensionality of data by finding the directions of maximum variance.
 *
 * @param data - 2D array where each row is an observation, each column a variable
 * @param k - Number of principal components to keep (default: all)
 * @returns PCA result with components, explained variance ratios, and scores
 *
 * @example
 * const result = principalComponentAnalysis([[1, 2], [3, 4], [5, 6]], 1);
 * result.components  // [[0.707, 0.707]]
 * result.explained   // [1.0]
 */
export function principalComponentAnalysis(data: f64[][], k?: number): PCAResult {
  const n = data.length;
  if (n < 2) throw new Error('principalComponentAnalysis: need at least 2 observations');
  const p = data[0].length;
  if (p < 1) throw new Error('principalComponentAnalysis: need at least 1 variable');
  const nComp = k !== undefined ? Math.min(k, p) : p;

  // Center the data
  const means: f64[] = new Array(p).fill(0);
  for (let j = 0; j < p; j++) {
    for (let i = 0; i < n; i++) means[j] += data[i][j];
    means[j] /= n;
  }

  const centered: f64[][] = data.map((row) => row.map((v, j) => v - means[j]));

  // Compute covariance matrix (p x p)
  const cov: f64[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    for (let j = i; j < p; j++) {
      let sum = 0;
      for (let r = 0; r < n; r++) sum += centered[r][i] * centered[r][j];
      cov[i][j] = sum / (n - 1);
      cov[j][i] = cov[i][j];
    }
  }

  // Power iteration for eigenvalues/eigenvectors
  const eigenvalues: f64[] = [];
  const eigenvectors: f64[][] = [];
  const A: f64[][] = cov.map((row) => [...row]);

  for (let comp = 0; comp < nComp; comp++) {
    // Power iteration
    let v: f64[] = new Array(p).fill(0);
    v[comp % p] = 1; // initial guess

    for (let iter = 0; iter < 300; iter++) {
      // Matrix-vector multiply: Av
      const Av: f64[] = new Array(p).fill(0);
      for (let i = 0; i < p; i++) {
        for (let j = 0; j < p; j++) {
          Av[i] += A[i][j] * v[j];
        }
      }

      // Normalize
      let norm = 0;
      for (let i = 0; i < p; i++) norm += Av[i] * Av[i];
      norm = Math.sqrt(norm);
      if (norm === 0) break;

      const vNew = Av.map((x) => x / norm);

      // Check convergence
      let diff = 0;
      for (let i = 0; i < p; i++) diff += (vNew[i] - v[i]) ** 2;
      v = vNew;
      if (diff < 1e-20) break;
    }

    // Eigenvalue = v^T A v
    let eigenvalue = 0;
    for (let i = 0; i < p; i++) {
      let row = 0;
      for (let j = 0; j < p; j++) row += A[i][j] * v[j];
      eigenvalue += v[i] * row;
    }

    eigenvalues.push(eigenvalue);
    eigenvectors.push(v);

    // Deflate: A = A - lambda * v * v^T
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) {
        A[i][j] -= eigenvalue * v[i] * v[j];
      }
    }
  }

  // Explained variance ratios — use trace of full covariance matrix so that
  // ratios are correct even when k < p (partial extraction).
  let totalVar = 0;
  for (let i = 0; i < p; i++) totalVar += cov[i][i];
  const explained = eigenvalues.map((ev) => (totalVar > 0 ? Math.abs(ev) / totalVar : 0));

  // Project data onto components (scores)
  const scores: f64[][] = centered.map((row) => {
    return eigenvectors.map((ev) => {
      let dot = 0;
      for (let j = 0; j < p; j++) dot += row[j] * ev[j];
      return dot;
    });
  });

  return { components: eigenvectors, explained, scores };
}

// =============================================================================
// kolmogorovSmirnov2Test — two-sample KS (Wave 1, GC-stats completeness)
// =============================================================================

/**
 * Survival function of the limiting Kolmogorov distribution (`kstwobign` in
 * scipy): Q(x) = 2 Σ_{k=1}^∞ (-1)^(k-1) e^(-2 k² x²), clamped to [0, 1]. This is
 * the large-sample asymptotic used for the two-sample KS p-value.
 */
function _kstwobignSf(x: f64): f64 {
  if (x <= 0) return 1;
  let sum = 0;
  for (let k = 1; k <= 100; k++) {
    const term = 2 * (k % 2 === 1 ? 1 : -1) * Math.exp(-2 * k * k * x * x);
    sum += term;
    if (Math.abs(term) < 1e-15) break;
  }
  return Math.max(0, Math.min(1, sum));
}

/**
 * Exact two-sample KS p-value (Kim & Jennrich 1970 lattice-path method,
 * matching `scipy.stats.ks_2samp(..., method='exact')`): count the paths from
 * (0,0) to (n1,n2) — each step advancing one sample's empirical CDF by one
 * observation — whose max deviation |i/n1 - j/n2| never reaches `D`. The
 * p-value is `1 - (paths staying strictly inside the D-band) / C(n1+n2, n1)`.
 * A small epsilon guards the floating-point boundary comparison so a path
 * that reaches exactly `D` counts as "outside" (as extreme as observed).
 */
function _ks2ExactPValue(n1: number, n2: number, D: f64): f64 {
  const eps = 1e-9;
  const dp: Float64Array[] = Array.from({ length: n1 + 1 }, () => new Float64Array(n2 + 1));
  dp[0][0] = 1;
  for (let i = 0; i <= n1; i++) {
    for (let j = 0; j <= n2; j++) {
      if (i === 0 && j === 0) continue;
      const dev = Math.abs(i / n1 - j / n2);
      if (dev >= D - eps) continue; // leave at 0 — outside the band
      let v = 0;
      if (i > 0) v += dp[i - 1][j];
      if (j > 0) v += dp[i][j - 1];
      dp[i][j] = v;
    }
  }
  const total = _binomCoeff(n1 + n2, n1);
  const inside = dp[n1][n2];
  return Math.max(0, Math.min(1, 1 - inside / total));
}

/** Options for {@link kolmogorovSmirnov2Test}. */
export interface KS2Options {
  /**
   * `'asymp'` (default): large-sample `kstwobign` asymptotic p-value —
   * unchanged from the original implementation, so omitting `opts` entirely
   * preserves the exact prior behavior.
   * `'exact'`: exact lattice-path p-value (Kim & Jennrich), matching
   * `scipy.stats.ks_2samp(..., method='exact')`.
   * `'auto'`: exact when n1*n2 <= 10000, else asymptotic (scipy's own
   * threshold for switching to the asymptotic approximation).
   */
  method?: 'auto' | 'exact' | 'asymp';
}

/**
 * Two-sample Kolmogorov–Smirnov test: are two samples drawn from the same
 * continuous distribution? The statistic is the maximum gap between the two
 * empirical CDFs, D = maxₓ |F₁(x) − F₂(x)|. By default the p-value is the
 * large-sample asymptotic Q(√(n₁n₂/(n₁+n₂))·D) (the `kstwobign` survival
 * function, matching scipy's asymptotic method) — this default is unchanged
 * from before Phase 4. Pass `{ method: 'exact' }` to opt into the exact
 * lattice-path p-value instead (`scipy.stats.ks_2samp(..., method='exact')`).
 * Distinct from the one-sample {@link kolmogorovSmirnovTest}, which compares
 * one sample to a CDF *function*.
 *
 * @param sample1 - first sample (non-empty)
 * @param sample2 - second sample (non-empty)
 * @param opts    - `{ method: 'auto' | 'exact' | 'asymp' }` (default 'asymp')
 * @returns `{ statistic: D, pValue }`
 *
 * @example
 * kolmogorovSmirnov2Test([0.1, 0.4, 0.6], [0.3, 0.5, 0.9]) // { statistic, pValue } (asymptotic)
 * kolmogorovSmirnov2Test(a, b, { method: 'exact' }) // exact lattice-path p-value
 */
export function kolmogorovSmirnov2Test(
  sample1: f64[],
  sample2: f64[],
  opts?: KS2Options
): KSTestResult {
  const n1 = sample1.length;
  const n2 = sample2.length;
  if (n1 < 1 || n2 < 1) {
    throw new Error('kolmogorovSmirnov2Test: both samples must be non-empty');
  }
  const a = sample1.slice().sort((x, y) => x - y);
  const b = sample2.slice().sort((x, y) => x - y);

  // Merge-walk the two sorted samples, advancing past all ties at each distinct
  // value so the empirical-CDF comparison is evaluated only at step points.
  let i = 0;
  let j = 0;
  let d = 0;
  while (i < n1 && j < n2) {
    const x = Math.min(a[i], b[j]);
    while (i < n1 && a[i] <= x) i++;
    while (j < n2 && b[j] <= x) j++;
    d = Math.max(d, Math.abs(i / n1 - j / n2));
  }

  const method = opts?.method;
  const useExact = method === 'exact' || (method === 'auto' && n1 * n2 <= 10000);
  if (useExact) {
    return { statistic: d, pValue: _ks2ExactPValue(n1, n2, d) };
  }

  // Default ('asymp', or opts omitted entirely) — unchanged prior behavior.
  const en = Math.sqrt((n1 * n2) / (n1 + n2));
  return { statistic: d, pValue: _kstwobignSf(en * d) };
}

// =============================================================================
// leveneTest / bartlettTest — variance homogeneity (Wave 2)
// =============================================================================

/** Median of an array (sorted copy; average of the two middles when even). */
function _median(arr: f64[]): f64 {
  const s = arr.slice().sort((a, b) => a - b);
  const n = s.length;
  const m = n >> 1;
  return n % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Variance-homogeneity test result. `degreesOfFreedom` is `[d1, d2]` for the
 *  F-based Levene test, a single number for the χ²-based Bartlett test. */
export interface VarianceTestResult {
  statistic: f64;
  pValue: f64;
  degreesOfFreedom: number | [number, number];
}

/**
 * Levene's test for equality of variances across ≥2 groups (the ANOVA
 * prerequisite). Robust to non-normality — it runs a one-way ANOVA F-test on the
 * absolute deviations from each group's center. `center` defaults to `'median'`
 * (the Brown–Forsythe variant, scipy's default); `'mean'` gives the original
 * Levene test. Pinned to `scipy.stats.levene`.
 *
 * @example leveneTest([[8.1,8.3,7.9],[9.1,9.5,8.9]]) // { statistic, pValue, degreesOfFreedom }
 */
export function leveneTest(
  groups: f64[][],
  center: 'median' | 'mean' = 'median'
): VarianceTestResult {
  const k = groups.length;
  if (k < 2) throw new Error('leveneTest: need at least 2 groups');
  let N = 0;
  for (const g of groups) {
    if (g.length < 1) throw new Error('leveneTest: every group must be non-empty');
    N += g.length;
  }
  // z_ij = |x_ij − center_i|, then a one-way ANOVA F on the z's.
  const z = groups.map((g) => {
    const c = center === 'median' ? _median(g) : _mean(g);
    return g.map((x) => Math.abs(x - c));
  });
  const allZ: f64[] = [];
  for (const zi of z) for (const v of zi) allZ.push(v);
  const zBarAll = _mean(allZ);
  let num = 0;
  let den = 0;
  for (const zi of z) {
    const zBarI = _mean(zi);
    num += zi.length * (zBarI - zBarAll) * (zBarI - zBarAll);
    for (const v of zi) den += (v - zBarI) * (v - zBarI);
  }
  const W = ((N - k) / (k - 1)) * (num / den);
  return { statistic: W, pValue: _fPValue(W, k - 1, N - k), degreesOfFreedom: [k - 1, N - k] };
}

/**
 * Bartlett's test for equality of variances across ≥2 groups. More powerful than
 * Levene when the data are normal, but sensitive to departures from normality.
 * Statistic is χ²-distributed with k−1 df. Pinned to `scipy.stats.bartlett`.
 *
 * @example bartlettTest([[8.1,8.3,7.9],[9.1,9.5,8.9]]) // { statistic, pValue, degreesOfFreedom }
 */
export function bartlettTest(groups: f64[][]): VarianceTestResult {
  const k = groups.length;
  if (k < 2) throw new Error('bartlettTest: need at least 2 groups');
  let N = 0;
  for (const g of groups) {
    if (g.length < 2) throw new Error('bartlettTest: every group needs ≥2 observations');
    N += g.length;
  }
  let pooledNum = 0;
  let sumLnVar = 0;
  let sumInv = 0;
  for (const g of groups) {
    const ni = g.length;
    const si2 = _variance(g, 1); // sample variance (ddof=1)
    pooledNum += (ni - 1) * si2;
    sumLnVar += (ni - 1) * Math.log(si2);
    sumInv += 1 / (ni - 1);
  }
  const sp2 = pooledNum / (N - k);
  const numerator = (N - k) * Math.log(sp2) - sumLnVar;
  const C = 1 + (sumInv - 1 / (N - k)) / (3 * (k - 1));
  const T = numerator / C;
  return { statistic: T, pValue: _chiSquaredPValue(T, k - 1), degreesOfFreedom: k - 1 };
}

// =============================================================================
// Wave 4 — paired t-test, proportion z-test, binomial test
// =============================================================================

/**
 * Paired (dependent-samples) t-test: tests whether the mean of the paired
 * differences x−y is zero. Distinct from the two-sample Welch test in
 * {@link studentTTest}, which assumes independent samples. Pinned to
 * `scipy.stats.ttest_rel`.
 *
 * @example studentTTestPaired([1.2,2.3,3.1], [1.0,2.0,3.5]) // { statistic, pValue, degreesOfFreedom }
 */
export function studentTTestPaired(sample1: f64[], sample2: f64[]): TTestResult {
  const n = sample1.length;
  if (n < 2 || sample2.length !== n) {
    throw new Error('studentTTestPaired: samples must be the same length ≥ 2');
  }
  const d = sample1.map((x, i) => x - sample2[i]);
  const dBar = _mean(d);
  const sd = Math.sqrt(_variance(d, 1));
  const df = n - 1;
  const t = dBar / (sd / Math.sqrt(n));
  return { statistic: t, pValue: _tPValue(t, df), degreesOfFreedom: df };
}

/** z-test result (statistic + two-tailed p-value). */
export interface ProportionZResult {
  statistic: f64;
  pValue: f64;
}

/**
 * Proportion z-test (large-sample, two-tailed).
 * - **One-sample**: `proportionZTest(successes, n, p0)` tests p̂ = successes/n
 *   against a hypothesized proportion `p0`.
 * - **Two-sample**: `proportionZTest([s1, s2], [n1, n2])` tests p̂₁ = p̂₂ using
 *   the pooled-variance z (equivalent to `statsmodels.proportions_ztest`).
 *
 * @example proportionZTest(40, 100, 0.5)        // one-sample: z=-2, p≈0.0455
 * @example proportionZTest([40, 30], [100, 100]) // two-sample: z≈1.482, p≈0.138
 */
export function proportionZTest(
  count: number | [number, number],
  nobs: number | [number, number],
  value?: number
): ProportionZResult {
  let z: f64;
  if (Array.isArray(count) && Array.isArray(nobs)) {
    const [c1, c2] = count;
    const [n1, n2] = nobs;
    const p1 = c1 / n1;
    const p2 = c2 / n2;
    const pPool = (c1 + c2) / (n1 + n2);
    z = (p1 - p2) / Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  } else if (typeof count === 'number' && typeof nobs === 'number') {
    const p0 = value ?? 0.5;
    const pHat = count / nobs;
    z = (pHat - p0) / Math.sqrt((p0 * (1 - p0)) / nobs);
  } else {
    throw new Error('proportionZTest: count and nobs must both be numbers or both be [a, b] pairs');
  }
  // Two-tailed p = 2·(1 − Φ(|z|)) = erfc(|z|/√2); use the accurate erfc
  // (continued-fraction tail, ~1e-15) rather than the ~1e-7 A&S _normalCDF.
  const pValue = erfcScalar(Math.abs(z) / Math.SQRT2);
  return { statistic: z, pValue };
}

/** Exact binomial pmf C(n,k) p^k (1−p)^(n−k) via log-gamma (stable for large n). */
function _binomPmf(k: number, n: number, p: f64): f64 {
  if (k < 0 || k > n) return 0;
  const logC = _lgamma(n + 1) - _lgamma(k + 1) - _lgamma(n - k + 1);
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * Exact binomial test — is the observed success count consistent with success
 * probability `p`? The two-tailed p-value is the total probability of all
 * outcomes no more likely than the observed one (scipy's method-of-small-p).
 * Pinned to `scipy.stats.binomtest`.
 *
 * @example binomialTest(8, 20, 0.5) // { pValue: 0.5034446716 }
 */
export function binomialTest(
  successes: number,
  n: number,
  p: f64 = 0.5
): { statistic: f64; pValue: f64 } {
  if (!Number.isInteger(successes) || !Number.isInteger(n) || successes < 0 || successes > n) {
    throw new Error('binomialTest: successes must be an integer in [0, n]');
  }
  const dObs = _binomPmf(successes, n, p);
  const rel = 1 + 1e-7;
  let pValue = 0;
  for (let k = 0; k <= n; k++) {
    const pk = _binomPmf(k, n, p);
    if (pk <= dObs * rel) pValue += pk;
  }
  return { statistic: successes / n, pValue: Math.min(1, pValue) };
}

// =============================================================================
// Wave E — Anderson-Darling, D'Agostino normaltest, Friedman, two-way ANOVA,
// multiple-comparison correction (statistics gap-closure)
// =============================================================================

/** Biased (population) skewness and Pearson kurtosis of a sample. */
function _skewKurt(a: f64[]): { skew: f64; kurtPearson: f64 } {
  const n = a.length;
  const m = _mean(a);
  let m2 = 0;
  let m3 = 0;
  let m4 = 0;
  for (const v of a) {
    const d = v - m;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  const mu2 = m2 / n;
  return { skew: m3 / n / Math.pow(mu2, 1.5), kurtPearson: m4 / n / (mu2 * mu2) };
}

/** Normality-test result (statistic + p-value). */
export interface NormalityTestResult {
  statistic: f64;
  pValue: f64;
}

/**
 * Anderson-Darling test for normality. Returns the A^2 statistic (matching
 * scipy.stats.anderson, standardized with the ddof=1 sample std) and a p-value
 * from the D'Agostino-Stephens approximation on the small-sample-corrected A^2*.
 */
export function andersonDarlingTest(data: f64[]): NormalityTestResult {
  const n = data.length;
  if (n < 8) throw new Error('andersonDarlingTest: need at least 8 observations');
  const sorted = data.slice().sort((p, q) => p - q);
  const mean = _mean(sorted);
  const s = Math.sqrt(_variance(sorted, 1));
  // Accurate Φ via erfc (the shared _normalCDF is only ~7 digits) so the A²
  // statistic matches scipy to full precision.
  const phi = (z: f64): f64 => 0.5 * erfcScalar(-z / Math.SQRT2);
  let sumTerm = 0;
  for (let i = 0; i < n; i++) {
    const wi = (sorted[i] - mean) / s;
    const wj = (sorted[n - 1 - i] - mean) / s;
    sumTerm += ((2 * (i + 1) - 1) / n) * (Math.log(phi(wi)) + Math.log(1 - phi(wj)));
  }
  const a2 = -n - sumTerm;
  const a2s = a2 * (1 + 0.75 / n + 2.25 / (n * n));
  let p: f64;
  if (a2s < 0.2) p = 1 - Math.exp(-13.436 + 101.14 * a2s - 223.73 * a2s * a2s);
  else if (a2s < 0.34) p = 1 - Math.exp(-8.318 + 42.796 * a2s - 59.938 * a2s * a2s);
  else if (a2s < 0.6) p = Math.exp(0.9177 - 4.279 * a2s - 1.38 * a2s * a2s);
  else if (a2s < 10) p = Math.exp(1.2937 - 5.709 * a2s + 0.0186 * a2s * a2s);
  else p = 0;
  return { statistic: a2, pValue: Math.max(0, Math.min(1, p)) };
}

/**
 * D'Agostino-Pearson omnibus normality test (scipy.stats.normaltest):
 * K2 = Z1^2 + Z2^2 (skew + kurtosis Z-tests), chi-square with 2 df, p = e^(-K2/2).
 */
export function dagostinoTest(data: f64[]): NormalityTestResult {
  const n = data.length;
  if (n < 8) throw new Error('dagostinoTest: need at least 8 observations');
  const { skew, kurtPearson } = _skewKurt(data);
  const y = skew * Math.sqrt(((n + 1) * (n + 3)) / (6 * (n - 2)));
  const beta2 =
    (3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3)) / ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const w2 = -1 + Math.sqrt(2 * (beta2 - 1));
  const delta = 1 / Math.sqrt(0.5 * Math.log(w2));
  const alpha = Math.sqrt(2 / (w2 - 1));
  const yy = y === 0 ? 1 : y;
  const z1 = delta * Math.log(yy / alpha + Math.sqrt((yy / alpha) * (yy / alpha) + 1));
  const E = (3 * (n - 1)) / (n + 1);
  const varb2 = (24 * n * (n - 2) * (n - 3)) / ((n + 1) * (n + 1) * (n + 3) * (n + 5));
  const xx = (kurtPearson - E) / Math.sqrt(varb2);
  const sqrtbeta1 =
    ((6 * (n * n - 5 * n + 2)) / ((n + 7) * (n + 9))) *
    Math.sqrt((6 * (n + 3) * (n + 5)) / (n * (n - 2) * (n - 3)));
  const A = 6 + (8 / sqrtbeta1) * (2 / sqrtbeta1 + Math.sqrt(1 + 4 / (sqrtbeta1 * sqrtbeta1)));
  const term1 = 1 - 2 / (9 * A);
  const denom = 1 + xx * Math.sqrt(2 / (A - 4));
  const term2 = Math.sign(denom) * Math.cbrt((1 - 2 / A) / Math.abs(denom));
  const z2 = (term1 - term2) / Math.sqrt(2 / (9 * A));
  const k2 = z1 * z1 + z2 * z2;
  return { statistic: k2, pValue: Math.exp(-k2 / 2) };
}

/**
 * Friedman test - non-parametric repeated-measures ANOVA across k related
 * groups of the same n blocks. chi-square with k-1 df. scipy.stats.friedmanchisquare.
 */
export function friedmanTest(groups: f64[][]): {
  statistic: f64;
  pValue: f64;
  degreesOfFreedom: number;
} {
  const k = groups.length;
  if (k < 3) throw new Error('friedmanTest: need at least 3 related groups');
  const n = groups[0].length;
  for (const g of groups)
    if (g.length !== n) throw new Error('friedmanTest: all groups must be the same length');
  const rankSums = new Array<number>(k).fill(0);
  let tieCorrection = 0;
  for (let block = 0; block < n; block++) {
    const row = groups.map((g) => g[block]);
    const order = row.map((_, i) => i).sort((i, j) => row[i] - row[j]);
    const ranks = new Array<number>(k);
    for (let i = 0; i < k; ) {
      let j = i;
      while (j < k && row[order[j]] === row[order[i]]) j++;
      const avg = (i + 1 + j) / 2;
      const t = j - i;
      if (t > 1) tieCorrection += t * t * t - t;
      for (let m = i; m < j; m++) ranks[order[m]] = avg;
      i = j;
    }
    for (let g = 0; g < k; g++) rankSums[g] += ranks[g];
  }
  let stat =
    (12 / (n * k * (k + 1))) * rankSums.reduce((acc, rr) => acc + rr * rr, 0) - 3 * n * (k + 1);
  const c = 1 - tieCorrection / (n * k * (k * k - 1));
  if (c !== 0) stat /= c;
  const df = k - 1;
  return { statistic: stat, pValue: _chiSquaredPValue(stat, df), degreesOfFreedom: df };
}

/** One factor's line in a two-way ANOVA table. */
export interface Anova2Effect {
  F: f64;
  pValue: f64;
  degreesOfFreedom: [number, number];
}

/** Balanced two-way (with-replication) ANOVA result. */
export interface Anova2Result {
  factorA: Anova2Effect;
  factorB: Anova2Effect;
  interaction: Anova2Effect;
}

/**
 * Balanced two-way ANOVA with replication. data[i][j] holds the r replicates for
 * level i of factor A x level j of factor B (all cells equal size). Equivalent to
 * MATLAB anova2.
 */
export function anova2(data: f64[][][]): Anova2Result {
  const nA = data.length;
  const nB = data[0].length;
  const r = data[0][0].length;
  if (nA < 2 || nB < 2 || r < 2)
    throw new Error('anova2: need at least 2 levels per factor and 2 replicates');
  const all: f64[] = [];
  for (const row of data) for (const cell of row) for (const v of cell) all.push(v);
  const grand = _mean(all);
  const aMeans = data.map((row) => _mean(row.flat()));
  const bMeans = Array.from({ length: nB }, (_, j) => _mean(data.map((row) => row[j]).flat()));
  const cellMeans = data.map((row) => row.map((cell) => _mean(cell)));
  let ssA = 0;
  for (const am of aMeans) ssA += (am - grand) * (am - grand);
  ssA *= nB * r;
  let ssB = 0;
  for (const bm of bMeans) ssB += (bm - grand) * (bm - grand);
  ssB *= nA * r;
  let ssAB = 0;
  let sse = 0;
  for (let i = 0; i < nA; i++) {
    for (let j = 0; j < nB; j++) {
      const d = cellMeans[i][j] - aMeans[i] - bMeans[j] + grand;
      ssAB += d * d;
      for (const v of data[i][j]) sse += (v - cellMeans[i][j]) * (v - cellMeans[i][j]);
    }
  }
  ssAB *= r;
  const dfA = nA - 1;
  const dfB = nB - 1;
  const dfAB = dfA * dfB;
  const dfE = nA * nB * (r - 1);
  const mse = sse / dfE;
  const fA = ssA / dfA / mse;
  const fB = ssB / dfB / mse;
  const fAB = ssAB / dfAB / mse;
  return {
    factorA: { F: fA, pValue: _fPValue(fA, dfA, dfE), degreesOfFreedom: [dfA, dfE] },
    factorB: { F: fB, pValue: _fPValue(fB, dfB, dfE), degreesOfFreedom: [dfB, dfE] },
    interaction: { F: fAB, pValue: _fPValue(fAB, dfAB, dfE), degreesOfFreedom: [dfAB, dfE] },
  };
}

/**
 * Multiple-comparison p-value correction: bonferroni, holm (step-down), or bh
 * (Benjamini-Hochberg FDR). Matches statsmodels multipletests.
 *
 * Same algorithm as {@link multipleTest} (`../stats/inference-extra.js`) —
 * an equivalent alias kept for backward-compatible naming; both names are
 * supported and always return identical results.
 */
export function multipleComparison(
  pValues: f64[],
  method: 'bonferroni' | 'holm' | 'bh' = 'bh'
): f64[] {
  return multipleTest(pValues, method);
}

// =============================================================================
// Wave G — confidence intervals & resampling (statistics gap-closure)
// =============================================================================

/** A confidence interval with the point estimate it brackets. */
export interface ConfidenceInterval {
  estimate: f64;
  lower: f64;
  upper: f64;
  confidence: f64;
}

/**
 * Confidence interval for the population mean via the Student-t distribution
 * (`scipy.stats.t.interval`). `confidence` defaults to 0.95.
 */
export function meanCI(data: f64[], confidence = 0.95): ConfidenceInterval {
  const n = data.length;
  if (n < 2) throw new Error('meanCI: need at least 2 observations');
  const m = _mean(data);
  const se = Math.sqrt(_variance(data, 1) / n);
  const tcrit = studentTQuantile((1 + confidence) / 2, n - 1);
  return { estimate: m, lower: m - tcrit * se, upper: m + tcrit * se, confidence };
}

/**
 * Wald confidence interval for a binomial proportion (normal approximation).
 * `confidence` defaults to 0.95.
 */
export function proportionCI(successes: number, n: number, confidence = 0.95): ConfidenceInterval {
  if (n <= 0 || successes < 0 || successes > n) {
    throw new Error('proportionCI: require 0 <= successes <= n, n > 0');
  }
  const p = successes / n;
  const z = normalQuantile((1 + confidence) / 2);
  const half = z * Math.sqrt((p * (1 - p)) / n);
  return { estimate: p, lower: p - half, upper: p + half, confidence };
}

/** Options for `bootstrapCI`. */
export interface BootstrapCIOptions {
  confidence?: number;
  resamples?: number;
  seed?: number;
}

/**
 * Percentile bootstrap confidence interval for an arbitrary statistic of a
 * single sample (`scipy.stats.bootstrap`, percentile method). Resampling is
 * deterministic when `seed` is given. Returns the CI plus the observed estimate.
 */
export function bootstrapCI(
  data: f64[],
  statistic: (sample: f64[]) => f64,
  opts: BootstrapCIOptions = {}
): ConfidenceInterval {
  const n = data.length;
  if (n < 2) throw new Error('bootstrapCI: need at least 2 observations');
  const confidence = opts.confidence ?? 0.95;
  const B = opts.resamples ?? 2000;
  const rng = opts.seed !== undefined ? _makeMulberry32(opts.seed) : Math.random;
  const stats = new Float64Array(B);
  const resample = new Array<f64>(n);
  for (let b = 0; b < B; b++) {
    for (let i = 0; i < n; i++) resample[i] = data[Math.floor(rng() * n)];
    stats[b] = statistic(resample);
  }
  stats.sort();
  const loIdx = Math.floor(((1 - confidence) / 2) * B);
  const hiIdx = Math.min(B - 1, Math.ceil((1 - (1 - confidence) / 2) * B) - 1);
  return { estimate: statistic(data), lower: stats[loIdx], upper: stats[hiIdx], confidence };
}

/** Options for `permutationTest`. */
export interface PermutationOptions {
  resamples?: number;
  seed?: number;
}

/**
 * Two-sample permutation test for an arbitrary statistic `statistic(a, b)`.
 * The combined pool is repeatedly shuffled and re-split; the two-tailed p-value
 * is the fraction of permuted statistics at least as extreme (in absolute value)
 * as the observed one (`scipy.stats.permutation_test`). Deterministic with `seed`.
 */
export function permutationTest(
  a: f64[],
  b: f64[],
  statistic: (x: f64[], y: f64[]) => f64,
  opts: PermutationOptions = {}
): { statistic: f64; pValue: f64 } {
  const na = a.length;
  const nb = b.length;
  const B = opts.resamples ?? 2000;
  const rng = opts.seed !== undefined ? _makeMulberry32(opts.seed) : Math.random;
  const observed = statistic(a, b);
  const pool = new Float64Array(na + nb);
  for (let i = 0; i < na; i++) pool[i] = a[i];
  for (let i = 0; i < nb; i++) pool[na + i] = b[i];
  let extreme = 1; // +1 for the observed arrangement (scipy convention)
  for (let p = 0; p < B; p++) {
    _shuffle(pool, rng);
    const x = Array.from(pool.subarray(0, na));
    const y = Array.from(pool.subarray(na));
    if (Math.abs(statistic(x, y)) >= Math.abs(observed) - 1e-12) extreme++;
  }
  return { statistic: observed, pValue: extreme / (B + 1) };
}

// =============================================================================
// Wave H — multivariate: Mahalanobis distance, Hotelling's T^2
// =============================================================================

/** Inverse of a square matrix via Gauss-Jordan elimination with partial pivoting. */
function _matInverse(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-15) throw new Error('matrix inverse: singular matrix');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

/** Quadratic form dᵀ·M·d. */
function _quadForm(d: number[], M: number[][]): f64 {
  const n = d.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    let mi = 0;
    for (let j = 0; j < n; j++) mi += M[i][j] * d[j];
    s += d[i] * mi;
  }
  return s;
}

/**
 * Mahalanobis distance between two vectors `u` and `v` under covariance `cov`:
 * √((u−v)ᵀ Σ⁻¹ (u−v)). Matches `scipy.spatial.distance.mahalanobis(u, v, inv(cov))`
 * (this form takes the covariance directly and inverts it internally).
 *
 * @example mahalanobis([1,2], [2.5,1], [[2,0.5],[0.5,1]]) // 1.8126539343
 */
export function mahalanobis(u: number[], v: number[], cov: number[][]): f64 {
  if (u.length !== v.length || cov.length !== u.length) {
    throw new Error('mahalanobis: u, v, and cov dimensions must match');
  }
  const inv = _matInverse(cov);
  const d = u.map((ui, i) => ui - v[i]);
  return Math.sqrt(_quadForm(d, inv));
}

/** One-sample Hotelling's T² result. */
export interface HotellingResult {
  statistic: f64;
  fStatistic: f64;
  pValue: f64;
  degreesOfFreedom: [number, number];
}

/**
 * One-sample Hotelling's T² test — the multivariate generalization of the
 * one-sample t-test: is the mean vector of `data` (rows = observations, columns
 * = variables) equal to `mu0`? T² = n·(x̄−μ₀)ᵀ S⁻¹ (x̄−μ₀), and
 * F = (n−p)/(p(n−1))·T² ~ F(p, n−p) under H₀.
 *
 * @example hotellingT2(data, [5, 7]) // { statistic, fStatistic, pValue, degreesOfFreedom }
 */
export function hotellingT2(data: f64[][], mu0: f64[]): HotellingResult {
  const n = data.length;
  const p = mu0.length;
  if (n <= p) throw new Error('hotellingT2: need more observations than variables');
  if (data.some((row) => row.length !== p))
    throw new Error('hotellingT2: every row must have length p');
  const xbar = Array.from({ length: p }, (_, j) => _mean(data.map((row) => row[j])));
  // Sample covariance matrix S (ddof=1).
  const S = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (const row of data) {
    for (let i = 0; i < p; i++) {
      for (let j = 0; j < p; j++) S[i][j] += (row[i] - xbar[i]) * (row[j] - xbar[j]);
    }
  }
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) S[i][j] /= n - 1;
  const diff = xbar.map((x, i) => x - mu0[i]);
  const t2 = n * _quadForm(diff, _matInverse(S));
  const f = ((n - p) / (p * (n - 1))) * t2;
  return {
    statistic: t2,
    fStatistic: f,
    pValue: _fPValue(f, p, n - p),
    degreesOfFreedom: [p, n - p],
  };
}

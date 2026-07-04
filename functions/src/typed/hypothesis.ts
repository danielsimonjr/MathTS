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
  let i = 0;
  while (i < nTotal) {
    let j = i;
    while (j < nTotal && combined[j].value === combined[i].value) j++;
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

  // Normal approximation for p-value
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sigma === 0 ? 0 : (U - mu) / sigma;
  const pValue = 2 * _normalCDF(z); // two-tailed

  const baseResult: MannWhitneyResult = { uStatistic: U, pValue: Math.min(1, pValue) };

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

  // Compute approximate Shapiro-Wilk coefficients using Blom's expected normal order statistics
  const aArr: f64[] = new Array(n).fill(0);
  for (let idx = 0; idx < Math.floor(n / 2); idx++) {
    const p = (idx + 1 - 0.375) / (n + 0.25);
    const mi = _approxProbit(p);
    aArr[idx] = mi;
    aArr[n - 1 - idx] = -mi;
  }

  // Normalize coefficients
  let sumA2 = 0;
  for (const ai of aArr) sumA2 += ai * ai;
  const normCoeff = Math.sqrt(sumA2);
  for (let idx = 0; idx < n; idx++) aArr[idx] /= normCoeff;

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

  // Approximate p-value using normal transformation of W (Royston's approximation)
  const lnN = Math.log(n);
  const mu1 = -1.2725 + 1.0521 * lnN;
  const sigma1 = 1.0308 - 0.26758 * lnN;
  const zStat = (Math.log(1 - W) - mu1) / sigma1;
  const pValue = 1 - _normalCDF(zStat);

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

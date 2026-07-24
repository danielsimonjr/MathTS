/**
 * Noncentral distribution CDFs, circular statistics, and paired-categorical
 * tests (Phase 4 Task 4).
 *
 * The noncentral CDFs reuse the existing central-distribution CDFs
 * (`chiSquaredCDF`/`fCDF` — `distribution-functions.ts`) as Poisson-mixture
 * building blocks, mirroring the pattern already established by
 * `noncentralChi2PDF` (`typed/distributions.ts`). No distribution math is
 * duplicated: only the mixture weighting is new.
 */
import { chiSquaredCDF, fCDF } from '../distribution-functions.js';
import { chiSquaredDist, normalDist } from '../typed/dist-objects.js';
import { besselIScalar } from '../wasm/special/scalars.js';

const TWO_PI = 2 * Math.PI;

/**
 * Noncentral chi-squared CDF via the Poisson-mixture representation:
 *
 *   F(x; k, λ) = Σ_{j=0}^∞ Pois(j; λ/2) · chiSquaredCDF(x, k + 2j)
 *
 * Truncated once the cumulative Poisson mass covers `1 − 1e-12` of the total
 * (past the Poisson mode, so truncation never fires during the rising phase).
 *
 * @example
 * noncentralChi2CDF(10, 3, 2); // ~0.89856 (scipy ncx2.cdf)
 */
export function noncentralChi2CDF(x: number, df: number, nc: number): number {
  if (df <= 0) throw new Error('noncentralChi2CDF: df must be positive');
  if (nc < 0) throw new Error('noncentralChi2CDF: nc must be non-negative');
  if (x <= 0) return 0;

  const halfNc = nc / 2;
  let sum = 0;
  let poissonCum = 0;
  let logWeight = -halfNc; // log Pois(0; halfNc)
  for (let j = 0; j < 2000; j++) {
    const weight = Math.exp(logWeight);
    sum += weight * chiSquaredCDF(x, df + 2 * j);
    poissonCum += weight;
    if (j > halfNc && 1 - poissonCum < 1e-12) break;
    logWeight += Math.log(halfNc) - Math.log(j + 1);
  }
  return sum;
}

/**
 * Noncentral F CDF via the Poisson-mixture representation over the numerator
 * degrees of freedom:
 *
 *   F(x; d1, d2, λ) = Σ_{j=0}^∞ Pois(j; λ/2) · fCDF(x·d1/(d1+2j), d1+2j, d2)
 *
 * Truncated the same way as {@link noncentralChi2CDF}.
 *
 * @example
 * noncentralFCDF(2, 3, 10, 4); // ~0.46636 (scipy ncf.cdf)
 */
export function noncentralFCDF(x: number, dfn: number, dfd: number, nc: number): number {
  if (dfn <= 0 || dfd <= 0) throw new Error('noncentralFCDF: dfn and dfd must be positive');
  if (nc < 0) throw new Error('noncentralFCDF: nc must be non-negative');
  if (x <= 0) return 0;

  const halfNc = nc / 2;
  let sum = 0;
  let poissonCum = 0;
  let logWeight = -halfNc;
  for (let j = 0; j < 2000; j++) {
    const weight = Math.exp(logWeight);
    const dfnj = dfn + 2 * j;
    sum += weight * fCDF((x * dfn) / dfnj, dfnj, dfd);
    poissonCum += weight;
    if (j > halfNc && 1 - poissonCum < 1e-12) break;
    logWeight += Math.log(halfNc) - Math.log(j + 1);
  }
  return sum;
}

/**
 * Noncentral Student-t CDF via the mixture representation
 * `T = (Z + δ) / sqrt(V/ν)`, `Z ~ N(0,1)`, `V ~ χ²_ν` independent:
 *
 *   F(t; ν, δ) = E_V[ Φ(t·sqrt(V/ν) − δ) ] = ∫₀^∞ Φ(t·sqrt(v/ν) − δ) · χ²_ν(v) dv
 *
 * Evaluated by composite Simpson's rule over `v` (central-χ² density; `δ`
 * only enters the normal-CDF term). The upper integration bound is set
 * generously past the χ²_ν tail so the truncation error is negligible
 * relative to the ~1e-4 Simpson discretization error at the panel count used.
 *
 * @example
 * noncentralTCDF(1.5, 10, 2); // ~0.30479 (scipy nct.cdf)
 */
export function noncentralTCDF(t: number, df: number, nc: number): number {
  if (df <= 0) throw new Error('noncentralTCDF: df must be positive');

  const chi2 = chiSquaredDist(df);
  const std = normalDist();
  const upper = df + 40 * Math.sqrt(2 * Math.max(df, 1)) + 100;
  const panels = 20000; // even panel count for Simpson's rule
  const a = 1e-10;
  const h = (upper - a) / panels;

  const integrand = (v: number): number => {
    if (v <= 0) return 0;
    const z = t * Math.sqrt(v / df) - nc;
    return std.cdf(z) * chi2.pdf(v);
  };

  let sum = integrand(a) + integrand(upper);
  for (let i = 1; i < panels; i++) {
    const v = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * integrand(v);
  }
  return (h / 3) * sum;
}

/** Options shared by the circular-statistics functions. */
export interface CircularOptions {
  /** Upper bound of the angular range. Default `2π`. */
  high?: number;
  /** Lower bound of the angular range. Default `0`. */
  low?: number;
}

function circularSums(
  angles: readonly number[],
  opts: CircularOptions
): {
  sinSum: number;
  cosSum: number;
  scale: number;
} {
  const { high = TWO_PI, low = 0 } = opts;
  const scale = TWO_PI / (high - low);
  let sinSum = 0;
  let cosSum = 0;
  for (const a of angles) {
    const theta = (a - low) * scale;
    sinSum += Math.sin(theta);
    cosSum += Math.cos(theta);
  }
  return { sinSum, cosSum, scale };
}

/**
 * Circular (angular) mean, mapped back into `[low, high)`.
 *
 * `mean = atan2(Σsinθ, Σcosθ)`, where `θ` is `angles` rescaled into
 * `[0, 2π)` when a non-default `[low, high)` range is given (matching
 * `scipy.stats.circmean`).
 *
 * @example
 * circmean([0.1, 0.2, 6.2]); // ~0.07236 (scipy circmean; wraps near 0)
 */
export function circmean(angles: readonly number[], opts: CircularOptions = {}): number {
  const { low = 0 } = opts;
  const { sinSum, cosSum, scale } = circularSums(angles, opts);
  let mean = Math.atan2(sinSum, cosSum);
  if (mean < 0) mean += TWO_PI;
  return mean / scale + low;
}

/**
 * Circular variance `1 − R`, where `R = |Σcosθ + iΣsinθ| / n` is the mean
 * resultant length. `R ∈ [0, 1]`, so `circvar ∈ [0, 1]`.
 */
export function circvar(angles: readonly number[], opts: CircularOptions = {}): number {
  const n = angles.length;
  if (n === 0) throw new Error('circvar: angles must be non-empty');
  const { sinSum, cosSum } = circularSums(angles, opts);
  const R = Math.hypot(cosSum, sinSum) / n;
  return 1 - R;
}

/**
 * Circular standard deviation `sqrt(−2·ln(R))` (matches `scipy.stats.circstd`
 * with the default `normalize=False` low/high dispersion measure).
 */
export function circstd(angles: readonly number[], opts: CircularOptions = {}): number {
  const n = angles.length;
  if (n === 0) throw new Error('circstd: angles must be non-empty');
  const { sinSum, cosSum } = circularSums(angles, opts);
  const R = Math.hypot(cosSum, sinSum) / n;
  return Math.sqrt(-2 * Math.log(R));
}

/**
 * Von Mises probability density function (the circular analogue of the
 * normal distribution).
 *
 *   f(θ; μ, κ) = exp(κ·cos(θ − μ)) / (2π·I₀(κ))
 *
 * `I₀` is the modified Bessel function of the first kind, order 0
 * (`besselIScalar` — the shared special-function scalar backing the public
 * `besselI`).
 *
 * @example
 * vonMisesPDF(0, 0, 2); // ~0.51589 (scipy vonmises.pdf(0, 2))
 */
export function vonMisesPDF(theta: number, mu: number, kappa: number): number {
  if (kappa < 0) throw new Error('vonMisesPDF: kappa must be non-negative');
  return Math.exp(kappa * Math.cos(theta - mu)) / (TWO_PI * besselIScalar(0, kappa));
}

/** Options for {@link mcnemar}. */
export interface McNemarOptions {
  /** Apply the continuity correction (`|b−c| − 1`). Default `true`. */
  correction?: boolean;
}

/** Result of {@link mcnemar}. */
export interface McNemarResult {
  chi2: number;
  pValue: number;
}

/**
 * McNemar's test for paired nominal data on a 2x2 table
 * `[[a, b], [c, d]]` (only the discordant pairs `b`, `c` matter):
 *
 *   chi2 = (|b − c| − correction)² / (b + c)
 *
 * with the continuity correction (`1`) applied by default, matching
 * `statsmodels.stats.contingency_tables.mcnemar`. `pValue = 1 −
 * chiSquaredCDF(chi2, 1)`.
 *
 * @example
 * mcnemar([[10, 5], [3, 12]], { correction: false }); // { chi2: 0.5, pValue: ... }
 */
export function mcnemar(
  table: readonly (readonly number[])[],
  opts: McNemarOptions = {}
): McNemarResult {
  if (table.length !== 2 || table[0].length !== 2 || table[1].length !== 2) {
    throw new Error('mcnemar: table must be 2x2');
  }
  const b = table[0][1];
  const c = table[1][0];
  const correction = opts.correction !== false;
  const denom = b + c;
  const diff = Math.max(0, Math.abs(b - c) - (correction ? 1 : 0));
  const chi2 = denom > 0 ? (diff * diff) / denom : 0;
  const pValue = 1 - chiSquaredCDF(chi2, 1);
  return { chi2, pValue };
}

/** Result of {@link cochranQ}. */
export interface CochranQResult {
  Q: number;
  pValue: number;
  dof: number;
}

/**
 * Cochran's Q test — the extension of McNemar's test to `k > 2` matched
 * binary treatments. `data` has one row per subject, one column per
 * treatment (0/1 entries).
 *
 *   Q = (k−1)·(k·ΣCⱼ² − N²) / (k·N − ΣRᵢ²)
 *
 * where `Cⱼ` are column sums, `Rᵢ` are row sums, and `N = ΣRᵢ`. `dof = k −
 * 1`; `pValue = 1 − chiSquaredCDF(Q, k−1)`. Matches
 * `statsmodels.stats.contingency_tables.cochrans_q`.
 *
 * @example
 * cochranQ([[1, 1, 0], [1, 0, 0], [1, 1, 1], [0, 1, 0], [1, 1, 0]]);
 */
export function cochranQ(data: readonly (readonly number[])[]): CochranQResult {
  const n = data.length;
  if (n === 0) throw new Error('cochranQ: data must have at least one row');
  const k = data[0].length;
  if (k < 2) throw new Error('cochranQ: need at least 2 treatments (columns)');

  const colSums = new Array<number>(k).fill(0);
  const rowSums = new Array<number>(n).fill(0);
  let N = 0;
  for (let i = 0; i < n; i++) {
    if (data[i].length !== k) throw new Error('cochranQ: data must be rectangular');
    let rowSum = 0;
    for (let j = 0; j < k; j++) {
      colSums[j] += data[i][j];
      rowSum += data[i][j];
    }
    rowSums[i] = rowSum;
    N += rowSum;
  }

  let sumC2 = 0;
  for (let j = 0; j < k; j++) sumC2 += colSums[j] * colSums[j];
  let sumR2 = 0;
  for (let i = 0; i < n; i++) sumR2 += rowSums[i] * rowSums[i];

  const dof = k - 1;
  const denominator = k * N - sumR2;
  const Q = denominator !== 0 ? (dof * (k * sumC2 - N * N)) / denominator : 0;
  const pValue = 1 - chiSquaredCDF(Q, dof);
  return { Q, pValue, dof };
}

/**
 * Standalone distribution CDF / quantile functions (Wave B / bridge C4).
 *
 * The distribution *objects* (`normalDist(μ,σ)`, `chiSquaredDist(k)`, …) already
 * expose `.cdf`/`.quantile`/`.pdf` — backed by the accurate `betainc`/`gammainc`/
 * `erfcScalar` primitives. These free functions are thin wrappers giving the
 * SciPy-style standalone surface (`chi2.cdf(x, k)` → `chiSquaredCDF(x, k)`) and the
 * quantile symmetry the gap analysis flagged (`normalCDF` existed; `normalQuantile`
 * did not). No distribution math is re-implemented here.
 */
import {
  normalDist as normal,
  tDist as studentT,
  chiSquaredDist as chiSquared,
  fDist as fisherF,
  gammaDist as gammaD,
  betaDist as betaD,
} from './typed/dist-objects.js';

/** Standard (or general) normal quantile (inverse CDF). */
export const normalQuantile = (p: number, mu = 0, sigma = 1): number => normal(mu, sigma).quantile(p);

/** Student-t CDF and quantile with `df` degrees of freedom. */
export const studentTCDF = (x: number, df: number): number => studentT(df).cdf(x);
export const studentTQuantile = (p: number, df: number): number => studentT(df).quantile(p);

/** Chi-squared PDF / CDF / quantile with `df` degrees of freedom. */
export const chiSquaredCDF = (x: number, df: number): number => chiSquared(df).cdf(x);
export const chiSquaredQuantile = (p: number, df: number): number => chiSquared(df).quantile(p);

/** F-distribution CDF / quantile with `d1`, `d2` degrees of freedom. */
export const fCDF = (x: number, d1: number, d2: number): number => fisherF(d1, d2).cdf(x);
export const fQuantile = (p: number, d1: number, d2: number): number => fisherF(d1, d2).quantile(p);

/** Gamma CDF / quantile (shape `k`, rate `θ⁻¹`). */
export const gammaCDF = (x: number, shape: number, rate = 1): number => gammaD(shape, rate).cdf(x);
export const gammaQuantile = (p: number, shape: number, rate = 1): number =>
  gammaD(shape, rate).quantile(p);

/** Beta CDF / quantile with shape parameters `a`, `b`. */
export const betaCDF = (x: number, a: number, b: number): number => betaD(a, b).cdf(x);
export const betaQuantile = (p: number, a: number, b: number): number => betaD(a, b).quantile(p);

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

// --- Distribution breadth (Wave D): closed-form heavy-tail / location families ---

/** Cauchy (Lorentz) PDF / CDF / quantile — location `x0`, scale `gamma`. */
export const cauchyPDF = (x: number, x0 = 0, gamma = 1): number =>
  1 / (Math.PI * gamma * (1 + ((x - x0) / gamma) ** 2));
export const cauchyCDF = (x: number, x0 = 0, gamma = 1): number =>
  0.5 + Math.atan((x - x0) / gamma) / Math.PI;
export const cauchyQuantile = (p: number, x0 = 0, gamma = 1): number =>
  x0 + gamma * Math.tan(Math.PI * (p - 0.5));

/** Laplace (double-exponential) PDF / CDF / quantile — location `mu`, scale `b`. */
export const laplacePDF = (x: number, mu = 0, b = 1): number =>
  Math.exp(-Math.abs(x - mu) / b) / (2 * b);
export const laplaceCDF = (x: number, mu = 0, b = 1): number =>
  x < mu ? 0.5 * Math.exp((x - mu) / b) : 1 - 0.5 * Math.exp(-(x - mu) / b);
export const laplaceQuantile = (p: number, mu = 0, b = 1): number =>
  p < 0.5 ? mu + b * Math.log(2 * p) : mu - b * Math.log(2 - 2 * p);

/** Logistic PDF / CDF / quantile — location `mu`, scale `s`. */
export const logisticPDF = (x: number, mu = 0, s = 1): number => {
  const e = Math.exp(-(x - mu) / s);
  return e / (s * (1 + e) ** 2);
};
export const logisticCDF = (x: number, mu = 0, s = 1): number => 1 / (1 + Math.exp(-(x - mu) / s));
export const logisticQuantile = (p: number, mu = 0, s = 1): number =>
  mu + s * Math.log(p / (1 - p));

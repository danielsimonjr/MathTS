/**
 * Maximum-likelihood distribution fitting (Phase 4 Task 1).
 *
 * `fitDistribution(name, data)` fits one of five common distributions to a
 * sample by maximum likelihood and reports the fitted parameters plus the
 * achieved log-likelihood.
 *
 * - `normal`      — closed form: mu = mean, sigma = population std (ddof=0).
 * - `exponential` — closed form: lambda = 1 / mean.
 * - `lognormal`   — fit a normal to ln(data) (requires all data > 0).
 * - `poisson`     — closed form: lambda = mean.
 * - `gamma`       — no closed form for the shape parameter. Given shape k,
 *   the MLE scale is theta = xbar / k; substituting back yields the
 *   1-D shape equation `ln(k) - psi(k) = ln(xbar) - mean(ln x)`
 *   (psi = digamma), solved here with the secant method starting from the
 *   Choi & Wette (1969) initial guess.
 *
 * @packageDocumentation
 */

import { mean as _mean, std as _std } from '../typed/arithmetic.js';
import { digamma as _digamma, lgamma as _lgamma } from '../typed/special.js';
import { secant } from '../numeric/open-root-finders.js';

/** Supported distribution families for {@link fitDistribution}. */
export type DistributionName = 'normal' | 'exponential' | 'lognormal' | 'poisson' | 'gamma';

/** Result of {@link fitDistribution}: fitted parameters + achieved log-likelihood. */
export interface FitDistributionResult {
  /** Fitted parameters, named per distribution (see {@link fitDistribution}). */
  params: Record<string, number>;
  /** Log-likelihood of `data` under the fitted parameters. */
  logLikelihood: number;
}

const LOG_2PI = Math.log(2 * Math.PI);

function meanOf(data: readonly number[]): number {
  return _mean(data as number[]) as number;
}

/** Population standard deviation (ddof = 0), i.e. mathjs 'uncorrected' normalization. */
function popStd(data: readonly number[]): number {
  return _std(data as number[], 'uncorrected') as number;
}

function normalLogPdf(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma;
  return -0.5 * z * z - Math.log(sigma) - 0.5 * LOG_2PI;
}

function fitNormal(data: readonly number[]): FitDistributionResult {
  const mu = meanOf(data);
  const sigma = popStd(data);
  let logLikelihood = 0;
  for (const x of data) logLikelihood += normalLogPdf(x, mu, sigma);
  return { params: { mean: mu, std: sigma }, logLikelihood };
}

function fitExponential(data: readonly number[]): FitDistributionResult {
  const lambda = 1 / meanOf(data);
  let logLikelihood = 0;
  for (const x of data) logLikelihood += Math.log(lambda) - lambda * x;
  return { params: { lambda }, logLikelihood };
}

function fitLognormal(data: readonly number[]): FitDistributionResult {
  for (const x of data) {
    if (!(x > 0)) {
      throw new Error('fitDistribution: lognormal requires all data > 0');
    }
  }
  const logData = data.map((x) => Math.log(x));
  const mu = meanOf(logData);
  const sigma = popStd(logData);
  let logLikelihood = 0;
  for (const x of data) {
    // pdf(x; mu, sigma) = normalPdf(ln x; mu, sigma) / x
    logLikelihood += normalLogPdf(Math.log(x), mu, sigma) - Math.log(x);
  }
  return { params: { mu, sigma }, logLikelihood };
}

function logFactorial(k: number): number {
  return _lgamma(k + 1) as number;
}

function fitPoisson(data: readonly number[]): FitDistributionResult {
  const lambda = meanOf(data);
  let logLikelihood = 0;
  for (const k of data) logLikelihood += -lambda + k * Math.log(lambda) - logFactorial(k);
  return { params: { lambda }, logLikelihood };
}

function gammaLogPdf(x: number, shape: number, scale: number): number {
  return (
    (shape - 1) * Math.log(x) - x / scale - (_lgamma(shape) as number) - shape * Math.log(scale)
  );
}

function fitGamma(data: readonly number[]): FitDistributionResult {
  for (const x of data) {
    if (!(x > 0)) {
      throw new Error('fitDistribution: gamma requires all data > 0');
    }
  }
  const xbar = meanOf(data);
  const meanLog = meanOf(data.map((x) => Math.log(x)));
  // s = ln(xbar) - mean(ln x); Jensen's inequality guarantees s >= 0 for non-degenerate data.
  const s = Math.log(xbar) - meanLog;
  if (!(s > 0)) {
    throw new Error('fitDistribution: gamma requires data with positive spread (s <= 0)');
  }

  // Choi & Wette (1969) initial guess for the shape parameter.
  const k0 = (3 - s + Math.sqrt((s - 3) * (s - 3) + 24 * s)) / (12 * s);

  // Shape equation: ln(k) - psi(k) - s = 0 (monotone decreasing in k for k > 0).
  const f = (k: number): number => Math.log(k) - (_digamma(k) as number) - s;
  const shape = secant(f, k0, k0 * 1.1, { tol: 1e-12, maxIter: 200 });
  const scale = xbar / shape;

  let logLikelihood = 0;
  for (const x of data) logLikelihood += gammaLogPdf(x, shape, scale);
  return { params: { shape, scale }, logLikelihood };
}

/**
 * Fit a distribution to `data` by maximum likelihood.
 *
 * @param name - Distribution family: 'normal' | 'exponential' | 'lognormal' | 'poisson' | 'gamma'
 * @param data - Sample data
 * @returns Fitted parameters and the log-likelihood achieved under them
 *
 * @example
 * fitDistribution('normal', [2, 4, 4, 4, 5, 5, 7, 9]);
 * // { params: { mean: 5, std: 2 }, logLikelihood: ... }
 *
 * fitDistribution('exponential', [1, 2, 3, 2]);
 * // { params: { lambda: 0.5 }, logLikelihood: ... }
 */
export function fitDistribution(
  name: DistributionName,
  data: readonly number[]
): FitDistributionResult {
  if (data.length === 0) {
    throw new Error('fitDistribution: data must be non-empty');
  }
  switch (name) {
    case 'normal':
      return fitNormal(data);
    case 'exponential':
      return fitExponential(data);
    case 'lognormal':
      return fitLognormal(data);
    case 'poisson':
      return fitPoisson(data);
    case 'gamma':
      return fitGamma(data);
    default: {
      const _exhaustive: never = name;
      throw new Error(`fitDistribution: unknown distribution '${_exhaustive as string}'`);
    }
  }
}

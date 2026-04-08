/**
 * Typed Probability Distribution Functions
 *
 * Probability density/mass functions and information-theoretic measures
 * using typed-function for runtime dispatch.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/** 32-bit signed integer */
type i32 = number;

// =============================================================================
// Internal Helpers
// =============================================================================

const SQRT_2PI = Math.sqrt(2 * Math.PI);
const LN2 = Math.log(2);

/**
 * Error function erf(x) using Abramowitz & Stegun rational approximation.
 */
function _erf(x: f64): f64 {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * a);
  const y =
    1.0 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/**
 * Log-factorial using Stirling's approximation for large n,
 * exact lookup for small n.
 */
function _logFactorial(n: i32): f64 {
  if (n < 0) return NaN;
  if (n <= 1) return 0;
  if (n <= 20) {
    // Exact computation for small values
    let result = 0;
    for (let i = 2; i <= n; i++) {
      result += Math.log(i);
    }
    return result;
  }
  // Stirling's approximation
  return (
    0.5 * Math.log(2 * Math.PI * n) +
    n * Math.log(n) -
    n +
    1 / (12 * n) -
    1 / (360 * n * n * n)
  );
}

/**
 * Binomial coefficient C(n, k) computed in log-space.
 */
function _logBinom(n: i32, k: i32): f64 {
  if (k < 0 || k > n) return -Infinity;
  return _logFactorial(n) - _logFactorial(k) - _logFactorial(n - k);
}

// =============================================================================
// Normal Distribution
// =============================================================================

/**
 * Normal (Gaussian) probability density function.
 *
 * PDF(x; mu, sigma) = (1 / (sigma * sqrt(2*pi))) * exp(-(x - mu)^2 / (2*sigma^2))
 *
 * @param x - Value at which to evaluate
 * @param mu - Mean (default 0)
 * @param sigma - Standard deviation (default 1, must be positive)
 * @returns Probability density at x
 *
 * @example
 * normalPDF(0)       // ~0.3989 (standard normal)
 * normalPDF(0, 0, 1) // ~0.3989
 * normalPDF(1, 0, 2) // ~0.1760
 */
export const normalPDF = mathTyped('normalPDF', {
  number: (x: f64): f64 => {
    return Math.exp(-0.5 * x * x) / SQRT_2PI;
  },
  'number, number, number': (x: f64, mu: f64, sigma: f64): f64 => {
    if (sigma <= 0) return NaN;
    const z = (x - mu) / sigma;
    return Math.exp(-0.5 * z * z) / (sigma * SQRT_2PI);
  },
});

/**
 * Normal (Gaussian) cumulative distribution function.
 *
 * CDF(x; mu, sigma) = 0.5 * (1 + erf((x - mu) / (sigma * sqrt(2))))
 *
 * @param x - Value at which to evaluate
 * @param mu - Mean (default 0)
 * @param sigma - Standard deviation (default 1, must be positive)
 * @returns Cumulative probability P(X <= x)
 *
 * @example
 * normalCDF(0)       // 0.5 (standard normal)
 * normalCDF(1.96)    // ~0.975
 */
export const normalCDF = mathTyped('normalCDF', {
  number: (x: f64): f64 => {
    return 0.5 * (1 + _erf(x / Math.SQRT2));
  },
  'number, number, number': (x: f64, mu: f64, sigma: f64): f64 => {
    if (sigma <= 0) return NaN;
    return 0.5 * (1 + _erf((x - mu) / (sigma * Math.SQRT2)));
  },
});

// =============================================================================
// Exponential Distribution
// =============================================================================

/**
 * Exponential probability density function.
 *
 * PDF(x; lambda) = lambda * exp(-lambda * x) for x >= 0.
 *
 * @param x - Value at which to evaluate
 * @param lambda - Rate parameter (positive)
 * @returns Probability density at x
 *
 * @example
 * exponentialPDF(1, 1) // ~0.3679
 * exponentialPDF(0, 2) // 2
 */
export const exponentialPDF = mathTyped('exponentialPDF', {
  'number, number': (x: f64, lambda: f64): f64 => {
    if (lambda <= 0) return NaN;
    if (x < 0) return 0;
    return lambda * Math.exp(-lambda * x);
  },
});

/**
 * Exponential cumulative distribution function.
 *
 * CDF(x; lambda) = 1 - exp(-lambda * x) for x >= 0.
 *
 * @param x - Value at which to evaluate
 * @param lambda - Rate parameter (positive)
 * @returns Cumulative probability P(X <= x)
 *
 * @example
 * exponentialCDF(1, 1) // ~0.6321
 */
export const exponentialCDF = mathTyped('exponentialCDF', {
  'number, number': (x: f64, lambda: f64): f64 => {
    if (lambda <= 0) return NaN;
    if (x < 0) return 0;
    return 1 - Math.exp(-lambda * x);
  },
});

// =============================================================================
// Poisson Distribution
// =============================================================================

/**
 * Poisson probability mass function.
 *
 * PMF(k; lambda) = e^(-lambda) * lambda^k / k!
 *
 * Computed in log-space to avoid overflow for large k or lambda.
 *
 * @param k - Number of events (non-negative integer)
 * @param lambda - Expected number of events (positive)
 * @returns Probability of exactly k events
 *
 * @example
 * poissonPMF(3, 2.5) // ~0.2138
 * poissonPMF(0, 1)   // ~0.3679
 */
export const poissonPMF = mathTyped('poissonPMF', {
  'number, number': (k: i32, lambda: f64): f64 => {
    if (lambda < 0 || k < 0 || !Number.isInteger(k)) return NaN;
    if (lambda === 0) return k === 0 ? 1 : 0;
    return Math.exp(-lambda + k * Math.log(lambda) - _logFactorial(k));
  },
});

// =============================================================================
// Binomial Distribution
// =============================================================================

/**
 * Binomial probability mass function.
 *
 * PMF(k; n, p) = C(n, k) * p^k * (1-p)^(n-k)
 *
 * Computed in log-space to avoid overflow.
 *
 * @param k - Number of successes (0 <= k <= n)
 * @param n - Number of trials (positive integer)
 * @param p - Probability of success (0 <= p <= 1)
 * @returns Probability of exactly k successes
 *
 * @example
 * binomialPMF(3, 10, 0.5) // ~0.1172
 * binomialPMF(0, 5, 0.3)  // ~0.1681
 */
export const binomialPMF = mathTyped('binomialPMF', {
  'number, number, number': (k: i32, n: i32, p: f64): f64 => {
    if (!Number.isInteger(k) || !Number.isInteger(n)) return NaN;
    if (k < 0 || k > n || p < 0 || p > 1 || n < 0) return NaN;
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    return Math.exp(_logBinom(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  },
});

// =============================================================================
// Geometric Distribution
// =============================================================================

/**
 * Geometric probability mass function.
 *
 * PMF(k; p) = (1-p)^(k-1) * p for k = 1, 2, 3, ...
 *
 * Models the number of trials until the first success.
 *
 * @param k - Trial number of first success (positive integer)
 * @param p - Probability of success (0 < p <= 1)
 * @returns Probability that first success occurs on trial k
 *
 * @example
 * geometricPMF(1, 0.5) // 0.5
 * geometricPMF(3, 0.5) // 0.125
 */
export const geometricPMF = mathTyped('geometricPMF', {
  'number, number': (k: i32, p: f64): f64 => {
    if (!Number.isInteger(k) || k < 1 || p <= 0 || p > 1) return NaN;
    return Math.pow(1 - p, k - 1) * p;
  },
});

// =============================================================================
// Bernoulli Distribution
// =============================================================================

/**
 * Bernoulli probability mass function.
 *
 * PMF(k; p) = p if k = 1, (1 - p) if k = 0.
 *
 * @param k - Outcome (0 or 1)
 * @param p - Probability of success (0 <= p <= 1)
 * @returns Probability of outcome k
 *
 * @example
 * bernoulliPMF(1, 0.7) // 0.7
 * bernoulliPMF(0, 0.7) // 0.3
 */
export const bernoulliPMF = mathTyped('bernoulliPMF', {
  'number, number': (k: i32, p: f64): f64 => {
    if (p < 0 || p > 1) return NaN;
    if (k === 1) return p;
    if (k === 0) return 1 - p;
    return NaN;
  },
});

// =============================================================================
// Shannon Entropy
// =============================================================================

/**
 * Shannon entropy of a discrete probability distribution.
 *
 * H(P) = -sum(p_i * log2(p_i)) for all p_i > 0.
 *
 * @param probs - Array of probabilities (should sum to 1)
 * @returns Entropy in bits
 *
 * @example
 * entropy([0.5, 0.5])         // 1.0 (maximum for 2 outcomes)
 * entropy([0.25, 0.25, 0.25, 0.25]) // 2.0
 * entropy([1, 0])             // 0.0 (certain outcome)
 */
export const entropy = mathTyped('entropy', {
  'Array': (probs: f64[]): f64 => {
    let h = 0;
    for (const p of probs) {
      if (p < 0) return NaN;
      if (p > 0) {
        h -= p * Math.log(p) / LN2;
      }
    }
    return h;
  },
});

// =============================================================================
// Jensen-Shannon Divergence
// =============================================================================

/**
 * Jensen-Shannon divergence between two probability distributions.
 *
 * JSD(P || Q) = 0.5 * KL(P || M) + 0.5 * KL(Q || M) where M = 0.5*(P + Q).
 *
 * Always non-negative and symmetric. Returns value in bits (base 2).
 *
 * @param p - First probability distribution
 * @param q - Second probability distribution (same length as p)
 * @returns Jensen-Shannon divergence in bits
 *
 * @example
 * jsDivergence([0.5, 0.5], [0.5, 0.5]) // 0 (identical)
 * jsDivergence([1, 0], [0, 1])          // 1.0 (maximum for 2 bins)
 */
export const jsDivergence = mathTyped('jsDivergence', {
  'Array, Array': (p: f64[], q: f64[]): f64 => {
    if (p.length !== q.length) return NaN;
    let jsd = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] < 0 || q[i] < 0) return NaN;
      const m = 0.5 * (p[i] + q[i]);
      if (m > 0) {
        if (p[i] > 0) jsd += 0.5 * p[i] * Math.log(p[i] / m) / LN2;
        if (q[i] > 0) jsd += 0.5 * q[i] * Math.log(q[i] / m) / LN2;
      }
    }
    return jsd;
  },
});

// =============================================================================
// Named Export Collection
// =============================================================================

/**
 * All typed probability distribution functions.
 */
export const typedDistributions = {
  normalPDF,
  normalCDF,
  exponentialPDF,
  exponentialCDF,
  poissonPMF,
  binomialPMF,
  geometricPMF,
  bernoulliPMF,
  entropy,
  jsDivergence,
};

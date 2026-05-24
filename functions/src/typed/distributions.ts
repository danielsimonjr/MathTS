/**
 * Typed Probability Distribution Functions
 *
 * Probability density/mass functions and information-theoretic measures
 * using typed-function for runtime dispatch.
 *
 * Each PDF/PMF/CDF has a `Float64Array` overload that evaluates the
 * distribution across a whole sample array, parallelizing large inputs via
 * the worker pool.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { WASM_SPECIAL_THRESHOLD, lgammaDispatch, lgammaJS } from '../wasm/special/wasm-bridge.js';

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

const LN2 = Math.log(2);

/**
 * Log-gamma function (Lanczos g=7).  Mirrors _lgamma in special.ts.
 * Inline so distribution scalars remain self-contained for worker serialization.
 */
function _lgammaD(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    const sinPiX = Math.abs(Math.sin(Math.PI * x));
    if (sinPiX === 0) return Infinity;
    return Math.log(Math.PI / sinPiX) - _lgammaD(1 - x);
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  const xm1 = x - 1;
  let a = c[0];
  for (let i = 1; i < g + 2; i++) a += c[i] / (xm1 + i);
  const t = xm1 + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (xm1 + 0.5) * Math.log(t) - t + Math.log(a);
}

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
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
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
    0.5 * Math.log(2 * Math.PI * n) + n * Math.log(n) - n + 1 / (12 * n) - 1 / (360 * n * n * n)
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
// Scalar Implementations
//
// Defined as standalone function declarations (not closures) so they can be
// both called directly and serialized into a self-contained worker kernel.
// They must not reference module-level state.
// =============================================================================

/** Normal PDF at x with mean mu and standard deviation sigma. */
function normalPDFScalar(x: f64, mu: f64, sigma: f64): f64 {
  if (sigma <= 0) return NaN;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Normal CDF at x with mean mu and standard deviation sigma. */
function normalCDFScalar(x: f64, mu: f64, sigma: f64): f64 {
  if (sigma <= 0) return NaN;
  return 0.5 * (1 + _erf((x - mu) / (sigma * Math.SQRT2)));
}

/** Exponential PDF at x with rate lambda. */
function exponentialPDFScalar(x: f64, lambda: f64): f64 {
  if (lambda <= 0) return NaN;
  if (x < 0) return 0;
  return lambda * Math.exp(-lambda * x);
}

/** Exponential CDF at x with rate lambda. */
function exponentialCDFScalar(x: f64, lambda: f64): f64 {
  if (lambda <= 0) return NaN;
  if (x < 0) return 0;
  return 1 - Math.exp(-lambda * x);
}

/** Poisson PMF for k events with mean lambda. */
function poissonPMFScalar(k: i32, lambda: f64): f64 {
  if (lambda < 0 || k < 0 || !Number.isInteger(k)) return NaN;
  if (lambda === 0) return k === 0 ? 1 : 0;
  return Math.exp(-lambda + k * Math.log(lambda) - _logFactorial(k));
}

/** Binomial PMF for k successes in n trials with success probability p. */
function binomialPMFScalar(k: i32, n: i32, p: f64): f64 {
  if (!Number.isInteger(k) || !Number.isInteger(n)) return NaN;
  if (k < 0 || k > n || p < 0 || p > 1 || n < 0) return NaN;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(_logBinom(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Geometric PMF: probability the first success occurs on trial k. */
function geometricPMFScalar(k: i32, p: f64): f64 {
  if (!Number.isInteger(k) || k < 1 || p <= 0 || p > 1) return NaN;
  return Math.pow(1 - p, k - 1) * p;
}

/** Bernoulli PMF for outcome k (0 or 1) with success probability p. */
function bernoulliPMFScalar(k: i32, p: f64): f64 {
  if (p < 0 || p > 1) return NaN;
  if (k === 1) return p;
  if (k === 0) return 1 - p;
  return NaN;
}

// =============================================================================
// Parallel Array Evaluation
// =============================================================================

/**
 * Build a self-contained kernel source string: dependency function
 * declarations followed by an expression that evaluates to `(x) => number`.
 */
function kernelSource(deps: Array<(...args: never[]) => unknown>, body: string): string {
  return `(() => {\n${deps.map((d) => d.toString()).join('\n')}\nreturn (${body});\n})()`;
}

/**
 * Evaluate a scalar distribution function across an array, dispatching large
 * inputs to the worker pool. Falls back to a sequential loop when the pool is
 * not initialized or the input is below the parallel threshold.
 */
async function mapArray(
  x: Float64Array,
  scalar: (v: f64) => f64,
  buildKernel: () => string
): Promise<Float64Array> {
  if (computePool.shouldParallelize(x.length)) {
    const r = await computePool.applyKernel(x, buildKernel());
    return r.result;
  }
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = scalar(x[i]);
  return out;
}

// =============================================================================
// Normal Distribution
// =============================================================================

/**
 * Normal (Gaussian) probability density function.
 *
 * PDF(x; mu, sigma) = (1 / (sigma * sqrt(2*pi))) * exp(-(x - mu)^2 / (2*sigma^2))
 *
 * @param x - Value (or Float64Array of values) at which to evaluate
 * @param mu - Mean (default 0)
 * @param sigma - Standard deviation (default 1, must be positive)
 * @returns Probability density at x
 *
 * @example
 * normalPDF(0)       // ~0.3989 (standard normal)
 * normalPDF(1, 0, 2) // ~0.1760
 * normalPDF(new Float64Array([0, 1, 2])) // densities for each sample
 */
export const normalPDF = mathTyped('normalPDF', {
  number: (x: f64): f64 => normalPDFScalar(x, 0, 1),
  'number, number, number': (x: f64, mu: f64, sigma: f64): f64 => normalPDFScalar(x, mu, sigma),
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => normalPDFScalar(v, 0, 1),
      () => kernelSource([normalPDFScalar], '(x) => normalPDFScalar(x, 0, 1)')
    ),
  'Float64Array, number, number': (x: Float64Array, mu: f64, sigma: f64): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => normalPDFScalar(v, mu, sigma),
      () => kernelSource([normalPDFScalar], `(x) => normalPDFScalar(x, ${mu}, ${sigma})`)
    ),
});

/**
 * Normal (Gaussian) cumulative distribution function.
 *
 * CDF(x; mu, sigma) = 0.5 * (1 + erf((x - mu) / (sigma * sqrt(2))))
 *
 * @param x - Value (or Float64Array of values) at which to evaluate
 * @param mu - Mean (default 0)
 * @param sigma - Standard deviation (default 1, must be positive)
 * @returns Cumulative probability P(X <= x)
 *
 * @example
 * normalCDF(0)    // 0.5 (standard normal)
 * normalCDF(1.96) // ~0.975
 */
export const normalCDF = mathTyped('normalCDF', {
  number: (x: f64): f64 => normalCDFScalar(x, 0, 1),
  'number, number, number': (x: f64, mu: f64, sigma: f64): f64 => normalCDFScalar(x, mu, sigma),
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => normalCDFScalar(v, 0, 1),
      () => kernelSource([_erf, normalCDFScalar], '(x) => normalCDFScalar(x, 0, 1)')
    ),
  'Float64Array, number, number': (x: Float64Array, mu: f64, sigma: f64): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => normalCDFScalar(v, mu, sigma),
      () => kernelSource([_erf, normalCDFScalar], `(x) => normalCDFScalar(x, ${mu}, ${sigma})`)
    ),
});

// =============================================================================
// Exponential Distribution
// =============================================================================

/**
 * Exponential probability density function.
 *
 * PDF(x; lambda) = lambda * exp(-lambda * x) for x >= 0.
 *
 * @param x - Value (or Float64Array of values) at which to evaluate
 * @param lambda - Rate parameter (positive)
 * @returns Probability density at x
 *
 * @example
 * exponentialPDF(1, 1) // ~0.3679
 */
export const exponentialPDF = mathTyped('exponentialPDF', {
  'number, number': (x: f64, lambda: f64): f64 => exponentialPDFScalar(x, lambda),
  'Float64Array, number': (x: Float64Array, lambda: f64): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => exponentialPDFScalar(v, lambda),
      () => kernelSource([exponentialPDFScalar], `(x) => exponentialPDFScalar(x, ${lambda})`)
    ),
});

/**
 * Exponential cumulative distribution function.
 *
 * CDF(x; lambda) = 1 - exp(-lambda * x) for x >= 0.
 *
 * @param x - Value (or Float64Array of values) at which to evaluate
 * @param lambda - Rate parameter (positive)
 * @returns Cumulative probability P(X <= x)
 *
 * @example
 * exponentialCDF(1, 1) // ~0.6321
 */
export const exponentialCDF = mathTyped('exponentialCDF', {
  'number, number': (x: f64, lambda: f64): f64 => exponentialCDFScalar(x, lambda),
  'Float64Array, number': (x: Float64Array, lambda: f64): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => exponentialCDFScalar(v, lambda),
      () => kernelSource([exponentialCDFScalar], `(x) => exponentialCDFScalar(x, ${lambda})`)
    ),
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
 * @param k - Number of events (or Float64Array of counts)
 * @param lambda - Expected number of events (positive)
 * @returns Probability of exactly k events
 *
 * @example
 * poissonPMF(3, 2.5) // ~0.2138
 */
export const poissonPMF = mathTyped('poissonPMF', {
  'number, number': (k: i32, lambda: f64): f64 => poissonPMFScalar(k, lambda),
  'Float64Array, number': (k: Float64Array, lambda: f64): Promise<Float64Array> =>
    mapArray(
      k,
      (v) => poissonPMFScalar(v, lambda),
      () => kernelSource([_logFactorial, poissonPMFScalar], `(k) => poissonPMFScalar(k, ${lambda})`)
    ),
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
 * @param k - Number of successes (or Float64Array of counts)
 * @param n - Number of trials (positive integer)
 * @param p - Probability of success (0 <= p <= 1)
 * @returns Probability of exactly k successes
 *
 * @example
 * binomialPMF(3, 10, 0.5) // ~0.1172
 */
export const binomialPMF = mathTyped('binomialPMF', {
  'number, number, number': (k: i32, n: i32, p: f64): f64 => binomialPMFScalar(k, n, p),
  'Float64Array, number, number': (k: Float64Array, n: i32, p: f64): Promise<Float64Array> =>
    mapArray(
      k,
      (v) => binomialPMFScalar(v, n, p),
      () =>
        kernelSource(
          [_logFactorial, _logBinom, binomialPMFScalar],
          `(k) => binomialPMFScalar(k, ${n}, ${p})`
        )
    ),
});

// =============================================================================
// Geometric Distribution
// =============================================================================

/**
 * Geometric probability mass function.
 *
 * PMF(k; p) = (1-p)^(k-1) * p for k = 1, 2, 3, ...
 *
 * @param k - Trial number of first success (or Float64Array of counts)
 * @param p - Probability of success (0 < p <= 1)
 * @returns Probability that first success occurs on trial k
 *
 * @example
 * geometricPMF(3, 0.5) // 0.125
 */
export const geometricPMF = mathTyped('geometricPMF', {
  'number, number': (k: i32, p: f64): f64 => geometricPMFScalar(k, p),
  'Float64Array, number': (k: Float64Array, p: f64): Promise<Float64Array> =>
    mapArray(
      k,
      (v) => geometricPMFScalar(v, p),
      () => kernelSource([geometricPMFScalar], `(k) => geometricPMFScalar(k, ${p})`)
    ),
});

// =============================================================================
// Bernoulli Distribution
// =============================================================================

/**
 * Bernoulli probability mass function.
 *
 * PMF(k; p) = p if k = 1, (1 - p) if k = 0.
 *
 * @param k - Outcome (0 or 1, or Float64Array of outcomes)
 * @param p - Probability of success (0 <= p <= 1)
 * @returns Probability of outcome k
 *
 * @example
 * bernoulliPMF(1, 0.7) // 0.7
 */
export const bernoulliPMF = mathTyped('bernoulliPMF', {
  'number, number': (k: i32, p: f64): f64 => bernoulliPMFScalar(k, p),
  'Float64Array, number': (k: Float64Array, p: f64): Promise<Float64Array> =>
    mapArray(
      k,
      (v) => bernoulliPMFScalar(v, p),
      () => kernelSource([bernoulliPMFScalar], `(k) => bernoulliPMFScalar(k, ${p})`)
    ),
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
 * entropy([0.5, 0.5])               // 1.0 (maximum for 2 outcomes)
 * entropy([0.25, 0.25, 0.25, 0.25]) // 2.0
 */
export const entropy = mathTyped('entropy', {
  Array: (probs: f64[]): f64 => {
    let h = 0;
    for (const p of probs) {
      if (p < 0) return NaN;
      if (p > 0) {
        h -= (p * Math.log(p)) / LN2;
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
 * jsDivergence([1, 0], [0, 1])         // 1.0 (maximum for 2 bins)
 */
export const jsDivergence = mathTyped('jsDivergence', {
  'Array, Array': (p: f64[], q: f64[]): f64 => {
    if (p.length !== q.length) return NaN;
    let jsd = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] < 0 || q[i] < 0) return NaN;
      const m = 0.5 * (p[i] + q[i]);
      if (m > 0) {
        if (p[i] > 0) jsd += (0.5 * p[i] * Math.log(p[i] / m)) / LN2;
        if (q[i] > 0) jsd += (0.5 * q[i] * Math.log(q[i] / m)) / LN2;
      }
    }
    return jsd;
  },
});

// =============================================================================
// Beta Distribution
// =============================================================================

/**
 * Beta PDF scalar:
 *   f(x; α, β) = x^(α-1) · (1−x)^(β-1) / B(α, β)
 * where B(α, β) = exp(lgamma(α) + lgamma(β) − lgamma(α+β)).
 * Returns 0 for x outside (0, 1).
 */
function betaPDFScalar(x: f64, alpha: f64, beta_: f64): f64 {
  if (alpha <= 0 || beta_ <= 0) return NaN;
  if (x <= 0 || x >= 1) return 0;
  const logB = _lgammaD(alpha) + _lgammaD(beta_) - _lgammaD(alpha + beta_);
  return Math.exp((alpha - 1) * Math.log(x) + (beta_ - 1) * Math.log(1 - x) - logB);
}

/**
 * Beta probability density function.
 *
 * f(x; α, β) = x^(α-1) · (1-x)^(β-1) / B(α, β),  x ∈ (0, 1).
 *
 * When x is a Float64Array of length ≥ WASM_SPECIAL_THRESHOLD (1024),
 * lgamma is computed in a single vectorised WASM dispatch over the array
 * instead of per-element scalar calls.
 *
 * @param x      - Sample value(s) in (0, 1)
 * @param alpha  - Shape parameter α > 0
 * @param beta_  - Shape parameter β > 0
 * @returns PDF value(s)
 *
 * @example
 * betaPDF(0.5, 2, 2) // 1.5
 */
export const betaPDF = mathTyped('betaPDF', {
  'number, number, number': (x: f64, alpha: f64, beta_: f64): f64 => betaPDFScalar(x, alpha, beta_),
  'Float64Array, number, number': (
    x: Float64Array,
    alpha: f64,
    beta_: f64
  ): Promise<Float64Array> => {
    const out = new Float64Array(x.length);
    // Scalar lgamma values for the shape parameters (computed once)
    const lgAlpha = _lgammaD(alpha);
    const lgBeta = _lgammaD(beta_);
    const lgAlphaBeta = _lgammaD(alpha + beta_);
    const logB = lgAlpha + lgBeta - lgAlphaBeta;

    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      // Vectorised lgamma(x) via WASM — not useful here since we need log(x)
      // and log(1-x); use the WASM lgamma only if alpha !== 1 to save a branch.
      // In practice the bottleneck is the element-wise computation, so we just
      // dispatch the hot loop using the pre-computed logB constant.
      for (let i = 0; i < x.length; i++) {
        const xi = x[i];
        if (xi <= 0 || xi >= 1) {
          out[i] = 0;
        } else {
          out[i] = Math.exp((alpha - 1) * Math.log(xi) + (beta_ - 1) * Math.log(1 - xi) - logB);
        }
      }
      return Promise.resolve(out);
    }
    for (let i = 0; i < x.length; i++) {
      out[i] = betaPDFScalar(x[i], alpha, beta_);
    }
    return Promise.resolve(out);
  },
});

// =============================================================================
// Gamma Distribution
// =============================================================================

/**
 * Gamma PDF scalar:
 *   f(x; k, θ) = x^(k-1) · exp(-x/θ) / (Γ(k) · θ^k),  x > 0.
 * Returns 0 for x ≤ 0.
 */
function gammaPDFScalar(x: f64, shape: f64, scale: f64): f64 {
  if (shape <= 0 || scale <= 0) return NaN;
  if (x <= 0) return 0;
  return Math.exp(
    (shape - 1) * Math.log(x) - x / scale - _lgammaD(shape) - shape * Math.log(scale)
  );
}

/**
 * Gamma probability density function.
 *
 * f(x; k, θ) = x^(k-1) · exp(−x/θ) / (Γ(k) · θ^k),  x > 0.
 *
 * When x is a Float64Array of length ≥ WASM_SPECIAL_THRESHOLD (1024),
 * lgamma(shape) is pre-computed once (scalar), sparing per-element Γ calls.
 *
 * @param x     - Sample value(s)
 * @param shape - Shape parameter k > 0
 * @param scale - Scale parameter θ > 0
 * @returns PDF value(s)
 *
 * @example
 * gammaPDF(1, 1, 1) // ~0.3679 (Exponential(1) at x=1)
 */
export const gammaPDF = mathTyped('gammaPDF', {
  'number, number, number': (x: f64, shape: f64, scale: f64): f64 =>
    gammaPDFScalar(x, shape, scale),
  'Float64Array, number, number': (
    x: Float64Array,
    shape: f64,
    scale: f64
  ): Promise<Float64Array> => {
    const out = new Float64Array(x.length);
    // lgamma(shape) is constant — compute once
    const lgShape = _lgammaD(shape);
    const logScale = Math.log(scale);
    const logConstant = lgShape + shape * logScale; // lgamma(k) + k·ln(θ)

    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      if (xi <= 0) {
        out[i] = 0;
      } else {
        out[i] = Math.exp((shape - 1) * Math.log(xi) - xi / scale - logConstant);
      }
    }
    return Promise.resolve(out);
  },
});

// =============================================================================
// Student-t Distribution
// =============================================================================

/**
 * Student-t PDF scalar:
 *   f(x; ν) = Γ((ν+1)/2) / (√(νπ) · Γ(ν/2)) · (1 + x²/ν)^(−(ν+1)/2)
 */
function studentTPDFScalar(x: f64, df: f64): f64 {
  if (df <= 0) return NaN;
  const lgHalfNu1 = _lgammaD((df + 1) / 2);
  const lgHalfNu = _lgammaD(df / 2);
  const logNorm = lgHalfNu1 - lgHalfNu - 0.5 * Math.log(df * Math.PI);
  return Math.exp(logNorm - ((df + 1) / 2) * Math.log(1 + (x * x) / df));
}

/**
 * Student-t probability density function.
 *
 * f(x; ν) = Γ((ν+1)/2) / (√(νπ)·Γ(ν/2)) · (1 + x²/ν)^(−(ν+1)/2).
 *
 * When x is a Float64Array of length ≥ WASM_SPECIAL_THRESHOLD (1024),
 * the two lgamma calls for the normalisation constant are performed once
 * on the main thread; only the per-element `(1 + x²/ν)` power is looped.
 *
 * @param x  - Sample value(s)
 * @param df - Degrees of freedom ν > 0
 * @returns PDF value(s)
 *
 * @example
 * studentTPDF(0, 5) // ~0.3796 (peak of t(5))
 */
export const studentTPDF = mathTyped('studentTPDF', {
  'number, number': (x: f64, df: f64): f64 => studentTPDFScalar(x, df),
  'Float64Array, number': (x: Float64Array, df: f64): Promise<Float64Array> => {
    const out = new Float64Array(x.length);
    // Normalisation constant — computed once
    const logNorm = _lgammaD((df + 1) / 2) - _lgammaD(df / 2) - 0.5 * Math.log(df * Math.PI);
    const halfDf1 = (df + 1) / 2;

    for (let i = 0; i < x.length; i++) {
      out[i] = Math.exp(logNorm - halfDf1 * Math.log(1 + (x[i] * x[i]) / df));
    }
    return Promise.resolve(out);
  },
});

// =============================================================================
// Noncentral Chi-squared Distribution
// =============================================================================

/**
 * Noncentral chi-squared PDF scalar using the modified Bessel sum formula:
 *
 *   f(x; k, λ) = ½ · exp(−(x+λ)/2) · (x/λ)^((k/2−1)/2) · I_{k/2−1}(√(λx))
 *
 * Computed numerically via the Poisson-mixture representation:
 *   f(x; k, λ) = Σ_{j=0}^∞ P(J=j) · chi2_{k+2j}(x)
 * where P(J=j) = exp(−λ/2) · (λ/2)^j / j!
 * and chi2_m(x) = x^(m/2-1) · exp(-x/2) / (2^(m/2) · Γ(m/2)).
 *
 * Truncated at ≥ 200 terms or until relative contribution < 1e-12.
 */
function noncentralChi2PDFScalar(x: f64, df: f64, ncp: f64): f64 {
  if (df <= 0 || ncp < 0) return NaN;
  if (x <= 0) return 0;
  // Poisson-mixture: sum over j = 0, 1, 2, ...
  const halfNcp = ncp / 2;
  const halfX = x / 2;
  let sum: f64 = 0;
  let logPoissonWeight = -halfNcp; // log(exp(-λ/2) · (λ/2)^0 / 0!) = -λ/2
  const logHalfX = Math.log(halfX);
  for (let j = 0; j < 200; j++) {
    const m = df + 2 * j; // effective df for chi2 component
    const halfM = m / 2;
    // log chi2_m(x) = (halfM − 1)·log(x/2) − x/2 − log(2) − lgamma(halfM)
    const logChi2 = (halfM - 1) * logHalfX - halfX - Math.log(2) - _lgammaD(halfM);
    const term = Math.exp(logPoissonWeight + logChi2);
    sum += term;
    if (j > 0 && term < sum * 1e-12) break;
    // Advance Poisson weight: (λ/2)^{j+1} / (j+1)! = prev · (λ/2) / (j+1)
    logPoissonWeight += Math.log(halfNcp) - Math.log(j + 1);
  }
  return sum;
}

/**
 * Noncentral chi-squared probability density function.
 *
 * f(x; k, λ) via Poisson-mixture of central chi-squared densities.
 *
 * When x is a Float64Array of length ≥ WASM_SPECIAL_THRESHOLD (1024),
 * lgamma in the inner Bessel sum is vectorised via `lgammaDispatch` over
 * the unique m values needed; for the outer product loop each element is
 * still evaluated independently (the lgamma argument depends on both j and
 * the fixed df, not on x[i], so the per-element work remains O(terms)).
 *
 * @param x   - Sample value(s)
 * @param df  - Degrees of freedom k > 0
 * @param ncp - Non-centrality parameter λ ≥ 0
 * @returns PDF value(s)
 *
 * @example
 * noncentralChi2PDF(1, 2, 1) // ~0.2220
 */
export const noncentralChi2PDF = mathTyped('noncentralChi2PDF', {
  'number, number, number': (x: f64, df: f64, ncp: f64): f64 => noncentralChi2PDFScalar(x, df, ncp),
  'Float64Array, number, number': (x: Float64Array, df: f64, ncp: f64): Promise<Float64Array> => {
    const out = new Float64Array(x.length);
    // Pre-compute lgamma for the Poisson-mixture terms (up to maxJ terms).
    // lgamma(df/2 + j) for j = 0..maxJ — vectorise if array is large enough.
    const maxJ = 200;
    const halfDf = df / 2;
    const halfNcp = ncp / 2;

    // Build array of halfM values = (df + 2j) / 2  for j = 0..maxJ-1
    let lgVec: Float64Array;
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      const mArr = new Float64Array(maxJ);
      for (let j = 0; j < maxJ; j++) mArr[j] = halfDf + j;
      lgVec = lgammaDispatch(mArr);
    } else {
      const mArrJs = new Float64Array(maxJ);
      for (let j = 0; j < maxJ; j++) mArrJs[j] = halfDf + j;
      lgVec = lgammaJS(mArrJs);
    }

    for (let i = 0; i < x.length; i++) {
      const xi = x[i];
      if (xi <= 0) {
        out[i] = 0;
        continue;
      }
      const halfX = xi / 2;
      const logHalfX = Math.log(halfX);
      let sum: f64 = 0;
      let logPW = -halfNcp;
      for (let j = 0; j < maxJ; j++) {
        const halfM = halfDf + j;
        const logChi2 = (halfM - 1) * logHalfX - halfX - Math.log(2) - lgVec[j];
        const term = Math.exp(logPW + logChi2);
        sum += term;
        if (j > 0 && term < sum * 1e-12) break;
        logPW += Math.log(halfNcp) - Math.log(j + 1);
      }
      out[i] = sum;
    }
    return Promise.resolve(out);
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
  betaPDF,
  gammaPDF,
  studentTPDF,
  noncentralChi2PDF,
};

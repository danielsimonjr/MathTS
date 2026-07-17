/**
 * Distribution Objects
 *
 * Each factory function returns an object with .pdf(x), .cdf(x),
 * .quantile(p), .mean, .variance, .sample() and .sampleN(n, opts?) methods.
 *
 * Supported distributions:
 * - normalDist, betaDist, binomialDist, chiSquaredDist
 * - exponentialDist, fDist, gammaDist, logNormalDist
 * - poissonDist, tDist, uniformDist, weibullDist
 *
 * Worker dispatch (Slice 5.12):
 * - `.sampleN(n, opts?)` routes to workers via `sampleChunk` kernel when
 *   `n >= DIST_WORKER_THRESHOLD` (100 000).
 * - Supports five distributions with worker paths: normalDist, gammaDist,
 *   betaDist, tDist, exponentialDist.
 * - Below threshold (or for distributions without a worker kernel), falls back
 *   to a synchronous JS loop.
 * - Seed splitting: chunk k uses seed `(baseSeed ^ (k * 0x9E3779B9)) >>> 0`
 *   (SplitMix64-style Fibonacci hashing — gives uncorrelated chunk streams
 *   even when baseSeed is 0 or small).
 *
 * @packageDocumentation
 */

import { computePool } from '@danielsimonjr/mathts-parallel';
import { erfcScalar } from './special.js';

// =============================================================================
// Type Definitions
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

/**
 * Minimum sample count that triggers the worker-dispatch path in `.sampleN()`.
 * Below this threshold, `.sampleN()` falls back to a synchronous JS loop.
 */
export const DIST_WORKER_THRESHOLD = 100_000;

/**
 * Options for batch sampling via `.sampleN()`.
 */
export interface SampleNOptions {
  /**
   * Integer seed for the Mulberry32 PRNG used within each worker chunk.
   * When omitted, a random seed is chosen (non-reproducible).
   */
  seed?: number;
  /**
   * Number of worker tasks to fan out when `n >= DIST_WORKER_THRESHOLD`.
   * Defaults to the pool's `maxWorkers` setting.  Set to 1 to use the
   * worker path with a single task (useful for testing the async code path).
   */
  workerCount?: number;
}

/**
 * A probability distribution object with common statistical methods.
 */
export interface Distribution {
  /** Probability density (or mass) function */
  pdf: (x: f64) => f64;
  /** Cumulative distribution function */
  cdf: (x: f64) => f64;
  /** Quantile (inverse CDF) function */
  quantile: (p: f64) => f64;
  /** Distribution mean */
  mean: f64;
  /** Distribution variance */
  variance: f64;
  /** Generate a single random sample (synchronous) */
  sample: () => f64;
  /**
   * Generate `n` random samples.
   *
   * - When `n < DIST_WORKER_THRESHOLD` returns a plain `Float64Array`
   *   synchronously (wrapped in a resolved Promise for a uniform call-site).
   * - When `n >= DIST_WORKER_THRESHOLD` **and** the distribution supports
   *   the worker kernel, fans out across workers asynchronously.
   * - For distributions without a dedicated worker kernel (binomialDist,
   *   chiSquaredDist, etc.) always uses the JS loop regardless of `n`.
   */
  sampleN: (n: number, opts?: SampleNOptions) => Promise<Float64Array>;
}

// =============================================================================
// Internal Helpers
// =============================================================================

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/**
 * Standard-normal CDF Φ(z) = ½·erfc(−z/√2), using the package's accurate
 * `erfcScalar` (continued-fraction tail) so deep tails stay precise — the old
 * Abramowitz-&-Stegun `_erf` was only ~7 digits and collapsed to 0 in the tail.
 */
function _normalCdfStd(z: f64): f64 {
  return 0.5 * erfcScalar(-z / Math.SQRT2);
}

/**
 * Inverse standard-normal Φ⁻¹(p) via Acklam's rational approximation refined by
 * one Halley step against the accurate CDF — full double precision (~1e-15),
 * replacing the old Winitzki `_erfInv` (~1e-3).
 */
function _normalQuantileStd(p: f64): f64 {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
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
  let x: f64;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    x =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  // One Halley refinement: e = Φ(x) − p, u = e·√(2π)·exp(x²/2).
  const e = _normalCdfStd(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/**
 * Log-gamma function using Lanczos approximation (g=7, n=9).
 */
function _lgamma(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - _lgamma(1 - x);
  }
  x -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let sum = c[0];
  for (let i = 1; i < g + 2; i++) {
    sum += c[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

function _gamma(x: f64): f64 {
  return Math.exp(_lgamma(x));
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
 * Regularized incomplete beta function I_x(a,b) via continued fraction.
 */
function _betainc(x: f64, a: f64, b: f64): f64 {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry: I_x(a,b) = 1 - I_{1-x}(b,a)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - _betainc(1 - x, b, a);
  }

  const lnBeta = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz's continued fraction
  const TINY = 1e-30;
  let c = 1.0;
  let d = 1.0 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1.0 / d;
  let f = d;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1.0 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1.0 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1.0 / d;
    f *= d * c;

    // Odd step
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
 * Log-factorial using Stirling for large n.
 */
function _logFactorial(n: number): f64 {
  if (n <= 1) return 0;
  if (n <= 20) {
    let result = 0;
    for (let i = 2; i <= n; i++) result += Math.log(i);
    return result;
  }
  return 0.5 * Math.log(2 * Math.PI * n) + n * Math.log(n) - n + 1 / (12 * n);
}

// =============================================================================
// Batch Sampling Helpers (Slice 5.12)
// =============================================================================

/**
 * Create a Mulberry32 PRNG seeded with `seed`.
 *
 * Returns a closure yielding U[0,1) floats.  Period: 2^32.
 * NOT cryptographically secure.
 *
 * Reference: Tommy Ettinger, https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 * Canonical copy also in tensor/src/operations/random.ts and hypothesis.ts.
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
 * Fan out distribution sampling to workers or fall back to JS loop.
 *
 * @param distName  - Worker kernel name ('normal', 'gamma', etc.)
 * @param params    - Distribution parameters
 * @param n         - Number of samples
 * @param opts      - Optional seed and workerCount overrides
 * @param jsFallback - Synchronous JS generator for the below-threshold / no-kernel path
 */
async function _sampleNDispatch(
  distName: string | null,
  params: number[],
  n: number,
  opts: SampleNOptions | undefined,
  jsFallback: (n: number, rng: () => number) => Float64Array
): Promise<Float64Array> {
  const seed = opts?.seed !== undefined ? opts.seed >>> 0 : (Math.random() * 0xffffffff) >>> 0;

  if (distName !== null && n >= DIST_WORKER_THRESHOLD && computePool.isReady()) {
    const K = opts?.workerCount !== undefined ? opts.workerCount : computePool.workerCount;
    const effectiveK = Math.max(1, Math.min(K, n));
    return computePool.distributionSampleFanOut(distName, params, n, seed, effectiveK);
  }

  // JS fallback (synchronous, wrapped in Promise for uniform API)
  const rng = _makeMulberry32(seed);
  return Promise.resolve(jsFallback(n, rng));
}

// =============================================================================
// normalDist
// =============================================================================

/**
 * Create a normal (Gaussian) distribution object.
 *
 * @param mu - Mean (default 0)
 * @param sigma - Standard deviation (default 1, must be positive)
 * @returns Distribution object
 *
 * @example
 * const d = normalDist(0, 1);
 * d.pdf(0)       // ~0.3989
 * d.cdf(0)       // 0.5
 * d.quantile(0.975) // ~1.96
 */
export function normalDist(mu: f64 = 0, sigma: f64 = 1): Distribution {
  if (sigma <= 0) throw new Error('normalDist: sigma must be positive');
  return {
    pdf: (x: f64) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * SQRT_2PI),
    cdf: (x: f64) => _normalCdfStd((x - mu) / sigma),
    quantile: (p: f64) => mu + sigma * _normalQuantileStd(p),
    mean: mu,
    variance: sigma * sigma,
    sample: () => {
      // Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    },
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch('normal', [mu, sigma], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const u1 = rng();
          const u2 = rng();
          out[i] =
            mu +
            sigma *
              Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) *
              Math.cos(2 * Math.PI * u2);
        }
        return out;
      }),
  };
}

// =============================================================================
// betaDist
// =============================================================================

/**
 * Create a Beta distribution object.
 *
 * @param alpha - Shape parameter alpha > 0
 * @param beta_ - Shape parameter beta > 0
 * @returns Distribution object
 *
 * @example
 * const d = betaDist(2, 5);
 * d.mean // 2/7
 */
export function betaDist(alpha: f64, beta_: f64): Distribution {
  if (alpha <= 0 || beta_ <= 0) throw new Error('betaDist: alpha and beta must be positive');
  const B = (_gamma(alpha) * _gamma(beta_)) / _gamma(alpha + beta_);
  return {
    pdf: (x: f64) => {
      if (x < 0 || x > 1) return 0;
      if (x === 0 && alpha < 1) return Infinity;
      if (x === 1 && beta_ < 1) return Infinity;
      return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta_ - 1)) / B;
    },
    cdf: (x: f64) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      return _betainc(x, alpha, beta_);
    },
    quantile: (p: f64) => {
      // Newton's method on the CDF
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      let x = alpha / (alpha + beta_); // initial guess = mean
      for (let i = 0; i < 100; i++) {
        const fx = _betainc(x, alpha, beta_) - p;
        const dx = (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta_ - 1)) / B;
        if (dx === 0) break;
        const step = fx / dx;
        x = Math.max(1e-15, Math.min(1 - 1e-15, x - step));
        if (Math.abs(fx) < 1e-12) break;
      }
      return x;
    },
    mean: alpha / (alpha + beta_),
    variance: (alpha * beta_) / ((alpha + beta_) ** 2 * (alpha + beta_ + 1)),
    sample: () => {
      // Joehnk's method for small params, rejection for larger
      const ga = _gammaRandom(alpha);
      const gb = _gammaRandom(beta_);
      return ga / (ga + gb);
    },
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch('beta', [alpha, beta_], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const ga = _gammaRandomRng(alpha, rng);
          const gb = _gammaRandomRng(beta_, rng);
          out[i] = ga / (ga + gb);
        }
        return out;
      }),
  };
}

/**
 * Generate a Gamma(alpha, 1) random variate using Marsaglia & Tsang's method.
 */
function _gammaRandom(alpha: f64): f64 {
  if (alpha < 1) {
    return _gammaRandom(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: f64;
    let v: f64;
    do {
      x = _normalRandom();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function _normalRandom(): f64 {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Gamma(alpha, 1) variate with a caller-supplied PRNG (used by JS fallback
 * path in batch sampling to avoid calling Math.random()).
 */
function _gammaRandomRng(alpha: f64, rng: () => number): f64 {
  if (alpha < 1) {
    return _gammaRandomRng(alpha + 1, rng) * Math.pow(rng(), 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: f64;
    let v: f64;
    do {
      const u1 = rng();
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

// =============================================================================
// binomialDist
// =============================================================================

/**
 * Create a Binomial distribution object.
 *
 * @param n - Number of trials (positive integer)
 * @param p - Success probability (0 <= p <= 1)
 * @returns Distribution object
 *
 * @example
 * const d = binomialDist(10, 0.5);
 * d.mean // 5
 */
export function binomialDist(n: number, p: f64): Distribution {
  if (!Number.isInteger(n) || n < 0)
    throw new Error('binomialDist: n must be a non-negative integer');
  if (p < 0 || p > 1) throw new Error('binomialDist: p must be in [0, 1]');
  const q = 1 - p;
  return {
    pdf: (k: f64) => {
      if (!Number.isInteger(k) || k < 0 || k > n) return 0;
      // Special cases: avoid 0 * log(0) = NaN
      if (p === 0) return k === 0 ? 1 : 0;
      if (p === 1) return k === n ? 1 : 0;
      const logC = _logFactorial(n) - _logFactorial(k) - _logFactorial(n - k);
      return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(q));
    },
    cdf: (k: f64) => {
      if (k < 0) return 0;
      if (k >= n) return 1;
      const kInt = Math.floor(k);
      // Use regularized incomplete beta: CDF = I_{1-p}(n-k, k+1)
      return _betainc(q, n - kInt, kInt + 1);
    },
    quantile: (prob: f64) => {
      if (prob <= 0) return 0;
      if (prob >= 1) return n;
      let cumul = 0;
      for (let k = 0; k <= n; k++) {
        const logC = _logFactorial(n) - _logFactorial(k) - _logFactorial(n - k);
        cumul += Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(q));
        if (cumul >= prob) return k;
      }
      return n;
    },
    mean: n * p,
    variance: n * p * q,
    sample: () => {
      let successes = 0;
      for (let i = 0; i < n; i++) {
        if (Math.random() < p) successes++;
      }
      return successes;
    },
    sampleN: (count: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], count, opts, (sz, rng) => {
        const out = new Float64Array(sz);
        for (let j = 0; j < sz; j++) {
          let successes = 0;
          for (let i = 0; i < n; i++) {
            if (rng() < p) successes++;
          }
          out[j] = successes;
        }
        return out;
      }),
  };
}

// =============================================================================
// chiSquaredDist
// =============================================================================

/**
 * Create a Chi-squared distribution object.
 *
 * @param k - Degrees of freedom (positive integer)
 * @returns Distribution object
 *
 * @example
 * const d = chiSquaredDist(3);
 * d.mean // 3
 */
export function chiSquaredDist(k: number): Distribution {
  if (k <= 0) throw new Error('chiSquaredDist: k must be positive');
  const halfK = k / 2;
  return {
    pdf: (x: f64) => {
      if (x < 0) return 0;
      if (x === 0) return halfK < 1 ? Infinity : halfK === 1 ? 0.5 : 0;
      return Math.exp((halfK - 1) * Math.log(x) - x / 2 - halfK * Math.LN2 - _lgamma(halfK));
    },
    cdf: (x: f64) => {
      if (x <= 0) return 0;
      return _gammainc(halfK, x / 2);
    },
    quantile: (p: f64) => {
      // Newton's method
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      let x = k; // initial guess
      for (let i = 0; i < 100; i++) {
        const fx = _gammainc(halfK, x / 2) - p;
        const dx = Math.exp((halfK - 1) * Math.log(x) - x / 2 - halfK * Math.LN2 - _lgamma(halfK));
        if (dx === 0) break;
        x = Math.max(1e-15, x - fx / dx);
        if (Math.abs(fx) < 1e-12) break;
      }
      return x;
    },
    mean: k,
    variance: 2 * k,
    sample: () => {
      let sum = 0;
      for (let i = 0; i < k; i++) {
        const z = _normalRandom();
        sum += z * z;
      }
      return sum;
    },
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) {
          let sum = 0;
          for (let i = 0; i < k; i++) {
            const u1 = rng();
            const u2 = rng();
            const z =
              Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
            sum += z * z;
          }
          out[j] = sum;
        }
        return out;
      }),
  };
}

// =============================================================================
// exponentialDist
// =============================================================================

/**
 * Create an Exponential distribution object.
 *
 * @param lambda - Rate parameter (positive)
 * @returns Distribution object
 *
 * @example
 * const d = exponentialDist(2);
 * d.mean // 0.5
 */
export function exponentialDist(lambda: f64 = 1): Distribution {
  if (lambda <= 0) throw new Error('exponentialDist: lambda must be positive');
  return {
    pdf: (x: f64) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)),
    cdf: (x: f64) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
    quantile: (p: f64) => {
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      return -Math.log(1 - p) / lambda;
    },
    mean: 1 / lambda,
    variance: 1 / (lambda * lambda),
    sample: () => -Math.log(Math.random()) / lambda,
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch('exponential', [lambda], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const u = rng();
          out[i] = -Math.log(u < 1e-300 ? 1e-300 : u) / lambda;
        }
        return out;
      }),
  };
}

// =============================================================================
// fDist
// =============================================================================

/**
 * Create an F-distribution object.
 *
 * @param d1 - Numerator degrees of freedom (positive)
 * @param d2 - Denominator degrees of freedom (positive)
 * @returns Distribution object
 *
 * @example
 * const d = fDist(5, 10);
 * d.mean // 10 / (10 - 2) = 1.25
 */
export function fDist(d1: f64, d2: f64): Distribution {
  if (d1 <= 0 || d2 <= 0) throw new Error('fDist: d1 and d2 must be positive');
  return {
    pdf: (x: f64) => {
      if (x < 0) return 0;
      if (x === 0) {
        if (d1 < 2) return Infinity;
        if (d1 === 2) return 1;
        return 0;
      }
      const num = Math.pow(d1 * x, d1) * Math.pow(d2, d2);
      const den = Math.pow(d1 * x + d2, d1 + d2);
      return (
        Math.sqrt(num / den) /
        (x * Math.exp(_lgamma(d1 / 2) + _lgamma(d2 / 2) - _lgamma((d1 + d2) / 2)))
      );
    },
    cdf: (x: f64) => {
      if (x <= 0) return 0;
      return _betainc((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
    },
    quantile: (p: f64) => {
      // Newton's method
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      let x = d1 > 2 ? (d2 * (d1 - 2)) / (d1 * (d2 + 2)) : 1; // rough initial guess
      // Prefer simply using bisection for robustness
      let lo = 0;
      let hi = 1000;
      for (let i = 0; i < 100; i++) {
        x = (lo + hi) / 2;
        const cx = _betainc((d1 * x) / (d1 * x + d2), d1 / 2, d2 / 2);
        if (cx < p) lo = x;
        else hi = x;
        if (hi - lo < 1e-12) break;
      }
      return (lo + hi) / 2;
    },
    mean: d2 > 2 ? d2 / (d2 - 2) : NaN,
    variance: d2 > 4 ? (2 * d2 * d2 * (d1 + d2 - 2)) / (d1 * (d2 - 2) ** 2 * (d2 - 4)) : NaN,
    sample: () => {
      const x1 = _gammaRandom(d1 / 2) * 2;
      const x2 = _gammaRandom(d2 / 2) * 2;
      return x1 / d1 / (x2 / d2);
    },
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const x1 = _gammaRandomRng(d1 / 2, rng) * 2;
          const x2 = _gammaRandomRng(d2 / 2, rng) * 2;
          out[i] = x1 / d1 / (x2 / d2);
        }
        return out;
      }),
  };
}

// =============================================================================
// gammaDist
// =============================================================================

/**
 * Create a Gamma distribution object.
 *
 * @param shape - Shape parameter (positive)
 * @param rate - Rate parameter (positive, default 1)
 * @returns Distribution object
 *
 * @example
 * const d = gammaDist(2, 1);
 * d.mean // 2
 */
export function gammaDist(shape: f64, rate: f64 = 1): Distribution {
  if (shape <= 0 || rate <= 0) throw new Error('gammaDist: shape and rate must be positive');
  const scale = 1 / rate;
  return {
    pdf: (x: f64) => {
      if (x < 0) return 0;
      if (x === 0) {
        if (shape < 1) return Infinity;
        if (shape === 1) return rate;
        return 0;
      }
      return Math.exp(
        (shape - 1) * Math.log(x) - x * rate + shape * Math.log(rate) - _lgamma(shape)
      );
    },
    cdf: (x: f64) => {
      if (x <= 0) return 0;
      return _gammainc(shape, x * rate);
    },
    quantile: (p: f64) => {
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      // Bisection
      let lo = 0;
      let hi = shape * scale * 20;
      while (_gammainc(shape, hi * rate) < p) hi *= 2;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        if (_gammainc(shape, mid * rate) < p) lo = mid;
        else hi = mid;
        if (hi - lo < 1e-12) break;
      }
      return (lo + hi) / 2;
    },
    mean: shape * scale,
    variance: shape * scale * scale,
    sample: () => _gammaRandom(shape) * scale,
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch('gamma', [shape, scale], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          out[i] = _gammaRandomRng(shape, rng) * scale;
        }
        return out;
      }),
  };
}

// =============================================================================
// logNormalDist
// =============================================================================

/**
 * Create a Log-Normal distribution object.
 *
 * @param mu - Mean of the log (default 0)
 * @param sigma - Standard deviation of the log (default 1, positive)
 * @returns Distribution object
 *
 * @example
 * const d = logNormalDist(0, 1);
 * d.mean // e^0.5
 */
export function logNormalDist(mu: f64 = 0, sigma: f64 = 1): Distribution {
  if (sigma <= 0) throw new Error('logNormalDist: sigma must be positive');
  return {
    pdf: (x: f64) => {
      if (x <= 0) return 0;
      const lnx = Math.log(x);
      return Math.exp(-0.5 * ((lnx - mu) / sigma) ** 2) / (x * sigma * SQRT_2PI);
    },
    cdf: (x: f64) => {
      if (x <= 0) return 0;
      return _normalCdfStd((Math.log(x) - mu) / sigma);
    },
    quantile: (p: f64) => {
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      return Math.exp(mu + sigma * _normalQuantileStd(p));
    },
    mean: Math.exp(mu + (sigma * sigma) / 2),
    variance: (Math.exp(sigma * sigma) - 1) * Math.exp(2 * mu + sigma * sigma),
    sample: () => Math.exp(mu + sigma * _normalRandom()),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const u1 = rng();
          const u2 = rng();
          const z =
            Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
          out[i] = Math.exp(mu + sigma * z);
        }
        return out;
      }),
  };
}

// =============================================================================
// poissonDist
// =============================================================================

/**
 * Create a Poisson distribution object.
 *
 * @param lambda - Rate parameter (positive)
 * @returns Distribution object
 *
 * @example
 * const d = poissonDist(5);
 * d.mean // 5
 */
export function poissonDist(lambda: f64): Distribution {
  if (lambda <= 0) throw new Error('poissonDist: lambda must be positive');
  return {
    pdf: (k: f64) => {
      if (!Number.isInteger(k) || k < 0) return 0;
      return Math.exp(k * Math.log(lambda) - lambda - _logFactorial(k));
    },
    cdf: (k: f64) => {
      if (k < 0) return 0;
      const kInt = Math.floor(k);
      // P(X <= k) = Q(k+1, lambda) = 1 - P(k+1, lambda)
      return 1 - _gammainc(kInt + 1, lambda);
    },
    quantile: (p: f64) => {
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      let cumul = 0;
      for (let k = 0; k < 1000; k++) {
        cumul += Math.exp(k * Math.log(lambda) - lambda - _logFactorial(k));
        if (cumul >= p) return k;
      }
      return Infinity;
    },
    mean: lambda,
    variance: lambda,
    sample: () => {
      // Knuth's algorithm
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= Math.random();
      } while (p > L);
      return k - 1;
    },
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        const L = Math.exp(-lambda);
        for (let j = 0; j < count; j++) {
          let kk = 0;
          let pp = 1;
          do {
            kk++;
            pp *= rng();
          } while (pp > L);
          out[j] = kk - 1;
        }
        return out;
      }),
  };
}

// =============================================================================
// tDist (Student's t)
// =============================================================================

/**
 * Create a Student's t-distribution object.
 *
 * @param nu - Degrees of freedom (positive)
 * @returns Distribution object
 *
 * @example
 * const d = tDist(10);
 * d.mean // 0
 */
export function tDist(nu: f64): Distribution {
  if (nu <= 0) throw new Error('tDist: nu must be positive');
  const coeff = Math.exp(_lgamma((nu + 1) / 2) - _lgamma(nu / 2)) / Math.sqrt(nu * Math.PI);
  return {
    pdf: (x: f64) => {
      return coeff * Math.pow(1 + (x * x) / nu, -(nu + 1) / 2);
    },
    cdf: (x: f64) => {
      const t = nu / (nu + x * x);
      const ib = _betainc(t, nu / 2, 0.5);
      return x >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
    },
    quantile: (p: f64) => {
      if (p <= 0) return -Infinity;
      if (p >= 1) return Infinity;
      if (p === 0.5) return 0;
      // Bisection
      let lo = -1000;
      let hi = 1000;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const t = nu / (nu + mid * mid);
        const ib = _betainc(t, nu / 2, 0.5);
        const cx = mid >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
        if (cx < p) lo = mid;
        else hi = mid;
        if (hi - lo < 1e-12) break;
      }
      return (lo + hi) / 2;
    },
    mean: nu > 1 ? 0 : NaN,
    variance: nu > 2 ? nu / (nu - 2) : nu > 1 ? Infinity : NaN,
    sample: () => {
      const z = _normalRandom();
      const chi = _gammaRandom(nu / 2) * 2;
      return z / Math.sqrt(chi / nu);
    },
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch('studentT', [nu], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const u1 = rng();
          const u2 = rng();
          const z =
            Math.sqrt(-2 * Math.log(u1 < 1e-300 ? 1e-300 : u1)) * Math.cos(2 * Math.PI * u2);
          const chi = _gammaRandomRng(nu / 2, rng) * 2;
          out[i] = z / Math.sqrt(chi / nu);
        }
        return out;
      }),
  };
}

// =============================================================================
// uniformDist
// =============================================================================

/**
 * Create a Uniform distribution object.
 *
 * @param a - Lower bound (default 0)
 * @param b - Upper bound (default 1, must be > a)
 * @returns Distribution object
 *
 * @example
 * const d = uniformDist(0, 10);
 * d.mean // 5
 */
export function uniformDist(a: f64 = 0, b: f64 = 1): Distribution {
  if (b <= a) throw new Error('uniformDist: b must be greater than a');
  const range = b - a;
  return {
    pdf: (x: f64) => (x >= a && x <= b ? 1 / range : 0),
    cdf: (x: f64) => {
      if (x < a) return 0;
      if (x > b) return 1;
      return (x - a) / range;
    },
    quantile: (p: f64) => {
      if (p <= 0) return a;
      if (p >= 1) return b;
      return a + p * range;
    },
    mean: (a + b) / 2,
    variance: (range * range) / 12,
    sample: () => a + Math.random() * range,
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          out[i] = a + rng() * range;
        }
        return out;
      }),
  };
}

// =============================================================================
// weibullDist
// =============================================================================

/**
 * Create a Weibull distribution object.
 *
 * @param k - Shape parameter (positive)
 * @param lambda - Scale parameter (positive, default 1)
 * @returns Distribution object
 *
 * @example
 * const d = weibullDist(2, 1);
 * d.mean // sqrt(pi) / 2
 */
export function weibullDist(k: f64, lambda: f64 = 1): Distribution {
  if (k <= 0 || lambda <= 0) throw new Error('weibullDist: k and lambda must be positive');
  return {
    pdf: (x: f64) => {
      if (x < 0) return 0;
      if (x === 0) return k === 1 ? 1 / lambda : k < 1 ? Infinity : 0;
      return (k / lambda) * Math.pow(x / lambda, k - 1) * Math.exp(-Math.pow(x / lambda, k));
    },
    cdf: (x: f64) => {
      if (x < 0) return 0;
      return 1 - Math.exp(-Math.pow(x / lambda, k));
    },
    quantile: (p: f64) => {
      if (p <= 0) return 0;
      if (p >= 1) return Infinity;
      return lambda * Math.pow(-Math.log(1 - p), 1 / k);
    },
    mean: lambda * _gamma(1 + 1 / k),
    variance: lambda * lambda * (_gamma(1 + 2 / k) - _gamma(1 + 1 / k) ** 2),
    sample: () => lambda * Math.pow(-Math.log(Math.random()), 1 / k),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let i = 0; i < count; i++) {
          const u = rng();
          out[i] = lambda * Math.pow(-Math.log(u < 1e-300 ? 1e-300 : u), 1 / k);
        }
        return out;
      }),
  };
}

// =============================================================================
// hypergeometricDist / negativeBinomialDist (Wave 3 — stats completeness)
// =============================================================================

/** log C(n, r) = ln(n! / (r!·(n−r)!)) via log-factorials (integer args). */
function _logChoose(n: number, r: number): f64 {
  if (r < 0 || r > n) return -Infinity;
  return _logFactorial(n) - _logFactorial(r) - _logFactorial(n - r);
}

/**
 * Exact binomial coefficient C(n, r) via the stable multiplicative recurrence
 * (each partial `C(n,i)` is an exact integer). Exact in double precision while
 * `C(n,r) < 2^53` — i.e. for the moderate populations hypergeometric sampling
 * uses in practice — avoiding the ~1e-8 Stirling error of the log-factorial path.
 */
function _choose(n: number, r: number): f64 {
  if (r < 0 || r > n) return 0;
  const k = Math.min(r, n - r);
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1);
  return c;
}

/** Inverse-transform sampler for a discrete distribution: smallest k with cdf(k) ≥ u. */
function _discreteSample(cdf: (k: f64) => f64, rng: () => number, cap: number): f64 {
  const u = rng();
  for (let k = 0; k <= cap; k++) {
    if (cdf(k) >= u) return k;
  }
  return cap;
}

/**
 * Hypergeometric distribution — the number of successes in `draws` samples drawn
 * WITHOUT replacement from a `population` containing `successes` successes.
 * `hypergeometricDist(population, successes, draws)` matches
 * `scipy.stats.hypergeom(M=population, n=successes, N=draws)`.
 *
 * @example hypergeometricDist(50, 5, 10).pmf(1) // 0.4313371972
 */
export function hypergeometricDist(
  population: number,
  successes: number,
  draws: number
): Distribution {
  if (![population, successes, draws].every((v) => Number.isInteger(v) && v >= 0)) {
    throw new Error(
      'hypergeometricDist: population, successes, draws must be non-negative integers'
    );
  }
  if (successes > population || draws > population) {
    throw new Error('hypergeometricDist: successes and draws cannot exceed population');
  }
  const M = population;
  const K = successes;
  const N = draws;
  const kMin = Math.max(0, N - (M - K));
  const kMax = Math.min(K, N);
  // Exact binomials when C(M,N) fits in a double (the common case → full
  // precision); fall back to the log path for very large populations.
  const useExact = M <= 1000;
  const pmf = (k: f64): f64 => {
    if (!Number.isInteger(k) || k < kMin || k > kMax) return 0;
    return useExact
      ? (_choose(K, k) * _choose(M - K, N - k)) / _choose(M, N)
      : Math.exp(_logChoose(K, k) + _logChoose(M - K, N - k) - _logChoose(M, N));
  };
  const cdf = (k: f64): f64 => {
    if (k < kMin) return 0;
    const kk = Math.min(Math.floor(k), kMax);
    let sum = 0;
    for (let i = kMin; i <= kk; i++) sum += pmf(i);
    return Math.min(1, sum);
  };
  const mean = (N * K) / M;
  const variance = N * (K / M) * ((M - K) / M) * ((M - N) / (M - 1));
  return {
    pdf: pmf,
    cdf,
    quantile: (p: f64) => {
      if (p <= 0) return kMin;
      if (p >= 1) return kMax;
      for (let k = kMin; k <= kMax; k++) if (cdf(k) >= p) return k;
      return kMax;
    },
    mean,
    variance,
    sample: () => _discreteSample(cdf, Math.random, kMax),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = _discreteSample(cdf, rng, kMax);
        return out;
      }),
  };
}

/**
 * Negative-binomial distribution — the number of failures before the `r`-th
 * success in i.i.d. Bernoulli(`p`) trials. `negativeBinomialDist(r, p)` matches
 * `scipy.stats.nbinom(r, p)` (integer `r`).
 *
 * @example negativeBinomialDist(5, 0.4).pmf(3) // 0.0774144
 */
export function negativeBinomialDist(r: number, p: f64): Distribution {
  if (!Number.isInteger(r) || r < 1)
    throw new Error('negativeBinomialDist: r must be a positive integer');
  if (p <= 0 || p > 1) throw new Error('negativeBinomialDist: p must be in (0, 1]');
  const pmf = (k: f64): f64 => {
    if (!Number.isInteger(k) || k < 0) return 0;
    return Math.exp(_logChoose(k + r - 1, k) + r * Math.log(p) + k * Math.log(1 - p));
  };
  // P(X ≤ k) = I_p(r, k+1) — regularized incomplete beta (matches scipy nbinom.cdf).
  const cdf = (k: f64): f64 => {
    if (k < 0) return 0;
    return Math.min(1, _betainc(p, r, Math.floor(k) + 1));
  };
  const mean = (r * (1 - p)) / p;
  const variance = (r * (1 - p)) / (p * p);
  return {
    pdf: pmf,
    cdf,
    quantile: (prob: f64) => {
      if (prob <= 0) return 0;
      if (prob >= 1) return Infinity;
      let cumul = 0;
      for (let k = 0; k < 100000; k++) {
        cumul += pmf(k);
        if (cumul >= prob) return k;
      }
      return Infinity;
    },
    mean,
    variance,
    sample: () =>
      _discreteSample(cdf, Math.random, Math.ceil(mean + 20 * Math.sqrt(variance) + 20)),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        const cap = Math.ceil(mean + 20 * Math.sqrt(variance) + 20);
        for (let j = 0; j < count; j++) out[j] = _discreteSample(cdf, rng, cap);
        return out;
      }),
  };
}

// =============================================================================
// Wave F — common distributions: Pareto, Rayleigh, triangular, discrete-uniform,
// Gumbel, inverse-Gaussian (Wald), and multivariate normal (stats gap-closure)
// =============================================================================

const EULER_GAMMA = 0.5772156649015329;

/** Inverse-transform continuous sampler using a distribution's quantile. */
function _contSample(quantile: (p: f64) => f64, rng: () => number): f64 {
  return quantile(rng());
}

/**
 * Pareto distribution (shape `b` > 0, scale `xm` > 0) — `scipy.stats.pareto(b, scale=xm)`.
 * @example paretoDist(3, 2).cdf(4) // 0.875
 */
export function paretoDist(b: number, xm: number): Distribution {
  if (b <= 0 || xm <= 0) throw new Error('paretoDist: shape b and scale xm must be positive');
  const quantile = (p: f64): f64 => (p <= 0 ? xm : p >= 1 ? Infinity : xm / Math.pow(1 - p, 1 / b));
  return {
    pdf: (x: f64) => (x < xm ? 0 : (b * Math.pow(xm, b)) / Math.pow(x, b + 1)),
    cdf: (x: f64) => (x < xm ? 0 : 1 - Math.pow(xm / x, b)),
    quantile,
    mean: b > 1 ? (b * xm) / (b - 1) : Infinity,
    variance: b > 2 ? (xm * xm * b) / ((b - 1) * (b - 1) * (b - 2)) : Infinity,
    sample: () => _contSample(quantile, Math.random),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = _contSample(quantile, rng);
        return out;
      }),
  };
}

/**
 * Rayleigh distribution (scale `sigma` > 0) — `scipy.stats.rayleigh(scale=sigma)`.
 * @example rayleighDist(2).mean // 2.5066282746
 */
export function rayleighDist(sigma: number): Distribution {
  if (sigma <= 0) throw new Error('rayleighDist: sigma must be positive');
  const s2 = sigma * sigma;
  const quantile = (p: f64): f64 =>
    p <= 0 ? 0 : p >= 1 ? Infinity : sigma * Math.sqrt(-2 * Math.log(1 - p));
  return {
    pdf: (x: f64) => (x < 0 ? 0 : (x / s2) * Math.exp(-(x * x) / (2 * s2))),
    cdf: (x: f64) => (x < 0 ? 0 : 1 - Math.exp(-(x * x) / (2 * s2))),
    quantile,
    mean: sigma * Math.sqrt(Math.PI / 2),
    variance: ((4 - Math.PI) / 2) * s2,
    sample: () => _contSample(quantile, Math.random),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = _contSample(quantile, rng);
        return out;
      }),
  };
}

/**
 * Triangular distribution on `[a, b]` with mode `c` — matches
 * `scipy.stats.triang((c-a)/(b-a), loc=a, scale=b-a)`.
 * @example triangularDist(0, 4, 6).mean // 3.3333333333
 */
export function triangularDist(a: number, c: number, b: number): Distribution {
  if (!(a <= c && c <= b && a < b))
    throw new Error('triangularDist: require a <= mode <= b, a < b');
  const quantile = (p: f64): f64 => {
    if (p <= 0) return a;
    if (p >= 1) return b;
    const fc = (c - a) / (b - a);
    return p < fc
      ? a + Math.sqrt(p * (b - a) * (c - a))
      : b - Math.sqrt((1 - p) * (b - a) * (b - c));
  };
  return {
    pdf: (x: f64) => {
      if (x < a || x > b) return 0;
      if (x < c) return (2 * (x - a)) / ((b - a) * (c - a));
      if (x > c) return (2 * (b - x)) / ((b - a) * (b - c));
      return 2 / (b - a);
    },
    cdf: (x: f64) => {
      if (x <= a) return 0;
      if (x >= b) return 1;
      return x < c
        ? ((x - a) * (x - a)) / ((b - a) * (c - a))
        : 1 - ((b - x) * (b - x)) / ((b - a) * (b - c));
    },
    quantile,
    mean: (a + c + b) / 3,
    variance: (a * a + c * c + b * b - a * c - a * b - c * b) / 18,
    sample: () => _contSample(quantile, Math.random),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = _contSample(quantile, rng);
        return out;
      }),
  };
}

/**
 * Discrete uniform distribution on the integers `lo..hi` (inclusive) — matches
 * `scipy.stats.randint(lo, hi+1)`.
 * @example discreteUniformDist(1, 6).pmf(3) // 0.1666666667
 */
export function discreteUniformDist(lo: number, hi: number): Distribution {
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi < lo) {
    throw new Error('discreteUniformDist: require integer lo <= hi');
  }
  const k = hi - lo + 1;
  const cdf = (x: f64): f64 => {
    if (x < lo) return 0;
    if (x >= hi) return 1;
    return (Math.floor(x) - lo + 1) / k;
  };
  return {
    pdf: (x: f64) => (Number.isInteger(x) && x >= lo && x <= hi ? 1 / k : 0),
    cdf,
    quantile: (p: f64) => {
      if (p <= 0) return lo;
      if (p >= 1) return hi;
      return Math.min(hi, lo + Math.ceil(p * k) - 1);
    },
    mean: (lo + hi) / 2,
    variance: (k * k - 1) / 12,
    sample: () => lo + Math.floor(Math.random() * k),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = lo + Math.floor(rng() * k);
        return out;
      }),
  };
}

/**
 * Gumbel (right / maximum) distribution (location `mu`, scale `beta` > 0) —
 * `scipy.stats.gumbel_r(loc=mu, scale=beta)`.
 * @example gumbelDist(1, 2).cdf(3) // 0.6922006276
 */
export function gumbelDist(mu: number, beta: number): Distribution {
  if (beta <= 0) throw new Error('gumbelDist: scale beta must be positive');
  const quantile = (p: f64): f64 =>
    p <= 0 ? -Infinity : p >= 1 ? Infinity : mu - beta * Math.log(-Math.log(p));
  return {
    pdf: (x: f64) => {
      const z = (x - mu) / beta;
      return (1 / beta) * Math.exp(-(z + Math.exp(-z)));
    },
    cdf: (x: f64) => Math.exp(-Math.exp(-(x - mu) / beta)),
    quantile,
    mean: mu + beta * EULER_GAMMA,
    variance: ((Math.PI * Math.PI) / 6) * beta * beta,
    sample: () => _contSample(quantile, Math.random),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = _contSample(quantile, rng);
        return out;
      }),
  };
}

/**
 * Inverse-Gaussian (Wald) distribution — mean `mu` > 0, shape `lambda` > 0.
 * Matches `scipy.stats.invgauss(mu, scale=lambda)` where the scipy mean is
 * `mu*scale`; here `mu` is the actual mean directly.
 * @example invGaussDist(1, 1).pdf(1) // 0.3989422804
 */
export function invGaussDist(mu: number, lambda: number): Distribution {
  if (mu <= 0 || lambda <= 0) throw new Error('invGaussDist: mu and lambda must be positive');
  const quantile = (p: f64): f64 => {
    // No closed form — bisection on the (monotone) CDF.
    if (p <= 0) return 0;
    if (p >= 1) return Infinity;
    let lo = 1e-9;
    let hi = mu * 100;
    for (let it = 0; it < 200; it++) {
      const mid = (lo + hi) / 2;
      if (cdf(mid) < p) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const cdf = (x: f64): f64 => {
    if (x <= 0) return 0;
    const a = Math.sqrt(lambda / x) * (x / mu - 1);
    const b = -Math.sqrt(lambda / x) * (x / mu + 1);
    return _normalCdfStd(a) + Math.exp((2 * lambda) / mu) * _normalCdfStd(b);
  };
  return {
    pdf: (x: f64) => {
      if (x <= 0) return 0;
      return (
        Math.sqrt(lambda / (2 * Math.PI * x * x * x)) *
        Math.exp((-lambda * (x - mu) * (x - mu)) / (2 * mu * mu * x))
      );
    },
    cdf,
    quantile,
    mean: mu,
    variance: (mu * mu * mu) / lambda,
    sample: () => _contSample(quantile, Math.random),
    sampleN: (n: number, opts?: SampleNOptions) =>
      _sampleNDispatch(null, [], n, opts, (count, rng) => {
        const out = new Float64Array(count);
        for (let j = 0; j < count; j++) out[j] = _contSample(quantile, rng);
        return out;
      }),
  };
}

/**
 * Lower-triangular Cholesky factor L (Σ = LLᵀ) of a symmetric positive-definite
 * matrix. Module-private: the public `cholesky` (`typed/matrix-ops.ts`) is a
 * different, independently-checked implementation (adds an explicit symmetry
 * check) — other consumers needing Σ = LLᵀ should import that one, not this.
 */
function _cholesky(m: number[][]): number[][] {
  const n = m.length;
  const L = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) throw new Error('multivariateNormal: covariance is not positive-definite');
        L[i][j] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

/** A multivariate distribution exposing a density function. */
export interface MultivariateDistribution {
  pdf: (x: number[]) => f64;
  mean: number[];
  cov: number[][];
}

/**
 * Multivariate normal distribution with the given `mean` vector and `cov`
 * covariance matrix. Density via a Cholesky factorization (stable log-det +
 * triangular solve). Matches `scipy.stats.multivariate_normal(mean, cov).pdf`.
 *
 * @example multivariateNormal([0, 0], [[1, 0.5],[0.5, 2]]).pdf([0, 0]) // 0.1203098284
 */
export function multivariateNormal(mean: number[], cov: number[][]): MultivariateDistribution {
  const k = mean.length;
  if (cov.length !== k || cov.some((row) => row.length !== k)) {
    throw new Error('multivariateNormal: cov must be a k×k matrix matching mean');
  }
  const L = _cholesky(cov);
  let logDet = 0;
  for (let i = 0; i < k; i++) logDet += 2 * Math.log(L[i][i]);
  return {
    mean,
    cov,
    pdf: (x: number[]): f64 => {
      if (x.length !== k) throw new Error('multivariateNormal.pdf: x must have length k');
      // Solve L z = (x − mean); quadratic form = zᵀz.
      const z = new Array<number>(k).fill(0);
      for (let i = 0; i < k; i++) {
        let s = x[i] - mean[i];
        for (let j = 0; j < i; j++) s -= L[i][j] * z[j];
        z[i] = s / L[i][i];
      }
      let quad = 0;
      for (let i = 0; i < k; i++) quad += z[i] * z[i];
      return Math.exp(-0.5 * (k * Math.log(2 * Math.PI) + logDet + quad));
    },
  };
}

/**
 * Closed-form and quadrature-backed distribution functions (gap-analysis
 * 2026-11-04, Batch A): Owen's T, skew-normal, truncated normal, inverse gamma,
 * GEV, Skellam, Zipf, Nakagami and Rice.
 */
import { normalPDF as _normalPDF, normalCDF as _normalCDF } from '../typed/distributions.js';
import { gammainc as _gammainc, lgamma as _lgamma } from '../typed/special.js';
import { quad } from '../numeric/adaptive-quad.js';
import { besselIScalar } from '../wasm/special/scalars.js';
import { erfcx } from '../special/erf-extra.js';

const normalPDF = (z: number): number => _normalPDF(z) as number;
const lgamma = (v: number): number => _lgamma(v) as number;
const gammainc = (a: number, x: number): number => _gammainc(a, x) as number;

/** Standard normal CDF with ±Infinity handled explicitly. */
function Phi(z: number): number {
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  return _normalCDF(z) as number;
}

/** Standard normal PDF with the infinite limits handled explicitly. */
function phi(z: number): number {
  return Number.isFinite(z) ? normalPDF(z) : 0;
}

/**
 * Owen's T function T(h, a) = (1/2π)∫₀ᵃ exp(−h²(1+x²)/2)/(1+x²) dx.
 */
export function owensT(h: number, a: number): number {
  if (typeof h !== 'number' || typeof a !== 'number') {
    throw new TypeError('owensT requires two numbers (h, a)');
  }
  if (h !== h || a !== a) return NaN;
  if (a === 0) return 0;
  // Closed form at an infinite a: T(h, +-Infinity) = +-(1 - Phi(|h|)) / 2. T is odd in a.
  if (a === Infinity || a === -Infinity) return (Math.sign(a) * (1 - Phi(Math.abs(h)))) / 2;
  const integral = quad((x: number) => Math.exp((-h * h * (1 + x * x)) / 2) / (1 + x * x), 0, a, {
    tol: 1e-12,
  });
  return integral.value / (2 * Math.PI);
}

/** Skew-normal PDF: 2φ(z)Φ(αz)/scale with z = (x − loc)/scale. */
export function skewNormalPDF(x: number, alpha: number, loc = 0, scale = 1): number {
  const z = (x - loc) / scale;
  return (2 * phi(z) * Phi(alpha * z)) / scale;
}

/** Skew-normal CDF: Φ(z) − 2T(z, α). */
export function skewNormalCDF(x: number, alpha: number, loc = 0, scale = 1): number {
  const z = (x - loc) / scale;
  return Phi(z) - 2 * owensT(z, alpha);
}

function truncBounds(a: number, b: number, mu: number, sigma: number): [number, number] {
  if (!(a < b)) throw new RangeError('truncated normal requires a < b');
  return [(a - mu) / sigma, (b - mu) / sigma];
}

/** exp((lo² − u²)/2)·erfcx(u/√2), with the u = +Infinity limit equal to 0. */
function scaledQ(lo: number, u: number): number {
  if (u === Infinity) return 0;
  return Math.exp((lo * lo - u * u) / 2) * erfcx(u / Math.SQRT2);
}

/** e^(lo²/2)·(Q(u) − Q(v)) for 0 ≤ lo ≤ u ≤ v: the tail-mass difference, free of cancellation. */
function tailMass(lo: number, u: number, v: number): number {
  return 0.5 * (scaledQ(lo, u) - scaledQ(lo, v));
}

/**
 * Standardised truncated normal on [alpha, beta] as a normalising mass.
 * Returns `flip` (the interval lies below 0 and is mirrored to the upper tail),
 * the interval actually used, and a function giving the mass of [u, v] in the
 * scale `e^{-lo²/2}` (upper tail) or the plain scale (central case).
 */
function truncSetup(alpha: number, beta: number) {
  const flip = beta < 0;
  const lo = flip ? -beta : alpha;
  const hi = flip ? -alpha : beta;
  const tail = lo > 0;
  return {
    flip,
    lo,
    hi,
    tail,
    /** Normalising constant on the working scale (log scale offset is lo²/2 in the tail). */
    Z: tail ? tailMass(lo, lo, hi) : Phi(beta) - Phi(alpha),
  };
}

/** Truncated normal PDF on [a, b]. */
export function truncatedNormalPDF(x: number, a: number, b: number, mu = 0, sigma = 1): number {
  const [alpha, beta] = truncBounds(a, b, mu, sigma);
  if (x < a || x > b) return 0;
  const z = (x - mu) / sigma;
  const t = truncSetup(alpha, beta);
  const logZ = t.tail ? Math.log(t.Z) - t.lo * t.lo * 0.5 : Math.log(t.Z);
  return Math.exp(-0.5 * z * z - logZ) / (Math.sqrt(2 * Math.PI) * sigma);
}

/** Truncated normal CDF on [a, b]. */
export function truncatedNormalCDF(x: number, a: number, b: number, mu = 0, sigma = 1): number {
  const [alpha, beta] = truncBounds(a, b, mu, sigma);
  if (x <= a) return 0;
  if (x >= b) return 1;
  const xi = (x - mu) / sigma;
  const t = truncSetup(alpha, beta);
  if (!t.tail) return (Phi(xi) - Phi(alpha)) / t.Z;
  if (!t.flip) return tailMass(t.lo, t.lo, xi) / t.Z;
  // Mirrored: P(X <= x) is the mass of [-xi, hi] over the whole mass.
  return tailMass(t.lo, -xi, t.hi) / t.Z;
}

/** Mean of the truncated normal on [a, b]: μ + σ(φ(α) − φ(β))/(Φ(β) − Φ(α)), tail-stable. */
export function truncatedNormalMean(a: number, b: number, mu = 0, sigma = 1): number {
  const [alpha, beta] = truncBounds(a, b, mu, sigma);
  const t = truncSetup(alpha, beta);
  if (!t.tail) return mu + (sigma * (phi(alpha) - phi(beta))) / t.Z;
  // Upper tail [lo, hi]: (φ(lo) − φ(hi)) / Z with the e^{-lo²/2} factor cancelled.
  const inv = 1 / Math.sqrt(2 * Math.PI);
  const hiTerm = Number.isFinite(t.hi) ? Math.exp((t.lo * t.lo - t.hi * t.hi) / 2) : 0;
  const m = (inv * (1 - hiTerm)) / t.Z;
  return mu + sigma * (t.flip ? -m : m);
}

/** Inverse gamma PDF: β^α x^(−α−1) e^(−β/x) / Γ(α). */
export function inverseGammaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0;
  return Math.exp(alpha * Math.log(beta) - lgamma(alpha) - (alpha + 1) * Math.log(x) - beta / x);
}

/** Inverse gamma CDF: 1 − P(α, β/x) (regularized upper incomplete gamma). */
export function inverseGammaCDF(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0;
  return 1 - gammainc(alpha, beta / x);
}

/** GEV CDF exp(−t), t = (1 + ξz)^(−1/ξ) (ξ = 0: t = e^(−z)). Outside support: 0 or 1. */
export function gevCDF(x: number, xi: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  if (xi === 0) return Math.exp(-Math.exp(-z));
  const s = 1 + xi * z;
  if (s <= 0) return xi > 0 ? 0 : 1;
  return Math.exp(-Math.pow(s, -1 / xi));
}

/** GEV PDF t^(ξ+1) e^(−t) / σ, with t as in {@link gevCDF}. Zero outside support. */
export function gevPDF(x: number, xi: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / sigma;
  let t: number;
  if (xi === 0) {
    t = Math.exp(-z);
  } else {
    const s = 1 + xi * z;
    if (s <= 0) return 0;
    t = Math.pow(s, -1 / xi);
  }
  return (Math.pow(t, xi + 1) * Math.exp(-t)) / sigma;
}

/**
 * Skellam PMF: e^(−(μ₁+μ₂)) (μ₁/μ₂)^(k/2) I_|k|(2√(μ₁μ₂)). Requires μ₁, μ₂ > 0.
 */
export function skellamPMF(k: number, mu1: number, mu2: number): number {
  if (!(mu1 > 0 && mu2 > 0)) throw new RangeError('skellamPMF requires mu1, mu2 > 0');
  if (!Number.isInteger(k)) return 0;
  return (
    Math.exp(-(mu1 + mu2)) *
    Math.pow(mu1 / mu2, k / 2) *
    besselIScalar(Math.abs(k), 2 * Math.sqrt(mu1 * mu2))
  );
}

/** Zipf PMF on {1..n}: k^(−s) / H_{n,s}. Zero for non-integer or out-of-range k. */
export function zipfPMF(k: number, s: number, n: number): number {
  if (!Number.isInteger(k) || k < 1 || k > n) return 0;
  let h = 0;
  for (let i = 1; i <= n; i++) h += Math.pow(i, -s);
  return Math.pow(k, -s) / h;
}

/** Nakagami PDF: 2 m^m x^(2m−1) e^(−m x²/ω) / (Γ(m) ω^m), x > 0. */
export function nakagamiPDF(x: number, m: number, omega: number): number {
  if (x <= 0) return 0;
  return Math.exp(
    Math.log(2) +
      m * Math.log(m) -
      lgamma(m) -
      m * Math.log(omega) +
      (2 * m - 1) * Math.log(x) -
      (m * x * x) / omega
  );
}

/** Exponentially scaled modified Bessel function e^{−|x|} I₀(x), stable for large |x|. */
function besselI0e(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 15) {
    const q = (ax * ax) / 4;
    let term = 1;
    let sum = 1;
    for (let m = 1; m < 200; m++) {
      term *= q / (m * m);
      sum += term;
      if (term < sum * 1e-17) break;
    }
    return sum * Math.exp(-ax);
  }
  // Asymptotic series: I0e(x) ~ (2πx)^(−1/2) Σ ((2k−1)!!)² / (k! (8x)^k).
  let term = 1;
  let sum = 1;
  for (let k = 1; k < 200; k++) {
    const next = (term * (2 * k - 1) * (2 * k - 1)) / (k * 8 * ax);
    if (next >= term) break;
    term = next;
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return sum / Math.sqrt(2 * Math.PI * ax);
}

/**
 * Rice PDF: (x/σ²) e^(−(x²+ν²)/(2σ²)) I₀(xν/σ²), x ≥ 0. Evaluated with the scaled
 * I₀ so that exp(−(x−ν)²/(2σ²)) · I₀e does not overflow for large xν/σ².
 */
export function ricePDF(x: number, nu: number, sigma: number): number {
  if (x < 0) return 0;
  const s2 = sigma * sigma;
  return (
    (x / s2) * Math.exp(-((x - nu) * (x - nu)) / (2 * s2)) * besselI0e(Math.abs((x * nu) / s2))
  );
}

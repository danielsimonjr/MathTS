/**
 * Closed-form and quadrature-backed distribution functions (gap-analysis
 * 2026-11-04, Batch A): Owen's T, skew-normal, truncated normal, inverse gamma,
 * GEV, Skellam, Zipf, Nakagami and Rice.
 */
import { normalPDF as _normalPDF, normalCDF as _normalCDF } from '../typed/distributions.js';
import { gammainc as _gammainc, lgamma as _lgamma } from '../typed/special.js';
import { quad } from '../numeric/adaptive-quad.js';
import { besselIScalar } from '../wasm/special/scalars.js';

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
  if (a === 0) return 0;
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

/** Truncated normal PDF on [a, b]. */
export function truncatedNormalPDF(x: number, a: number, b: number, mu = 0, sigma = 1): number {
  const [alpha, beta] = truncBounds(a, b, mu, sigma);
  if (x < a || x > b) return 0;
  return phi((x - mu) / sigma) / (sigma * (Phi(beta) - Phi(alpha)));
}

/** Truncated normal CDF on [a, b]. */
export function truncatedNormalCDF(x: number, a: number, b: number, mu = 0, sigma = 1): number {
  const [alpha, beta] = truncBounds(a, b, mu, sigma);
  if (x <= a) return 0;
  if (x >= b) return 1;
  return (Phi((x - mu) / sigma) - Phi(alpha)) / (Phi(beta) - Phi(alpha));
}

/** Mean of the truncated normal on [a, b]: μ + σ(φ(α) − φ(β))/(Φ(β) − Φ(α)). */
export function truncatedNormalMean(a: number, b: number, mu = 0, sigma = 1): number {
  const [alpha, beta] = truncBounds(a, b, mu, sigma);
  return mu + (sigma * (phi(alpha) - phi(beta))) / (Phi(beta) - Phi(alpha));
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

/** Rice PDF: (x/σ²) e^(−(x²+ν²)/(2σ²)) I₀(xν/σ²), x ≥ 0. */
export function ricePDF(x: number, nu: number, sigma: number): number {
  if (x < 0) return 0;
  const s2 = sigma * sigma;
  return (x / s2) * Math.exp(-(x * x + nu * nu) / (2 * s2)) * besselIScalar(0, (x * nu) / s2);
}

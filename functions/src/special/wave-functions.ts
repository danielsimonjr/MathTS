/**
 * Advanced niche special functions: the Riemann–Siegel Z-function, the Lerch
 * transcendent, the parabolic-cylinder function D_ν, and the regular Coulomb
 * wave function F_L.
 *
 * These follow the same plain-exported-function pattern as `niche.ts` and
 * `hypergeometric.ts` — pure real-valued `number -> number` math with no
 * typed-function array/WASM dispatch overloads. Each is oracle-pinned against
 * `mpmath` (dps=30) in `functions/tests/gap-special-wave-oracle.test.ts`.
 *
 * The self-contained complex-arithmetic helpers here (complex log-gamma via
 * Lanczos, and a critical-line Borwein ζ evaluator) exist so these functions
 * stay pure `number`-in/`number`-out and do not need the factory `zeta`
 * (which requires a full math instance with a Complex constructor).
 *
 * @packageDocumentation
 */

import { _lgamma } from '../wasm/special/scalars.js';
import { hyp1f1 } from './hypergeometric.js';

/** 64-bit float (default for decimals) */
type f64 = number;

/** A complex value as an explicit real/imaginary pair. */
interface Cx {
  re: f64;
  im: f64;
}

/** Relative convergence tolerance: stop once |term| < RELTOL * |sum|. */
const RELTOL = 1e-16;

// =============================================================================
// Minimal complex-arithmetic helpers (real/imaginary pairs)
// =============================================================================

function cMul(a: Cx, b: Cx): Cx {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cInv(a: Cx): Cx {
  const d = a.re * a.re + a.im * a.im;
  return { re: a.re / d, im: -a.im / d };
}

function cAdd(a: Cx, b: Cx): Cx {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cDiv(a: Cx, b: Cx): Cx {
  return cMul(a, cInv(b));
}

/** Complex modulus |a|. */
function cAbs(a: Cx): f64 {
  return Math.hypot(a.re, a.im);
}

/** Complex natural logarithm (principal branch). */
function cLog(a: Cx): Cx {
  return { re: 0.5 * Math.log(a.re * a.re + a.im * a.im), im: Math.atan2(a.im, a.re) };
}

/** Complex sine, sin(x + iy) = sin x cosh y + i cos x sinh y. */
function cSin(a: Cx): Cx {
  return { re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) };
}

// Lanczos g=7, n=9 — identical coefficients to `_lgamma` in scalars.ts, used
// here for the *complex* log-gamma needed by the Riemann–Siegel theta and the
// Coulomb normalization constant.
const LANCZOS_G = 7;
const LANCZOS_C = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/**
 * Complex log-gamma ln Γ(z) via the Lanczos approximation, with the reflection
 * formula ln Γ(z) = ln(π / sin(π z)) − ln Γ(1 − z) for Re(z) < 1/2.
 */
function lnGammaComplex(z: Cx): Cx {
  if (z.re < 0.5) {
    const sinPiZ = cSin({ re: Math.PI * z.re, im: Math.PI * z.im });
    const lnSin = cLog(sinPiZ);
    const rest = lnGammaComplex({ re: 1 - z.re, im: -z.im });
    return { re: Math.log(Math.PI) - lnSin.re - rest.re, im: -lnSin.im - rest.im };
  }
  const x: Cx = { re: z.re - 1, im: z.im };
  let sum: Cx = { re: LANCZOS_C[0], im: 0 };
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    const dr = x.re + i;
    const di = x.im;
    const denom = dr * dr + di * di;
    sum = { re: sum.re + (LANCZOS_C[i] * dr) / denom, im: sum.im - (LANCZOS_C[i] * di) / denom };
  }
  const t: Cx = { re: x.re + LANCZOS_G + 0.5, im: x.im };
  const lnT = cLog(t);
  const lnSum = cLog(sum);
  const half: Cx = { re: x.re + 0.5, im: x.im };
  const p = cMul(half, lnT);
  return {
    re: 0.5 * Math.log(2 * Math.PI) + p.re - t.re + lnSum.re,
    im: p.im - t.im + lnSum.im,
  };
}

/** Factorial of a small nonnegative integer (double-precision beyond ~18). */
function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// =============================================================================
// Riemann–Siegel Z-function
// =============================================================================

/**
 * Riemann–Siegel theta function θ(t) = arg Γ(1/4 + it/2) − (t/2) ln π,
 * evaluated exactly through the complex log-gamma (valid for all t > 0, unlike
 * the classical asymptotic series which degrades below t ≈ 10).
 */
function riemannSiegelTheta(t: f64): f64 {
  const lg = lnGammaComplex({ re: 0.25, im: t / 2 });
  return lg.im - (t / 2) * Math.log(Math.PI);
}

/**
 * Borwein `d_k(n)` coefficient (Gourdon–Sebah form, matching the factory
 * `zeta`'s series): d_k(n) = n · (k + Σ_{j=k}^{n} (n+j−1)! 4^j / ((n−j)! (2j)!)).
 */
function borweinD(k: number, n: number): number {
  let S = k;
  for (let j = k; j <= n; j++) {
    S += (factorial(n + j - 1) * Math.pow(4, j)) / (factorial(n - j) * factorial(2 * j));
  }
  return n * S;
}

/**
 * ζ(1/2 + it) on the critical line via the Borwein acceleration of the
 * alternating (eta) series — the same algorithm the factory `zeta` uses, here
 * specialized to `Re(s) = 1/2` and evaluated in explicit complex arithmetic so
 * it needs no Complex constructor. Accurate to ~1e-13 for |t| up to ~40.
 */
function zetaCriticalLine(t: f64): Cx {
  const n = Math.round(1.3 * 20 + 0.9 * Math.abs(t));

  // 2^{1-s} = 2^{1/2} · (cos(t ln2) − i sin(t ln2)); 1 − 2^{1-s}.
  const ln2 = Math.LN2;
  const mag = Math.SQRT2;
  const den: Cx = { re: 1 - mag * Math.cos(t * ln2), im: mag * Math.sin(t * ln2) };
  const d0 = borweinD(0, n);
  const c = cInv(cMul({ re: d0, im: 0 }, den));

  // S = Σ_{k=1}^{n} (-1)^{k-1} d_k / k^s, with 1/k^s = k^{-1/2}(cos − i sin)(t ln k).
  let Sr = 0;
  let Si = 0;
  for (let k = 1; k <= n; k++) {
    const sign = (k - 1) % 2 === 0 ? 1 : -1;
    const dk = borweinD(k, n);
    const lnk = Math.log(k);
    const kpow = 1 / Math.sqrt(k);
    Sr += sign * dk * kpow * Math.cos(t * lnk);
    Si += sign * dk * kpow * -Math.sin(t * lnk);
  }
  return cMul(c, { re: Sr, im: Si });
}

/**
 * Riemann–Siegel Z-function Z(t) = e^{iθ(t)} ζ(1/2 + it), the real-valued
 * function on the critical line whose real zeros coincide with the imaginary
 * parts of the non-trivial zeros of ζ. Z is even: Z(−t) = Z(t), and
 * Z(0) = ζ(1/2) ≈ −1.4603545088.
 *
 * Computed by evaluating ζ(1/2 + it) via the Borwein-accelerated series and
 * the theta function via the complex log-gamma, then taking the (real) product
 * — i.e. Z(t) = cos θ · Re ζ − sin θ · Im ζ. This exact-theta approach is
 * accurate for all t (the classical Riemann–Siegel asymptotic expansion, by
 * contrast, is inaccurate for the small t of the first few zeros).
 *
 * Verified against `mpmath.siegelz` (dps=30): relative error < 1e-11 for
 * O(1)-magnitude values and absolute error < 1e-9 near the first zeros
 * (t ≈ 14.13, 21.02, 25.01), for |t| up to ~40.
 *
 * @param t - Height on the critical line (real; any sign)
 * @returns Z(t)
 *
 * @example
 * siegelZ(15) // ~0.7199423913
 * siegelZ(14.134725) // ~-1.12e-7 (near the first zeta zero)
 */
export function siegelZ(t: f64): f64 {
  const at = Math.abs(t);
  const z = zetaCriticalLine(at);
  const th = riemannSiegelTheta(at);
  return Math.cos(th) * z.re - Math.sin(th) * z.im;
}

/**
 * Alias for {@link siegelZ} — the Riemann–Siegel Z-function Z(t).
 */
export function riemannSiegelZ(t: f64): f64 {
  return siegelZ(t);
}

// =============================================================================
// Lerch transcendent
// =============================================================================

/** Hard cap on Lerch series terms (|z| very close to 1 converges slowly). */
const LERCH_MAX_TERMS = 200000;

/**
 * Lerch transcendent Φ(z, s, a) = Σ_{k≥0} z^k / (a + k)^s, evaluated by its
 * defining power series (DLMF 25.14.1), which converges for `|z| < 1` and any
 * real `s`, provided `a > 0` (so no denominator vanishes).
 *
 * Analytic continuation to `|z| ≥ 1` is out of scope and throws. The boundary
 * case Φ(1, s, a) = ζ(s, a) is the Hurwitz zeta, not implemented here.
 *
 * Cross-check: the polylogarithm satisfies `Li_s(z) = z · Φ(z, s, 1)`.
 *
 * Verified against `mpmath.lerchphi` (dps=30) to relative error < 1e-12 across
 * real `z ∈ (−1, 1)` and assorted `s`, `a`.
 *
 * @param z - Argument, must satisfy `|z| < 1`
 * @param s - Order (any real number)
 * @param a - Offset (real, `a > 0`)
 * @returns Φ(z, s, a)
 * @throws {Error} If `|z| >= 1`, or if `a + k <= 0` for some term (a <= 0)
 *
 * @example
 * lerchPhi(0.5, 2, 1) // ~1.1644810529 (= 2·Li_2(0.5))
 */
export function lerchPhi(z: f64, s: f64, a: f64): f64 {
  if (Math.abs(z) >= 1) {
    throw new Error('lerchPhi: only |z| < 1 is supported (analytic continuation not implemented)');
  }
  if (a <= 0) {
    throw new Error('lerchPhi: a must be > 0');
  }

  let sum: f64 = 0;
  let zk: f64 = 1;
  for (let k = 0; k < LERCH_MAX_TERMS; k++) {
    const term = zk / Math.pow(a + k, s);
    sum += term;
    if (k > 1 && Math.abs(term) < Math.abs(sum) * RELTOL) break;
    zk *= z;
  }
  return sum;
}

// =============================================================================
// Parabolic cylinder function D_nu(x)
// =============================================================================

/** Reciprocal gamma 1/Γ(y) (finite/zero at the poles y = 0, -1, -2, …). */
function recipGamma(y: f64): f64 {
  if (y > 0) return Math.exp(-_lgamma(y));
  if (y === Math.floor(y)) return 0; // 1/Γ = 0 at nonpositive-integer poles
  // Reflection: 1/Γ(y) = sin(π y) Γ(1 − y) / π.
  return (Math.sin(Math.PI * y) * Math.exp(_lgamma(1 - y))) / Math.PI;
}

/**
 * Parabolic cylinder function D_ν(x) (Whittaker's form), via the confluent
 * hypergeometric representation (Abramowitz & Stegun 19.3.1 / DLMF 12.4.1):
 *
 *   D_ν(x) = 2^{ν/2} e^{−x²/4} [ √π / Γ((1−ν)/2) · M(−ν/2; 1/2; x²/2)
 *                              − √(2π) x / Γ(−ν/2) · M((1−ν)/2; 3/2; x²/2) ]
 *
 * where M = ₁F₁ is Kummer's function (`hyp1f1`). The even/odd split makes this
 * valid for any real order ν and any real x (D_ν is entire in x); accuracy is
 * best for moderate |x| where the ₁F₁ series converges without heavy
 * cancellation.
 *
 * Verified against `mpmath.pcfd` (dps=30) to relative error < 1e-10 on a corpus
 * of real (ν, x) with |x| ≤ ~2.
 *
 * @param nu - Order (real)
 * @param x - Argument (real)
 * @returns D_ν(x)
 *
 * @example
 * parabolicCylinderD(0, 1) // ~0.7788007831 (= e^{-1/4})
 */
export function parabolicCylinderD(nu: f64, x: f64): f64 {
  const z = (x * x) / 2;
  const even = recipGamma((1 - nu) / 2) * hyp1f1(-nu / 2, 0.5, z);
  const odd = recipGamma(-nu / 2) * hyp1f1((1 - nu) / 2, 1.5, z);
  return (
    Math.pow(2, nu / 2) *
    Math.exp(-(x * x) / 4) *
    (Math.sqrt(Math.PI) * even - Math.sqrt(2 * Math.PI) * x * odd)
  );
}

// =============================================================================
// Regular Coulomb wave function F_L(eta, rho)
// =============================================================================

/** Hard cap on the Coulomb F power-series length. */
const COULOMB_MAX_TERMS = 5000;

/**
 * Coulomb normalization constant
 *   C_L(η) = 2^L e^{−πη/2} |Γ(L+1+iη)| / Γ(2L+2)
 * (DLMF 33.2.5), with |Γ(L+1+iη)| = exp(Re ln Γ(L+1+iη)) from the complex
 * log-gamma. Reduces to C_0(0) = 1.
 */
function coulombC(L: f64, eta: f64): f64 {
  const lg = lnGammaComplex({ re: L + 1, im: eta });
  const absGamma = Math.exp(lg.re);
  return (
    (Math.pow(2, L) * Math.exp((-Math.PI * eta) / 2) * absGamma) / Math.exp(_lgamma(2 * L + 2))
  );
}

/**
 * Regular Coulomb wave function F_L(η, ρ), via its ascending power series
 * (DLMF 33.6.1–33.6.2):
 *
 *   F_L(η, ρ) = C_L(η) ρ^{L+1} Σ_{k≥0} A_k ρ^k,
 *   A_0 = 1, A_1 = η/(L+1), A_k = (2η A_{k−1} − A_{k−2}) / (k (k + 2L + 1)).
 *
 * The series is entire in ρ, so this converges for all ρ ≥ 0 (accuracy is best
 * for small-to-moderate ρ before large-argument cancellation sets in). The
 * *irregular* companion G_L is provided by {@link coulombG} / {@link coulombFG}
 * via Steed's continued-fraction method.
 *
 * Verified against `mpmath.coulombf` (dps=30) to relative error < 1e-6 (in
 * practice < 1e-9 away from zeros) for L ∈ {0,1,2,3}, |η| ≤ 5, ρ ≤ 10.
 *
 * Special case: F_0(0, ρ) = sin ρ.
 *
 * @param L - Orbital angular momentum (real, `L >= 0`)
 * @param eta - Sommerfeld parameter (real)
 * @param rho - Radial variable (real, `rho >= 0`)
 * @returns F_L(η, ρ)
 * @throws {Error} If `rho < 0` or `L < 0`
 *
 * @example
 * coulombF(0, 0, 1) // ~0.8414709848 (= sin 1)
 */
export function coulombF(L: f64, eta: f64, rho: f64): f64 {
  if (rho < 0) {
    throw new Error('coulombF: rho must be >= 0');
  }
  if (L < 0) {
    throw new Error('coulombF: L must be >= 0');
  }
  if (rho === 0) return 0;

  let aPrev2 = 0; // A_{-1}
  let aPrev1 = 1; // A_0
  let sum = 1; // A_0 · ρ^0
  let rhoK = 1;
  for (let k = 1; k < COULOMB_MAX_TERMS; k++) {
    const ak = (2 * eta * aPrev1 - aPrev2) / (k * (k + 2 * L + 1));
    rhoK *= rho;
    const term = ak * rhoK;
    sum += term;
    aPrev2 = aPrev1;
    aPrev1 = ak;
    // Skip the convergence test on exactly-zero terms (η = 0 makes every other
    // A_k vanish; an early break there would truncate e.g. F_0(0,ρ) = sin ρ).
    if (k > 2 && term !== 0 && Math.abs(term) < Math.abs(sum) * RELTOL) break;
  }
  return coulombC(L, eta) * Math.pow(rho, L + 1) * sum;
}

// =============================================================================
// Irregular Coulomb wave function G_L(eta, rho) — Steed's method
// =============================================================================

/** Hard cap on continued-fraction iterations (Lentz). */
const CF_MAX_ITERS = 200000;
/** Relative convergence tolerance for the Lentz continued fractions. */
const CF_TOL = 1e-15;
/**
 * Modified-Lentz floor (Numerical Recipes' FPMIN). Must stay well above √MIN so
 * that the hand-rolled complex reciprocal `re² + im²` does not underflow to 0
 * (which would divide by zero); 1e-30 squared is 1e-60, safely representable.
 */
const CF_TINY = 1e-30;

/**
 * CF1 (DLMF 33.8.1): the continued fraction for u = F'_L/F_L,
 *   u = S_{L+1} − R²_{L+1}/(T_{L+1} − R²_{L+2}/(T_{L+2} − ⋯)),
 * with S_ℓ = ℓ/ρ + η/ℓ, R²_ℓ = 1 + η²/ℓ², T_ℓ = S_ℓ + S_{ℓ+1} (DLMF 33.4).
 * Converges for all finite ρ > 0. Evaluated by the modified Lentz algorithm.
 */
function coulombCF1(L: f64, eta: f64, rho: f64): f64 {
  const S = (l: number): number => l / rho + eta / l;
  const R2 = (l: number): number => 1 + (eta * eta) / (l * l);
  const T = (l: number): number => S(l) + S(l + 1);

  const b0 = S(L + 1);
  let f = b0 !== 0 ? b0 : CF_TINY;
  let C = f;
  let D = 0;
  for (let n = 1; n <= CF_MAX_ITERS; n++) {
    const an = -R2(L + n);
    const bn = T(L + n);
    D = bn + an * D;
    if (Math.abs(D) < CF_TINY) D = CF_TINY;
    C = bn + an / C;
    if (Math.abs(C) < CF_TINY) C = CF_TINY;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < CF_TOL) break;
  }
  return f;
}

/**
 * CF2 (DLMF 33.8.2–33.8.3): the complex continued fraction for the logarithmic
 * derivative of the outgoing Coulomb function H⁺ = G + iF,
 *   p + iq = (H⁺)'/H⁺ = c + (i/ρ) · ab/(d₁ + (a+1)(b+1)/(d₂ + ⋯)),
 * with a = 1 + L + iη, b = −L + iη, c = i(1 − η/ρ), dₖ = 2(ρ − η + k·i).
 * Converges for ρ above the turning point; slow/imprecise far below it.
 * Evaluated by the complex modified Lentz algorithm.
 */
function coulombCF2(L: f64, eta: f64, rho: f64): Cx {
  const a: Cx = { re: 1 + L, im: eta };
  const b: Cx = { re: -L, im: eta };
  const c: Cx = { re: 0, im: 1 - eta / rho };

  let f: Cx = { re: CF_TINY, im: 0 };
  let C: Cx = f;
  let D: Cx = { re: 0, im: 0 };
  for (let n = 1; n <= CF_MAX_ITERS; n++) {
    // aₙ = (a + n−1)(b + n−1), dₙ = 2(ρ − η + n·i)
    const an = cMul({ re: a.re + (n - 1), im: a.im }, { re: b.re + (n - 1), im: b.im });
    const dn: Cx = { re: 2 * (rho - eta), im: 2 * n };
    D = cAdd(dn, cMul(an, D));
    if (cAbs(D) < CF_TINY) D = { re: CF_TINY, im: 0 };
    C = cAdd(dn, cDiv(an, C));
    if (cAbs(C) < CF_TINY) C = { re: CF_TINY, im: 0 };
    D = cInv(D);
    const delta = cMul(C, D);
    f = cMul(f, delta);
    if (cAbs({ re: delta.re - 1, im: delta.im }) < CF_TOL) break;
  }
  // p + iq = c + (i/ρ) · f
  const iOverRho: Cx = { re: 0, im: 1 / rho };
  return cAdd(c, cMul(iOverRho, f));
}

/** The four Coulomb radial functions at a point: F, F′, G, G′. */
export interface CoulombFG {
  /** Regular function F_L(η, ρ). */
  F: f64;
  /** Derivative F′_L(η, ρ) = dF/dρ. */
  Fp: f64;
  /** Irregular function G_L(η, ρ). */
  G: f64;
  /** Derivative G′_L(η, ρ) = dG/dρ. */
  Gp: f64;
}

/**
 * Core of Steed's method: recover {F, F′, G, G′} from CF1 (u = F′/F), CF2
 * (p + iq), and the Wronskian F′G − FG′ = 1 (DLMF 33.8.4–33.8.5):
 *   F  = ± ((u−p)²/q + q)^{−1/2},   F′ = u·F,
 *   G  = (u−p)·F/q,                 G′ = (u·p − p² − q²)·F/q.
 * The sign of F is taken from the ascending-series {@link coulombF} (reliable
 * across the whole domain — only the sign is needed, not the magnitude).
 */
function coulombSteed(L: f64, eta: f64, rho: f64): CoulombFG {
  if (rho <= 0) {
    throw new Error('coulombG: rho must be > 0 (G is singular at the origin)');
  }
  if (L < 0) {
    throw new Error('coulombG: L must be >= 0');
  }

  const sign = coulombF(L, eta, rho) >= 0 ? 1 : -1;
  const u = coulombCF1(L, eta, rho);
  const { re: p, im: q } = coulombCF2(L, eta, rho);

  const F = sign / Math.sqrt(((u - p) * (u - p)) / q + q);
  const Fp = u * F;
  const G = ((u - p) * F) / q;
  const Gp = ((u * p - p * p - q * q) * F) / q;
  return { F, Fp, G, Gp };
}

/**
 * Irregular Coulomb wave function G_L(η, ρ), the second (non-oscillatory-at-
 * origin) solution of the Coulomb radial equation, computed by Steed's
 * continued-fraction method (Barnett 1982): CF1 for F′/F (DLMF 33.8.1), CF2 for
 * (G′+iF′)/(G+iF) (DLMF 33.8.2), then Steed recovery via the Wronskian
 * F′G − FG′ = 1 (DLMF 33.8.4–33.8.5). The sign of the regular solution is taken
 * from {@link coulombF}.
 *
 * Special case: G_0(0, ρ) = cos ρ.
 *
 * **Validated domain** (vs `mpmath.coulombg`, dps=30): for the turning point
 * ρ_tp = η + √(η² + L(L+1)), accuracy is ~1e-12 at and above ρ_tp and stays
 * below 1e-6 down to ρ ≈ 0.15·ρ_tp. CF2 degrades *far* below the turning point:
 * for large positive η with ρ ≪ ρ_tp (e.g. η = 5, ρ ≤ 1) the relative error
 * grows (up to ~1e-1 at L = 3, η = 5, ρ = 0.5). This is the well-known limit of
 * Steed's method deep in the classically-forbidden region; such points are
 * outside the validated domain. Verified to relative error < 1e-6 (in practice
 * ≤ 3e-10) for L ∈ {0,1,2,3}, |η| ≤ 5, ρ ∈ {0.5,…,20} excluding that corner.
 *
 * @param L - Orbital angular momentum (real, `L >= 0`)
 * @param eta - Sommerfeld parameter (real)
 * @param rho - Radial variable (real, `rho > 0`)
 * @returns G_L(η, ρ)
 * @throws {Error} If `rho <= 0` or `L < 0`
 *
 * @example
 * coulombG(0, 0, 1) // ~0.5403023059 (= cos 1)
 */
export function coulombG(L: f64, eta: f64, rho: f64): f64 {
  return coulombSteed(L, eta, rho).G;
}

/**
 * Both Coulomb wave functions and their derivatives at a point, returned
 * together: `{ F, Fp, G, Gp }` = {F_L, F′_L, G_L, G′_L}(η, ρ). Computed by
 * Steed's method in a single pass (see {@link coulombG}); the four values
 * satisfy the Wronskian F′G − FG′ = 1 to machine precision by construction.
 * The same validated domain as {@link coulombG} applies.
 *
 * @param L - Orbital angular momentum (real, `L >= 0`)
 * @param eta - Sommerfeld parameter (real)
 * @param rho - Radial variable (real, `rho > 0`)
 * @returns `{ F, Fp, G, Gp }`
 * @throws {Error} If `rho <= 0` or `L < 0`
 *
 * @example
 * coulombFG(0, 0, 1) // { F: sin 1, Fp: cos 1, G: cos 1, Gp: -sin 1 }
 */
export function coulombFG(L: f64, eta: f64, rho: f64): CoulombFG {
  return coulombSteed(L, eta, rho);
}

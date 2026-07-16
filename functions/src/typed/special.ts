/* eslint-disable no-loss-of-precision -- special-function math constants (Airy, etc.)
   are written at full precision and round to the nearest IEEE-754 double. */
/**
 * Typed Special Functions
 *
 * Special mathematical functions using typed-function for runtime dispatch.
 * Includes the error functions, beta/gamma functions, Bessel functions,
 * elliptic integrals, orthogonal polynomials and integral functions.
 *
 * Each single-argument function has a `Float64Array` overload that evaluates
 * the function across a whole array, parallelizing large inputs via the
 * worker pool. Multi-argument functions take a `Float64Array` for their
 * varying argument with the remaining parameters fixed.
 *
 * @packageDocumentation
 */

import { mathTyped, Complex } from '@danielsimonjr/mathts-core';
import { gammaG, gammaP } from '../plain/number/index.js';
import { elementwiseUnaryDispatch } from '../wasm/elementwise/wasm-bridge.js';
import { mapArray, kernelSource } from './parallel-map.js';
import {
  _lgamma,
  factorial,
  betaScalar,
  gammaincScalar,
  gammaincpScalar,
  betaincScalar,
  besselIScalar,
  besselHankel,
  besselJ0Series,
  besselJ1Series,
  besselY0Series,
  besselY1Series,
  besselJ0Scalar,
  besselJ1Scalar,
  besselY0Scalar,
  besselY1Scalar,
  besselJScalar,
  besselYScalar,
  airyUCoeffs,
  airyAsymPQ,
  airyAiScalar,
  airyBiScalar,
  ellipticKScalar,
  ellipticECompleteScalar,
} from '../wasm/special/scalars.js';
import {
  WASM_SPECIAL_THRESHOLD,
  besselJ0Dispatch,
  besselJ1Dispatch,
  besselJDispatch,
  besselY0Dispatch,
  besselY1Dispatch,
  besselYDispatch,
  airyAiDispatch,
  airyBiDispatch,
  ellipticKDispatch,
  ellipticEDispatch,
  lgammaDispatch,
  carlsonRCDispatch,
  carlsonRFDispatch,
  carlsonRDDispatch,
  carlsonRJDispatch,
  ellipticFIncompleteDispatch,
  ellipticEIncompleteDispatch,
  ellipticPiIncompleteDispatch,
  carlsonRCJS,
  carlsonRFJS,
  carlsonRDJS,
  carlsonRJJS,
  ellipticFIncompleteJS,
  ellipticEIncompleteJS,
  ellipticPiIncompleteJS,
  carlsonRCScalar,
  carlsonRFScalar,
  carlsonRDScalar,
  carlsonRJScalar,
  ellipticFIncompleteScalar,
  ellipticEIncompleteScalar,
  ellipticPiIncompleteScalar,
} from '../wasm/special/wasm-bridge.js';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Error function erf(x).
 *
 * Hybrid approximation:
 * - For |x| <= 0.5: Maclaurin series, converges to machine precision (~1e-15).
 * - For |x| > 0.5:  Numerical Recipes' `erfcc` rational form (NR in C, 2nd ed.,
 *                   §6.2), max relative error ~1.2e-7.
 */
// erf(|a|) by Maclaurin series; machine-accurate for a <~ 2.
function _erfSeries(a: f64): f64 {
  const c = 2 / Math.sqrt(Math.PI);
  let sum: f64 = a;
  let term: f64 = a;
  for (let n = 1; n < 80; n++) {
    term *= (-a * a) / n;
    const inc = term / (2 * n + 1);
    sum += inc;
    if (Math.abs(inc) < Math.abs(sum) * 1e-17) break;
  }
  return c * sum;
}

// erfc(a) for a > 0 via the Abramowitz & Stegun 7.1.14 continued fraction
// (modified Lentz). Computes the small tail value DIRECTLY — no 1 - erf
// cancellation. Converges well for a >~ 1.
function _erfcCF(a: f64): f64 {
  const tiny = 1e-300;
  let f = a < tiny ? tiny : a; // b_0 = a
  let C = f;
  let D = 0;
  for (let i = 1; i <= 300; i++) {
    const ai = i / 2; // partial numerator a_i = i/2
    D = a + ai * D;
    if (D === 0) D = tiny;
    D = 1 / D;
    C = a + ai / C;
    if (C === 0) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-a * a) / Math.sqrt(Math.PI) / f;
}

// =============================================================================
// Scalar Implementations
//
// Standalone function declarations (not closures): they can be called directly
// and serialized into self-contained worker kernels. They must not reference
// module-level state.
// =============================================================================

/** Complementary error function erfc(x) = 1 - erf(x). */
export function erfcScalar(x: f64): f64 {
  if (!isFinite(x)) return x > 0 ? 0 : 2;
  if (x < 0) return 2 - erfcScalar(-x); // erfc(-x) = 2 - erfc(x)
  // x small: 1 - erf (erfc ~ O(1), no cancellation). x large: direct CF tail.
  return x < 1.5 ? 1 - _erfSeries(x) : _erfcCF(x);
}

/** Imaginary error function erfi(x). */
function erfiScalar(x: f64): f64 {
  const c = 2 / Math.sqrt(Math.PI);
  let sum: f64 = 0;
  let term: f64 = x;
  for (let n = 0; n < 100; n++) {
    sum += term / (2 * n + 1);
    term *= (x * x) / (n + 1);
    if (Math.abs(term / (2 * n + 3)) < Math.abs(sum) * 1e-15) break;
  }
  return c * sum;
}

/** Digamma function psi(x) = d/dx ln(Gamma(x)). */
function digammaScalar(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return NaN;
  if (x < 0) {
    return digammaScalar(-x + 1) + Math.PI / Math.tan(Math.PI * -x);
  }

  let result = 0;
  let z = x;
  while (z < 8) {
    result -= 1 / z;
    z += 1;
  }

  result += Math.log(z) - 0.5 / z;
  const z2 = 1.0 / (z * z);
  const coeffs = [1.0 / 12, -1.0 / 120, 1.0 / 252, -1.0 / 240, 1.0 / 132, -691.0 / 32760, 1.0 / 12];
  let zPow = z2;
  for (const c of coeffs) {
    result -= c * zPow;
    zPow *= z2;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Bessel J0/J1/Y0/Y1 scalars (besselHankel/besselJ*Series/besselY*Series and
// besselJ0/J1/Y0/Y1/J/Y scalars) live in ../wasm/special/scalars.ts — single
// source of truth shared with the WASM-bridge JS fallbacks. They stay
// self-contained (inlined literals) so kernelSource can serialize them.
// ---------------------------------------------------------------------------

// Modified Bessel K asymptotic (x large): K_nu(x) ~ sqrt(pi/(2x)) e^{-x} Sum a_k/x^k,
//   a_0 = 1, a_k = a_{k-1}(4nu^2 - (2k-1)^2)/(8k); summed to optimal truncation.
function besselKAsym(nu: f64, x: f64): f64 {
  const mu = 4 * nu * nu;
  let a = 1.0;
  let xk = 1.0;
  let sum = 1.0;
  let prevMag = Infinity;
  for (let k = 1; k <= 40; k++) {
    const t1 = 2 * k - 1;
    a = (a * (mu - t1 * t1)) / (8 * k);
    xk *= x;
    const t = a / xk;
    if (Math.abs(t) > prevMag) break;
    prevMag = Math.abs(t);
    sum += t;
  }
  return Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x) * sum;
}

// K0 ascending series (DLMF 10.31.2):
//   K0 = -(ln(x/2)+gamma) I0(x) + sum_{k>=1} H_k (x^2/4)^k/(k!)^2.
function besselK0Series(x: f64): f64 {
  const z = 0.25 * x * x;
  let t = 1.0; // (x^2/4)^k/(k!)^2
  let I0 = 1.0;
  let h = 0.0;
  let s = 0.0;
  for (let k = 1; k <= 80; k++) {
    t *= z / (k * k);
    I0 += t;
    h += 1 / k;
    s += h * t;
    if (k > 2 && t <= I0 * 1e-18) break;
  }
  return -(Math.log(0.5 * x) + 0.5772156649015328606) * I0 + s;
}

// K1 ascending series (DLMF 10.31.2, n=1):
//   K1 = 1/x + (x/2)(ln(x/2)+gamma) S1 - (x/4) S2,
//   w_k = (x^2/4)^k/(k!(k+1)!), S1 = sum w_k, S2 = sum (H_k + H_{k+1}) w_k.
function besselK1Series(x: f64): f64 {
  const z = 0.25 * x * x;
  let w = 1.0;
  let S1 = 1.0;
  let hk = 0.0;
  let hk1 = 1.0;
  let S2 = (hk + hk1) * 1.0; // k=0
  for (let k = 1; k <= 80; k++) {
    w *= z / (k * (k + 1));
    S1 += w;
    hk += 1 / k;
    hk1 += 1 / (k + 1);
    S2 += (hk + hk1) * w;
    if (k > 2 && w <= S1 * 1e-18) break;
  }
  return 1 / x + 0.5 * x * (Math.log(0.5 * x) + 0.5772156649015328606) * S1 - 0.25 * x * S2;
}

/** Modified Bessel function of the second kind, K_n(x). */
function besselKScalar(n: f64, x: f64): f64 {
  const ni = Math.round(Math.abs(n));
  if (x <= 0) return NaN;
  // Series for small x, asymptotic above. Crossover at 8 (not 9): the ascending series subtracts
  // two O(I0(x)) terms to leave a tiny K(x), so its cancellation error grows with x — measured
  // ~5e-9 at x=9. The asymptotic overtakes it by x≈8.5, so 8 caps the peak near the crossover at
  // ~1.6e-9 (vs 5.3e-9 at 9). Machine precision across the gap needs a uniformly-accurate CF/Temme
  // method (see TODO); everywhere outside x∈[8,11] both branches are already ~1e-13 or better.
  const k0 = x <= 8 ? besselK0Series(x) : besselKAsym(0, x);
  const k1 = x <= 8 ? besselK1Series(x) : besselKAsym(1, x);
  if (ni === 0) return k0;
  if (ni === 1) return k1;
  // Upward recurrence in order is stable for K (K_n grows with n).
  let kPrev = k0;
  let kCurr = k1;
  for (let k = 1; k < ni; k++) {
    const kNext = ((2 * k) / x) * kCurr + kPrev;
    kPrev = kCurr;
    kCurr = kNext;
  }
  return kCurr;
}

// Complete elliptic integrals K(m) and E(m) — ellipticKScalar /
// ellipticECompleteScalar — live in ../wasm/special/scalars.ts (shared with the
// WASM-bridge JS fallbacks). The 2-arg Simpson form below is special.ts-only.

/** Incomplete elliptic integral of the second kind E(phi, m) via Simpson's rule. */
function ellipticEScalar(phi: f64, m: f64): f64 {
  const n = 100;
  const h = phi / n;
  const sinSq = (v: f64) => {
    const s = Math.sin(v);
    return s * s;
  };
  let sum = Math.sqrt(1 - m * sinSq(0)) + Math.sqrt(1 - m * sinSq(phi));
  for (let i = 1; i < n; i++) {
    const t = i * h;
    const weight = i % 2 === 0 ? 2 : 4;
    sum += weight * Math.sqrt(1 - m * sinSq(t));
  }
  return (h / 3) * sum;
}

/** Chebyshev polynomial of the first kind T_n(x). */
function chebyshevTScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (ni === 0) return 1;
  if (ni === 1) return x;
  let prev = 1,
    curr = x;
  for (let k = 2; k <= ni; k++) {
    const next = 2 * x * curr - prev;
    prev = curr;
    curr = next;
  }
  return curr;
}

/** Hermite polynomial H_n(x) (physicist's convention). */
function hermiteHScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (ni === 0) return 1;
  if (ni === 1) return 2 * x;
  let prev = 1,
    curr = 2 * x;
  for (let k = 2; k <= ni; k++) {
    const next = 2 * x * curr - 2 * (k - 1) * prev;
    prev = curr;
    curr = next;
  }
  return curr;
}

/** Laguerre polynomial L_n(x). */
function laguerreLScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (ni === 0) return 1;
  if (ni === 1) return 1 - x;
  let prev = 1,
    curr = 1 - x;
  for (let k = 2; k <= ni; k++) {
    const next = ((2 * k - 1 - x) * curr - (k - 1) * prev) / k;
    prev = curr;
    curr = next;
  }
  return curr;
}

/** Legendre polynomial P_n(x). */
function legendrePScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (ni === 0) return 1;
  if (ni === 1) return x;
  let prev = 1,
    curr = x;
  for (let k = 2; k <= ni; k++) {
    const next = ((2 * k - 1) * x * curr - (k - 1) * prev) / k;
    prev = curr;
    curr = next;
  }
  return curr;
}

/** Lambert W function (principal branch W_0). */
function lambertWScalar(x: f64): f64 {
  if (x < -1 / Math.E) return NaN;
  if (x === 0) return 0;
  if (x === Math.E) return 1;

  let w: f64;
  if (x < 1) {
    w = x;
  } else if (x < Math.E) {
    w = Math.log(x);
  } else {
    w = Math.log(x) - Math.log(Math.log(x));
  }

  for (let i = 0; i < 100; i++) {
    const ew = Math.exp(w);
    const wew = w * ew;
    const f = wew - x;
    const fp = ew * (w + 1);
    const fpp = ew * (w + 2);
    const dw = f / (fp - (f * fpp) / (2 * fp));
    w -= dw;
    if (Math.abs(dw) < 1e-15) break;
  }

  return w;
}

/** Lambert W function, lower real branch W_-1. Defined for x in [-1/e, 0); NaN otherwise. */
function lambertWm1Scalar(x: f64): f64 {
  if (x < -1 / Math.E || x >= 0) return NaN;
  if (x === -1 / Math.E) return -1;

  let w = Math.log(-x) - Math.log(-Math.log(-x));

  for (let i = 0; i < 60; i++) {
    const ew = Math.exp(w);
    const wew = w * ew;
    const f = wew - x;
    const fp = ew * (w + 1);
    const fpp = ew * (w + 2);
    const dw = f / (fp - (f * fpp) / (2 * fp));
    w -= dw;
    if (Math.abs(dw) < 1e-15) break;
  }

  return w;
}

/** Cosine integral Ci(x). */
function cosIntegralScalar(x: f64): f64 {
  if (x <= 0) return NaN;
  const euler = 0.5772156649015329;

  // The convergent power series (DLMF §6.6.4) is accurate in double precision up
  // to roughly x ~ 35 before catastrophic cancellation degrades it; the older
  // x <= 4 cutoff handed moderate x to a divergent asymptotic series that
  // produced wildly wrong values (e.g. Ci(10) overflowed to ~1e20). Use the
  // convergent series across its reliable range.
  if (x <= 35) {
    let sum: f64 = 0;
    let term: f64 = 1;
    for (let n = 1; n < 200; n++) {
      term *= (-x * x) / ((2 * n - 1) * (2 * n));
      sum += term / (2 * n);
      if (Math.abs(term / (2 * n)) < Math.abs(sum) * 1e-16) break;
    }
    return euler + Math.log(x) + sum;
  }

  // Auxiliary functions (DLMF §6.12.1):
  //   f(x) ~ (1/x) Σ_{n>=0} (-1)^n (2n)!   / x^{2n}
  //   g(x) ~ (1/x²) Σ_{n>=0} (-1)^n (2n+1)! / x^{2n}
  // Both series are *divergent* — sum only to the smallest term (standard
  // asymptotic practice). The successive-term ratios are (2n)(2n-1)/x² for f
  // and (2n+1)(2n)/x² for g.
  let f: f64 = 1,
    g: f64 = 1;
  let fn: f64 = 1,
    gn: f64 = 1;
  let fDone = false,
    gDone = false;
  for (let n = 1; n <= 60; n++) {
    const fnNext = (fn * (-(2 * n) * (2 * n - 1))) / (x * x);
    const gnNext = (gn * (-(2 * n + 1) * (2 * n))) / (x * x);
    if (!fDone) {
      if (Math.abs(fnNext) > Math.abs(fn)) fDone = true;
      else {
        fn = fnNext;
        f += fn;
      }
    }
    if (!gDone) {
      if (Math.abs(gnNext) > Math.abs(gn)) gDone = true;
      else {
        gn = gnNext;
        g += gn;
      }
    }
    if (fDone && gDone) break;
  }
  f = f / x;
  g = g / (x * x);
  return f * Math.sin(x) - g * Math.cos(x);
}

/** Sine integral Si(x). */
function sinIntegralScalar(x: f64): f64 {
  if (x === 0) return 0;

  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);

  let sum: f64 = 0;
  let term: f64 = ax;
  for (let n = 0; n < 100; n++) {
    sum += term / (2 * n + 1);
    term *= (-ax * ax) / ((2 * n + 2) * (2 * n + 3));
    if (Math.abs(term / (2 * n + 3)) < 1e-15) break;
  }

  return sign * sum;
}

/** Exponential integral Ei(x). */
function expIntegralEiScalar(x: f64): f64 {
  if (x === 0) return -Infinity;
  const euler = 0.5772156649015329;

  if (Math.abs(x) <= 40) {
    let sum: f64 = 0;
    let term: f64 = 1;
    for (let n = 1; n < 200; n++) {
      term *= x / n;
      sum += term / n;
      if (Math.abs(term / n) < Math.abs(sum) * 1e-15) break;
    }
    return euler + Math.log(Math.abs(x)) + sum;
  }

  let sum: f64 = 1;
  let term: f64 = 1;
  for (let n = 1; n <= 30; n++) {
    term *= n / x;
    sum += term;
    if (Math.abs(term) < 1e-15) break;
  }
  return (Math.exp(x) / x) * sum;
}

/** Logarithmic integral li(x) = Ei(ln(x)). */
function logIntegralScalar(x: f64): f64 {
  if (x <= 0 || x === 1) return NaN;
  return expIntegralEiScalar(Math.log(x));
}

/** Fresnel cosine integral C(x). */
function fresnelCScalar(x: f64): f64 {
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1;

  let sum: f64 = ax;
  let term: f64 = ax;
  const piHalf = Math.PI / 2;
  const x4 = ax * ax * ax * ax;

  for (let n = 1; n < 50; n++) {
    term *= (((-piHalf * piHalf * x4) / (2 * n * (2 * n - 1))) * (4 * n - 3)) / (4 * n + 1);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }

  return sign * sum;
}

// Airy scalars airyUCoeffs / airyAsymPQ / airyAiScalar / airyBiScalar live
// in ../wasm/special/scalars.ts (shared with the WASM-bridge JS fallbacks).

/** Fresnel sine integral S(x). */
function fresnelSScalar(x: f64): f64 {
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1;

  const piHalf = Math.PI / 2;
  let term: f64 = (piHalf * ax * ax * ax) / 3;
  let sum: f64 = term;
  const x4 = ax * ax * ax * ax;

  for (let n = 1; n < 50; n++) {
    term *= (((-piHalf * piHalf * x4) / ((2 * n + 1) * (2 * n))) * (4 * n - 1)) / (4 * n + 3);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }

  return sign * sum;
}

// =============================================================================
// Error Functions
// =============================================================================

/**
 * Complementary error function: erfc(x) = 1 - erf(x).
 *
 * @param x - Input value, or Float64Array of values
 * @returns 1 - erf(x)
 *
 * @example
 * erfc(0) // 1
 * erfc(1) // ~0.1573
 */
export const erfc = mathTyped('erfc', {
  number: erfcScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    const wasm = elementwiseUnaryDispatch('erfc', x);
    if (wasm) return Promise.resolve(wasm);
    return mapArray(x, erfcScalar, () =>
      kernelSource([_erfSeries, _erfcCF, erfcScalar], '(x) => erfcScalar(x)')
    );
  },
});

/**
 * Imaginary error function: erfi(x) = -i * erf(ix).
 *
 * @param x - Input value, or Float64Array of values
 * @returns erfi(x)
 */
export const erfi = mathTyped('erfi', {
  number: erfiScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, erfiScalar, () => kernelSource([erfiScalar], '(x) => erfiScalar(x)')),
});

// =============================================================================
// Beta and Gamma Functions
// =============================================================================

/**
 * Log-gamma function: lgamma(x) = log(|Γ(x)|).
 *
 * Poles at non-positive integers return +Infinity.
 * Negative non-integer inputs use the reflection formula.
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS via lgamma_f64_as, Slice 5.8).
 *
 * Reference values:
 *   lgamma(1)   = 0
 *   lgamma(2)   = 0
 *   lgamma(0.5) ≈ 0.5723649429247001 (ln(√π))
 *   lgamma(10)  ≈ 12.801827480081469
 *   lgamma(100) ≈ 359.13420536957544
 *
 * @param x - Input value, or Float64Array of values
 * @returns log(|Γ(x)|)
 */
/**
 * Principal-branch complex log-gamma via the Lanczos approximation (GC6).
 *
 * Matches mpmath.loggamma for Re(z) > 0; for Re(z) < 0.5 it uses Euler's
 * reflection. Uses the same Lanczos coefficients as the complex `gamma`, so the
 * two agree (lgamma(z) = log Γ(z) on this branch). Valid on the principal sheet;
 * for very large |Im(z)| the analytic continuation may differ by 2πi from
 * naive log(Γ(z)) — this evaluates the log-gamma series directly to avoid that.
 */
function lgammaComplex(z: Complex): Complex {
  if (z.re < 0.5) {
    // Reflection: lgamma(z) = log(π) − log(sin(πz)) − lgamma(1 − z)
    const piZ = new Complex(Math.PI * z.re, Math.PI * z.im);
    const refl = lgammaComplex(new Complex(1 - z.re, -z.im));
    return new Complex(Math.log(Math.PI), 0).sub(piZ.sin().log()).sub(refl);
  }
  const zc = new Complex(z.re - 1, z.im);
  let x: Complex = new Complex(gammaP[0], 0);
  for (let i = 1; i < gammaP.length; i++) {
    x = x.add(new Complex(gammaP[i], 0).div(zc.add(new Complex(i, 0))));
  }
  const t = new Complex(zc.re + gammaG + 0.5, zc.im);
  // 0.5·ln(2π) + (z+0.5)·ln(t) − t + ln(x)
  const halfLog2Pi = new Complex(0.5 * Math.log(2 * Math.PI), 0);
  const term = zc.add(new Complex(0.5, 0)).mul(t.log());
  return halfLog2Pi.add(term).sub(t).add(x.log());
}

export const lgamma = mathTyped('lgamma', {
  number: _lgamma,
  Complex: lgammaComplex,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(lgammaDispatch(x));
    }
    return mapArray(x, _lgamma, () => kernelSource([_lgamma], '(x) => _lgamma(x)'));
  },
});

/**
 * Beta function: B(a, b) = Gamma(a) * Gamma(b) / Gamma(a + b).
 *
 * @param a - First parameter (positive), or Float64Array of values
 * @param b - Second parameter (positive)
 * @returns B(a, b)
 *
 * @example
 * beta(2, 3) // 1/12 ~ 0.08333
 */
export const beta = mathTyped('beta', {
  'number, number': betaScalar,
  'Float64Array, number': (a: Float64Array, b: f64): Promise<Float64Array> =>
    mapArray(
      a,
      (v) => betaScalar(v, b),
      () => kernelSource([_lgamma, betaScalar], `(a) => betaScalar(a, ${b})`)
    ),
});

/**
 * Regularized lower incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a).
 *
 * @param a - Shape parameter (positive)
 * @param x - Integration upper limit, or Float64Array of limits
 * @returns P(a, x)
 *
 * @example
 * gammainc(1, 1) // 1 - 1/e ~ 0.6321
 */
export const gammainc = mathTyped('gammainc', {
  'number, number': gammaincScalar,
  'number, Float64Array': (a: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => gammaincScalar(a, v),
      () => kernelSource([_lgamma, gammaincScalar], `(x) => gammaincScalar(${a}, x)`)
    ),
});

/**
 * Upper (complementary) regularized incomplete gamma: Q(a, x) = 1 - P(a, x).
 *
 * @param a - Shape parameter (positive)
 * @param x - Lower limit, or Float64Array of limits
 * @returns Q(a, x)
 */
export const gammaincp = mathTyped('gammaincp', {
  'number, number': gammaincpScalar,
  'number, Float64Array': (a: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => gammaincpScalar(a, v),
      () =>
        kernelSource([_lgamma, gammaincScalar, gammaincpScalar], `(x) => gammaincpScalar(${a}, x)`)
    ),
});

/**
 * Regularized incomplete beta function I_x(a, b).
 *
 * @param a - First parameter (positive)
 * @param b - Second parameter (positive)
 * @param x - Upper limit in [0, 1], or Float64Array of limits
 * @returns I_x(a, b)
 */
export const betainc = mathTyped('betainc', {
  'number, number, number': betaincScalar,
  'number, number, Float64Array': (a: f64, b: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => betaincScalar(a, b, v),
      () => kernelSource([_lgamma, betaincScalar], `(x) => betaincScalar(${a}, ${b}, x)`)
    ),
});

/**
 * Digamma function: psi(x) = d/dx ln(Gamma(x)).
 *
 * @param x - Input value, or Float64Array of values
 * @returns psi(x)
 *
 * @example
 * digamma(1) // -gamma ~ -0.5772
 */
export const digamma = mathTyped('digamma', {
  number: digammaScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, digammaScalar, () => kernelSource([digammaScalar], '(x) => digammaScalar(x)')),
});

// =============================================================================
// Bessel Functions
// =============================================================================

/**
 * Bessel function of the first kind, order 0: J0(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS, Slice 3.10c-1); smaller inputs and
 * scalars use the inline JS approximation.
 *
 * @param x - Input value, or Float64Array of values
 * @returns J0(x)
 */
export const besselJ0 = mathTyped('besselJ0', {
  number: besselJ0Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(besselJ0Dispatch(x));
    }
    return mapArray(x, besselJ0Scalar, () =>
      kernelSource([besselHankel, besselJ0Series, besselJ0Scalar], '(x) => besselJ0Scalar(x)')
    );
  },
});

/**
 * Bessel function of the first kind, order 1: J1(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS, Slice 3.10c-1).
 *
 * @param x - Input value, or Float64Array of values
 * @returns J1(x)
 */
export const besselJ1 = mathTyped('besselJ1', {
  number: besselJ1Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(besselJ1Dispatch(x));
    }
    return mapArray(x, besselJ1Scalar, () =>
      kernelSource([besselHankel, besselJ1Series, besselJ1Scalar], '(x) => besselJ1Scalar(x)')
    );
  },
});

/**
 * Bessel function of the second kind, order 0: Y0(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS, Slice 3.10c-1, Y0).
 *
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns Y0(x)
 */
export const besselY0 = mathTyped('besselY0', {
  number: besselY0Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(besselY0Dispatch(x));
    }
    return mapArray(x, besselY0Scalar, () =>
      kernelSource(
        [besselHankel, besselJ0Series, besselY0Series, besselY0Scalar],
        '(x) => besselY0Scalar(x)'
      )
    );
  },
});

/**
 * Bessel function of the second kind, order 1: Y1(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS, Slice 3.10c-1, Y1).
 *
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns Y1(x)
 */
export const besselY1 = mathTyped('besselY1', {
  number: besselY1Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(besselY1Dispatch(x));
    }
    return mapArray(x, besselY1Scalar, () =>
      kernelSource(
        [besselHankel, besselJ1Series, besselY1Series, besselY1Scalar],
        '(x) => besselY1Scalar(x)'
      )
    );
  },
});

/**
 * Bessel function of the first kind, general integer order n: J_n(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS, Slice 3.10c-1, Jn).
 *
 * @param n - Order (integer)
 * @param x - Input value, or Float64Array of values
 * @returns J_n(x)
 */
export const besselJ = mathTyped('besselJ', {
  'number, number': besselJScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(besselJDispatch(n, x));
    }
    return mapArray(
      x,
      (v) => besselJScalar(n, v),
      () =>
        kernelSource(
          [
            besselHankel,
            besselJ0Series,
            besselJ1Series,
            besselJ0Scalar,
            besselJ1Scalar,
            besselJScalar,
          ],
          `(x) => besselJScalar(${n}, x)`
        )
    );
  },
});

/**
 * Bessel function of the second kind, general integer order n: Y_n(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS, Slice 3.10c-1, Yn).
 *
 * @param n - Order (integer)
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns Y_n(x)
 */
export const besselY = mathTyped('besselY', {
  'number, number': besselYScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(besselYDispatch(n, x));
    }
    return mapArray(
      x,
      (v) => besselYScalar(n, v),
      () =>
        kernelSource(
          [
            besselHankel,
            besselJ0Series,
            besselJ1Series,
            besselY0Series,
            besselY1Series,
            besselJ0Scalar,
            besselJ1Scalar,
            besselY0Scalar,
            besselY1Scalar,
            besselYScalar,
          ],
          `(x) => besselYScalar(${n}, x)`
        )
    );
  },
});

/**
 * Modified Bessel function of the first kind, I_n(x).
 *
 * @param n - Order (integer)
 * @param x - Input value, or Float64Array of values
 * @returns I_n(x)
 */
export const besselI = mathTyped('besselI', {
  'number, number': besselIScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => besselIScalar(n, v),
      () => kernelSource([factorial, _lgamma, besselIScalar], `(x) => besselIScalar(${n}, x)`)
    ),
});

/**
 * Modified Bessel function of the second kind, K_n(x).
 *
 * @param n - Order (integer)
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns K_n(x)
 */
export const besselK = mathTyped('besselK', {
  'number, number': besselKScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => besselKScalar(n, v),
      () =>
        kernelSource(
          [besselKAsym, besselK0Series, besselK1Series, besselKScalar],
          `(x) => besselKScalar(${n}, x)`
        )
    ),
});

// =============================================================================
// Elliptic Integrals
// =============================================================================

/**
 * Complete elliptic integral of the first kind K(m).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS via elliptic_k_f64_as, Slice 5.3).
 *
 * Algorithm: AGM (arithmetic-geometric mean) — K = π / (2·agm(1, √(1−m))).
 * Converges quadratically; ~10 iterations for full f64 precision.
 *
 * Domain: m ∈ [0, 1).  K(1) = +∞.  m < 0 or m > 1 → NaN.
 *
 * Reference values (DLMF §19.6):
 *   K(0) = π/2 ≈ 1.5707963267948966
 *   K(0.5) ≈ 1.8540746773013719
 *   K(0.99) ≈ 3.6956373629898747
 *
 * @param m - Parameter (0 <= m < 1), or Float64Array of parameters
 * @returns K(m)
 */
export const ellipticK = mathTyped('ellipticK', {
  number: ellipticKScalar,
  Float64Array: (m: Float64Array): Promise<Float64Array> => {
    if (m.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(ellipticKDispatch(m));
    }
    return mapArray(m, ellipticKScalar, () =>
      kernelSource([ellipticKScalar], '(m) => ellipticKScalar(m)')
    );
  },
});

/**
 * Elliptic integral of the second kind E(phi, m) or complete form E(m).
 *
 * With one number argument, returns the complete integral E(m).
 * With a Float64Array, dispatches the complete integral E(m) across the array.
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) use the WASM kernel
 * (AS via elliptic_e_f64_as, Slice 5.3).
 *
 * Algorithm: Carlson-Bulirsch AGM variant (complete form).
 * Domain: m ∈ [0, 1].  E(0) = π/2, E(1) = 1.  m < 0 or m > 1 → NaN.
 *
 * Reference values (DLMF §19.6):
 *   E(0) = π/2 ≈ 1.5707963267948966
 *   E(0.5) ≈ 1.3506438810476755
 *   E(1) = 1.0
 *
 * @param phi - Amplitude (radians), or Float64Array of m-values for complete form
 * @param m - Parameter (0 <= m <= 1)
 * @returns E(phi, m), or E(m) for the single-argument / array form
 */
export const ellipticE = mathTyped('ellipticE', {
  'number, number': ellipticEScalar,
  number: ellipticECompleteScalar,
  Float64Array: (m: Float64Array): Promise<Float64Array> => {
    if (m.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(ellipticEDispatch(m));
    }
    return mapArray(m, ellipticECompleteScalar, () =>
      kernelSource([ellipticEScalar, ellipticECompleteScalar], '(m) => ellipticECompleteScalar(m)')
    );
  },
});

// =============================================================================
// Orthogonal Polynomials
// =============================================================================

/**
 * Chebyshev polynomial of the first kind T_n(x).
 *
 * @param n - Degree
 * @param x - Input value, or Float64Array of values
 * @returns T_n(x)
 */
export const chebyshevT = mathTyped('chebyshevT', {
  'number, number': chebyshevTScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => chebyshevTScalar(n, v),
      () => kernelSource([chebyshevTScalar], `(x) => chebyshevTScalar(${n}, x)`)
    ),
});

/**
 * Hermite polynomial H_n(x) (physicist's convention).
 *
 * @param n - Degree
 * @param x - Input value, or Float64Array of values
 * @returns H_n(x)
 */
export const hermiteH = mathTyped('hermiteH', {
  'number, number': hermiteHScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => hermiteHScalar(n, v),
      () => kernelSource([hermiteHScalar], `(x) => hermiteHScalar(${n}, x)`)
    ),
});

/**
 * Laguerre polynomial L_n(x).
 *
 * @param n - Degree
 * @param x - Input value, or Float64Array of values
 * @returns L_n(x)
 */
export const laguerreL = mathTyped('laguerreL', {
  'number, number': laguerreLScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => laguerreLScalar(n, v),
      () => kernelSource([laguerreLScalar], `(x) => laguerreLScalar(${n}, x)`)
    ),
});

/**
 * Legendre polynomial P_n(x).
 *
 * @param n - Degree
 * @param x - Input value in [-1, 1], or Float64Array of values
 * @returns P_n(x)
 */
export const legendreP = mathTyped('legendreP', {
  'number, number': legendrePScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => legendrePScalar(n, v),
      () => kernelSource([legendrePScalar], `(x) => legendrePScalar(${n}, x)`)
    ),
});

// =============================================================================
// Lambert W Function
// =============================================================================

/**
 * Lambert W function.
 *
 * @param x - Input value (>= -1/e), or Float64Array of values
 * @param branch - Branch selector: 0 (default, principal branch W_0) or -1
 *   (lower real branch W_-1, defined for x in [-1/e, 0); NaN outside that range)
 * @returns W_branch(x)
 *
 * @example
 * lambertW(1) // ~0.5671 (omega constant)
 * lambertW(-0.3, -1) // ~-1.7813 (lower branch)
 */
export const lambertW = mathTyped('lambertW', {
  number: lambertWScalar,
  'number, number': (x: f64, branch: f64): f64 => {
    if (branch === 0) return lambertWScalar(x);
    if (branch === -1) return lambertWm1Scalar(x);
    throw new Error('lambertW: branch must be 0 or -1');
  },
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, lambertWScalar, () => kernelSource([lambertWScalar], '(x) => lambertWScalar(x)')),
});

// =============================================================================
// Integral Functions
// =============================================================================

/**
 * Cosine integral Ci(x).
 *
 * @param x - Input value (positive), or Float64Array of values
 * @returns Ci(x)
 */
export const cosIntegral = mathTyped('cosIntegral', {
  number: cosIntegralScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, cosIntegralScalar, () =>
      kernelSource([cosIntegralScalar], '(x) => cosIntegralScalar(x)')
    ),
});

/**
 * Sine integral Si(x).
 *
 * @param x - Input value, or Float64Array of values
 * @returns Si(x)
 */
export const sinIntegral = mathTyped('sinIntegral', {
  number: sinIntegralScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, sinIntegralScalar, () =>
      kernelSource([sinIntegralScalar], '(x) => sinIntegralScalar(x)')
    ),
});

/**
 * Logarithmic integral li(x) = Ei(ln(x)).
 *
 * @param x - Input value (> 0, != 1), or Float64Array of values
 * @returns li(x)
 */
export const logIntegral = mathTyped('logIntegral', {
  number: logIntegralScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, logIntegralScalar, () =>
      kernelSource([expIntegralEiScalar, logIntegralScalar], '(x) => logIntegralScalar(x)')
    ),
});

/**
 * Exponential integral Ei(x).
 *
 * @param x - Input value (x != 0), or Float64Array of values
 * @returns Ei(x)
 */
export const expIntegralEi = mathTyped('expIntegralEi', {
  number: expIntegralEiScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, expIntegralEiScalar, () =>
      kernelSource([expIntegralEiScalar], '(x) => expIntegralEiScalar(x)')
    ),
});

// =============================================================================
// Fresnel Integrals
// =============================================================================

/**
 * Fresnel cosine integral C(x) = integral_0^x cos(pi*t^2/2) dt.
 *
 * @param x - Input value, or Float64Array of values
 * @returns C(x)
 */
export const fresnelC = mathTyped('fresnelC', {
  number: fresnelCScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, fresnelCScalar, () => kernelSource([fresnelCScalar], '(x) => fresnelCScalar(x)')),
});

/**
 * Fresnel sine integral S(x) = integral_0^x sin(pi*t^2/2) dt.
 *
 * @param x - Input value, or Float64Array of values
 * @returns S(x)
 */
export const fresnelS = mathTyped('fresnelS', {
  number: fresnelSScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, fresnelSScalar, () => kernelSource([fresnelSScalar], '(x) => fresnelSScalar(x)')),
});

// =============================================================================
// Airy Functions
// =============================================================================

/**
 * Airy function of the first kind Ai(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS via airy_ai_f64_as, Slice 4.9).
 *
 * Algorithm:
 *   - |x| ≤ 4.5: power series (DLMF §9.2.2) — ~1e-10 relative error
 *   - x > 4.5:   decaying asymptotic exp(−ζ)/... (DLMF §9.7.3) — ~1e-7
 *   - x < −4.5:  oscillatory asymptotic sin/cos (DLMF §9.7.5) — ~1e-7
 *
 * Reference values (DLMF §9.2):
 *   Ai(0) ≈ 0.355028053887817
 *   Ai(1) ≈ 0.135292416312881
 *   Ai(−1) ≈ 0.535560883292352
 *
 * @param x - Input value, or Float64Array of values
 * @returns Ai(x)
 */
export const airyAi = mathTyped('airyAi', {
  number: airyAiScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(airyAiDispatch(x));
    }
    return mapArray(x, airyAiScalar, () =>
      kernelSource([airyUCoeffs, airyAsymPQ, airyAiScalar], '(x) => airyAiScalar(x)')
    );
  },
});

/**
 * Airy function of the second kind Bi(x).
 *
 * Arrays of length ≥ WASM_SPECIAL_THRESHOLD (1024) are dispatched to the
 * WASM kernel (AS via airy_bi_f64_as, Slice 4.9).
 *
 * Reference values (DLMF §9.2):
 *   Bi(0) ≈ 0.614926627446001
 *   Bi(1) ≈ 1.207423594952871
 *   Bi(−1) ≈ 0.103997389496945
 *
 * @param x - Input value, or Float64Array of values
 * @returns Bi(x)
 */
export const airyBi = mathTyped('airyBi', {
  number: airyBiScalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> => {
    if (x.length >= WASM_SPECIAL_THRESHOLD) {
      return Promise.resolve(airyBiDispatch(x));
    }
    return mapArray(x, airyBiScalar, () =>
      kernelSource([airyUCoeffs, airyAsymPQ, airyBiScalar], '(x) => airyBiScalar(x)')
    );
  },
});

// =============================================================================
// Carlson Symmetric Forms (Slice 6.4)
//
// Scalar inputs use the JS implementation directly.
// Float64Array inputs of length ≥ WASM_SPECIAL_THRESHOLD are dispatched to the
// WASM array kernel; smaller arrays use the JS fallback loop.
// =============================================================================

/**
 * Carlson degenerate symmetric integral RC(x, y).
 *
 * RC(x, y) = ∫_0^∞ dt / ((t+x)^{1/2} (t+y))
 *
 * Identities: RC(0, 1) = π/2; RC(1, 1) = 1.
 *
 * Reference: DLMF §19.16.6; Numerical Recipes §6.11.
 *
 * @param x - First argument (≥ 0), or Float64Array of values
 * @param y - Second argument (≠ 0), or Float64Array of values
 */
export const carlsonRC = mathTyped('carlsonRC', {
  'number, number': carlsonRCScalar,
  'Float64Array, Float64Array': (xs: Float64Array, ys: Float64Array): Float64Array => {
    if (xs.length >= WASM_SPECIAL_THRESHOLD) return carlsonRCDispatch(xs, ys);
    return carlsonRCJS(xs, ys);
  },
});

/**
 * Carlson symmetric integral RF(x, y, z).
 *
 * RF(x, y, z) = (1/2) ∫_0^∞ dt / (√(t+x)·√(t+y)·√(t+z))
 *
 * Symmetry: RF is symmetric in all three arguments.
 * Identity: RF(0, 1, 2) ≈ 1.3110287771461...
 *
 * Reference: DLMF §19.16.1; Numerical Recipes §6.11.
 */
export const carlsonRF = mathTyped('carlsonRF', {
  'number, number, number': carlsonRFScalar,
  'Float64Array, Float64Array, Float64Array': (
    xs: Float64Array,
    ys: Float64Array,
    zs: Float64Array
  ): Float64Array => {
    if (xs.length >= WASM_SPECIAL_THRESHOLD) return carlsonRFDispatch(xs, ys, zs);
    return carlsonRFJS(xs, ys, zs);
  },
});

/**
 * Carlson symmetric integral RD(x, y, z).
 *
 * RD(x, y, z) = (3/2) ∫_0^∞ dt / (√(t+x)·√(t+y)·(t+z)^{3/2})
 *
 * Identity: RD(0, 2, 1) ≈ 1.7972103521033...
 *
 * Reference: DLMF §19.16.5; Numerical Recipes §6.11.
 */
export const carlsonRD = mathTyped('carlsonRD', {
  'number, number, number': carlsonRDScalar,
  'Float64Array, Float64Array, Float64Array': (
    xs: Float64Array,
    ys: Float64Array,
    zs: Float64Array
  ): Float64Array => {
    if (xs.length >= WASM_SPECIAL_THRESHOLD) return carlsonRDDispatch(xs, ys, zs);
    return carlsonRDJS(xs, ys, zs);
  },
});

/**
 * Carlson symmetric integral RJ(x, y, z, p).
 *
 * RJ(x, y, z, p) = (3/2) ∫_0^∞ dt / ((t+p)·√(t+x)·√(t+y)·√(t+z))
 *
 * Reference: DLMF §19.16.2; Numerical Recipes §6.11.
 */
export const carlsonRJ = mathTyped('carlsonRJ', {
  'number, number, number, number': carlsonRJScalar,
  'Float64Array, Float64Array, Float64Array, Float64Array': (
    xs: Float64Array,
    ys: Float64Array,
    zs: Float64Array,
    ps: Float64Array
  ): Float64Array => {
    if (xs.length >= WASM_SPECIAL_THRESHOLD) return carlsonRJDispatch(xs, ys, zs, ps);
    return carlsonRJJS(xs, ys, zs, ps);
  },
});

// =============================================================================
// Incomplete Elliptic Integrals (Slice 6.4)
//
// Built atop Carlson R-forms (DLMF §19.25 Legendre–Carlson identities).
// `ellipticE` already exists as the complete integral (1-arg) and as the
// 2-arg form (phi, m) via Simpson quadrature.  The new `ellipticEIncomplete`
// is added as a separate export to avoid naming conflicts and to clarify that
// it uses the Carlson-based algorithm (higher accuracy than Simpson).
// =============================================================================

/**
 * Incomplete elliptic integral of the first kind F(φ, m).
 *
 * F(φ, m) = ∫_0^φ dθ / √(1 − m·sin²θ)
 *
 * Implemented via F(φ, m) = sin(φ)·RF(cos²φ, 1−m·sin²φ, 1) (DLMF §19.25.5).
 *
 * Special cases: F(0, m) = 0; F(π/2, m) = K(m).
 *
 * Reference values (DLMF §19.6): F(π/2, 0.5) = K(0.5) ≈ 1.8540746773013719.
 *
 * @param phi - Amplitude in [0, π/2]
 * @param m - Parameter in [0, 1)
 */
export const ellipticF = mathTyped('ellipticF', {
  'number, number': ellipticFIncompleteScalar,
  'Float64Array, Float64Array': (phis: Float64Array, ms: Float64Array): Float64Array => {
    if (phis.length >= WASM_SPECIAL_THRESHOLD) return ellipticFIncompleteDispatch(phis, ms);
    return ellipticFIncompleteJS(phis, ms);
  },
});

/**
 * Incomplete elliptic integral of the second kind E(φ, m) — Carlson form.
 *
 * E(φ, m) = ∫_0^φ √(1 − m·sin²θ) dθ
 *
 * Implemented via Carlson forms (DLMF §19.25.7):
 *   E(φ, m) = sin(φ)·RF(c², 1−m·s², 1) − (m/3)·s³·RD(c², 1−m·s², 1)
 *
 * Special cases: E(0, m) = 0; E(π/2, m) = E(m) (complete second kind).
 *
 * Named `ellipticEIncomplete` to distinguish from the existing `ellipticE`
 * export which handles both the complete form (1-arg) and the Simpson
 * 2-arg form.
 */
export const ellipticEIncomplete = mathTyped('ellipticEIncomplete', {
  'number, number': ellipticEIncompleteScalar,
  'Float64Array, Float64Array': (phis: Float64Array, ms: Float64Array): Float64Array => {
    if (phis.length >= WASM_SPECIAL_THRESHOLD) return ellipticEIncompleteDispatch(phis, ms);
    return ellipticEIncompleteJS(phis, ms);
  },
});

/**
 * Incomplete elliptic integral of the third kind Π(n, φ, m).
 *
 * Π(n, φ, m) = ∫_0^φ dθ / ((1 − n·sin²θ)·√(1 − m·sin²θ))
 *
 * Implemented via Carlson forms (DLMF §19.25.9):
 *   Π(n, φ, m) = sin(φ)·RF(c², 1−m·s², 1) + (n/3)·s³·RJ(c², 1−m·s², 1, 1−n·s²)
 *
 * Special cases: Π(n, 0, m) = 0; Π(n, π/2, m) = Π(n, m) (complete third kind).
 *
 * Reference: DLMF §19.6, Abramowitz & Stegun §17.7.
 */
export const ellipticPi = mathTyped('ellipticPi', {
  'number, number, number': ellipticPiIncompleteScalar,
  'Float64Array, Float64Array, Float64Array': (
    ns: Float64Array,
    phis: Float64Array,
    ms: Float64Array
  ): Float64Array => {
    if (ns.length >= WASM_SPECIAL_THRESHOLD) return ellipticPiIncompleteDispatch(ns, phis, ms);
    return ellipticPiIncompleteJS(ns, phis, ms);
  },
});

// =============================================================================
// Named Export Collection
// =============================================================================

/**
 * All typed special functions.
 */
export const typedSpecial = {
  erfc,
  lgamma,
  beta,
  gammainc,
  digamma,
  besselJ0,
  besselJ1,
  besselY0,
  besselY1,
  besselJ,
  besselY,
  besselI,
  besselK,
  betainc,
  gammaincp,
  ellipticK,
  ellipticE,
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
  lambertW,
  erfi,
  cosIntegral,
  sinIntegral,
  logIntegral,
  expIntegralEi,
  fresnelC,
  fresnelS,
  airyAi,
  airyBi,
  carlsonRC,
  carlsonRF,
  carlsonRD,
  carlsonRJ,
  ellipticF,
  ellipticEIncomplete,
  ellipticPi,
};

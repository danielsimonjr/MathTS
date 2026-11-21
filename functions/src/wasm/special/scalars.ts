/* eslint-disable no-loss-of-precision -- special-function math constants (Airy, etc.)
   are written at full precision and round to the nearest IEEE-754 double. */
/**
 * Canonical special-function scalar implementations.
 *
 * Single source of truth for the special-function scalars that are needed by
 * BOTH the typed dispatch surface (`functions/src/typed/special.ts`) and the
 * WASM dispatch bridge JS fallbacks (`functions/src/wasm/special/wasm-bridge.ts`).
 * Previously each of these scalars existed in two near-identical copies, so a
 * numeric fix to one could silently diverge `f(x)` (scalar / sub-threshold path)
 * from `f([x])` (≥-threshold WASM-fallback path). They now live here once.
 *
 * Serialization invariant (do NOT regress):
 *   Every function in this module is a standalone declaration that references
 *   ONLY `Math.*`, its own arguments, and the other functions in this module.
 *   It must NOT reference module-level constants or imports. This is required
 *   because `typed/special.ts` serializes these into self-contained worker
 *   kernels via `Function.prototype.toString()` (the worker `eval`s the text in
 *   an isolated context — see `kernelSource` / `packages/workerpool/src/worker.ts`).
 *   Numeric constants are therefore inlined as literals:
 *     Euler-gamma 0.5772156649015328606, 2/pi 0.63661977236758134308,
 *     1/pi 0.31830988618379067154, Bessel series/asymptotic split |x| = 13.
 *
 * @packageDocumentation
 */

/** 64-bit float (default for decimals) */
type f64 = number;

// =============================================================================
// sin(pi x), cos(pi x) and 1/Gamma(x)
// =============================================================================

/**
 * sin(pi x) with the argument reduced EXACTLY before it meets pi.
 *
 * `Math.sin(Math.PI * x)` rounds the product by ulp(pi * x), and next to a nonzero integer m the
 * sine is about pi * (x - m), so the result keeps only log10(|dist| / ulp(pi * x)) digits
 * (`sin(pi * -1.0000001)` is wrong from the tenth digit). Here `x - 2 * round(x / 2)` is exact
 * (a double of at most 53 bits, as the difference of two doubles that share their leading bits),
 * and so is `1 - a` for `a` in [0.5, 1]. The argument of `Math.sin` is then in [0, pi / 2] and
 * computed from an exact difference. The result is exactly 0 at an integer and exactly +-1 at a
 * half-integer. A non-finite x gives NaN. Standalone: `Math` only (see the serialization invariant).
 */
export function sinPiScalar(x: f64): f64 {
  const r = x - 2 * Math.round(x / 2);
  const a = Math.abs(r);
  const s = a > 0.5 ? Math.sin(Math.PI * (1 - a)) : Math.sin(Math.PI * a);
  return s === 0 ? 0 : r < 0 ? -s : s;
}

/**
 * cos(pi x) with the same exact reduction as `sinPiScalar`. The result is exactly 0 at a
 * half-integer and exactly +-1 at an integer. A non-finite x gives NaN. Standalone.
 */
export function cosPiScalar(x: f64): f64 {
  const a = Math.abs(x - 2 * Math.round(x / 2));
  if (a < 0.25) return Math.cos(Math.PI * a);
  if (a <= 0.75) return Math.sin(Math.PI * (0.5 - a));
  return -Math.cos(Math.PI * (1 - a));
}

// =============================================================================
// Log-gamma
// =============================================================================

/**
 * Log-gamma function using Lanczos approximation (g=7, n=9).
 * Poles at non-positive integers return +Infinity; negative non-integers use
 * the reflection formula.
 */
export function _lgamma(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    // Reflection: lgamma is log|Γ(x)|, so use |sin(πx)| — bare sin(πx) is
    // negative for negative non-integer x and would yield NaN. (The earlier
    // typed/special.ts copy used bare sin and returned NaN for e.g. -0.5; the
    // WASM-bridge copy used abs and was correct. Reconciled to the correct form.)
    // sinPiScalar reduces x exactly: Math.sin(Math.PI * x) lost digits next to an integer.
    const sinPiX = Math.abs(sinPiScalar(x));
    if (sinPiX === 0) return Infinity;
    return Math.log(Math.PI / sinPiX) - _lgamma(1 - x);
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

/**
 * Reciprocal gamma 1 / Gamma(z), with the sign of Gamma. It is 0 at a non-positive integer
 * (where Gamma has a pole) and exact in sign everywhere: for z < 0 the reflection
 * 1 / Gamma(z) = sin(pi z) Gamma(1 - z) / pi uses `sinPiScalar`. Overflows to +-Infinity when
 * Gamma(1 - z) does (1 - z above 171.6). A NaN z gives NaN.
 */
export function rgammaScalar(z: f64): f64 {
  if (z !== z) return NaN;
  if (z > 0) return Math.exp(-_lgamma(z));
  if (z === Math.floor(z)) return 0;
  return (sinPiScalar(z) * Math.exp(_lgamma(1 - z))) / Math.PI;
}

/**
 * Complementary error function erfc(x), accurate to ~1e-16 and tail-safe.
 * Self-contained (`Math` only, recursive by name) for worker `kernelSource` serialization.
 */
export function erfcSelfContained(x: f64): f64 {
  if (x !== x) return NaN;
  if (!isFinite(x)) return x > 0 ? 0 : 2;
  if (x < 0) return 2 - erfcSelfContained(-x);
  if (x < 1.5) {
    const c = 2 / Math.sqrt(Math.PI);
    let sum: f64 = x;
    let term: f64 = x;
    for (let n = 1; n < 80; n++) {
      term *= (-x * x) / n;
      const inc = term / (2 * n + 1);
      sum += inc;
      if (Math.abs(inc) < Math.abs(sum) * 1e-17) break;
    }
    return 1 - c * sum;
  }
  const tiny = 1e-300;
  let f: f64 = x;
  let C: f64 = f;
  let D: f64 = 0;
  for (let i = 1; i <= 300; i++) {
    const ai = i / 2;
    D = x + ai * D;
    if (D === 0) D = tiny;
    D = 1 / D;
    C = x + ai / C;
    if (C === 0) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

/** Complementary error function erfc(x) = 1 - erf(x); thin wrapper for typed dispatch. */
export function erfcScalar(x: f64): f64 {
  return erfcSelfContained(x);
}

/** Normal CDF Φ(x; μ, σ) = ½·erfc((μ−x)/(σ√2)); same-module for worker kernels. */
export function normalCDFScalar(x: f64, mu: f64, sigma: f64): f64 {
  if (!(sigma > 0)) return NaN;
  return 0.5 * erfcSelfContained((mu - x) / (sigma * Math.SQRT2));
}

// =============================================================================
// Bessel J0/J1/Y0/Y1: ascending series (|x| <= 13) + Hankel asymptotic (above),
// both with in-loop-generated coefficients. Validated to <1e-9 vs mpmath
// (tests/diff-special.test.mjs). Mirrors assembly/src/special.ts.
// =============================================================================

// Hankel asymptotic shared by J_nu/Y_nu (nu = 0 or 1):
//   J_nu ~ sqrt(2/(pi x)) [P cos(chi) - Q sin(chi)],
//   Y_nu ~ sqrt(2/(pi x)) [P sin(chi) + Q cos(chi)], chi = x - (nu/2+1/4)pi.
/**
 * Return the Hankel asymptotic value of the Bessel function J or Y of order `nu`.
 *
 * The series stops after 40 terms, or earlier when the terms start to grow. The scalar
 * Bessel functions use this value for arguments above 13, and the ascending series otherwise.
 *
 * @param nu - The order, 0 or 1.
 * @param x - The argument.
 * @param wantY - If true, return Y; if false, return J.
 */
export function besselHankel(nu: f64, x: f64, wantY: boolean): f64 {
  const mu = 4 * nu * nu;
  let P = 1.0;
  let Q = 0.0;
  let a = 1.0;
  let xk = 1.0;
  let prevMag = Infinity;
  for (let k = 1; k <= 40; k++) {
    const twokm1 = 2 * k - 1;
    a = (a * (mu - twokm1 * twokm1)) / (8 * k);
    xk *= x;
    const t = a / xk;
    const mag = Math.abs(t);
    if (mag > prevMag) break;
    prevMag = mag;
    const m4 = k & 3;
    const s = m4 === 1 || m4 === 0 ? 1.0 : -1.0;
    if ((k & 1) === 1) Q += s * t;
    else P += s * t;
  }
  const chi = x - (nu * 0.5 + 0.25) * Math.PI;
  const amp = Math.sqrt(2.0 / (Math.PI * x));
  return wantY
    ? amp * (P * Math.sin(chi) + Q * Math.cos(chi))
    : amp * (P * Math.cos(chi) - Q * Math.sin(chi));
}

/**
 * Return the Bessel function J0(x) from its ascending power series.
 *
 * The series stops after 80 terms, or earlier when a term is small relative to the sum.
 */
export function besselJ0Series(x: f64): f64 {
  const z = -0.25 * x * x;
  let term = 1.0;
  let sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * k);
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return sum;
}

/**
 * Return the Bessel function J1(x) from its ascending power series.
 *
 * The series stops after 80 terms, or earlier when a term is small relative to the sum.
 */
export function besselJ1Series(x: f64): f64 {
  const z = -0.25 * x * x;
  let term = 1.0;
  let sum = 1.0;
  for (let k = 1; k <= 80; k++) {
    term *= z / (k * (k + 1));
    sum += term;
    if (Math.abs(term) <= Math.abs(sum) * 1e-17) break;
  }
  return 0.5 * x * sum;
}

// Y0 = (2/pi)[ (ln(x/2)+gamma) J0 + sum_{k>=1} (-1)^{k+1} H_k (x^2/4)^k/(k!)^2 ].
/** Return the Bessel function Y0(x) from its ascending series. Use it for positive `x`. */
export function besselY0Series(x: f64): f64 {
  const z = 0.25 * x * x;
  let u = 1.0;
  let h = 0.0;
  let s = 0.0;
  let sign = 1.0;
  for (let k = 1; k <= 80; k++) {
    u *= z / (k * k);
    h += 1 / k;
    const d = sign * h * u;
    s += d;
    sign = -sign;
    if (k > 2 && Math.abs(d) <= Math.abs(s) * 1e-17) break;
  }
  return (
    0.63661977236758134308 * ((Math.log(0.5 * x) + 0.5772156649015328606) * besselJ0Series(x) + s)
  );
}

// Y1 = (2/pi)[ln(x/2)+gamma] J1 - 2/(pi x)
//      - (1/pi) sum_{k>=0} (-1)^k (H_k + H_{k+1}) (x/2)^{2k+1}/(k!(k+1)!).
/** Return the Bessel function Y1(x) from its ascending series. Use it for positive `x`. */
export function besselY1Series(x: f64): f64 {
  const z = -0.25 * x * x;
  let v = 0.5 * x;
  let hk = 0.0;
  let hk1 = 1.0;
  let s = (hk + hk1) * v;
  for (let k = 1; k <= 80; k++) {
    v *= z / (k * (k + 1));
    hk += 1 / k;
    hk1 += 1 / (k + 1);
    const d = (hk + hk1) * v;
    s += d;
    if (k > 2 && Math.abs(d) <= Math.abs(s) * 1e-17) break;
  }
  return (
    0.63661977236758134308 * (Math.log(0.5 * x) + 0.5772156649015328606) * besselJ1Series(x) -
    0.63661977236758134308 / x -
    0.31830988618379067154 * s
  );
}

/** Bessel function of the first kind, order 0: J0(x). */
export function besselJ0Scalar(x: f64): f64 {
  const ax = Math.abs(x);
  return ax <= 13.0 ? besselJ0Series(ax) : besselHankel(0, ax, false);
}

/** Bessel function of the first kind, order 1: J1(x). */
export function besselJ1Scalar(x: f64): f64 {
  const ax = Math.abs(x);
  const sign = x < 0 ? -1 : 1; // J1 is odd
  const val = ax <= 13.0 ? besselJ1Series(ax) : besselHankel(1, ax, false);
  return sign * val;
}

/** Bessel function of the second kind, order 0: Y0(x). */
export function besselY0Scalar(x: f64): f64 {
  if (x <= 0) return NaN;
  return x <= 13.0 ? besselY0Series(x) : besselHankel(0, x, true);
}

/** Bessel function of the second kind, order 1: Y1(x). */
export function besselY1Scalar(x: f64): f64 {
  if (x <= 0) return NaN;
  return x <= 13.0 ? besselY1Series(x) : besselHankel(1, x, true);
}

/**
 * Reciprocal-gamma auxiliaries for Temme's method, |xmu| <= 1/2:
 *   gampl = 1/Γ(1+μ), gammi = 1/Γ(1−μ),
 *   gam1 = (gammi − gampl)/(2μ) (→ −γ as μ → 0), gam2 = (gammi + gampl)/2.
 * Evaluated from the Taylor series of 1/Γ(1+z) (A&S 6.1.34), which has no
 * cancellation at small μ because odd and even powers are summed separately.
 * Self-contained (inlined coefficients) so kernelSource can serialize it.
 */
export function besselGammaAux(xmu: f64): [f64, f64, f64, f64] {
  const a = [
    1, 0.5772156649015329, -0.6558780715202538, -0.0420026350340952, 0.1665386113822915,
    -0.0421977345555443, -0.009621971527877, 0.007218943246663, -0.0011651675918591,
    -0.0002152416741149, 0.0001280502823882, -0.0000201348547807, -0.0000012504934821,
    0.000001133027232, -0.0000002056338417, 0.000000006116095, 0.0000000050020075,
    -0.0000000011812746, 0.0000000001043427, 0.0000000000077823, -0.0000000000036968,
    0.00000000000051, -0.0000000000000206, -0.0000000000000054, 0.0000000000000014,
    0.0000000000000001,
  ];
  let even: f64 = 0; // Σ a_{2k} μ^{2k}
  let odd: f64 = 0; // Σ a_{2k+1} μ^{2k}
  let pw: f64 = 1;
  for (let k = 0; k < a.length; k += 2) {
    even += a[k] * pw;
    if (k + 1 < a.length) odd += a[k + 1] * pw;
    pw *= xmu * xmu;
  }
  const gampl = even + xmu * odd;
  const gammi = even - xmu * odd;
  return [-odd, even, gampl, gammi];
}

/**
 * True when J_an(x) rounds to 0, for an order an >= 1 and an argument x > 0. |J_nu(x)| <=
 * (x/2)^nu / Gamma(nu + 1) (DLMF 10.14.4) and Gamma(nu + 1) >= (nu/e)^nu give
 * ln|J_nu(x)| <= nu (1 + ln(x/2) - ln nu), and below -745.2 the value rounds to 0. The bound
 * holds for every x. It costs no loop, so the scalars test it before the order limit: a huge
 * order with a small x returns at once, and the array guard uses the same test.
 */
export function besselJUnderflows(an: f64, x: f64): boolean {
  return an >= 1 && an * (1 + (Math.log(x) - Math.LN2) - Math.log(an)) < -745.2;
}

/**
 * A lower bound of ln|Y_an(x)| for an order an >= 2 and 0 < x <= an - 1, and -Infinity when the
 * bound does not apply. d/dx[x^nu Y_nu] = x^nu Y_(nu-1) < 0 on (0, y_(nu-1,1)) with
 * y_(nu-1,1) > nu - 1 (DLMF 10.6.6 and 10.21.3), and x^nu Y_nu -> -2^nu Gamma(nu) / pi as x -> 0
 * (DLMF 10.7.4). So |Y_nu(x)| >= 2^nu Gamma(nu) / (pi x^nu) there, and
 * ln Gamma(nu) >= (nu - 1/2) ln nu - nu + ln(2 pi) / 2. Y_an(x) is negative in this range: above
 * 709.79 it is -Infinity. The sum is grouped so that an huge order gives +-Infinity, not NaN.
 */
export function besselYLogBound(an: f64, x: f64): f64 {
  if (!(an >= 2) || !(x <= an - 1)) return -Infinity;
  return (
    an * (Math.log(an) - 1 + Math.LN2 - Math.log(x)) -
    0.5 * Math.log(an) +
    0.5 * Math.log(2 * Math.PI) -
    Math.log(Math.PI)
  );
}

/**
 * Continued fraction CF1 (Lentz) for h = J'_xnu(x) / J_xnu(x), x > 0 and xnu >= 0, with the sign
 * of J_xnu relative to its seed (the count of negative denominators, as in Numerical Recipes
 * `bessjy`). It needs about x steps for x > xnu and a few steps for x < xnu. A fraction that has
 * not converged after 100000 steps gives h = NaN, never its partial value.
 * Returns [h, sign].
 */
export function besselCF1(xnu: f64, x: f64): [f64, f64] {
  const EPS = 1e-16;
  const FPMIN = 1e-300;
  const MAXIT = 100000;
  const xi = 1 / x;
  const xi2 = 2 * xi;
  let isign: f64 = 1;
  let h = xnu * xi;
  if (h < FPMIN) h = FPMIN;
  let b = xi2 * xnu;
  let d: f64 = 0;
  let c = h;
  for (let i = 1; i <= MAXIT; i++) {
    b += xi2;
    d = b - d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b - 1 / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = c * d;
    h = del * h;
    if (d < 0) isign = -isign;
    if (Math.abs(del - 1) < EPS) return [h, isign];
  }
  return [NaN, isign];
}

/**
 * Y_mu(x) and Y_(mu+1)(x) for |mu| <= 1/2 and 0 < x < 2 (Temme's series, as in Numerical Recipes
 * `bessjy`). It works down to x = 5e-324: ln(x/2) is Math.log(x) - Math.LN2, and every division
 * is by x (1 / x and 2 / x are Infinity below 5.6e-309). Returns [Y_mu, Y_(mu+1)].
 */
export function besselYTemmeStart(xmu: f64, x: f64): [f64, f64] {
  const EPS = 1e-16;
  const MAXIT = 100000;
  const xmu2 = xmu * xmu;
  const x2 = 0.5 * x;
  const pimu = Math.PI * xmu;
  const fact1 = Math.abs(pimu) < EPS ? 1 : pimu / Math.sin(pimu);
  let dd = -(Math.log(x) - Math.LN2);
  let e = xmu * dd;
  const fact2 = Math.abs(e) < EPS ? 1 : Math.sinh(e) / e;
  const g = besselGammaAux(xmu);
  let ff = ((2 / Math.PI) * fact1 * (g[0] * Math.cosh(e) + g[1] * fact2 * dd)) as f64;
  e = Math.exp(e);
  let p = e / (g[2] * Math.PI);
  let q = 1 / (e * Math.PI * g[3]);
  const pimu2 = 0.5 * pimu;
  const fact3 = Math.abs(pimu2) < EPS ? 1 : Math.sin(pimu2) / pimu2;
  const r = Math.PI * pimu2 * fact3 * fact3;
  let cc: f64 = 1;
  dd = -x2 * x2;
  let sum = ff + r * q;
  let sum1 = p;
  for (let i = 1; i <= MAXIT; i++) {
    ff = (i * ff + p + q) / (i * i - xmu2);
    cc *= dd / i;
    p /= i - xmu;
    q /= i + xmu;
    const del = cc * (ff + r * q);
    sum += del;
    const del1 = cc * p - i * del;
    sum1 += del1;
    if (Math.abs(del) < (1 + Math.abs(sum)) * EPS) return [-sum, (-sum1 * 2) / x];
  }
  return [NaN, NaN];
}

/**
 * Y_(mu+nl)(x) from Y_mu = rymu and Y_(mu+1) = ry1 by the upward recurrence, which is stable for
 * Y. The step divides by x after the product: 2 (mu + i) / x would overflow for the smallest x.
 * Y_(mu+i+1) left the double range (or is NaN): every later order is farther out, so the target
 * is that value (the next step would give -Infinity - -Infinity = NaN). At the last step the
 * target is rymu, which is finite.
 */
export function besselYUpward(xmu: f64, x: f64, rymu0: f64, ry10: f64, nl: f64): f64 {
  let rymu = rymu0;
  let ry1 = ry10;
  for (let i = 1; i <= nl; i++) {
    const rytemp = (2 * (xmu + i) * ry1) / x - rymu;
    rymu = ry1;
    ry1 = rytemp;
    if (!Number.isFinite(ry1)) {
      if (i < nl) rymu = ry1;
      break;
    }
  }
  return rymu;
}

/**
 * yScale * Y_an(x) for 0 < x < 2 and an >= 0, with no CF1 and no J: the Temme series at the
 * reduced order and the upward recurrence. It is the Y half of besselJYTemme, and it is the only
 * Y path for x below 1e-5, where the continued fraction overflows (it divides by x).
 */
export function besselYTemmeSmall(an: f64, x: f64, yScale: f64): f64 {
  const nl = Math.floor(an + 0.5);
  const xmu = an - nl;
  const ys = besselYTemmeStart(xmu, x);
  return besselYUpward(xmu, x, ys[0] * yScale, ys[1] * yScale, nl);
}

/**
 * J_nu(x) for a non-integer or positive real order nu of any sign and 0 < x < 1e-5, from the power
 * series J_nu(x) = (x/2)^nu sum_k (-x^2/4)^k / (k! Gamma(nu + k + 1)). The terms fall by x^2/4
 * per step, so the sum ends after a few terms, except next to a negative integer order, where
 * the term at k = -nu is not small: the loop does not stop before k > -nu.
 *
 * The first term is (a * 1/Gamma(nu + 1)) * a with the half power a = x^(nu/2) 2^(-nu/2): the
 * power (x/2)^nu leaves the double range for the smallest x and the largest |nu|, where the two
 * half powers do not, and 1/Gamma(nu + 1) has the sign of Gamma for nu + 1 < 0. An infinite or
 * underflowing first term is the result (the later terms are below it for nu > 0).
 * A loop that does not converge gives NaN.
 */
export function besselJSeriesReal(nu: f64, x: f64): f64 {
  const a = Math.pow(x, nu / 2) * Math.pow(2, -nu / 2);
  let term = a * rgammaScalar(nu + 1) * a;
  if (!Number.isFinite(term) || term === 0) return term;
  // x / 2 is inexact for a subnormal x, and (x / 2)^2 can be 0: every later term is then below
  // the last bit of the first.
  const h = x / 2;
  const q = -(h * h);
  let sum = term;
  const kmax = 200 + Math.ceil(Math.abs(nu));
  for (let k = 0; k < kmax; k++) {
    term *= q / ((k + 1) * (nu + k + 1));
    sum += term;
    if (k > -nu && Math.abs(term) <= 1e-17 * Math.abs(sum)) return sum;
  }
  return NaN;
}

/**
 * J_xnu(x) and yScale * Y_xnu(x) for a real order xnu >= 0 and 1e-5 <= x < 25 (Temme 1976 and
 * Steed, as in Numerical Recipes `bessjy`): CF1 (Lentz) for J'_xnu/J_xnu, then either Temme's
 * series (x < 2) or Steed's CF2 (x >= 2) at the reduced order mu in [-1/2, 1/2], and stable
 * recurrences back to xnu. Returns [J_xnu, yScale * Y_xnu]. Accurate to about 1e-15 for these x,
 * with no loss near integer orders. (For x >= 25 CF1 needs about x steps: besselJYLarge runs
 * there.)
 *
 * `yScale` multiplies Y at the reduced order, before the upward recurrence (which is linear).
 * A caller that needs `c * Y_xnu` with a small `c` passes `c`: the product can be a double
 * where Y_xnu alone is outside the double range.
 */
export function besselJYTemme(xnu: f64, x: f64, yScale: f64 = 1): [f64, f64] {
  const EPS = 1e-16;
  const FPMIN = 1e-300;
  const XMIN = 2;
  const nl = x < XMIN ? Math.floor(xnu + 0.5) : Math.max(0, Math.floor(xnu - x + 1.5));
  const xmu = xnu - nl;
  const xmu2 = xmu * xmu;
  const xi = 1 / x;
  const xi2 = 2 * xi;
  const w = xi2 / Math.PI;
  const cf = besselCF1(xnu, x);
  const h = cf[0];
  if (Number.isNaN(h)) return [NaN, NaN];
  let rjl = cf[1] * FPMIN;
  let rjpl = h * rjl;
  let rjl1 = rjl;
  let fact = xnu * xi;
  for (let l = nl; l >= 1; l--) {
    const rjtemp = fact * rjl + rjpl;
    fact -= xi;
    rjpl = fact * rjtemp - rjl;
    rjl = rjtemp;
    // The downward recurrence grows by about 2 nu / x per step, so from the seed 1e-300 it
    // leaves the double range for nu / x above about 150, and the ratio f = rjpl / rjl was NaN
    // (besselY(400.3, 3), besselJ(300.5, 1)). Only the ratio and the quotient rjl1 / rjl are used:
    // scale all three. After a scale of 1e-250 the seed rjl1 is 0, which is the true J_nu
    // (a growth of 1e550 or more puts J_nu below the smallest double).
    if (Math.abs(rjl) > 1e250) {
      rjl *= 1e-250;
      rjpl *= 1e-250;
      rjl1 *= 1e-250;
    }
  }
  if (rjl === 0) rjl = EPS;
  const f = rjpl / rjl;
  let rjmu: f64;
  let rymu: f64;
  let ry1: f64;
  if (x < XMIN) {
    const ys = besselYTemmeStart(xmu, x);
    rymu = ys[0];
    ry1 = ys[1];
    const rymup = xmu * xi * rymu - ry1;
    rjmu = w / (rymup - f * rymu);
  } else {
    let a = 0.25 - xmu2;
    let p = -0.5 * xi;
    let q: f64 = 1;
    const br = 2 * x;
    let bi: f64 = 2;
    let fct = (a * xi) / (p * p + q * q);
    let cr = br + q * fct;
    let ci = bi + p * fct;
    let den = br * br + bi * bi;
    let dr = br / den;
    let di = -bi / den;
    let dlr = cr * dr - ci * di;
    let dli = cr * di + ci * dr;
    let temp = p * dlr - q * dli;
    q = p * dli + q * dlr;
    p = temp;
    let converged = false;
    for (let i = 2; i <= 100000; i++) {
      a += 2 * (i - 1);
      bi += 2;
      dr = a * dr + br;
      di = a * di + bi;
      if (Math.abs(dr) + Math.abs(di) < FPMIN) dr = FPMIN;
      fct = a / (cr * cr + ci * ci);
      cr = br + cr * fct;
      ci = bi - ci * fct;
      if (Math.abs(cr) + Math.abs(ci) < FPMIN) cr = FPMIN;
      den = dr * dr + di * di;
      dr /= den;
      di /= -den;
      dlr = cr * dr - ci * di;
      dli = cr * di + ci * dr;
      temp = p * dlr - q * dli;
      q = p * dli + q * dlr;
      p = temp;
      if (Math.abs(dlr - 1) + Math.abs(dli) < EPS) {
        converged = true;
        break;
      }
    }
    if (!converged) return [NaN, NaN];
    const gam = (p - f) / q;
    rjmu = Math.sqrt(w / ((p - f) * gam + q));
    if (rjl < 0) rjmu = -rjmu;
    rymu = rjmu * gam;
    const rymup = rymu * (p + q / gam);
    ry1 = xmu * xi * rymu - rymup;
  }
  const scale = rjmu / rjl;
  const rj = rjl1 * scale;
  return [rj, besselYUpward(xmu, x, rymu * yScale, ry1 * yScale, nl)];
}

/**
 * Hankel asymptotic expansion for real order (x large). Y when `y` is true.
 *
 * The phase chi = x - (nu/2 + 1/4) pi is never formed: it would round to ulp(x), an absolute phase
 * error of ulp(x) / 2 (J_400.3(1.5e5) was 4.7e-12 off the amplitude). sin(x - A) and cos(x - A)
 * with A = pi nu / 2 + pi / 4 come from sin(x) and cos(x), which reduce the exact x, and from
 * the exactly reduced sin(pi nu / 2) and cos(pi nu / 2) (nu / 2 is exact).
 */
export function besselHankelReal(nu: f64, x: f64, y: boolean): f64 {
  const mu = 4 * nu * nu;
  let P: f64 = 1;
  let Q: f64 = 0;
  let t: f64 = 1;
  let prev = Infinity;
  for (let k = 1; k < 60; k++) {
    t *= (mu - (2 * k - 1) * (2 * k - 1)) / (k * 8 * x);
    const at = Math.abs(t);
    if (at > prev || at < 1e-17) break;
    prev = at;
    const m = Math.floor(k / 2);
    const sgn = m % 2 === 0 ? 1 : -1;
    if (k % 2 === 0) P += sgn * t;
    else Q += sgn * t;
  }
  const sb = sinPiScalar(nu / 2);
  const cb = cosPiScalar(nu / 2);
  const ca = (cb - sb) * Math.SQRT1_2;
  const sa = (sb + cb) * Math.SQRT1_2;
  const sx = Math.sin(x);
  const cx = Math.cos(x);
  const sinChi = sx * ca - cx * sa;
  const cosChi = cx * ca + sx * sa;
  const amp = Math.sqrt(2 / (Math.PI * x));
  return y ? amp * (P * sinChi + Q * cosChi) : amp * (P * cosChi - Q * sinChi);
}

/**
 * J_an(x) and yScale * Y_an(x) for a real order an >= 0 and x >= 25, with no continued fraction
 * for J and no CF2: the Hankel expansion at the reduced order mu = an - floor(an) in [0, 1) (its
 * smallest term is about e^(-2x), below 1e-17 from x = 25) and the stable recurrences from there.
 * Y_an comes from the upward recurrence. J_an comes from the upward recurrence when an <= x
 * (stable below x), and for an > x from CF1 at order an and the Wronskian
 * J_an Y_(an+1) - J_(an+1) Y_an = -2 / (pi x). The cost is about an steps (CF1 about x).
 * `needJ` and `needY` select what the caller needs; the other value is 0.
 *
 * The Y recurrence runs at the scale S = 2^-600 (a power of 2: every value keeps its bits). Y_an
 * is outside the double range for an > x when J_an is still a double (J_an Y_an is about
 * -1 / (pi sqrt(an^2 - x^2))), and the Wronskian would give Infinity - Infinity there
 * (besselJ(322.5, 25) was NaN). The result Y is (S Y_an * yScale) * 2^600: it is the correct
 * signed Infinity by itself, and yScale * Y_an is a double where Y_an alone is not. When the
 * scaled recurrence leaves the range, J_an is below 2^-1600: J is 0.
 */
export function besselJYLarge(
  an: f64,
  x: f64,
  yScale: f64,
  needJ: boolean,
  needY: boolean
): [f64, f64] {
  const n = Math.floor(an);
  const mu = an - n;
  const xi2 = 2 / x;
  let rj: f64 = 0;
  let ry: f64 = 0;
  const wantYRecurrence = needY || (needJ && an > x);
  if (needJ && an <= x) {
    let jp = besselHankelReal(mu, x, false);
    if (n === 0) {
      rj = jp;
    } else {
      let jc = besselHankelReal(mu + 1, x, false);
      for (let i = 1; i < n; i++) {
        const jn = (mu + i) * xi2 * jc - jp;
        jp = jc;
        jc = jn;
      }
      rj = jc;
    }
  }
  if (wantYRecurrence) {
    const S = Math.pow(2, -600);
    let y0 = S * besselHankelReal(mu, x, true);
    let y1 = S * besselHankelReal(mu + 1, x, true);
    // Before step i, y0 = S Y_(mu+i-1) and y1 = S Y_(mu+i). After the loop y0 = S Y_an and
    // y1 = S Y_(an+1). A step i < n that leaves the range makes S Y_(mu+i+1), with i + 1 <= n,
    // infinite, and Y grows with the order from there: Y_an is out of range and J_an is 0.
    for (let i = 1; i <= n; i++) {
      const next = (mu + i) * xi2 * y1 - y0;
      if (Number.isNaN(next)) return [NaN, NaN];
      if (!Number.isFinite(next) && i < n) {
        const inf = yScale === 0 ? 0 : (y1 < 0 ? -1 : 1) * (yScale < 0 ? -1 : 1) * Infinity;
        return [0, needY ? inf : 0];
      }
      y0 = y1;
      y1 = next;
    }
    ry = needY ? y0 * yScale * Math.pow(2, 600) : 0;
    // A last step that leaves the range (y1 infinite) puts J_an below 2^-1600: J stays 0.
    if (needJ && an > x && Number.isFinite(y1)) {
      const cf = besselCF1(an, x);
      const r = an / x - cf[0];
      rj = ((2 / (Math.PI * x)) * S) / (r * y0 - y1);
    }
  }
  return [rj, ry];
}

/**
 * J_nu(x) for NON-integer real order nu. The order of the checks is the same as for an integer
 * order: a NaN or negative x, x = 0, the zero bound (positive order), the overflow bound of a
 * negative order, the O(1) Hankel shortcut, the order limit, and then the path by x: the power
 * series below 1e-5, Temme and Steed up to 25 (the continued fractions need about x steps),
 * and the Hankel start with the stable recurrences from 25. A negative order is
 * J_(-nu) = cos(nu pi) J_nu - sin(nu pi) Y_nu.
 */
export function besselJRealOrder(nu: f64, x: f64): f64 {
  if (isNaN(nu) || isNaN(x) || x < 0) return NaN;
  // As x -> 0+ the leading term is (x/2)^(-an) / Gamma(1 - an) for a negative order: Infinity with
  // the sign of Gamma(1 - an) (besselJ(-1.5, 0) is -Infinity).
  if (x === 0) return nu > 0 ? 0 : nu < 0 ? (rgammaScalar(1 + nu) > 0 ? Infinity : -Infinity) : 1;
  const an = Math.abs(nu);
  if (nu > 0 && besselJUnderflows(an, x)) return 0;
  // For a negative order -sin(nu pi) Y_an dominates when it is above the double range: the sign of
  // the result is the sign of sin(nu pi) (Y_an < 0 there). A small factor can bring the product
  // back into the range, so the factor is part of the test (besselY(-151.5001, 1) is finite).
  if (nu < 0) {
    const s = sinPiScalar(an);
    if (Math.log(Math.abs(s)) + besselYLogBound(an, x) > 709.79)
      return s > 0 ? Infinity : -Infinity;
  }
  // The Hankel expansion at the order itself: O(1), for x far above nu^2.
  if (x > 1e5 && x > 4 * an * an) return besselHankelReal(nu, x, false);
  // The scalar is serialized into worker kernels, so it cannot import the shared limit.
  if (an > 2500000000) {
    throw new RangeError(`besselJ: n = ${an} exceeds the supported maximum of 2500000000`);
  }
  if (x < 1e-5) return besselJSeriesReal(nu, x);
  if (x < 25) {
    if (nu > 0) return besselJYTemme(an, x)[0];
    // The factor -sin(nu pi) goes into the Y recurrence, so the product is right also where Y_an
    // alone is outside the double range. sinPiScalar and cosPiScalar reduce nu exactly: cos is
    // exactly 0 at a half-integer, and sin keeps its digits next to an integer.
    const jy = besselJYTemme(an, x, -sinPiScalar(an));
    return cosPiScalar(an) * jy[0] + jy[1];
  }
  if (nu > 0) return besselJYLarge(an, x, 1, true, false)[0];
  const jy = besselJYLarge(an, x, -sinPiScalar(an), true, true);
  return cosPiScalar(an) * jy[0] + jy[1];
}

/** Y_nu(x) for non-integer real order nu and x > 0 (see besselJRealOrder). */
export function besselYRealOrder(nu: f64, x: f64): f64 {
  if (isNaN(nu) || isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  const an = Math.abs(nu);
  const bound = besselYLogBound(an, x);
  if (nu > 0) {
    if (bound > 709.79) return -Infinity;
  } else {
    // Y_(-nu) = sin(nu pi) J_nu + cos(nu pi) Y_nu. At a half-integer cos is exactly 0 and the
    // value is sin(nu pi) J_an (finite, often 0): no overflow test then.
    const c = cosPiScalar(an);
    if (c !== 0 && Math.log(Math.abs(c)) + bound > 709.79) return c > 0 ? -Infinity : Infinity;
  }
  if (x > 1e5 && x > 4 * an * an) return besselHankelReal(nu, x, true);
  if (an > 2500000000) {
    throw new RangeError(`besselY: n = ${an} exceeds the supported maximum of 2500000000`);
  }
  if (x < 1e-5) {
    if (nu > 0) return besselYTemmeSmall(an, x, 1);
    return sinPiScalar(an) * besselJSeriesReal(an, x) + besselYTemmeSmall(an, x, cosPiScalar(an));
  }
  if (x < 25) {
    if (nu > 0) return besselJYTemme(an, x)[1];
    // Reduce nu exactly before the product with pi (sinPiScalar, cosPiScalar): at a half-integer
    // cos(nu pi) is exactly 0, not 1e-14, which times the huge Y_nu (besselY(-100.5, 1) = 6e-190,
    // not -2e172) gave a wrong value, and next to an integer sin(nu pi) kept only a few digits.
    // The factor c goes into the Y recurrence: c Y_nu can be a double where Y_nu alone is not
    // (besselY(-151.5001, 1) = -2.8e305 with Y_nu = -9e308), and at a half-integer the term is 0.
    const jy = besselJYTemme(an, x, cosPiScalar(an));
    return sinPiScalar(an) * jy[0] + jy[1];
  }
  if (nu > 0) return besselJYLarge(an, x, 1, false, true)[1];
  const jy = besselJYLarge(an, x, cosPiScalar(an), true, true);
  return sinPiScalar(an) * jy[0] + jy[1];
}

/** Bessel function of the first kind, general integer order n: J_n(x). */
export function besselJScalar(n: f64, x: f64): f64 {
  // A non-finite order has no defined value, and the recurrence below would never end.
  if (!Number.isFinite(n)) return NaN;
  if (Number.isFinite(n) && n !== Math.round(n)) return besselJRealOrder(n, x);
  const ni = Math.round(n);
  if (ni < 0) return (ni % 2 === 0 ? 1 : -1) * besselJScalar(-ni, x);
  if (ni === 0) return besselJ0Scalar(x);
  if (ni === 1) return besselJ1Scalar(x);

  if (Number.isNaN(x)) return NaN;
  const ax = Math.abs(x);
  if (ax === 0) return 0;
  // The zero bound (besselJUnderflows) comes before the limit, so a huge order with a small x
  // returns 0 at once.
  if (besselJUnderflows(ni, ax)) return 0;
  // A tiny x: J_n(x) = (x/2)^n / n! (1 - x^2 / (4 (n + 1)) + ...), and the second term is below
  // 1e-31 of the first. The test "|x| < 1e-15 gives 0" returned 0 where J_n(x) is a double
  // (J_2(1e-16) = 1.25e-33, J_5(1e-20) = 2.6e-105). The zero bound above leaves n <= 20, so the
  // product has at most 19 factors, each below 1: it only falls, and it uses no pow or exp, so
  // the AssemblyScript kernel (_besselJn) gives the same bits.
  if (ax < 1e-15) {
    const h = ax / 2;
    let t = h;
    for (let k = 2; k <= ni; k++) t *= h / k;
    return x < 0 && ni % 2 === 1 ? -t : t;
  }
  // The scalar is serialized into worker kernels, so it cannot import the shared limit.
  if (ni > 2500000000) {
    throw new RangeError(`besselJ: n = ${ni} exceeds the supported maximum of 2500000000`);
  }

  // Upward recurrence is stable only when x > n; otherwise it amplifies
  // round-off (J_n decays in n for n > x), so use Miller's backward recurrence.
  if (Math.abs(x) > ni) {
    let jPrev: f64 = besselJ0Scalar(x);
    let jCurr: f64 = besselJ1Scalar(x);
    for (let k = 1; k < ni; k++) {
      const jNext = ((2 * k) / x) * jCurr - jPrev;
      if (Number.isNaN(jNext)) return NaN;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return jCurr;
  } else {
    const nStart = ni + 2 * Math.max(10, Math.ceil(Math.sqrt(40 * ni)));
    // One downward step costs more than one upward step, so the sweep has its own limit
    // (MAX_BESSEL_J_SWEEP of utils/limits.ts). The zero bound above runs first.
    if (nStart > 1200000000) {
      throw new RangeError(
        `besselJ: the downward sweep from order ${nStart} exceeds the supported maximum of 1200000000`
      );
    }
    const down = Math.pow(2, -700);
    let jNext = 0;
    let jCurr = 1;
    let result = 0;
    let sum = 0;
    let shifts = 0; // rescales made after J_ni was captured
    for (let k = nStart; k >= 0; k--) {
      const jPrev = ((2 * (k + 1)) / x) * jCurr - jNext;
      jNext = jCurr;
      jCurr = jPrev;
      // The sweep grows as it goes down. Scaling by a power of 2 is exact, so it keeps the
      // sums finite. `result` keeps its own scale, so it cannot underflow here.
      if (Math.abs(jCurr) > 1e200) {
        jCurr *= down;
        jNext *= down;
        sum *= down;
        // The final value is (result / sum) * 2^(-700 * shifts), and result / sum < 2^701
        // (|result| <= 1e200, |sum| >= 1e200 * 2^-700), so three shifts leave a value below 2^-1399.
        if (k < ni && ++shifts === 3) return 0;
      }
      // After the assignments jCurr = J_k and jNext = J_{k+1}; capture J_ni.
      if (k === ni) result = jCurr;
      if (k % 2 === 0) sum += jCurr;
    }
    sum = 2 * sum - jCurr;
    let r = result / sum;
    for (let i = 0; i < shifts && r !== 0; i++) r *= down;
    return r;
  }
}

/**
 * Bessel function of the second kind, general integer order n: Y_n(x).
 *
 * Negative orders use the parity identity Y_{-n}(x) = (-1)^n Y_n(x). (The
 * earlier `typed/special.ts` copy omitted this and returned Y_1 for any
 * negative order; the WASM-bridge fallback copy applied it. Reconciled here to
 * the mathematically correct form so the scalar and array paths agree.)
 */
export function besselYScalar(n: f64, x: f64): f64 {
  // A non-finite order has no defined value, and the recurrence below would never end.
  if (!Number.isFinite(n)) return NaN;
  if (x <= 0) return NaN;
  if (Number.isFinite(n) && n !== Math.round(n)) return besselYRealOrder(n, x);
  const ni = Math.round(n);
  if (ni < 0) return (ni % 2 === 0 ? 1 : -1) * besselYScalar(-ni, x);
  if (ni === 0) return besselY0Scalar(x);
  if (ni === 1) return besselY1Scalar(x);

  // Y_n(x) < 0 and |Y_n(x)| >= 2^n Gamma(n) / (pi x^n) for 0 < x <= n - 1 (besselYLogBound): the
  // value is -Infinity above the double range, at once and before the limit
  // (besselY(4e9, 1e8) and besselY(2, 5e-324), which was NaN).
  if (besselYLogBound(ni, x) > 709.79) return -Infinity;
  // The scalar is serialized into worker kernels, so it cannot import the shared limit.
  if (ni > 2500000000) {
    throw new RangeError(`besselY: n = ${ni} exceeds the supported maximum of 2500000000`);
  }
  let yPrev: f64 = besselY0Scalar(x);
  let yCurr: f64 = besselY1Scalar(x);
  for (let k = 1; k < ni; k++) {
    const yNext = ((2 * k) / x) * yCurr - yPrev;
    // Y_n(x) < 0 and falls without a bound as n grows while x < n, so a result outside the
    // double range is -Infinity. The next step would be -Infinity - -Infinity = NaN. A NaN
    // returns as NaN.
    if (!Number.isFinite(yNext)) return yNext;
    yPrev = yCurr;
    yCurr = yNext;
  }
  return yCurr;
}

// =============================================================================
// Elliptic Integrals — complete K(m) / E(m) via AGM
// =============================================================================

/** Complete elliptic integral of the first kind K(m) via AGM. */
export function ellipticKScalar(m: f64): f64 {
  if (isNaN(m)) return NaN;
  if (m < 0 || m > 1) return NaN;
  if (m === 1) return Infinity;
  if (m === 0) return Math.PI / 2;

  let a: f64 = 1;
  let b: f64 = Math.sqrt(1 - m);
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2;
    const bNew = Math.sqrt(a * b);
    if (Math.abs(aNew - bNew) < 1e-16 * aNew) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  return Math.PI / (2 * a);
}

/** Complete elliptic integral of the second kind E(m) via Carlson-Bulirsch AGM. */
export function ellipticECompleteScalar(m: f64): f64 {
  if (isNaN(m)) return NaN;
  if (m < 0 || m > 1) return NaN;
  if (m === 0) return Math.PI / 2;
  if (m === 1) return 1.0;

  let a: f64 = 1;
  let b: f64 = Math.sqrt(1 - m);
  let sum: f64 = m; // 2^0 · c_0² = m
  let pow2: f64 = 1;
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2;
    const bNew = Math.sqrt(a * b);
    const cNew = (a - b) / 2;
    pow2 *= 2;
    sum += pow2 * cNew * cNew;
    if (Math.abs(cNew) < 1e-16 * aNew) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  const k = Math.PI / (2 * a);
  return k * (1 - 0.5 * sum);
}

// =============================================================================
// Airy Functions Ai(x) / Bi(x)
//
// |x| <= 5: power series (DLMF §9.2.2).  x > 5: decaying asymptotic
// (DLMF §9.7.3).  x < -5: oscillatory asymptotic (DLMF §9.7.5).
// =============================================================================

/**
 * Airy asymptotic coefficients u_k (DLMF 9.7.2):
 *   u_0 = 1, u_k = u_{k-1} (6k-5)(6k-3)(6k-1) / ((2k-1) · 216 · k).
 * A function (not a module const) so it stays self-contained when serialized
 * into a worker kernel.
 */
export function airyUCoeffs(): number[] {
  const u = [1];
  for (let k = 1; k <= 12; k++) {
    u.push((u[k - 1] * ((6 * k - 5) * (6 * k - 3) * (6 * k - 1))) / ((2 * k - 1) * 216 * k));
  }
  return u;
}

/**
 * Evaluate the two alternating asymptotic sums used by Ai(-z)/Bi(-z):
 *   P(ζ) = Σ_k (-1)^k u_{2k}   / ζ^{2k}      (even-index coefficients)
 *   Q(ζ) = Σ_k (-1)^k u_{2k+1} / ζ^{2k+1}    (odd-index coefficients)
 * Both series are divergent — each is summed only to its smallest term.
 */
export function airyAsymPQ(zeta: f64): { p: f64; q: f64 } {
  let p = 0,
    q = 0;
  let pTerm = Infinity,
    qTerm = Infinity;
  const U = airyUCoeffs();
  const half = Math.floor((U.length - 1) / 2);
  for (let k = 0; k <= half; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const pt = (sign * U[2 * k]) / Math.pow(zeta, 2 * k);
    if (Math.abs(pt) > Math.abs(pTerm)) break;
    p += pt;
    pTerm = pt;
  }
  for (let k = 0; k <= half - 1; k++) {
    const sign = k % 2 === 0 ? 1 : -1;
    const qt = (sign * U[2 * k + 1]) / Math.pow(zeta, 2 * k + 1);
    if (Math.abs(qt) > Math.abs(qTerm)) break;
    q += qt;
    qTerm = qt;
  }
  return { p, q };
}

/**
 * Evaluate Ai(x) (`combine === 0`) or Bi(x) (`combine === 1`).
 *
 * Numeric settings only — no per-call object or closure — so a `kernelSource`
 * worker kernel stays allocation-free and self-contained (function declarations
 * cannot close over a module-level kind object). Closed-form combines stay the
 * historical expressions (not rewritten as `a + (-1)*b`) so the values stay
 * bit-identical to the pre-merge scalars.
 *
 * @param signStep - running-sign multiplier in the positive u_k sum (Ai −1, Bi +1)
 * @param expSign - exponent sign on ζ (Ai −1, Bi +1)
 * @param denomScale - √π denominator scale (Ai 2, Bi 1)
 * @param combine - 0 = Ai closed forms, 1 = Bi closed forms
 */
export function airyScalar(
  x: f64,
  signStep: number,
  expSign: number,
  denomScale: number,
  combine: number
): f64 {
  // 5.0 keeps the golden points x = +/-5 on the (accurate) series side.
  const XBIG = 5.0;
  const AI0 = 0.35502805388781723926;
  const AI_PRIME0 = 0.25881940379280679841;
  if (x > XBIG) {
    const xp = Math.pow(x, 0.25);
    const zeta = (2.0 / 3.0) * x * Math.sqrt(x);
    let p = 0.0,
      zk = 1.0,
      sign = 1.0,
      prevMag = Infinity;
    for (const uk of airyUCoeffs()) {
      const t = uk / zk;
      if (Math.abs(t) > prevMag) break;
      prevMag = Math.abs(t);
      p += sign * t;
      zk *= zeta;
      sign *= signStep;
    }
    return (Math.exp(expSign * zeta) * p) / (denomScale * Math.sqrt(Math.PI) * xp);
  }
  if (x < -XBIG) {
    const ax = Math.abs(x);
    const axp = Math.pow(ax, 0.25);
    const zeta = (2.0 / 3.0) * ax * Math.sqrt(ax);
    const theta = zeta - Math.PI / 4.0;
    const { p, q } = airyAsymPQ(zeta);
    const num =
      combine === 0
        ? Math.cos(theta) * p + Math.sin(theta) * q
        : -Math.sin(theta) * p + Math.cos(theta) * q;
    return num / (Math.sqrt(Math.PI) * axp);
  }
  const x3 = x * x * x;
  let f = 1.0,
    g = x,
    fTerm = 1.0,
    gTerm = x;
  let factF = 1.0,
    factG = 1.0,
    prodF = 1.0,
    prodG = 1.0;
  for (let k = 1; k <= 30; k++) {
    factF *= (3 * k - 2) * (3 * k - 1) * (3 * k);
    factG *= (3 * k - 1) * (3 * k) * (3 * k + 1);
    prodF *= 3 * k - 2;
    prodG *= 3 * k - 1;
    fTerm *= x3;
    gTerm *= x3;
    const df = (fTerm * prodF) / factF,
      dg = (gTerm * prodG) / factG;
    f += df;
    g += dg;
    if (Math.abs(df) < Math.abs(f) * 1e-16 && Math.abs(dg) < Math.abs(g) * 1e-16) break;
  }
  if (combine === 0) {
    return AI0 * f - AI_PRIME0 * g;
  }
  return Math.sqrt(3.0) * (AI0 * f + AI_PRIME0 * g);
}

/** Airy function of the first kind Ai(x). */
export function airyAiScalar(x: f64): f64 {
  return airyScalar(x, -1, -1, 2.0, 0);
}

/** Airy function of the second kind Bi(x). */
export function airyBiScalar(x: f64): f64 {
  return airyScalar(x, 1, 1, 1.0, 1);
}

// =============================================================================
// Gamma / Beta family + modified Bessel I (lgamma / factorial consumers)
//
// These live here (not in typed/special.ts) so their references to `_lgamma`
// and `factorial` are SAME-MODULE. Under the vitest SSR transform a cross-module
// import reference inside a function body is rewritten to `__vite_ssr_import_*`,
// which would break `Function.prototype.toString()` worker serialization; a
// same-module reference stays a bare identifier and serializes cleanly.
// =============================================================================

/** Factorial of a non-negative integer. */
export function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** Beta function B(a, b) = Gamma(a) Gamma(b) / Gamma(a + b). */
export function betaScalar(a: f64, b: f64): f64 {
  return Math.exp(_lgamma(a) + _lgamma(b) - _lgamma(a + b));
}

/**
 * Lentz continued-fraction kernel for the regularized incomplete beta on (0, 1),
 * on the side that does not use the symmetry flip. Caller supplies domain policy.
 */
export function incompleteBetaFraction(a: f64, b: f64, x: f64): f64 {
  const lnBeta = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  const TINY = 1e-30;
  let c = 1.0;
  let d = 1.0 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < TINY) d = TINY;
  d = 1.0 / d;
  let f = d;

  for (let m = 1; m <= 200; m++) {
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1.0 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1.0 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1.0 / d;
    f *= d * c;

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
 * Regularized incomplete beta I_x(a,b) with closed domain [0,1] (out-of-range → 0/1).
 * Argument order matches dist-objects/hypothesis call sites: (x, a, b).
 * @internal — not re-exported from special.ts or the package barrel.
 */
export function betaincClosedScalar(x: f64, a: f64, b: f64): f64 {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaincClosedScalar(1 - x, b, a);
  }

  return incompleteBetaFraction(a, b, x);
}

/**
 * Binomial coefficient C(n, k) via stable multiplicative recurrence.
 * @internal — private call sites only; not re-exported from the package barrel.
 */
export function chooseScalar(n: number, k: number): f64 {
  if (k < 0 || k > n) return 0;
  const kk = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < kk; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/**
 * Upper incomplete-gamma tail `Q` from the modified Lentz continued fraction.
 *
 * `tol` is the `|delta - 1|` break. `gammaincScalar` passes `1e-14` on the
 * `x >= a + 1` branch and returns `1 - Q`. `gammaincpScalar` passes `1e-15`
 * and returns `Q`. Those two cutoffs are the behavior; do not unify them.
 * Worker kernels must list this function in `kernelSource` next to its callers.
 */
export function upperGammaQ(a: f64, x: f64, tol: f64): f64 {
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
    if (Math.abs(delta - 1) < tol) break;
  }
  return f * Math.exp(-x + a * Math.log(x) - _lgamma(a));
}

/** Regularized lower incomplete gamma function P(a, x). */
export function gammaincScalar(a: f64, x: f64): f64 {
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
  }
  return 1 - upperGammaQ(a, x, 1e-14);
}

/**
 * Upper regularized incomplete gamma Q(a, x).
 *
 * Computed DIRECTLY in the upper tail (x >= a + 1) by the modified Lentz
 * continued fraction, and as 1 − P below it where P is the series. `1 − P`
 * everywhere rounded a far tail to 0 (Q(5, 80) is 2.5e-28, and 1 − P gave 0);
 * a p-value of a bad χ² fit is that tail.
 */
export function gammaincpScalar(a: f64, x: f64): f64 {
  if (x < 0) return NaN;
  if (x === 0) return 1;
  if (x < a + 1) return 1 - gammaincScalar(a, x);
  return upperGammaQ(a, x, 1e-15);
}

/** Regularized incomplete beta function I_x(a, b). */
export function betaincScalar(a: f64, b: f64, x: f64): f64 {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaincScalar(b, a, 1 - x);
  }

  return incompleteBetaFraction(a, b, x);
}

/**
 * kScale * K_an(x) for an order an >= 0 and x > 0 (modified Bessel function of the second kind,
 * K_(-nu) = K_nu). K_mu and K_(mu+1) at the reduced order mu = an - round(an), |mu| <= 1/2, come
 * from Temme's series (x < 2) or Steed's continued fraction CF2 (x >= 2), as in Numerical Recipes
 * `bessik`, and the upward recurrence, which is stable for K, runs to an. Accurate to about 2e-15
 * (the exponent mu ln(x/2) is rounded, so 2e-14 below x = 1e-100).
 *
 * `kScale` multiplies K_mu and K_(mu+1) before the recurrence (which is linear): a caller that
 * needs `c * K_an` with a small `c` passes `c`, and the product can be a double where K_an alone
 * is not (I_(-nu) = I_nu + (2 / pi) sin(nu pi) K_nu). K is positive, so every term has the sign of
 * kScale: a result outside the double range is +-Infinity, and the loop ends at the first one
 * (it returns within a few thousand steps), or at two zeros in a row (K_mu and K_(mu+1) have
 * underflowed, which happens above x = 745). A loop that does not converge gives NaN.
 */
export function besselKReal(an: f64, x: f64, kScale: f64 = 1): f64 {
  const EPS = 1e-16;
  const MAXIT = 100000;
  const nl = Math.floor(an + 0.5);
  const xmu = an - nl;
  const xmu2 = xmu * xmu;
  let rkmu: f64;
  let rk1: f64;
  if (x < 2) {
    // Temme's series. ln(x/2) is Math.log(x) - Math.LN2 and every division is by x, so it works
    // down to x = 5e-324.
    const x2 = 0.5 * x;
    const pimu = Math.PI * xmu;
    const fact = Math.abs(pimu) < EPS ? 1 : pimu / Math.sin(pimu);
    const d = -(Math.log(x) - Math.LN2);
    let e = xmu * d;
    const fact2 = Math.abs(e) < EPS ? 1 : Math.sinh(e) / e;
    const g = besselGammaAux(xmu);
    let ff = fact * (g[0] * Math.cosh(e) + g[1] * fact2 * d);
    let sum = ff;
    e = Math.exp(e);
    let p = (0.5 * e) / g[2];
    let q = 0.5 / (e * g[3]);
    let c: f64 = 1;
    const dd = x2 * x2;
    let sum1 = p;
    let converged = false;
    for (let i = 1; i <= MAXIT; i++) {
      ff = (i * ff + p + q) / (i * i - xmu2);
      c *= dd / i;
      p /= i - xmu;
      q /= i + xmu;
      const del = c * ff;
      sum += del;
      sum1 += c * (p - i * ff);
      if (Math.abs(del) < Math.abs(sum) * EPS) {
        converged = true;
        break;
      }
    }
    if (!converged) return NaN;
    rkmu = sum * kScale;
    rk1 = (sum1 * 2 * kScale) / x;
  } else {
    // Steed's CF2 and the normalization by exp(-x) sqrt(pi / (2 x)).
    const a1 = 0.25 - xmu2;
    let b = 2 * (1 + x);
    let d = 1 / b;
    let h = d;
    let delh = d;
    let q1: f64 = 0;
    let q2: f64 = 1;
    let q = a1;
    let c = a1;
    let a = -a1;
    let s = 1 + q * delh;
    let converged = false;
    for (let i = 2; i <= MAXIT; i++) {
      a -= 2 * (i - 1);
      c = (-a * c) / i;
      const qnew = (q1 - b * q2) / a;
      q1 = q2;
      q2 = qnew;
      q += c * qnew;
      b += 2;
      d = 1 / (b + a * d);
      delh = (b * d - 1) * delh;
      h += delh;
      const dels = q * delh;
      s += dels;
      if (Math.abs(dels / s) < EPS) {
        converged = true;
        break;
      }
    }
    if (!converged) return NaN;
    h = a1 * h;
    const k0 = (Math.sqrt(Math.PI / (2 * x)) * Math.exp(-x)) / s;
    rkmu = k0 * kScale;
    rk1 = (rkmu * (xmu + x + 0.5 - h)) / x;
  }
  if (nl === 0) return rkmu;
  for (let i = 1; i < nl; i++) {
    const rktemp = (2 * (xmu + i) * rk1) / x + rkmu;
    rkmu = rk1;
    rk1 = rktemp;
    if (!Number.isFinite(rk1)) return rk1;
    if (rk1 === 0 && rkmu === 0) return 0;
  }
  return rk1;
}

/**
 * Modified Bessel function of the second kind, K_nu(x), for a real order (K_(-nu) = K_nu). Main
 * rounded a real order to an integer. A NaN or infinite order or a NaN x has no defined value,
 * x <= 0 is outside the domain, and K_nu(Infinity) is 0.
 */
export function besselKScalar(n: f64, x: f64): f64 {
  if (!Number.isFinite(n) || x !== x || x <= 0) return NaN;
  if (x === Infinity) return 0;
  return besselKReal(Math.abs(n), x, 1);
}

/**
 * The plan of the power series of I_nu(x) for nu >= 0 and 0 < x < Infinity:
 * [m, steps, verdict]. I_nu(x) = sum T(m) with T(m) = (x/2)^(nu + 2m) / (m! Gamma(nu + m + 1)),
 * all terms positive and the largest one at m = (sqrt(nu^2 + x^2) - nu) / 2 (rounded). The sum
 * is at least that term and at most (2 m + 50) times it, so ln T above 709.79 means Infinity
 * (verdict 1) and ln T + ln(2 m + 50) below -745.2 means 0 (verdict -1). Otherwise verdict 0 and
 * `steps` = nu + 2 m is the work of the product and of the series. No loop runs here.
 */
export function besselIPlan(nu: f64, x: f64): [f64, f64, f64] {
  const t = nu / x;
  const m = Math.round(x / (2 * (Math.sqrt(1 + t * t) + t)));
  const lt = (nu + 2 * m) * (Math.log(x) - Math.LN2) - _lgamma(m + 1) - _lgamma(nu + m + 1);
  if (lt > 709.79) return [m, 0, 1];
  if (lt + Math.log(2 * m + 50) < -745.2) return [m, 0, -1];
  return [m, nu + 2 * m, 0];
}

/**
 * Modified Bessel function of the first kind I_nu(x) for a real order nu >= 0 and 0 < x < Infinity,
 * from the power series in log scale. The first term (x/2)^nu / Gamma(nu + 1) is built by a
 * running product with one power-of-2 exponent for the whole sum (2^600 per step), so an order
 * of 200 at x = 700 does not underflow in the first term; the sum is rescaled the same way when
 * it passes 2^600, and the result is sum * 2^(600 e). The gates of `besselIPlan` run first; a
 * RangeError when the work nu + 2 m is above 2500000000. A series that does not converge in
 * 2 m + 100 + 10 sqrt(m + 1) terms gives NaN, never its partial sum.
 */
export function besselIPositive(nu: f64, x: f64): f64 {
  const plan = besselIPlan(nu, x);
  if (plan[2] > 0) return Infinity;
  if (plan[2] < 0) return 0;
  // The scalar is serialized into worker kernels, so it cannot import the shared limit.
  if (plan[1] > 2500000000) {
    throw new RangeError(
      `besselI: n = ${nu} at x = ${x} needs about ${plan[1]} steps, above the supported maximum of 2500000000`
    );
  }
  const mstar = plan[0];
  const up = Math.pow(2, 600);
  const down = Math.pow(2, -600);
  const h = x / 2;
  const n = Math.floor(nu);
  const f = nu - n;
  let t: f64 = 1;
  if (f !== 0) t = (Math.pow(x, f) * Math.pow(2, -f)) / Math.exp(_lgamma(f + 1));
  let e = 0;
  for (let j = 1; j <= n; j++) {
    t *= h / (f + j);
    if (t < down) {
      t *= up;
      e--;
    } else if (t > up) {
      t *= down;
      e++;
    }
  }
  const q = h * h;
  let sum = t;
  let term = t;
  const cap = 2 * mstar + 100 + Math.ceil(10 * Math.sqrt(mstar + 1));
  let converged = false;
  for (let m = 0; m < cap; m++) {
    term *= q / ((m + 1) * (m + 1 + nu));
    sum += term;
    if (sum > up) {
      sum *= down;
      term *= down;
      e++;
    }
    if (m >= mstar && term <= 1e-17 * sum) {
      converged = true;
      break;
    }
  }
  if (!converged) return NaN;
  while (e > 0 && sum !== Infinity) {
    sum *= up;
    e--;
  }
  while (e < 0 && sum !== 0) {
    sum *= down;
    e++;
  }
  return sum;
}

/**
 * Modified Bessel function of the first kind, I_nu(x), for a real order nu. An integer order has
 * I_(-n) = I_n and I_n(-x) = (-1)^n I_n(x); a non-integer order with x < 0 is complex, so NaN.
 * A non-integer order below 0 is I_nu = I_an + (2 / pi) sin(an pi) K_an (DLMF 10.27.2, with
 * sinPiScalar for the exact reduction): the K term goes into `besselKReal` as its scale, so the
 * sum is right next to an integer order, where K_an alone is outside the double range
 * (besselI(-150.000000001, 0.9) = 3.97e303). Positive order: `besselIPositive`.
 */
export function besselIScalar(n: f64, x: f64): f64 {
  // A non-finite order has no defined value, and the series would never end.
  if (!Number.isFinite(n) || x !== x) return NaN;
  const an = Math.abs(n);
  const integer = n === Math.round(n);
  if (x < 0) {
    if (!integer) return NaN;
    const v = besselIScalar(an, -x);
    return an % 2 === 1 ? -v : v;
  }
  if (x === 0) {
    if (integer) return an === 0 ? 1 : 0;
    // As x -> 0+ the leading term is (x/2)^(-an) / Gamma(1 - an), with the sign of Gamma.
    if (n > 0) return 0;
    return rgammaScalar(1 - an) > 0 ? Infinity : -Infinity;
  }
  if (x === Infinity) return Infinity;
  if (integer || n > 0) return besselIPositive(an, x);
  // The scale 2 sin(an pi) / pi times K_an is a recurrence of about an steps.
  if (an > 2500000000) {
    throw new RangeError(`besselI: n = ${an} exceeds the supported maximum of 2500000000`);
  }
  return besselIPositive(an, x) + besselKReal(an, x, (2 / Math.PI) * sinPiScalar(an));
}

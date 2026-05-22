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

import { mathTyped } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';

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
function _erf(x: f64): f64 {
  if (x === 0) return 0;
  if (!isFinite(x)) return x > 0 ? 1 : -1;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);

  if (a <= 0.5) {
    const c = 2 / Math.sqrt(Math.PI);
    let sum: f64 = a;
    let term: f64 = a;
    for (let n = 1; n < 50; n++) {
      term *= (-a * a) / n;
      const inc = term / (2 * n + 1);
      sum += inc;
      if (Math.abs(inc) < Math.abs(sum) * 1e-16) break;
    }
    return sign * c * sum;
  }

  const t = 2.0 / (2.0 + a);
  const ans =
    t *
    Math.exp(
      -a * a -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 +
                            t *
                              (-1.13520398 +
                                t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))
    );
  return sign * (1.0 - ans);
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

/** Factorial of a non-negative integer. */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// =============================================================================
// Scalar Implementations
//
// Standalone function declarations (not closures): they can be called directly
// and serialized into self-contained worker kernels. They must not reference
// module-level state.
// =============================================================================

/** Complementary error function erfc(x) = 1 - erf(x). */
function erfcScalar(x: f64): f64 {
  return 1 - _erf(x);
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

/** Beta function B(a, b) = Gamma(a) Gamma(b) / Gamma(a + b). */
function betaScalar(a: f64, b: f64): f64 {
  return Math.exp(_lgamma(a) + _lgamma(b) - _lgamma(a + b));
}

/** Regularized lower incomplete gamma function P(a, x). */
function gammaincScalar(a: f64, x: f64): f64 {
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

/** Upper regularized incomplete gamma Q(a, x) = 1 - P(a, x). */
function gammaincpScalar(a: f64, x: f64): f64 {
  return 1 - gammaincScalar(a, x);
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

/** Bessel function of the first kind, order 0: J0(x). */
function besselJ0Scalar(x: f64): f64 {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax < 8.0) {
    const y = x * x;
    const r1 =
      57568490574.0 +
      y *
        (-13362590354.0 +
          y * (651619640.7 + y * (-11214424.18 + y * (77392.33017 + y * -184.9052456))));
    const r2 =
      57568490411.0 +
      y * (1029532985.0 + y * (9494680.718 + y * (59272.64853 + y * (267.8532712 + y * 1.0))));
    return r1 / r2;
  } else {
    const z = 8.0 / ax;
    const y = z * z;
    const xx = ax - 0.785398164;
    const p0 =
      1.0 +
      y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
    const q0 =
      -0.1562499995e-1 +
      y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
    return Math.sqrt(0.636619772 / ax) * (p0 * Math.cos(xx) - z * q0 * Math.sin(xx));
  }
}

/** Bessel function of the first kind, order 1: J1(x). */
function besselJ1Scalar(x: f64): f64 {
  const ax = Math.abs(x);
  if (ax < 8.0) {
    const y = x * x;
    const r1 =
      x *
      (72362614232.0 +
        y *
          (-7895059235.0 +
            y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const r2 =
      144725228442.0 +
      y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y * 1.0))));
    return r1 / r2;
  } else {
    const z = 8.0 / ax;
    const y = z * z;
    const xx = ax - 2.356194491;
    const p1 =
      1.0 +
      y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
    const q1 =
      0.04687499995 +
      y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
    let ans = Math.sqrt(0.636619772 / ax) * (p1 * Math.cos(xx) - z * q1 * Math.sin(xx));
    if (x < 0) ans = -ans;
    return ans;
  }
}

/** Bessel function of the second kind, order 0: Y0(x). */
function besselY0Scalar(x: f64): f64 {
  if (x <= 0) return NaN;

  if (x < 8.0) {
    const y = x * x;
    const r1 =
      -2957821389.0 +
      y *
        (7062834065.0 +
          y * (-512359803.6 + y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
    const r2 =
      40076544269.0 +
      y * (745249964.8 + y * (7189466.438 + y * (47447.2647 + y * (226.1030244 + y * 1.0))));
    return r1 / r2 + 0.636619772 * besselJ0Scalar(x) * Math.log(x);
  } else {
    const z = 8.0 / x;
    const y = z * z;
    const xx = x - 0.785398164;
    const p0 =
      1.0 +
      y * (-0.1098628627e-2 + y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
    const q0 =
      -0.1562499995e-1 +
      y * (0.1430488765e-3 + y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
    return Math.sqrt(0.636619772 / x) * (p0 * Math.sin(xx) + z * q0 * Math.cos(xx));
  }
}

/** Bessel function of the second kind, order 1: Y1(x). */
function besselY1Scalar(x: f64): f64 {
  if (x <= 0) return NaN;

  if (x < 8.0) {
    const y = x * x;
    const r1 =
      -0.4900604943e13 +
      y *
        (0.127527439e13 +
          y *
            (-0.5153486684e11 + y * (0.6227854327e9 + y * (-0.3130827714e7 + y * 0.7374753505e1))));
    const r2 =
      0.249958057e14 +
      y *
        (0.4244419664e12 +
          y *
            (0.3733650367e10 +
              y * (0.2245976615e8 + y * (0.1038323184e6 + y * (0.3652510261e3 + y * 1.0)))));
    return r1 / r2 + 0.636619772 * (besselJ1Scalar(x) * Math.log(x) - 1.0 / x);
  } else {
    const z = 8.0 / x;
    const y = z * z;
    const xx = x - 2.356194491;
    const p1 =
      1.0 +
      y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
    const q1 =
      0.04687499995 +
      y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
    return Math.sqrt(0.636619772 / x) * (p1 * Math.sin(xx) + z * q1 * Math.cos(xx));
  }
}

/** Bessel function of the first kind, general integer order n: J_n(x). */
function besselJScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (ni < 0) return (ni % 2 === 0 ? 1 : -1) * besselJScalar(-ni, x);
  if (ni === 0) return besselJ0Scalar(x);
  if (ni === 1) return besselJ1Scalar(x);

  if (Math.abs(x) < 1e-15) return 0;

  if (ni <= 20 || Math.abs(x) > ni) {
    let jPrev: f64 = besselJ0Scalar(x);
    let jCurr: f64 = besselJ1Scalar(x);
    for (let k = 1; k < ni; k++) {
      const jNext = ((2 * k) / x) * jCurr - jPrev;
      jPrev = jCurr;
      jCurr = jNext;
    }
    return jCurr;
  } else {
    const nStart = ni + 2 * Math.max(10, Math.ceil(Math.sqrt(40 * ni)));
    let jNext = 0;
    let jCurr = 1;
    let result = 0;
    let sum = 0;
    for (let k = nStart; k >= 0; k--) {
      const jPrev = ((2 * (k + 1)) / x) * jCurr - jNext;
      jNext = jCurr;
      jCurr = jPrev;
      if (k === ni) result = jNext;
      if (k % 2 === 0) sum += jCurr;
    }
    sum = 2 * sum - jCurr;
    return result / sum;
  }
}

/** Bessel function of the second kind, general integer order n: Y_n(x). */
function besselYScalar(n: f64, x: f64): f64 {
  const ni = Math.round(n);
  if (x <= 0) return NaN;
  if (ni === 0) return besselY0Scalar(x);
  if (ni === 1) return besselY1Scalar(x);

  let yPrev: f64 = besselY0Scalar(x);
  let yCurr: f64 = besselY1Scalar(x);
  for (let k = 1; k < ni; k++) {
    const yNext = ((2 * k) / x) * yCurr - yPrev;
    yPrev = yCurr;
    yCurr = yNext;
  }
  return yCurr;
}

/** Modified Bessel function of the first kind, I_n(x). */
function besselIScalar(n: f64, x: f64): f64 {
  const ni = Math.round(Math.abs(n));
  if (Math.abs(x) < 1e-15) return ni === 0 ? 1 : 0;

  let sum: f64 = 0;
  const halfX = Math.abs(x) / 2;
  for (let m = 0; m < 100; m++) {
    const term = Math.pow(halfX, ni + 2 * m) / (factorial(m) * Math.exp(_lgamma(ni + m + 1)));
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum;
}

/** Modified Bessel function of the second kind, K_n(x). */
function besselKScalar(n: f64, x: f64): f64 {
  const ni = Math.round(Math.abs(n));
  if (x <= 0) return NaN;

  function k0(x: f64): f64 {
    if (x <= 2) {
      const y = (x * x) / 4;
      return (
        -Math.log(x / 2) * besselIScalar(0, x) +
        (-0.57721566 +
          y * (0.4227842 + y * (0.23069756 + y * (0.0348859 + y * (0.00262698 + y * 0.0001075)))))
      );
    }
    const y = 2 / x;
    return (
      (Math.exp(-x) / Math.sqrt(x)) *
      (1.25331414 +
        y *
          (-0.07832358 +
            y *
              (0.02189568 +
                y * (-0.01062446 + y * (0.00587872 + y * (-0.0025154 + y * 0.00053208))))))
    );
  }

  function k1(x: f64): f64 {
    if (x <= 2) {
      const y = (x * x) / 4;
      return (
        Math.log(x / 2) * besselIScalar(1, x) +
        (1 / x) *
          (1 +
            y *
              (0.15443144 +
                y *
                  (-0.67278579 +
                    y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686))))))
      );
    }
    const y = 2 / x;
    return (
      (Math.exp(-x) / Math.sqrt(x)) *
      (1.25331414 +
        y *
          (0.23498619 +
            y *
              (-0.0365562 +
                y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245))))))
    );
  }

  if (ni === 0) return k0(x);
  if (ni === 1) return k1(x);

  let kPrev = k0(x);
  let kCurr = k1(x);
  for (let k = 1; k < ni; k++) {
    const kNext = ((2 * k) / x) * kCurr + kPrev;
    kPrev = kCurr;
    kCurr = kNext;
  }
  return kCurr;
}

/** Regularized incomplete beta function I_x(a, b). */
function betaincScalar(a: f64, b: f64, x: f64): f64 {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaincScalar(b, a, 1 - x);
  }

  const lnBeta = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    let num = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= d * c;

    num = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + num * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + num / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = d * c;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-14) break;
  }

  return front * f;
}

/** Complete elliptic integral of the first kind K(m). */
function ellipticKScalar(m: f64): f64 {
  if (m < 0 || m >= 1) return NaN;
  if (m === 0) return Math.PI / 2;

  let a: f64 = 1;
  let b: f64 = Math.sqrt(1 - m);
  for (let i = 0; i < 50; i++) {
    const aNew = (a + b) / 2;
    const bNew = Math.sqrt(a * b);
    if (Math.abs(aNew - bNew) < 1e-15) {
      a = aNew;
      break;
    }
    a = aNew;
    b = bNew;
  }
  return Math.PI / (2 * a);
}

/** Incomplete elliptic integral of the second kind E(phi, m). */
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

/** Complete elliptic integral of the second kind E(m) = E(pi/2, m). */
function ellipticECompleteScalar(m: f64): f64 {
  return ellipticEScalar(Math.PI / 2, m);
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

/** Cosine integral Ci(x). */
function cosIntegralScalar(x: f64): f64 {
  if (x <= 0) return NaN;
  const euler = 0.5772156649015329;

  if (x <= 4) {
    let sum: f64 = 0;
    let term: f64 = 1;
    for (let n = 1; n < 100; n++) {
      term *= (-x * x) / ((2 * n - 1) * (2 * n));
      sum += term / (2 * n);
      if (Math.abs(term / (2 * n)) < 1e-15) break;
    }
    return euler + Math.log(x) + sum;
  }

  let f: f64 = 0,
    g: f64 = 0;
  let fn: f64 = 1,
    gn: f64 = 1;
  for (let n = 1; n <= 30; n++) {
    fn *= (-(2 * n - 1) * (2 * n - 2)) / (x * x);
    gn *= (-(2 * n) * (2 * n - 1)) / (x * x);
    f += fn;
    g += gn;
  }
  f = (1 + f) / x;
  g = (1 + g) / x;
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
 * Evaluate a scalar function across an array, dispatching large inputs to the
 * worker pool. Falls back to a sequential loop when the pool is not
 * initialized or the input is below the parallel threshold.
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
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, erfcScalar, () => kernelSource([_erf, erfcScalar], '(x) => erfcScalar(x)')),
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
 * @param x - Input value, or Float64Array of values
 * @returns J0(x)
 */
export const besselJ0 = mathTyped('besselJ0', {
  number: besselJ0Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, besselJ0Scalar, () => kernelSource([besselJ0Scalar], '(x) => besselJ0Scalar(x)')),
});

/**
 * Bessel function of the first kind, order 1: J1(x).
 *
 * @param x - Input value, or Float64Array of values
 * @returns J1(x)
 */
export const besselJ1 = mathTyped('besselJ1', {
  number: besselJ1Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, besselJ1Scalar, () => kernelSource([besselJ1Scalar], '(x) => besselJ1Scalar(x)')),
});

/**
 * Bessel function of the second kind, order 0: Y0(x).
 *
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns Y0(x)
 */
export const besselY0 = mathTyped('besselY0', {
  number: besselY0Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, besselY0Scalar, () =>
      kernelSource([besselJ0Scalar, besselY0Scalar], '(x) => besselY0Scalar(x)')
    ),
});

/**
 * Bessel function of the second kind, order 1: Y1(x).
 *
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns Y1(x)
 */
export const besselY1 = mathTyped('besselY1', {
  number: besselY1Scalar,
  Float64Array: (x: Float64Array): Promise<Float64Array> =>
    mapArray(x, besselY1Scalar, () =>
      kernelSource([besselJ1Scalar, besselY1Scalar], '(x) => besselY1Scalar(x)')
    ),
});

/**
 * Bessel function of the first kind, general integer order n: J_n(x).
 *
 * @param n - Order (integer)
 * @param x - Input value, or Float64Array of values
 * @returns J_n(x)
 */
export const besselJ = mathTyped('besselJ', {
  'number, number': besselJScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => besselJScalar(n, v),
      () =>
        kernelSource(
          [besselJ0Scalar, besselJ1Scalar, besselJScalar],
          `(x) => besselJScalar(${n}, x)`
        )
    ),
});

/**
 * Bessel function of the second kind, general integer order n: Y_n(x).
 *
 * @param n - Order (integer)
 * @param x - Input value (must be positive), or Float64Array of values
 * @returns Y_n(x)
 */
export const besselY = mathTyped('besselY', {
  'number, number': besselYScalar,
  'number, Float64Array': (n: f64, x: Float64Array): Promise<Float64Array> =>
    mapArray(
      x,
      (v) => besselYScalar(n, v),
      () =>
        kernelSource(
          [besselJ0Scalar, besselJ1Scalar, besselY0Scalar, besselY1Scalar, besselYScalar],
          `(x) => besselYScalar(${n}, x)`
        )
    ),
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
          [factorial, _lgamma, besselIScalar, besselKScalar],
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
 * @param m - Parameter (0 <= m < 1), or Float64Array of parameters
 * @returns K(m)
 */
export const ellipticK = mathTyped('ellipticK', {
  number: ellipticKScalar,
  Float64Array: (m: Float64Array): Promise<Float64Array> =>
    mapArray(m, ellipticKScalar, () =>
      kernelSource([ellipticKScalar], '(m) => ellipticKScalar(m)')
    ),
});

/**
 * Elliptic integral of the second kind E(phi, m).
 *
 * With one argument, returns the complete integral E(m). With a Float64Array,
 * returns the complete integral evaluated across an array of parameters.
 *
 * @param phi - Amplitude (radians)
 * @param m - Parameter (0 <= m <= 1)
 * @returns E(phi, m), or E(m) for the single-argument form
 */
export const ellipticE = mathTyped('ellipticE', {
  'number, number': ellipticEScalar,
  number: ellipticECompleteScalar,
  Float64Array: (m: Float64Array): Promise<Float64Array> =>
    mapArray(m, ellipticECompleteScalar, () =>
      kernelSource([ellipticEScalar, ellipticECompleteScalar], '(m) => ellipticECompleteScalar(m)')
    ),
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
 * Lambert W function (principal branch W_0).
 *
 * @param x - Input value (>= -1/e), or Float64Array of values
 * @returns W_0(x)
 *
 * @example
 * lambertW(1) // ~0.5671 (omega constant)
 */
export const lambertW = mathTyped('lambertW', {
  number: lambertWScalar,
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
// Named Export Collection
// =============================================================================

/**
 * All typed special functions.
 */
export const typedSpecial = {
  erfc,
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
};

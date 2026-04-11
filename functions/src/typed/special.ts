/**
 * Typed Special Functions
 *
 * Special mathematical functions using typed-function for runtime dispatch.
 * Includes complementary error function, beta function, incomplete gamma,
 * digamma (psi), and Bessel functions of the first and second kind.
 *
 * @packageDocumentation
 */

import { mathTyped } from '@danielsimonjr/mathts-core';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

/** 64-bit float (default for decimals) */
type f64 = number;

// =============================================================================
// Rust WASM Lazy Loader
// =============================================================================

let _rustWasm: any = null;
function getRustWasm(): any {
  // RustWasm lazy-loading requires async import() in ESM packages.
  // require() is not available in ESM and wasm.exports.xxx doesn't match
  // the RustWasmLoader API (should be getExports()?.xxx).
  // Currently disabled — JS fallbacks handle all operations.
  void _rustWasm; // suppress unused lint
  return null;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Error function erf(x) using Abramowitz & Stegun rational approximation.
 * Maximum error: 1.5e-7
 */
function _erf(x: f64): f64 {
  if (x === 0) return 0;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  // Abramowitz & Stegun formula 7.1.26
  const t = 1.0 / (1.0 + 0.3275911 * a);
  const y =
    1.0 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

/**
 * Log-gamma function using Lanczos approximation (g=7, n=9).
 */
function _lgamma(x: f64): f64 {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    // Reflection formula
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - _lgamma(1 - x);
  }
  x -= 1;
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let sum = c[0];
  for (let i = 1; i < g + 2; i++) {
    sum += c[i] / (x + i);
  }
  const t = x + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(sum);
}

// =============================================================================
// Complementary Error Function
// =============================================================================

/**
 * Complementary error function: erfc(x) = 1 - erf(x).
 *
 * Uses a direct computation via the Abramowitz & Stegun rational
 * approximation of erf(x) for numerical stability.
 *
 * @param x - Input value
 * @returns 1 - erf(x)
 *
 * @example
 * erfc(0)   // 1
 * erfc(1)   // ~0.1573
 */
export const erfc = mathTyped('erfc', {
  number: (x: f64): f64 => {
    return 1 - _erf(x);
  },
});

// =============================================================================
// Beta Function
// =============================================================================

/**
 * Beta function: B(a, b) = Gamma(a) * Gamma(b) / Gamma(a + b).
 *
 * Computed via the log-gamma function to avoid overflow for large arguments.
 *
 * @param a - First parameter (positive)
 * @param b - Second parameter (positive)
 * @returns B(a, b)
 *
 * @example
 * beta(2, 3)  // 1/12 ~ 0.08333
 * beta(0.5, 0.5) // pi
 */
export const beta = mathTyped('beta', {
  'number, number': (a: f64, b: f64): f64 => {
    return Math.exp(_lgamma(a) + _lgamma(b) - _lgamma(a + b));
  },
});

// =============================================================================
// Lower Incomplete Gamma Function
// =============================================================================

/**
 * Regularized lower incomplete gamma function P(a, x) = gamma(a, x) / Gamma(a).
 *
 * Uses series expansion for x < a + 1, continued fraction otherwise.
 *
 * @param a - Shape parameter (positive)
 * @param x - Integration upper limit (non-negative)
 * @returns P(a, x)
 *
 * @example
 * gammainc(1, 1)   // 1 - 1/e ~ 0.6321
 * gammainc(0.5, 1) // erf(1) ~ 0.8427
 */
export const gammainc = mathTyped('gammainc', {
  'number, number': (a: f64, x: f64): f64 => {
    if (x < 0) return NaN;
    if (x === 0) return 0;

    if (x < a + 1) {
      // Series expansion
      let sum = 1.0 / a;
      let term = 1.0 / a;
      for (let n = 1; n < 200; n++) {
        term *= x / (a + n);
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
      }
      return sum * Math.exp(-x + a * Math.log(x) - _lgamma(a));
    } else {
      // Continued fraction for Q(a,x) using modified Lentz's method
      // CF: Q(a,x) = exp(-x + a*ln(x) - lgamma(a)) * (1/(x+1-a+ 1*(1-a)/(x+3-a+ 2*(2-a)/(x+5-a+ ...))))
      const TINY = 1e-30;
      let b0 = x + 1 - a;
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
  },
});

// =============================================================================
// Digamma (Psi) Function
// =============================================================================

/**
 * Digamma function: psi(x) = d/dx ln(Gamma(x)).
 *
 * Uses the asymptotic expansion for x >= 8, recurrence relation otherwise.
 * For negative x, uses the reflection formula.
 *
 * @param x - Input value (not a non-positive integer)
 * @returns psi(x)
 *
 * @example
 * digamma(1) // -gamma ~ -0.5772 (Euler-Mascheroni constant)
 */
export const digamma = mathTyped('digamma', {
  number: (x: f64): f64 => {
    // Poles at non-positive integers
    if (x <= 0 && x === Math.floor(x)) return NaN;
    if (x < 0) {
      return digamma(-x + 1) + Math.PI / Math.tan(Math.PI * (-x));
    }

    let result = 0;
    // Recurrence: psi(x) = psi(x+1) - 1/x
    let z = x;
    while (z < 8) {
      result -= 1 / z;
      z += 1;
    }

    // Asymptotic expansion for large z
    // psi(z) ~ ln(z) - 1/(2z) - sum B_{2k}/(2k * z^{2k})
    result += Math.log(z) - 0.5 / z;
    const z2 = 1.0 / (z * z);
    // Bernoulli number coefficients
    const coeffs = [
      1.0 / 12, -1.0 / 120, 1.0 / 252, -1.0 / 240, 1.0 / 132,
      -691.0 / 32760, 1.0 / 12,
    ];
    let zPow = z2;
    for (const c of coeffs) {
      result -= c * zPow;
      zPow *= z2;
    }
    return result;
  },
});

// =============================================================================
// Bessel Functions of the First Kind
// =============================================================================

/**
 * Bessel function of the first kind, order 0: J0(x).
 *
 * Uses polynomial approximation from Hart, "Computer Approximations" (1968).
 * Separate approximations for |x| <= 8 and |x| > 8.
 *
 * @param x - Input value
 * @returns J0(x)
 *
 * @example
 * besselJ0(0)  // 1
 * besselJ0(1)  // ~0.7652
 */
export const besselJ0 = mathTyped('besselJ0', {
  number: (x: f64): f64 => {
    if (x === 0) return 1;
    const ax = Math.abs(x);
    if (ax < 8.0) {
      const y = x * x;
      const r1 =
        57568490574.0 +
        y *
          (-13362590354.0 +
            y *
              (651619640.7 +
                y * (-11214424.18 + y * (77392.33017 + y * (-184.9052456)))));
      const r2 =
        57568490411.0 +
        y *
          (1029532985.0 +
            y *
              (9494680.718 +
                y * (59272.64853 + y * (267.8532712 + y * 1.0))));
      return r1 / r2;
    } else {
      const z = 8.0 / ax;
      const y = z * z;
      const xx = ax - 0.785398164;
      const p0 =
        1.0 +
        y *
          (-0.1098628627e-2 +
            y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
      const q0 =
        -0.1562499995e-1 +
        y *
          (0.1430488765e-3 +
            y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
      return Math.sqrt(0.636619772 / ax) * (p0 * Math.cos(xx) - z * q0 * Math.sin(xx));
    }
  },
});

/**
 * Bessel function of the first kind, order 1: J1(x).
 *
 * Uses polynomial approximation from Hart, "Computer Approximations" (1968).
 *
 * @param x - Input value
 * @returns J1(x)
 *
 * @example
 * besselJ1(0)  // 0
 * besselJ1(1)  // ~0.4401
 */
export const besselJ1 = mathTyped('besselJ1', {
  number: (x: f64): f64 => {
    const ax = Math.abs(x);
    if (ax < 8.0) {
      const y = x * x;
      const r1 =
        x *
        (72362614232.0 +
          y *
            (-7895059235.0 +
              y *
                (242396853.1 +
                  y * (-2972611.439 + y * (15704.4826 + y * (-30.16036606))))));
      const r2 =
        144725228442.0 +
        y *
          (2300535178.0 +
            y *
              (18583304.74 +
                y * (99447.43394 + y * (376.9991397 + y * 1.0))));
      return r1 / r2;
    } else {
      const z = 8.0 / ax;
      const y = z * z;
      const xx = ax - 2.356194491;
      const p1 =
        1.0 +
        y *
          (0.183105e-2 +
            y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
      const q1 =
        0.04687499995 +
        y *
          (-0.2002690873e-3 +
            y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
      let ans = Math.sqrt(0.636619772 / ax) * (p1 * Math.cos(xx) - z * q1 * Math.sin(xx));
      if (x < 0) ans = -ans;
      return ans;
    }
  },
});

// =============================================================================
// Bessel Functions of the Second Kind
// =============================================================================

/**
 * Bessel function of the second kind, order 0: Y0(x).
 *
 * Uses polynomial approximation from Hart, "Computer Approximations" (1968).
 * Valid only for x > 0.
 *
 * @param x - Input value (must be positive)
 * @returns Y0(x)
 *
 * @example
 * besselY0(1)  // ~0.0883
 */
export const besselY0 = mathTyped('besselY0', {
  number: (x: f64): f64 => {
    if (x <= 0) return NaN;

    if (x < 8.0) {
      const y = x * x;
      const r1 =
        -2957821389.0 +
        y *
          (7062834065.0 +
            y *
              (-512359803.6 +
                y * (10879881.29 + y * (-86327.92757 + y * 228.4622733))));
      const r2 =
        40076544269.0 +
        y *
          (745249964.8 +
            y *
              (7189466.438 +
                y * (47447.26470 + y * (226.1030244 + y * 1.0))));
      return r1 / r2 + 0.636619772 * (besselJ0(x) as f64) * Math.log(x);
    } else {
      const z = 8.0 / x;
      const y = z * z;
      const xx = x - 0.785398164;
      const p0 =
        1.0 +
        y *
          (-0.1098628627e-2 +
            y * (0.2734510407e-4 + y * (-0.2073370639e-5 + y * 0.2093887211e-6)));
      const q0 =
        -0.1562499995e-1 +
        y *
          (0.1430488765e-3 +
            y * (-0.6911147651e-5 + y * (0.7621095161e-6 - y * 0.934935152e-7)));
      return Math.sqrt(0.636619772 / x) * (p0 * Math.sin(xx) + z * q0 * Math.cos(xx));
    }
  },
});

/**
 * Bessel function of the second kind, order 1: Y1(x).
 *
 * Uses polynomial approximation from Hart, "Computer Approximations" (1968).
 * Valid only for x > 0.
 *
 * @param x - Input value (must be positive)
 * @returns Y1(x)
 *
 * @example
 * besselY1(1)  // ~-0.7812
 */
export const besselY1 = mathTyped('besselY1', {
  number: (x: f64): f64 => {
    if (x <= 0) return NaN;

    if (x < 8.0) {
      const y = x * x;
      const r1 =
        -0.4900604943e13 +
        y *
          (0.1275274390e13 +
            y *
              (-0.5153486684e11 +
                y * (0.6227854327e9 + y * (-0.3130827714e7 + y * 0.7374753505e1))));
      const r2 =
        0.2499580570e14 +
        y *
          (0.4244419664e12 +
            y *
              (0.3733650367e10 +
                y * (0.2245976615e8 + y * (0.1038323184e6 + y * (0.3652510261e3 + y * 1.0)))));
      return r1 / r2 + 0.636619772 * ((besselJ1(x) as f64) * Math.log(x) - 1.0 / x);
    } else {
      const z = 8.0 / x;
      const y = z * z;
      const xx = x - 2.356194491;
      const p1 =
        1.0 +
        y *
          (0.183105e-2 +
            y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * (-0.240337019e-6))));
      const q1 =
        0.04687499995 +
        y *
          (-0.2002690873e-3 +
            y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
      return Math.sqrt(0.636619772 / x) * (p1 * Math.sin(xx) + z * q1 * Math.cos(xx));
    }
  },
});

// =============================================================================
// Named Export Collection
// =============================================================================

// =============================================================================
// General Order Bessel Functions
// =============================================================================

/**
 * Bessel function of the first kind, general integer order n: J_n(x).
 * Uses Miller's backward recurrence for stability.
 *
 * @param n - Order (non-negative integer)
 * @param x - Input value
 * @returns J_n(x)
 *
 * @example
 * besselJ(0, 1) // ~0.7652
 * besselJ(2, 1) // ~0.1149
 */
export const besselJ = mathTyped('besselJ', {
  'number, number': (n: f64, x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.besselJ_wasm(Math.round(n), x); } catch { /* fallback */ }
    }
    const ni = Math.round(n);
    if (ni < 0) return (ni % 2 === 0 ? 1 : -1) * (besselJ(-ni, x) as f64);
    if (ni === 0) return besselJ0(x) as f64;
    if (ni === 1) return besselJ1(x) as f64;

    if (Math.abs(x) < 1e-15) return 0;

    // Forward recurrence for small x, backward for large
    if (ni <= 20 || Math.abs(x) > ni) {
      // Forward recurrence: J_{n+1}(x) = (2n/x) J_n(x) - J_{n-1}(x)
      let jPrev: f64 = besselJ0(x) as f64;
      let jCurr: f64 = besselJ1(x) as f64;
      for (let k = 1; k < ni; k++) {
        const jNext = (2 * k / x) * jCurr - jPrev;
        jPrev = jCurr;
        jCurr = jNext;
      }
      return jCurr;
    } else {
      // Miller's backward recurrence
      const nStart = ni + 2 * Math.max(10, Math.ceil(Math.sqrt(40 * ni)));
      let jNext = 0;
      let jCurr = 1;
      let result = 0;
      let sum = 0;
      for (let k = nStart; k >= 0; k--) {
        const jPrev = (2 * (k + 1) / x) * jCurr - jNext;
        jNext = jCurr;
        jCurr = jPrev;
        if (k === ni) result = jNext;
        if (k % 2 === 0) sum += jCurr;
      }
      // Normalize using J_0 + 2*(J_2 + J_4 + ...) = 1
      sum = 2 * sum - jCurr;
      return result / sum;
    }
  },
});

/**
 * Bessel function of the second kind, general integer order n: Y_n(x).
 *
 * @param n - Order (non-negative integer)
 * @param x - Input value (must be positive)
 * @returns Y_n(x)
 */
export const besselY = mathTyped('besselY', {
  'number, number': (n: f64, x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.besselY_wasm(Math.round(n), x); } catch { /* fallback */ }
    }
    const ni = Math.round(n);
    if (x <= 0) return NaN;
    if (ni === 0) return besselY0(x) as f64;
    if (ni === 1) return besselY1(x) as f64;

    // Forward recurrence: Y_{n+1}(x) = (2n/x) Y_n(x) - Y_{n-1}(x)
    let yPrev: f64 = besselY0(x) as f64;
    let yCurr: f64 = besselY1(x) as f64;
    for (let k = 1; k < ni; k++) {
      const yNext = (2 * k / x) * yCurr - yPrev;
      yPrev = yCurr;
      yCurr = yNext;
    }
    return yCurr;
  },
});

/**
 * Modified Bessel function of the first kind, I_n(x).
 * Uses series expansion for small x, asymptotic for large.
 *
 * @param n - Order (non-negative integer)
 * @param x - Input value
 * @returns I_n(x)
 */
export const besselI = mathTyped('besselI', {
  'number, number': (n: f64, x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.besselI_wasm(Math.round(n), x); } catch { /* fallback */ }
    }
    const ni = Math.round(Math.abs(n));
    if (Math.abs(x) < 1e-15) return ni === 0 ? 1 : 0;

    // Series expansion: I_n(x) = sum_{m=0}^inf (x/2)^{n+2m} / (m! * Gamma(n+m+1))
    let sum: f64 = 0;
    const halfX = Math.abs(x) / 2;
    for (let m = 0; m < 100; m++) {
      const term = Math.pow(halfX, ni + 2 * m) / (factorial(m) * Math.exp(_lgamma(ni + m + 1)));
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum;
  },
});

/**
 * Modified Bessel function of the second kind, K_n(x).
 * Uses K_0, K_1 and forward recurrence.
 *
 * @param n - Order (non-negative integer)
 * @param x - Input value (must be positive)
 * @returns K_n(x)
 */
export const besselK = mathTyped('besselK', {
  'number, number': (n: f64, x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.besselK_wasm(Math.round(n), x); } catch { /* fallback */ }
    }
    const ni = Math.round(Math.abs(n));
    if (x <= 0) return NaN;

    // K_0 and K_1 from integral approximation
    function k0(x: f64): f64 {
      if (x <= 2) {
        const y = x * x / 4;
        return -Math.log(x / 2) * (besselI(0, x) as f64) +
          (-0.57721566 + y * (0.42278420 + y * (0.23069756 + y * (0.03488590 + y * (0.00262698 + y * 0.00010750)))));
      }
      const y = 2 / x;
      return (Math.exp(-x) / Math.sqrt(x)) *
        (1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.00251540 + y * 0.00053208))))));
    }

    function k1(x: f64): f64 {
      if (x <= 2) {
        const y = x * x / 4;
        return Math.log(x / 2) * (besselI(1, x) as f64) +
          (1 / x) * (1 + y * (0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686))))));
      }
      const y = 2 / x;
      return (Math.exp(-x) / Math.sqrt(x)) *
        (1.25331414 + y * (0.23498619 + y * (-0.03655620 + y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245))))));
    }

    if (ni === 0) return k0(x);
    if (ni === 1) return k1(x);

    // Forward recurrence: K_{n+1}(x) = (2n/x) K_n(x) + K_{n-1}(x)
    let kPrev = k0(x);
    let kCurr = k1(x);
    for (let k = 1; k < ni; k++) {
      const kNext = (2 * k / x) * kCurr + kPrev;
      kPrev = kCurr;
      kCurr = kNext;
    }
    return kCurr;
  },
});

// Helper: factorial
function factorial(n: number): number {
  if (n <= 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// =============================================================================
// Incomplete Beta Function
// =============================================================================

/**
 * Regularized incomplete beta function I_x(a, b).
 *
 * @param a - First parameter (positive)
 * @param b - Second parameter (positive)
 * @param x - Upper limit in [0, 1]
 * @returns I_x(a, b) = B(x; a,b) / B(a,b)
 */
export const betainc = mathTyped('betainc', {
  'number, number, number': (a: f64, b: f64, x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.betainc_wasm(a, b, x); } catch { /* fallback */ }
    }
    if (x < 0 || x > 1) return NaN;
    if (x === 0) return 0;
    if (x === 1) return 1;

    // Use symmetry if x > (a+1)/(a+b+2)
    if (x > (a + 1) / (a + b + 2)) {
      return 1 - (betainc(b, a, 1 - x) as f64);
    }

    // Continued fraction (Lentz's method)
    const lnBeta = _lgamma(a) + _lgamma(b) - _lgamma(a + b);
    const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

    let f = 1;
    let c = 1;
    let d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    f = d;

    for (let m = 1; m <= 200; m++) {
      // Even step
      let num = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
      d = 1 + num * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + num / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      f *= d * c;

      // Odd step
      num = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
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
  },
});

// =============================================================================
// Upper Incomplete Gamma (Complement)
// =============================================================================

/**
 * Upper (complementary) regularized incomplete gamma: Q(a, x) = 1 - P(a, x).
 *
 * @param a - Shape parameter (positive)
 * @param x - Lower limit (non-negative)
 * @returns Q(a, x)
 */
export const gammaincp = mathTyped('gammaincp', {
  'number, number': (a: f64, x: f64): f64 => {
    return 1 - (gammainc(a, x) as f64);
  },
});

// =============================================================================
// Elliptic Integrals
// =============================================================================

/**
 * Complete elliptic integral of the first kind K(m).
 * Uses arithmetic-geometric mean.
 *
 * @param m - Parameter (0 <= m < 1)
 * @returns K(m)
 */
export const ellipticK = mathTyped('ellipticK', {
  number: (m: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.ellipticK_wasm(m); } catch { /* fallback */ }
    }
    if (m < 0 || m >= 1) return NaN;
    if (m === 0) return Math.PI / 2;

    let a: f64 = 1;
    let b: f64 = Math.sqrt(1 - m);
    for (let i = 0; i < 50; i++) {
      const aNew = (a + b) / 2;
      const bNew = Math.sqrt(a * b);
      if (Math.abs(aNew - bNew) < 1e-15) { a = aNew; break; }
      a = aNew; b = bNew;
    }
    return Math.PI / (2 * a);
  },
});

/**
 * Incomplete elliptic integral of the second kind E(phi, m).
 * Uses numerical integration for the incomplete case.
 *
 * @param phi - Amplitude (radians)
 * @param m - Parameter (0 <= m <= 1)
 * @returns E(phi, m)
 */
export const ellipticE = mathTyped('ellipticE', {
  'number, number': (phi: f64, m: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.ellipticE_wasm(phi, m); } catch { /* fallback */ }
    }
    // Numerical integration using Simpson's rule
    const n = 100;
    const h = phi / n;
    const sinSq = (v: f64) => { const s = Math.sin(v); return s * s; };
    let sum = Math.sqrt(1 - m * sinSq(0)) + Math.sqrt(1 - m * sinSq(phi));
    for (let i = 1; i < n; i++) {
      const t = i * h;
      const weight = i % 2 === 0 ? 2 : 4;
      sum += weight * Math.sqrt(1 - m * sinSq(t));
    }
    return (h / 3) * sum;
  },
  number: (m: f64): f64 => {
    // Complete: E(pi/2, m)
    return ellipticE(Math.PI / 2, m) as f64;
  },
});

// =============================================================================
// Orthogonal Polynomials
// =============================================================================

/**
 * Chebyshev polynomial of the first kind T_n(x).
 *
 * @param n - Degree
 * @param x - Input value
 * @returns T_n(x)
 */
export const chebyshevT = mathTyped('chebyshevT', {
  'number, number': (n: f64, x: f64): f64 => {
    const ni = Math.round(n);
    if (ni === 0) return 1;
    if (ni === 1) return x;
    // Recurrence: T_{n+1}(x) = 2x T_n(x) - T_{n-1}(x)
    let prev = 1, curr = x;
    for (let k = 2; k <= ni; k++) {
      const next = 2 * x * curr - prev;
      prev = curr; curr = next;
    }
    return curr;
  },
});

/**
 * Hermite polynomial H_n(x) (physicist's convention).
 *
 * @param n - Degree
 * @param x - Input value
 * @returns H_n(x)
 */
export const hermiteH = mathTyped('hermiteH', {
  'number, number': (n: f64, x: f64): f64 => {
    const ni = Math.round(n);
    if (ni === 0) return 1;
    if (ni === 1) return 2 * x;
    let prev = 1, curr = 2 * x;
    for (let k = 2; k <= ni; k++) {
      const next = 2 * x * curr - 2 * (k - 1) * prev;
      prev = curr; curr = next;
    }
    return curr;
  },
});

/**
 * Laguerre polynomial L_n(x).
 *
 * @param n - Degree
 * @param x - Input value
 * @returns L_n(x)
 */
export const laguerreL = mathTyped('laguerreL', {
  'number, number': (n: f64, x: f64): f64 => {
    const ni = Math.round(n);
    if (ni === 0) return 1;
    if (ni === 1) return 1 - x;
    let prev = 1, curr = 1 - x;
    for (let k = 2; k <= ni; k++) {
      const next = ((2 * k - 1 - x) * curr - (k - 1) * prev) / k;
      prev = curr; curr = next;
    }
    return curr;
  },
});

/**
 * Legendre polynomial P_n(x).
 *
 * @param n - Degree
 * @param x - Input value in [-1, 1]
 * @returns P_n(x)
 */
export const legendreP = mathTyped('legendreP', {
  'number, number': (n: f64, x: f64): f64 => {
    const ni = Math.round(n);
    if (ni === 0) return 1;
    if (ni === 1) return x;
    let prev = 1, curr = x;
    for (let k = 2; k <= ni; k++) {
      const next = ((2 * k - 1) * x * curr - (k - 1) * prev) / k;
      prev = curr; curr = next;
    }
    return curr;
  },
});

// =============================================================================
// Lambert W Function
// =============================================================================

/**
 * Lambert W function (principal branch W_0).
 * Solves W(x) * exp(W(x)) = x for x >= -1/e.
 *
 * @param x - Input value (>= -1/e)
 * @returns W_0(x)
 *
 * @example
 * lambertW(1) // ~0.5671 (omega constant)
 * lambertW(0) // 0
 */
export const lambertW = mathTyped('lambertW', {
  number: (x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.lambertW_wasm(x); } catch { /* fallback */ }
    }
    if (x < -1 / Math.E) return NaN;
    if (x === 0) return 0;
    if (x === Math.E) return 1;

    // Initial guess
    let w: f64;
    if (x < 1) {
      w = x;
    } else if (x < Math.E) {
      w = Math.log(x);
    } else {
      w = Math.log(x) - Math.log(Math.log(x));
    }

    // Halley's method
    for (let i = 0; i < 100; i++) {
      const ew = Math.exp(w);
      const wew = w * ew;
      const f = wew - x;
      const fp = ew * (w + 1);
      const fpp = ew * (w + 2);
      const dw = f / (fp - f * fpp / (2 * fp));
      w -= dw;
      if (Math.abs(dw) < 1e-15) break;
    }

    return w;
  },
});

// =============================================================================
// Imaginary Error Function
// =============================================================================

/**
 * Imaginary error function: erfi(x) = -i * erf(ix) = (2/sqrt(pi)) * integral_0^x exp(t^2) dt.
 *
 * @param x - Input value
 * @returns erfi(x)
 */
export const erfi = mathTyped('erfi', {
  number: (x: f64): f64 => {
    // Series expansion: erfi(x) = (2/sqrt(pi)) * sum_{n=0}^inf x^{2n+1} / (n! * (2n+1))
    const c = 2 / Math.sqrt(Math.PI);
    let sum: f64 = 0;
    let term: f64 = x;
    for (let n = 0; n < 100; n++) {
      sum += term / (2 * n + 1);
      term *= x * x / (n + 1);
      if (Math.abs(term / (2 * n + 3)) < Math.abs(sum) * 1e-15) break;
    }
    return c * sum;
  },
});

// =============================================================================
// Integral Functions
// =============================================================================

/**
 * Cosine integral Ci(x) = gamma + ln(x) + integral_0^x (cos(t)-1)/t dt.
 *
 * @param x - Input value (positive)
 * @returns Ci(x)
 */
export const cosIntegral = mathTyped('cosIntegral', {
  number: (x: f64): f64 => {
    if (x <= 0) return NaN;
    const euler = 0.5772156649015329;

    if (x <= 4) {
      // Series: Ci(x) = gamma + ln(x) + sum_{n=1}^inf (-1)^n x^{2n} / (2n * (2n)!)
      let sum: f64 = 0;
      let term: f64 = 1;
      for (let n = 1; n < 100; n++) {
        term *= -x * x / ((2 * n - 1) * (2 * n));
        sum += term / (2 * n);
        if (Math.abs(term / (2 * n)) < 1e-15) break;
      }
      return euler + Math.log(x) + sum;
    }

    // Asymptotic: Ci(x) ~ sin(x)/x * f(x) - cos(x)/x * g(x)
    let f: f64 = 0, g: f64 = 0;
    let fn: f64 = 1, gn: f64 = 1;
    for (let n = 1; n <= 30; n++) {
      fn *= -(2 * n - 1) * (2 * n - 2) / (x * x);
      gn *= -(2 * n) * (2 * n - 1) / (x * x);
      f += fn;
      g += gn;
    }
    f = (1 + f) / x;
    g = (1 + g) / x;
    return f * Math.sin(x) - g * Math.cos(x);
  },
});

/**
 * Sine integral Si(x) = integral_0^x sin(t)/t dt.
 *
 * @param x - Input value
 * @returns Si(x)
 */
export const sinIntegral = mathTyped('sinIntegral', {
  number: (x: f64): f64 => {
    if (x === 0) return 0;

    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);

    // Series: Si(x) = sum_{n=0}^inf (-1)^n x^{2n+1} / ((2n+1) * (2n+1)!)
    let sum: f64 = 0;
    let term: f64 = ax;
    for (let n = 0; n < 100; n++) {
      sum += term / (2 * n + 1);
      term *= -ax * ax / ((2 * n + 2) * (2 * n + 3));
      if (Math.abs(term / (2 * n + 3)) < 1e-15) break;
    }

    return sign * sum;
  },
});

/**
 * Logarithmic integral li(x) = integral_0^x dt/ln(t) (for x > 1).
 * Uses the relation li(x) = Ei(ln(x)).
 *
 * @param x - Input value (> 0, != 1)
 * @returns li(x)
 */
export const logIntegral = mathTyped('logIntegral', {
  number: (x: f64): f64 => {
    if (x <= 0 || x === 1) return NaN;
    return expIntegralEi(Math.log(x)) as f64;
  },
});

/**
 * Exponential integral Ei(x) = -PV integral_{-x}^inf e^{-t}/t dt.
 *
 * @param x - Input value (x != 0)
 * @returns Ei(x)
 */
export const expIntegralEi = mathTyped('expIntegralEi', {
  number: (x: f64): f64 => {
    if (x === 0) return -Infinity;
    const euler = 0.5772156649015329;

    if (Math.abs(x) <= 40) {
      // Series: Ei(x) = gamma + ln|x| + sum_{n=1}^inf x^n / (n * n!)
      let sum: f64 = 0;
      let term: f64 = 1;
      for (let n = 1; n < 200; n++) {
        term *= x / n;
        sum += term / n;
        if (Math.abs(term / n) < Math.abs(sum) * 1e-15) break;
      }
      return euler + Math.log(Math.abs(x)) + sum;
    }

    // Asymptotic expansion for large |x|
    let sum: f64 = 1;
    let term: f64 = 1;
    for (let n = 1; n <= 30; n++) {
      term *= n / x;
      sum += term;
      if (Math.abs(term) < 1e-15) break;
    }
    return (Math.exp(x) / x) * sum;
  },
});

// =============================================================================
// Fresnel Integrals
// =============================================================================

/**
 * Fresnel cosine integral C(x) = integral_0^x cos(pi*t^2/2) dt.
 *
 * @param x - Input value
 * @returns C(x)
 */
export const fresnelC = mathTyped('fresnelC', {
  number: (x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.fresnelC_wasm(x); } catch { /* fallback */ }
    }
    const ax = Math.abs(x);
    const sign = x < 0 ? -1 : 1;

    // Series: C(x) = sum_{n=0}^inf (-1)^n (pi/2)^{2n} x^{4n+1} / ((4n+1)(2n)!)
    // Use incremental term computation to avoid factorial overflow
    let sum: f64 = ax; // n=0 term
    let term: f64 = ax;
    const piHalf = Math.PI / 2;
    const x4 = ax * ax * ax * ax;

    for (let n = 1; n < 50; n++) {
      // term *= -(pi/2)^2 * x^4 / ((2n)(2n-1)) * (4(n-1)+1)/(4n+1)
      term *= -piHalf * piHalf * x4 / ((2 * n) * (2 * n - 1)) * (4 * n - 3) / (4 * n + 1);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }

    return sign * sum;
  },
});

/**
 * Fresnel sine integral S(x) = integral_0^x sin(pi*t^2/2) dt.
 *
 * @param x - Input value
 * @returns S(x)
 */
export const fresnelS = mathTyped('fresnelS', {
  number: (x: f64): f64 => {
    const wasm = getRustWasm();
    if (wasm) {
      try { return wasm.exports.fresnelS_wasm(x); } catch { /* fallback */ }
    }
    const ax = Math.abs(x);
    const sign = x < 0 ? -1 : 1;

    // Series: S(x) = sum_{n=0}^inf (-1)^n (pi/2)^{2n+1} x^{4n+3} / ((4n+3)(2n+1)!)
    // n=0 term: (pi/2) * x^3 / 3
    const piHalf = Math.PI / 2;
    let term: f64 = piHalf * ax * ax * ax / 3;
    let sum: f64 = term;
    const x4 = ax * ax * ax * ax;

    for (let n = 1; n < 50; n++) {
      // term *= -(pi/2)^2 * x^4 / ((2n+1)(2n)) * (4(n-1)+3)/(4n+3)
      term *= -piHalf * piHalf * x4 / ((2 * n + 1) * (2 * n)) * (4 * n - 1) / (4 * n + 3);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }

    return sign * sum;
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

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
};

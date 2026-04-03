/**
 * Scalar Operations for AssemblyScript
 *
 * Basic numeric operations exported for WASM.
 * These wrap the built-in AssemblyScript math functions with
 * consistent naming and behavior.
 */

// =============================================================================
// Basic Arithmetic
// =============================================================================

/**
 * Add two f64 values
 */
export function add_f64(a: f64, b: f64): f64 {
  return a + b;
}

/**
 * Subtract two f64 values
 */
export function sub_f64(a: f64, b: f64): f64 {
  return a - b;
}

/**
 * Multiply two f64 values
 */
export function mul_f64(a: f64, b: f64): f64 {
  return a * b;
}

/**
 * Divide two f64 values
 */
export function div_f64(a: f64, b: f64): f64 {
  return a / b;
}

/**
 * Modulo operation
 */
export function mod_f64(a: f64, b: f64): f64 {
  return a % b;
}

/**
 * Negation
 */
export function neg_f64(a: f64): f64 {
  return -a;
}

// =============================================================================
// Power and Roots
// =============================================================================

/**
 * Square root
 */
export function sqrt_f64(a: f64): f64 {
  return sqrt(a);
}

/**
 * Power (a^b)
 */
export function pow_f64(a: f64, b: f64): f64 {
  return Math.pow(a, b);
}

/**
 * Square
 */
export function square_f64(a: f64): f64 {
  return a * a;
}

/**
 * Cube
 */
export function cube_f64(a: f64): f64 {
  return a * a * a;
}

/**
 * Cube root
 */
export function cbrt_f64(a: f64): f64 {
  if (a >= 0) {
    return Math.pow(a, 1.0 / 3.0);
  }
  return -Math.pow(-a, 1.0 / 3.0);
}

/**
 * N-th root
 */
export function nthRoot_f64(a: f64, n: f64): f64 {
  if (n == 0.0) return f64.NaN;
  if (a >= 0) {
    return Math.pow(a, 1.0 / n);
  }
  // For negative bases, only odd integer roots are real
  const nInt = i64(n);
  if (f64(nInt) == n && (nInt & 1) == 1) {
    return -Math.pow(-a, 1.0 / n);
  }
  return f64.NaN;
}

// =============================================================================
// Exponential and Logarithmic
// =============================================================================

/**
 * Natural exponential (e^x)
 */
export function exp_f64(a: f64): f64 {
  return Math.exp(a);
}

/**
 * e^x - 1 (more accurate for small x)
 */
export function expm1_f64(a: f64): f64 {
  return Math.expm1(a);
}

/**
 * Natural logarithm
 */
export function log_f64(a: f64): f64 {
  return Math.log(a);
}

/**
 * Math.log(1 + x) (more accurate for small x)
 */
export function log1p_f64(a: f64): f64 {
  return Math.log1p(a);
}

/**
 * Base-10 logarithm
 */
export function log10_f64(a: f64): f64 {
  return Math.log10(a);
}

/**
 * Base-2 logarithm
 */
export function log2_f64(a: f64): f64 {
  return Math.log2(a);
}

// =============================================================================
// Trigonometric Functions
// =============================================================================

/**
 * Sine
 */
export function sin_f64(a: f64): f64 {
  return Math.sin(a);
}

/**
 * Cosine
 */
export function cos_f64(a: f64): f64 {
  return Math.cos(a);
}

/**
 * Tangent
 */
export function tan_f64(a: f64): f64 {
  return Math.tan(a);
}

/**
 * Arc sine
 */
export function asin_f64(a: f64): f64 {
  return Math.asin(a);
}

/**
 * Arc cosine
 */
export function acos_f64(a: f64): f64 {
  return Math.acos(a);
}

/**
 * Arc tangent
 */
export function atan_f64(a: f64): f64 {
  return Math.atan(a);
}

/**
 * Two-argument arc tangent
 */
export function atan2_f64(y: f64, x: f64): f64 {
  return Math.atan2(y, x);
}

// =============================================================================
// Hyperbolic Functions
// =============================================================================

/**
 * Hyperbolic sine
 */
export function sinh_f64(a: f64): f64 {
  const ex = Math.exp(a);
  return (ex - 1.0 / ex) / 2.0;
}

/**
 * Hyperbolic cosine
 */
export function cosh_f64(a: f64): f64 {
  const ex = Math.exp(a);
  return (ex + 1.0 / ex) / 2.0;
}

/**
 * Hyperbolic tangent
 */
export function tanh_f64(a: f64): f64 {
  const ex = Math.exp(2.0 * a);
  return (ex - 1.0) / (ex + 1.0);
}

/**
 * Inverse hyperbolic sine
 */
export function asinh_f64(a: f64): f64 {
  return Math.log(a + sqrt(a * a + 1.0));
}

/**
 * Inverse hyperbolic cosine
 */
export function acosh_f64(a: f64): f64 {
  return Math.log(a + sqrt(a * a - 1.0));
}

/**
 * Inverse hyperbolic tangent
 */
export function atanh_f64(a: f64): f64 {
  return 0.5 * Math.log((1.0 + a) / (1.0 - a));
}

// =============================================================================
// Rounding and Comparison
// =============================================================================

/**
 * Absolute value
 */
export function abs_f64(a: f64): f64 {
  return abs(a);
}

/**
 * Floor
 */
export function floor_f64(a: f64): f64 {
  return floor(a);
}

/**
 * Ceiling
 */
export function ceil_f64(a: f64): f64 {
  return ceil(a);
}

/**
 * Round to nearest
 */
export function round_f64(a: f64): f64 {
  return nearest(a);
}

/**
 * Truncate (round toward zero)
 */
export function trunc_f64(a: f64): f64 {
  return trunc(a);
}

/**
 * Sign function (-1, 0, or 1)
 */
export function sign_f64(a: f64): f64 {
  if (a > 0.0) return 1.0;
  if (a < 0.0) return -1.0;
  return 0.0;
}

/**
 * Minimum of two values
 */
export function min_f64(a: f64, b: f64): f64 {
  return min(a, b);
}

/**
 * Maximum of two values
 */
export function max_f64(a: f64, b: f64): f64 {
  return max(a, b);
}

/**
 * Clamp value to range [lo, hi]
 */
export function clamp_f64(value: f64, lo: f64, hi: f64): f64 {
  return max(lo, min(hi, value));
}

// =============================================================================
// Special Values
// =============================================================================

/**
 * Check if value is NaN
 */
export function isNaN_f64(a: f64): bool {
  return isNaN(a);
}

/**
 * Check if value is finite
 */
export function isFinite_f64(a: f64): bool {
  return isFinite(a);
}

// =============================================================================
// Constants
// =============================================================================

/** Mathematical constant pi */
export const PI: f64 = 3.141592653589793;

/** Mathematical constant e */
export const E: f64 = 2.718281828459045;

/** Golden ratio phi */
export const PHI: f64 = 1.618033988749895;

/** Square root of 2 */
export const SQRT2: f64 = 1.4142135623730951;

/** Square root of 1/2 */
export const SQRT1_2: f64 = 0.7071067811865476;

/** Natural log of 2 */
export const LN2: f64 = 0.6931471805599453;

/** Natural log of 10 */
export const LN10: f64 = 2.302585092994046;

/** Log base 2 of e */
export const LOG2E: f64 = 1.4426950408889634;

/** Log base 10 of e */
export const LOG10E: f64 = 0.4342944819032518;

/** Machine epsilon for f64 */
export const EPSILON: f64 = 2.220446049250313e-16;

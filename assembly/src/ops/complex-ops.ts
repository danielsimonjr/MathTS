/**
 * Complex Number Operations for AssemblyScript
 *
 * Standalone functions for complex number arithmetic.
 * These complement the Complex class methods for use cases
 * where functional style is preferred.
 */

import { Complex, complexFromPolar } from '../types/complex';

// =============================================================================
// Basic Arithmetic
// =============================================================================

/**
 * Add two complex numbers
 */
export function complex_add(a: Complex, b: Complex): Complex {
  return a.add(b);
}

/**
 * Subtract two complex numbers
 */
export function complex_sub(a: Complex, b: Complex): Complex {
  return a.sub(b);
}

/**
 * Multiply two complex numbers
 */
export function complex_mul(a: Complex, b: Complex): Complex {
  return a.mul(b);
}

/**
 * Divide two complex numbers
 */
export function complex_div(a: Complex, b: Complex): Complex {
  return a.div(b);
}

/**
 * Negate a complex number
 */
export function complex_neg(a: Complex): Complex {
  return a.neg();
}

/**
 * Complex conjugate
 */
export function complex_conj(a: Complex): Complex {
  return a.conj();
}

/**
 * Reciprocal (1/z)
 */
export function complex_reciprocal(a: Complex): Complex {
  return a.reciprocal();
}

// =============================================================================
// Magnitude and Phase
// =============================================================================

/**
 * Absolute value (magnitude)
 */
export function complex_abs(a: Complex): f64 {
  return a.abs();
}

/**
 * Argument (phase angle)
 */
export function complex_arg(a: Complex): f64 {
  return a.arg();
}

/**
 * Squared magnitude (faster than abs^2)
 */
export function complex_abs_squared(a: Complex): f64 {
  return a.re * a.re + a.im * a.im;
}

// =============================================================================
// Power and Root Functions
// =============================================================================

/**
 * Square root of complex number
 */
export function complex_sqrt(a: Complex): Complex {
  return a.sqrt();
}

/**
 * Complex power: a^n where n is real
 */
export function complex_pow(a: Complex, n: f64): Complex {
  return a.powReal(n);
}

/**
 * Complex to complex power: a^b
 */
export function complex_cpow(a: Complex, b: Complex): Complex {
  // a^b = Math.exp(b * Math.log(a))
  const logA = a.log();
  const product = new Complex(
    b.re * logA.re - b.im * logA.im,
    b.re * logA.im + b.im * logA.re
  );
  return product.exp();
}

/**
 * Square
 */
export function complex_square(a: Complex): Complex {
  return new Complex(
    a.re * a.re - a.im * a.im,
    2.0 * a.re * a.im
  );
}

/**
 * Cube
 */
export function complex_cube(a: Complex): Complex {
  const re2 = a.re * a.re;
  const im2 = a.im * a.im;
  return new Complex(
    a.re * (re2 - 3.0 * im2),
    a.im * (3.0 * re2 - im2)
  );
}

// =============================================================================
// Exponential and Logarithmic
// =============================================================================

/**
 * Complex exponential
 */
export function complex_exp(a: Complex): Complex {
  return a.exp();
}

/**
 * Complex natural logarithm
 */
export function complex_log(a: Complex): Complex {
  return a.log();
}

/**
 * Complex base-10 logarithm
 */
export function complex_log10(a: Complex): Complex {
  const ln = a.log();
  const ln10 = 2.302585092994046;
  return new Complex(ln.re / ln10, ln.im / ln10);
}

/**
 * Complex base-2 logarithm
 */
export function complex_log2(a: Complex): Complex {
  const ln = a.log();
  const ln2 = 0.6931471805599453;
  return new Complex(ln.re / ln2, ln.im / ln2);
}

// =============================================================================
// Trigonometric Functions
// =============================================================================

/**
 * Complex sine
 */
export function complex_sin(a: Complex): Complex {
  return a.sin();
}

/**
 * Complex cosine
 */
export function complex_cos(a: Complex): Complex {
  return a.cos();
}

/**
 * Complex tangent
 */
export function complex_tan(a: Complex): Complex {
  return a.tan();
}

/**
 * Complex arc sine
 */
export function complex_asin(a: Complex): Complex {
  return a.asin();
}

/**
 * Complex arc cosine
 */
export function complex_acos(a: Complex): Complex {
  return a.acos();
}

/**
 * Complex arc tangent
 */
export function complex_atan(a: Complex): Complex {
  return a.atan();
}

// =============================================================================
// Hyperbolic Functions
// =============================================================================

/**
 * Complex hyperbolic sine
 */
export function complex_sinh(a: Complex): Complex {
  return a.sinh();
}

/**
 * Complex hyperbolic cosine
 */
export function complex_cosh(a: Complex): Complex {
  return a.cosh();
}

/**
 * Complex hyperbolic tangent
 */
export function complex_tanh(a: Complex): Complex {
  return a.tanh();
}

/**
 * Complex inverse hyperbolic sine
 */
export function complex_asinh(a: Complex): Complex {
  return a.asinh();
}

/**
 * Complex inverse hyperbolic cosine
 */
export function complex_acosh(a: Complex): Complex {
  return a.acosh();
}

/**
 * Complex inverse hyperbolic tangent
 */
export function complex_atanh(a: Complex): Complex {
  return a.atanh();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check equality (exact)
 */
export function complex_equals(a: Complex, b: Complex): bool {
  return a.equals(b);
}

/**
 * Check approximate equality
 */
export function complex_approx_equals(a: Complex, b: Complex, tolerance: f64): bool {
  return a.approxEquals(b, tolerance);
}

/**
 * Check if complex number is zero
 */
export function complex_is_zero(a: Complex): bool {
  return a.isZero();
}

/**
 * Check if complex number is real (imaginary part is zero)
 */
export function complex_is_real(a: Complex): bool {
  return a.isReal();
}

/**
 * Check if complex number is purely imaginary
 */
export function complex_is_imaginary(a: Complex): bool {
  return a.isImaginary();
}

/**
 * Check if complex number is NaN
 */
export function complex_is_nan(a: Complex): bool {
  return isNaN(a.re) || isNaN(a.im);
}

/**
 * Check if complex number is finite
 */
export function complex_is_finite(a: Complex): bool {
  return isFinite(a.re) && isFinite(a.im);
}

// =============================================================================
// Construction Helpers
// =============================================================================

/**
 * Create complex from real part only
 */
export function complex_from_real(re: f64): Complex {
  return new Complex(re, 0.0);
}

/**
 * Create complex from imaginary part only
 */
export function complex_from_imag(im: f64): Complex {
  return new Complex(0.0, im);
}

/**
 * Create complex from polar coordinates
 */
export function complex_from_polar(r: f64, theta: f64): Complex {
  return complexFromPolar(r, theta);
}

/**
 * Convert to polar: returns [r, theta]
 */
export function complex_to_polar(a: Complex): Float64Array {
  const result = new Float64Array(2);
  unchecked(result[0] = a.abs());
  unchecked(result[1] = a.arg());
  return result;
}

// =============================================================================
// Linear Algebra Operations
// =============================================================================

/**
 * Linear combination: alpha*a + beta*b
 */
export function complex_axpby(
  alpha: Complex, a: Complex,
  beta: Complex, b: Complex
): Complex {
  return alpha.mul(a).add(beta.mul(b));
}

/**
 * Euclidean distance between two complex numbers
 */
export function complex_distance(a: Complex, b: Complex): f64 {
  const diff = a.sub(b);
  return diff.abs();
}

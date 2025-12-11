/**
 * Complex Array Operations for AssemblyScript
 *
 * Operations on arrays of complex numbers.
 * Complex arrays use interleaved storage: [re0, im0, re1, im1, ...]
 * A Float64Array of length 2n represents n complex numbers.
 */

import { Complex } from '../types/complex';

// =============================================================================
// Array Creation
// =============================================================================

/**
 * Create complex array of zeros
 * Returns array of length 2*n (interleaved)
 */
export function complex_array_zeros(n: i32): Float64Array {
  return new Float64Array(n * 2);
}

/**
 * Create complex array of ones (1 + 0i)
 */
export function complex_array_ones(n: i32): Float64Array {
  const data = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    unchecked(data[i * 2] = 1.0);  // real part
    // imaginary part is already 0
  }
  return data;
}

/**
 * Create complex array with value (re + im*i)
 */
export function complex_array_fill(n: i32, re: f64, im: f64): Float64Array {
  const data = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    unchecked(data[i * 2] = re);
    unchecked(data[i * 2 + 1] = im);
  }
  return data;
}

// =============================================================================
// Element Access
// =============================================================================

/**
 * Get complex number at index (returns new Complex)
 */
export function complex_array_get(data: Float64Array, index: i32): Complex {
  const re = unchecked(data[index * 2]);
  const im = unchecked(data[index * 2 + 1]);
  return new Complex(re, im);
}

/**
 * Set complex number at index
 */
export function complex_array_set(data: Float64Array, index: i32, value: Complex): void {
  unchecked(data[index * 2] = value.re);
  unchecked(data[index * 2 + 1] = value.im);
}

/**
 * Set complex number at index from components
 */
export function complex_array_set_parts(data: Float64Array, index: i32, re: f64, im: f64): void {
  unchecked(data[index * 2] = re);
  unchecked(data[index * 2 + 1] = im);
}

/**
 * Get real part at index
 */
export function complex_array_get_re(data: Float64Array, index: i32): f64 {
  return unchecked(data[index * 2]);
}

/**
 * Get imaginary part at index
 */
export function complex_array_get_im(data: Float64Array, index: i32): f64 {
  return unchecked(data[index * 2 + 1]);
}

/**
 * Get number of complex elements (array length / 2)
 */
export function complex_array_length(data: Float64Array): i32 {
  return data.length / 2;
}

// =============================================================================
// Element-wise Arithmetic
// =============================================================================

/**
 * Complex array addition: result = a + b
 */
export function complex_array_add(
  a: Float64Array, b: Float64Array, result: Float64Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) + unchecked(b[i]));
  }
}

/**
 * Complex array subtraction: result = a - b
 */
export function complex_array_sub(
  a: Float64Array, b: Float64Array, result: Float64Array
): void {
  const len = min(min(a.length, b.length), result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) - unchecked(b[i]));
  }
}

/**
 * Complex array multiplication: result = a * b (element-wise)
 * (a + bi)(c + di) = (ac - bd) + (ad + bc)i
 */
export function complex_array_mul(
  a: Float64Array, b: Float64Array, result: Float64Array
): void {
  const n = min(min(a.length, b.length), result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const aRe = unchecked(a[idx]);
    const aIm = unchecked(a[idx + 1]);
    const bRe = unchecked(b[idx]);
    const bIm = unchecked(b[idx + 1]);

    unchecked(result[idx] = aRe * bRe - aIm * bIm);
    unchecked(result[idx + 1] = aRe * bIm + aIm * bRe);
  }
}

/**
 * Complex array division: result = a / b (element-wise)
 */
export function complex_array_div(
  a: Float64Array, b: Float64Array, result: Float64Array
): void {
  const n = min(min(a.length, b.length), result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const aRe = unchecked(a[idx]);
    const aIm = unchecked(a[idx + 1]);
    const bRe = unchecked(b[idx]);
    const bIm = unchecked(b[idx + 1]);

    const denom = bRe * bRe + bIm * bIm;
    unchecked(result[idx] = (aRe * bRe + aIm * bIm) / denom);
    unchecked(result[idx + 1] = (aIm * bRe - aRe * bIm) / denom);
  }
}

/**
 * Scale complex array by real scalar: result = a * scalar
 */
export function complex_array_scale_real(
  a: Float64Array, scalar: f64, result: Float64Array
): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = unchecked(a[i]) * scalar);
  }
}

/**
 * Scale complex array by complex scalar: result = a * (re + im*i)
 */
export function complex_array_scale_complex(
  a: Float64Array, re: f64, im: f64, result: Float64Array
): void {
  const n = min(a.length, result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const aRe = unchecked(a[idx]);
    const aIm = unchecked(a[idx + 1]);

    unchecked(result[idx] = aRe * re - aIm * im);
    unchecked(result[idx + 1] = aRe * im + aIm * re);
  }
}

/**
 * Negate complex array: result = -a
 */
export function complex_array_neg(a: Float64Array, result: Float64Array): void {
  const len = min(a.length, result.length);
  for (let i = 0; i < len; i++) {
    unchecked(result[i] = -unchecked(a[i]));
  }
}

/**
 * Complex conjugate array: result = conj(a)
 */
export function complex_array_conj(a: Float64Array, result: Float64Array): void {
  const n = min(a.length, result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    unchecked(result[idx] = unchecked(a[idx]));        // real unchanged
    unchecked(result[idx + 1] = -unchecked(a[idx + 1])); // negate imaginary
  }
}

// =============================================================================
// Element-wise Functions
// =============================================================================

/**
 * Magnitude (absolute value) of each element: result[i] = |a[i]|
 */
export function complex_array_abs(a: Float64Array, result: Float64Array): void {
  const n = a.length / 2;
  for (let i = 0; i < n; i++) {
    const re = unchecked(a[i * 2]);
    const im = unchecked(a[i * 2 + 1]);
    unchecked(result[i] = sqrt(re * re + im * im));
  }
}

/**
 * Phase (argument) of each element: result[i] = arg(a[i])
 */
export function complex_array_arg(a: Float64Array, result: Float64Array): void {
  const n = a.length / 2;
  for (let i = 0; i < n; i++) {
    const re = unchecked(a[i * 2]);
    const im = unchecked(a[i * 2 + 1]);
    unchecked(result[i] = atan2(im, re));
  }
}

/**
 * Square of magnitude: result[i] = |a[i]|^2
 */
export function complex_array_abs_squared(a: Float64Array, result: Float64Array): void {
  const n = a.length / 2;
  for (let i = 0; i < n; i++) {
    const re = unchecked(a[i * 2]);
    const im = unchecked(a[i * 2 + 1]);
    unchecked(result[i] = re * re + im * im);
  }
}

/**
 * Extract real parts
 */
export function complex_array_real(a: Float64Array, result: Float64Array): void {
  const n = min(a.length / 2, result.length);
  for (let i = 0; i < n; i++) {
    unchecked(result[i] = unchecked(a[i * 2]));
  }
}

/**
 * Extract imaginary parts
 */
export function complex_array_imag(a: Float64Array, result: Float64Array): void {
  const n = min(a.length / 2, result.length);
  for (let i = 0; i < n; i++) {
    unchecked(result[i] = unchecked(a[i * 2 + 1]));
  }
}

/**
 * Complex exponential: result = exp(a)
 */
export function complex_array_exp(a: Float64Array, result: Float64Array): void {
  const n = min(a.length, result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const re = unchecked(a[idx]);
    const im = unchecked(a[idx + 1]);

    const expRe = exp(re);
    unchecked(result[idx] = expRe * cos(im));
    unchecked(result[idx + 1] = expRe * sin(im));
  }
}

/**
 * Complex natural log: result = log(a)
 */
export function complex_array_log(a: Float64Array, result: Float64Array): void {
  const n = min(a.length, result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const re = unchecked(a[idx]);
    const im = unchecked(a[idx + 1]);

    unchecked(result[idx] = log(sqrt(re * re + im * im)));
    unchecked(result[idx + 1] = atan2(im, re));
  }
}

/**
 * Complex square root: result = sqrt(a)
 */
export function complex_array_sqrt(a: Float64Array, result: Float64Array): void {
  const n = min(a.length, result.length) / 2;
  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const re = unchecked(a[idx]);
    const im = unchecked(a[idx + 1]);

    const r = sqrt(re * re + im * im);
    const sqrtR = sqrt(r);
    const halfTheta = atan2(im, re) / 2.0;

    unchecked(result[idx] = sqrtR * cos(halfTheta));
    unchecked(result[idx + 1] = sqrtR * sin(halfTheta));
  }
}

// =============================================================================
// Reductions
// =============================================================================

/**
 * Sum of complex array
 */
export function complex_array_sum(a: Float64Array): Complex {
  let sumRe: f64 = 0.0;
  let sumIm: f64 = 0.0;
  const n = a.length / 2;

  for (let i = 0; i < n; i++) {
    sumRe += unchecked(a[i * 2]);
    sumIm += unchecked(a[i * 2 + 1]);
  }

  return new Complex(sumRe, sumIm);
}

/**
 * Mean of complex array
 */
export function complex_array_mean(a: Float64Array): Complex {
  const n = a.length / 2;
  if (n == 0) return new Complex(f64.NaN, f64.NaN);

  const sum = complex_array_sum(a);
  return new Complex(sum.re / f64(n), sum.im / f64(n));
}

/**
 * Dot product of two complex arrays: sum(a[i] * conj(b[i]))
 */
export function complex_array_dot(a: Float64Array, b: Float64Array): Complex {
  let sumRe: f64 = 0.0;
  let sumIm: f64 = 0.0;
  const n = min(a.length, b.length) / 2;

  for (let i = 0; i < n; i++) {
    const idx = i * 2;
    const aRe = unchecked(a[idx]);
    const aIm = unchecked(a[idx + 1]);
    const bRe = unchecked(b[idx]);
    const bIm = -unchecked(b[idx + 1]); // conjugate of b

    sumRe += aRe * bRe - aIm * bIm;
    sumIm += aRe * bIm + aIm * bRe;
  }

  return new Complex(sumRe, sumIm);
}

/**
 * L2 norm of complex array: sqrt(sum(|a[i]|^2))
 */
export function complex_array_norm(a: Float64Array): f64 {
  let sumSq: f64 = 0.0;
  const n = a.length / 2;

  for (let i = 0; i < n; i++) {
    const re = unchecked(a[i * 2]);
    const im = unchecked(a[i * 2 + 1]);
    sumSq += re * re + im * im;
  }

  return sqrt(sumSq);
}

// =============================================================================
// In-place Operations
// =============================================================================

/**
 * Scale in place: a *= scalar (real)
 */
export function complex_array_scale_inplace(a: Float64Array, scalar: f64): void {
  const len = a.length;
  for (let i = 0; i < len; i++) {
    unchecked(a[i] = unchecked(a[i]) * scalar);
  }
}

/**
 * Conjugate in place
 */
export function complex_array_conj_inplace(a: Float64Array): void {
  const n = a.length / 2;
  for (let i = 0; i < n; i++) {
    unchecked(a[i * 2 + 1] = -unchecked(a[i * 2 + 1]));
  }
}

/**
 * Add in place: a += b
 */
export function complex_array_add_inplace(a: Float64Array, b: Float64Array): void {
  const len = min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    unchecked(a[i] = unchecked(a[i]) + unchecked(b[i]));
  }
}

/**
 * Copy complex array
 */
export function complex_array_copy(src: Float64Array, dst: Float64Array): void {
  const len = min(src.length, dst.length);
  for (let i = 0; i < len; i++) {
    unchecked(dst[i] = unchecked(src[i]));
  }
}

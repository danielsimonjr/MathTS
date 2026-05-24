/**
 * MathTS AssemblyScript Entry Point
 *
 * This module exports WASM-compatible math operations optimized for
 * high-performance numerical computing.
 *
 * Features:
 * - SIMD-accelerated operations (when available)
 * - Zero-copy typed array operations
 * - Complex number arithmetic
 * - Matrix operations
 */

// =============================================================================
// Core Types
// =============================================================================

export { Complex, complex, complexFromPolar } from './types/complex';

// =============================================================================
// Scalar Operations
// =============================================================================

export {
  // Basic arithmetic
  add_f64,
  sub_f64,
  mul_f64,
  div_f64,
  mod_f64,
  neg_f64,

  // Power and roots
  sqrt_f64,
  pow_f64,
  square_f64,
  cube_f64,
  cbrt_f64,
  nthRoot_f64,

  // Exponential and logarithmic
  exp_f64,
  expm1_f64,
  log_f64,
  log1p_f64,
  log10_f64,
  log2_f64,

  // Trigonometric
  sin_f64,
  cos_f64,
  tan_f64,
  asin_f64,
  acos_f64,
  atan_f64,
  atan2_f64,

  // Hyperbolic
  sinh_f64,
  cosh_f64,
  tanh_f64,
  asinh_f64,
  acosh_f64,
  atanh_f64,

  // Rounding and comparison
  abs_f64,
  floor_f64,
  ceil_f64,
  round_f64,
  trunc_f64,
  sign_f64,
  min_f64,
  max_f64,
  clamp_f64,

  // Special values
  isNaN_f64,
  isFinite_f64,

  // Constants
  PI,
  E,
  PHI,
  SQRT2,
  SQRT1_2,
  LN2,
  LN10,
  LOG2E,
  LOG10E,
  EPSILON,
} from './ops/scalar';

// =============================================================================
// Array Operations
// =============================================================================

export {
  // Reductions
  array_sum,
  array_product,
  array_mean,
  array_variance,
  array_stddev,
  array_min,
  array_max,
  array_argmin,
  array_argmax,

  // Norms
  array_norm,
  array_norm_l1,
  array_norm_linf,

  // Vector operations
  array_dot,
  array_add,
  array_sub,
  array_mul,
  array_div,
  array_scale,
  array_add_scalar,
  array_neg,
  array_abs,
  array_sqrt,
  array_square,
  array_exp,
  array_log,
  array_sin,
  array_cos,

  // Linear algebra helpers
  array_axpby,
  array_distance,
  array_cosine_similarity,

  // In-place operations
  array_scale_inplace,
  array_add_scalar_inplace,
  array_add_inplace,
  array_clamp_inplace,
  array_fill,
  array_copy,
} from './ops/array';

// =============================================================================
// Matrix Operations
// =============================================================================

export {
  // Creation
  matrix_zeros,
  matrix_ones,
  matrix_fill,
  matrix_identity,
  matrix_diag,

  // Element access
  matrix_get,
  matrix_set,
  matrix_get_row,
  matrix_get_col,
  matrix_get_diag,

  // Arithmetic
  matrix_add,
  matrix_sub,
  matrix_mul_elementwise,
  matrix_div_elementwise,
  matrix_scale,
  matrix_add_scalar,
  matrix_neg,

  // Matrix multiplication
  matrix_multiply,
  matrix_vector_multiply,
  vector_matrix_multiply,
  matrix_outer,

  // Transpose
  matrix_transpose,

  // Reductions
  matrix_sum,
  matrix_mean,
  matrix_min,
  matrix_max,
  matrix_norm_frobenius,
  matrix_trace,
  matrix_sum_rows,
  matrix_sum_cols,

  // Queries
  matrix_is_square,
  matrix_is_symmetric,
  matrix_is_diagonal,
  matrix_is_identity,

  // In-place operations
  matrix_scale_inplace,
  matrix_add_scalar_inplace,
  matrix_add_inplace,
  matrix_copy,

  // BLAS-like operations
  matrix_axpy,
  matrix_gemm,
  matrix_gemv,
} from './ops/matrix';

// =============================================================================
// Singular Value Decomposition
// =============================================================================

export { matrix_svd, matrix_singular_values } from './ops/svd';

// =============================================================================
// Dense Matrix Decompositions (LU, QR, Cholesky, inverse, determinant)
// =============================================================================

export {
  matrix_lu_decompose,
  matrix_qr_decompose,
  matrix_cholesky,
  matrix_inverse,
  matrix_determinant,
} from './algebra/decomposition';

// =============================================================================
// Special Functions (orthogonal polynomials, integral functions)
// =============================================================================

export {
  chebyshevT,
  hermiteH,
  laguerreL,
  legendreP,
  erfi,
  expIntegralEi,
  sinIntegral,
  cosIntegral,
  logIntegral,
} from './ops/special';

// =============================================================================
// Number Theory
// =============================================================================

export {
  eulerPhi,
  divisorSigma,
  moebiusMu,
  carmichaelLambda,
  jacobiSymbol,
  harmonicNumber,
  partitions,
  primeFactors,
  divisors,
  integerDigits,
  chineseRemainder,
} from './ops/number-theory';

// =============================================================================
// Polynomial Algebra
// =============================================================================

export {
  polyadd,
  polynomialQuotient,
  polynomialRemainder,
  polynomialGCD,
  polynomialLCM,
  discriminant,
  resultant,
} from './ops/polynomial';

// =============================================================================
// Signal Windowing
// =============================================================================

export { resample, medfilt, windowFunction } from './ops/signal';

// =============================================================================
// Extra Linear Algebra (RREF, characteristic polynomial)
// =============================================================================

export { rowReduce, characteristicPolynomial } from './ops/linalg';

// =============================================================================
// Curve Fitting
// =============================================================================

export { expfit, logfit, powerfit } from './ops/curvefit';

// =============================================================================
// Optimization (linear / quadratic programming, null space)
// =============================================================================

export { quadprog, linprog, nullspace } from './ops/optimization';

// =============================================================================
// Rational Approximation (residues, Padé)
// =============================================================================

export { residue, padeApproximant } from './ops/approx';

// =============================================================================
// Rank-N Tensor Operations
// =============================================================================

export { tensorTranspose } from './ops/tensor';

// =============================================================================
// Complex Operations (standalone functions)
// =============================================================================

export {
  // Basic arithmetic
  complex_add,
  complex_sub,
  complex_mul,
  complex_div,
  complex_neg,
  complex_conj,
  complex_reciprocal,

  // Magnitude and phase
  complex_abs,
  complex_arg,
  complex_abs_squared,

  // Power and root functions
  complex_sqrt,
  complex_pow,
  complex_cpow,
  complex_square,
  complex_cube,

  // Exponential and logarithmic
  complex_exp,
  complex_log,
  complex_log10,
  complex_log2,

  // Trigonometric
  complex_sin,
  complex_cos,
  complex_tan,
  complex_asin,
  complex_acos,
  complex_atan,

  // Hyperbolic
  complex_sinh,
  complex_cosh,
  complex_tanh,
  complex_asinh,
  complex_acosh,
  complex_atanh,

  // Utility functions
  complex_equals,
  complex_approx_equals,
  complex_is_zero,
  complex_is_real,
  complex_is_imaginary,
  complex_is_nan,
  complex_is_finite,

  // Construction helpers
  complex_from_real,
  complex_from_imag,
  complex_from_polar,
  complex_to_polar,

  // Linear algebra
  complex_axpby,
  complex_distance,
} from './ops/complex-ops';

// =============================================================================
// Bitwise Operations (Int32Array, elementwise)
// =============================================================================

export {
  bitAnd_i32_array,
  bitOr_i32_array,
  bitXor_i32_array,
  bitNot_i32_array,
  leftShift_i32_array,
  rightArithShift_i32_array,
  rightLogShift_i32_array,
} from './ops/bitwise';

// =============================================================================
// Polynomial hot-loop kernels (Slice 3.7) + Fit kernels (Slice 5.4)
// =============================================================================

export { poly_mul_f64, poly_div_mod_f64, poly_fit_f64, cheb_fit_f64, legendre_fit_f64 } from './poly';

// =============================================================================
// Tridiagonal-solve kernel (Slice 3.10b) + Divided-difference kernel (Slice 5.5)
// =============================================================================

export { tridiag_solve_f64, divided_difference_f64 } from './tridiag';

// =============================================================================
// Bessel J/Y and Airy Ai/Bi array kernels (Slice 3.10c-1 / Slice 4.9)
// Elliptic K/E array kernels (Slice 5.3)
// =============================================================================

export {
  bessel_j0_f64,
  bessel_j1_f64,
  bessel_jn_f64,
  bessel_y0_f64,
  bessel_y1_f64,
  bessel_yn_f64,
  airy_ai_f64,
  airy_bi_f64,
  elliptic_k_f64,
  elliptic_e_f64,
} from './special';

// =============================================================================
// Complex Array Operations
// =============================================================================

export {
  // Creation
  complex_array_zeros,
  complex_array_ones,
  complex_array_fill,

  // Element access
  complex_array_get,
  complex_array_set,
  complex_array_set_parts,
  complex_array_get_re,
  complex_array_get_im,
  complex_array_length,

  // Element-wise arithmetic
  complex_array_add,
  complex_array_sub,
  complex_array_mul,
  complex_array_div,
  complex_array_scale_real,
  complex_array_scale_complex,
  complex_array_neg,
  complex_array_conj,

  // Element-wise functions
  complex_array_abs,
  complex_array_arg,
  complex_array_abs_squared,
  complex_array_real,
  complex_array_imag,
  complex_array_exp,
  complex_array_log,
  complex_array_sqrt,

  // Reductions
  complex_array_sum,
  complex_array_mean,
  complex_array_dot,
  complex_array_norm,

  // In-place operations
  complex_array_scale_inplace,
  complex_array_conj_inplace,
  complex_array_add_inplace,
  complex_array_copy,
} from './ops/complex-array';

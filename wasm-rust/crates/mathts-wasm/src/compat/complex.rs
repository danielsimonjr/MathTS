//! AssemblyScript-compatible complex number function names.
//!
//! These thin wrappers provide the exact `complex_*` / `complex_array_*`
//! symbol names that the TypeScript `MathTSWasmExports` interface expects.
//!
//! Complex numbers use (re, im) pairs.  Complex arrays use interleaved
//! storage: [re0, im0, re1, im1, ...].

use libm;

// =============================================================================
// Scalar Complex Arithmetic (44 functions)
// =============================================================================

#[no_mangle]
pub unsafe extern "C" fn complex_add(
    a_re: f64,
    a_im: f64,
    b_re: f64,
    b_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    *out_re = a_re + b_re;
    *out_im = a_im + b_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_sub(
    a_re: f64,
    a_im: f64,
    b_re: f64,
    b_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    *out_re = a_re - b_re;
    *out_im = a_im - b_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_mul(
    a_re: f64,
    a_im: f64,
    b_re: f64,
    b_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    *out_re = a_re * b_re - a_im * b_im;
    *out_im = a_re * b_im + a_im * b_re;
}

#[no_mangle]
pub unsafe extern "C" fn complex_div(
    a_re: f64,
    a_im: f64,
    b_re: f64,
    b_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    let denom = b_re * b_re + b_im * b_im;
    *out_re = (a_re * b_re + a_im * b_im) / denom;
    *out_im = (a_im * b_re - a_re * b_im) / denom;
}

#[no_mangle]
pub unsafe extern "C" fn complex_neg(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = -a_re;
    *out_im = -a_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_conj(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = a_re;
    *out_im = -a_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_reciprocal(
    a_re: f64,
    a_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    let denom = a_re * a_re + a_im * a_im;
    *out_re = a_re / denom;
    *out_im = -a_im / denom;
}

// -- Magnitude / Phase --------------------------------------------------------

// Note: complex_abs already exists in complex::operations with the same name
// and signature (re, im) -> f64.  We skip re-exporting it here.

// Note: complex_arg also already exists in complex::operations.

#[no_mangle]
pub unsafe extern "C" fn complex_abs_squared(a_re: f64, a_im: f64) -> f64 {
    a_re * a_re + a_im * a_im
}

// -- Power / Root -------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_sqrt(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let r = libm::sqrt(a_re * a_re + a_im * a_im);
    if a_im == 0.0 {
        if a_re >= 0.0 {
            *out_re = libm::sqrt(a_re);
            *out_im = 0.0;
        } else {
            *out_re = 0.0;
            *out_im = libm::sqrt(-a_re);
        }
    } else {
        *out_re = libm::sqrt((r + a_re) / 2.0);
        *out_im = if a_im >= 0.0 { 1.0 } else { -1.0 } * libm::sqrt((r - a_re) / 2.0);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_pow(
    a_re: f64,
    a_im: f64,
    n: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    let r = libm::sqrt(a_re * a_re + a_im * a_im);
    let theta = libm::atan2(a_im, a_re);
    let rn = libm::pow(r, n);
    let nt = n * theta;
    *out_re = rn * libm::cos(nt);
    *out_im = rn * libm::sin(nt);
}

#[no_mangle]
pub unsafe extern "C" fn complex_cpow(
    a_re: f64,
    a_im: f64,
    b_re: f64,
    b_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    // a^b = exp(b * log(a))
    let log_re = libm::log(libm::sqrt(a_re * a_re + a_im * a_im));
    let log_im = libm::atan2(a_im, a_re);
    let prod_re = b_re * log_re - b_im * log_im;
    let prod_im = b_re * log_im + b_im * log_re;
    let exp_r = libm::exp(prod_re);
    *out_re = exp_r * libm::cos(prod_im);
    *out_im = exp_r * libm::sin(prod_im);
}

#[no_mangle]
pub unsafe extern "C" fn complex_square(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = a_re * a_re - a_im * a_im;
    *out_im = 2.0 * a_re * a_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_cube(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let re2 = a_re * a_re;
    let im2 = a_im * a_im;
    *out_re = a_re * (re2 - 3.0 * im2);
    *out_im = a_im * (3.0 * re2 - im2);
}

// -- Exponential / Logarithmic ------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_exp(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let exp_re = libm::exp(a_re);
    *out_re = exp_re * libm::cos(a_im);
    *out_im = exp_re * libm::sin(a_im);
}

#[no_mangle]
pub unsafe extern "C" fn complex_log(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = libm::log(libm::sqrt(a_re * a_re + a_im * a_im));
    *out_im = libm::atan2(a_im, a_re);
}

#[no_mangle]
pub unsafe extern "C" fn complex_log10(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let ln_re = libm::log(libm::sqrt(a_re * a_re + a_im * a_im));
    let ln_im = libm::atan2(a_im, a_re);
    const LN10: f64 = 2.302585092994046;
    *out_re = ln_re / LN10;
    *out_im = ln_im / LN10;
}

#[no_mangle]
pub unsafe extern "C" fn complex_log2(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let ln_re = libm::log(libm::sqrt(a_re * a_re + a_im * a_im));
    let ln_im = libm::atan2(a_im, a_re);
    const LN2: f64 = 0.6931471805599453;
    *out_re = ln_re / LN2;
    *out_im = ln_im / LN2;
}

// -- Trigonometric ------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_sin(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = libm::sin(a_re) * libm::cosh(a_im);
    *out_im = libm::cos(a_re) * libm::sinh(a_im);
}

#[no_mangle]
pub unsafe extern "C" fn complex_cos(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = libm::cos(a_re) * libm::cosh(a_im);
    *out_im = -libm::sin(a_re) * libm::sinh(a_im);
}

#[no_mangle]
pub unsafe extern "C" fn complex_tan(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let s_re = libm::sin(a_re) * libm::cosh(a_im);
    let s_im = libm::cos(a_re) * libm::sinh(a_im);
    let c_re = libm::cos(a_re) * libm::cosh(a_im);
    let c_im = -libm::sin(a_re) * libm::sinh(a_im);
    let denom = c_re * c_re + c_im * c_im;
    *out_re = (s_re * c_re + s_im * c_im) / denom;
    *out_im = (s_im * c_re - s_re * c_im) / denom;
}

// -- Inverse Trigonometric ----------------------------------------------------
// asin(z) = -i * ln(iz + sqrt(1 - z^2))
// acos(z) = -i * ln(z + sqrt(z^2 - 1))
// atan(z) = (i/2) * ln((i+z)/(i-z))

#[no_mangle]
pub unsafe extern "C" fn complex_asin(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    // asin(z) = -i * log(iz + sqrt(1 - z^2))
    // iz = (-im, re)
    let iz_re = -a_im;
    let iz_im = a_re;
    // 1 - z^2
    let z2_re = a_re * a_re - a_im * a_im;
    let z2_im = 2.0 * a_re * a_im;
    let w_re = 1.0 - z2_re;
    let w_im = -z2_im;
    // sqrt(w)
    let (sq_re, sq_im) = complex_sqrt_inline(w_re, w_im);
    // iz + sqrt(1-z^2)
    let s_re = iz_re + sq_re;
    let s_im = iz_im + sq_im;
    // log(s)
    let log_re = libm::log(libm::sqrt(s_re * s_re + s_im * s_im));
    let log_im = libm::atan2(s_im, s_re);
    // -i * log = (log_im, -log_re)
    *out_re = log_im;
    *out_im = -log_re;
}

#[no_mangle]
pub unsafe extern "C" fn complex_acos(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    // acos(z) = -i * log(z + sqrt(z^2 - 1))
    let z2_re = a_re * a_re - a_im * a_im;
    let z2_im = 2.0 * a_re * a_im;
    let w_re = z2_re - 1.0;
    let w_im = z2_im;
    let (sq_re, sq_im) = complex_sqrt_inline(w_re, w_im);
    let s_re = a_re + sq_re;
    let s_im = a_im + sq_im;
    let log_re = libm::log(libm::sqrt(s_re * s_re + s_im * s_im));
    let log_im = libm::atan2(s_im, s_re);
    *out_re = log_im;
    *out_im = -log_re;
}

#[no_mangle]
pub unsafe extern "C" fn complex_atan(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    // atan(z) = (i/2) * ln((i+z)/(i-z))
    // i+z = (re, 1+im),  i-z = (-re, 1-im)
    let n_re = a_re;
    let n_im = 1.0 + a_im;
    let d_re = -a_re;
    let d_im = 1.0 - a_im;
    // (n / d)
    let denom = d_re * d_re + d_im * d_im;
    let q_re = (n_re * d_re + n_im * d_im) / denom;
    let q_im = (n_im * d_re - n_re * d_im) / denom;
    // log(q)
    let log_re = libm::log(libm::sqrt(q_re * q_re + q_im * q_im));
    let log_im = libm::atan2(q_im, q_re);
    // (i/2) * log = (-log_im/2, log_re/2)
    *out_re = -log_im / 2.0;
    *out_im = log_re / 2.0;
}

// -- Hyperbolic ---------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_sinh(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = libm::sinh(a_re) * libm::cos(a_im);
    *out_im = libm::cosh(a_re) * libm::sin(a_im);
}

#[no_mangle]
pub unsafe extern "C" fn complex_cosh(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = libm::cosh(a_re) * libm::cos(a_im);
    *out_im = libm::sinh(a_re) * libm::sin(a_im);
}

#[no_mangle]
pub unsafe extern "C" fn complex_tanh(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let sh_re = libm::sinh(a_re) * libm::cos(a_im);
    let sh_im = libm::cosh(a_re) * libm::sin(a_im);
    let ch_re = libm::cosh(a_re) * libm::cos(a_im);
    let ch_im = libm::sinh(a_re) * libm::sin(a_im);
    let denom = ch_re * ch_re + ch_im * ch_im;
    *out_re = (sh_re * ch_re + sh_im * ch_im) / denom;
    *out_im = (sh_im * ch_re - sh_re * ch_im) / denom;
}

// -- Inverse Hyperbolic -------------------------------------------------------
// asinh(z) = log(z + sqrt(z^2 + 1))
// acosh(z) = log(z + sqrt(z^2 - 1))
// atanh(z) = (1/2) * log((1+z)/(1-z))

#[no_mangle]
pub unsafe extern "C" fn complex_asinh(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let z2_re = a_re * a_re - a_im * a_im;
    let z2_im = 2.0 * a_re * a_im;
    let w_re = z2_re + 1.0;
    let w_im = z2_im;
    let (sq_re, sq_im) = complex_sqrt_inline(w_re, w_im);
    let s_re = a_re + sq_re;
    let s_im = a_im + sq_im;
    *out_re = libm::log(libm::sqrt(s_re * s_re + s_im * s_im));
    *out_im = libm::atan2(s_im, s_re);
}

#[no_mangle]
pub unsafe extern "C" fn complex_acosh(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    let z2_re = a_re * a_re - a_im * a_im;
    let z2_im = 2.0 * a_re * a_im;
    let w_re = z2_re - 1.0;
    let w_im = z2_im;
    let (sq_re, sq_im) = complex_sqrt_inline(w_re, w_im);
    let s_re = a_re + sq_re;
    let s_im = a_im + sq_im;
    *out_re = libm::log(libm::sqrt(s_re * s_re + s_im * s_im));
    *out_im = libm::atan2(s_im, s_re);
}

#[no_mangle]
pub unsafe extern "C" fn complex_atanh(a_re: f64, a_im: f64, out_re: *mut f64, out_im: *mut f64) {
    // (1/2) * log((1+z)/(1-z))
    let n_re = 1.0 + a_re;
    let n_im = a_im;
    let d_re = 1.0 - a_re;
    let d_im = -a_im;
    let denom = d_re * d_re + d_im * d_im;
    let q_re = (n_re * d_re + n_im * d_im) / denom;
    let q_im = (n_im * d_re - n_re * d_im) / denom;
    let log_re = libm::log(libm::sqrt(q_re * q_re + q_im * q_im));
    let log_im = libm::atan2(q_im, q_re);
    *out_re = log_re / 2.0;
    *out_im = log_im / 2.0;
}

// -- Utility / Query ----------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_equals(a_re: f64, a_im: f64, b_re: f64, b_im: f64) -> i32 {
    if a_re == b_re && a_im == b_im {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_approx_equals(
    a_re: f64,
    a_im: f64,
    b_re: f64,
    b_im: f64,
    tolerance: f64,
) -> i32 {
    let d_re = if a_re > b_re {
        a_re - b_re
    } else {
        b_re - a_re
    };
    let d_im = if a_im > b_im {
        a_im - b_im
    } else {
        b_im - a_im
    };
    if d_re <= tolerance && d_im <= tolerance {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_is_zero(a_re: f64, a_im: f64) -> i32 {
    if a_re == 0.0 && a_im == 0.0 {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_is_real(_a_re: f64, a_im: f64) -> i32 {
    if a_im == 0.0 {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_is_imaginary(a_re: f64, _a_im: f64) -> i32 {
    if a_re == 0.0 {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_is_nan(a_re: f64, a_im: f64) -> i32 {
    if a_re != a_re || a_im != a_im {
        1
    } else {
        0
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_is_finite(a_re: f64, a_im: f64) -> i32 {
    if a_re.is_finite() && a_im.is_finite() {
        1
    } else {
        0
    }
}

// -- Construction helpers -----------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_from_real(re: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = re;
    *out_im = 0.0;
}

#[no_mangle]
pub unsafe extern "C" fn complex_from_imag(im: f64, out_re: *mut f64, out_im: *mut f64) {
    *out_re = 0.0;
    *out_im = im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_from_polar(
    r: f64,
    theta: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    *out_re = r * libm::cos(theta);
    *out_im = r * libm::sin(theta);
}

#[no_mangle]
pub unsafe extern "C" fn complex_to_polar(
    a_re: f64,
    a_im: f64,
    out_r: *mut f64,
    out_theta: *mut f64,
) {
    *out_r = libm::sqrt(a_re * a_re + a_im * a_im);
    *out_theta = libm::atan2(a_im, a_re);
}

// -- Linear algebra scalar ops ------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_axpby(
    alpha_re: f64,
    alpha_im: f64,
    a_re: f64,
    a_im: f64,
    beta_re: f64,
    beta_im: f64,
    b_re: f64,
    b_im: f64,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    // alpha*a
    let aa_re = alpha_re * a_re - alpha_im * a_im;
    let aa_im = alpha_re * a_im + alpha_im * a_re;
    // beta*b
    let bb_re = beta_re * b_re - beta_im * b_im;
    let bb_im = beta_re * b_im + beta_im * b_re;
    *out_re = aa_re + bb_re;
    *out_im = aa_im + bb_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_distance(a_re: f64, a_im: f64, b_re: f64, b_im: f64) -> f64 {
    let d_re = a_re - b_re;
    let d_im = a_im - b_im;
    libm::sqrt(d_re * d_re + d_im * d_im)
}

// =============================================================================
// Complex Array Operations (33 functions)
// =============================================================================
// Interleaved format: [re0, im0, re1, im1, ...]
// `len` always refers to number of complex elements (NOT f64 count).

// -- Creation (these allocate nothing; caller provides output buffer) ----------
// The AS versions returned new Float64Array but in the C ABI the caller
// pre-allocates the output buffer.

#[no_mangle]
pub unsafe extern "C" fn complex_array_zeros(out_ptr: *mut f64, n: i32) {
    let total = (n as usize) * 2;
    for i in 0..total {
        *out_ptr.add(i) = 0.0;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_ones(out_ptr: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out_ptr.add(i * 2) = 1.0;
        *out_ptr.add(i * 2 + 1) = 0.0;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_fill(out_ptr: *mut f64, n: i32, re: f64, im: f64) {
    for i in 0..n as usize {
        *out_ptr.add(i * 2) = re;
        *out_ptr.add(i * 2 + 1) = im;
    }
}

// -- Element access -----------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_array_get_re(data_ptr: *const f64, index: i32) -> f64 {
    *data_ptr.add((index as usize) * 2)
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_get_im(data_ptr: *const f64, index: i32) -> f64 {
    *data_ptr.add((index as usize) * 2 + 1)
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_get(
    data_ptr: *const f64,
    index: i32,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    let off = (index as usize) * 2;
    *out_re = *data_ptr.add(off);
    *out_im = *data_ptr.add(off + 1);
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_set(data_ptr: *mut f64, index: i32, re: f64, im: f64) {
    let off = (index as usize) * 2;
    *data_ptr.add(off) = re;
    *data_ptr.add(off + 1) = im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_set_parts(data_ptr: *mut f64, index: i32, re: f64, im: f64) {
    let off = (index as usize) * 2;
    *data_ptr.add(off) = re;
    *data_ptr.add(off + 1) = im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_length(len_f64: i32) -> i32 {
    len_f64 / 2
}

// -- Element-wise arithmetic --------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_array_add(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    len: i32,
) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *out_ptr.add(i) = *a_ptr.add(i) + *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_sub(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    len: i32,
) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *out_ptr.add(i) = *a_ptr.add(i) - *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_mul(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    len: i32,
) {
    for i in 0..len as usize {
        let idx = i * 2;
        let a_re = *a_ptr.add(idx);
        let a_im = *a_ptr.add(idx + 1);
        let b_re = *b_ptr.add(idx);
        let b_im = *b_ptr.add(idx + 1);
        *out_ptr.add(idx) = a_re * b_re - a_im * b_im;
        *out_ptr.add(idx + 1) = a_re * b_im + a_im * b_re;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_div(
    a_ptr: *const f64,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    len: i32,
) {
    for i in 0..len as usize {
        let idx = i * 2;
        let a_re = *a_ptr.add(idx);
        let a_im = *a_ptr.add(idx + 1);
        let b_re = *b_ptr.add(idx);
        let b_im = *b_ptr.add(idx + 1);
        let denom = b_re * b_re + b_im * b_im;
        *out_ptr.add(idx) = (a_re * b_re + a_im * b_im) / denom;
        *out_ptr.add(idx + 1) = (a_im * b_re - a_re * b_im) / denom;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_scale_real(
    a_ptr: *const f64,
    scalar: f64,
    out_ptr: *mut f64,
    len: i32,
) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *out_ptr.add(i) = *a_ptr.add(i) * scalar;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_scale_complex(
    a_ptr: *const f64,
    s_re: f64,
    s_im: f64,
    out_ptr: *mut f64,
    len: i32,
) {
    for i in 0..len as usize {
        let idx = i * 2;
        let a_re = *a_ptr.add(idx);
        let a_im = *a_ptr.add(idx + 1);
        *out_ptr.add(idx) = a_re * s_re - a_im * s_im;
        *out_ptr.add(idx + 1) = a_re * s_im + a_im * s_re;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_neg(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *out_ptr.add(i) = -*a_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_conj(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let idx = i * 2;
        *out_ptr.add(idx) = *a_ptr.add(idx);
        *out_ptr.add(idx + 1) = -*a_ptr.add(idx + 1);
    }
}

// -- Element-wise functions ---------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_array_abs(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let re = *a_ptr.add(i * 2);
        let im = *a_ptr.add(i * 2 + 1);
        *out_ptr.add(i) = libm::sqrt(re * re + im * im);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_arg(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let re = *a_ptr.add(i * 2);
        let im = *a_ptr.add(i * 2 + 1);
        *out_ptr.add(i) = libm::atan2(im, re);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_abs_squared(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let re = *a_ptr.add(i * 2);
        let im = *a_ptr.add(i * 2 + 1);
        *out_ptr.add(i) = re * re + im * im;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_real(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        *out_ptr.add(i) = *a_ptr.add(i * 2);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_imag(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        *out_ptr.add(i) = *a_ptr.add(i * 2 + 1);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_exp(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let idx = i * 2;
        let re = *a_ptr.add(idx);
        let im = *a_ptr.add(idx + 1);
        let exp_re = libm::exp(re);
        *out_ptr.add(idx) = exp_re * libm::cos(im);
        *out_ptr.add(idx + 1) = exp_re * libm::sin(im);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_log(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let idx = i * 2;
        let re = *a_ptr.add(idx);
        let im = *a_ptr.add(idx + 1);
        *out_ptr.add(idx) = libm::log(libm::sqrt(re * re + im * im));
        *out_ptr.add(idx + 1) = libm::atan2(im, re);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_sqrt(a_ptr: *const f64, out_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let idx = i * 2;
        let re = *a_ptr.add(idx);
        let im = *a_ptr.add(idx + 1);
        let r = libm::sqrt(re * re + im * im);
        let sqrt_r = libm::sqrt(r);
        let half_theta = libm::atan2(im, re) / 2.0;
        *out_ptr.add(idx) = sqrt_r * libm::cos(half_theta);
        *out_ptr.add(idx + 1) = sqrt_r * libm::sin(half_theta);
    }
}

// -- Reductions ---------------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_array_sum(
    a_ptr: *const f64,
    len: i32,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    let mut sum_re = 0.0_f64;
    let mut sum_im = 0.0_f64;
    for i in 0..len as usize {
        sum_re += *a_ptr.add(i * 2);
        sum_im += *a_ptr.add(i * 2 + 1);
    }
    *out_re = sum_re;
    *out_im = sum_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_mean(
    a_ptr: *const f64,
    len: i32,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    if len == 0 {
        *out_re = f64::NAN;
        *out_im = f64::NAN;
        return;
    }
    let mut sum_re = 0.0_f64;
    let mut sum_im = 0.0_f64;
    for i in 0..len as usize {
        sum_re += *a_ptr.add(i * 2);
        sum_im += *a_ptr.add(i * 2 + 1);
    }
    let n = len as f64;
    *out_re = sum_re / n;
    *out_im = sum_im / n;
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_dot(
    a_ptr: *const f64,
    b_ptr: *const f64,
    len: i32,
    out_re: *mut f64,
    out_im: *mut f64,
) {
    // dot(a, b) = sum(a[i] * conj(b[i]))
    let mut sum_re = 0.0_f64;
    let mut sum_im = 0.0_f64;
    for i in 0..len as usize {
        let idx = i * 2;
        let a_re = *a_ptr.add(idx);
        let a_im = *a_ptr.add(idx + 1);
        let b_re = *b_ptr.add(idx);
        let b_im = -*b_ptr.add(idx + 1); // conjugate
        sum_re += a_re * b_re - a_im * b_im;
        sum_im += a_re * b_im + a_im * b_re;
    }
    *out_re = sum_re;
    *out_im = sum_im;
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_norm(a_ptr: *const f64, len: i32) -> f64 {
    let mut sum_sq = 0.0_f64;
    for i in 0..len as usize {
        let re = *a_ptr.add(i * 2);
        let im = *a_ptr.add(i * 2 + 1);
        sum_sq += re * re + im * im;
    }
    libm::sqrt(sum_sq)
}

// -- In-place operations ------------------------------------------------------

#[no_mangle]
pub unsafe extern "C" fn complex_array_scale_inplace(a_ptr: *mut f64, scalar: f64, len: i32) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *a_ptr.add(i) *= scalar;
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_conj_inplace(a_ptr: *mut f64, len: i32) {
    for i in 0..len as usize {
        let off = i * 2 + 1;
        *a_ptr.add(off) = -*a_ptr.add(off);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_add_inplace(a_ptr: *mut f64, b_ptr: *const f64, len: i32) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *a_ptr.add(i) += *b_ptr.add(i);
    }
}

#[no_mangle]
pub unsafe extern "C" fn complex_array_copy(src_ptr: *const f64, dst_ptr: *mut f64, len: i32) {
    let total = (len as usize) * 2;
    for i in 0..total {
        *dst_ptr.add(i) = *src_ptr.add(i);
    }
}

// =============================================================================
// Internal helpers (not exported)
// =============================================================================

#[inline(always)]
fn complex_sqrt_inline(re: f64, im: f64) -> (f64, f64) {
    let r = libm::sqrt(re * re + im * im);
    if im == 0.0 {
        if re >= 0.0 {
            (libm::sqrt(re), 0.0)
        } else {
            (0.0, libm::sqrt(-re))
        }
    } else {
        let sqrt_r = libm::sqrt((r + re) / 2.0);
        let sign = if im >= 0.0 { 1.0 } else { -1.0 };
        (sqrt_r, sign * libm::sqrt((r - re) / 2.0))
    }
}

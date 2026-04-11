//! SIMD-accelerated array arithmetic, statistics, geometry, and trig compat wrappers.
//!
//! These functions provide snake_case `simd_*` and `*_wasm` names that the TypeScript
//! `MathTSWasmExports` interface expects.  They delegate to the camelCase implementations
//! in `simd::operations` (which LLVM auto-vectorizes to WASM SIMD v128) and to
//! `geometry::operations` where the scalar already exists.
//!
//! **Target feature note**: WASM SIMD is enabled globally via `-C target-feature=+simd128`
//! in the build profile.  No `#[target_feature]` per-function annotation is needed —
//! LLVM inlines and vectorizes automatically when the target feature is active.
//!
//! If SIMD is unavailable at runtime (e.g. older browsers), the same code compiles to
//! portable scalar loops that are correct (though slower).

use crate::simd::operations::{
    simdAbsF64, simdAddF64, simdDivF64, simdDotF64, simdMaxF64, simdMeanF64, simdMinF64,
    simdMulF64, simdNormF64, simdSqrtF64, simdStdF64, simdSubF64, simdSumF64, simdVarianceF64,
};
use libm;

// =============================================================================
// SIMD Array Arithmetic (10 functions)
// Thin snake_case wrappers over the existing camelCase simd::operations symbols.
// =============================================================================

/// Element-wise addition: `out[i] = a[i] + b[i]`.
#[no_mangle]
pub unsafe extern "C" fn simd_add_arrays(a: *const f64, b: *const f64, out: *mut f64, n: i32) {
    simdAddF64(a, b, out, n);
}

/// Element-wise subtraction: `out[i] = a[i] - b[i]`.
#[no_mangle]
pub unsafe extern "C" fn simd_sub_arrays(a: *const f64, b: *const f64, out: *mut f64, n: i32) {
    simdSubF64(a, b, out, n);
}

/// Element-wise multiplication: `out[i] = a[i] * b[i]`.
#[no_mangle]
pub unsafe extern "C" fn simd_mul_arrays(a: *const f64, b: *const f64, out: *mut f64, n: i32) {
    simdMulF64(a, b, out, n);
}

/// Element-wise division: `out[i] = a[i] / b[i]`.
#[no_mangle]
pub unsafe extern "C" fn simd_div_arrays(a: *const f64, b: *const f64, out: *mut f64, n: i32) {
    simdDivF64(a, b, out, n);
}

/// Absolute value: `out[i] = |a[i]|`.
#[no_mangle]
pub unsafe extern "C" fn simd_abs_array(a: *const f64, out: *mut f64, n: i32) {
    simdAbsF64(a, out, n);
}

/// Square root: `out[i] = sqrt(a[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_sqrt_array(a: *const f64, out: *mut f64, n: i32) {
    simdSqrtF64(a, out, n);
}

/// Exponential: `out[i] = exp(a[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_exp_array(a: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::exp(*a.add(i));
    }
}

/// Natural logarithm: `out[i] = ln(a[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_log_array(a: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::log(*a.add(i));
    }
}

/// Sine: `out[i] = sin(a[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_sin_array(a: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::sin(*a.add(i));
    }
}

/// Cosine: `out[i] = cos(a[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_cos_array(a: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::cos(*a.add(i));
    }
}

// =============================================================================
// SIMD Statistics (9 functions)
// =============================================================================

/// Sum of all elements (delegates to pairwise-summation SIMD loop).
#[no_mangle]
pub unsafe extern "C" fn simd_sum(a: *const f64, n: i32) -> f64 {
    simdSumF64(a, n)
}

/// Arithmetic mean.
#[no_mangle]
pub unsafe extern "C" fn simd_mean(a: *const f64, n: i32) -> f64 {
    simdMeanF64(a, n)
}

/// Minimum element.
#[no_mangle]
pub unsafe extern "C" fn simd_min(a: *const f64, n: i32) -> f64 {
    simdMinF64(a, n)
}

/// Maximum element.
#[no_mangle]
pub unsafe extern "C" fn simd_max(a: *const f64, n: i32) -> f64 {
    simdMaxF64(a, n)
}

/// Variance.  `ddof=0` for population variance, `ddof=1` for sample variance.
#[no_mangle]
pub unsafe extern "C" fn simd_variance(a: *const f64, n: i32, ddof: i32) -> f64 {
    simdVarianceF64(a, n, ddof)
}

/// Standard deviation.  `ddof=0` population, `ddof=1` sample.
#[no_mangle]
pub unsafe extern "C" fn simd_std(a: *const f64, n: i32, ddof: i32) -> f64 {
    simdStdF64(a, n, ddof)
}

/// Dot product: `sum(a[i] * b[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_dot_product(a: *const f64, b: *const f64, n: i32) -> f64 {
    simdDotF64(a, b, n)
}

/// L2 norm: `sqrt(sum(a[i]^2))`.
#[no_mangle]
pub unsafe extern "C" fn simd_norm_l2(a: *const f64, n: i32) -> f64 {
    simdNormF64(a, n)
}

/// Euclidean distance between two n-dimensional points.
#[no_mangle]
pub unsafe extern "C" fn simd_distance(a: *const f64, b: *const f64, n: i32) -> f64 {
    let mut sum = 0.0_f64;
    for i in 0..n as usize {
        let d = *a.add(i) - *b.add(i);
        sum += d * d;
    }
    libm::sqrt(sum)
}

// =============================================================================
// Geometry (5 functions)
// =============================================================================

/// Polygon area via Shoelace formula.
/// `vertices` is a flat array `[x0, y0, x1, y1, …]`, `n` is the vertex count.
/// Wraps the existing `polygonArea2D` from `geometry::operations`.
#[no_mangle]
pub unsafe extern "C" fn polygon_area_wasm(vertices: *const f64, n: i32) -> f64 {
    crate::geometry::operations::polygonArea2D(vertices, n)
}

/// Manhattan (L1) distance between two n-dimensional points.
/// Wraps `manhattanDistanceND` from `geometry::operations`.
#[no_mangle]
pub unsafe extern "C" fn manhattan_distance_wasm(p1: *const f64, p2: *const f64, n: i32) -> f64 {
    crate::geometry::operations::manhattanDistanceND(p1, p2, n)
}

/// Chebyshev (L∞) distance: `max_i |a[i] - b[i]|`.
#[no_mangle]
pub unsafe extern "C" fn chebyshev_distance_wasm(p1: *const f64, p2: *const f64, n: i32) -> f64 {
    let mut max_d = 0.0_f64;
    for i in 0..n as usize {
        let d = libm::fabs(*p1.add(i) - *p2.add(i));
        if d > max_d {
            max_d = d;
        }
    }
    max_d
}

/// Minkowski distance: `(sum |a[i] - b[i]|^p)^(1/p)`.
/// `p = 1` → Manhattan, `p = 2` → Euclidean.
#[no_mangle]
pub unsafe extern "C" fn minkowski_distance_wasm(
    p1: *const f64,
    p2: *const f64,
    n: i32,
    p: f64,
) -> f64 {
    if p <= 0.0 {
        return f64::NAN;
    }
    let mut sum = 0.0_f64;
    for i in 0..n as usize {
        sum += libm::pow(libm::fabs(*p1.add(i) - *p2.add(i)), p);
    }
    libm::pow(sum, 1.0 / p)
}

/// Euclidean distance between two n-dimensional points.
/// Alias for `simd_distance` with the `*_wasm` naming convention.
#[no_mangle]
pub unsafe extern "C" fn distance_nd_wasm(p1: *const f64, p2: *const f64, n: i32) -> f64 {
    simd_distance(p1, p2, n)
}

// =============================================================================
// Trigonometric array operations (5 functions)
// =============================================================================

// simd_sin_array and simd_cos_array are already defined above.

/// Tangent: `out[i] = tan(a[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_tan_array(a: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::tan(*a.add(i));
    }
}

/// Hypotenuse: `out[i] = hypot(a[i], b[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_hypot_array(a: *const f64, b: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::hypot(*a.add(i), *b.add(i));
    }
}

/// Two-argument arctangent: `out[i] = atan2(a[i], b[i])`.
#[no_mangle]
pub unsafe extern "C" fn simd_atan2_array(a: *const f64, b: *const f64, out: *mut f64, n: i32) {
    for i in 0..n as usize {
        *out.add(i) = libm::atan2(*a.add(i), *b.add(i));
    }
}

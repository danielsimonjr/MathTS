//! Bessel-function and Airy-function array kernels — Slice 3.10c-1 / 4.9.
//!
//! Provides per-element Bessel J / Y array hot-loops that the TypeScript
//! bridge calls when the input length exceeds the WASM threshold (≥ 1024).
//!
//! Scalar helpers (`besselJ0`, `besselJ1`, `besselY0`, `besselY1`) already
//! exist in `special/functions.rs` and are re-used here via delegation to
//! avoid duplicating the polynomial approximations.
//!
//! Pointer-ABI convention (mirrors `tridiag.rs`):
//!   - Input and output arrays are passed as raw `*const f64` / `*mut f64`.
//!   - `n` is the element count as `i32` (WebAssembly i32 boundary).
//!   - Return value is `n` on success, `-1` if `n ≤ 0`.
//!
//! Used by `functions/src/wasm/special/wasm-bridge.ts` through
//! `functions/src/typed/special.ts`.

use alloc::vec;
use alloc::vec::Vec;

// ------------------------------------------------------------------ //
// Scalar helpers (delegate to special/functions.rs implementations)   //
// ------------------------------------------------------------------ //

use crate::special::functions::{
    airy_ai, airy_bi, besselJ0, besselJ1, besselY0, besselY1, carlson_rc, carlson_rd, carlson_rf,
    carlson_rj, elliptic_e, elliptic_e_incomplete, elliptic_f_incomplete, elliptic_k,
    elliptic_pi_incomplete, lgamma,
};

/// Scalar J_n(x) via forward or Miller backward recurrence.
///
/// Matches the logic in `special/functions.rs :: besselJ_wasm` but as a safe
/// function so we can call it from within Rust tests without `unsafe`.
fn bessel_j_scalar(n: i32, x: f64) -> f64 {
    let ni = n.unsigned_abs() as i32;
    let sign = if n < 0 && ni % 2 != 0 { -1.0_f64 } else { 1.0_f64 };

    if ni == 0 {
        return sign * besselJ0(x);
    }
    if ni == 1 {
        return sign * besselJ1(x);
    }
    if x.abs() < 1e-15 {
        return 0.0;
    }

    let result = if ni <= 20 || x.abs() > ni as f64 {
        // Forward recurrence: J_{k+1}(x) = (2k/x)·J_k(x) − J_{k-1}(x)
        let mut j_prev = besselJ0(x);
        let mut j_curr = besselJ1(x);
        for k in 1..ni {
            let j_next = (2.0 * k as f64 / x) * j_curr - j_prev;
            j_prev = j_curr;
            j_curr = j_next;
        }
        j_curr
    } else {
        // Miller's backward recurrence (numerically stable for n > |x|).
        let isqrt = (40.0 * ni as f64).sqrt() as i32;
        let extra = if 10 > isqrt { 10 } else { isqrt };
        let n_start = ni + 2 * extra;
        let mut j_next = 0.0_f64;
        let mut j_curr = 1.0_f64;
        let mut result_val = 0.0_f64;
        let mut sum = 0.0_f64;
        for k in (0..=n_start).rev() {
            let j_prev = (2.0 * (k + 1) as f64 / x) * j_curr - j_next;
            j_next = j_curr;
            j_curr = j_prev;
            if k == ni {
                result_val = j_next;
            }
            if k % 2 == 0 {
                sum += j_curr;
            }
        }
        // Normalize: J_0 + 2·(J_2 + J_4 + …) = 1
        sum = 2.0 * sum - j_curr;
        result_val / sum
    };
    sign * result
}

/// Scalar Y_n(x) via forward recurrence (x > 0).
fn bessel_y_scalar(n: i32, x: f64) -> f64 {
    if x <= 0.0 {
        return f64::NAN;
    }
    let ni = n.unsigned_abs() as i32;
    let sign = if n < 0 && ni % 2 != 0 { -1.0_f64 } else { 1.0_f64 };

    if ni == 0 {
        return sign * besselY0(x);
    }
    if ni == 1 {
        return sign * besselY1(x);
    }

    // Forward recurrence: Y_{k+1}(x) = (2k/x)·Y_k(x) − Y_{k-1}(x)
    let mut y_prev = besselY0(x);
    let mut y_curr = besselY1(x);
    for k in 1..ni {
        let y_next = (2.0 * k as f64 / x) * y_curr - y_prev;
        y_prev = y_curr;
        y_curr = y_next;
    }
    sign * y_curr
}

// ------------------------------------------------------------------ //
// Array kernels — pointer ABI                                         //
// ------------------------------------------------------------------ //

/// Apply `J0` element-wise to `xs[0..n]` → `out[0..n]`.
///
/// Returns `n` on success, `-1` if `n ≤ 0`.
#[no_mangle]
pub unsafe extern "C" fn bessel_j0_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = besselJ0(*xs_ptr.add(i));
    }
    n
}

/// Apply `J1` element-wise to `xs[0..n]` → `out[0..n]`.
#[no_mangle]
pub unsafe extern "C" fn bessel_j1_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = besselJ1(*xs_ptr.add(i));
    }
    n
}

/// Apply `J_n(order, ·)` element-wise to `xs[0..n_elems]` → `out[0..n_elems]`.
///
/// `order` is the fixed integer Bessel order; `n_elems` is the array length.
#[no_mangle]
pub unsafe extern "C" fn bessel_j_f64(
    order: i32,
    xs_ptr: *const f64,
    n_elems: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n_elems <= 0 {
        return -1;
    }
    for i in 0..n_elems as usize {
        *out_ptr.add(i) = bessel_j_scalar(order, *xs_ptr.add(i));
    }
    n_elems
}

/// Apply `Y0` element-wise to `xs[0..n]` → `out[0..n]`.
#[no_mangle]
pub unsafe extern "C" fn bessel_y0_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = besselY0(*xs_ptr.add(i));
    }
    n
}

/// Apply `Y1` element-wise to `xs[0..n]` → `out[0..n]`.
#[no_mangle]
pub unsafe extern "C" fn bessel_y1_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = besselY1(*xs_ptr.add(i));
    }
    n
}

/// Apply `Y_n(order, ·)` element-wise to `xs[0..n_elems]` → `out[0..n_elems]`.
#[no_mangle]
pub unsafe extern "C" fn bessel_y_f64(
    order: i32,
    xs_ptr: *const f64,
    n_elems: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n_elems <= 0 {
        return -1;
    }
    for i in 0..n_elems as usize {
        *out_ptr.add(i) = bessel_y_scalar(order, *xs_ptr.add(i));
    }
    n_elems
}

// ------------------------------------------------------------------ //
// Airy Ai / Bi array kernels (Slice 4.9)                              //
// ------------------------------------------------------------------ //

/// Apply `Ai(x)` element-wise to `xs[0..n]` → `out[0..n]`.
///
/// Returns `n` on success, `-1` if `n ≤ 0`.
#[no_mangle]
pub unsafe extern "C" fn airy_ai_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = airy_ai(*xs_ptr.add(i));
    }
    n
}

/// Apply `Bi(x)` element-wise to `xs[0..n]` → `out[0..n]`.
///
/// Returns `n` on success, `-1` if `n ≤ 0`.
#[no_mangle]
pub unsafe extern "C" fn airy_bi_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = airy_bi(*xs_ptr.add(i));
    }
    n
}

// ------------------------------------------------------------------ //
// lgamma array kernel (Slice 5.8)                                     //
// ------------------------------------------------------------------ //

/// Apply `lgamma(x)` element-wise to `xs[0..n]` → `out[0..n]`.
///
/// Uses the Lanczos lgamma from `special/functions.rs`.  Poles (x ≤ 0 and
/// x is a non-positive integer) return `+∞`; other non-positive x use the
/// reflection formula already handled in the scalar.
///
/// Returns `n` on success, `-1` if `n ≤ 0`.
#[no_mangle]
pub unsafe extern "C" fn lgamma_f64(xs_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = lgamma(*xs_ptr.add(i));
    }
    n
}

// ------------------------------------------------------------------ //
// Elliptic K / E array kernels (Slice 5.3)                            //
// ------------------------------------------------------------------ //

/// Apply `K(m)` element-wise to `ms[0..n]` → `out[0..n]`.
///
/// Domain: m ∈ [0, 1).  K(1) = +∞.  m < 0 or m > 1 → NaN.
/// Returns `n` on success, `-1` if `n ≤ 0`.
#[no_mangle]
pub unsafe extern "C" fn elliptic_k_f64(ms_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = elliptic_k(*ms_ptr.add(i));
    }
    n
}

/// Apply `E(m)` element-wise to `ms[0..n]` → `out[0..n]`.
///
/// Domain: m ∈ [0, 1].  E(0) = π/2, E(1) = 1.  m < 0 or m > 1 → NaN.
/// Returns `n` on success, `-1` if `n ≤ 0`.
#[no_mangle]
pub unsafe extern "C" fn elliptic_e_f64(ms_ptr: *const f64, n: i32, out_ptr: *mut f64) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = elliptic_e(*ms_ptr.add(i));
    }
    n
}

// ------------------------------------------------------------------ //
// Carlson R-form array kernels (Slice 6.4)                           //
//                                                                    //
// Naming convention: <name>_f64(args_ptr..., n, out_ptr) → n | -1   //
// Matches the pointer-ABI used by elliptic_k_f64 / elliptic_e_f64.  //
//                                                                    //
// RC(x, y): 2-scalar input + element count + output pointer.        //
// RD/RF:    3-scalar inputs. RJ: 4-scalar inputs.                   //
// Incomplete integrals: (phi_ptr, m_ptr, n, out_ptr) or similar.    //
//                                                                    //
// For multi-argument functions we adopt the convention that the      //
// *last* argument is the varying one — the earlier args are scalars. //
// This matches the pattern used by bessel_j_f64 (fixed order).      //
// For the 3- and 4-argument Carlson forms we provide pair arrays:   //
//   carlson_rf_f64(xs_ptr, ys_ptr, zs_ptr, n, out_ptr)             //
// so all three arguments vary element-wise.                          //
// ------------------------------------------------------------------ //

/// Apply RC(x, y) element-wise. xs and ys must each have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn carlson_rc_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = carlson_rc(*xs_ptr.add(i), *ys_ptr.add(i));
    }
    n
}

/// Apply RF(x, y, z) element-wise. All three arrays must have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn carlson_rf_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    zs_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = carlson_rf(*xs_ptr.add(i), *ys_ptr.add(i), *zs_ptr.add(i));
    }
    n
}

/// Apply RD(x, y, z) element-wise. All three arrays must have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn carlson_rd_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    zs_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = carlson_rd(*xs_ptr.add(i), *ys_ptr.add(i), *zs_ptr.add(i));
    }
    n
}

/// Apply RJ(x, y, z, p) element-wise. All four arrays must have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn carlson_rj_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    zs_ptr: *const f64,
    ps_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) =
            carlson_rj(*xs_ptr.add(i), *ys_ptr.add(i), *zs_ptr.add(i), *ps_ptr.add(i));
    }
    n
}

/// Apply F(φ, m) element-wise. phis and ms must each have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn elliptic_f_incomplete_f64(
    phis_ptr: *const f64,
    ms_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = elliptic_f_incomplete(*phis_ptr.add(i), *ms_ptr.add(i));
    }
    n
}

/// Apply E(φ, m) (incomplete) element-wise. phis and ms must each have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn elliptic_e_incomplete_f64(
    phis_ptr: *const f64,
    ms_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) = elliptic_e_incomplete(*phis_ptr.add(i), *ms_ptr.add(i));
    }
    n
}

/// Apply Π(n_param, φ, m) element-wise. ns, phis, ms must each have n elements.
/// Returns n on success, -1 if n ≤ 0.
#[no_mangle]
pub unsafe extern "C" fn elliptic_pi_incomplete_f64(
    ns_ptr: *const f64,
    phis_ptr: *const f64,
    ms_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    for i in 0..n as usize {
        *out_ptr.add(i) =
            elliptic_pi_incomplete(*ns_ptr.add(i), *phis_ptr.add(i), *ms_ptr.add(i));
    }
    n
}

// ------------------------------------------------------------------ //
// Native tests (cargo test — not compiled for WASM)                   //
// ------------------------------------------------------------------ //

#[cfg(test)]
mod tests {
    use super::*;

    fn j0(x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { bessel_j0_f64(xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }
    fn j1(x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { bessel_j1_f64(xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }
    fn jn(n: i32, x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { bessel_j_f64(n, xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }
    fn y0(x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { bessel_y0_f64(xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }
    fn y1(x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { bessel_y1_f64(xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }
    fn yn(n: i32, x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { bessel_y_f64(n, xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }

    // Tolerance: the polynomial approximations (NR §6.5) achieve ~1e-4 to
    // 1e-7 accuracy depending on argument. Y1 near x = 1 is only accurate
    // to ~5e-4 in the reference code. We use 1e-3 for Y-function tests and
    // 1e-6 for J-function tests (which are better conditioned).
    const TOL_J: f64 = 1e-6;
    const TOL_Y: f64 = 1e-3;

    #[test]
    fn test_j0_known_values() {
        assert!((j0(0.0) - 1.0).abs() < TOL_J, "J0(0) = 1, got {}", j0(0.0));
        assert!(
            (j0(1.0) - 0.7651976865579666).abs() < TOL_J,
            "J0(1), got {}",
            j0(1.0)
        );
        assert!((j0(2.4048) - 0.0).abs() < 1e-4, "J0 first zero ≈ 2.4048");
    }

    #[test]
    fn test_j1_known_values() {
        assert!(j1(0.0).abs() < 1e-10, "J1(0) = 0");
        assert!(
            (j1(1.0) - 0.4400505857449335).abs() < TOL_J,
            "J1(1), got {}",
            j1(1.0)
        );
    }

    #[test]
    fn test_jn_known_values() {
        // J5(10) from A&S table 9.1 = -0.2340615281
        assert!(
            (jn(5, 10.0) - (-0.23406152816422887)).abs() < TOL_J,
            "J5(10), got {}",
            jn(5, 10.0)
        );
        // J_n(0) = 0 for n >= 1
        assert!(jn(3, 0.0).abs() < 1e-15, "J3(0) = 0");
    }

    #[test]
    fn test_y0_known_values() {
        // Y0(1) ≈ 0.0882569642 (A&S) — polynomial is accurate to ~1e-4 here
        assert!(
            (y0(1.0) - 0.08825696421567697).abs() < TOL_Y,
            "Y0(1), got {}",
            y0(1.0)
        );
        assert!(y0(0.0).is_nan() || y0(0.0).is_infinite(), "Y0(0) diverges");
        assert!(y0(-1.0).is_nan(), "Y0(-1) is NaN");
    }

    #[test]
    fn test_y1_known_values() {
        // Y1(1) ≈ -0.7812 — polynomial approximation at x=1 has ~5e-4 error
        // (NR §6.5 polynomial; exact = -0.7812128213, poly gives -0.7817)
        assert!(
            (y1(1.0) - (-0.7812128213002887)).abs() < TOL_Y,
            "Y1(1), got {}",
            y1(1.0)
        );
        assert!(y1(0.0).is_nan(), "Y1(0) is NaN");
    }

    #[test]
    fn test_yn_known_values() {
        // Y2(1) from recurrence — similarly TOL_Y
        assert!(
            (yn(2, 1.0) - (-1.6506826068162546)).abs() < TOL_Y,
            "Y2(1), got {}",
            yn(2, 1.0)
        );
    }

    #[test]
    fn test_array_kernel_batch() {
        // Batch of 4 values for J0
        let xs: Vec<f64> = vec![0.0, 1.0, 2.0, 3.0];
        let mut out = vec![0.0f64; 4];
        let ret = unsafe { bessel_j0_f64(xs.as_ptr(), 4, out.as_mut_ptr()) };
        assert_eq!(ret, 4);
        assert!((out[0] - 1.0).abs() < TOL_J, "batch J0(0), got {}", out[0]);
        assert!(
            (out[1] - 0.7651976865579666).abs() < TOL_J,
            "batch J0(1), got {}",
            out[1]
        );
    }

    #[test]
    fn test_negative_n_returns_minus1() {
        let xs: Vec<f64> = vec![1.0];
        let mut out = vec![0.0f64; 1];
        let ret = unsafe { bessel_j0_f64(xs.as_ptr(), -1, out.as_mut_ptr()) };
        assert_eq!(ret, -1);
    }

    // --- Airy function tests (Slice 4.9) ---

    fn ai(x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { airy_ai_f64(xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }

    fn bi(x: f64) -> f64 {
        let xs = [x];
        let mut out = [0.0f64];
        unsafe { airy_bi_f64(xs.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }

    const TOL_AIRY: f64 = 1e-7;

    #[test]
    fn test_ai_at_zero() {
        // Ai(0) = 1/(3^{2/3}·Γ(2/3)) ≈ 0.35502805388781723
        assert!((ai(0.0) - 0.35502805388781723).abs() < TOL_AIRY, "Ai(0) got {}", ai(0.0));
    }

    #[test]
    fn test_bi_at_zero() {
        // Bi(0) = 1/(3^{1/6}·Γ(2/3)) ≈ 0.61492662744600073
        assert!((bi(0.0) - 0.61492662744600073).abs() < TOL_AIRY, "Bi(0) got {}", bi(0.0));
    }

    #[test]
    fn test_ai_at_one() {
        // Ai(1) ≈ 0.13529241631288141
        assert!((ai(1.0) - 0.13529241631288141).abs() < TOL_AIRY, "Ai(1) got {}", ai(1.0));
    }

    #[test]
    fn test_bi_at_one() {
        // Bi(1) ≈ 1.2074235949528715
        assert!((bi(1.0) - 1.2074235949528715).abs() < TOL_AIRY, "Bi(1) got {}", bi(1.0));
    }

    #[test]
    fn test_ai_at_neg_one() {
        // Ai(-1) ≈ 0.53556088329235129
        assert!((ai(-1.0) - 0.53556088329235129).abs() < TOL_AIRY, "Ai(-1) got {}", ai(-1.0));
    }

    #[test]
    fn test_bi_at_neg_one() {
        // Bi(-1) ≈ 0.10399738949694461
        assert!((bi(-1.0) - 0.10399738949694461).abs() < TOL_AIRY, "Bi(-1) got {}", bi(-1.0));
    }

    #[test]
    fn test_airy_large_positive() {
        // Ai(5) ≈ 1.0834442572e-4 (asymptotic regime)
        assert!(ai(5.0) > 0.0 && ai(5.0) < 0.001, "Ai(5) in (0, 0.001), got {}", ai(5.0));
    }

    #[test]
    fn test_airy_batch() {
        let xs: Vec<f64> = vec![0.0, 1.0, -1.0, 5.0];
        let mut out = vec![0.0f64; 4];
        let ret = unsafe { airy_ai_f64(xs.as_ptr(), 4, out.as_mut_ptr()) };
        assert_eq!(ret, 4);
        assert!((out[0] - 0.35502805388781723).abs() < TOL_AIRY, "batch Ai(0)={}", out[0]);
        assert!((out[1] - 0.13529241631288141).abs() < TOL_AIRY, "batch Ai(1)={}", out[1]);
    }

    // --- Elliptic K / E tests (Slice 5.3) ---

    fn ek(m: f64) -> f64 {
        let ms = [m];
        let mut out = [0.0f64];
        unsafe { elliptic_k_f64(ms.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }

    fn ee(m: f64) -> f64 {
        let ms = [m];
        let mut out = [0.0f64];
        unsafe { elliptic_e_f64(ms.as_ptr(), 1, out.as_mut_ptr()) };
        out[0]
    }

    const TOL_ELLIPTIC: f64 = 1e-10;

    #[test]
    fn test_ek_at_zero() {
        // K(0) = π/2
        let k_pi_half = core::f64::consts::PI / 2.0;
        assert!(
            (ek(0.0) - k_pi_half).abs() < TOL_ELLIPTIC,
            "K(0) = π/2, got {}",
            ek(0.0)
        );
    }

    #[test]
    fn test_ek_at_half() {
        // K(0.5) ≈ 1.8540746773013719 (DLMF §19.6)
        let ref_val = 1.8540746773013719_f64;
        assert!(
            (ek(0.5) - ref_val).abs() < TOL_ELLIPTIC,
            "K(0.5), got {}",
            ek(0.5)
        );
    }

    #[test]
    fn test_ek_at_one() {
        // K(1) = +∞
        assert!(ek(1.0).is_infinite() && ek(1.0) > 0.0, "K(1) = +∞, got {}", ek(1.0));
    }

    #[test]
    fn test_ek_out_of_domain() {
        assert!(ek(-0.1).is_nan(), "K(-0.1) = NaN");
        assert!(ek(1.5).is_nan(), "K(1.5) = NaN");
    }

    #[test]
    fn test_ee_at_zero() {
        // E(0) = π/2
        let e_pi_half = core::f64::consts::PI / 2.0;
        assert!(
            (ee(0.0) - e_pi_half).abs() < TOL_ELLIPTIC,
            "E(0) = π/2, got {}",
            ee(0.0)
        );
    }

    #[test]
    fn test_ee_at_half() {
        // E(0.5) ≈ 1.3506438810476755 (DLMF §19.6)
        let ref_val = 1.3506438810476755_f64;
        assert!(
            (ee(0.5) - ref_val).abs() < TOL_ELLIPTIC,
            "E(0.5), got {}",
            ee(0.5)
        );
    }

    #[test]
    fn test_ee_at_one() {
        // E(1) = 1.0
        assert!((ee(1.0) - 1.0).abs() < TOL_ELLIPTIC, "E(1) = 1.0, got {}", ee(1.0));
    }

    #[test]
    fn test_ee_out_of_domain() {
        assert!(ee(-0.1).is_nan(), "E(-0.1) = NaN");
        assert!(ee(1.5).is_nan(), "E(1.5) = NaN");
    }

    #[test]
    fn test_elliptic_batch() {
        let ms: Vec<f64> = vec![0.0, 0.5, 0.99];
        let mut out = vec![0.0f64; 3];
        let ret = unsafe { elliptic_k_f64(ms.as_ptr(), 3, out.as_mut_ptr()) };
        assert_eq!(ret, 3);
        let k_pi_half = core::f64::consts::PI / 2.0;
        assert!((out[0] - k_pi_half).abs() < TOL_ELLIPTIC, "batch K(0)={}", out[0]);
        assert!((out[1] - 1.8540746773013719_f64).abs() < TOL_ELLIPTIC, "batch K(0.5)={}", out[1]);
        // K(0.99) ≈ 3.6956373629898747 (reference)
        assert!(
            (out[2] - 3.6956373629898747_f64).abs() < 1e-7,
            "batch K(0.99)={}",
            out[2]
        );
    }
}

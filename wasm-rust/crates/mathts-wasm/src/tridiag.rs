//! Tridiagonal-solve hot-loop kernel — Thomas algorithm.
//!
//! Solves a tridiagonal linear system A·x = rhs in O(n) using the
//! Thomas algorithm (a specialised form of Gaussian elimination).
//!
//! The system is parameterised as:
//!
//! ```text
//!   diag[0]    upper[0]   0          …   0
//!   lower[0]   diag[1]    upper[1]   …   0
//!   0          lower[1]   diag[2]    …   0
//!   …                                …  upper[n-2]
//!   0          …          lower[n-2]    diag[n-1]
//! ```
//!
//! Conventions:
//! * `diag`  — main diagonal,        length n
//! * `lower` — sub-diagonal,         length n-1, `lower[i]` is row i+1, col i
//! * `upper` — super-diagonal,       length n-1, `upper[i]` is row i, col i+1
//! * `rhs`   — right-hand side,      length n
//!
//! Returns x of length n.
//!
//! Used by `cubicSpline`, `pchip`, and `akima` in the typed interpolation
//! layer (functions/src/typed/interpolation.ts) through the bridge at
//! functions/src/wasm/interpolation/wasm-bridge.ts.

use alloc::vec;
use alloc::vec::Vec;

/// Solve a tridiagonal system using the Thomas algorithm.
///
/// # Panics
/// Panics (on the native test target) if a zero pivot is encountered.
/// On the WASM target the behaviour is defined by the WebAssembly trap
/// mechanism (integer-overflow or unreachable trap depending on the
/// toolchain); callers should ensure the system is non-singular.
///
/// # Safety
/// All pointers must be valid and aligned `f64` slices of the declared
/// lengths that live for the duration of this call.  `out_ptr` must
/// point to a writable buffer of at least `n` `f64` elements.
#[no_mangle]
pub unsafe extern "C" fn tridiag_solve_f64(
    diag_ptr: *const f64,
    lower_ptr: *const f64,
    upper_ptr: *const f64,
    rhs_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
) -> i32 {
    let n = n as usize;
    if n == 0 {
        return 0;
    }
    if n == 1 {
        let d0 = *diag_ptr;
        if d0 == 0.0 {
            return -1; // singular
        }
        *out_ptr = *rhs_ptr / d0;
        return 1;
    }

    // Forward sweep — modified super-diagonal and RHS.
    let mut c: Vec<f64> = vec![0.0; n - 1]; // modified super-diagonal
    let mut d: Vec<f64> = vec![0.0; n]; //     modified rhs

    let d0 = *diag_ptr;
    if d0 == 0.0 {
        return -1; // singular
    }
    c[0] = *upper_ptr / d0;
    d[0] = *rhs_ptr / d0;

    for i in 1..n - 1 {
        let lower_im1 = *lower_ptr.add(i - 1);
        let m = *diag_ptr.add(i) - lower_im1 * c[i - 1];
        if m == 0.0 {
            return -1; // singular
        }
        c[i] = *upper_ptr.add(i) / m;
        d[i] = (*rhs_ptr.add(i) - lower_im1 * d[i - 1]) / m;
    }

    // Last row.
    let lower_nm2 = *lower_ptr.add(n - 2);
    let m_last = *diag_ptr.add(n - 1) - lower_nm2 * c[n - 2];
    if m_last == 0.0 {
        return -1; // singular
    }
    d[n - 1] = (*rhs_ptr.add(n - 1) - lower_nm2 * d[n - 2]) / m_last;

    // Back substitution.
    *out_ptr.add(n - 1) = d[n - 1];
    for i in (0..n - 1).rev() {
        *out_ptr.add(i) = d[i] - c[i] * *out_ptr.add(i + 1);
    }

    n as i32
}

// ============================================================
// Divided-difference kernel (Slice 5.5)
// ============================================================
//
// Computes Newton's divided-difference coefficients for polynomial
// interpolation in O(n²) time using O(n) extra memory.
//
// Given n distinct nodes (x_0, y_0) … (x_{n-1}, y_{n-1}), the output
// array `out` is filled with the Newton coefficients c_0 … c_{n-1}
// such that the interpolating polynomial is:
//
//   P(x) = c_0 + c_1·(x-x_0) + c_2·(x-x_0)(x-x_1) + …
//
// The coefficients are computed by the standard in-place scheme:
//   start with out[i] = y[i];
//   for j = 1..n:  for i = n-1..j (rev):
//     out[i] = (out[i] - out[i-1]) / (xs[i] - xs[i-j])
//
// Returns n (the number of coefficients written) on success.
// Returns -1 when any denominator is zero (duplicate x-values).

/// Compute Newton's divided-difference coefficients in-place.
///
/// # Safety
/// `xs_ptr` and `ys_ptr` must be valid aligned `*const f64` arrays of
/// length `n`.  `out_ptr` must be a valid writable `*mut f64` buffer of
/// length `n`.  All pointers must remain live for the duration of this call.
#[no_mangle]
pub unsafe extern "C" fn divided_difference_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    n: usize,
    out_ptr: *mut f64,
) -> i32 {
    if n == 0 {
        return 0;
    }

    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);
    let out = core::slice::from_raw_parts_mut(out_ptr, n);

    // Initialise with y-values.
    out.copy_from_slice(ys);

    for j in 1..n {
        for i in (j..n).rev() {
            let denom = xs[i] - xs[i - j];
            if denom == 0.0 {
                return -1; // duplicate x-values → degenerate
            }
            out[i] = (out[i] - out[i - 1]) / denom;
        }
    }

    n as i32
}

// ============================================================
// Native unit tests (run with `cargo test`, not in WASM)
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: call the C-ABI kernel via slices.
    fn solve(diag: &[f64], lower: &[f64], upper: &[f64], rhs: &[f64]) -> Vec<f64> {
        let n = diag.len();
        let mut out = vec![0.0f64; n];
        let ret = unsafe {
            tridiag_solve_f64(
                diag.as_ptr(),
                lower.as_ptr(),
                upper.as_ptr(),
                rhs.as_ptr(),
                n as i32,
                out.as_mut_ptr(),
            )
        };
        assert!(ret >= 0, "solver returned singular indicator");
        out
    }

    /// Verify Ax ≈ b by multiplying the tridiagonal matrix by the result.
    fn verify(diag: &[f64], lower: &[f64], upper: &[f64], rhs: &[f64], tol: f64) {
        let x = solve(diag, lower, upper, rhs);
        let n = diag.len();
        for i in 0..n {
            let mut ax = diag[i] * x[i];
            if i > 0 {
                ax += lower[i - 1] * x[i - 1];
            }
            if i < n - 1 {
                ax += upper[i] * x[i + 1];
            }
            let diff = (ax - rhs[i]).abs();
            assert!(
                diff < tol,
                "row {i}: A·x[{i}] = {ax}, expected rhs[{i}] = {}, diff = {diff}",
                rhs[i]
            );
        }
    }

    #[test]
    fn test_identity_2x2() {
        // [ 1 0 ] [x0]   [3]       x0=3, x1=7
        // [ 0 1 ] [x1] = [7]
        let x = solve(&[1.0, 1.0], &[0.0], &[0.0], &[3.0, 7.0]);
        assert!((x[0] - 3.0).abs() < 1e-14);
        assert!((x[1] - 7.0).abs() < 1e-14);
    }

    #[test]
    fn test_n3_known_solution() {
        // From the classic Thomas algorithm example:
        //   2  -1   0   | 1        solution: 1, 1, 1
        //  -1   2  -1   | 0
        //   0  -1   2   | 1
        let diag = [2.0, 2.0, 2.0];
        let lower = [-1.0, -1.0];
        let upper = [-1.0, -1.0];
        let rhs = [1.0, 0.0, 1.0];
        verify(&diag, &lower, &upper, &rhs, 1e-12);
        let x = solve(&diag, &lower, &upper, &rhs);
        for xi in &x {
            assert!((xi - 1.0).abs() < 1e-12, "expected 1.0, got {xi}");
        }
    }

    #[test]
    fn test_n5_round_trip() {
        // Diagonally dominant 5×5 system — verify Ax = b.
        let diag = [4.0, 4.0, 4.0, 4.0, 4.0];
        let lower = [-1.0, -1.0, -1.0, -1.0];
        let upper = [-1.0, -1.0, -1.0, -1.0];
        let rhs = [1.0, 2.0, 3.0, 2.0, 1.0];
        verify(&diag, &lower, &upper, &rhs, 1e-12);
    }

    #[test]
    fn test_singular_returns_minus_one() {
        let n = 3usize;
        let diag = [0.0, 1.0, 1.0]; // zero pivot at row 0
        let lower = [1.0, 1.0];
        let upper = [1.0, 1.0];
        let rhs = [1.0, 1.0, 1.0];
        let mut out = vec![0.0f64; n];
        let ret = unsafe {
            tridiag_solve_f64(
                diag.as_ptr(),
                lower.as_ptr(),
                upper.as_ptr(),
                rhs.as_ptr(),
                n as i32,
                out.as_mut_ptr(),
            )
        };
        assert_eq!(ret, -1, "expected singular indicator -1");
    }

    #[test]
    fn test_n1() {
        let x = solve(&[5.0], &[], &[], &[10.0]);
        assert!((x[0] - 2.0).abs() < 1e-14);
    }

    // -------------------------------------------------------------------
    // divided_difference_f64 tests
    // -------------------------------------------------------------------

    /// Call `divided_difference_f64` via slices and return the output.
    fn div_diff(xs: &[f64], ys: &[f64]) -> Vec<f64> {
        let n = xs.len();
        let mut out = vec![0.0f64; n];
        let ret = unsafe {
            divided_difference_f64(xs.as_ptr(), ys.as_ptr(), n, out.as_mut_ptr())
        };
        assert!(ret >= 0, "divided_difference returned error {ret}");
        out
    }

    /// Evaluate the Newton-form polynomial at `x` using the divided-difference
    /// coefficients and nodes.
    fn newton_eval(xs: &[f64], coeffs: &[f64], x: f64) -> f64 {
        let n = coeffs.len();
        let mut result = coeffs[n - 1];
        for k in (0..n - 1).rev() {
            result = result * (x - xs[k]) + coeffs[k];
        }
        result
    }

    #[test]
    fn test_dd_constant() {
        // f(x) = 5 → coefficients should be [5, 0, 0]
        let xs = [0.0, 1.0, 2.0];
        let ys = [5.0, 5.0, 5.0];
        let c = div_diff(&xs, &ys);
        assert!((c[0] - 5.0).abs() < 1e-14);
        assert!(c[1].abs() < 1e-14);
        assert!(c[2].abs() < 1e-14);
    }

    #[test]
    fn test_dd_linear() {
        // f(x) = 2x + 1: Newton coeffs = [1, 2, 0]
        let xs = [0.0, 1.0, 2.0];
        let ys = [1.0, 3.0, 5.0];
        let c = div_diff(&xs, &ys);
        assert!((c[0] - 1.0).abs() < 1e-13);
        assert!((c[1] - 2.0).abs() < 1e-13);
        assert!(c[2].abs() < 1e-13);
    }

    #[test]
    fn test_dd_quadratic_round_trip() {
        // f(x) = x^2: interpolate at x=0,1,2 → coeffs [0, 1, 1]
        let xs = [0.0, 1.0, 2.0];
        let ys = [0.0, 1.0, 4.0];
        let c = div_diff(&xs, &ys);
        // Evaluate at x = 1.5 → 2.25
        let v = newton_eval(&xs, &c, 1.5);
        assert!((v - 2.25).abs() < 1e-12, "expected 2.25, got {v}");
    }

    #[test]
    fn test_dd_duplicate_x_returns_minus_one() {
        let xs = [0.0, 1.0, 1.0]; // duplicate!
        let ys = [0.0, 1.0, 2.0];
        let n = xs.len();
        let mut out = vec![0.0f64; n];
        let ret = unsafe {
            divided_difference_f64(xs.as_ptr(), ys.as_ptr(), n, out.as_mut_ptr())
        };
        assert_eq!(ret, -1, "expected -1 for duplicate x");
    }

    #[test]
    fn test_dd_n1() {
        let xs = [3.0];
        let ys = [7.0];
        let c = div_diff(&xs, &ys);
        assert_eq!(c.len(), 1);
        assert!((c[0] - 7.0).abs() < 1e-14);
    }
}

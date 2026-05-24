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
}

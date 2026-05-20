//! Singular Value Decomposition via the one-sided Jacobi algorithm.
//!
//! One-sided Jacobi is compact, allocation-light, and numerically robust — it
//! resolves small singular values to high relative accuracy and needs no
//! bidiagonalization. It works for any real `m x n` matrix.
//!
//! Closes EXPANSION/GAP item "Gap B P0 — SVD" (see
//! `docs/roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md`): the crate previously had
//! only an *internal* Jacobi eigen-routine for condition number / rank, with
//! no standalone SVD export returning U, S, V.

use alloc::vec::Vec;

/// Thin (economy) SVD of a real `m x n` matrix `A` (row-major).
///
/// Computes `A = U * diag(S) * V^T` with `k = min(m, n)`:
///   * `u_ptr` - output `U`, `m x k` row-major
///   * `s_ptr` - output singular values, length `k`, sorted descending
///   * `v_ptr` - output `V`, `n x k` row-major (this is `V`, not `V^T`)
///
/// The caller owns every buffer. Returns the number of Jacobi sweeps
/// performed, or `-1` for invalid dimensions.
///
/// # Safety
/// `a_ptr` must point to `m * n` readable `f64`s; `u_ptr`, `s_ptr`, `v_ptr`
/// must point to `m*k`, `k`, `n*k` writable `f64`s respectively.
#[no_mangle]
pub unsafe extern "C" fn svd(
    a_ptr: *const f64,
    m: i32,
    n: i32,
    u_ptr: *mut f64,
    s_ptr: *mut f64,
    v_ptr: *mut f64,
) -> i32 {
    if m <= 0 || n <= 0 {
        return -1;
    }
    let m = m as usize;
    let n = n as usize;

    let mut a = alloc::vec![0.0f64; m * n];
    for (i, slot) in a.iter_mut().enumerate() {
        *slot = *a_ptr.add(i);
    }

    let result = svd_core(&a, m, n);
    let k = if m < n { m } else { n };

    for i in 0..(m * k) {
        *u_ptr.add(i) = result.u[i];
    }
    for i in 0..k {
        *s_ptr.add(i) = result.s[i];
    }
    for i in 0..(n * k) {
        *v_ptr.add(i) = result.v[i];
    }
    result.sweeps
}

/// Singular values only — `S`, length `k = min(m, n)`, sorted descending.
///
/// # Safety
/// `a_ptr` must point to `m * n` readable `f64`s; `s_ptr` to `min(m,n)`
/// writable `f64`s.
#[no_mangle]
pub unsafe extern "C" fn singularValues(
    a_ptr: *const f64,
    m: i32,
    n: i32,
    s_ptr: *mut f64,
) -> i32 {
    if m <= 0 || n <= 0 {
        return -1;
    }
    let m = m as usize;
    let n = n as usize;

    let mut a = alloc::vec![0.0f64; m * n];
    for (i, slot) in a.iter_mut().enumerate() {
        *slot = *a_ptr.add(i);
    }

    let result = svd_core(&a, m, n);
    for i in 0..result.s.len() {
        *s_ptr.add(i) = result.s[i];
    }
    result.sweeps
}

struct SvdResult {
    u: Vec<f64>, // m x k, row-major
    s: Vec<f64>, // k
    v: Vec<f64>, // n x k, row-major
    sweeps: i32,
}

/// Pure one-sided Jacobi SVD core — no raw pointers, unit-testable.
fn svd_core(a: &[f64], m: usize, n: usize) -> SvdResult {
    // One-sided Jacobi orthogonalizes COLUMNS, so it wants rows >= cols.
    // For wide matrices (m < n) we decompose A^T and swap U/V at the end.
    let transposed = m < n;
    let (rows, cols) = if transposed { (n, m) } else { (m, n) };

    // Working matrix `w` (rows x cols) = A (or A^T).
    let mut w = alloc::vec![0.0f64; rows * cols];
    if transposed {
        // w = A^T : w[i][j] = A[j][i]; A is m x n = cols x rows.
        for i in 0..rows {
            for j in 0..cols {
                w[i * cols + j] = a[j * rows + i];
            }
        }
    } else {
        w.copy_from_slice(a);
    }

    // `v` (cols x cols) starts as identity and accumulates the rotations.
    let mut v = alloc::vec![0.0f64; cols * cols];
    for i in 0..cols {
        v[i * cols + i] = 1.0;
    }

    const MAX_SWEEPS: i32 = 60;
    const EPS: f64 = 1e-15;
    let mut sweeps = 0;
    loop {
        let mut rotated = false;
        for p in 0..cols {
            for q in (p + 1)..cols {
                let mut alpha = 0.0; // ||w_p||^2
                let mut beta = 0.0; //  ||w_q||^2
                let mut gamma = 0.0; // w_p . w_q
                for i in 0..rows {
                    let wip = w[i * cols + p];
                    let wiq = w[i * cols + q];
                    alpha += wip * wip;
                    beta += wiq * wiq;
                    gamma += wip * wiq;
                }
                // Columns already orthogonal to working precision?
                if libm::fabs(gamma) <= EPS * libm::sqrt(alpha * beta) {
                    continue;
                }
                rotated = true;
                // Jacobi rotation that orthogonalizes columns p and q.
                let zeta = (beta - alpha) / (2.0 * gamma);
                let t = if zeta >= 0.0 {
                    1.0 / (zeta + libm::sqrt(1.0 + zeta * zeta))
                } else {
                    -1.0 / (-zeta + libm::sqrt(1.0 + zeta * zeta))
                };
                let c = 1.0 / libm::sqrt(1.0 + t * t);
                let s = c * t;
                for i in 0..rows {
                    let wip = w[i * cols + p];
                    let wiq = w[i * cols + q];
                    w[i * cols + p] = c * wip - s * wiq;
                    w[i * cols + q] = s * wip + c * wiq;
                }
                for i in 0..cols {
                    let vip = v[i * cols + p];
                    let viq = v[i * cols + q];
                    v[i * cols + p] = c * vip - s * viq;
                    v[i * cols + q] = s * vip + c * viq;
                }
            }
        }
        sweeps += 1;
        if !rotated || sweeps >= MAX_SWEEPS {
            break;
        }
    }

    // Singular values = column norms of the converged working matrix.
    let mut sigma = alloc::vec![0.0f64; cols];
    for j in 0..cols {
        let mut nrm = 0.0;
        for i in 0..rows {
            let x = w[i * cols + j];
            nrm += x * x;
        }
        sigma[j] = libm::sqrt(nrm);
    }

    // Order columns by descending singular value (insertion sort — `cols`
    // is small and this avoids pulling in a sort from `std`).
    let mut order: Vec<usize> = (0..cols).collect();
    for i in 1..cols {
        let key = order[i];
        let mut j = i;
        while j > 0 && sigma[order[j - 1]] < sigma[key] {
            order[j] = order[j - 1];
            j -= 1;
        }
        order[j] = key;
    }

    // Build thin U (rows x cols), reordered V (cols x cols), reordered S.
    let mut u_thin = alloc::vec![0.0f64; rows * cols];
    let mut v_ord = alloc::vec![0.0f64; cols * cols];
    let mut s_ord = alloc::vec![0.0f64; cols];
    for (new_j, &old_j) in order.iter().enumerate() {
        let sv = sigma[old_j];
        s_ord[new_j] = sv;
        for i in 0..rows {
            u_thin[i * cols + new_j] = if sv > 1e-300 {
                w[i * cols + old_j] / sv
            } else {
                0.0
            };
        }
        for i in 0..cols {
            v_ord[i * cols + new_j] = v[i * cols + old_j];
        }
    }

    // Map back to the original orientation.
    //  not transposed: A   = u_thin * diag(s) * v_ord^T  -> U=u_thin, V=v_ord
    //  transposed:     A^T = u_thin * diag(s) * v_ord^T
    //              =>  A   = v_ord  * diag(s) * u_thin^T  -> U=v_ord,  V=u_thin
    if transposed {
        SvdResult { u: v_ord, s: s_ord, v: u_thin, sweeps }
    } else {
        SvdResult { u: u_thin, s: s_ord, v: v_ord, sweeps }
    }
}

#[cfg(test)]
mod tests {
    use super::svd_core;
    use alloc::vec;
    use alloc::vec::Vec;

    fn reconstruct(u: &[f64], s: &[f64], v: &[f64], m: usize, n: usize) -> Vec<f64> {
        let k = if m < n { m } else { n };
        let mut out = vec![0.0f64; m * n];
        for i in 0..m {
            for j in 0..n {
                let mut acc = 0.0;
                for t in 0..k {
                    acc += u[i * k + t] * s[t] * v[j * k + t];
                }
                out[i * n + j] = acc;
            }
        }
        out
    }

    fn max_diff(a: &[f64], b: &[f64]) -> f64 {
        let mut d = 0.0;
        for i in 0..a.len() {
            let x = (a[i] - b[i]).abs();
            if x > d {
                d = x;
            }
        }
        d
    }

    fn check_orthonormal_cols(mat: &[f64], rows: usize, cols: usize) {
        for p in 0..cols {
            for q in 0..cols {
                let mut dotv = 0.0;
                for i in 0..rows {
                    dotv += mat[i * cols + p] * mat[i * cols + q];
                }
                // Columns for zero singular values are left zero — skip them.
                if p == q && dotv.abs() < 1e-9 {
                    continue;
                }
                let expect = if p == q { 1.0 } else { 0.0 };
                assert!(
                    (dotv - expect).abs() < 1e-9,
                    "col {p} . col {q} = {dotv}"
                );
            }
        }
    }

    #[test]
    fn identity_3x3() {
        let a = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
        let r = svd_core(&a, 3, 3);
        for &s in &r.s {
            assert!((s - 1.0).abs() < 1e-12);
        }
        assert!(max_diff(&a, &reconstruct(&r.u, &r.s, &r.v, 3, 3)) < 1e-12);
    }

    #[test]
    fn diagonal_sorted_descending() {
        let a = vec![3.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0];
        let r = svd_core(&a, 3, 3);
        assert!((r.s[0] - 3.0).abs() < 1e-12);
        assert!((r.s[1] - 2.0).abs() < 1e-12);
        assert!((r.s[2] - 1.0).abs() < 1e-12);
    }

    #[test]
    fn rank_deficient_2x2() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let r = svd_core(&a, 2, 2);
        assert!((r.s[0] - 1.0).abs() < 1e-12);
        assert!(r.s[1].abs() < 1e-12);
    }

    #[test]
    fn known_2x2_singular_values() {
        // [[3,0],[4,0]] has singular values 5 and 0.
        let a = vec![3.0, 0.0, 4.0, 0.0];
        let r = svd_core(&a, 2, 2);
        assert!((r.s[0] - 5.0).abs() < 1e-10, "s0 = {}", r.s[0]);
        assert!(r.s[1].abs() < 1e-10);
    }

    #[test]
    fn tall_rectangular_4x2() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let r = svd_core(&a, 4, 2);
        assert_eq!(r.s.len(), 2);
        assert!(r.s[0] >= r.s[1]);
        assert!(max_diff(&a, &reconstruct(&r.u, &r.s, &r.v, 4, 2)) < 1e-10);
        check_orthonormal_cols(&r.u, 4, 2);
        check_orthonormal_cols(&r.v, 2, 2);
    }

    #[test]
    fn wide_rectangular_2x4() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let r = svd_core(&a, 2, 4);
        assert_eq!(r.s.len(), 2);
        assert!(r.s[0] >= r.s[1]);
        assert!(max_diff(&a, &reconstruct(&r.u, &r.s, &r.v, 2, 4)) < 1e-10);
        check_orthonormal_cols(&r.u, 2, 2);
        check_orthonormal_cols(&r.v, 4, 2);
    }

    #[test]
    fn general_5x3_reconstruction() {
        let a = vec![
            2.0, -1.0, 0.0, 4.0, 3.0, -2.0, 1.0, 1.0, 5.0, 0.0, 6.0, -3.0,
            -1.0, 2.0, 1.0,
        ];
        let r = svd_core(&a, 5, 3);
        assert_eq!(r.s.len(), 3);
        assert!(max_diff(&a, &reconstruct(&r.u, &r.s, &r.v, 5, 3)) < 1e-9);
        check_orthonormal_cols(&r.u, 5, 3);
        check_orthonormal_cols(&r.v, 3, 3);
    }
}

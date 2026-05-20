//! Singular Value Decomposition via the one-sided Jacobi algorithm.
//!
//! One-sided Jacobi is compact, numerically robust (it resolves small
//! singular values to high relative accuracy), and needs no
//! bidiagonalization. It works for any real `m x n` matrix.
//!
//! Closes "Gap B P0 — SVD" (see `docs/roadmap/GAP_ANALYSIS_WASM_CANDIDATES.md`).
//!
//! ABI: every buffer — including all scratch — is caller-provided. The
//! function performs **no heap allocation**, matching the rest of the crate's
//! `extern "C"` matrix kernels so the JS-side bump allocator
//! (`RustWasmLoader`) can own all WASM linear memory without colliding with a
//! Rust-side heap.

/// Scratch length (in `f64`s) that [`svd`] needs for an `m x n` input.
fn svd_work_len(m: usize, n: usize) -> usize {
    let rows = if m < n { n } else { m };
    let cols = if m < n { m } else { n };
    // working matrix + rotation accumulator + sigma + ordering indices
    rows * cols + cols * cols + 2 * cols
}

/// Scratch length (in `f64`s) for [`svd`], given `m x n` dimensions.
///
/// # Safety
/// Pure arithmetic; the `unsafe`/`extern` form only exists for the WASM ABI.
#[no_mangle]
pub extern "C" fn svdWorkSize(m: i32, n: i32) -> i32 {
    if m <= 0 || n <= 0 {
        return 0;
    }
    svd_work_len(m as usize, n as usize) as i32
}

/// Scratch length (in `f64`s) for [`singularValues`], given `m x n` dims.
#[no_mangle]
pub extern "C" fn singularValuesWorkSize(m: i32, n: i32) -> i32 {
    if m <= 0 || n <= 0 {
        return 0;
    }
    let (m, n) = (m as usize, n as usize);
    let k = if m < n { m } else { n };
    (m * k + n * k + svd_work_len(m, n)) as i32
}

/// Thin (economy) SVD of a real `m x n` matrix `A` (row-major).
///
/// Computes `A = U * diag(S) * V^T` with `k = min(m, n)`:
///   * `u_ptr`    - output `U`, `m x k` row-major
///   * `s_ptr`    - output singular values, length `k`, sorted descending
///   * `v_ptr`    - output `V`, `n x k` row-major (this is `V`, not `V^T`)
///   * `work_ptr` - caller scratch, length `>= svdWorkSize(m, n)`
///
/// Returns the number of Jacobi sweeps performed, or `-1` for invalid dims.
///
/// # Safety
/// `a_ptr` must point to `m*n` readable `f64`s; `u_ptr`/`s_ptr`/`v_ptr` to
/// `m*k`/`k`/`n*k` writable `f64`s; `work_ptr` to `svdWorkSize(m,n)` writable
/// `f64`s. No buffer may overlap another.
#[no_mangle]
pub unsafe extern "C" fn svd(
    a_ptr: *const f64,
    m: i32,
    n: i32,
    u_ptr: *mut f64,
    s_ptr: *mut f64,
    v_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if m <= 0 || n <= 0 {
        return -1;
    }
    let (m, n) = (m as usize, n as usize);
    let k = if m < n { m } else { n };
    let a = core::slice::from_raw_parts(a_ptr, m * n);
    let u = core::slice::from_raw_parts_mut(u_ptr, m * k);
    let s = core::slice::from_raw_parts_mut(s_ptr, k);
    let v = core::slice::from_raw_parts_mut(v_ptr, n * k);
    let work = core::slice::from_raw_parts_mut(work_ptr, svd_work_len(m, n));
    svd_core(a, m, n, u, s, v, work)
}

/// Singular values only — `S`, length `k = min(m, n)`, sorted descending.
///
/// # Safety
/// As [`svd`], but `s_ptr` takes `k` values and `work_ptr` takes
/// `singularValuesWorkSize(m, n)` values.
#[no_mangle]
pub unsafe extern "C" fn singularValues(
    a_ptr: *const f64,
    m: i32,
    n: i32,
    s_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if m <= 0 || n <= 0 {
        return -1;
    }
    let (m, n) = (m as usize, n as usize);
    let k = if m < n { m } else { n };
    let a = core::slice::from_raw_parts(a_ptr, m * n);
    let s = core::slice::from_raw_parts_mut(s_ptr, k);
    let total = m * k + n * k + svd_work_len(m, n);
    let work = core::slice::from_raw_parts_mut(work_ptr, total);
    let (u_scratch, rest) = work.split_at_mut(m * k);
    let (v_scratch, svd_work) = rest.split_at_mut(n * k);
    svd_core(a, m, n, u_scratch, s, v_scratch, svd_work)
}

/// Pure, allocation-free one-sided Jacobi SVD core.
///
/// `work` must have length `>= svd_work_len(m, n)`. Unit-testable directly.
fn svd_core(
    a: &[f64],
    m: usize,
    n: usize,
    u: &mut [f64],
    s: &mut [f64],
    v: &mut [f64],
    work: &mut [f64],
) -> i32 {
    // One-sided Jacobi orthogonalizes COLUMNS, so it wants rows >= cols.
    // For wide matrices (m < n) decompose A^T and swap U/V at the end.
    let transposed = m < n;
    let (rows, cols) = if transposed { (n, m) } else { (m, n) };

    // Carve scratch out of `work`.
    let (w, rest) = work.split_at_mut(rows * cols);
    let (vacc, rest) = rest.split_at_mut(cols * cols);
    let (sigma, rest) = rest.split_at_mut(cols);
    let (order, _) = rest.split_at_mut(cols);

    // Working matrix w = A (or A^T).
    if transposed {
        for i in 0..rows {
            for j in 0..cols {
                w[i * cols + j] = a[j * rows + i];
            }
        }
    } else {
        w[..rows * cols].copy_from_slice(&a[..rows * cols]);
    }

    // vacc starts as the identity, accumulates the column rotations.
    for x in vacc.iter_mut() {
        *x = 0.0;
    }
    for i in 0..cols {
        vacc[i * cols + i] = 1.0;
    }

    const MAX_SWEEPS: i32 = 60;
    const EPS: f64 = 1e-15;
    let mut sweeps = 0;
    loop {
        let mut rotated = false;
        for p in 0..cols {
            for q in (p + 1)..cols {
                let mut alpha = 0.0;
                let mut beta = 0.0;
                let mut gamma = 0.0;
                for i in 0..rows {
                    let wip = w[i * cols + p];
                    let wiq = w[i * cols + q];
                    alpha += wip * wip;
                    beta += wiq * wiq;
                    gamma += wip * wiq;
                }
                if libm::fabs(gamma) <= EPS * libm::sqrt(alpha * beta) {
                    continue;
                }
                rotated = true;
                let zeta = (beta - alpha) / (2.0 * gamma);
                let t = if zeta >= 0.0 {
                    1.0 / (zeta + libm::sqrt(1.0 + zeta * zeta))
                } else {
                    -1.0 / (-zeta + libm::sqrt(1.0 + zeta * zeta))
                };
                let c = 1.0 / libm::sqrt(1.0 + t * t);
                let sn = c * t;
                for i in 0..rows {
                    let wip = w[i * cols + p];
                    let wiq = w[i * cols + q];
                    w[i * cols + p] = c * wip - sn * wiq;
                    w[i * cols + q] = sn * wip + c * wiq;
                }
                for i in 0..cols {
                    let vip = vacc[i * cols + p];
                    let viq = vacc[i * cols + q];
                    vacc[i * cols + p] = c * vip - sn * viq;
                    vacc[i * cols + q] = sn * vip + c * viq;
                }
            }
        }
        sweeps += 1;
        if !rotated || sweeps >= MAX_SWEEPS {
            break;
        }
    }

    // Singular values = column norms of the converged working matrix.
    for j in 0..cols {
        let mut nrm = 0.0;
        for i in 0..rows {
            let x = w[i * cols + j];
            nrm += x * x;
        }
        sigma[j] = libm::sqrt(nrm);
    }

    // Order columns by descending singular value (insertion sort; indices
    // are stored as f64 in the scratch slice).
    for (i, slot) in order.iter_mut().enumerate() {
        *slot = i as f64;
    }
    for i in 1..cols {
        let key = order[i];
        let key_sigma = sigma[key as usize];
        let mut j = i;
        while j > 0 && sigma[order[j - 1] as usize] < key_sigma {
            order[j] = order[j - 1];
            j -= 1;
        }
        order[j] = key;
    }

    // Write thin U, S, V directly into the outputs, mapped back to the
    // original orientation.
    //  not transposed: U = w-cols/sigma (m x k), V = vacc (n x k)
    //  transposed:     U = vacc (m x k),         V = w-cols/sigma (n x k)
    for nj in 0..cols {
        let oldj = order[nj] as usize;
        let sv = sigma[oldj];
        s[nj] = sv;
        if transposed {
            for i in 0..cols {
                u[i * cols + nj] = vacc[i * cols + oldj];
            }
            for i in 0..rows {
                v[i * cols + nj] = if sv > 1e-300 {
                    w[i * cols + oldj] / sv
                } else {
                    0.0
                };
            }
        } else {
            for i in 0..rows {
                u[i * cols + nj] = if sv > 1e-300 {
                    w[i * cols + oldj] / sv
                } else {
                    0.0
                };
            }
            for i in 0..cols {
                v[i * cols + nj] = vacc[i * cols + oldj];
            }
        }
    }

    sweeps
}

#[cfg(test)]
mod tests {
    use super::{svd_core, svd_work_len};
    use alloc::vec;
    use alloc::vec::Vec;

    /// Run `svd_core`, allocating outputs + scratch with std `Vec`s.
    fn run(a: &[f64], m: usize, n: usize) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        let k = if m < n { m } else { n };
        let mut u = vec![0.0f64; m * k];
        let mut s = vec![0.0f64; k];
        let mut v = vec![0.0f64; n * k];
        let mut work = vec![0.0f64; svd_work_len(m, n)];
        svd_core(a, m, n, &mut u, &mut s, &mut v, &mut work);
        (u, s, v)
    }

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
                if p == q && dotv.abs() < 1e-9 {
                    continue; // zero singular value — column left zero
                }
                let expect = if p == q { 1.0 } else { 0.0 };
                assert!((dotv - expect).abs() < 1e-9, "col {p}.{q} = {dotv}");
            }
        }
    }

    #[test]
    fn identity_3x3() {
        let a = vec![1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
        let (u, s, v) = run(&a, 3, 3);
        for &sv in &s {
            assert!((sv - 1.0).abs() < 1e-12);
        }
        assert!(max_diff(&a, &reconstruct(&u, &s, &v, 3, 3)) < 1e-12);
    }

    #[test]
    fn diagonal_sorted_descending() {
        let a = vec![3.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0];
        let (_, s, _) = run(&a, 3, 3);
        assert!((s[0] - 3.0).abs() < 1e-12);
        assert!((s[1] - 2.0).abs() < 1e-12);
        assert!((s[2] - 1.0).abs() < 1e-12);
    }

    #[test]
    fn rank_deficient_2x2() {
        let a = vec![1.0, 0.0, 0.0, 0.0];
        let (_, s, _) = run(&a, 2, 2);
        assert!((s[0] - 1.0).abs() < 1e-12);
        assert!(s[1].abs() < 1e-12);
    }

    #[test]
    fn known_2x2_singular_values() {
        let a = vec![3.0, 0.0, 4.0, 0.0]; // singular values 5, 0
        let (_, s, _) = run(&a, 2, 2);
        assert!((s[0] - 5.0).abs() < 1e-10, "s0 = {}", s[0]);
        assert!(s[1].abs() < 1e-10);
    }

    #[test]
    fn tall_rectangular_4x2() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let (u, s, v) = run(&a, 4, 2);
        assert_eq!(s.len(), 2);
        assert!(s[0] >= s[1]);
        assert!(max_diff(&a, &reconstruct(&u, &s, &v, 4, 2)) < 1e-10);
        check_orthonormal_cols(&u, 4, 2);
        check_orthonormal_cols(&v, 2, 2);
    }

    #[test]
    fn wide_rectangular_2x4() {
        let a = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
        let (u, s, v) = run(&a, 2, 4);
        assert_eq!(s.len(), 2);
        assert!(s[0] >= s[1]);
        assert!(max_diff(&a, &reconstruct(&u, &s, &v, 2, 4)) < 1e-10);
        check_orthonormal_cols(&u, 2, 2);
        check_orthonormal_cols(&v, 4, 2);
    }

    #[test]
    fn general_5x3_reconstruction() {
        let a = vec![
            2.0, -1.0, 0.0, 4.0, 3.0, -2.0, 1.0, 1.0, 5.0, 0.0, 6.0, -3.0,
            -1.0, 2.0, 1.0,
        ];
        let (u, s, v) = run(&a, 5, 3);
        assert_eq!(s.len(), 3);
        assert!(max_diff(&a, &reconstruct(&u, &s, &v, 5, 3)) < 1e-9);
        check_orthonormal_cols(&u, 5, 3);
        check_orthonormal_cols(&v, 3, 3);
    }
}

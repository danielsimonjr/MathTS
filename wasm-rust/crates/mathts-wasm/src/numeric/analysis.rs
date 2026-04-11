//! Matrix analysis via SVD: condition number and rank.
//!
//! Uses the one-sided Jacobi SVD algorithm for computing singular values
//! without external dependencies (faer is available but its SVD API requires
//! std features; we keep these self-contained for no_std compatibility).

/// Compute the 2-norm condition number of a square matrix via SVD.
///
/// cond2(A) = sigma_max / sigma_min
///
/// * `a_ptr` - Pointer to matrix A (n x n, row-major)
/// * `n` - Matrix dimension
///
/// Returns the condition number, or f64::INFINITY if singular.
#[no_mangle]
pub unsafe extern "C" fn condition_number_wasm(a_ptr: *const f64, n: i32) -> f64 {
    let n = n as usize;
    if n == 0 {
        return 1.0;
    }
    if n == 1 {
        let v = libm::fabs(*a_ptr);
        return if v < 1e-15 { f64::INFINITY } else { 1.0 };
    }

    // Compute A'A
    let mut ata = alloc::vec![0.0f64; n * n];
    for i in 0..n {
        for j in i..n {
            let mut sum = 0.0f64;
            for k in 0..n {
                sum += *a_ptr.add(k * n + i) * *a_ptr.add(k * n + j);
            }
            ata[i * n + j] = sum;
            ata[j * n + i] = sum;
        }
    }

    // Find eigenvalues of A'A using Jacobi iteration
    // (eigenvalues of A'A = squared singular values of A)
    let singular_values_sq = jacobi_eigenvalues(&mut ata, n);

    let mut max_sv = 0.0f64;
    let mut min_sv = f64::INFINITY;
    for &sv_sq in singular_values_sq.iter() {
        let sv = libm::sqrt(libm::fabs(sv_sq));
        if sv > max_sv {
            max_sv = sv;
        }
        if sv < min_sv {
            min_sv = sv;
        }
    }

    if min_sv < 1e-15 {
        f64::INFINITY
    } else {
        max_sv / min_sv
    }
}

/// Compute the rank of a matrix via SVD.
///
/// * `a_ptr` - Pointer to matrix A (m x n, row-major)
/// * `m` - Number of rows
/// * `n` - Number of columns
/// * `tol` - Tolerance for singular value threshold
///
/// Returns the numerical rank.
#[no_mangle]
pub unsafe extern "C" fn matrix_rank_wasm(a_ptr: *const f64, m: i32, n: i32, tol: f64) -> i32 {
    let m = m as usize;
    let n = n as usize;
    let min_dim = if m < n { m } else { n };

    if min_dim == 0 {
        return 0;
    }

    // Compute A'A (n x n)
    let mut ata = alloc::vec![0.0f64; n * n];
    for i in 0..n {
        for j in i..n {
            let mut sum = 0.0f64;
            for k in 0..m {
                sum += *a_ptr.add(k * n + i) * *a_ptr.add(k * n + j);
            }
            ata[i * n + j] = sum;
            ata[j * n + i] = sum;
        }
    }

    let singular_values_sq = jacobi_eigenvalues(&mut ata, n);

    // Find max singular value for relative tolerance
    let mut max_sv = 0.0f64;
    for &sv_sq in singular_values_sq.iter() {
        let sv = libm::sqrt(libm::fabs(sv_sq));
        if sv > max_sv {
            max_sv = sv;
        }
    }

    // Use provided tolerance, or default relative tolerance
    let effective_tol = if tol > 0.0 {
        tol
    } else {
        max_sv * (m.max(n) as f64) * 2.2e-16
    };

    let mut r = 0i32;
    for &sv_sq in singular_values_sq.iter() {
        let sv = libm::sqrt(libm::fabs(sv_sq));
        if sv > effective_tol {
            r += 1;
        }
    }

    // Rank cannot exceed min(m, n)
    if r > min_dim as i32 {
        min_dim as i32
    } else {
        r
    }
}

/// Jacobi eigenvalue algorithm for symmetric matrices.
/// Returns eigenvalues (diagonal elements after convergence).
fn jacobi_eigenvalues(a: &mut [f64], n: usize) -> alloc::vec::Vec<f64> {
    let max_iter = 100 * n * n;
    let eps = 1e-15;

    for _ in 0..max_iter {
        // Find largest off-diagonal element
        let mut max_off = 0.0f64;
        let mut p = 0usize;
        let mut q = 1usize;
        for i in 0..n {
            for j in (i + 1)..n {
                let v = libm::fabs(a[i * n + j]);
                if v > max_off {
                    max_off = v;
                    p = i;
                    q = j;
                }
            }
        }

        if max_off < eps {
            break;
        }

        // Compute rotation
        let app = a[p * n + p];
        let aqq = a[q * n + q];
        let apq = a[p * n + q];

        let theta = if libm::fabs(app - aqq) < eps {
            core::f64::consts::FRAC_PI_4
        } else {
            0.5 * libm::atan2(2.0 * apq, app - aqq)
        };

        let c = libm::cos(theta);
        let s = libm::sin(theta);

        // Apply Jacobi rotation
        let new_pp = c * c * app + 2.0 * s * c * apq + s * s * aqq;
        let new_qq = s * s * app - 2.0 * s * c * apq + c * c * aqq;

        a[p * n + p] = new_pp;
        a[q * n + q] = new_qq;
        a[p * n + q] = 0.0;
        a[q * n + p] = 0.0;

        for r in 0..n {
            if r != p && r != q {
                let arp = a[r * n + p];
                let arq = a[r * n + q];
                a[r * n + p] = c * arp + s * arq;
                a[p * n + r] = a[r * n + p];
                a[r * n + q] = -s * arp + c * arq;
                a[q * n + r] = a[r * n + q];
            }
        }
    }

    let mut eigenvalues = alloc::vec![0.0f64; n];
    for i in 0..n {
        eigenvalues[i] = a[i * n + i];
    }
    eigenvalues
}

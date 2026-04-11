//! Optimization algorithms: quadratic minimization, least squares, Levenberg-Marquardt.

/// Minimize 0.5 * x' H x + f' x via solving H x = -f using Cholesky (or fallback to pivoted LU).
///
/// * `h_ptr` - Pointer to symmetric positive-definite Hessian H (n x n, row-major)
/// * `f_ptr` - Pointer to linear term f (n elements)
/// * `n` - Dimension
/// * `x_ptr` - Output: optimal x (n elements)
///
/// Returns the optimal objective value 0.5 * x' H x + f' x, or f64::INFINITY on failure.
#[no_mangle]
pub unsafe extern "C" fn minimize_quadratic_wasm(
    h_ptr: *const f64,
    f_ptr: *const f64,
    n: i32,
    x_ptr: *mut f64,
) -> f64 {
    let n = n as usize;
    if n == 0 {
        return 0.0;
    }

    // We solve H x = -f via Gaussian elimination with partial pivoting.
    // Use alloc for work buffers.
    let mut aug = alloc::vec![0.0f64; n * (n + 1)];

    // Build augmented matrix [H | -f]
    for i in 0..n {
        for j in 0..n {
            aug[i * (n + 1) + j] = *h_ptr.add(i * n + j);
        }
        aug[i * (n + 1) + n] = -*f_ptr.add(i);
    }

    // Gaussian elimination with partial pivoting
    for k in 0..n {
        // Find pivot
        let mut max_val = libm::fabs(aug[k * (n + 1) + k]);
        let mut max_row = k;
        for i in (k + 1)..n {
            let v = libm::fabs(aug[i * (n + 1) + k]);
            if v > max_val {
                max_val = v;
                max_row = i;
            }
        }

        if max_val < 1e-14 {
            // Singular — fill with zeros and return infinity
            for i in 0..n {
                *x_ptr.add(i) = 0.0;
            }
            return f64::INFINITY;
        }

        // Swap rows
        if max_row != k {
            for j in 0..(n + 1) {
                let tmp = aug[k * (n + 1) + j];
                aug[k * (n + 1) + j] = aug[max_row * (n + 1) + j];
                aug[max_row * (n + 1) + j] = tmp;
            }
        }

        // Eliminate below
        let pivot = aug[k * (n + 1) + k];
        for i in (k + 1)..n {
            let factor = aug[i * (n + 1) + k] / pivot;
            for j in (k + 1)..(n + 1) {
                aug[i * (n + 1) + j] -= factor * aug[k * (n + 1) + j];
            }
            aug[i * (n + 1) + k] = 0.0;
        }
    }

    // Back substitution
    let mut i = n as isize - 1;
    while i >= 0 {
        let iu = i as usize;
        let mut s = aug[iu * (n + 1) + n];
        for j in (iu + 1)..n {
            s -= aug[iu * (n + 1) + j] * *x_ptr.add(j);
        }
        *x_ptr.add(iu) = s / aug[iu * (n + 1) + iu];
        i -= 1;
    }

    // Compute objective: 0.5 * x' H x + f' x
    let mut obj = 0.0f64;
    for i in 0..n {
        let xi = *x_ptr.add(i);
        obj += *f_ptr.add(i) * xi;
        for j in 0..n {
            obj += 0.5 * xi * *h_ptr.add(i * n + j) * *x_ptr.add(j);
        }
    }
    obj
}

/// Solve min ||Ax - b||^2 via normal equations: A'A x = A'b.
///
/// * `a_ptr` - Pointer to matrix A (m x n, row-major)
/// * `b_ptr` - Pointer to vector b (m elements)
/// * `m` - Number of rows
/// * `n` - Number of columns
/// * `x_ptr` - Output: solution x (n elements)
///
/// Returns the residual norm ||Ax - b||.
#[no_mangle]
pub unsafe extern "C" fn least_squares_wasm(
    a_ptr: *const f64,
    b_ptr: *const f64,
    m: i32,
    n: i32,
    x_ptr: *mut f64,
) -> f64 {
    let m = m as usize;
    let n = n as usize;

    // Compute A'A (n x n) and A'b (n)
    let mut ata = alloc::vec![0.0f64; n * n];
    let mut atb = alloc::vec![0.0f64; n];

    for i in 0..n {
        for j in 0..n {
            let mut sum = 0.0f64;
            for k in 0..m {
                sum += *a_ptr.add(k * n + i) * *a_ptr.add(k * n + j);
            }
            ata[i * n + j] = sum;
        }
        let mut sum = 0.0f64;
        for k in 0..m {
            sum += *a_ptr.add(k * n + i) * *b_ptr.add(k);
        }
        atb[i] = sum;
    }

    // Solve A'A x = A'b via Gaussian elimination
    let mut aug = alloc::vec![0.0f64; n * (n + 1)];
    for i in 0..n {
        for j in 0..n {
            aug[i * (n + 1) + j] = ata[i * n + j];
        }
        aug[i * (n + 1) + n] = atb[i];
    }

    for k in 0..n {
        let mut max_val = libm::fabs(aug[k * (n + 1) + k]);
        let mut max_row = k;
        for i in (k + 1)..n {
            let v = libm::fabs(aug[i * (n + 1) + k]);
            if v > max_val {
                max_val = v;
                max_row = i;
            }
        }

        if max_val < 1e-14 {
            for i in 0..n {
                *x_ptr.add(i) = 0.0;
            }
            return f64::INFINITY;
        }

        if max_row != k {
            for j in 0..(n + 1) {
                let tmp = aug[k * (n + 1) + j];
                aug[k * (n + 1) + j] = aug[max_row * (n + 1) + j];
                aug[max_row * (n + 1) + j] = tmp;
            }
        }

        let pivot = aug[k * (n + 1) + k];
        for i in (k + 1)..n {
            let factor = aug[i * (n + 1) + k] / pivot;
            for j in (k + 1)..(n + 1) {
                aug[i * (n + 1) + j] -= factor * aug[k * (n + 1) + j];
            }
            aug[i * (n + 1) + k] = 0.0;
        }
    }

    let mut i = n as isize - 1;
    while i >= 0 {
        let iu = i as usize;
        let mut s = aug[iu * (n + 1) + n];
        for j in (iu + 1)..n {
            s -= aug[iu * (n + 1) + j] * *x_ptr.add(j);
        }
        let diag = aug[iu * (n + 1) + iu];
        *x_ptr.add(iu) = if libm::fabs(diag) > 1e-14 {
            s / diag
        } else {
            0.0
        };
        i -= 1;
    }

    // Compute residual ||Ax - b||
    let mut resid_sq = 0.0f64;
    for i in 0..m {
        let mut ax = 0.0f64;
        for j in 0..n {
            ax += *a_ptr.add(i * n + j) * *x_ptr.add(j);
        }
        let r = ax - *b_ptr.add(i);
        resid_sq += r * r;
    }
    libm::sqrt(resid_sq)
}

/// Single Levenberg-Marquardt step: solve (J'J + lambda*I) dp = -J'r.
///
/// * `j_ptr` - Pointer to Jacobian J (m x n, row-major)
/// * `r_ptr` - Pointer to residual vector r (m elements)
/// * `m` - Number of residuals
/// * `n` - Number of parameters
/// * `dp_ptr` - Output: parameter update dp (n elements)
/// * `lambda` - Damping factor
#[no_mangle]
pub unsafe extern "C" fn levenberg_marquardt_wasm(
    j_ptr: *const f64,
    r_ptr: *const f64,
    m: i32,
    n: i32,
    dp_ptr: *mut f64,
    lambda: f64,
) {
    let m = m as usize;
    let n = n as usize;

    // Compute J'J + lambda*I and -J'r
    let mut jtj = alloc::vec![0.0f64; n * n];
    let mut jtr = alloc::vec![0.0f64; n];

    for i in 0..n {
        for j in 0..n {
            let mut sum = 0.0f64;
            for k in 0..m {
                sum += *j_ptr.add(k * n + i) * *j_ptr.add(k * n + j);
            }
            jtj[i * n + j] = sum;
        }
        // Add damping to diagonal
        jtj[i * n + i] += lambda;

        // Compute -J'r
        let mut sum = 0.0f64;
        for k in 0..m {
            sum += *j_ptr.add(k * n + i) * *r_ptr.add(k);
        }
        jtr[i] = -sum;
    }

    // Solve (J'J + lambda*I) dp = -J'r
    let mut aug = alloc::vec![0.0f64; n * (n + 1)];
    for i in 0..n {
        for j in 0..n {
            aug[i * (n + 1) + j] = jtj[i * n + j];
        }
        aug[i * (n + 1) + n] = jtr[i];
    }

    for k in 0..n {
        let mut max_val = libm::fabs(aug[k * (n + 1) + k]);
        let mut max_row = k;
        for i in (k + 1)..n {
            let v = libm::fabs(aug[i * (n + 1) + k]);
            if v > max_val {
                max_val = v;
                max_row = i;
            }
        }

        if max_val < 1e-14 {
            for i in 0..n {
                *dp_ptr.add(i) = 0.0;
            }
            return;
        }

        if max_row != k {
            for j in 0..(n + 1) {
                let tmp = aug[k * (n + 1) + j];
                aug[k * (n + 1) + j] = aug[max_row * (n + 1) + j];
                aug[max_row * (n + 1) + j] = tmp;
            }
        }

        let pivot = aug[k * (n + 1) + k];
        for i in (k + 1)..n {
            let factor = aug[i * (n + 1) + k] / pivot;
            for j in (k + 1)..(n + 1) {
                aug[i * (n + 1) + j] -= factor * aug[k * (n + 1) + j];
            }
            aug[i * (n + 1) + k] = 0.0;
        }
    }

    let mut i = n as isize - 1;
    while i >= 0 {
        let iu = i as usize;
        let mut s = aug[iu * (n + 1) + n];
        for j in (iu + 1)..n {
            s -= aug[iu * (n + 1) + j] * *dp_ptr.add(j);
        }
        let diag = aug[iu * (n + 1) + iu];
        *dp_ptr.add(iu) = if libm::fabs(diag) > 1e-14 {
            s / diag
        } else {
            0.0
        };
        i -= 1;
    }
}

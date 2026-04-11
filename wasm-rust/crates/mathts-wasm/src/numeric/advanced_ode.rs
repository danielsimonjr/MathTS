//! Advanced ODE solvers: implicit Euler step for stiff systems, RK4 system step.

/// Single implicit Euler step for stiff ODE systems.
///
/// Solves: (I - h*J) * delta = h * f(y)
/// Then: y_next = y + delta
///
/// The caller pre-computes the Jacobian J and function values f(y).
///
/// * `y_ptr` - Current state vector (n elements)
/// * `f_ptr` - f(t, y) evaluated at current state (n elements)
/// * `j_ptr` - Jacobian df/dy (n x n, row-major)
/// * `h` - Step size
/// * `n` - System dimension
/// * `result_ptr` - Output: y at next step (n elements)
#[no_mangle]
pub unsafe extern "C" fn implicit_euler_step_wasm(
    y_ptr: *const f64,
    f_ptr: *const f64,
    j_ptr: *const f64,
    h: f64,
    n: i32,
    result_ptr: *mut f64,
) {
    let n = n as usize;
    if n == 0 {
        return;
    }

    // Build the system matrix A = I - h*J and right-hand side b = h*f
    let mut aug = alloc::vec![0.0f64; n * (n + 1)];

    for i in 0..n {
        for j in 0..n {
            let ij = i * n + j;
            let identity = if i == j { 1.0 } else { 0.0 };
            aug[i * (n + 1) + j] = identity - h * *j_ptr.add(ij);
        }
        aug[i * (n + 1) + n] = h * *f_ptr.add(i);
    }

    // Solve via Gaussian elimination with partial pivoting
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
            // Singular — fall back to explicit Euler
            for i in 0..n {
                *result_ptr.add(i) = *y_ptr.add(i) + h * *f_ptr.add(i);
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

    // Back substitution for delta
    let mut i = n as isize - 1;
    while i >= 0 {
        let iu = i as usize;
        let mut s = aug[iu * (n + 1) + n];
        for j in (iu + 1)..n {
            s -= aug[iu * (n + 1) + j] * *result_ptr.add(j);
        }
        *result_ptr.add(iu) = s / aug[iu * (n + 1) + iu];
        i -= 1;
    }

    // y_next = y + delta
    for i in 0..n {
        *result_ptr.add(i) = *y_ptr.add(i) + *result_ptr.add(i);
    }
}

/// RK4 step for ODE systems using pre-computed k vectors.
///
/// Computes: y_next = y + (h/6)(k1 + 2*k2 + 2*k3 + k4)
///
/// The caller pre-computes k1..k4 (each n elements) and packs them
/// contiguously: k_ptrs points to [k1_0..k1_{n-1}, k2_0..k2_{n-1}, ...].
///
/// * `y_ptr` - Current state vector (n elements)
/// * `k_ptrs` - Pointer to k1,k2,k3,k4 packed contiguously (4*n f64 values)
/// * `h` - Step size
/// * `n` - System dimension
/// * `result_ptr` - Output: y at next step (n elements)
#[no_mangle]
pub unsafe extern "C" fn ode_system_rk4_step_wasm(
    y_ptr: *const f64,
    k_ptrs: *const f64,
    h: f64,
    n: i32,
    result_ptr: *mut f64,
) {
    let n = n as usize;
    let h6 = h / 6.0;

    for i in 0..n {
        let k1 = *k_ptrs.add(i);
        let k2 = *k_ptrs.add(n + i);
        let k3 = *k_ptrs.add(2 * n + i);
        let k4 = *k_ptrs.add(3 * n + i);
        *result_ptr.add(i) = *y_ptr.add(i) + h6 * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
    }
}

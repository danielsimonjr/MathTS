//! Optimization kernels — linear programming (simplex), quadratic
//! programming (projected gradient), and null-space basis.
//!
//! Gap B. Allocation-free: all scratch is caller-provided (`*WorkSize`
//! helpers give the required lengths).

/// Scratch length (in `f64`s) for [`quadprog`].
#[no_mangle]
pub extern "C" fn quadprogWorkSize(n: i32) -> i32 {
    if n <= 0 {
        return 0;
    }
    2 * n
}

/// Quadratic programming: minimize `0.5 x^T H x + f^T x` s.t. `A x <= b`,
/// via projected gradient descent. Writes the solution `x` (length `n`)
/// into `out`; returns `n`, or `-1` for invalid input.
///
/// # Safety
/// `h_ptr` references `n*n`; `f_ptr`/`out_ptr` `n`; `a_ptr` `m*n`; `b_ptr`
/// `m`; `work_ptr` `quadprogWorkSize(n)`.
#[no_mangle]
pub unsafe extern "C" fn quadprog(
    h_ptr: *const f64,
    n: i32,
    f_ptr: *const f64,
    a_ptr: *const f64,
    m: i32,
    b_ptr: *const f64,
    out_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    let n = n as usize;
    let m = m.max(0) as usize;
    let h = core::slice::from_raw_parts(h_ptr, n * n);
    let f = core::slice::from_raw_parts(f_ptr, n);
    let a = core::slice::from_raw_parts(a_ptr, m * n);
    let b = core::slice::from_raw_parts(b_ptr, m);
    let x = core::slice::from_raw_parts_mut(out_ptr, n);
    let work = core::slice::from_raw_parts_mut(work_ptr, 2 * n);
    let (grad, x_new) = work.split_at_mut(n);

    for v in x.iter_mut() {
        *v = 0.0;
    }
    let lr = 0.01;
    for _ in 0..2000 {
        for i in 0..n {
            grad[i] = f[i];
            for j in 0..n {
                grad[i] += h[i * n + j] * x[j];
            }
        }
        for i in 0..n {
            x_new[i] = x[i] - lr * grad[i];
        }
        // Project onto each violated constraint.
        for c in 0..m {
            let mut ax = 0.0;
            for j in 0..n {
                ax += a[c * n + j] * x_new[j];
            }
            if ax > b[c] {
                let mut a_norm = 0.0;
                for j in 0..n {
                    a_norm += a[c * n + j] * a[c * n + j];
                }
                if a_norm > 1e-15 {
                    let scale = (ax - b[c]) / a_norm;
                    for j in 0..n {
                        x_new[j] -= scale * a[c * n + j];
                    }
                }
            }
        }
        let mut max_diff = 0.0;
        for i in 0..n {
            let d = libm::fabs(x_new[i] - x[i]);
            if d > max_diff {
                max_diff = d;
            }
        }
        x.copy_from_slice(x_new);
        if max_diff < 1e-10 {
            break;
        }
    }
    n as i32
}

/// Scratch length (in `f64`s) for [`linprog`] — the simplex tableau.
#[no_mangle]
pub extern "C" fn linprogWorkSize(n: i32, m: i32) -> i32 {
    if n <= 0 || m < 0 {
        return 0;
    }
    (m + 1) * (n + m + 1)
}

/// Linear programming: minimize `c^T x` s.t. `A x <= b`, `x >= 0`, via the
/// simplex method. Writes `x` (length `n`) into `out`; returns `n`, or `-1`
/// if the problem is unbounded.
///
/// # Safety
/// `c_ptr`/`out_ptr` reference `n`; `a_ptr` `m*n`; `b_ptr` `m`; `work_ptr`
/// `linprogWorkSize(n, m)`.
#[no_mangle]
pub unsafe extern "C" fn linprog(
    c_ptr: *const f64,
    n: i32,
    a_ptr: *const f64,
    b_ptr: *const f64,
    m: i32,
    out_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if n <= 0 || m < 0 {
        return -1;
    }
    let n = n as usize;
    let m = m as usize;
    let c = core::slice::from_raw_parts(c_ptr, n);
    let a = core::slice::from_raw_parts(a_ptr, m * n);
    let b = core::slice::from_raw_parts(b_ptr, m);

    let total = n + m; // structural + slack variables
    let cols = total + 1;
    let rows = m + 1;
    let t = core::slice::from_raw_parts_mut(work_ptr, rows * cols);
    for v in t.iter_mut() {
        *v = 0.0;
    }
    // Tableau: [A | I | b], objective row [c | 0 | 0].
    for i in 0..m {
        for j in 0..n {
            t[i * cols + j] = a[i * n + j];
        }
        t[i * cols + n + i] = 1.0;
        t[i * cols + total] = b[i];
    }
    for j in 0..n {
        t[m * cols + j] = c[j];
    }

    for _ in 0..1000 {
        // Entering variable: most negative objective entry.
        let mut pivot_col = usize::MAX;
        let mut min_val = -1e-10;
        for j in 0..total {
            if t[m * cols + j] < min_val {
                min_val = t[m * cols + j];
                pivot_col = j;
            }
        }
        if pivot_col == usize::MAX {
            break; // optimal
        }
        // Leaving variable: minimum ratio test.
        let mut pivot_row = usize::MAX;
        let mut min_ratio = f64::INFINITY;
        for i in 0..m {
            let col_val = t[i * cols + pivot_col];
            if col_val > 1e-10 {
                let ratio = t[i * cols + total] / col_val;
                if ratio < min_ratio {
                    min_ratio = ratio;
                    pivot_row = i;
                }
            }
        }
        if pivot_row == usize::MAX {
            return -1; // unbounded
        }
        let pv = t[pivot_row * cols + pivot_col];
        for j in 0..cols {
            t[pivot_row * cols + j] /= pv;
        }
        for i in 0..rows {
            if i == pivot_row {
                continue;
            }
            let factor = t[i * cols + pivot_col];
            for j in 0..cols {
                t[i * cols + j] -= factor * t[pivot_row * cols + j];
            }
        }
    }

    let x = core::slice::from_raw_parts_mut(out_ptr, n);
    for j in 0..n {
        let mut basic_row = usize::MAX;
        let mut is_basic = true;
        for i in 0..rows {
            if libm::fabs(t[i * cols + j] - 1.0) < 1e-10 {
                if basic_row != usize::MAX {
                    is_basic = false;
                    break;
                }
                basic_row = i;
            } else if libm::fabs(t[i * cols + j]) > 1e-10 {
                is_basic = false;
                break;
            }
        }
        x[j] = if is_basic && basic_row != usize::MAX {
            t[basic_row * cols + total]
        } else {
            0.0
        };
    }
    n as i32
}

/// Scratch length (in `f64`s) for [`nullspace`].
#[no_mangle]
pub extern "C" fn nullspaceWorkSize(m: i32, n: i32) -> i32 {
    if m <= 0 || n <= 0 {
        return 0;
    }
    m * n + n
}

/// Null-space basis of an `m x n` matrix `A`.
///
/// Writes up to `n` basis vectors (each length `n`, row-major) into `out`
/// and returns the count, or `-1` for invalid input. `out` must hold
/// `n * n` f64s; `work` must hold `nullspaceWorkSize(m, n)`.
///
/// # Safety
/// `a_ptr` references `m*n`; `out_ptr` `n*n`; `work_ptr` the work size.
#[no_mangle]
pub unsafe extern "C" fn nullspace(
    a_ptr: *const f64,
    m: i32,
    n: i32,
    out_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if m <= 0 || n <= 0 {
        return -1;
    }
    let m = m as usize;
    let n = n as usize;
    let a = core::slice::from_raw_parts(a_ptr, m * n);
    let work = core::slice::from_raw_parts_mut(work_ptr, m * n + n);
    let (mm, pcols) = work.split_at_mut(m * n);
    mm.copy_from_slice(a);

    // RREF, recording the pivot columns in order.
    let mut npiv = 0usize;
    let mut r = 0usize;
    for col in 0..n {
        if r >= m {
            break;
        }
        let mut max_row = r;
        let mut max_val = libm::fabs(mm[r * n + col]);
        for row in (r + 1)..m {
            let v = libm::fabs(mm[row * n + col]);
            if v > max_val {
                max_val = v;
                max_row = row;
            }
        }
        if max_val < 1e-10 {
            continue;
        }
        if max_row != r {
            for j in 0..n {
                mm.swap(r * n + j, max_row * n + j);
            }
        }
        let pivot = mm[r * n + col];
        for j in 0..n {
            mm[r * n + j] /= pivot;
        }
        for row in 0..m {
            if row != r && libm::fabs(mm[row * n + col]) > 1e-15 {
                let factor = mm[row * n + col];
                for j in 0..n {
                    mm[row * n + j] -= factor * mm[r * n + j];
                }
            }
        }
        pcols[npiv] = col as f64;
        npiv += 1;
        r += 1;
    }

    let out = core::slice::from_raw_parts_mut(out_ptr, n * n);
    let mut count = 0usize;
    for col in 0..n {
        let mut is_pivot = false;
        for k in 0..npiv {
            if pcols[k] as usize == col {
                is_pivot = true;
                break;
            }
        }
        if is_pivot {
            continue;
        }
        // Free column -> one basis vector.
        let base = count * n;
        for j in 0..n {
            out[base + j] = 0.0;
        }
        out[base + col] = 1.0;
        for i in 0..npiv {
            out[base + pcols[i] as usize] = -mm[i * n + col];
        }
        count += 1;
    }
    count as i32
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    #[test]
    fn quadprog_unconstrained() {
        // min 0.5 x^T I x + f^T x, f = [-2,-3] -> x = [2,3]
        let h = [1.0, 0.0, 0.0, 1.0];
        let f = [-2.0, -3.0];
        let a: [f64; 0] = [];
        let b: [f64; 0] = [];
        let mut out = [0.0f64; 2];
        let mut work = [0.0f64; 4];
        unsafe {
            quadprog(
                h.as_ptr(), 2, f.as_ptr(), a.as_ptr(), 0, b.as_ptr(),
                out.as_mut_ptr(), work.as_mut_ptr(),
            );
        }
        assert!((out[0] - 2.0).abs() < 1e-6, "x0 = {}", out[0]);
        assert!((out[1] - 3.0).abs() < 1e-6, "x1 = {}", out[1]);
    }

    #[test]
    fn quadprog_constrained() {
        // same objective, constraint x0 + x1 <= 3 -> projects to [1,2]
        let h = [1.0, 0.0, 0.0, 1.0];
        let f = [-2.0, -3.0];
        let a = [1.0, 1.0];
        let b = [3.0];
        let mut out = [0.0f64; 2];
        let mut work = [0.0f64; 4];
        unsafe {
            quadprog(
                h.as_ptr(), 2, f.as_ptr(), a.as_ptr(), 1, b.as_ptr(),
                out.as_mut_ptr(), work.as_mut_ptr(),
            );
        }
        assert!((out[0] - 1.0).abs() < 1e-4, "x0 = {}", out[0]);
        assert!((out[1] - 2.0).abs() < 1e-4, "x1 = {}", out[1]);
        assert!((out[0] + out[1] - 3.0).abs() < 1e-4);
    }

    #[test]
    fn linprog_optimum() {
        // minimize -3x - 2y  s.t. x+y<=4, x<=2, y<=3, x,y>=0
        // optimum at (2,2): objective -10
        let c = [-3.0, -2.0];
        let a = [1.0, 1.0, 1.0, 0.0, 0.0, 1.0];
        let b = [4.0, 2.0, 3.0];
        let mut out = [0.0f64; 2];
        let mut work = vec![0.0f64; linprogWorkSize(2, 3) as usize];
        unsafe {
            linprog(
                c.as_ptr(), 2, a.as_ptr(), b.as_ptr(), 3,
                out.as_mut_ptr(), work.as_mut_ptr(),
            );
        }
        let obj = c[0] * out[0] + c[1] * out[1];
        assert!((obj + 10.0).abs() < 1e-6, "objective = {obj}, x = {out:?}");
    }

    #[test]
    fn nullspace_basis() {
        // [[1,2,3],[4,5,6],[7,8,9]] has 1-D null space spanned by [1,-2,1]
        let a = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0];
        let mut out = [0.0f64; 9];
        let mut work = vec![0.0f64; nullspaceWorkSize(3, 3) as usize];
        let k = unsafe {
            nullspace(a.as_ptr(), 3, 3, out.as_mut_ptr(), work.as_mut_ptr())
        };
        assert_eq!(k, 1);
        // A * basis must be ~0
        for i in 0..3 {
            let mut s = 0.0;
            for j in 0..3 {
                s += a[i * 3 + j] * out[j];
            }
            assert!(s.abs() < 1e-9, "A*v row {i} = {s}");
        }
    }
}

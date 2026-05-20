//! Extra linear-algebra kernels — reduced row echelon form and the
//! characteristic polynomial (Faddeev-LeVerrier).
//!
//! Gap B. Allocation-free: `rowReduce` works in the output buffer;
//! `characteristicPolynomial` takes a caller scratch buffer.

/// Reduced row echelon form of an `m x n` matrix `a` (row-major).
///
/// Writes the RREF into `out` (same shape) and returns `m`, or `-1` for
/// invalid dimensions. Gauss-Jordan with partial pivoting.
///
/// # Safety
/// `a_ptr` and `out_ptr` must each reference `m * n` `f64`s.
#[no_mangle]
pub unsafe extern "C" fn rowReduce(
    a_ptr: *const f64,
    m: i32,
    n: i32,
    tol: f64,
    out_ptr: *mut f64,
) -> i32 {
    if m <= 0 || n <= 0 {
        return -1;
    }
    let m = m as usize;
    let n = n as usize;
    let a = core::slice::from_raw_parts(a_ptr, m * n);
    let out = core::slice::from_raw_parts_mut(out_ptr, m * n);
    out.copy_from_slice(a);

    let mut pivot_row = 0usize;
    for col in 0..n {
        if pivot_row >= m {
            break;
        }
        let mut max_row = pivot_row;
        let mut max_val = libm::fabs(out[pivot_row * n + col]);
        for row in (pivot_row + 1)..m {
            let v = libm::fabs(out[row * n + col]);
            if v > max_val {
                max_val = v;
                max_row = row;
            }
        }
        if max_val < tol {
            continue;
        }
        if max_row != pivot_row {
            for j in 0..n {
                out.swap(pivot_row * n + j, max_row * n + j);
            }
        }
        let scale = out[pivot_row * n + col];
        for j in col..n {
            out[pivot_row * n + j] /= scale;
        }
        for row in 0..m {
            if row == pivot_row {
                continue;
            }
            let factor = out[row * n + col];
            if libm::fabs(factor) < tol {
                continue;
            }
            for j in col..n {
                out[row * n + j] -= factor * out[pivot_row * n + j];
            }
        }
        pivot_row += 1;
    }
    for v in out.iter_mut() {
        if libm::fabs(*v) < tol {
            *v = 0.0;
        }
    }
    m as i32
}

/// Scratch length (in `f64`s) required by [`characteristicPolynomial`].
#[no_mangle]
pub extern "C" fn charPolyWorkSize(n: i32) -> i32 {
    if n <= 0 {
        return 0;
    }
    3 * n * n
}

/// Characteristic polynomial of an `n x n` matrix via Faddeev-LeVerrier.
///
/// Writes `n + 1` coefficients (constant term first, monic) into `out`,
/// and returns `n + 1`. `work` must hold `charPolyWorkSize(n)` f64s.
///
/// # Safety
/// `a_ptr` references `n*n` f64s; `out_ptr` `n+1`; `work_ptr` `3*n*n`.
#[no_mangle]
pub unsafe extern "C" fn characteristicPolynomial(
    a_ptr: *const f64,
    n: i32,
    out_ptr: *mut f64,
    work_ptr: *mut f64,
) -> i32 {
    if n <= 0 {
        return -1;
    }
    let n = n as usize;
    let a = core::slice::from_raw_parts(a_ptr, n * n);
    let out = core::slice::from_raw_parts_mut(out_ptr, n + 1);
    let work = core::slice::from_raw_parts_mut(work_ptr, 3 * n * n);
    let (m_buf, rest) = work.split_at_mut(n * n);
    let (shifted, prod) = rest.split_at_mut(n * n);

    for c in out.iter_mut() {
        *c = 0.0;
    }
    out[n] = 1.0; // monic leading coefficient
    m_buf.copy_from_slice(a); // M_1 = A

    for k in 1..=n {
        let mut tr = 0.0;
        for i in 0..n {
            tr += m_buf[i * n + i];
        }
        let coeff = -tr / k as f64;
        out[n - k] = coeff;

        if k < n {
            // shifted = M + coeff * I
            shifted.copy_from_slice(m_buf);
            for i in 0..n {
                shifted[i * n + i] += coeff;
            }
            // prod = A * shifted
            for i in 0..n {
                for j in 0..n {
                    let mut s = 0.0;
                    for t in 0..n {
                        s += a[i * n + t] * shifted[t * n + j];
                    }
                    prod[i * n + j] = s;
                }
            }
            m_buf.copy_from_slice(prod);
        }
    }
    (n + 1) as i32
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloc::vec;

    fn rref(a: &[f64], m: usize, n: usize) -> alloc::vec::Vec<f64> {
        let mut out = vec![0.0f64; m * n];
        unsafe {
            rowReduce(a.as_ptr(), m as i32, n as i32, 1e-10, out.as_mut_ptr());
        }
        out
    }

    fn charpoly(a: &[f64], n: usize) -> alloc::vec::Vec<f64> {
        let mut out = vec![0.0f64; n + 1];
        let mut work = vec![0.0f64; 3 * n * n];
        unsafe {
            characteristicPolynomial(
                a.as_ptr(),
                n as i32,
                out.as_mut_ptr(),
                work.as_mut_ptr(),
            );
        }
        out
    }

    fn approx(a: &[f64], b: &[f64]) -> bool {
        a.len() == b.len() && a.iter().zip(b).all(|(x, y)| (x - y).abs() < 1e-9)
    }

    #[test]
    fn rref_basic() {
        // [[1,2,3],[4,5,6],[7,8,9]] -> [[1,0,-1],[0,1,2],[0,0,0]]
        let a = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0];
        assert!(approx(
            &rref(&a, 3, 3),
            &[1.0, 0.0, -1.0, 0.0, 1.0, 2.0, 0.0, 0.0, 0.0]
        ));
    }

    #[test]
    fn rref_rank_deficient_and_identity() {
        // [[1,2],[2,4]] -> [[1,2],[0,0]]
        assert!(approx(
            &rref(&[1.0, 2.0, 2.0, 4.0], 2, 2),
            &[1.0, 2.0, 0.0, 0.0]
        ));
        // [[2,4],[1,1]] -> identity
        assert!(approx(
            &rref(&[2.0, 4.0, 1.0, 1.0], 2, 2),
            &[1.0, 0.0, 0.0, 1.0]
        ));
    }

    #[test]
    fn charpoly_diagonal() {
        // diag(2,3): (l-2)(l-3) = l^2 - 5l + 6 -> [6, -5, 1]
        assert!(approx(
            &charpoly(&[2.0, 0.0, 0.0, 3.0], 2),
            &[6.0, -5.0, 1.0]
        ));
    }

    #[test]
    fn charpoly_companion() {
        // [[0,1],[-2,-3]]: l^2 + 3l + 2 -> [2, 3, 1]
        assert!(approx(
            &charpoly(&[0.0, 1.0, -2.0, -3.0], 2),
            &[2.0, 3.0, 1.0]
        ));
    }

    #[test]
    fn charpoly_3x3_identity() {
        // I_3: (l-1)^3 = l^3 - 3l^2 + 3l - 1 -> [-1, 3, -3, 1]
        let i3 = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0];
        assert!(approx(&charpoly(&i3, 3), &[-1.0, 3.0, -3.0, 1.0]));
    }
}

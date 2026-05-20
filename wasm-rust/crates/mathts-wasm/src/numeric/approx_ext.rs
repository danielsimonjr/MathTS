//! Rational approximation — partial-fraction residues and Padé approximants.
//!
//! Gap B. Like `algebra/polynomial_ext.rs`, these use internal heap
//! allocation for working arrays; only final results go to caller buffers.

use core::f64::consts::PI;
use alloc::vec;
use alloc::vec::Vec;

/// Horner evaluation of a polynomial (coefficients, constant term first).
fn eval_poly(c: &[f64], x: f64) -> f64 {
    let mut s = 0.0;
    let mut i = c.len();
    while i > 0 {
        i -= 1;
        s = s * x + c[i];
    }
    s
}

/// Horner evaluation of a polynomial's derivative.
fn eval_poly_deriv(c: &[f64], x: f64) -> f64 {
    let mut s = 0.0;
    let mut i = c.len();
    while i > 1 {
        i -= 1;
        s = s * x + i as f64 * c[i];
    }
    s
}

/// Real roots of a polynomial via the Durand-Kerner method.
fn poly_roots(coeffs: &[f64]) -> Vec<f64> {
    if coeffs.len() < 2 {
        return Vec::new();
    }
    let n = coeffs.len() - 1;
    let lc = coeffs[n];
    let c: Vec<f64> = coeffs.iter().map(|&v| v / lc).collect();

    let mut re = vec![0.0f64; n];
    let mut im = vec![0.0f64; n];
    for i in 0..n {
        let angle = 2.0 * PI * i as f64 / n as f64 + 0.4;
        re[i] = 0.4 * libm::cos(angle);
        im[i] = 0.4 * libm::sin(angle);
    }

    for _ in 0..100 {
        for i in 0..n {
            // Evaluate p at root i (complex Horner).
            let mut p_re = c[n];
            let mut p_im = 0.0;
            let mut j = n;
            while j > 0 {
                j -= 1;
                let nr = p_re * re[i] - p_im * im[i] + c[j];
                let ni = p_re * im[i] + p_im * re[i];
                p_re = nr;
                p_im = ni;
            }
            // Product of (root_i - root_j) for j != i.
            let mut d_re = 1.0;
            let mut d_im = 0.0;
            for j in 0..n {
                if i == j {
                    continue;
                }
                let diff_re = re[i] - re[j];
                let diff_im = im[i] - im[j];
                let nr = d_re * diff_re - d_im * diff_im;
                let ni = d_re * diff_im + d_im * diff_re;
                d_re = nr;
                d_im = ni;
            }
            let denom = d_re * d_re + d_im * d_im;
            if denom > 1e-30 {
                re[i] -= (p_re * d_re + p_im * d_im) / denom;
                im[i] -= (p_im * d_re - p_re * d_im) / denom;
            }
        }
    }

    let mut out = Vec::new();
    for i in 0..n {
        if libm::fabs(im[i]) < 1e-8 {
            out.push(re[i]);
        }
    }
    out
}

/// Solve `A x = b` (`A` is `n x n` row-major) via Gaussian elimination.
fn linsolve(a: &[f64], n: usize, b: &[f64]) -> Option<Vec<f64>> {
    let w = n + 1;
    let mut m = vec![0.0f64; n * w];
    for i in 0..n {
        for j in 0..n {
            m[i * w + j] = a[i * n + j];
        }
        m[i * w + n] = b[i];
    }
    for col in 0..n {
        let mut max_row = col;
        let mut max_val = libm::fabs(m[col * w + col]);
        for row in (col + 1)..n {
            let v = libm::fabs(m[row * w + col]);
            if v > max_val {
                max_val = v;
                max_row = row;
            }
        }
        if max_val < 1e-15 {
            return None;
        }
        if max_row != col {
            for j in 0..w {
                m.swap(col * w + j, max_row * w + j);
            }
        }
        for row in (col + 1)..n {
            let factor = m[row * w + col] / m[col * w + col];
            for j in col..w {
                m[row * w + j] -= factor * m[col * w + j];
            }
        }
    }
    let mut x = vec![0.0f64; n];
    let mut i = n;
    while i > 0 {
        i -= 1;
        let mut s = m[i * w + n];
        for j in (i + 1)..n {
            s -= m[i * w + j] * x[j];
        }
        x[i] = s / m[i * w + i];
    }
    Some(x)
}

/// Partial-fraction residues of `P(x)/Q(x)` at the real roots of `Q`.
///
/// Writes the residues and poles into the two output buffers and returns
/// the count (number of real roots of `Q`), or `-1` for invalid input.
/// Each buffer must hold `q_len - 1` f64s.
///
/// # Safety
/// `p_ptr`/`q_ptr` reference `p_len`/`q_len` f64s; the two output buffers
/// each `q_len - 1`.
#[no_mangle]
pub unsafe extern "C" fn residue(
    p_ptr: *const f64,
    p_len: i32,
    q_ptr: *const f64,
    q_len: i32,
    residues_out: *mut f64,
    poles_out: *mut f64,
) -> i32 {
    if p_len <= 0 || q_len <= 1 {
        return -1;
    }
    let p = core::slice::from_raw_parts(p_ptr, p_len as usize);
    let q = core::slice::from_raw_parts(q_ptr, q_len as usize);
    let poles = poly_roots(q);
    for (k, &pole) in poles.iter().enumerate() {
        *poles_out.add(k) = pole;
        *residues_out.add(k) = eval_poly(p, pole) / eval_poly_deriv(q, pole);
    }
    poles.len() as i32
}

/// Padé approximant `[m/n]` from Taylor coefficients `c`.
///
/// Writes the numerator (`m + 1` coefficients) and denominator (`n + 1`
/// coefficients, monic constant term) into the two buffers; returns `0`,
/// or `-1` for invalid input.
///
/// # Safety
/// `c_ptr` references `c_len` f64s; `num_out` `m + 1`; `den_out` `n + 1`.
#[no_mangle]
pub unsafe extern "C" fn padeApproximant(
    c_ptr: *const f64,
    c_len: i32,
    m: i32,
    n: i32,
    num_out: *mut f64,
    den_out: *mut f64,
) -> i32 {
    if m < 0 || n < 0 || c_len < 0 {
        return -1;
    }
    let m = m as usize;
    let n = n as usize;
    let mut c: Vec<f64> =
        core::slice::from_raw_parts(c_ptr, c_len as usize).to_vec();
    while c.len() < m + n + 1 {
        c.push(0.0);
    }

    if n > 0 {
        let mut a = vec![0.0f64; n * n];
        let mut rhs = vec![0.0f64; n];
        for i in 1..=n {
            for j in 1..=n {
                let idx = m as i64 + i as i64 - j as i64;
                a[(i - 1) * n + (j - 1)] =
                    if idx >= 0 && (idx as usize) < c.len() {
                        c[idx as usize]
                    } else {
                        0.0
                    };
            }
            rhs[i - 1] = -c[m + i];
        }
        let b = linsolve(&a, n, &rhs).unwrap_or_else(|| vec![0.0f64; n]);
        *den_out = 1.0;
        for j in 0..n {
            *den_out.add(j + 1) = b[j];
        }
        for i in 0..=m {
            let mut s = c[i];
            let jmax = if i < n { i } else { n };
            for j in 1..=jmax {
                s += b[j - 1] * c[i - j];
            }
            *num_out.add(i) = s;
        }
    } else {
        for i in 0..=m {
            *num_out.add(i) = c[i];
        }
        *den_out = 1.0;
    }
    0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn residue_simple_poles() {
        // 1 / (x^2 - 1): poles +/-1, residues +/-0.5
        let p = [1.0];
        let q = [-1.0, 0.0, 1.0];
        let mut residues = [0.0f64; 2];
        let mut poles = [0.0f64; 2];
        let k = unsafe {
            residue(
                p.as_ptr(), 1, q.as_ptr(), 3,
                residues.as_mut_ptr(), poles.as_mut_ptr(),
            )
        };
        assert_eq!(k, 2);
        for idx in 0..2 {
            let pole = poles[idx];
            assert!(
                (pole - 1.0).abs() < 1e-6 || (pole + 1.0).abs() < 1e-6,
                "pole = {pole}"
            );
            // residue of 1/(x^2-1) at pole is 1/(2*pole)
            assert!((residues[idx] - 1.0 / (2.0 * pole)).abs() < 1e-6);
        }
    }

    #[test]
    fn pade_of_exp() {
        // Taylor of e^x; Pade[1/1] = (1 + x/2) / (1 - x/2)
        let c = [1.0, 1.0, 0.5, 1.0 / 6.0, 1.0 / 24.0];
        let mut num = [0.0f64; 2];
        let mut den = [0.0f64; 2];
        let r = unsafe {
            padeApproximant(
                c.as_ptr(), 5, 1, 1, num.as_mut_ptr(), den.as_mut_ptr(),
            )
        };
        assert_eq!(r, 0);
        assert!((num[0] - 1.0).abs() < 1e-12);
        assert!((num[1] - 0.5).abs() < 1e-12);
        assert!((den[0] - 1.0).abs() < 1e-12);
        assert!((den[1] + 0.5).abs() < 1e-12);
    }

    #[test]
    fn pade_zero_denominator_degree() {
        // n = 0 -> num is the truncated series, den = [1]
        let c = [2.0, 3.0, 4.0, 5.0];
        let mut num = [0.0f64; 3];
        let mut den = [0.0f64; 1];
        unsafe {
            padeApproximant(
                c.as_ptr(), 4, 2, 0, num.as_mut_ptr(), den.as_mut_ptr(),
            );
        }
        assert_eq!(num, [2.0, 3.0, 4.0]);
        assert_eq!(den, [1.0]);
    }
}

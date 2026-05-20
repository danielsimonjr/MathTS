//! Polynomial algebra — add, GCD/LCM, division, discriminant, resultant.
//!
//! Gap B: these were absent from the crate (`algebra/polynomial.rs` had only
//! eval / multiply / derivative / root-finding). Polynomials are coefficient
//! arrays, constant term first (`index = power`).
//!
//! Like the crate's `numeric/analysis.rs`, these use internal heap allocation
//! for working polynomials; only the final result is written to the
//! caller-provided `out` buffer.

use alloc::vec;
use alloc::vec::Vec;

/// Trim trailing (high-degree) zero coefficients, keeping at least one.
fn trim(c: &[f64]) -> Vec<f64> {
    if c.is_empty() {
        return vec![0.0];
    }
    let mut end = c.len() - 1;
    while end > 0 && c[end] == 0.0 {
        end -= 1;
    }
    c[..=end].to_vec()
}

/// Polynomial long division — returns `(quotient, remainder)`, both trimmed.
fn poly_divmod(a: &[f64], b: &[f64]) -> (Vec<f64>, Vec<f64>) {
    let at = trim(a);
    let bt = trim(b);
    if bt.len() == 1 && bt[0] == 0.0 {
        return (vec![f64::NAN], vec![f64::NAN]); // division by zero polynomial
    }
    if at.len() < bt.len() {
        return (vec![0.0], at);
    }
    let mut remainder = at.clone();
    let q_len = at.len() - bt.len() + 1;
    let mut quotient = vec![0.0f64; q_len];
    let bl = bt.len();
    let mut i = q_len;
    while i > 0 {
        i -= 1;
        quotient[i] = remainder[i + bl - 1] / bt[bl - 1];
        for j in 0..bl {
            remainder[i + j] -= quotient[i] * bt[j];
        }
    }
    let rem = if bl >= 2 {
        trim(&remainder[..bl - 1])
    } else {
        vec![0.0]
    };
    (trim(&quotient), rem)
}

fn poly_mul(a: &[f64], b: &[f64]) -> Vec<f64> {
    if a.is_empty() || b.is_empty() {
        return vec![0.0];
    }
    let mut out = vec![0.0f64; a.len() + b.len() - 1];
    for i in 0..a.len() {
        for j in 0..b.len() {
            out[i + j] += a[i] * b[j];
        }
    }
    trim(&out)
}

fn poly_derivative(c: &[f64]) -> Vec<f64> {
    if c.len() <= 1 {
        return vec![0.0];
    }
    let mut out = vec![0.0f64; c.len() - 1];
    for i in 1..c.len() {
        out[i - 1] = c[i] * i as f64;
    }
    out
}

/// Determinant of a row-major `n x n` matrix via Gaussian elimination.
fn determinant(mut m: Vec<f64>, n: usize) -> f64 {
    let mut det = 1.0;
    for col in 0..n {
        let mut max_row = col;
        let mut max_val = libm::fabs(m[col * n + col]);
        for row in (col + 1)..n {
            let v = libm::fabs(m[row * n + col]);
            if v > max_val {
                max_val = v;
                max_row = row;
            }
        }
        if max_val < 1e-15 {
            return 0.0;
        }
        if max_row != col {
            for k in 0..n {
                m.swap(col * n + k, max_row * n + k);
            }
            det = -det;
        }
        det *= m[col * n + col];
        for row in (col + 1)..n {
            let factor = m[row * n + col] / m[col * n + col];
            for k in col..n {
                m[row * n + k] -= factor * m[col * n + k];
            }
        }
    }
    det
}

fn make_monic(p: &mut [f64]) {
    let leading = p[p.len() - 1];
    if leading != 0.0 && leading != 1.0 {
        for c in p.iter_mut() {
            *c /= leading;
        }
    }
}

fn poly_gcd(a: &[f64], b: &[f64]) -> Vec<f64> {
    let mut r0 = trim(a);
    let mut r1 = trim(b);
    while r1.len() > 1 || r1[0] != 0.0 {
        let (_, rem) = poly_divmod(&r0, &r1);
        r0 = r1;
        r1 = rem;
    }
    make_monic(&mut r0);
    r0
}

fn resultant_value(p: &[f64], q: &[f64]) -> f64 {
    let pt = trim(p);
    let qt = trim(q);
    let m = pt.len() - 1;
    let n = qt.len() - 1;
    if m == 0 && n == 0 {
        return 1.0;
    }
    if m == 0 {
        return libm::pow(pt[0], n as f64);
    }
    if n == 0 {
        return libm::pow(qt[0], m as f64);
    }
    let size = m + n;
    let mut mat = vec![0.0f64; size * size];
    for i in 0..n {
        for j in 0..=m {
            mat[i * size + (i + j)] = pt[m - j];
        }
    }
    for i in 0..m {
        for j in 0..=n {
            mat[(n + i) * size + (i + j)] = qt[n - j];
        }
    }
    determinant(mat, size)
}

unsafe fn read(ptr: *const f64, len: i32) -> Vec<f64> {
    core::slice::from_raw_parts(ptr, len.max(0) as usize).to_vec()
}

unsafe fn write_out(out: *mut f64, data: &[f64]) -> i32 {
    for (i, &v) in data.iter().enumerate() {
        *out.add(i) = v;
    }
    data.len() as i32
}

/// Add polynomials `a + b`. `out` must hold `max(a_len, b_len)` f64s.
///
/// # Safety
/// Pointers must reference the stated lengths of valid `f64`s.
#[no_mangle]
pub unsafe extern "C" fn polyadd(
    a_ptr: *const f64,
    a_len: i32,
    b_ptr: *const f64,
    b_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let a = read(a_ptr, a_len);
    let b = read(b_ptr, b_len);
    let len = a.len().max(b.len());
    let mut sum = vec![0.0f64; len.max(1)];
    for i in 0..len {
        sum[i] = a.get(i).copied().unwrap_or(0.0) + b.get(i).copied().unwrap_or(0.0);
    }
    write_out(out_ptr, &trim(&sum))
}

/// Quotient of polynomial division `a / b`. `out` must hold `a_len` f64s.
///
/// # Safety
/// See [`polyadd`].
#[no_mangle]
pub unsafe extern "C" fn polynomialQuotient(
    a_ptr: *const f64,
    a_len: i32,
    b_ptr: *const f64,
    b_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let (q, _) = poly_divmod(&read(a_ptr, a_len), &read(b_ptr, b_len));
    write_out(out_ptr, &q)
}

/// Remainder of polynomial division `a / b`. `out` must hold `a_len` f64s.
///
/// # Safety
/// See [`polyadd`].
#[no_mangle]
pub unsafe extern "C" fn polynomialRemainder(
    a_ptr: *const f64,
    a_len: i32,
    b_ptr: *const f64,
    b_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let (_, r) = poly_divmod(&read(a_ptr, a_len), &read(b_ptr, b_len));
    write_out(out_ptr, &r)
}

/// Monic GCD of polynomials `a` and `b`. `out` must hold `max(a_len, b_len)`.
///
/// # Safety
/// See [`polyadd`].
#[no_mangle]
pub unsafe extern "C" fn polynomialGCD(
    a_ptr: *const f64,
    a_len: i32,
    b_ptr: *const f64,
    b_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let g = poly_gcd(&read(a_ptr, a_len), &read(b_ptr, b_len));
    write_out(out_ptr, &g)
}

/// Monic LCM of polynomials `a` and `b`. `out` must hold `a_len + b_len`.
///
/// # Safety
/// See [`polyadd`].
#[no_mangle]
pub unsafe extern "C" fn polynomialLCM(
    a_ptr: *const f64,
    a_len: i32,
    b_ptr: *const f64,
    b_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let a = read(a_ptr, a_len);
    let b = read(b_ptr, b_len);
    let g = poly_gcd(&a, &b);
    let (mut q, _) = poly_divmod(&poly_mul(&a, &b), &g);
    make_monic(&mut q);
    write_out(out_ptr, &q)
}

/// Discriminant of a polynomial of degree `>= 1`.
///
/// # Safety
/// `c_ptr` must reference `len` valid `f64`s.
#[no_mangle]
pub unsafe extern "C" fn discriminant(c_ptr: *const f64, len: i32) -> f64 {
    let t = trim(&read(c_ptr, len));
    let deg = t.len() - 1;
    if deg < 1 {
        return f64::NAN;
    }
    if deg == 1 {
        return 1.0;
    }
    if deg == 2 {
        let (c, b, a) = (t[0], t[1], t[2]);
        return b * b - 4.0 * a * c;
    }
    if deg == 3 {
        let (d, c, b, a) = (t[0], t[1], t[2], t[3]);
        return 18.0 * a * b * c * d - 4.0 * b * b * b * d + b * b * c * c
            - 4.0 * a * c * c * c
            - 27.0 * a * a * d * d;
    }
    // deg >= 4: disc(f) = (-1)^(n(n-1)/2) / a_n * resultant(f, f')
    let fp = poly_derivative(&t);
    let res = resultant_value(&t, &fp);
    let an = t[t.len() - 1];
    let sign = if ((deg * (deg - 1)) / 2) % 2 == 0 {
        1.0
    } else {
        -1.0
    };
    sign * res / an
}

/// Resultant of two polynomials (Sylvester-matrix determinant).
///
/// # Safety
/// Pointers must reference the stated lengths of valid `f64`s.
#[no_mangle]
pub unsafe extern "C" fn resultant(
    p_ptr: *const f64,
    p_len: i32,
    q_ptr: *const f64,
    q_len: i32,
) -> f64 {
    resultant_value(&read(p_ptr, p_len), &read(q_ptr, q_len))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call5(
        f: unsafe extern "C" fn(*const f64, i32, *const f64, i32, *mut f64) -> i32,
        a: &[f64],
        b: &[f64],
    ) -> Vec<f64> {
        let mut out = vec![0.0f64; a.len() + b.len() + 4];
        let n = unsafe {
            f(a.as_ptr(), a.len() as i32, b.as_ptr(), b.len() as i32, out.as_mut_ptr())
        };
        out[..n as usize].to_vec()
    }

    #[test]
    fn add() {
        assert_eq!(call5(polyadd, &[1.0, 2.0], &[3.0, 4.0, 5.0]), vec![4.0, 6.0, 5.0]);
    }

    #[test]
    fn quotient_remainder() {
        // (x^2 - 1) / (x - 1) = x + 1, remainder 0
        assert_eq!(
            call5(polynomialQuotient, &[-1.0, 0.0, 1.0], &[-1.0, 1.0]),
            vec![1.0, 1.0]
        );
        assert_eq!(
            call5(polynomialRemainder, &[-1.0, 0.0, 1.0], &[-1.0, 1.0]),
            vec![0.0]
        );
        // (x^2 + 1) / (x - 1) = x + 1, remainder 2
        assert_eq!(
            call5(polynomialRemainder, &[1.0, 0.0, 1.0], &[-1.0, 1.0]),
            vec![2.0]
        );
    }

    #[test]
    fn gcd_lcm() {
        // gcd(x^2-1, x-1) = x-1
        assert_eq!(
            call5(polynomialGCD, &[-1.0, 0.0, 1.0], &[-1.0, 1.0]),
            vec![-1.0, 1.0]
        );
        // lcm(x-1, x-2) = (x-1)(x-2) = x^2 - 3x + 2
        let lcm = call5(polynomialLCM, &[-1.0, 1.0], &[-2.0, 1.0]);
        assert_eq!(lcm.len(), 3);
        assert!((lcm[0] - 2.0).abs() < 1e-9);
        assert!((lcm[1] + 3.0).abs() < 1e-9);
        assert!((lcm[2] - 1.0).abs() < 1e-9);
    }

    #[test]
    fn discriminant_values() {
        // x^2 - 4 -> 16
        assert!((unsafe { discriminant([-4.0, 0.0, 1.0].as_ptr(), 3) } - 16.0).abs() < 1e-9);
        // x^2 - 3x + 2 -> 1
        assert!((unsafe { discriminant([2.0, -3.0, 1.0].as_ptr(), 3) } - 1.0).abs() < 1e-9);
        // x^3 - 1 -> -27
        assert!(
            (unsafe { discriminant([-1.0, 0.0, 0.0, 1.0].as_ptr(), 4) } + 27.0).abs() < 1e-7
        );
    }

    #[test]
    fn resultant_values() {
        // x^2-1 and x-1 share root x=1 -> resultant 0
        let r0 = unsafe {
            resultant([-1.0, 0.0, 1.0].as_ptr(), 3, [-1.0, 1.0].as_ptr(), 2)
        };
        assert!(r0.abs() < 1e-9, "r0 = {r0}");
        // x-2 and x-3: Sylvester det = -1
        let r1 = unsafe { resultant([-2.0, 1.0].as_ptr(), 2, [-3.0, 1.0].as_ptr(), 2) };
        assert!((r1 + 1.0).abs() < 1e-9, "r1 = {r1}");
    }
}

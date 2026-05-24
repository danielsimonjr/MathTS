//! Polynomial hot-loop kernels for the typed-layer WASM bridge.
//!
//! Polynomials are coefficient arrays where index = power, i.e.
//! `p(x) = coeffs[0] + coeffs[1]*x + coeffs[2]*x^2 + ...`
//!
//! Four kernels are exported:
//!
//! * `poly_mul_f64(a, b)` — O(n·m) convolution, returns the product.
//! * `poly_div_mod_f64(num, den)` — polynomial long division.
//!   Returns a concatenated flat array `[quotient | remainder]`.
//!   The caller slices it using the length rule:
//!     quotient_len  = max(0, num.len() - den.len() + 1)
//!     remainder_len = result.len() - quotient_len
//! * `poly_resultant_f64(p, q)` — Sylvester-matrix determinant.
//! * `poly_discriminant_f64(p)` — disc(p) = (-1)^(m(m-1)/2) / a_m · Res(p, p').
//!
//! All exported symbols use `#[no_mangle] pub unsafe extern "C"` and
//! pointer-style arguments to stay consistent with the rest of the crate.

use alloc::vec;
use alloc::vec::Vec;

// ============================================================
// INTERNAL QR FACTORISATION (Householder, inlined)
// Used by poly_fit_f64 / cheb_fit_f64 / legendre_fit_f64.
// ============================================================

/// Thin Householder QR of a row-major `m × k` matrix stored in `a`
/// (modified in-place to contain R in its upper triangle and the
/// Householder reflectors in the lower triangle).
///
/// `q_times_b` accumulates Q^T · b using the stored reflectors
/// and returns the length-`k` result in `qtb`.
///
/// Returns `true` on success, `false` when the matrix is rank-deficient
/// (diagonal of R drops below `tol`).
unsafe fn householder_qr_solve(
    a: &mut [f64],
    m: usize,
    k: usize,
    b: &[f64],
    qtb: &mut [f64],
    tol: f64,
) -> bool {
    // qtb = b (we will apply reflectors to it)
    for i in 0..m {
        qtb[i] = b[i];
    }

    for col in 0..k {
        // --- compute Householder reflector for column `col` ---
        // v = a[col..m, col]
        let mut norm2: f64 = 0.0;
        for row in col..m {
            let v = a[row * k + col];
            norm2 += v * v;
        }
        let norm = libm::sqrt(norm2);
        if norm < tol {
            return false; // rank-deficient
        }

        // Choose sign to avoid cancellation
        let sign = if a[col * k + col] >= 0.0 { 1.0 } else { -1.0 };
        let u1 = a[col * k + col] + sign * norm;
        // tau = 2 / (v^T v) where v[0] = u1, v[j] = a[(col+j)*k+col]
        let mut vtv: f64 = u1 * u1;
        for row in (col + 1)..m {
            vtv += a[row * k + col] * a[row * k + col];
        }
        let tau = 2.0 / vtv;

        // Apply H = I - tau * v * v^T to columns col..k of A
        // v[0] = u1, v[j] = a[(col+j)*k+col] for j>=1
        for c in col..k {
            let mut dot: f64 = u1 * a[col * k + c];
            for row in (col + 1)..m {
                dot += a[row * k + col] * a[row * k + c];
            }
            dot *= tau;
            a[col * k + c] -= u1 * dot;
            for row in (col + 1)..m {
                a[row * k + c] -= a[row * k + col] * dot;
            }
        }

        // Apply H to qtb[col..m]
        {
            let mut dot: f64 = u1 * qtb[col];
            for row in (col + 1)..m {
                dot += a[row * k + col] * qtb[row];
            }
            dot *= tau;
            qtb[col] -= u1 * dot;
            for row in (col + 1)..m {
                qtb[row] -= a[row * k + col] * dot;
            }
        }

        // Store u1 in a[col*k+col] for book-keeping (R will be built next)
        // Overwrite lower part with u1/normalised reflector (we no longer need it)
        // Actually we already have R in the upper triangle; just clear sub-diagonal.
        a[col * k + col] = -sign * norm; // R[col,col]
        for row in (col + 1)..m {
            a[row * k + col] = 0.0; // clear sub-diagonal (already used above)
        }
    }

    // Back-substitution: solve R * x = qtb[0..k]
    for i in (0..k).rev() {
        let mut s = qtb[i];
        for j in (i + 1)..k {
            s -= a[i * k + j] * qtb[j];
        }
        let r_ii = a[i * k + i];
        if libm::fabs(r_ii) < tol {
            return false;
        }
        qtb[i] = s / r_ii;
    }
    true
}

// ============================================================
// POLY_VANDERMONDE_F64 — build Vandermonde matrix (x^k basis)
// ============================================================

// ============================================================
// POLYNOMIAL MULTIPLICATION  (O(n · m) convolution)
// ============================================================

/// Multiply two polynomials `a` and `b`.
///
/// Returns a freshly allocated `Vec<f64>` of length
/// `a.len() + b.len() - 1` (or a single-element `[0.0]` if either
/// operand is empty).
///
/// # Safety
/// `a_ptr` / `b_ptr` must point to valid, aligned `f64` slices of
/// lengths `a_len` and `b_len` respectively that live for the
/// duration of this call.  `out_ptr` must point to a writable
/// `f64` buffer of at least `out_len` elements.
#[no_mangle]
pub unsafe extern "C" fn poly_mul_f64(
    a_ptr: *const f64,
    a_len: i32,
    b_ptr: *const f64,
    b_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let a_len = a_len as usize;
    let b_len = b_len as usize;

    if a_len == 0 || b_len == 0 {
        *out_ptr = 0.0;
        return 1;
    }

    let out_len = a_len + b_len - 1;

    // Zero-initialise the output slice.
    for i in 0..out_len {
        *out_ptr.add(i) = 0.0;
    }

    for i in 0..a_len {
        let ai = *a_ptr.add(i);
        for j in 0..b_len {
            let bj = *b_ptr.add(j);
            *out_ptr.add(i + j) += ai * bj;
        }
    }

    out_len as i32
}

// ============================================================
// POLYNOMIAL LONG DIVISION  (returns concatenated quot ‖ rem)
// ============================================================

/// Divide polynomial `num` by `den` using synthetic long division.
///
/// The result is packed into `out_ptr` as:
///
/// ```text
/// [ quotient (q_len elements) | remainder (r_len elements) ]
/// ```
///
/// where:
/// * `q_len = max(0, num_len - den_len + 1)`  when `den_len <= num_len`
/// * `q_len = 0`                              when `den_len > num_len`
/// * `r_len = min(den_len - 1, num_len)`      (trimming handled by caller)
///
/// The function returns the *total* number of f64 values written to
/// `out_ptr`, i.e. `q_len + r_len`. Returns `0` if `den_len == 0`
/// (division by zero polynomial).
///
/// # Safety
/// All pointers must be valid, aligned, and sized as described above.
#[no_mangle]
pub unsafe extern "C" fn poly_div_mod_f64(
    num_ptr: *const f64,
    num_len: i32,
    den_ptr: *const f64,
    den_len: i32,
    out_ptr: *mut f64,
) -> i32 {
    let num_len = num_len as usize;
    let den_len = den_len as usize;

    if den_len == 0 {
        return 0; // division by zero — caller checks this
    }

    // Trivial case: degree(num) < degree(den) → quotient = 0, remainder = num
    if num_len < den_len {
        // quotient: empty (q_len = 0)
        // remainder: copy num
        for i in 0..num_len {
            *out_ptr.add(i) = *num_ptr.add(i);
        }
        return num_len as i32;
    }

    let q_len = num_len - den_len + 1;
    let r_max = den_len - 1; // max remainder coefficients

    // Work buffer for the remainder accumulation (starts as a copy of num).
    let mut work: Vec<f64> = vec![0.0; num_len];
    for i in 0..num_len {
        work[i] = *num_ptr.add(i);
    }

    let bn = *den_ptr.add(den_len - 1); // leading coefficient of divisor

    // Quotient output starts at out_ptr.
    for i in 0..q_len {
        *out_ptr.add(i) = 0.0;
    }

    // Long division: highest degree first.
    for ii in 0..q_len {
        let i = num_len - 1 - ii; // index in work buffer
        let q = work[i] / bn;
        *out_ptr.add(i - den_len + 1) = q;
        for j in 0..den_len {
            let idx = i - den_len + 1 + j;
            work[idx] -= q * *den_ptr.add(j);
        }
    }

    // Remainder is the low-degree part of work (length r_max).
    let r_len = if r_max <= num_len { r_max } else { num_len };
    for i in 0..r_len {
        *out_ptr.add(q_len + i) = work[i];
    }

    (q_len + r_len) as i32
}

// ============================================================
// INTERNAL HELPERS (shared by resultant / discriminant kernels)
// ============================================================

/// Trim trailing zero coefficients, keeping at least one element.
fn trim_f64(c: &[f64]) -> alloc::vec::Vec<f64> {
    if c.is_empty() {
        return vec![0.0];
    }
    let mut end = c.len() - 1;
    while end > 0 && c[end] == 0.0 {
        end -= 1;
    }
    c[..=end].to_vec()
}

/// Gaussian-elimination determinant of a row-major `n × n` matrix.
fn det_f64(mut m: alloc::vec::Vec<f64>, n: usize) -> f64 {
    let mut det = 1.0_f64;
    for col in 0..n {
        // Partial pivoting.
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

/// Build the `(m+n) × (m+n)` Sylvester matrix and return its determinant.
fn sylvester_det(p: &[f64], q: &[f64]) -> f64 {
    let pt = trim_f64(p);
    let qt = trim_f64(q);
    let m = pt.len() - 1; // degree of p
    let n = qt.len() - 1; // degree of q
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
    let mut mat = vec![0.0_f64; size * size];
    // First n rows: shifted copies of p (highest-degree first).
    for i in 0..n {
        for j in 0..=m {
            mat[i * size + (i + j)] = pt[m - j];
        }
    }
    // Next m rows: shifted copies of q (highest-degree first).
    for i in 0..m {
        for j in 0..=n {
            mat[(n + i) * size + (i + j)] = qt[n - j];
        }
    }
    det_f64(mat, size)
}

// ============================================================
// POLY_RESULTANT_F64  — Sylvester-matrix determinant
// ============================================================

/// Compute the resultant of polynomials `p` and `q` via the Sylvester matrix.
///
/// Returns `NaN` when either polynomial has degree < 1.
///
/// # Safety
/// `p_ptr` / `q_ptr` must point to valid, aligned `f64` slices of
/// lengths `p_len` and `q_len` respectively.
#[no_mangle]
pub unsafe extern "C" fn poly_resultant_f64(
    p_ptr: *const f64,
    p_len: i32,
    q_ptr: *const f64,
    q_len: i32,
) -> f64 {
    if p_len <= 0 || q_len <= 0 {
        return f64::NAN;
    }
    let p = core::slice::from_raw_parts(p_ptr, p_len as usize);
    let q = core::slice::from_raw_parts(q_ptr, q_len as usize);
    sylvester_det(p, q)
}

// ============================================================
// POLY_DISCRIMINANT_F64  — disc(p) = (-1)^(m(m-1)/2) / a_m · Res(p, p')
// ============================================================

/// Compute the discriminant of polynomial `p` via its derivative's resultant.
///
/// Returns `NaN` for polynomials of degree < 1.
///
/// # Safety
/// `p_ptr` must point to a valid, aligned `f64` slice of length `p_len`.
#[no_mangle]
pub unsafe extern "C" fn poly_discriminant_f64(p_ptr: *const f64, p_len: i32) -> f64 {
    if p_len <= 0 {
        return f64::NAN;
    }
    let raw = core::slice::from_raw_parts(p_ptr, p_len as usize);
    let t = trim_f64(raw);
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
    // deg >= 4: disc(p) = (-1)^(m(m-1)/2) / a_m · Res(p, p')
    let mut fp = vec![0.0_f64; deg];
    for i in 1..=deg {
        fp[i - 1] = t[i] * i as f64;
    }
    let res = sylvester_det(&t, &fp);
    let an = t[t.len() - 1];
    let sign = if ((deg * (deg - 1)) / 2) % 2 == 0 { 1.0 } else { -1.0 };
    sign * res / an
}

// ============================================================
// POLY_VANDERMONDE_F64 — build Vandermonde matrix (x^k basis)
// ============================================================

/// Build an n × (degree+1) Vandermonde matrix in row-major order.
///
/// `out_ptr` must point to a writable buffer of `n * (degree+1)` f64s.
/// Returns 0 on success, -1 on invalid input.
///
/// # Safety
/// `xs_ptr` must be a valid `f64` slice of length `n`.
/// `out_ptr` must point to a writable buffer of `n * (degree+1)` f64s.
#[no_mangle]
pub unsafe extern "C" fn poly_vandermonde_f64(
    xs_ptr: *const f64,
    n: usize,
    degree: usize,
    out_ptr: *mut f64,
) -> i32 {
    if n == 0 || degree == 0 {
        return -1;
    }
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let cols = degree + 1;
    for i in 0..n {
        let x = xs[i];
        let mut xpow: f64 = 1.0;
        for j in 0..cols {
            *out_ptr.add(i * cols + j) = xpow;
            xpow *= x;
        }
    }
    0
}

// ============================================================
// POLY_FIT_F64 — Vandermonde + QR least-squares fit
// ============================================================

/// Fit a polynomial of given degree to (xs, ys) via Vandermonde + QR.
///
/// Returns `(degree+1) as i32` on success (number of coefficients written
/// to `out_coeffs_ptr`), or `-1` on rank-deficient / degenerate input.
///
/// # Safety
/// `xs_ptr` / `ys_ptr` must be valid `f64` slices of length `n`.
/// `out_coeffs_ptr` must be a writable buffer of at least `degree+1` f64s.
#[no_mangle]
pub unsafe extern "C" fn poly_fit_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    n: usize,
    degree: usize,
    out_coeffs_ptr: *mut f64,
) -> i32 {
    let k = degree + 1;
    if n < k || k == 0 {
        return -1;
    }
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);

    // Build Vandermonde matrix (n × k), row-major.
    let mut a: Vec<f64> = vec![0.0; n * k];
    for i in 0..n {
        let x = xs[i];
        let mut xpow: f64 = 1.0;
        for j in 0..k {
            a[i * k + j] = xpow;
            xpow *= x;
        }
    }

    // qtb will receive Q^T y then become the solution x.
    let mut qtb: Vec<f64> = vec![0.0; n];

    let tol = 1e-12;
    if !householder_qr_solve(&mut a, n, k, ys, &mut qtb, tol) {
        return -1;
    }

    for j in 0..k {
        *out_coeffs_ptr.add(j) = qtb[j];
    }
    k as i32
}

// ============================================================
// CHEB_FIT_F64 — Chebyshev-basis Vandermonde + QR fit
// ============================================================

/// Fit a Chebyshev-series of given degree to (xs, ys).
///
/// Uses the three-term recurrence T_{n+1} = 2x·T_n - T_{n-1} to build
/// the design matrix row-by-row.
///
/// Returns `(degree+1) as i32` on success, -1 on failure.
///
/// # Safety
/// Same as `poly_fit_f64`.
#[no_mangle]
pub unsafe extern "C" fn cheb_fit_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    n: usize,
    degree: usize,
    out_coeffs_ptr: *mut f64,
) -> i32 {
    let k = degree + 1;
    if n < k || k == 0 {
        return -1;
    }
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);

    // Build Chebyshev Vandermonde (n × k), row-major.
    let mut a: Vec<f64> = vec![0.0; n * k];
    for i in 0..n {
        let x = xs[i];
        let mut t_prev: f64 = 1.0; // T_0
        let mut t_curr: f64 = x;   // T_1
        a[i * k] = t_prev;
        if k > 1 {
            a[i * k + 1] = t_curr;
        }
        for j in 2..k {
            let t_next = 2.0 * x * t_curr - t_prev;
            a[i * k + j] = t_next;
            t_prev = t_curr;
            t_curr = t_next;
        }
    }

    let mut qtb: Vec<f64> = vec![0.0; n];
    let tol = 1e-12;
    if !householder_qr_solve(&mut a, n, k, ys, &mut qtb, tol) {
        return -1;
    }
    for j in 0..k {
        *out_coeffs_ptr.add(j) = qtb[j];
    }
    k as i32
}

// ============================================================
// LEGENDRE_FIT_F64 — Legendre-basis Vandermonde + QR fit
// ============================================================

/// Fit a Legendre-series of given degree to (xs, ys).
///
/// Uses the three-term recurrence
///   (n+1) P_{n+1} = (2n+1) x P_n - n P_{n-1}
///
/// Returns `(degree+1) as i32` on success, -1 on failure.
///
/// # Safety
/// Same as `poly_fit_f64`.
#[no_mangle]
pub unsafe extern "C" fn legendre_fit_f64(
    xs_ptr: *const f64,
    ys_ptr: *const f64,
    n: usize,
    degree: usize,
    out_coeffs_ptr: *mut f64,
) -> i32 {
    let k = degree + 1;
    if n < k || k == 0 {
        return -1;
    }
    let xs = core::slice::from_raw_parts(xs_ptr, n);
    let ys = core::slice::from_raw_parts(ys_ptr, n);

    // Build Legendre Vandermonde (n × k), row-major.
    let mut a: Vec<f64> = vec![0.0; n * k];
    for i in 0..n {
        let x = xs[i];
        let mut p_prev: f64 = 1.0; // P_0
        let mut p_curr: f64 = x;   // P_1
        a[i * k] = p_prev;
        if k > 1 {
            a[i * k + 1] = p_curr;
        }
        for deg_n in 1..(k - 1) {
            // (deg_n+1) * P_{deg_n+1} = (2*deg_n+1)*x*P_{deg_n} - deg_n*P_{deg_n-1}
            let p_next = ((2 * deg_n + 1) as f64 * x * p_curr - deg_n as f64 * p_prev)
                / (deg_n + 1) as f64;
            a[i * k + deg_n + 1] = p_next;
            p_prev = p_curr;
            p_curr = p_next;
        }
    }

    let mut qtb: Vec<f64> = vec![0.0; n];
    let tol = 1e-12;
    if !householder_qr_solve(&mut a, n, k, ys, &mut qtb, tol) {
        return -1;
    }
    for j in 0..k {
        *out_coeffs_ptr.add(j) = qtb[j];
    }
    k as i32
}

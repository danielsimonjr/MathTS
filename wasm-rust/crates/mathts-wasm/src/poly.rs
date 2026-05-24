//! Polynomial hot-loop kernels for the typed-layer WASM bridge.
//!
//! Polynomials are coefficient arrays where index = power, i.e.
//! `p(x) = coeffs[0] + coeffs[1]*x + coeffs[2]*x^2 + ...`
//!
//! Two kernels are exported:
//!
//! * `poly_mul_f64(a, b)` — O(n·m) convolution, returns the product.
//! * `poly_div_mod_f64(num, den)` — polynomial long division.
//!   Returns a concatenated flat array `[quotient | remainder]`.
//!   The caller slices it using the length rule:
//!     quotient_len  = max(0, num.len() - den.len() + 1)
//!     remainder_len = result.len() - quotient_len
//!
//! All exported symbols use `#[no_mangle] pub unsafe extern "C"` and
//! pointer-style arguments to stay consistent with the rest of the crate.

use alloc::vec;
use alloc::vec::Vec;

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

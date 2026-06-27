/**
 * Tridiagonal-solve kernel — AssemblyScript parity port (Slice 3.10b).
 * Divided-difference kernel — AssemblyScript parity port (Slice 5.5).
 *
 * Solves a tridiagonal linear system A·x = rhs in O(n) using the
 * Thomas algorithm (forward-sweep + back-substitution).
 *
 * Parameters:
 *   diag  — main diagonal,    length n
 *   lower — sub-diagonal,     length n-1  (lower[i] = row i+1, col i)
 *   upper — super-diagonal,   length n-1  (upper[i] = row i,   col i+1)
 *   rhs   — right-hand side,  length n
 *
 * Returns Float64Array of length n containing the solution x.
 * Returns a zero-length Float64Array on a singular (zero-pivot) system.
 *
 * Mirrors `tridiag_solve_f64` in the original Rust `tridiag.rs`
 * implementation.
 */

export function tridiag_solve_f64(
  diag: Float64Array,
  lower: Float64Array,
  upper: Float64Array,
  rhs: Float64Array,
): Float64Array {
  const n: i32 = diag.length;

  if (n == 0) {
    return new Float64Array(0);
  }

  if (n == 1) {
    const d0 = diag[0];
    if (d0 == 0.0) return new Float64Array(0); // singular
    const result = new Float64Array(1);
    result[0] = rhs[0] / d0;
    return result;
  }

  // Forward sweep — modified super-diagonal c[] and modified rhs d[].
  const c = new Float64Array(n - 1);
  const d = new Float64Array(n);

  const d0 = diag[0];
  if (d0 == 0.0) return new Float64Array(0); // singular
  c[0] = upper[0] / d0;
  d[0] = rhs[0] / d0;

  for (let i: i32 = 1; i < n - 1; i++) {
    const lower_im1 = lower[i - 1];
    const m = diag[i] - lower_im1 * c[i - 1];
    if (m == 0.0) return new Float64Array(0); // singular
    c[i] = upper[i] / m;
    d[i] = (rhs[i] - lower_im1 * d[i - 1]) / m;
  }

  // Last row.
  const lower_nm2 = lower[n - 2];
  const m_last = diag[n - 1] - lower_nm2 * c[n - 2];
  if (m_last == 0.0) return new Float64Array(0); // singular
  d[n - 1] = (rhs[n - 1] - lower_nm2 * d[n - 2]) / m_last;

  // Back substitution.
  const x = new Float64Array(n);
  x[n - 1] = d[n - 1];
  for (let i: i32 = n - 2; i >= 0; i--) {
    x[i] = d[i] - c[i] * x[i + 1];
  }

  return x;
}

// ============================================================================
// divided_difference_f64 — Newton's divided-difference coefficients (Slice 5.5)
// ============================================================================

/**
 * Compute Newton's divided-difference coefficients for polynomial interpolation.
 *
 * Given n distinct nodes (x_0, y_0) … (x_{n-1}, y_{n-1}), returns a
 * Float64Array of n Newton-form coefficients c_0 … c_{n-1} such that the
 * interpolating polynomial is:
 *
 *   P(x) = c_0 + c_1·(x-x_0) + c_2·(x-x_0)(x-x_1) + …
 *
 * Returns a zero-length Float64Array when any two x-values are equal
 * (degenerate / rank-deficient input), matching the AS convention from
 * tridiag_solve_f64.
 *
 * Mirrors `divided_difference_f64` in the original Rust `tridiag.rs`
 * implementation.
 */
export function divided_difference_f64(
  xs: Float64Array,
  ys: Float64Array,
): Float64Array {
  const n: i32 = xs.length;

  if (n == 0) {
    return new Float64Array(0);
  }

  // Initialise work buffer with y-values.
  const out = new Float64Array(n);
  for (let i: i32 = 0; i < n; i++) {
    out[i] = ys[i];
  }

  // In-place divided-difference computation.
  for (let j: i32 = 1; j < n; j++) {
    for (let i: i32 = n - 1; i >= j; i--) {
      const denom: f64 = xs[i] - xs[i - j];
      if (denom == 0.0) {
        return new Float64Array(0); // duplicate x → degenerate
      }
      out[i] = (out[i] - out[i - 1]) / denom;
    }
  }

  return out;
}

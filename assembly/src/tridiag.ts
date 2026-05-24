/**
 * Tridiagonal-solve kernel — AssemblyScript parity port (Slice 3.10b).
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
 * Mirrors `tridiag_solve_f64` in
 * wasm-rust/crates/mathts-wasm/src/tridiag.rs.
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

/**
 * Singular Value Decomposition via the one-sided Jacobi algorithm.
 *
 * AssemblyScript fallback mirroring the original Rust implementation in
 * `matrix/svd.rs` (removed in the Rust→AS migration). One-sided Jacobi is
 * compact, allocation-light, numerically robust, and needs no
 * bidiagonalization — it works for any real m x n matrix.
 */

const SVD_MAX_SWEEPS: i32 = 60;
const SVD_EPS: f64 = 1e-15;

/**
 * Thin (economy) SVD of a row-major `m x n` matrix `A`.
 *
 * Returns a packed `Float64Array` `[ U (m*k) | S (k) | V (n*k) ]` with
 * `k = min(m, n)`, such that `A = U * diag(S) * V^T`. `S` is sorted
 * descending. The caller slices the result using known `m`, `n`, `k`.
 */
export function matrix_svd(a: Float64Array, m: i32, n: i32): Float64Array {
  const k: i32 = m < n ? m : n;
  const out = new Float64Array(m * k + k + n * k);
  if (m <= 0 || n <= 0) return out;
  svdCore(a, m, n, out, 0, m * k, m * k + k);
  return out;
}

/**
 * Singular values only — a `Float64Array` of length `min(m, n)`, descending.
 */
export function matrix_singular_values(a: Float64Array, m: i32, n: i32): Float64Array {
  const k: i32 = m < n ? m : n;
  const s = new Float64Array(k);
  if (m <= 0 || n <= 0) return s;
  const scratch = new Float64Array(m * k + k + n * k);
  svdCore(a, m, n, scratch, 0, m * k, m * k + k);
  for (let i = 0; i < k; i++) s[i] = scratch[m * k + i];
  return s;
}

function svdCore(
  a: Float64Array,
  m: i32,
  n: i32,
  out: Float64Array,
  uOff: i32,
  sOff: i32,
  vOff: i32
): void {
  // One-sided Jacobi orthogonalizes COLUMNS, so it wants rows >= cols.
  // For wide matrices (m < n) decompose A^T and swap U/V at the end.
  const transposed: bool = m < n;
  const rows: i32 = transposed ? n : m;
  const cols: i32 = transposed ? m : n;

  // Working matrix `w` (rows x cols) = A (or A^T).
  const w = new Float64Array(rows * cols);
  if (transposed) {
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        w[i * cols + j] = a[j * rows + i];
      }
    }
  } else {
    for (let i = 0; i < rows * cols; i++) w[i] = a[i];
  }

  // `v` (cols x cols) starts as identity, accumulates the rotations.
  const v = new Float64Array(cols * cols);
  for (let i = 0; i < cols; i++) v[i * cols + i] = 1.0;

  let sweeps: i32 = 0;
  while (true) {
    let rotated: bool = false;
    for (let p = 0; p < cols; p++) {
      for (let q = p + 1; q < cols; q++) {
        let alpha: f64 = 0.0;
        let beta: f64 = 0.0;
        let gamma: f64 = 0.0;
        for (let i = 0; i < rows; i++) {
          const wip = w[i * cols + p];
          const wiq = w[i * cols + q];
          alpha += wip * wip;
          beta += wiq * wiq;
          gamma += wip * wiq;
        }
        if (Math.abs(gamma) <= SVD_EPS * Math.sqrt(alpha * beta)) continue;
        rotated = true;
        const zeta = (beta - alpha) / (2.0 * gamma);
        let t: f64;
        if (zeta >= 0.0) {
          t = 1.0 / (zeta + Math.sqrt(1.0 + zeta * zeta));
        } else {
          t = -1.0 / (-zeta + Math.sqrt(1.0 + zeta * zeta));
        }
        const c = 1.0 / Math.sqrt(1.0 + t * t);
        const s = c * t;
        for (let i = 0; i < rows; i++) {
          const wip = w[i * cols + p];
          const wiq = w[i * cols + q];
          w[i * cols + p] = c * wip - s * wiq;
          w[i * cols + q] = s * wip + c * wiq;
        }
        for (let i = 0; i < cols; i++) {
          const vip = v[i * cols + p];
          const viq = v[i * cols + q];
          v[i * cols + p] = c * vip - s * viq;
          v[i * cols + q] = s * vip + c * viq;
        }
      }
    }
    sweeps++;
    if (!rotated || sweeps >= SVD_MAX_SWEEPS) break;
  }

  // Singular values = column norms of the converged working matrix.
  const sigma = new Float64Array(cols);
  for (let j = 0; j < cols; j++) {
    let nrm: f64 = 0.0;
    for (let i = 0; i < rows; i++) {
      const x = w[i * cols + j];
      nrm += x * x;
    }
    sigma[j] = Math.sqrt(nrm);
  }

  // Order columns by descending singular value (insertion sort).
  const order = new Int32Array(cols);
  for (let i = 0; i < cols; i++) order[i] = i;
  for (let i = 1; i < cols; i++) {
    const key = order[i];
    let j = i;
    while (j > 0 && sigma[order[j - 1]] < sigma[key]) {
      order[j] = order[j - 1];
      j--;
    }
    order[j] = key;
  }

  // Build thin U (rows x cols), reordered V (cols x cols), reordered S.
  const uThin = new Float64Array(rows * cols);
  const vOrd = new Float64Array(cols * cols);
  const sOrd = new Float64Array(cols);
  for (let nj = 0; nj < cols; nj++) {
    const oj = order[nj];
    const sv = sigma[oj];
    sOrd[nj] = sv;
    for (let i = 0; i < rows; i++) {
      uThin[i * cols + nj] = sv > 1e-300 ? w[i * cols + oj] / sv : 0.0;
    }
    for (let i = 0; i < cols; i++) {
      vOrd[i * cols + nj] = v[i * cols + oj];
    }
  }

  // Write outputs, mapped back to the original orientation.
  //  not transposed: A   = uThin * diag(s) * vOrd^T -> U=uThin, V=vOrd
  //  transposed:     A^T = uThin * diag(s) * vOrd^T
  //              =>  A   = vOrd  * diag(s) * uThin^T -> U=vOrd,  V=uThin
  if (transposed) {
    for (let i = 0; i < cols * cols; i++) out[uOff + i] = vOrd[i];
    for (let i = 0; i < cols; i++) out[sOff + i] = sOrd[i];
    for (let i = 0; i < rows * cols; i++) out[vOff + i] = uThin[i];
  } else {
    for (let i = 0; i < rows * cols; i++) out[uOff + i] = uThin[i];
    for (let i = 0; i < cols; i++) out[sOff + i] = sOrd[i];
    for (let i = 0; i < cols * cols; i++) out[vOff + i] = vOrd[i];
  }
}

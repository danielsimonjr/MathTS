/**
 * Dense matrix decompositions: LU, QR, Cholesky, inverse, determinant.
 *
 * AssemblyScript dense-decomposition kernels. AS-managed Float64Array /
 * Int32Array arguments carry their own length via the AS runtime header,
 * so the signatures here drop the per-buffer length params and keep
 * `n`/`m` as shape metadata. The algorithms are Doolittle LU with partial
 * pivoting, Householder QR, and a right-looking Cholesky.
 *
 * Indexing convention: row-major. `a[i * n + j]` denotes row `i`, col `j`.
 *
 * Return codes:
 *   0  → success
 *   -1 → singular / not-positive-definite (kernel-specific, documented per fn)
 */

const DECOMP_EPS: f64 = 1e-14;

/**
 * LU decomposition with partial pivoting (Doolittle form): `P * A = L * U`.
 *
 * `a` is read-only (n*n, row-major). The factorization is split across:
 *   - `l_out` (n*n): unit lower-triangular L (diagonal == 1)
 *   - `u_out` (n*n): upper-triangular U
 *   - `perm_out` (n):  the row permutation. `perm_out[i] = j` means the
 *                      `i`th row of `P*A` is the `j`th row of `A`.
 *
 * Returns 0 on success, -1 if the matrix is singular (no nonzero pivot
 * found in any sub-column).
 */
export function matrix_lu_decompose(
  a: Float64Array,
  n: i32,
  l_out: Float64Array,
  u_out: Float64Array,
  perm_out: Int32Array
): i32 {
  // The elimination happens in place in `u_out` (no internal allocation: the stub
  // runtime never frees, so a scratch array here leaked n*n*8 bytes per call). After
  // we're done, L lives below the diagonal and U on/above; the final split moves L
  // into l_out and zeroes it in u_out.
  const work = u_out;
  for (let i = 0; i < n * n; i++) work[i] = a[i];

  for (let i = 0; i < n; i++) perm_out[i] = i;

  for (let k = 0; k < n - 1; k++) {
    // Partial pivot: pick the row with the largest |a[i, k]| for i >= k.
    let maxVal: f64 = Math.abs(work[k * n + k]);
    let pivotRow: i32 = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(work[i * n + k]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = i;
      }
    }

    if (maxVal < DECOMP_EPS) {
      return -1; // singular
    }

    if (pivotRow != k) {
      for (let j = 0; j < n; j++) {
        const tmp = work[k * n + j];
        work[k * n + j] = work[pivotRow * n + j];
        work[pivotRow * n + j] = tmp;
      }
      const tmp = perm_out[k];
      perm_out[k] = perm_out[pivotRow];
      perm_out[pivotRow] = tmp;
    }

    // Eliminate column k below the diagonal.
    const pivot = work[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor: f64 = work[i * n + k] / pivot;
      work[i * n + k] = factor; // store L below the diagonal
      for (let j = k + 1; j < n; j++) {
        work[i * n + j] -= factor * work[k * n + j];
      }
    }
  }

  // Final pivot must also be nonzero for the matrix to be non-singular.
  if (Math.abs(work[(n - 1) * n + (n - 1)]) < DECOMP_EPS) {
    return -1;
  }

  // Split the in-place factorization (held in u_out) into l_out (unit lower) and
  // u_out (upper).
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i > j) {
        l_out[i * n + j] = u_out[i * n + j];
        u_out[i * n + j] = 0.0;
      } else if (i == j) {
        l_out[i * n + j] = 1.0;
      } else {
        l_out[i * n + j] = 0.0;
      }
    }
  }

  return 0;
}

/**
 * QR decomposition via Householder reflections.
 *
 * `a` is read-only (m*n, row-major) with `m >= n`. Outputs:
 *   - `q_out` (m*m): orthogonal factor stored as **Q^T**, i.e. the
 *     reconstruction is `A = Q^T * R` (NOT `A = Q * R`). This matches the
 *     matrix-package convention (`WASMBackend.qrDecompositionJS`); callers
 *     wanting Q itself must transpose `q_out`. See the closing note in the
 *     body and `assembly/COVERAGE_AUDIT.md` §3a.
 *   - `r_out` (m*n): upper-trapezoidal R (zero below the diagonal)
 *
 * Returns 0 on success.
 *
 * Algorithm: apply Householder reflectors to a working copy of A (becomes
 * R) and accumulate them into Q starting from the identity. Householder
 * vector `v` is normalized such that `v[0] = 1`; the trailing entries live
 * in `r_below_diag / u1` and we recompute them on the fly per column
 * (no intermediate `v` array).
 */
export function matrix_qr_decompose(
  a: Float64Array,
  m: i32,
  n: i32,
  q_out: Float64Array,
  r_out: Float64Array,
  // Nullable but deliberately without a default: a defaulted parameter compiles to an
  // arguments-length trampoline, which can ignore a passed buffer. Hosts calling with
  // five arguments pass `undefined`, which arrives as null.
  v_work: Float64Array | null
): i32 {
  // R starts as a copy of A; we annihilate the below-diagonal entries.
  for (let i = 0; i < m * n; i++) r_out[i] = a[i];

  // Q starts as the identity; we accumulate reflectors into it.
  for (let i = 0; i < m * m; i++) q_out[i] = 0.0;
  for (let i = 0; i < m; i++) q_out[i * m + i] = 1.0;

  const minDim: i32 = m < n ? m : n;

  // Precompute the Householder vector once per column. We can't re-derive
  // `v[i] = r[i,k] / u1` on the fly inside the R-update loop, because the
  // first column-update iteration mutates r[i,k] in
  // place — after that, the on-the-fly `vi` reads would see garbage and
  // the algorithm degenerates (all subsequent updates skip). Storing the
  // reflector in a fresh buffer matches the JS reference in
  // `WASMBackend.qrDecompositionJS` exactly.
  // Householder vector scratch (length m). Pass `v_work` to avoid allocating it: the
  // stub runtime never frees, so the internal fallback leaks m*8 bytes per call.
  const vBuf: Float64Array =
    v_work !== null && v_work.length >= m ? v_work : new Float64Array(m);

  for (let k = 0; k < minDim; k++) {
    // Column norm below (and including) the diagonal pivot.
    let norm: f64 = 0.0;
    for (let i = k; i < m; i++) {
      const v = r_out[i * n + k];
      norm += v * v;
    }
    norm = Math.sqrt(norm);

    if (norm < DECOMP_EPS) {
      continue; // already zero — nothing to reflect
    }

    const akk = r_out[k * n + k];
    const sign: f64 = akk >= 0.0 ? 1.0 : -1.0;
    const u1: f64 = akk + sign * norm;

    // Householder vector v of length m-k: v[0] = 1, v[i] = r[k+i,k] / u1.
    vBuf[0] = 1.0;
    let vDotV: f64 = 1.0;
    for (let i = 1; i < m - k; i++) {
      const vi: f64 = r_out[(k + i) * n + k] / u1;
      vBuf[i] = vi;
      vDotV += vi * vi;
    }
    const tau: f64 = 2.0 / vDotV;

    // Apply Householder to R: R := (I - tau * v * v^T) * R.
    for (let j = k; j < n; j++) {
      let vDotCol: f64 = 0.0;
      for (let i = 0; i < m - k; i++) {
        vDotCol += vBuf[i] * r_out[(k + i) * n + j];
      }
      const factor: f64 = tau * vDotCol;
      for (let i = 0; i < m - k; i++) {
        r_out[(k + i) * n + j] -= factor * vBuf[i];
      }
    }

    // Apply Householder to Q (from the left, but stored row-major so the
    // loop walks rows): Q := (I - tau * v * v^T) * Q.
    for (let j = 0; j < m; j++) {
      let vDotCol: f64 = 0.0;
      for (let i = 0; i < m - k; i++) {
        vDotCol += vBuf[i] * q_out[(k + i) * m + j];
      }
      const factor: f64 = tau * vDotCol;
      for (let i = 0; i < m - k; i++) {
        q_out[(k + i) * m + j] -= factor * vBuf[i];
      }
    }

    // Zero out the sub-diagonal entries of R explicitly (they're numerically
    // ~0 by construction but we want exact zeros for downstream consumers).
    for (let i = k + 1; i < m; i++) {
      r_out[i * n + k] = 0.0;
    }
  }

  // NOTE: q_out is stored as `Q^T` (Householder reflectors applied from
  // the left to the identity), so `Q^T * R = A`. The matrix-package
  // QR API documents this — see matrix/tests/wasm/accuracy.test.ts and
  // `WASMBackend.qrDecompositionJS` (the JS reference) for the same
  // convention. Callers wanting Q itself should transpose q_out.

  return 0;
}

/**
 * Cholesky decomposition: `A = L * L^T` for symmetric positive-definite A.
 *
 * `a` is read-only (n*n). `l_out` (n*n) receives the lower-triangular
 * factor; the upper triangle is zeroed.
 *
 * Returns 0 on success, -1 if A is not positive-definite (detected as
 * a non-positive diagonal element during the factorization).
 *
 * Uses the right-looking variant: for
 * each column j we compute `L[j,j] = sqrt(A[j,j] - sum_k L[j,k]^2)` and
 * `L[i,j] = (A[i,j] - sum_k L[i,k] * L[j,k]) / L[j,j]` for i > j.
 */
export function matrix_cholesky(a: Float64Array, n: i32, l_out: Float64Array): i32 {
  for (let i = 0; i < n * n; i++) l_out[i] = 0.0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum: f64 = a[i * n + j];
      for (let k = 0; k < j; k++) {
        sum -= l_out[i * n + k] * l_out[j * n + k];
      }
      if (i == j) {
        if (sum <= 0.0) return -1; // not positive-definite
        l_out[i * n + j] = Math.sqrt(sum);
      } else {
        const ljj = l_out[j * n + j];
        l_out[i * n + j] = sum / ljj;
      }
    }
  }
  return 0;
}

/**
 * Compute `A^-1` for a square n*n matrix via LU + column-wise back-solve.
 *
 * `work` is a scratch buffer of length >= n*n: it holds the in-place LU
 * factorization. Size it n*n + n and the row permutation lives in its tail too,
 * so the call allocates nothing; with exactly n*n the permutation is allocated
 * internally, which the stub runtime never frees. The solution vectors are
 * solved in place in `result`.
 *
 * Returns 0 on success, -1 if A is singular (in which case `result`
 * is left zeroed).
 */
export function matrix_inverse(
  a: Float64Array,
  n: i32,
  result: Float64Array,
  work: Float64Array
): i32 {
  // Copy A into the work buffer; LU will eliminate in place.
  for (let i = 0; i < n * n; i++) work[i] = a[i];

  // The row permutation lives in `work`'s tail when the caller sized it n*n + n (the
  // stub runtime never frees, so an internal array leaked n*4 bytes per call); a caller
  // passing exactly n*n still works, with the internal fallback.
  const permInWork = work.length >= n * n + n;
  const permFallback: Int32Array | null = permInWork ? null : new Int32Array(n);
  const permBase = n * n;
  for (let i = 0; i < n; i++) {
    if (permInWork) work[permBase + i] = <f64>i;
    else permFallback![i] = i;
  }

  // Doolittle LU with partial pivoting — same algorithm as
  // matrix_lu_decompose, just inline so we can re-use the factored
  // buffer for the back-solve below.
  for (let k = 0; k < n - 1; k++) {
    let maxVal: f64 = Math.abs(work[k * n + k]);
    let pivotRow: i32 = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(work[i * n + k]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = i;
      }
    }
    if (maxVal < DECOMP_EPS) {
      for (let i = 0; i < n * n; i++) result[i] = 0.0;
      return -1;
    }
    if (pivotRow != k) {
      for (let j = 0; j < n; j++) {
        const tmp = work[k * n + j];
        work[k * n + j] = work[pivotRow * n + j];
        work[pivotRow * n + j] = tmp;
      }
      if (permInWork) {
        const tmp = work[permBase + k];
        work[permBase + k] = work[permBase + pivotRow];
        work[permBase + pivotRow] = tmp;
      } else {
        const fb = permFallback!;
        const tmp = fb[k];
        fb[k] = fb[pivotRow];
        fb[pivotRow] = tmp;
      }
    }
    const pivot = work[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor: f64 = work[i * n + k] / pivot;
      work[i * n + k] = factor;
      for (let j = k + 1; j < n; j++) {
        work[i * n + j] -= factor * work[k * n + j];
      }
    }
  }
  if (Math.abs(work[(n - 1) * n + (n - 1)]) < DECOMP_EPS) {
    for (let i = 0; i < n * n; i++) result[i] = 0.0;
    return -1;
  }

  // Solve A * X = I one column at a time, with x held in result's column itself: the
  // forward pass reads only earlier entries of it and the back pass only later ones, so
  // no scratch vector is needed. The right-hand side is the unit vector e_col, so
  // b[perm[i]] is just (perm[i] == col).
  for (let col = 0; col < n; col++) {
    // Forward substitution: L * y = P * b. Since L has unit diagonal,
    // y[i] = b[perm[i]] - sum_{j<i} L[i,j] * y[j].
    for (let i = 0; i < n; i++) {
      const p: i32 = permInWork ? <i32>work[permBase + i] : permFallback![i];
      let sum: f64 = p == col ? 1.0 : 0.0;
      for (let j = 0; j < i; j++) sum -= work[i * n + j] * result[j * n + col];
      result[i * n + col] = sum;
    }

    // Backward substitution: U * x = y.
    for (let ii = 0; ii < n; ii++) {
      const i = n - 1 - ii;
      let sum: f64 = result[i * n + col];
      for (let j = i + 1; j < n; j++) sum -= work[i * n + j] * result[j * n + col];
      result[i * n + col] = sum / work[i * n + i];
    }
  }

  return 0;
}

/**
 * Determinant of a square n*n matrix via LU.
 *
 * Returns `det(A)`. Returns 0.0 when the matrix is singular — note this
 * value is also legitimately reachable by a tiny non-singular matrix, so
 * callers wanting a singularity flag should test against a tolerance
 * rather than exact zero.
 *
 * `work` is a scratch Float64Array of length >= n*n.
 */
export function matrix_determinant(a: Float64Array, n: i32, work: Float64Array): f64 {
  for (let i = 0; i < n * n; i++) work[i] = a[i];

  // Only the parity of the row swaps matters, so no permutation array is kept (one was
  // allocated and never read, leaking n*4 bytes per call under the stub runtime).

  let swaps: i32 = 0;

  for (let k = 0; k < n - 1; k++) {
    let maxVal: f64 = Math.abs(work[k * n + k]);
    let pivotRow: i32 = k;
    for (let i = k + 1; i < n; i++) {
      const v = Math.abs(work[i * n + k]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = i;
      }
    }
    if (maxVal < DECOMP_EPS) return 0.0;
    if (pivotRow != k) {
      for (let j = 0; j < n; j++) {
        const tmp = work[k * n + j];
        work[k * n + j] = work[pivotRow * n + j];
        work[pivotRow * n + j] = tmp;
      }
      swaps++;
    }
    const pivot = work[k * n + k];
    for (let i = k + 1; i < n; i++) {
      const factor: f64 = work[i * n + k] / pivot;
      work[i * n + k] = factor;
      for (let j = k + 1; j < n; j++) {
        work[i * n + j] -= factor * work[k * n + j];
      }
    }
  }

  // det(A) = (-1)^swaps * product(diag(U)).
  let det: f64 = swaps % 2 == 0 ? 1.0 : -1.0;
  for (let i = 0; i < n; i++) det *= work[i * n + i];
  return det;
}

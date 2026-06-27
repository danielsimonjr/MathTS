/**
 * Eigenvalue decomposition for real **symmetric** matrices via the classic
 * cyclic Jacobi algorithm.
 *
 * AssemblyScript counterpart to the Rust `eigsSymmetric` /` spectralRadius`
 * kernels (original Rust `matrix/eigs.rs`) and the JS
 * fallback in `matrix/src/operations/eig.ts`. Jacobi is compact,
 * allocation-light, and converges to (near) machine precision for symmetric
 * input — eigenvalues land on the diagonal, eigenvectors accumulate in `V`.
 *
 * Sign/order convention (matches the Rust binary so the Phase 7b binding can
 * swap artifacts transparently): eigenvalues are sorted **ascending by
 * absolute value**; eigenvectors are stored **as columns** of a row-major
 * `n x n` block, i.e. component `i` of eigenvalue `j`'s eigenvector is at
 * `V[i * n + j]`. Eigenvectors match the reference only up to sign/order, so
 * downstream parity is validated by the residual `||A·V − V·diag(λ)||`.
 *
 * General (non-symmetric) eigendecomposition is intentionally NOT provided —
 * matrix falls back to the JS QR path for that case.
 */

/** Off-diagonal magnitude below which a pair is treated as already zeroed. */
const EIG_PIVOT_EPS: f64 = 1e-300;
/** Off-diagonal sum-of-squares below which a sweep loop is converged. */
const EIG_CONVERGED: f64 = 1e-300;
/** Hard cap on sweeps (cyclic Jacobi converges quadratically; ~10 is typical). */
const EIG_MAX_SWEEPS: i32 = 100;

/**
 * Symmetric eigendecomposition of a row-major `n x n` matrix `a`.
 *
 * Returns a packed `Float64Array` `[ eigenvalues (n) | eigenvectors (n*n) ]`,
 * eigenvalues ascending by absolute value and eigenvectors as columns
 * (`V[i*n+j]` = component `i` of eigenvector `j`). The input is not mutated.
 */
export function matrix_eig_symmetric(a: Float64Array, n: i32): Float64Array {
  const out = new Float64Array(n + n * n);
  if (n <= 0) return out;
  if (n == 1) {
    out[0] = a[0];
    out[1] = 1.0;
    return out;
  }

  // Working copy of A (Jacobi mutates it down to diagonal form).
  const A = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) A[i] = a[i];

  // V starts as identity; column j accumulates eigenvector j.
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1.0;

  for (let sweep = 0; sweep < EIG_MAX_SWEEPS; sweep++) {
    let off: f64 = 0.0;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        off += apq * apq;
      }
    }
    if (off < EIG_CONVERGED) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        if (Math.abs(apq) < EIG_PIVOT_EPS) continue;

        const app = A[p * n + p];
        const aqq = A[q * n + q];

        // Symmetric Schur rotation (Numerical-Recipes formulation): pick the
        // smaller-magnitude root of the tangent for numerical stability.
        const theta = (aqq - app) / (2.0 * apq);
        const sgn: f64 = theta >= 0.0 ? 1.0 : -1.0;
        const t = sgn / (Math.abs(theta) + Math.sqrt(theta * theta + 1.0));
        const c = 1.0 / Math.sqrt(t * t + 1.0);
        const s = t * c;
        const tau = s / (1.0 + c);

        // Diagonal update; the (p,q) entry is annihilated exactly.
        A[p * n + p] = app - t * apq;
        A[q * n + q] = aqq + t * apq;
        A[p * n + q] = 0.0;
        A[q * n + p] = 0.0;

        // Off-diagonal rows/cols p,q (symmetric — mirror across the diagonal).
        for (let i = 0; i < n; i++) {
          if (i != p && i != q) {
            const aip = A[i * n + p];
            const aiq = A[i * n + q];
            const nip = aip - s * (aiq + tau * aip);
            const niq = aiq + s * (aip - tau * aiq);
            A[i * n + p] = nip;
            A[p * n + i] = nip;
            A[i * n + q] = niq;
            A[q * n + i] = niq;
          }
        }

        // Rotate eigenvector columns p,q.
        for (let i = 0; i < n; i++) {
          const vip = V[i * n + p];
          const viq = V[i * n + q];
          V[i * n + p] = vip - s * (viq + tau * vip);
          V[i * n + q] = viq + s * (vip - tau * viq);
        }
      }
    }
  }

  // Eigenvalues = converged diagonal.
  const ev = new Float64Array(n);
  for (let i = 0; i < n; i++) ev[i] = A[i * n + i];

  // Selection-sort an index permutation ascending by |eigenvalue| (Rust order).
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    let minVal = Math.abs(ev[order[i]]);
    for (let j = i + 1; j < n; j++) {
      const v = Math.abs(ev[order[j]]);
      if (v < minVal) {
        minVal = v;
        minIdx = j;
      }
    }
    if (minIdx != i) {
      const tmp = order[i];
      order[i] = order[minIdx];
      order[minIdx] = tmp;
    }
  }

  // Emit packed output in sorted order.
  for (let nj = 0; nj < n; nj++) {
    const oj = order[nj];
    out[nj] = ev[oj];
    for (let i = 0; i < n; i++) {
      out[n + i * n + nj] = V[i * n + oj];
    }
  }
  return out;
}

/**
 * Spectral radius of a real symmetric `n x n` matrix = max |eigenvalue|.
 *
 * Exact for symmetric input (unlike the Rust power-iteration variant, this
 * reuses the full Jacobi solve), which is what `spectralRadius` documents.
 */
export function matrix_spectral_radius(a: Float64Array, n: i32): f64 {
  if (n <= 0) return 0.0;
  const packed = matrix_eig_symmetric(a, n);
  let m: f64 = 0.0;
  for (let i = 0; i < n; i++) {
    const v = Math.abs(packed[i]);
    if (v > m) m = v;
  }
  return m;
}

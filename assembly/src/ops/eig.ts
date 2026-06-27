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
 * Sign/order convention (kept identical to the original Rust binary so the
 * Phase 7b binding could swap artifacts transparently during the migration;
 * retained now for JS-fallback parity): eigenvalues are sorted **ascending by
 * absolute value**; eigenvectors are stored **as columns** of a row-major
 * `n x n` block, i.e. component `i` of eigenvalue `j`'s eigenvector is at
 * `V[i * n + j]`. Eigenvectors match the reference only up to sign/order, so
 * downstream parity is validated by the residual `||A·V − V·diag(λ)||`.
 *
 * General (non-symmetric) eigendecomposition is provided by
 * `matrix_eig_general` (Hessenberg reduction + Francis double-shift QR to real
 * Schur form, plus eigenvector back-substitution), ported from the public-domain
 * JAMA `EigenvalueDecomposition` (`orthes` + `hqr2`). See that function below.
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

// =============================================================================
// General (non-symmetric) real eigendecomposition.
//
// Ported from the public-domain JAMA `EigenvalueDecomposition` (NIST/MathWorks)
// — the nonsymmetric path: `orthes` (Householder reduction to upper Hessenberg
// with accumulated transform) followed by `hqr2` (Francis double-shift implicit
// QR to the real Schur form, then back-substitution + back-transform to recover
// eigenvectors). This is the canonical EISPACK `orthes`/`hqr2` algorithm and is
// numerically robust for general real matrices.
//
// 2-D arrays are flattened row-major: `H[i][j]` -> `H[i * nn + j]`.
// =============================================================================

/** Machine epsilon for double precision (2^-52), matching JAMA's `eps`. */
const EIG_GEN_EPS: f64 = 2.220446049250313e-16;

/** Complex-division scratch (mirrors JAMA's `cdivr` / `cdivi` fields). */
let g_cdivr: f64 = 0.0;
let g_cdivi: f64 = 0.0;

/** Complex divide: (xr + i·xi) / (yr + i·yi) -> (g_cdivr + i·g_cdivi). */
function cdiv(xr: f64, xi: f64, yr: f64, yi: f64): void {
  let r: f64;
  let d: f64;
  if (Math.abs(yr) > Math.abs(yi)) {
    r = yi / yr;
    d = yr + r * yi;
    g_cdivr = (xr + r * xi) / d;
    g_cdivi = (xi - r * xr) / d;
  } else {
    r = yr / yi;
    d = yi + r * yr;
    g_cdivr = (r * xr + xi) / d;
    g_cdivi = (r * xi - xr) / d;
  }
}

@inline
function imax(a: i32, b: i32): i32 {
  return a > b ? a : b;
}

@inline
function imin(a: i32, b: i32): i32 {
  return a < b ? a : b;
}

/**
 * Householder reduction of `H` (nn x nn, flat) to upper Hessenberg form,
 * accumulating the orthogonal transform into `V` (initialised to identity by
 * the caller). `ort` is scratch of length `nn`. (JAMA `orthes`.)
 */
function orthesGeneral(H: Float64Array, V: Float64Array, ort: Float64Array, nn: i32): void {
  const low = 0;
  const high = nn - 1;

  for (let m = low + 1; m <= high - 1; m++) {
    // Scale column.
    let scale: f64 = 0.0;
    for (let i = m; i <= high; i++) {
      scale += Math.abs(H[i * nn + (m - 1)]);
    }
    if (scale != 0.0) {
      // Compute Householder transformation.
      let h: f64 = 0.0;
      for (let i = high; i >= m; i--) {
        ort[i] = H[i * nn + (m - 1)] / scale;
        h += ort[i] * ort[i];
      }
      let g: f64 = Math.sqrt(h);
      if (ort[m] > 0) g = -g;
      h = h - ort[m] * g;
      ort[m] = ort[m] - g;

      // Apply Householder similarity transformation:
      // H = (I - u·u'/h)·H·(I - u·u'/h)
      for (let j = m; j < nn; j++) {
        let f: f64 = 0.0;
        for (let i = high; i >= m; i--) f += ort[i] * H[i * nn + j];
        f = f / h;
        for (let i = m; i <= high; i++) H[i * nn + j] -= f * ort[i];
      }
      for (let i = 0; i <= high; i++) {
        let f: f64 = 0.0;
        for (let j = high; j >= m; j--) f += ort[j] * H[i * nn + j];
        f = f / h;
        for (let j = m; j <= high; j++) H[i * nn + j] -= f * ort[j];
      }
      ort[m] = scale * ort[m];
      H[m * nn + (m - 1)] = scale * g;
    }
  }

  // Accumulate transformations (Algol's ortran). V already = identity.
  for (let m = high - 1; m >= low + 1; m--) {
    if (H[m * nn + (m - 1)] != 0.0) {
      for (let i = m + 1; i <= high; i++) ort[i] = H[i * nn + (m - 1)];
      for (let j = m; j <= high; j++) {
        let g: f64 = 0.0;
        for (let i = m; i <= high; i++) g += ort[i] * V[i * nn + j];
        // Double division avoids possible underflow.
        g = (g / ort[m]) / H[m * nn + (m - 1)];
        for (let i = m; i <= high; i++) V[i * nn + j] += g * ort[i];
      }
    }
  }
}

/**
 * General real non-symmetric eigendecomposition of a row-major `n x n` matrix.
 *
 * Returns a packed `Float64Array`:
 *   `[ re(n) | im(n) | vectors(n*n) ]`
 * where `re[j] + i·im[j]` is eigenvalue `j` and the eigenvectors are stored as
 * COLUMNS (component `i` of eigenvector `j` at `2n + i*n + j`), matching the
 * symmetric kernel's layout. Real eigenvectors are normalised to unit Euclidean
 * length; complex-eigenvalue columns are zero-filled (the real `number[][]`
 * contract on the JS side cannot represent complex eigenvectors — the JS
 * reference likewise returns the zero vector for complex eigenvalues).
 *
 * The input is not mutated.
 */
export function matrix_eig_general(a: Float64Array, n: i32): Float64Array {
  const nn = n;
  const out = new Float64Array(2 * nn + nn * nn);
  if (nn <= 0) return out;
  if (nn == 1) {
    out[0] = a[0];
    out[1] = 0.0;
    out[2] = 1.0;
    return out;
  }

  // Working Hessenberg/Schur matrix H, transform V, eigenvalue parts d/e.
  const H = new Float64Array(nn * nn);
  for (let i = 0; i < nn * nn; i++) H[i] = a[i];
  const V = new Float64Array(nn * nn);
  for (let i = 0; i < nn; i++) V[i * nn + i] = 1.0;
  const d = new Float64Array(nn);
  const e = new Float64Array(nn);
  const ort = new Float64Array(nn);

  // Reduce to Hessenberg form (accumulates into V).
  orthesGeneral(H, V, ort, nn);

  // --- hqr2: reduce Hessenberg to real Schur form ---------------------------
  const low = 0;
  const high = nn - 1;
  const eps = EIG_GEN_EPS;
  let exshift: f64 = 0.0;
  let p: f64 = 0.0;
  let q: f64 = 0.0;
  let r: f64 = 0.0;
  let s: f64 = 0.0;
  let z: f64 = 0.0;
  let t: f64;
  let w: f64;
  let x: f64;
  let y: f64;

  // Compute matrix norm.
  let norm: f64 = 0.0;
  for (let i = 0; i < nn; i++) {
    for (let j = imax(i - 1, 0); j < nn; j++) {
      norm += Math.abs(H[i * nn + j]);
    }
  }

  let nIdx = nn - 1;
  let iter = 0;
  while (nIdx >= low) {
    // Look for single small sub-diagonal element.
    let l = nIdx;
    while (l > low) {
      s = Math.abs(H[(l - 1) * nn + (l - 1)]) + Math.abs(H[l * nn + l]);
      if (s == 0.0) s = norm;
      if (Math.abs(H[l * nn + (l - 1)]) < eps * s) break;
      l--;
    }

    if (l == nIdx) {
      // One root found.
      H[nIdx * nn + nIdx] = H[nIdx * nn + nIdx] + exshift;
      d[nIdx] = H[nIdx * nn + nIdx];
      e[nIdx] = 0.0;
      nIdx--;
      iter = 0;
    } else if (l == nIdx - 1) {
      // Two roots found.
      w = H[nIdx * nn + (nIdx - 1)] * H[(nIdx - 1) * nn + nIdx];
      p = (H[(nIdx - 1) * nn + (nIdx - 1)] - H[nIdx * nn + nIdx]) / 2.0;
      q = p * p + w;
      z = Math.sqrt(Math.abs(q));
      H[nIdx * nn + nIdx] = H[nIdx * nn + nIdx] + exshift;
      H[(nIdx - 1) * nn + (nIdx - 1)] = H[(nIdx - 1) * nn + (nIdx - 1)] + exshift;
      x = H[nIdx * nn + nIdx];

      if (q >= 0) {
        // Real pair.
        z = p >= 0 ? p + z : p - z;
        d[nIdx - 1] = x + z;
        d[nIdx] = d[nIdx - 1];
        if (z != 0.0) d[nIdx] = x - w / z;
        e[nIdx - 1] = 0.0;
        e[nIdx] = 0.0;
        x = H[nIdx * nn + (nIdx - 1)];
        s = Math.abs(x) + Math.abs(z);
        p = x / s;
        q = z / s;
        r = Math.sqrt(p * p + q * q);
        p = p / r;
        q = q / r;

        // Row modification.
        for (let j = nIdx - 1; j < nn; j++) {
          z = H[(nIdx - 1) * nn + j];
          H[(nIdx - 1) * nn + j] = q * z + p * H[nIdx * nn + j];
          H[nIdx * nn + j] = q * H[nIdx * nn + j] - p * z;
        }
        // Column modification.
        for (let i = 0; i <= nIdx; i++) {
          z = H[i * nn + (nIdx - 1)];
          H[i * nn + (nIdx - 1)] = q * z + p * H[i * nn + nIdx];
          H[i * nn + nIdx] = q * H[i * nn + nIdx] - p * z;
        }
        // Accumulate transformations.
        for (let i = low; i <= high; i++) {
          z = V[i * nn + (nIdx - 1)];
          V[i * nn + (nIdx - 1)] = q * z + p * V[i * nn + nIdx];
          V[i * nn + nIdx] = q * V[i * nn + nIdx] - p * z;
        }
      } else {
        // Complex pair.
        d[nIdx - 1] = x + p;
        d[nIdx] = x + p;
        e[nIdx - 1] = z;
        e[nIdx] = -z;
      }
      nIdx = nIdx - 2;
      iter = 0;
    } else {
      // No convergence yet. Form shift.
      x = H[nIdx * nn + nIdx];
      y = 0.0;
      w = 0.0;
      if (l < nIdx) {
        y = H[(nIdx - 1) * nn + (nIdx - 1)];
        w = H[nIdx * nn + (nIdx - 1)] * H[(nIdx - 1) * nn + nIdx];
      }

      // Wilkinson's original ad hoc shift.
      if (iter == 10) {
        exshift += x;
        for (let i = low; i <= nIdx; i++) H[i * nn + i] -= x;
        s = Math.abs(H[nIdx * nn + (nIdx - 1)]) + Math.abs(H[(nIdx - 1) * nn + (nIdx - 2)]);
        x = y = 0.75 * s;
        w = -0.4375 * s * s;
      }
      // MATLAB's new ad hoc shift.
      if (iter == 30) {
        s = (y - x) / 2.0;
        s = s * s + w;
        if (s > 0) {
          s = Math.sqrt(s);
          if (y < x) s = -s;
          s = x - w / ((y - x) / 2.0 + s);
          for (let i = low; i <= nIdx; i++) H[i * nn + i] -= s;
          exshift += s;
          x = y = w = 0.964;
        }
      }

      iter = iter + 1;

      // Look for two consecutive small sub-diagonal elements.
      let m = nIdx - 2;
      while (m >= l) {
        z = H[m * nn + m];
        r = x - z;
        s = y - z;
        p = (r * s - w) / H[(m + 1) * nn + m] + H[m * nn + (m + 1)];
        q = H[(m + 1) * nn + (m + 1)] - z - r - s;
        r = H[(m + 2) * nn + (m + 1)];
        s = Math.abs(p) + Math.abs(q) + Math.abs(r);
        p = p / s;
        q = q / s;
        r = r / s;
        if (m == l) break;
        if (
          Math.abs(H[m * nn + (m - 1)]) * (Math.abs(q) + Math.abs(r)) <
          eps *
            (Math.abs(p) *
              (Math.abs(H[(m - 1) * nn + (m - 1)]) +
                Math.abs(z) +
                Math.abs(H[(m + 1) * nn + (m + 1)])))
        ) {
          break;
        }
        m--;
      }

      for (let i = m + 2; i <= nIdx; i++) {
        H[i * nn + (i - 2)] = 0.0;
        if (i > m + 2) H[i * nn + (i - 3)] = 0.0;
      }

      // Double QR step involving rows l:nIdx and columns m:nIdx.
      for (let k = m; k <= nIdx - 1; k++) {
        const notlast = k != nIdx - 1;
        if (k != m) {
          p = H[k * nn + (k - 1)];
          q = H[(k + 1) * nn + (k - 1)];
          r = notlast ? H[(k + 2) * nn + (k - 1)] : 0.0;
          x = Math.abs(p) + Math.abs(q) + Math.abs(r);
          if (x != 0.0) {
            p = p / x;
            q = q / x;
            r = r / x;
          }
        }
        if (x == 0.0) break;
        s = Math.sqrt(p * p + q * q + r * r);
        if (p < 0) s = -s;
        if (s != 0) {
          if (k != m) {
            H[k * nn + (k - 1)] = -s * x;
          } else if (l != m) {
            H[k * nn + (k - 1)] = -H[k * nn + (k - 1)];
          }
          p = p + s;
          x = p / s;
          y = q / s;
          z = r / s;
          q = q / p;
          r = r / p;

          // Row modification.
          for (let j = k; j < nn; j++) {
            p = H[k * nn + j] + q * H[(k + 1) * nn + j];
            if (notlast) {
              p = p + r * H[(k + 2) * nn + j];
              H[(k + 2) * nn + j] = H[(k + 2) * nn + j] - p * z;
            }
            H[k * nn + j] = H[k * nn + j] - p * x;
            H[(k + 1) * nn + j] = H[(k + 1) * nn + j] - p * y;
          }
          // Column modification.
          const colEnd = imin(nIdx, k + 3);
          for (let i = 0; i <= colEnd; i++) {
            p = x * H[i * nn + k] + y * H[i * nn + (k + 1)];
            if (notlast) {
              p = p + z * H[i * nn + (k + 2)];
              H[i * nn + (k + 2)] = H[i * nn + (k + 2)] - p * r;
            }
            H[i * nn + k] = H[i * nn + k] - p;
            H[i * nn + (k + 1)] = H[i * nn + (k + 1)] - p * q;
          }
          // Accumulate transformations.
          for (let i = low; i <= high; i++) {
            p = x * V[i * nn + k] + y * V[i * nn + (k + 1)];
            if (notlast) {
              p = p + z * V[i * nn + (k + 2)];
              V[i * nn + (k + 2)] = V[i * nn + (k + 2)] - p * r;
            }
            V[i * nn + k] = V[i * nn + k] - p;
            V[i * nn + (k + 1)] = V[i * nn + (k + 1)] - p * q;
          }
        }
      }
    }
  }

  // --- Back-substitute to find vectors of the upper triangular form ---------
  if (norm != 0.0) {
    for (nIdx = nn - 1; nIdx >= 0; nIdx--) {
      p = d[nIdx];
      q = e[nIdx];

      if (q == 0) {
        // Real vector.
        let l = nIdx;
        H[nIdx * nn + nIdx] = 1.0;
        for (let i = nIdx - 1; i >= 0; i--) {
          w = H[i * nn + i] - p;
          r = 0.0;
          for (let j = l; j <= nIdx; j++) r += H[i * nn + j] * H[j * nn + nIdx];
          if (e[i] < 0.0) {
            z = w;
            s = r;
          } else {
            l = i;
            if (e[i] == 0.0) {
              H[i * nn + nIdx] = w != 0.0 ? -r / w : -r / (eps * norm);
            } else {
              // Solve real equations.
              x = H[i * nn + (i + 1)];
              y = H[(i + 1) * nn + i];
              q = (d[i] - p) * (d[i] - p) + e[i] * e[i];
              t = (x * s - z * r) / q;
              H[i * nn + nIdx] = t;
              if (Math.abs(x) > Math.abs(z)) {
                H[(i + 1) * nn + nIdx] = (-r - w * t) / x;
              } else {
                H[(i + 1) * nn + nIdx] = (-s - y * t) / z;
              }
            }
            // Overflow control.
            t = Math.abs(H[i * nn + nIdx]);
            if (eps * t * t > 1) {
              for (let j = i; j <= nIdx; j++) H[j * nn + nIdx] = H[j * nn + nIdx] / t;
            }
          }
        }
      } else if (q < 0) {
        // Complex vector.
        let l = nIdx - 1;
        // Last vector component imaginary so matrix is triangular.
        if (Math.abs(H[nIdx * nn + (nIdx - 1)]) > Math.abs(H[(nIdx - 1) * nn + nIdx])) {
          H[(nIdx - 1) * nn + (nIdx - 1)] = q / H[nIdx * nn + (nIdx - 1)];
          H[(nIdx - 1) * nn + nIdx] = -(H[nIdx * nn + nIdx] - p) / H[nIdx * nn + (nIdx - 1)];
        } else {
          cdiv(0.0, -H[(nIdx - 1) * nn + nIdx], H[(nIdx - 1) * nn + (nIdx - 1)] - p, q);
          H[(nIdx - 1) * nn + (nIdx - 1)] = g_cdivr;
          H[(nIdx - 1) * nn + nIdx] = g_cdivi;
        }
        H[nIdx * nn + (nIdx - 1)] = 0.0;
        H[nIdx * nn + nIdx] = 1.0;
        for (let i = nIdx - 2; i >= 0; i--) {
          let ra: f64 = 0.0;
          let sa: f64 = 0.0;
          for (let j = l; j <= nIdx; j++) {
            ra += H[i * nn + j] * H[j * nn + (nIdx - 1)];
            sa += H[i * nn + j] * H[j * nn + nIdx];
          }
          w = H[i * nn + i] - p;
          if (e[i] < 0.0) {
            z = w;
            r = ra;
            s = sa;
          } else {
            l = i;
            if (e[i] == 0) {
              cdiv(-ra, -sa, w, q);
              H[i * nn + (nIdx - 1)] = g_cdivr;
              H[i * nn + nIdx] = g_cdivi;
            } else {
              // Solve complex equations.
              x = H[i * nn + (i + 1)];
              y = H[(i + 1) * nn + i];
              let vr: f64 = (d[i] - p) * (d[i] - p) + e[i] * e[i] - q * q;
              let vi: f64 = (d[i] - p) * 2.0 * q;
              if (vr == 0.0 && vi == 0.0) {
                vr =
                  eps *
                  norm *
                  (Math.abs(w) + Math.abs(q) + Math.abs(x) + Math.abs(y) + Math.abs(z));
              }
              cdiv(x * r - z * ra + q * sa, x * s - z * sa - q * ra, vr, vi);
              H[i * nn + (nIdx - 1)] = g_cdivr;
              H[i * nn + nIdx] = g_cdivi;
              if (Math.abs(x) > Math.abs(z) + Math.abs(q)) {
                H[(i + 1) * nn + (nIdx - 1)] =
                  (-ra - w * H[i * nn + (nIdx - 1)] + q * H[i * nn + nIdx]) / x;
                H[(i + 1) * nn + nIdx] =
                  (-sa - w * H[i * nn + nIdx] - q * H[i * nn + (nIdx - 1)]) / x;
              } else {
                cdiv(
                  -r - y * H[i * nn + (nIdx - 1)],
                  -s - y * H[i * nn + nIdx],
                  z,
                  q,
                );
                H[(i + 1) * nn + (nIdx - 1)] = g_cdivr;
                H[(i + 1) * nn + nIdx] = g_cdivi;
              }
            }
            // Overflow control.
            t = Math.max(Math.abs(H[i * nn + (nIdx - 1)]), Math.abs(H[i * nn + nIdx]));
            if (eps * t * t > 1) {
              for (let j = i; j <= nIdx; j++) {
                H[j * nn + (nIdx - 1)] = H[j * nn + (nIdx - 1)] / t;
                H[j * nn + nIdx] = H[j * nn + nIdx] / t;
              }
            }
          }
        }
      }
    }

    // Back transformation to get eigenvectors of the original matrix.
    for (let j = nn - 1; j >= low; j--) {
      for (let i = low; i <= high; i++) {
        z = 0.0;
        const kEnd = imin(j, high);
        for (let k = low; k <= kEnd; k++) z += V[i * nn + k] * H[k * nn + j];
        V[i * nn + j] = z;
      }
    }
  }

  // --- Pack output: [ re(n) | im(n) | vectors(n*n columns) ] ----------------
  for (let j = 0; j < nn; j++) {
    out[j] = d[j];
    out[nn + j] = e[j];
  }
  for (let j = 0; j < nn; j++) {
    if (e[j] == 0.0) {
      // Real eigenvalue: emit the (real) eigenvector column, unit-normalised.
      let colNorm: f64 = 0.0;
      for (let i = 0; i < nn; i++) {
        const vij = V[i * nn + j];
        colNorm += vij * vij;
      }
      colNorm = Math.sqrt(colNorm);
      if (colNorm > 1e-300) {
        for (let i = 0; i < nn; i++) out[2 * nn + i * nn + j] = V[i * nn + j] / colNorm;
      } else {
        for (let i = 0; i < nn; i++) out[2 * nn + i * nn + j] = V[i * nn + j];
      }
    }
    // Complex eigenvalue: leave column zero (out is zero-initialised).
  }

  return out;
}

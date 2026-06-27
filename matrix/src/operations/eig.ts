/**
 * Eigenvalue and Eigenvector Decomposition
 *
 * Implements eigenvalue computation using QR algorithm and
 * eigenvector extraction using inverse iteration.
 */

import {
  isSymmetric,
  eye,
  cloneMatrix,
  householder,
  applyHouseholderLeft,
  applyHouseholderRight,
} from './common.js';

/**
 * Result of eigenvalue decomposition
 */
export interface EigResult {
  /** Eigenvalues (may be complex for non-symmetric matrices) */
  values: Array<{ re: number; im: number }>;
  /** Eigenvectors as columns (each column is an eigenvector) */
  vectors: number[][];
  /** Whether the matrix was symmetric */
  isSymmetric: boolean;
}

/**
 * Options for eigenvalue computation
 */
export interface EigOptions {
  /** Maximum number of QR iterations */
  maxIterations?: number;
  /** Convergence tolerance */
  tolerance?: number;
  /** Whether to compute eigenvectors */
  computeVectors?: boolean;
}

const DEFAULT_MAX_ITERATIONS = 1000;
const DEFAULT_TOLERANCE = 1e-12;

/**
 * Reduce matrix to upper Hessenberg form using Householder reflections
 * Returns H and Q where A = Q*H*Q'
 */
function hessenberg(A: number[][]): { H: number[][]; Q: number[][] } {
  const n = A.length;
  const H = cloneMatrix(A);
  const Q = eye(n);

  for (let k = 0; k < n - 2; k++) {
    // Extract column below diagonal
    const x: number[] = [];
    for (let i = k + 1; i < n; i++) {
      x.push(H[i][k]);
    }

    const { v, beta } = householder(x);

    if (beta !== 0) {
      // H = P*H*P where P = I - beta*v*v'
      applyHouseholderLeft(H, v, beta, k + 1, k);
      applyHouseholderRight(H, v, beta, 0, k + 1);

      // Accumulate Q = Q*P
      applyHouseholderRight(Q, v, beta, 0, k + 1);
    }
  }

  // Clean up small values below subdiagonal
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i - 1; j++) {
      H[i][j] = 0;
    }
  }

  return { H, Q };
}

/**
 * Compute Givens rotation parameters for a 2x2 block
 */
function givens(a: number, b: number): { c: number; s: number } {
  if (b === 0) {
    return { c: 1, s: 0 };
  } else if (Math.abs(b) > Math.abs(a)) {
    const t = -a / b;
    const s = 1 / Math.sqrt(1 + t * t);
    return { c: s * t, s };
  } else {
    const t = -b / a;
    const c = 1 / Math.sqrt(1 + t * t);
    return { c, s: c * t };
  }
}

/**
 * Apply Givens rotation to rows i and k
 */
function applyGivensLeft(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  startCol: number
): void {
  const n = A[0].length;
  for (let j = startCol; j < n; j++) {
    const temp = c * A[i][j] - s * A[k][j];
    A[k][j] = s * A[i][j] + c * A[k][j];
    A[i][j] = temp;
  }
}

/**
 * Apply Givens rotation to columns i and k
 */
function applyGivensRight(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  startRow: number
): void {
  const m = A.length;
  for (let j = startRow; j < m; j++) {
    const temp = c * A[j][i] - s * A[j][k];
    A[j][k] = s * A[j][i] + c * A[j][k];
    A[j][i] = temp;
  }
}

/**
 * QR step with implicit shift for Hessenberg matrix
 */
function qrStep(H: number[][], Q: number[][], start: number, end: number): void {
  const n = end - start + 1;
  if (n < 2) return;

  // Wilkinson shift - eigenvalue of bottom 2x2 closer to H[end][end]
  const a = H[end - 1][end - 1];
  const b = H[end - 1][end];
  const c = H[end][end - 1];
  const d = H[end][end];

  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;

  let shift: number;
  if (disc >= 0) {
    const sqrtDisc = Math.sqrt(disc);
    const e1 = (trace + sqrtDisc) / 2;
    const e2 = (trace - sqrtDisc) / 2;
    shift = Math.abs(e1 - d) < Math.abs(e2 - d) ? e1 : e2;
  } else {
    shift = d;
  }

  // First column of H - shift*I
  let x = H[start][start] - shift;
  let y = H[start + 1][start];

  for (let k = start; k < end; k++) {
    const { c, s } = givens(x, y);

    // Apply G from left: G' * H
    applyGivensLeft(H, c, s, k, k + 1, Math.max(0, k - 1));

    // Apply G from right: H * G
    applyGivensRight(H, c, s, k, k + 1, 0);

    // Accumulate Q = Q * G
    applyGivensRight(Q, c, s, k, k + 1, 0);

    if (k < end - 1) {
      x = H[k + 1][k];
      y = H[k + 2][k];
    }
  }
}

/**
 * Extract eigenvalues from quasi-upper-triangular Schur form
 */
function extractEigenvalues(H: number[][], tolerance: number): Array<{ re: number; im: number }> {
  const n = H.length;
  const eigenvalues: Array<{ re: number; im: number }> = [];

  let i = 0;
  while (i < n) {
    if (i === n - 1 || Math.abs(H[i + 1][i]) <= tolerance) {
      // Real eigenvalue
      eigenvalues.push({ re: H[i][i], im: 0 });
      i++;
    } else {
      // Complex conjugate pair from 2x2 block
      const a = H[i][i];
      const b = H[i][i + 1];
      const c = H[i + 1][i];
      const d = H[i + 1][i + 1];

      const trace = a + d;
      const det = a * d - b * c;
      const disc = trace * trace - 4 * det;

      if (disc >= 0) {
        // Two real eigenvalues
        const sqrtDisc = Math.sqrt(disc);
        eigenvalues.push({ re: (trace + sqrtDisc) / 2, im: 0 });
        eigenvalues.push({ re: (trace - sqrtDisc) / 2, im: 0 });
      } else {
        // Complex conjugate pair
        const realPart = trace / 2;
        const imagPart = Math.sqrt(-disc) / 2;
        eigenvalues.push({ re: realPart, im: imagPart });
        eigenvalues.push({ re: realPart, im: -imagPart });
      }
      i += 2;
    }
  }

  return eigenvalues;
}

/**
 * Inverse iteration to find eigenvector for a given eigenvalue
 */
function inverseIteration(
  A: number[][],
  eigenvalue: { re: number; im: number },
  tolerance: number,
  maxIterations: number
): number[] {
  const n = A.length;

  if (eigenvalue.im !== 0) {
    // For complex eigenvalues, return zero vector (would need complex arithmetic)
    return new Array(n).fill(0);
  }

  const lambda = eigenvalue.re;

  // Create (A - lambda*I)
  const shifted = cloneMatrix(A);
  for (let i = 0; i < n; i++) {
    shifted[i][i] -= lambda;
  }

  // Add small perturbation to avoid singularity
  for (let i = 0; i < n; i++) {
    shifted[i][i] += tolerance * 1e3;
  }

  // LU decomposition with partial pivoting
  const LU = cloneMatrix(shifted);
  const perm = Array.from({ length: n }, (_, i) => i);

  for (let k = 0; k < n; k++) {
    // Find pivot
    let maxVal = Math.abs(LU[k][k]);
    let maxIdx = k;
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(LU[i][k]) > maxVal) {
        maxVal = Math.abs(LU[i][k]);
        maxIdx = i;
      }
    }

    // Swap rows
    if (maxIdx !== k) {
      [LU[k], LU[maxIdx]] = [LU[maxIdx], LU[k]];
      [perm[k], perm[maxIdx]] = [perm[maxIdx], perm[k]];
    }

    if (Math.abs(LU[k][k]) < tolerance) {
      LU[k][k] = tolerance;
    }

    // Eliminate
    for (let i = k + 1; i < n; i++) {
      LU[i][k] /= LU[k][k];
      for (let j = k + 1; j < n; j++) {
        LU[i][j] -= LU[i][k] * LU[k][j];
      }
    }
  }

  // Inverse iteration
  const v = new Array(n).fill(1);
  let prevNorm = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Solve LU*x = v
    const y = new Array(n).fill(0);

    // Apply permutation
    const b = new Array(n);
    for (let i = 0; i < n; i++) {
      b[i] = v[perm[i]];
    }

    // Forward substitution (L*y = b)
    for (let i = 0; i < n; i++) {
      y[i] = b[i];
      for (let j = 0; j < i; j++) {
        y[i] -= LU[i][j] * y[j];
      }
    }

    // Back substitution (U*x = y)
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = y[i];
      for (let j = i + 1; j < n; j++) {
        x[i] -= LU[i][j] * x[j];
      }
      x[i] /= LU[i][i];
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < n; i++) {
      norm += x[i] * x[i];
    }
    norm = Math.sqrt(norm);

    if (norm < tolerance) {
      return x;
    }

    for (let i = 0; i < n; i++) {
      v[i] = x[i] / norm;
    }

    // Check convergence
    if (Math.abs(norm - prevNorm) < tolerance * norm) {
      break;
    }
    prevNorm = norm;
  }

  return v;
}

// =============================================================================
// General (non-symmetric) real eigendecomposition.
//
// Ported from the public-domain JAMA `EigenvalueDecomposition` (NIST/MathWorks)
// nonsymmetric path — `orthes` (Householder reduction to upper Hessenberg with
// accumulated transform) followed by `hqr2` (Francis double-shift implicit QR to
// the real Schur form, then back-substitution + back-transform to recover
// eigenvectors). This is the canonical EISPACK `orthes`/`hqr2` algorithm and is
// numerically robust for general real matrices. It mirrors `matrix_eig_general`
// in `assembly/src/ops/eig.ts` exactly, so the JS fallback and the WASM kernel
// agree to machine precision.
//
// Replaces the previous ad-hoc `doubleShiftQR` + inverse-iteration path, which
// failed to converge on companion-style matrices (returned all-zero eigenvalues).
// =============================================================================

/** Machine epsilon for double precision (2^-52), matching JAMA's `eps`. */
const EIG_GEN_EPS = 2.220446049250313e-16;

/** Complex divide: (xr + i·xi) / (yr + i·yi) -> { r, i }. (JAMA `cdiv`.) */
function cdiv(xr: number, xi: number, yr: number, yi: number): { r: number; i: number } {
  let rr: number;
  let d: number;
  if (Math.abs(yr) > Math.abs(yi)) {
    rr = yi / yr;
    d = yr + rr * yi;
    return { r: (xr + rr * xi) / d, i: (xi - rr * xr) / d };
  } else {
    rr = yr / yi;
    d = yi + rr * yr;
    return { r: (rr * xr + xi) / d, i: (rr * xi - xr) / d };
  }
}

/**
 * Householder reduction of `H` (nn x nn, flat row-major) to upper Hessenberg
 * form, accumulating the orthogonal transform into `V` (identity on entry).
 * `ort` is scratch of length `nn`. (JAMA `orthes`.)
 */
function orthesGeneral(H: Float64Array, V: Float64Array, ort: Float64Array, nn: number): void {
  const low = 0;
  const high = nn - 1;

  for (let m = low + 1; m <= high - 1; m++) {
    let scale = 0.0;
    for (let i = m; i <= high; i++) {
      scale += Math.abs(H[i * nn + (m - 1)]);
    }
    if (scale !== 0.0) {
      let h = 0.0;
      for (let i = high; i >= m; i--) {
        ort[i] = H[i * nn + (m - 1)] / scale;
        h += ort[i] * ort[i];
      }
      let g = Math.sqrt(h);
      if (ort[m] > 0) g = -g;
      h = h - ort[m] * g;
      ort[m] = ort[m] - g;

      // H = (I - u·u'/h)·H·(I - u·u'/h)
      for (let j = m; j < nn; j++) {
        let f = 0.0;
        for (let i = high; i >= m; i--) f += ort[i] * H[i * nn + j];
        f = f / h;
        for (let i = m; i <= high; i++) H[i * nn + j] -= f * ort[i];
      }
      for (let i = 0; i <= high; i++) {
        let f = 0.0;
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
    if (H[m * nn + (m - 1)] !== 0.0) {
      for (let i = m + 1; i <= high; i++) ort[i] = H[i * nn + (m - 1)];
      for (let j = m; j <= high; j++) {
        let g = 0.0;
        for (let i = m; i <= high; i++) g += ort[i] * V[i * nn + j];
        // Double division avoids possible underflow.
        g = g / ort[m] / H[m * nn + (m - 1)];
        for (let i = m; i <= high; i++) V[i * nn + j] += g * ort[i];
      }
    }
  }
}

/**
 * General real non-symmetric eigendecomposition (JAMA `orthes` + `hqr2`).
 *
 * Returns an {@link EigResult} matching the existing JS contract:
 *   - `values[j]` = eigenvalue `j` ({ re, im }), real eigenvalues first within
 *     each Schur block, complex-conjugate pairs adjacent;
 *   - `vectors[j]` = eigenvector `j` as an array of `n` real components
 *     (unit-normalised). Complex-eigenvalue columns are returned as the zero
 *     vector — the real `number[][]` contract cannot represent complex
 *     eigenvectors (the WASM kernel and the old path do the same).
 *
 * The input `A` is not mutated.
 */
function eigGeneral(A: number[][], computeVectors: boolean, symmetric: boolean): EigResult {
  const nn = A.length;
  const eps = EIG_GEN_EPS;

  // Working Hessenberg/Schur matrix H, transform V, eigenvalue parts d/e.
  const H = new Float64Array(nn * nn);
  for (let i = 0; i < nn; i++) {
    for (let j = 0; j < nn; j++) H[i * nn + j] = A[i][j];
  }
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
  let exshift = 0.0;
  let p = 0.0;
  let q = 0.0;
  let r = 0.0;
  let s = 0.0;
  let z = 0.0;
  let t: number;
  let w: number;
  let x: number;
  let y: number;

  // Compute matrix norm.
  let norm = 0.0;
  for (let i = 0; i < nn; i++) {
    for (let j = Math.max(i - 1, 0); j < nn; j++) {
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
      if (s === 0.0) s = norm;
      if (Math.abs(H[l * nn + (l - 1)]) < eps * s) break;
      l--;
    }

    if (l === nIdx) {
      // One root found.
      H[nIdx * nn + nIdx] = H[nIdx * nn + nIdx] + exshift;
      d[nIdx] = H[nIdx * nn + nIdx];
      e[nIdx] = 0.0;
      nIdx--;
      iter = 0;
    } else if (l === nIdx - 1) {
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
        if (z !== 0.0) d[nIdx] = x - w / z;
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
      if (iter === 10) {
        exshift += x;
        for (let i = low; i <= nIdx; i++) H[i * nn + i] -= x;
        s = Math.abs(H[nIdx * nn + (nIdx - 1)]) + Math.abs(H[(nIdx - 1) * nn + (nIdx - 2)]);
        x = y = 0.75 * s;
        w = -0.4375 * s * s;
      }
      // MATLAB's new ad hoc shift.
      if (iter === 30) {
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
        if (m === l) break;
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
        const notlast = k !== nIdx - 1;
        if (k !== m) {
          p = H[k * nn + (k - 1)];
          q = H[(k + 1) * nn + (k - 1)];
          r = notlast ? H[(k + 2) * nn + (k - 1)] : 0.0;
          x = Math.abs(p) + Math.abs(q) + Math.abs(r);
          if (x !== 0.0) {
            p = p / x;
            q = q / x;
            r = r / x;
          }
        }
        if (x === 0.0) break;
        s = Math.sqrt(p * p + q * q + r * r);
        if (p < 0) s = -s;
        if (s !== 0) {
          if (k !== m) {
            H[k * nn + (k - 1)] = -s * x;
          } else if (l !== m) {
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
          const colEnd = Math.min(nIdx, k + 3);
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
  if (norm !== 0.0) {
    for (nIdx = nn - 1; nIdx >= 0; nIdx--) {
      p = d[nIdx];
      q = e[nIdx];

      if (q === 0) {
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
            if (e[i] === 0.0) {
              H[i * nn + nIdx] = w !== 0.0 ? -r / w : -r / (eps * norm);
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
          const cd = cdiv(0.0, -H[(nIdx - 1) * nn + nIdx], H[(nIdx - 1) * nn + (nIdx - 1)] - p, q);
          H[(nIdx - 1) * nn + (nIdx - 1)] = cd.r;
          H[(nIdx - 1) * nn + nIdx] = cd.i;
        }
        H[nIdx * nn + (nIdx - 1)] = 0.0;
        H[nIdx * nn + nIdx] = 1.0;
        for (let i = nIdx - 2; i >= 0; i--) {
          let ra = 0.0;
          let sa = 0.0;
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
            if (e[i] === 0) {
              const cd = cdiv(-ra, -sa, w, q);
              H[i * nn + (nIdx - 1)] = cd.r;
              H[i * nn + nIdx] = cd.i;
            } else {
              // Solve complex equations.
              x = H[i * nn + (i + 1)];
              y = H[(i + 1) * nn + i];
              let vr = (d[i] - p) * (d[i] - p) + e[i] * e[i] - q * q;
              const vi = (d[i] - p) * 2.0 * q;
              if (vr === 0.0 && vi === 0.0) {
                vr =
                  eps * norm * (Math.abs(w) + Math.abs(q) + Math.abs(x) + Math.abs(y) + Math.abs(z));
              }
              const cd = cdiv(x * r - z * ra + q * sa, x * s - z * sa - q * ra, vr, vi);
              H[i * nn + (nIdx - 1)] = cd.r;
              H[i * nn + nIdx] = cd.i;
              if (Math.abs(x) > Math.abs(z) + Math.abs(q)) {
                H[(i + 1) * nn + (nIdx - 1)] =
                  (-ra - w * H[i * nn + (nIdx - 1)] + q * H[i * nn + nIdx]) / x;
                H[(i + 1) * nn + nIdx] =
                  (-sa - w * H[i * nn + nIdx] - q * H[i * nn + (nIdx - 1)]) / x;
              } else {
                const cd2 = cdiv(
                  -r - y * H[i * nn + (nIdx - 1)],
                  -s - y * H[i * nn + nIdx],
                  z,
                  q
                );
                H[(i + 1) * nn + (nIdx - 1)] = cd2.r;
                H[(i + 1) * nn + nIdx] = cd2.i;
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
        const kEnd = Math.min(j, high);
        for (let k = low; k <= kEnd; k++) z += V[i * nn + k] * H[k * nn + j];
        V[i * nn + j] = z;
      }
    }
  }

  // --- Assemble EigResult ---------------------------------------------------
  const values: Array<{ re: number; im: number }> = [];
  for (let j = 0; j < nn; j++) values.push({ re: d[j], im: e[j] });

  let vectors: number[][];
  if (computeVectors) {
    vectors = [];
    for (let j = 0; j < nn; j++) {
      const vec = new Array<number>(nn).fill(0);
      if (e[j] === 0.0) {
        // Real eigenvalue: emit the (real) eigenvector column, unit-normalised.
        let colNorm = 0.0;
        for (let i = 0; i < nn; i++) colNorm += V[i * nn + j] * V[i * nn + j];
        colNorm = Math.sqrt(colNorm);
        if (colNorm > 1e-300) {
          for (let i = 0; i < nn; i++) vec[i] = V[i * nn + j] / colNorm;
        } else {
          for (let i = 0; i < nn; i++) vec[i] = V[i * nn + j];
        }
      }
      // Complex eigenvalue: leave the zero vector (real contract cannot hold it).
      vectors.push(vec);
    }
  } else {
    vectors = eye(nn);
  }

  return { values, vectors, isSymmetric: symmetric };
}

/**
 * Compute eigenvalues and eigenvectors of a square matrix
 * Uses QR algorithm with implicit shifts
 *
 * @param matrix - Square matrix (n x n)
 * @param options - Computation options
 * @returns Eigenvalues and eigenvectors
 */
export function eig(matrix: number[][] | Float64Array, options: EigOptions = {}): EigResult {
  const {
    maxIterations = DEFAULT_MAX_ITERATIONS,
    tolerance = DEFAULT_TOLERANCE,
    computeVectors = true,
  } = options;

  // Convert to 2D array if needed
  let A: number[][];
  if (matrix instanceof Float64Array) {
    const n = Math.sqrt(matrix.length);
    if (n !== Math.floor(n)) {
      throw new Error('Float64Array length must be a perfect square');
    }
    A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => matrix[i * n + j]));
  } else {
    A = matrix;
  }

  const n = A.length;
  if (n === 0) {
    return { values: [], vectors: [], isSymmetric: true };
  }

  // Check dimensions
  for (let i = 0; i < n; i++) {
    if (A[i].length !== n) {
      throw new Error('Matrix must be square');
    }
  }

  const symmetric = isSymmetric(A);

  // Special cases
  if (n === 1) {
    return {
      values: [{ re: A[0][0], im: 0 }],
      vectors: [[1]],
      isSymmetric: symmetric,
    };
  }

  // Non-symmetric matrices: use the robust JAMA orthes/hqr2 solver (Hessenberg
  // reduction + Francis double-shift QR). The shared symmetric QR path below
  // (Givens/Wilkinson) is only valid for symmetric input and previously
  // produced all-zero eigenvalues on companion-style non-symmetric matrices.
  if (!symmetric) {
    return eigGeneral(A, computeVectors, symmetric);
  }

  if (n === 2) {
    const a = A[0][0],
      b = A[0][1],
      c = A[1][0],
      d = A[1][1];
    const trace = a + d;
    const det = a * d - b * c;
    const disc = trace * trace - 4 * det;

    let values: Array<{ re: number; im: number }>;
    let vectors: number[][];

    if (disc >= 0) {
      const sqrtDisc = Math.sqrt(disc);
      const e1 = (trace + sqrtDisc) / 2;
      const e2 = (trace - sqrtDisc) / 2;
      values = [
        { re: e1, im: 0 },
        { re: e2, im: 0 },
      ];

      if (computeVectors) {
        // Compute eigenvectors for 2x2
        vectors = [];
        for (const e of [e1, e2]) {
          if (Math.abs(b) > tolerance) {
            const v = [b, e - a];
            const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
            vectors.push([v[0] / norm, v[1] / norm]);
          } else if (Math.abs(c) > tolerance) {
            const v = [e - d, c];
            const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
            vectors.push([v[0] / norm, v[1] / norm]);
          } else {
            vectors.push(e === a ? [1, 0] : [0, 1]);
          }
        }
      } else {
        vectors = eye(2);
      }
    } else {
      const realPart = trace / 2;
      const imagPart = Math.sqrt(-disc) / 2;
      values = [
        { re: realPart, im: imagPart },
        { re: realPart, im: -imagPart },
      ];
      vectors = eye(2); // Complex eigenvectors not computed
    }

    return { values, vectors, isSymmetric: symmetric };
  }

  // Reduce to Hessenberg form
  const { H, Q } = hessenberg(A);

  // QR iteration
  let end = n - 1;
  let iter = 0;

  while (end > 0 && iter < maxIterations) {
    // Find largest subdiagonal element that is negligible
    let start = end;
    while (start > 0) {
      const scale = Math.abs(H[start - 1][start - 1]) + Math.abs(H[start][start]);
      if (Math.abs(H[start][start - 1]) <= tolerance * scale) {
        H[start][start - 1] = 0;
        break;
      }
      start--;
    }

    if (start === end) {
      // Eigenvalue found
      end--;
    } else if (start === end - 1) {
      // 2x2 block - eigenvalues from this block
      end -= 2;
    } else {
      // Apply symmetric QR step (this path is reached for symmetric input only;
      // non-symmetric matrices are handled earlier by eigGeneral).
      qrStep(H, Q, start, end);
    }
    iter++;
  }

  // Extract eigenvalues
  const values = extractEigenvalues(H, tolerance);

  // Compute eigenvectors if requested
  let vectors: number[][];
  if (computeVectors) {
    vectors = [];
    for (const eigenvalue of values) {
      const v = inverseIteration(A, eigenvalue, tolerance, 100);
      vectors.push(v);
    }
  } else {
    vectors = eye(n);
  }

  return { values, vectors, isSymmetric: symmetric };
}

/**
 * Compute only eigenvalues (faster, no eigenvector computation)
 */
export function eigvals(
  matrix: number[][] | Float64Array,
  options?: Omit<EigOptions, 'computeVectors'>
): Array<{ re: number; im: number }> {
  return eig(matrix, { ...options, computeVectors: false }).values;
}

/**
 * Power iteration for dominant eigenvalue
 * Faster than full eigendecomposition when only largest eigenvalue needed
 */
export function powerIteration(
  matrix: number[][],
  options: { maxIterations?: number; tolerance?: number } = {}
): { value: number; vector: number[] } {
  const { maxIterations = 1000, tolerance = 1e-12 } = options;
  const n = matrix.length;

  // Random initial vector
  let v = Array.from({ length: n }, () => Math.random() - 0.5);

  // Normalize
  let norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  v = v.map((x) => x / norm);

  let eigenvalue = 0;
  let prevEigenvalue = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    // Matrix-vector multiply
    const w = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        w[i] += matrix[i][j] * v[j];
      }
    }

    // Rayleigh quotient
    eigenvalue = v.reduce((sum, vi, i) => sum + vi * w[i], 0);

    // Normalize
    norm = Math.sqrt(w.reduce((sum, x) => sum + x * x, 0));
    v = w.map((x) => x / norm);

    // Check convergence
    if (Math.abs(eigenvalue - prevEigenvalue) < tolerance * Math.abs(eigenvalue)) {
      break;
    }
    prevEigenvalue = eigenvalue;
  }

  return { value: eigenvalue, vector: v };
}

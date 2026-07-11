/**
 * Singular Value Decomposition (SVD)
 *
 * Implements SVD using Golub-Reinsch bidiagonalization and implicit QR.
 * A = U * S * V^T where:
 *   - U: m x m orthogonal matrix (left singular vectors)
 *   - S: m x n diagonal matrix (singular values)
 *   - V: n x n orthogonal matrix (right singular vectors)
 */

import {
  eye,
  cloneMatrix,
  householder,
  applyHouseholderLeft,
  applyHouseholderRight,
} from './common.js';

/**
 * Result of SVD decomposition
 */
export interface SVDResult {
  /** Left singular vectors (m x m) */
  U: number[][];
  /** Singular values (min(m,n) values) */
  S: number[];
  /** Right singular vectors (n x n) */
  V: number[][];
  /** Rank estimate */
  rank: number;
}

/**
 * Options for SVD computation
 */
export interface SVDOptions {
  /** Maximum number of iterations */
  maxIterations?: number;
  /** Convergence tolerance */
  tolerance?: number;
  /**
   * Complete the thin factor to a square orthonormal basis (U → m×m for tall
   * inputs, V → n×n for wide ones), numpy `full_matrices=True` style, so the
   * rectangular-Σ reconstruction `A = U·Σ·Vᵀ` holds. Default `false` = thin
   * factors (the library's long-standing behavior; the option was previously
   * accepted but ignored — B-4).
   */
  fullMatrices?: boolean;
  /** Threshold for rank determination */
  rankTolerance?: number;
}

const DEFAULT_MAX_ITERATIONS = 1000;
const DEFAULT_TOLERANCE = 1e-12;

/**
 * Bidiagonalize matrix A to B = U' * A * V
 * Returns bidiagonal B, and orthogonal U, V
 */
function bidiagonalize(A: number[][]): { B: number[][]; U: number[][]; V: number[][] } {
  const m = A.length;
  const n = A[0].length;
  const B = cloneMatrix(A);
  const U = eye(m);
  const V = eye(n);

  const minMN = Math.min(m, n);

  for (let k = 0; k < minMN; k++) {
    // Left Householder to zero out column below diagonal
    if (k < m - 1) {
      const col = new Array(m - k);
      for (let i = k; i < m; i++) {
        col[i - k] = B[i][k];
      }

      const { v, beta } = householder(col);

      if (beta !== 0) {
        applyHouseholderLeft(B, v, beta, k, k);
        applyHouseholderRight(U, v, beta, 0, k);
      }
    }

    // Right Householder to zero out row past superdiagonal
    if (k < n - 2) {
      const row = new Array(n - (k + 1));
      for (let j = k + 1; j < n; j++) {
        row[j - (k + 1)] = B[k][j];
      }

      const { v, beta } = householder(row);

      if (beta !== 0) {
        applyHouseholderRight(B, v, beta, k, k + 1);
        applyHouseholderRight(V, v, beta, 0, k + 1);
      }
    }
  }

  // Clean up small values
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && !(i + 1 === j && i < m - 1)) {
        B[i][j] = 0;
      }
    }
  }

  return { B, U, V };
}

/**
 * Compute Givens rotation to zero out element
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
 * Apply Givens rotation to columns i and k
 */
function applyGivensCols(
  A: number[][],
  c: number,
  s: number,
  i: number,
  k: number,
  rowStart: number,
  rowEnd: number
): void {
  for (let j = rowStart; j < rowEnd; j++) {
    const temp = c * A[j][i] - s * A[j][k];
    A[j][k] = s * A[j][i] + c * A[j][k];
    A[j][i] = temp;
  }
}

/**
 * Golub-Kahan SVD step (implicit zero-shift QR)
 */
function svdStep(
  d: number[],
  e: number[],
  U: number[][],
  V: number[][],
  start: number,
  end: number
): void {
  const n = end - start + 1;
  if (n < 2) return;

  // Wilkinson shift from trailing 2x2 of B'*B
  const dm1 = d[end - 1];
  const em1 = e[end - 1];
  const dn = d[end];

  const a = dm1 * dm1 + (end > start + 1 ? e[end - 2] * e[end - 2] : 0);
  const b = dm1 * em1;
  const c = dn * dn + em1 * em1;

  const trace = a + c;
  const det = a * c - b * b;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - det));

  const e1 = trace / 2 + disc;
  const e2 = trace / 2 - disc;
  const shift = Math.abs(e1 - c) < Math.abs(e2 - c) ? e1 : e2;

  // Initial rotation
  let f = d[start] * d[start] - shift;
  let g = d[start] * e[start];

  for (let k = start; k < end; k++) {
    // Right rotation to zero g
    const { c: cs, s: sn } = givens(f, g);

    if (k > start) {
      // The rotated value is the SIGNED quantity `cs*f - sn*g`, not its
      // magnitude. `givens` normalizes so that `cs*a - sn*b = ±sqrt(a^2+b^2)`;
      // storing the unsigned `sqrt(...)` here desynchronizes the bidiagonal
      // `d`/`e` representation from the actual rotated matrix that `U`/`V`
      // accumulate, which silently corrupts the decomposition.
      e[k - 1] = cs * f - sn * g;
    }

    f = cs * d[k] - sn * e[k];
    e[k] = sn * d[k] + cs * e[k];
    g = -sn * d[k + 1];
    d[k + 1] = cs * d[k + 1];

    // Update V
    applyGivensCols(V, cs, sn, k, k + 1, 0, V.length);

    // Left rotation to zero g
    const { c: cs2, s: sn2 } = givens(f, g);

    // Signed rotated value (see the e[k-1] comment above).
    d[k] = cs2 * f - sn2 * g;
    f = cs2 * e[k] - sn2 * d[k + 1];
    d[k + 1] = sn2 * e[k] + cs2 * d[k + 1];

    if (k < end - 1) {
      g = -sn2 * e[k + 1];
      e[k + 1] = cs2 * e[k + 1];
    }

    // Update U
    applyGivensCols(U, cs2, sn2, k, k + 1, 0, U.length);
  }

  e[end - 1] = f;
}

/**
 * Handle zero on diagonal or superdiagonal
 */
function handleZero(
  d: number[],
  e: number[],
  _U: number[][],
  V: number[][],
  zeroIdx: number,
  isDiagonal: boolean,
  _tolerance: number
): void {
  const n = d.length;

  if (isDiagonal) {
    // Zero on diagonal - use Givens to chase superdiagonal to zero
    for (let k = zeroIdx; k < n - 1; k++) {
      const { c, s } = givens(d[k + 1], e[k]);

      d[k + 1] = c * d[k + 1] - s * e[k];
      e[k] = 0;

      if (k < n - 2) {
        const temp = e[k + 1];
        e[k + 1] = c * temp;
        e[k] = -s * temp;
      }

      applyGivensCols(V, c, s, k + 1, k, 0, V.length);
    }
  }
}

/**
 * One-sided Jacobi SVD of a tall/square matrix (m >= n). Numerically robust and
 * correct for **rank-deficient** inputs — used as a fallback when the bidiagonal
 * Golub-Reinsch path above hits an exact zero singular value (its `handleZero`
 * bulge-chasing is unreliable there). Rotates the columns of a working copy `W`
 * to mutual orthogonality; the column norms are the singular values and the
 * normalized columns are the left singular vectors. `V` accumulates the
 * rotations. Returns the pre-sort `{ d, U, V }` so the shared tail (positive-σ /
 * sort / transpose) applies unchanged.
 */
function jacobiSVD(A: number[][]): { d: number[]; U: number[][]; V: number[][] } {
  const m = A.length;
  const n = A[0].length;
  const W = A.map((row) => row.slice()); // m×n; columns converge to σ·u
  const V = eye(n);
  const EPS = 1e-15;
  const MAX_SWEEPS = 60;

  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let rotated = false;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        let alpha = 0;
        let beta = 0;
        let gamma = 0;
        for (let i = 0; i < m; i++) {
          alpha += W[i][p] * W[i][p];
          gamma += W[i][q] * W[i][q];
          beta += W[i][p] * W[i][q];
        }
        if (Math.abs(beta) <= EPS * Math.sqrt(alpha * gamma) || (alpha === 0 && gamma === 0)) {
          continue;
        }
        rotated = true;
        // Jacobi rotation (c, s) diagonalizing [[alpha, beta], [beta, gamma]].
        const zeta = (gamma - alpha) / (2 * beta);
        const sign = zeta >= 0 ? 1 : -1;
        const t = sign / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        for (let i = 0; i < m; i++) {
          const wip = W[i][p];
          const wiq = W[i][q];
          W[i][p] = c * wip - s * wiq;
          W[i][q] = s * wip + c * wiq;
        }
        for (let i = 0; i < n; i++) {
          const vip = V[i][p];
          const viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }
    }
    if (!rotated) break;
  }

  const d = new Array(n).fill(0);
  const U = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let norm = 0;
    for (let i = 0; i < m; i++) norm += W[i][j] * W[i][j];
    norm = Math.sqrt(norm);
    d[j] = norm;
    if (norm > 1e-300) {
      for (let i = 0; i < m; i++) U[i][j] = W[i][j] / norm;
    }
    // else σ = 0 — the U column is filled with a null-space basis vector below so
    // the returned U stays orthonormal (a bare zero column would break that).
  }

  // Complete any σ = 0 columns to an orthonormal basis (Gram-Schmidt against the
  // already-filled columns, seeded from standard basis vectors). Processed in
  // ascending j so each new column is orthogonal to all previously filled ones.
  for (let j = 0; j < n; j++) {
    if (d[j] > 1e-300) continue;
    const col = new Array(m).fill(0);
    for (let seed = 0; seed < m; seed++) {
      col.fill(0);
      col[seed] = 1;
      for (let c = 0; c < n; c++) {
        if (c === j) continue;
        let dot = 0;
        for (let i = 0; i < m; i++) dot += col[i] * U[i][c];
        for (let i = 0; i < m; i++) col[i] -= dot * U[i][c];
      }
      let nrm = 0;
      for (let i = 0; i < m; i++) nrm += col[i] * col[i];
      nrm = Math.sqrt(nrm);
      if (nrm > 1e-8) {
        for (let i = 0; i < m; i++) U[i][j] = col[i] / nrm;
        break;
      }
    }
  }
  return { d, U, V };
}

/**
 * Compute SVD of a matrix
 *
 * @param matrix - Input matrix (m x n)
 * @param options - Computation options
 * @returns SVD decomposition
 */

/**
 * Extend `m×k` orthonormal columns to a full `m×m` orthonormal basis (B-4).
 * Candidates are the standard basis vectors, orthogonalized by modified
 * Gram-Schmidt with one re-orthogonalization pass; a candidate is accepted when
 * its residual norm is non-negligible (> 0.1 — for orthonormal starting columns
 * at least m−k of the eᵢ always qualify, since the projector's diagonal cannot
 * be all-ones on more than k coordinates).
 */
function completeOrthonormalBasis(cols: number[][], m: number): number[][] {
  const k = cols[0]?.length ?? 0;
  const basis: number[][] = Array.from({ length: k }, (_, j) => cols.map((row) => row[j]));
  for (let cand = 0; cand < m && basis.length < m; cand++) {
    const v = Array.from({ length: m }, (_, i) => (i === cand ? 1 : 0));
    for (let pass = 0; pass < 2; pass++) {
      for (const b of basis) {
        let dot = 0;
        for (let i = 0; i < m; i++) dot += v[i] * b[i];
        for (let i = 0; i < m; i++) v[i] -= dot * b[i];
      }
    }
    let norm = 0;
    for (let i = 0; i < m; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);
    if (norm > 0.1) {
      basis.push(v.map((x) => x / norm));
    }
  }
  return Array.from({ length: m }, (_, i) => basis.map((b) => b[i]));
}

export function svd(matrix: number[][] | Float64Array, options: SVDOptions = {}): SVDResult {
  const {
    maxIterations = DEFAULT_MAX_ITERATIONS,
    tolerance = DEFAULT_TOLERANCE,
    fullMatrices = false,
    rankTolerance = 1e-10,
  } = options;

  // Convert to 2D array if needed
  let A: number[][];
  let m: number, n: number;

  if (matrix instanceof Float64Array) {
    // Assume square matrix
    const size = Math.sqrt(matrix.length);
    if (size !== Math.floor(size)) {
      throw new Error('Float64Array must represent a square matrix');
    }
    m = n = size;
    A = Array.from({ length: m }, (_, i) => Array.from({ length: n }, (_, j) => matrix[i * n + j]));
  } else {
    A = matrix;
    m = A.length;
    n = A[0]?.length || 0;
  }

  if (m === 0 || n === 0) {
    return { U: [], S: [], V: [], rank: 0 };
  }

  // Transpose if m < n for better numerical behavior
  const transposed = m < n;
  if (transposed) {
    A = A[0].map((_, j) => A.map((row) => row[j]));
    [m, n] = [n, m];
  }

  // Bidiagonalize
  const { B, U, V } = bidiagonalize(A);

  // Extract diagonal and superdiagonal
  const minMN = Math.min(m, n);
  const d = new Array(minMN).fill(0);
  const e = new Array(minMN - 1).fill(0);

  for (let i = 0; i < minMN; i++) {
    d[i] = B[i][i];
    if (i < minMN - 1) {
      e[i] = B[i][i + 1];
    }
  }

  // Implicit QR iteration on bidiagonal
  let iter = 0;
  let end = minMN - 1;

  while (end > 0 && iter < maxIterations) {
    iter++; // Always increment to prevent infinite loops

    // Check for negligible superdiagonal
    let foundSplit = false;
    for (let i = end; i > 0; i--) {
      if (Math.abs(e[i - 1]) <= tolerance * (Math.abs(d[i - 1]) + Math.abs(d[i]))) {
        e[i - 1] = 0;
        if (i === end) {
          end--;
          foundSplit = true;
          break;
        }
      }
    }

    if (foundSplit) continue;

    // Check for zero on diagonal
    let zeroFound = false;
    for (let i = 0; i <= end; i++) {
      if (Math.abs(d[i]) <= tolerance) {
        d[i] = 0;
        handleZero(d, e, U, V, i, true, tolerance);
        zeroFound = true;
        break;
      }
    }

    if (zeroFound) continue;

    // Find start of active block
    let start = end - 1;
    while (
      start > 0 &&
      Math.abs(e[start - 1]) > tolerance * (Math.abs(d[start - 1]) + Math.abs(d[start]))
    ) {
      start--;
    }

    // SVD step
    svdStep(d, e, U, V, start, end);
  }

  // Rank-deficiency fallback. The bidiagonal QR's exact-zero deflation
  // (`handleZero`) is unreliable — for a matrix with an exactly-zero singular
  // value it can leave the superdiagonal unfolded, yielding a wrong σ and V (it
  // returns σ₁ = √5 instead of 5 for [[1,2],[2,4]]). When we detect a zero
  // singular value, recompute the whole decomposition with the robust one-sided
  // Jacobi SVD, which is correct for rank-deficient inputs. Full-rank matrices
  // (the overwhelmingly common case) never trigger this and keep the fast path.
  let dFinal = d;
  let uFinal = U;
  let vFinal = V;
  const maxAbsD = d.reduce((mx, x) => Math.max(mx, Math.abs(x)), 0);
  if (maxAbsD > 0 && d.some((x) => Math.abs(x) <= rankTolerance * maxAbsD)) {
    const jac = jacobiSVD(A);
    dFinal = jac.d;
    uFinal = jac.U;
    vFinal = jac.V;
  }

  // Ensure positive singular values
  for (let i = 0; i < dFinal.length; i++) {
    if (dFinal[i] < 0) {
      dFinal[i] = -dFinal[i];
      for (let j = 0; j < vFinal.length; j++) {
        vFinal[j][i] = -vFinal[j][i];
      }
    }
  }

  // Sort singular values in descending order
  const indices = Array.from({ length: dFinal.length }, (_, i) => i);
  indices.sort((a, b) => dFinal[b] - dFinal[a]);

  const sortedS = indices.map((i) => dFinal[i]);
  const sortedU = uFinal.map((row) => indices.map((i) => row[i]));
  const sortedV = vFinal.map((row) => indices.map((i) => row[i]));

  // Compute rank
  const maxS = sortedS[0] || 0;
  let rank = 0;
  for (const s of sortedS) {
    if (s > rankTolerance * maxS) {
      rank++;
    }
  }

  // Handle transposition. The thin factor is always the larger-dimension side
  // (internally m ≥ n, so sortedU is m×n thin and sortedV is n×n square);
  // fullMatrices completes it to a square orthonormal basis — the extra columns
  // multiply zero rows of the rectangular Σ, so A = U·Σ·Vᵀ holds exactly.
  if (transposed) {
    return {
      U: sortedV,
      S: sortedS,
      V:
        fullMatrices && sortedU.length > (sortedU[0]?.length ?? 0)
          ? completeOrthonormalBasis(sortedU, sortedU.length)
          : sortedU,
      rank,
    };
  }

  return {
    U:
      fullMatrices && sortedU.length > (sortedU[0]?.length ?? 0)
        ? completeOrthonormalBasis(sortedU, sortedU.length)
        : sortedU,
    S: sortedS,
    V: sortedV,
    rank,
  };
}

/**
 * Compute only singular values (faster than full SVD)
 */
export function singularValues(
  matrix: number[][] | Float64Array,
  options?: Omit<SVDOptions, 'fullMatrices'>
): number[] {
  return svd(matrix, { ...options }).S;
}

/**
 * Compute the pseudoinverse (Moore-Penrose inverse) using SVD
 */
export function pinv(matrix: number[][], options?: SVDOptions): number[][] {
  const { U, S, V, rank } = svd(matrix, options);

  if (rank === 0) {
    // Zero matrix
    const n = matrix[0]?.length || 0;
    const m = matrix.length;
    return Array.from({ length: n }, () => new Array(m).fill(0));
  }

  const tolerance = options?.rankTolerance ?? 1e-10;
  const maxS = S[0];

  // Compute V * S^{-1} * U^T
  const m = U.length;
  const n = V.length;
  const k = S.length;

  // S^{-1} for non-negligible singular values
  const Sinv = S.map((s) => (s > tolerance * maxS ? 1 / s : 0));

  // Result is n x m
  const result = Array.from({ length: n }, () => new Array(m).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        sum += V[i][l] * Sinv[l] * U[j][l];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Low-rank approximation using SVD
 * Keeps only the top r singular values
 */
export function lowRankApprox(matrix: number[][], r: number, options?: SVDOptions): number[][] {
  const { U, S, V } = svd(matrix, options);

  const m = matrix.length;
  const n = matrix[0].length;
  const k = Math.min(r, S.length);

  // Reconstruct with top k singular values
  const result = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let l = 0; l < k; l++) {
        sum += U[i][l] * S[l] * V[j][l];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Compute condition number using SVD
 */
export function cond(matrix: number[][], options?: SVDOptions): number {
  const S = singularValues(matrix, options);

  if (S.length === 0 || S[S.length - 1] === 0) {
    return Infinity;
  }

  return S[0] / S[S.length - 1];
}

/**
 * Compute matrix norm using SVD
 * Returns the spectral norm (largest singular value)
 */
export function norm2(matrix: number[][], options?: SVDOptions): number {
  const S = singularValues(matrix, options);
  return S[0] || 0;
}

/**
 * Compute Frobenius norm using SVD
 * Equals sqrt(sum of squared singular values)
 */
export function normFro(matrix: number[][]): number {
  let sum = 0;
  for (const row of matrix) {
    for (const val of row) {
      sum += val * val;
    }
  }
  return Math.sqrt(sum);
}

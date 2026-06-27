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
  /** Whether to compute full U and V matrices */
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
      const col: number[] = [];
      for (let i = k; i < m; i++) {
        col.push(B[i][k]);
      }

      const { v, beta } = householder(col);

      if (beta !== 0) {
        applyHouseholderLeft(B, v, beta, k, k);
        applyHouseholderRight(U, v, beta, 0, k);
      }
    }

    // Right Householder to zero out row past superdiagonal
    if (k < n - 2) {
      const row: number[] = [];
      for (let j = k + 1; j < n; j++) {
        row.push(B[k][j]);
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
 * Compute SVD of a matrix
 *
 * @param matrix - Input matrix (m x n)
 * @param options - Computation options
 * @returns SVD decomposition
 */
export function svd(matrix: number[][] | Float64Array, options: SVDOptions = {}): SVDResult {
  const {
    maxIterations = DEFAULT_MAX_ITERATIONS,
    tolerance = DEFAULT_TOLERANCE,
    fullMatrices: _fullMatrices = true,
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

  // Ensure positive singular values
  for (let i = 0; i < d.length; i++) {
    if (d[i] < 0) {
      d[i] = -d[i];
      for (let j = 0; j < V.length; j++) {
        V[j][i] = -V[j][i];
      }
    }
  }

  // Sort singular values in descending order
  const indices = Array.from({ length: d.length }, (_, i) => i);
  indices.sort((a, b) => d[b] - d[a]);

  const sortedS = indices.map((i) => d[i]);
  const sortedU = U.map((row) => indices.map((i) => row[i]));
  const sortedV = V.map((row) => indices.map((i) => row[i]));

  // Compute rank
  const maxS = sortedS[0] || 0;
  let rank = 0;
  for (const s of sortedS) {
    if (s > rankTolerance * maxS) {
      rank++;
    }
  }

  // Handle transposition
  if (transposed) {
    return {
      U: sortedV,
      S: sortedS,
      V: sortedU,
      rank,
    };
  }

  return {
    U: sortedU,
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

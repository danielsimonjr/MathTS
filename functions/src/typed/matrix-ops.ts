/**
 * Typed Matrix Operations
 *
 * Advanced matrix operations including characteristic polynomial,
 * row reduction (RREF), Cholesky decomposition, Hessenberg form,
 * matrix power/log, polar decomposition, and Jordan form.
 *
 * All functions operate on number[][] (nested arrays) for consistency
 * with the rest of the typed functions layer. SVD and eigendecomposition
 * are delegated to @danielsimonjr/mathts-matrix when needed.
 *
 * @packageDocumentation
 */

import {
  eig,
  svd,
  cond as matrixCond,
  norm2 as matrixNorm2,
  normFro as matrixNormFro,
  lowRankApprox as matrixLowRankApprox,
  singularValues as matrixSingularValues,
  matrixPinv,
  type PinvOptions,
} from '@danielsimonjr/mathts-matrix';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { computePool } from '@danielsimonjr/mathts-parallel';

// =============================================================================
// AssemblyScript-Compatible Type Aliases
// =============================================================================

type f64 = number;
type i32 = number;

// =============================================================================
// Internal Helpers
// =============================================================================

/** Clone a matrix (deep copy). */
function cloneMatrix(A: number[][]): number[][] {
  return A.map((r) => [...r]);
}

/** Create an n x n identity matrix. */
function eye(n: i32): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/** Flatten a row-major matrix into a Float64Array. */
function flatten(A: number[][], rows: number, cols: number): Float64Array {
  const flat = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) flat[i * cols + j] = A[i][j];
  }
  return flat;
}

/** Rebuild a row-major matrix from a flat Float64Array. */
function unflatten(flat: Float64Array, rows: number, cols: number): number[][] {
  const M: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row = new Array(cols);
    for (let j = 0; j < cols; j++) row[j] = flat[i * cols + j];
    M.push(row);
  }
  return M;
}

/**
 * Multiply two matrices A (m x p) and B (p x n) -> (m x n).
 *
 * Large products are offloaded to the worker pool; small ones use the inline
 * loop (which also skips zero multiplier rows). The worker dispatch threshold
 * is decided by ComputePool, so this is sequential until the result is large
 * enough — and until the pool is initialized — to be worth parallelizing.
 */
async function matMul(A: number[][], B: number[][]): Promise<number[][]> {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;

  if (computePool.shouldParallelize(m * n)) {
    const r = await computePool.matmul(flatten(A, m, p), m, p, flatten(B, p, n), n);
    return unflatten(r.result, m, n);
  }

  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < p; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) {
        C[i][j] += aik * B[k][j];
      }
    }
  }
  return C;
}

/** Transpose a matrix. */
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/** Compute trace of a square matrix. */
function trace(A: number[][]): f64 {
  let t = 0;
  for (let i = 0; i < A.length; i++) t += A[i][i];
  return t;
}

/** Assert that A is square, return dimension n. */
function assertSquare(A: number[][], name: string): i32 {
  const m = A.length;
  if (m === 0) throw new Error(`${name}: empty matrix`);
  const n = A[0].length;
  if (m !== n) throw new Error(`${name}: matrix must be square (got ${m}x${n})`);
  return n;
}

// =============================================================================
// 1. Characteristic Polynomial — Faddeev-LeVerrier Algorithm
// =============================================================================

/**
 * Compute the characteristic polynomial of a square matrix.
 *
 * Returns coefficients of det(A - lambda*I) in ascending power order:
 * [c0, c1, ..., cn] represents c0 + c1*lambda + ... + cn*lambda^n.
 *
 * Uses the Faddeev-LeVerrier algorithm which computes the coefficients
 * from traces of successive matrix powers, achieving O(n^4) complexity.
 *
 * @param A - Square matrix (n x n)
 * @returns Coefficient array of length n+1 (ascending power order)
 *
 * @example
 * // Matrix [[2,1],[1,2]] has char poly lambda^2 - 4*lambda + 3
 * characteristicPolynomial([[2,1],[1,2]]) // => [3, -4, 1]
 */
export async function characteristicPolynomial(A: number[][]): Promise<number[]> {
  const n = assertSquare(A, 'characteristicPolynomial');

  // coeffs[k] is the coefficient of lambda^k
  const coeffs = new Array(n + 1).fill(0);
  coeffs[n] = 1; // leading coefficient is always 1 (monic)

  // M_k tracks the intermediate matrix: M_1 = A, M_k = A * (M_{k-1} + c_{n-k+1} * I)
  let M = cloneMatrix(A);

  for (let k = 1; k <= n; k++) {
    const tr = trace(M);
    coeffs[n - k] = -tr / k;

    if (k < n) {
      // M = A * (M + coeffs[n-k] * I)
      const shifted = cloneMatrix(M);
      for (let i = 0; i < n; i++) {
        shifted[i][i] += coeffs[n - k];
      }
      M = await matMul(A, shifted);
    }
  }

  return coeffs;
}

// =============================================================================
// 2. Row Reduce (RREF) — Gauss-Jordan Elimination
// =============================================================================

/**
 * Compute the reduced row echelon form (RREF) of a matrix.
 *
 * Uses Gauss-Jordan elimination with partial pivoting for numerical
 * stability. The result has leading 1s in each pivot column and zeros
 * in all other entries of pivot columns.
 *
 * @param A - Matrix (m x n), not modified in place
 * @param tol - Tolerance for zero detection (default 1e-10)
 * @returns RREF matrix (m x n)
 *
 * @example
 * rowReduce([[1,2,3],[4,5,6],[7,8,9]])
 * // => [[1,0,-1],[0,1,2],[0,0,0]]
 */
export function rowReduce(A: number[][], tol: f64 = 1e-10): number[][] {
  const m = A.length;
  if (m === 0) return [];
  const n = A[0].length;
  const M = cloneMatrix(A);

  let pivotRow = 0;

  for (let col = 0; col < n && pivotRow < m; col++) {
    // Find pivot: row with largest absolute value in this column
    let maxRow = pivotRow;
    let maxVal = Math.abs(M[pivotRow][col]);
    for (let row = pivotRow + 1; row < m; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < tol) continue; // skip column if all entries are ~0

    // Swap rows
    if (maxRow !== pivotRow) {
      [M[pivotRow], M[maxRow]] = [M[maxRow], M[pivotRow]];
    }

    // Scale pivot row to have leading 1
    const scale = M[pivotRow][col];
    for (let j = col; j < n; j++) {
      M[pivotRow][j] /= scale;
    }

    // Eliminate all other rows in this column
    for (let row = 0; row < m; row++) {
      if (row === pivotRow) continue;
      const factor = M[row][col];
      if (Math.abs(factor) < tol) continue;
      for (let j = col; j < n; j++) {
        M[row][j] -= factor * M[pivotRow][j];
      }
    }

    pivotRow++;
  }

  // Clean near-zero values
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(M[i][j]) < tol) M[i][j] = 0;
    }
  }

  return M;
}

// =============================================================================
// 3. Matrix Rank (via RREF)
// =============================================================================

/**
 * Compute the rank of a matrix using RREF.
 *
 * The rank is the number of nonzero rows in the reduced row echelon form,
 * which equals the number of pivot columns.
 *
 * @param A - Matrix (m x n)
 * @param tol - Tolerance for zero detection (default 1e-10)
 * @returns Rank (number of linearly independent rows/columns)
 *
 * @example
 * matrixRank([[1,2],[2,4]]) // => 1
 * matrixRank([[1,0],[0,1]]) // => 2
 */
export function matrixRank(A: number[][], tol: f64 = 1e-10): i32 {
  const rref = rowReduce(A, tol);
  let r = 0;
  for (let i = 0; i < rref.length; i++) {
    let nonzero = false;
    for (let j = 0; j < rref[i].length; j++) {
      if (Math.abs(rref[i][j]) > tol) {
        nonzero = true;
        break;
      }
    }
    if (nonzero) r++;
  }
  return r;
}

// =============================================================================
// 4. Cholesky Decomposition
// =============================================================================

/**
 * Result of Cholesky decomposition.
 */
export interface CholeskyResult {
  /** Lower triangular matrix L such that A = L * L^T */
  L: number[][];
}

/**
 * Cholesky decomposition of a symmetric positive-definite matrix.
 *
 * Decomposes A = L * L^T where L is lower triangular with positive
 * diagonal entries. The matrix must be symmetric and positive definite,
 * otherwise an error is thrown.
 *
 * @param A - Symmetric positive-definite matrix (n x n)
 * @returns Object with L (lower triangular factor)
 * @throws Error if matrix is not symmetric or not positive definite
 *
 * @example
 * cholesky([[4,2],[2,3]])
 * // => { L: [[2,0],[1, Math.sqrt(2)]] }
 */
export function cholesky(A: number[][]): CholeskyResult {
  const n = assertSquare(A, 'cholesky');
  const tol = 1e-10;

  // Check symmetry
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[i][j] - A[j][i]) > tol) {
        throw new Error('cholesky: matrix must be symmetric');
      }
    }
  }

  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }

      if (i === j) {
        const diag = A[i][i] - sum;
        if (diag <= 0) {
          throw new Error('cholesky: matrix is not positive definite');
        }
        L[i][j] = Math.sqrt(diag);
      } else {
        L[i][j] = (A[i][j] - sum) / L[j][j];
      }
    }
  }

  return { L };
}

// =============================================================================
// 5. Hessenberg Form — Householder Reduction
// =============================================================================

/**
 * Result of Hessenberg reduction.
 */
export interface HessenbergResult {
  /** Upper Hessenberg matrix H */
  H: number[][];
  /** Orthogonal transformation matrix Q such that A = Q * H * Q^T */
  Q: number[][];
}

/**
 * Reduce a square matrix to upper Hessenberg form using Householder reflections.
 *
 * Computes Q and H such that A = Q * H * Q^T, where H is upper Hessenberg
 * (zero below the first subdiagonal) and Q is orthogonal.
 *
 * @param A - Square matrix (n x n)
 * @returns Object with H (Hessenberg) and Q (orthogonal)
 *
 * @example
 * const { H, Q } = hessenbergForm([[1,2,3],[4,5,6],[7,8,9]]);
 * // H is upper Hessenberg, Q is orthogonal, A = Q * H * Q^T
 */
export function hessenbergForm(A: number[][]): HessenbergResult {
  const n = assertSquare(A, 'hessenbergForm');
  const H = cloneMatrix(A);
  const Q = eye(n);

  for (let k = 0; k < n - 2; k++) {
    // Extract column below diagonal
    const x: number[] = [];
    for (let i = k + 1; i < n; i++) {
      x.push(H[i][k]);
    }

    // Compute Householder vector
    const len = x.length;
    let normX = 0;
    for (let i = 0; i < len; i++) normX += x[i] * x[i];
    normX = Math.sqrt(normX);

    if (normX < 1e-15) continue;

    const sign = x[0] >= 0 ? 1 : -1;
    const v = x.slice();
    v[0] += sign * normX;

    let normV = 0;
    for (let i = 0; i < len; i++) normV += v[i] * v[i];
    if (normV < 1e-30) continue;
    const beta = 2.0 / normV;

    // Apply P*H (left multiplication): H[k+1:n, k:n] -= beta * v * (v^T * H[k+1:n, k:n])
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = 0; i < len; i++) {
        dot += v[i] * H[k + 1 + i][j];
      }
      for (let i = 0; i < len; i++) {
        H[k + 1 + i][j] -= beta * v[i] * dot;
      }
    }

    // Apply H*P (right multiplication): H[0:n, k+1:n] -= beta * (H[0:n, k+1:n] * v) * v^T
    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let j = 0; j < len; j++) {
        dot += H[i][k + 1 + j] * v[j];
      }
      for (let j = 0; j < len; j++) {
        H[i][k + 1 + j] -= beta * dot * v[j];
      }
    }

    // Accumulate Q = Q * P: Q[0:n, k+1:n] -= beta * (Q[0:n, k+1:n] * v) * v^T
    for (let i = 0; i < n; i++) {
      let dot = 0;
      for (let j = 0; j < len; j++) {
        dot += Q[i][k + 1 + j] * v[j];
      }
      for (let j = 0; j < len; j++) {
        Q[i][k + 1 + j] -= beta * dot * v[j];
      }
    }
  }

  // Clean up entries below subdiagonal
  for (let i = 2; i < n; i++) {
    for (let j = 0; j < i - 1; j++) {
      H[i][j] = 0;
    }
  }

  return { H, Q };
}

// =============================================================================
// 6. Matrix Power — Repeated Squaring / Eigendecomposition
// =============================================================================

/**
 * Compute a matrix raised to an integer or fractional power.
 *
 * For non-negative integers: uses binary exponentiation (repeated squaring).
 * For p = -1: computes the matrix inverse via Gauss-Jordan elimination.
 * For negative integers: computes inverse then raises to |p|.
 * For fractional p: uses eigendecomposition A = V * diag(lambda) * V^{-1},
 * then A^p = V * diag(lambda^p) * V^{-1}.
 *
 * @param A - Square matrix (n x n)
 * @param p - Exponent (integer or fractional)
 * @returns A^p as an n x n matrix
 *
 * @example
 * matrixPower([[1,1],[0,1]], 3) // => [[1,3],[0,1]]
 * matrixPower([[4,0],[0,9]], 0.5) // => [[2,0],[0,3]]
 */
export async function matrixPower(A: number[][], p: f64): Promise<number[][]> {
  const n = assertSquare(A, 'matrixPower');

  // p = 0 -> identity
  if (p === 0) return eye(n);

  // p = 1 -> copy
  if (p === 1) return cloneMatrix(A);

  // Check if integer
  const isInt = Number.isInteger(p);

  if (isInt && p > 0) {
    return matPowBySquaring(A, p);
  }

  if (isInt && p < 0) {
    const inv = matrixInverse(A);
    if (p === -1) return inv;
    return matPowBySquaring(inv, -p);
  }

  // Fractional power via eigendecomposition
  return matPowFractional(A, p);
}

/** Binary exponentiation for positive integer power. */
async function matPowBySquaring(A: number[][], p: i32): Promise<number[][]> {
  const n = A.length;
  let result = eye(n);
  let base = cloneMatrix(A);
  let exp = p;

  while (exp > 0) {
    if (exp & 1) {
      result = await matMul(result, base);
    }
    base = await matMul(base, base);
    exp >>= 1;
  }

  return result;
}

/** Matrix inverse via Gauss-Jordan elimination. */
function matrixInverse(A: number[][]): number[][] {
  const n = A.length;
  // Augment [A | I]
  const M = A.map((row, i) => {
    const augmented = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) augmented[j] = row[j];
    augmented[n + i] = 1;
    return augmented;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-15) throw new Error('matrixPower: singular matrix cannot be inverted');
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const scale = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= scale;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = 0; j < 2 * n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row.slice(n));
}

/** Fractional power via eigendecomposition. */
async function matPowFractional(A: number[][], p: f64): Promise<number[][]> {
  const n = A.length;
  const { values, vectors } = eig(A, { computeVectors: true });

  // Check for complex eigenvalues (cannot raise to fractional power in reals)
  for (const v of values) {
    if (Math.abs(v.im) > 1e-10) {
      throw new Error('matrixPower: fractional power with complex eigenvalues not supported');
    }
    if (v.re < 0 && !Number.isInteger(p)) {
      throw new Error(
        'matrixPower: fractional power of matrix with negative eigenvalues not supported'
      );
    }
  }

  // V is stored as rows of eigenvectors; we need columns
  const V = vectors;
  const Vinv = matrixInverse(V);

  // D^p
  const Dp = eye(n);
  for (let i = 0; i < n; i++) {
    Dp[i][i] = Math.pow(values[i].re, p);
  }

  // A^p = V * D^p * V^{-1}
  return matMul(await matMul(V, Dp), Vinv);
}

// =============================================================================
// 7. Matrix Logarithm
// =============================================================================

/**
 * Compute the matrix logarithm.
 *
 * For matrices near the identity, uses the Padé approximant of log(I + X)
 * with inverse scaling and squaring. For general matrices, uses eigendecomposition:
 * log(A) = V * diag(log(lambda_i)) * V^{-1}.
 *
 * @param A - Square matrix with positive real eigenvalues
 * @returns log(A) as an n x n matrix
 *
 * @example
 * // log(exp([[0,1],[0,0]])) should recover [[0,1],[0,0]]
 * matrixLog([[1,1],[0,1]]) // => [[0,1],[0,0]]
 */
export async function matrixLog(A: number[][]): Promise<number[][]> {
  assertSquare(A, 'matrixLog');

  // Use inverse scaling and squaring: repeatedly take square roots
  // until A^(1/2^s) is close to I, then use Taylor series, then scale back.
  return matLogScalingSquaring(A);
}

/** Matrix logarithm via inverse scaling and squaring + Taylor series. */
async function matLogScalingSquaring(A: number[][]): Promise<number[][]> {
  const n = A.length;

  // Inverse scaling: repeatedly take square roots until A^(1/2^s) is close to I
  let M = cloneMatrix(A);
  let numSquares = 0;
  const maxSquares = 64;

  while (numSquares < maxSquares) {
    let normDiff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const diff = M[i][j] - (i === j ? 1 : 0);
        normDiff = Math.max(normDiff, Math.abs(diff));
      }
    }
    if (normDiff < 0.25) break;
    M = await matrixSqrtNewton(M);
    numSquares++;
  }

  // Taylor series: log(I + X) = X - X^2/2 + X^3/3 - ...
  const X: number[][] = cloneMatrix(M);
  for (let i = 0; i < n; i++) X[i][i] -= 1;

  const logM = cloneMatrix(X);
  let Xk = cloneMatrix(X);
  const terms = 20;
  for (let k = 2; k <= terms; k++) {
    Xk = await matMul(Xk, X);
    const sign = k % 2 === 0 ? -1 : 1;
    // Check if Xk is negligible
    let normXk = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        normXk = Math.max(normXk, Math.abs(Xk[i][j]));
      }
    }
    if (normXk < 1e-16) break;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        logM[i][j] += (sign / k) * Xk[i][j];
      }
    }
  }

  // Undo scaling: multiply by 2^numSquares
  const scale = Math.pow(2, numSquares);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      logM[i][j] *= scale;
    }
  }

  return logM;
}

/**
 * Square root of a matrix via Newton iteration (product form).
 * Uses Y_{k+1} = 0.5 * (Y_k + A * Y_k^{-1}) starting from Y_0 = A.
 * Falls back to eigendecomposition-based sqrt if Newton fails.
 */
async function matrixSqrtNewton(A: number[][]): Promise<number[][]> {
  const n = A.length;

  // Try Newton iteration: Y_{k+1} = 0.5 * (Y_k + A * Y_k^{-1})
  let Y = cloneMatrix(A);

  for (let iter = 0; iter < 100; iter++) {
    let Yinv: number[][];
    try {
      Yinv = matrixInverse(Y);
    } catch {
      // Y is singular — fall back to eigendecomposition
      return matrixSqrtEig(A);
    }

    const AYinv = await matMul(A, Yinv);
    const Ynew = Array.from({ length: n }, () => new Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        Ynew[i][j] = (Y[i][j] + AYinv[i][j]) / 2;
      }
    }

    let diff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        diff = Math.max(diff, Math.abs(Ynew[i][j] - Y[i][j]));
      }
    }

    Y = Ynew;
    if (diff < 1e-14) break;
  }

  return Y;
}

/** Square root via eigendecomposition (fallback for singular/defective matrices). */
async function matrixSqrtEig(A: number[][]): Promise<number[][]> {
  const n = A.length;
  const { values, vectors } = eig(A, { computeVectors: true });

  for (const v of values) {
    if (Math.abs(v.im) > 1e-10 || v.re < 0) {
      throw new Error('matrixLog: cannot compute square root — negative or complex eigenvalues');
    }
  }

  const V = vectors;
  let Vinv: number[][];
  try {
    Vinv = matrixInverse(V);
  } catch {
    // Defective matrix — use series expansion for sqrt(I + X) where X = A - I
    // sqrt(I + X) ≈ I + X/2 - X^2/8 + X^3/16 - ...
    const X = cloneMatrix(A);
    for (let i = 0; i < n; i++) X[i][i] -= 1;
    const result = eye(n);
    let Xk = eye(n);
    const coeffs = [1, 0.5, -1 / 8, 1 / 16, -5 / 128, 7 / 256, -21 / 1024];
    for (let k = 1; k < coeffs.length; k++) {
      Xk = await matMul(Xk, X);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          result[i][j] += coeffs[k] * Xk[i][j];
        }
      }
    }
    return result;
  }

  const D = eye(n);
  for (let i = 0; i < n; i++) {
    D[i][i] = Math.sqrt(values[i].re);
  }

  return matMul(await matMul(V, D), Vinv);
}

// =============================================================================
// 8. Polar Decomposition — via SVD
// =============================================================================

/**
 * Result of polar decomposition.
 */
export interface PolarResult {
  /** Unitary factor U (orthogonal for real matrices) */
  U: number[][];
  /** Positive semi-definite factor P */
  P: number[][];
}

/**
 * Compute the polar decomposition A = U * P.
 *
 * U is unitary (orthogonal for real matrices) and P is symmetric positive
 * semi-definite. Computed via SVD: if A = W*S*V^T, then U = W*V^T and P = V*S*V^T.
 *
 * @param A - Square matrix (n x n)
 * @returns Object with U (unitary) and P (positive semi-definite)
 *
 * @example
 * const { U, P } = polarDecomposition([[1,0],[0,2]]);
 * // U is identity (or close), P = [[1,0],[0,2]]
 */
export async function polarDecomposition(A: number[][]): Promise<PolarResult> {
  const n = assertSquare(A, 'polarDecomposition');

  const { U: W, S, V } = svd(A);

  // U_polar = W * V^T
  const Vt = transpose(V);
  const Upolar = await matMul(W, Vt);

  // P = V * S * V^T
  const Smat = eye(n);
  for (let i = 0; i < Math.min(S.length, n); i++) {
    Smat[i][i] = S[i];
  }
  const P = await matMul(await matMul(V, Smat), Vt);

  return { U: Upolar, P };
}

// =============================================================================
// 9. Jordan Normal Form
// =============================================================================

/**
 * Result of Jordan decomposition.
 */
export interface JordanResult {
  /** Jordan normal form matrix J */
  J: number[][];
  /** Transformation matrix P such that A = P * J * P^{-1} */
  P: number[][];
}

/**
 * Compute the Jordan normal form of a square matrix.
 *
 * For matrices with distinct eigenvalues, this is simply the diagonal
 * matrix of eigenvalues. For repeated eigenvalues, Jordan blocks are
 * formed by analyzing the null spaces of (A - lambda*I)^k.
 *
 * Note: This implementation works best for matrices with real eigenvalues
 * and reasonably well-conditioned eigenvectors. For matrices with complex
 * eigenvalues, only the real parts are used.
 *
 * @param A - Square matrix (n x n)
 * @returns Object with J (Jordan form) and P (transformation matrix)
 *
 * @example
 * // Diagonal matrix with distinct eigenvalues
 * jordanForm([[2,0],[0,3]]) // => { J: [[2,0],[0,3]], P: ... }
 */
export async function jordanForm(A: number[][]): Promise<JordanResult> {
  const n = assertSquare(A, 'jordanForm');
  const { values, vectors } = eig(A, { computeVectors: true });

  // Group eigenvalues by value (cluster nearby eigenvalues)
  const tol = 1e-8;
  const clusters: { value: f64; indices: i32[] }[] = [];

  for (let i = 0; i < values.length; i++) {
    const re = values[i].re;
    let found = false;
    for (const cluster of clusters) {
      if (Math.abs(cluster.value - re) < tol) {
        cluster.indices.push(i);
        found = true;
        break;
      }
    }
    if (!found) {
      clusters.push({ value: re, indices: [i] });
    }
  }

  // Sort clusters by eigenvalue
  clusters.sort((a, b) => a.value - b.value);

  // Build Jordan form
  const J: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const Pcols: number[][] = []; // columns of P

  let pos = 0;
  for (const cluster of clusters) {
    const lambda = cluster.value;
    const algebraicMult = cluster.indices.length;

    // Compute geometric multiplicity: dim(null(A - lambda*I))
    const AminusLI = cloneMatrix(A);
    for (let i = 0; i < n; i++) AminusLI[i][i] -= lambda;

    const geoMult = n - matrixRankInternal(AminusLI, tol);

    if (geoMult >= algebraicMult) {
      // All eigenvectors exist — diagonal block
      for (let k = 0; k < algebraicMult; k++) {
        J[pos + k][pos + k] = lambda;
        Pcols.push(vectors[cluster.indices[k]]);
      }
    } else {
      // Need Jordan blocks — find generalized eigenvectors
      const blocks = await buildJordanBlocks(A, lambda, algebraicMult, geoMult, n, tol);
      for (const block of blocks) {
        for (let k = 0; k < block.size; k++) {
          J[pos + k][pos + k] = lambda;
          if (k < block.size - 1) {
            J[pos + k][pos + k + 1] = 1; // superdiagonal 1s
          }
          Pcols.push(block.vectors[k]);
        }
        pos += block.size;
      }
      continue; // pos already advanced
    }

    pos += algebraicMult;
  }

  // Assemble P from columns
  const P = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (j < Pcols.length ? Pcols[j][i] : i === j ? 1 : 0))
  );

  return { J, P };
}

/** Compute rank for internal use (avoids circular dependency). */
function matrixRankInternal(A: number[][], tol: f64): i32 {
  const rref = rowReduce(A, tol);
  let r = 0;
  for (let i = 0; i < rref.length; i++) {
    for (let j = 0; j < rref[i].length; j++) {
      if (Math.abs(rref[i][j]) > tol) {
        r++;
        break;
      }
    }
  }
  return r;
}

/** Build Jordan blocks for a repeated eigenvalue. */
async function buildJordanBlocks(
  A: number[][],
  lambda: f64,
  algebraicMult: i32,
  geoMult: i32,
  n: i32,
  tol: f64
): Promise<Array<{ size: i32; vectors: number[][] }>> {
  // Compute null spaces of (A - lambda*I)^k for increasing k
  const AminusLI = cloneMatrix(A);
  for (let i = 0; i < n; i++) AminusLI[i][i] -= lambda;

  const nullDims: i32[] = [];
  let power = eye(n);
  for (let k = 1; k <= algebraicMult; k++) {
    power = await matMul(power, AminusLI);
    const nullDim = n - matrixRankInternal(power, tol);
    nullDims.push(nullDim);
    if (nullDim >= algebraicMult) break;
  }

  // Determine block sizes from null space dimensions
  // nullDims[k-1] = sum of min(blockSize, k) across all blocks
  const blockSizes: i32[] = [];
  const numBlocks = geoMult;

  if (numBlocks === 1) {
    // Single Jordan block of size algebraicMult
    blockSizes.push(algebraicMult);
  } else {
    // Distribute: use differences of null space dimensions
    // Number of blocks of size >= k is nullDims[k] - nullDims[k-1]
    const sizes: i32[] = [];
    for (let k = 0; k < nullDims.length; k++) {
      const prevDim = k === 0 ? 0 : nullDims[k - 1];
      const newVectors = nullDims[k] - prevDim;
      for (let j = 0; j < newVectors; j++) {
        sizes.push(k + 1);
      }
    }
    // Take the correct number of blocks
    sizes.sort((a, b) => b - a);
    let remaining = algebraicMult;
    for (const s of sizes) {
      if (remaining <= 0) break;
      const size = Math.min(s, remaining);
      blockSizes.push(size);
      remaining -= size;
    }
    // Fill remaining if needed
    while (remaining > 0) {
      blockSizes.push(1);
      remaining--;
    }
  }

  // For each block, compute generalized eigenvectors
  const blocks: Array<{ size: i32; vectors: number[][] }> = [];
  for (const size of blockSizes) {
    const vecs: number[][] = [];
    // Start with a kernel vector
    const kernel = findKernelVector(AminusLI, n, tol);
    vecs.push(kernel);

    // Chain: solve (A - lambda*I) * v_{k+1} = v_k
    for (let k = 1; k < size; k++) {
      const v = await solveApprox(AminusLI, vecs[k - 1], n);
      vecs.push(v);
    }

    // Reverse so the eigenvector comes first
    vecs.reverse();
    blocks.push({ size, vectors: vecs });
  }

  return blocks;
}

/** Find a vector in the kernel of A. */
function findKernelVector(A: number[][], n: i32, tol: f64): number[] {
  const rref = rowReduce(A, tol);

  // Find free columns (those without a pivot)
  const pivotCols = new Set<i32>();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(rref[i][j]) > tol) {
        pivotCols.add(j);
        break;
      }
    }
  }

  // First free column
  let freeCol = -1;
  for (let j = 0; j < n; j++) {
    if (!pivotCols.has(j)) {
      freeCol = j;
      break;
    }
  }

  if (freeCol === -1) {
    // Fallback: return last column or unit vector
    const v = new Array(n).fill(0);
    v[n - 1] = 1;
    return v;
  }

  // Construct kernel vector from RREF
  const v = new Array(n).fill(0);
  v[freeCol] = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (Math.abs(rref[i][j]) > tol) {
        // This is the pivot column for row i
        v[j] = -rref[i][freeCol];
        break;
      }
    }
  }

  // Normalize
  let norm = 0;
  for (let i = 0; i < n; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-15) {
    for (let i = 0; i < n; i++) v[i] /= norm;
  }

  return v;
}

/** Least-squares approximate solve for A*x = b. */
async function solveApprox(A: number[][], b: number[], n: i32): Promise<number[]> {
  // Solve via A^T * A * x = A^T * b (normal equations)
  const At = transpose(A);
  const AtA = await matMul(At, A);
  const Atb: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Atb[i] += At[i][j] * b[j];
    }
  }

  // Regularize to avoid singularity
  for (let i = 0; i < n; i++) {
    AtA[i][i] += 1e-12;
  }

  // Solve via Gauss-Jordan
  const M = AtA.map((row, i) => [...row, Atb[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [M[col], M[maxRow]] = [M[maxRow], M[col]];
    const scale = M[col][col];
    if (Math.abs(scale) < 1e-30) continue;
    for (let j = 0; j <= n; j++) M[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      for (let j = 0; j <= n; j++) M[row][j] -= factor * M[col][j];
    }
  }

  const x = M.map((row) => row[n]);

  // Normalize
  let norm = 0;
  for (let i = 0; i < n; i++) norm += x[i] * x[i];
  norm = Math.sqrt(norm);
  if (norm > 1e-15) {
    for (let i = 0; i < n; i++) x[i] /= norm;
  }

  return x;
}

// =============================================================================
// 10. Typed SVD-derived matrix operations (Slice 5.2)
// =============================================================================

/**
 * Compute the Moore-Penrose pseudoinverse of a DenseMatrix (Option A — Slice 4.2 primitive).
 *
 * Delegates to the DenseMatrix-based `matrixPinv` from `@danielsimonjr/mathts-matrix`,
 * which uses full SVD with `rcond · max(S)` singular-value thresholding.
 *
 * @example
 * const A = DenseMatrix.fromArray([[1,2],[3,4],[5,6]]);
 * const Ap = pinv(A);           // shape 2x3
 * const Ap2 = pinv(A, { rcond: 1e-6 });
 */
export const pinv = mathTyped('pinv', {
  DenseMatrix: (A: Parameters<typeof matrixPinv>[0]) => matrixPinv(A),
  'DenseMatrix, Object': (A: Parameters<typeof matrixPinv>[0], opts: PinvOptions) =>
    matrixPinv(A, opts),
});

/**
 * Compute the condition number of a matrix (ratio σ_max / σ_min via SVD).
 *
 * Returns `Infinity` for singular or rank-deficient matrices.
 *
 * @example
 * cond([[1,0],[0,2]])  // => 2
 * cond([[1,2],[2,4]])  // => Infinity
 */
export const cond = mathTyped('cond', {
  Array: (A: number[][]) => matrixCond(A),
});

/**
 * Compute the spectral norm (2-norm) of a matrix — the largest singular value.
 *
 * @example
 * norm2([[3,0],[0,2]])  // => 3
 */
export const norm2 = mathTyped('norm2', {
  Array: (A: number[][]) => matrixNorm2(A),
});

/**
 * Compute the Frobenius norm of a matrix — `sqrt(sum(A_ij²))`.
 *
 * @example
 * normFro([[1,0],[0,1]])  // => sqrt(2) ≈ 1.414
 */
export const normFro = mathTyped('normFro', {
  Array: (A: number[][]) => matrixNormFro(A),
});

/**
 * Compute a rank-k approximation of a matrix using truncated SVD.
 *
 * Returns the best rank-k approximation in the Frobenius-norm sense:
 * `A_k = U[:, :k] * diag(S[:k]) * V[:, :k]^T`.
 *
 * @example
 * lowRankApprox([[1,2],[3,4],[5,6]], 1)
 */
export const lowRankApprox = mathTyped('lowRankApprox', {
  'Array, number': (A: number[][], k: number) => matrixLowRankApprox(A, k),
});

/**
 * Return the singular values of a matrix in descending order.
 *
 * The result has length `min(m, n)` and all values are non-negative.
 *
 * @example
 * singularValues([[3,0],[0,2]])  // => [3, 2]
 */
export const singularValues = mathTyped('singularValues', {
  Array: (A: number[][]) => matrixSingularValues(A),
});

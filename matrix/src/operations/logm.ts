/**
 * Matrix Logarithm — Schur-Padé inverse scaling-and-squaring (Slices 5.9a + 6.1)
 *
 * Implements the Schur-Padé algorithm based on:
 *   Higham (2008) "Functions of Matrices: Theory and Computation," Chapter 11
 *   (Algorithm 11.10).
 *
 * Algorithm (general Schur-based path, Slice 6.1):
 *   1. Schur decompose: A = Q · T · Q^T.
 *   2. Repeatedly take matrix square roots of T (Björck recurrence on upper-
 *      triangular matrices) until ||T^{1/2^k} - I||_1 < 0.25.
 *   3. Evaluate log(I + X) via 16-point Gauss-Legendre quadrature.
 *   4. Scale back by 2^k; rotate by Q: logm(A) = Q · (2^k · log(T^{1/2^k})) · Q^T.
 *
 * For the eig-based fallback (diagonalisable matrices with positive real
 * eigenvalues): logm(A) = V · diag(log(λ)) · V^{-1}.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { eig } from './eig.js';
import { schurInternal } from './schur.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Create n × n identity matrix. */
function eye(n: number): number[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

/** Matrix multiply. */
function matMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) C[i][j] += aik * B[k][j];
    }
  return C;
}

/** Transpose a matrix. */
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/** Scale a matrix by a scalar. */
function matScale(A: number[][], c: number): number[][] {
  return A.map((row) => row.map((v) => v * c));
}

/** Infinity-norm (max absolute value — quick proxy for "near I" test). */
function normInf(A: number[][]): number {
  let mx = 0;
  for (const row of A) for (const v of row) if (Math.abs(v) > mx) mx = Math.abs(v);
  return mx;
}

/** 1-norm (max column sum). */
function norm1(A: number[][]): number {
  const n = A[0].length;
  let mx = 0;
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (const row of A) s += Math.abs(row[j]);
    if (s > mx) mx = s;
  }
  return mx;
}

/** Matrix inverse via Gauss-Jordan. Returns null on singular input. */
function matInv(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => {
    const r = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) r[j] = row[j];
    r[n + i] = 1;
    return r;
  });

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

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-15) return null; // singular

    for (let j = 0; j < 2 * n; j++) M[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = M[row][col];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[row][j] -= f * M[col][j];
    }
  }

  return M.map((row) => row.slice(n));
}

/**
 * Matrix square root via Newton iteration (product form).
 * Y_{k+1} = (Y_k + A * Y_k^{-1}) / 2, starting from Y_0 = I.
 * Converges for matrices with no eigenvalues on the negative real axis.
 */
function matSqrt(A: number[][]): number[][] {
  const n = A.length;
  let Y = eye(n); // start from identity — better convergence than Y_0 = A

  for (let iter = 0; iter < 150; iter++) {
    const Yinv = matInv(Y);
    if (Yinv === null) break; // stop if singular

    const AYinv = matMul(A, Yinv);
    const Ynew = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (Y[i][j] + AYinv[i][j]) / 2)
    );

    let diff = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) diff = Math.max(diff, Math.abs(Ynew[i][j] - Y[i][j]));

    Y = Ynew;
    if (diff < 1e-14) break;
  }

  return Y;
}

// ---------------------------------------------------------------------------
// Padé-7 approximant for log(I + X) — valid when ||X||_1 < 1
//
// Coefficients from Higham (2008) Table 11.1, degree m=7:
//   p(t) = sum_{k=0}^{7} p_k * t^k
//   q(t) = sum_{k=0}^{7} q_k * t^k
//   log(I + X) ≈ p(X) * q(X)^{-1}  (Padé [7/7] of log(1+x))
//
// We use the partial-fraction / Gauss-Legendre quadrature form:
//   log(I + X) = X * integral_0^1 (I + t*X)^{-1} dt
// approximated by 7-point Gauss-Legendre quadrature.
// ---------------------------------------------------------------------------

// 16-point Gauss-Legendre nodes and weights on [0,1]
// Source: standard GL quadrature tables (Abramowitz & Stegun or DLMF §3.5)
// Transformed from [-1,1] to [0,1]: x_i = (1 + t_i)/2, w_i = w_i/2
const GL16_NODES = [
  0.00529953674226076, 0.02771248846338012, 0.06718439880608424, 0.12229779582258389,
  0.19106187500306076, 0.27099161117837625, 0.35919822461709316, 0.45249373519380166,
  0.54750626480619834, 0.64080177538290684, 0.72900838882162375, 0.80893812499693924,
  0.87770220417741611, 0.93281560119391576, 0.97228751153661988, 0.99470046325773924,
];
const GL16_WEIGHTS = [
  0.01357622970130523, 0.03112676196932377, 0.04757925584079793, 0.06231448562776694,
  0.07479799440828515, 0.08457825969750125, 0.09130170752246166, 0.09472530522753626,
  0.09472530522753626, 0.09130170752246166, 0.08457825969750125, 0.07479799440828515,
  0.06231448562776694, 0.04757925584079793, 0.03112676196932377, 0.01357622970130523,
];

/** Solve (M) * x = b where M is n×n and b is n×1 (returns x). */
function solveCol(M: number[][], b: number[]): number[] {
  const n = M.length;
  const Aug = M.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(Aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(Aug[row][col]) > maxVal) {
        maxVal = Math.abs(Aug[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [Aug[col], Aug[maxRow]] = [Aug[maxRow], Aug[col]];

    const pivot = Aug[col][col];
    if (Math.abs(pivot) < 1e-30) continue;

    for (let j = col; j <= n; j++) Aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = Aug[row][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) Aug[row][j] -= f * Aug[col][j];
    }
  }

  return Aug.map((row) => row[n]);
}

/**
 * Evaluate log(I + X) via 16-point Gauss-Legendre quadrature:
 *   log(I + X) = X * integral_0^1 (I + t*X)^{-1} dt
 *
 * Each quadrature point requires solving an n×n linear system per column.
 * Requires ||X|| < 1 for accuracy (inverse-scaling ensures this).
 * 16-point GL gives ~32nd-order accuracy for smooth integrands.
 */
function logPade(X: number[][]): number[][] {
  const n = X.length;
  const result: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const I = eye(n);

  for (let q = 0; q < GL16_NODES.length; q++) {
    const t = GL16_NODES[q];
    const w = GL16_WEIGHTS[q];

    // Build M = I + t * X
    const M: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => I[i][j] + t * X[i][j])
    );

    // Solve M * col_j(Y) = col_j(X) for each column j
    // Then result += w * Y
    for (let j = 0; j < n; j++) {
      const xCol = X.map((row) => row[j]);
      const yCol = solveCol(M, xCol);
      for (let i = 0; i < n; i++) result[i][j] += w * yCol[i];
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Upper-triangular square root (Björck recurrence) for Schur-based logm
// ---------------------------------------------------------------------------

/**
 * Compute the upper-triangular square root U of an upper-triangular matrix T
 * (T assumed to be a 1×1 or all-real-diagonal block — i.e., T is strictly
 * upper triangular with positive diagonal entries).
 *
 * Diagonal: U_ii = sqrt(T_ii).
 * Super-diagonal: U_ij = (T_ij - sum_{k=i+1}^{j-1} U_ik * U_kj) / (U_ii + U_jj).
 *
 * Used by the inverse-scaling phase in logmSchur to take repeated square roots
 * of an upper-triangular Schur factor. Only applicable when all diagonal
 * entries are strictly positive (no 2×2 complex-eigenvalue blocks).
 *
 * Ref: Björck & Hammarling (1983); Higham (2008) §6.2 eq. (6.4)–(6.5).
 */
function sqrtUpperTriangular(T: number[][]): number[][] | null {
  const n = T.length;
  const U: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    if (T[i][i] < 0) return null;
    U[i][i] = Math.sqrt(T[i][i]);
  }

  for (let j = 1; j < n; j++) {
    for (let i = j - 1; i >= 0; i--) {
      let sum = 0;
      for (let k = i + 1; k < j; k++) sum += U[i][k] * U[k][j];
      const denom = U[i][i] + U[j][j];
      U[i][j] = Math.abs(denom) < 1e-14 ? 0 : (T[i][j] - sum) / denom;
    }
  }

  return U;
}

/**
 * Matrix multiply A × B (2-D plain arrays).
 */
function matMulArr(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n; j++) C[i][j] += aik * B[k][j];
    }
  return C;
}

function transposeArr(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/**
 * Check whether a quasi-upper-triangular Schur form T has any 2×2 blocks
 * (i.e. any complex-conjugate eigenvalue pair). Returns true if all diagonal
 * blocks are 1×1 (all real eigenvalues).
 */
function isStrictlyUpperTriangular(T: number[][]): boolean {
  const n = T.length;
  for (let i = 1; i < n; i++) {
    if (Math.abs(T[i][i - 1]) > 1e-12) return false;
  }
  return true;
}

/**
 * Schur-Padé logm: Higham (2008) Algorithm 11.10.
 *
 * 1. Schur decompose A = Q · T · Q^T.
 * 2. Take repeated triangular square roots of T until ||T^{1/2^k} - I||_1 < tol.
 * 3. Apply Padé quadrature for log(I + X) where X = T^{1/2^k} - I.
 * 4. Scale back: logm(T) = 2^k · log(T^{1/2^k}).
 * 5. Rotate: logm(A) = Q · logm(T) · Q^T.
 *
 * Restricted to matrices whose Schur form T has all-positive diagonal (i.e.
 * no 2×2 blocks — complex eigenvalues — and no negative 1×1 blocks). If T
 * has complex-conjugate 2×2 blocks, falls through to the eig-based path.
 *
 * Returns null if the matrix cannot be handled by the Schur-triangular path.
 */
function logmSchur(A: number[][], tol: number): number[][] | null {
  const { H: T, Q } = schurInternal(A);

  // Only handle all-real-diagonal Schur forms here. Complex-eigenvalue blocks
  // require a more involved 2×2 block log (deferred; eig path throws instead).
  if (!isStrictlyUpperTriangular(T)) return null;

  // Check that all diagonal entries are strictly positive
  const n = T.length;
  for (let i = 0; i < n; i++) {
    if (T[i][i] <= 1e-14) return null;
  }

  // Inverse-scaling phase: repeatedly take upper-triangular sqrt of T
  let M = T;
  let numSqrt = 0;
  const maxSqrt = 64;

  while (numSqrt < maxSqrt) {
    const MminI = M.map((row, i) => row.map((v, j) => v - (i === j ? 1 : 0)));
    if (norm1(MminI) < tol) break;

    const sqrtM = sqrtUpperTriangular(M);
    if (sqrtM === null || !isFinite(normInf(sqrtM))) break;

    M = sqrtM;
    numSqrt++;
  }

  // Padé quadrature on log(I + X) where X = M - I
  const MminI = M.map((row, i) => row.map((v, j) => v - (i === j ? 1 : 0)));
  if (norm1(MminI) >= tol) return null; // did not converge

  let logT = logPade(MminI);

  // Scale back: multiply by 2^numSqrt
  if (numSqrt > 0) {
    const scale = Math.pow(2, numSqrt);
    logT = logT.map((row) => row.map((v) => v * scale));
  }

  // Rotate: logm(A) = Q * logm(T) * Q^T
  const Qt = transposeArr(Q);
  return matMulArr(matMulArr(Q, logT), Qt);
}

// ---------------------------------------------------------------------------
// Eig-based fallback for general matrices
// ---------------------------------------------------------------------------

/**
 * Pre-validate eigenvalues: throw early if any eigenvalue is non-positive
 * or complex. This is called upfront to avoid false near-identity convergence
 * in the scaling loop due to floating-point noise amplification.
 */
function validateEigenvalues(A: number[][]): void {
  const { values } = eig(A, { computeVectors: false });
  for (const v of values) {
    if (Math.abs(v.im) > 1e-8) {
      throw new Error(
        'matrixLogm: complex eigenvalues detected — matrix logarithm not supported for this matrix ' +
          '(Slice 5.9a; full Schur-based logm deferred to Slice 5.9b)'
      );
    }
    if (v.re <= 1e-14) {
      throw new Error(
        'matrixLogm: non-positive eigenvalue detected — principal logarithm is undefined ' +
          '(eigenvalue ≈ ' +
          v.re +
          ')'
      );
    }
  }
}

/**
 * Compute logm via eigendecomposition:
 *   logm(A) = V * diag(log(λ)) * V^{-1}
 *
 * Throws if any eigenvalue has non-positive real part, imaginary part,
 * or if V is singular (non-diagonalisable matrix).
 *
 * This is the Slice 5.9a implementation — the Schur-based general case
 * is deferred to Slice 5.9b.
 */
function logmEig(A: number[][]): number[][] {
  const n = A.length;
  const { values, vectors } = eig(A, { computeVectors: true });

  for (const v of values) {
    if (Math.abs(v.im) > 1e-8) {
      throw new Error(
        'matrixLogm: complex eigenvalues detected — matrix logarithm not supported for this matrix ' +
          '(Slice 5.9a eig-based fallback; full Schur-based logm deferred to Slice 5.9b)'
      );
    }
    if (v.re <= 0) {
      throw new Error(
        'matrixLogm: non-positive eigenvalue detected — principal logarithm is undefined ' +
          '(eigenvalue = ' +
          v.re +
          ')'
      );
    }
  }

  // eig.ts stores eigenvectors as rows: vectors[i] = v_i.
  // Q = transpose(V) has eigenvectors as columns (standard form).
  // A = Q * D * Q^{-1} => logm(A) = Q * diag(log(λ)) * Q^{-1}
  const V = vectors; // eigenvectors as rows
  const Q = transpose(V); // eigenvectors as columns
  const Qinv = matInv(Q);
  if (Qinv === null) {
    throw new Error(
      'matrixLogm: eigenvector matrix is singular — matrix appears to be non-diagonalisable ' +
        '(Slice 5.9a limitation; full Schur-based implementation deferred to Slice 5.9b)'
    );
  }

  // D = diag(log(λ))
  const D = eye(n);
  for (let i = 0; i < n; i++) D[i][i] = Math.log(values[i].re);

  // logm(A) = Q * D * Q^{-1}
  return matMul(matMul(Q, D), Qinv);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LogmOptions {
  /**
   * Tolerance for the "near-identity" test.
   * Default: 0.25 (||M - I||_1 < tol triggers Padé path).
   */
  nearIdentityTol?: number;
}

/**
 * Compute the principal matrix logarithm of a square DenseMatrix.
 *
 * Algorithm (Slice 5.9a — inverse scaling-and-squaring + Padé quadrature):
 *   1. Repeatedly take matrix square roots until ||M - I||_1 < nearIdentityTol.
 *   2. Evaluate log(I + X) = X * ∫₀¹ (I + tX)^{-1} dt via 7-pt Gauss-Legendre.
 *   3. Scale back: logm(A) = 2^k * log(A^{1/2^k}).
 *
 * Falls back to eigendecomposition if the square-root sequence diverges
 * (i.e., if the matrix has no non-positive eigenvalues and is diagonalisable).
 *
 * Limitations (deferred to Slice 5.9b):
 *   - Matrices with non-positive real eigenvalues: principal log is undefined.
 *   - Matrices with complex eigenvalues: throws.
 *   - Non-diagonalisable (defective) matrices: eig-fallback also throws.
 *   - Full Schur-based inverse-scaling-and-squaring for general non-normal
 *     matrices.
 *
 * @param A - Square DenseMatrix with positive real eigenvalues.
 * @returns logm(A) as a DenseMatrix.
 * @throws Error for matrices with non-positive or complex eigenvalues.
 *
 * @example
 * // logm(I) = 0
 * matrixLogm(DenseMatrix.eye(3)) // => zero matrix
 *
 * @example
 * // Round-trip: expm(logm(A)) ≈ A
 * const A = DenseMatrix.fromArray([[4, 1], [0, 9]]);
 * const logA = matrixLogm(A);
 * // expm(logA) ≈ A  (to machine precision for diagonalisable A)
 */
export function matrixLogm(A: DenseMatrix, opts?: LogmOptions): DenseMatrix {
  const n = A.rows;
  if (n !== A.cols) throw new Error(`matrixLogm: matrix must be square (got ${A.rows}×${A.cols})`);
  if (n === 0) return DenseMatrix.zeros(0, 0);

  const tol = opts?.nearIdentityTol ?? 0.25;
  const Aarr = A.toArray();

  // ----- Schur-Padé path (Slice 6.1) -----
  // Handles: real positive eigenvalues, repeated eigenvalues, defective matrices.
  // Falls through (returns null) for complex-eigenvalue Schur blocks.
  const schurResult = logmSchur(Aarr, tol);
  if (schurResult !== null) {
    const data = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) data[i * n + j] = schurResult[i][j];
    return new DenseMatrix(n, n, data);
  }

  // ----- Eig-based fallback -----
  // Validates eigenvalues (throws for non-positive or complex) and uses
  // V * diag(log λ) * V^{-1} for diagonalisable matrices.
  validateEigenvalues(Aarr);

  // ----- Inverse-scaling phase (original path) -----
  let M = Aarr;
  let numSqrt = 0;
  const maxSqrt = 64;

  while (numSqrt < maxSqrt) {
    const MminI = M.map((row, i) => row.map((v, j) => v - (i === j ? 1 : 0)));
    if (norm1(MminI) < tol) break;

    const sqrtM = matSqrt(M);
    if (!isFinite(normInf(sqrtM))) break;

    M = sqrtM;
    numSqrt++;
  }

  let logM: number[][];

  const MminI = M.map((row, i) => row.map((v, j) => v - (i === j ? 1 : 0)));
  if (norm1(MminI) < tol) {
    logM = logPade(MminI);
  } else {
    logM = logmEig(Aarr);
    numSqrt = 0;
  }

  if (numSqrt > 0) {
    logM = matScale(logM, Math.pow(2, numSqrt));
  }

  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) data[i * n + j] = logM[i][j];

  return new DenseMatrix(n, n, data);
}

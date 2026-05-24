/**
 * Matrix Square Root — Hybrid approach (Slice 5.9a)
 *
 * Computes the principal square root of a square matrix.
 *
 * Algorithm (Slice 5.9a):
 *   1. Validate: compute eigenvalues via `eig`. Throw if any eigenvalue has
 *      negative real part or non-negligible imaginary part.
 *   2. For symmetric positive semi-definite (SPSD) matrices: use the symmetric
 *      eigendecomposition with Gram-Schmidt re-orthogonalisation of eigenvectors
 *      to handle repeated eigenvalues correctly.
 *   3. For general diagonalisable A: use Newton iteration
 *        Y_{k+1} = (Y_k + A * Y_k^{-1}) / 2, starting from Y_0 = I.
 *      Falls back to eig-based formula if Newton diverges.
 *
 * Limitations (deferred to Slice 5.9b):
 *   - Matrices with negative eigenvalues: complex square root not supported.
 *   - Non-diagonalisable (defective) matrices (Newton may fail to converge).
 *   - Full Schur-based Björck-Hammarling for general matrices.
 *
 * References:
 *   - Higham (2008) "Functions of Matrices" §6.
 *   - Björck & Hammarling (1983) "A Schur method for the square root of a matrix."
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { eig } from './eig.js';

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

/**
 * Symmetrize a matrix: return (A + A^T) / 2.
 */
function symmetrize(A: number[][]): number[][] {
  const n = A.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (A[i][j] + A[j][i]) / 2)
  );
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
 * Gram-Schmidt orthogonalisation of the columns of A.
 * Returns Q with orthonormal columns.
 */
function gramSchmidt(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  const Q: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));

  for (let j = 0; j < n; j++) {
    // Copy column j
    const v: number[] = A.map((row) => row[j]);

    // Subtract projections onto previous columns
    for (let k = 0; k < j; k++) {
      let dot = 0;
      for (let i = 0; i < m; i++) dot += Q[i][k] * v[i];
      for (let i = 0; i < m; i++) v[i] -= dot * Q[i][k];
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < m; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm);

    if (norm < 1e-14) {
      // Near-zero column — use unit vector as fallback
      for (let i = 0; i < m; i++) Q[i][j] = i === j ? 1 : 0;
    } else {
      for (let i = 0; i < m; i++) Q[i][j] = v[i] / norm;
    }
  }

  return Q;
}

// ---------------------------------------------------------------------------
// Symmetric case: Newton iteration + eigenvalue validation
// ---------------------------------------------------------------------------

/**
 * Square root for symmetric matrices.
 *
 * Uses Newton iteration (same as sqrtmGeneral) after validating that all
 * eigenvalues are non-negative. For symmetric PSD matrices Newton always
 * converges (the spectrum is non-negative real).
 *
 * Falls back to eigendecomposition + Gram-Schmidt re-orthogonalisation if
 * Newton fails (e.g., rank-deficient matrix where Newton diverges).
 */
function sqrtmSymmetric(A: number[][]): number[][] {
  const n = A.length;
  const Asym = symmetrize(A); // ensure exact symmetry

  // Validate eigenvalues (eig on the symmetrized version)
  const { values, vectors } = eig(Asym, { computeVectors: true });

  for (const v of values) {
    if (v.re < -1e-8) {
      throw new Error(
        `matrixSqrtm: negative eigenvalue (${v.re}) — matrix is not positive semi-definite`
      );
    }
  }

  // Try Newton iteration first (robust for all non-negative eigenvalue cases)
  const Ynewton = sqrtmNewton(Asym);
  if (Ynewton !== null) return Ynewton;

  // Fallback: eigendecomposition with Gram-Schmidt re-orthogonalisation.
  // eig.ts stores eigenvectors as rows: vectors[i] = v_i
  // Transpose to get Q (eigenvectors as columns), then orthogonalise
  const Qraw = transpose(vectors); // eigenvectors as columns
  const Q = gramSchmidt(Qraw); // re-orthogonalise (handles repeated eigenvalues)
  const Qt = transpose(Q); // Q^T

  // D^{1/2} = diag(sqrt(max(λ, 0)))
  const Dsqrt = eye(n);
  for (let i = 0; i < n; i++) Dsqrt[i][i] = Math.sqrt(Math.max(values[i].re, 0));

  // sqrtm(A) = Q * D^{1/2} * Q^T
  return matMul(matMul(Q, Dsqrt), Qt);
}

// ---------------------------------------------------------------------------
// General case: Newton iteration with eig-based validation
// ---------------------------------------------------------------------------

/**
 * Square root via Newton iteration: Y_{k+1} = (Y_k + A * Y_k^{-1}) / 2.
 * Starting point: Y_0 = I.
 * Converges for matrices with no eigenvalues on the negative real axis.
 *
 * Returns the iterate after convergence, or null if it fails to converge.
 */
function sqrtmNewton(A: number[][]): number[][] | null {
  const n = A.length;
  let Y = eye(n); // better starting point than A for near-I

  for (let iter = 0; iter < 150; iter++) {
    const Yinv = matInv(Y);
    if (Yinv === null) return null; // Y singular

    const AYinv = matMul(A, Yinv);
    const Ynew = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (Y[i][j] + AYinv[i][j]) / 2)
    );

    let diff = 0;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) diff = Math.max(diff, Math.abs(Ynew[i][j] - Y[i][j]));

    Y = Ynew;
    if (diff < 1e-13) return Y;
  }

  // Check convergence: does Y * Y ≈ A?
  const Y2 = matMul(Y, Y);
  let err = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) err = Math.max(err, Math.abs(Y2[i][j] - A[i][j]));

  return err < 1e-6 ? Y : null;
}

/**
 * Square root via general eigendecomposition.
 *
 * eig.ts stores eigenvectors as rows: vectors[i] = v_i.
 * With Q = transpose(V) (eigenvectors as columns):
 *   A = Q * D * Q^{-1}  =>  sqrtm(A) = Q * D^{1/2} * Q^{-1}
 */
function sqrtmGeneral(A: number[][]): number[][] {
  const n = A.length;
  const { values, vectors } = eig(A, { computeVectors: true });

  for (const v of values) {
    if (Math.abs(v.im) > 1e-7) {
      throw new Error(
        'matrixSqrtm: complex eigenvalues detected — real square root not supported ' +
          '(Slice 5.9a limitation; full Schur-based sqrtm deferred to Slice 5.9b)'
      );
    }
    if (v.re < -1e-7) {
      throw new Error(
        `matrixSqrtm: negative eigenvalue (${v.re}) — principal square root not real ` +
          '(Slice 5.9a limitation)'
      );
    }
  }

  // First try Newton iteration (more robust for well-conditioned matrices)
  const Ynewton = sqrtmNewton(A);
  if (Ynewton !== null) return Ynewton;

  // Fall back to eig-based formula
  // eig.ts stores eigenvectors as rows: V[i] = v_i
  // Q = transpose(V) has eigenvectors as columns
  const V = vectors;
  const Q = transpose(V);
  const Qinv = matInv(Q);
  if (Qinv === null) {
    throw new Error(
      'matrixSqrtm: eigenvector matrix is singular — matrix appears to be non-diagonalisable ' +
        '(Slice 5.9a limitation; full Schur-based implementation deferred to Slice 5.9b)'
    );
  }

  const Dsqrt = eye(n);
  for (let i = 0; i < n; i++) Dsqrt[i][i] = Math.sqrt(Math.max(values[i].re, 0));

  return matMul(matMul(Q, Dsqrt), Qinv);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SqrtmOptions {
  /**
   * Force the symmetric-eigendecomposition path even for non-SPD matrices.
   * By default, symmetry is auto-detected.
   */
  assumeSymmetric?: boolean;
}

/**
 * Compute the principal square root of a square DenseMatrix.
 *
 * For symmetric positive semi-definite A:
 *   Uses symmetric eigendecomposition with Gram-Schmidt re-orthogonalisation.
 *
 * For general diagonalisable A with non-negative eigenvalues:
 *   Uses Newton iteration Y_{k+1} = (Y_k + A * Y_k^{-1}) / 2, falling back
 *   to the eig-based formula if Newton fails to converge.
 *
 * Slice 5.9a limitations:
 *   - Matrices with negative real eigenvalues: throws.
 *   - Matrices with complex eigenvalues: throws.
 *   - Non-diagonalisable (defective) matrices: Newton may fail + eig fallback
 *     may also fail. Full Schur-based Björck-Hammarling deferred to Slice 5.9b.
 *
 * @param A    - Square DenseMatrix (n × n).
 * @param opts - Optional flags.
 * @returns sqrtm(A), the principal square root.
 * @throws Error for matrices with negative or complex eigenvalues.
 *
 * @example
 * // sqrtm(I) = I
 * matrixSqrtm(DenseMatrix.eye(3))  // => identity 3×3
 *
 * @example
 * // sqrtm(4*I) = 2*I
 * const A = DenseMatrix.fromArray([[4,0],[0,4]]);
 * matrixSqrtm(A)  // => [[2,0],[0,2]]
 *
 * @example
 * // Round-trip: sqrtm(A)^2 ≈ A
 * const S = DenseMatrix.fromArray([[4,2],[2,3]]);
 * const R = matrixSqrtm(S);
 * // R * R ≈ S  (to machine precision for SPD matrices)
 */
export function matrixSqrtm(A: DenseMatrix, opts?: SqrtmOptions): DenseMatrix {
  const n = A.rows;
  if (n !== A.cols) throw new Error(`matrixSqrtm: matrix must be square (got ${A.rows}×${A.cols})`);
  if (n === 0) return DenseMatrix.zeros(0, 0);
  if (n === 1) {
    const val = A.get(0, 0);
    if (val < 0) throw new Error(`matrixSqrtm: negative scalar (${val}) has no real square root`);
    return DenseMatrix.fromArray([[Math.sqrt(val)]]);
  }

  const Aarr = A.toArray();

  // Detect symmetry
  const forceSymmetric = opts?.assumeSymmetric ?? false;
  const isSymm = forceSymmetric || isSymmetricMatrix(Aarr);

  let result: number[][];

  if (isSymm) {
    result = sqrtmSymmetric(Aarr);
  } else {
    result = sqrtmGeneral(Aarr);
  }

  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) data[i * n + j] = result[i][j];

  return new DenseMatrix(n, n, data);
}

/** Check if a matrix is symmetric to within tolerance. */
function isSymmetricMatrix(A: number[][], tol = 1e-8): boolean {
  const n = A.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) if (Math.abs(A[i][j] - A[j][i]) > tol) return false;
  return true;
}

/**
 * Newton iteration square root (exported for logm.ts internal use).
 * Y_{k+1} = (Y_k + A * Y_k^{-1}) / 2, starting from Y_0 = I.
 *
 * This is a robust complement to sqrtmGeneral for matrices near the identity
 * and is used internally by matrixLogm's inverse-scaling phase.
 *
 * @internal
 */
export function matrixSqrtNewtonInternal(A: number[][]): number[][] {
  const n = A.length;
  let Y = eye(n);

  for (let iter = 0; iter < 150; iter++) {
    const Yinv = matInv(Y);
    if (Yinv === null) break;

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

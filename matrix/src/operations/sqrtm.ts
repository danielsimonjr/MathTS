/**
 * Matrix Square Root — Hybrid approach (Slices 5.9a + 6.1)
 *
 * Computes the principal square root of a square matrix.
 *
 * Algorithm selection:
 *   1. For symmetric positive semi-definite matrices: symmetric eigendecomposition
 *      with Gram-Schmidt re-orthogonalisation (handles repeated eigenvalues).
 *   2. For general matrices: Björck-Hammarling Schur-based algorithm
 *      (Higham 2008, Algorithm 6.3):
 *        a. Schur decompose: A = Q · T · Q^T.
 *        b. Compute upper-triangular U with U^2 = T via back-substitution.
 *        c. Rotate back: sqrtm(A) = Q · U · Q^T.
 *      Falls back to Newton iteration for diagonalisable matrices when the
 *      Schur path is unsuitable (e.g. negative eigenvalues in 1×1 blocks).
 *
 * References:
 *   - Higham (2008) "Functions of Matrices" §6 (Algorithm 6.3).
 *   - Björck & Hammarling (1983) "A Schur method for the square root of a matrix."
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
 * Used as a fallback when the Schur-based path fails.
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
        'matrixSqrtm: complex eigenvalues detected — real square root not supported'
      );
    }
    if (v.re < -1e-7) {
      throw new Error(
        `matrixSqrtm: negative eigenvalue (${v.re}) — principal square root not real`
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
      'matrixSqrtm: eigenvector matrix is singular — matrix appears to be non-diagonalisable'
    );
  }

  const Dsqrt = eye(n);
  for (let i = 0; i < n; i++) Dsqrt[i][i] = Math.sqrt(Math.max(values[i].re, 0));

  return matMul(matMul(Q, Dsqrt), Qinv);
}

// ---------------------------------------------------------------------------
// Schur-based Björck-Hammarling algorithm (Higham 2008, Algorithm 6.3)
// ---------------------------------------------------------------------------

/**
 * Compute U such that U^2 = T where T is a quasi-upper-triangular real Schur
 * form matrix. Returns null if any 1×1 diagonal block is negative (no real
 * square root on that block).
 *
 * For 1×1 blocks: U_ii = sqrt(T_ii).
 * For 2×2 blocks with complex-conjugate eigenvalue pair: use the Schur-form
 *   2×2 square root formula (Björck 1983 eq. 2.2).
 * Off-diagonal U_ij (i < j): solved from the recurrence
 *   U_ii * U_ij + U_ij * U_jj = T_ij - sum_{k=i+1}^{j-1} U_ik * U_kj
 *
 * Ref: Higham (2008) §6.2, equations (6.4)–(6.7).
 */
function sqrtmQuasiTriangular(T: number[][]): number[][] | null {
  const n = T.length;
  const U: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  // Identify block structure (1×1 or 2×2 diagonal blocks)
  const blockStart: number[] = [];
  const blockSize: number[] = [];

  let i = 0;
  while (i < n) {
    if (i === n - 1 || Math.abs(T[i + 1][i]) < 1e-12) {
      blockStart.push(i);
      blockSize.push(1);
      i++;
    } else {
      blockStart.push(i);
      blockSize.push(2);
      i += 2;
    }
  }

  const numBlocks = blockStart.length;

  // Compute diagonal blocks U_{bb}
  for (let b = 0; b < numBlocks; b++) {
    const r = blockStart[b];
    const sz = blockSize[b];

    if (sz === 1) {
      if (T[r][r] < 0) return null; // no real sqrt for negative eigenvalue
      U[r][r] = Math.sqrt(T[r][r]);
    } else {
      // 2×2 block: [[a, b], [c, d]] with complex eigenvalues
      // Björck 1983 eq. (2.2): compute sqrt of 2×2 block with complex eigenvalues.
      // For a 2×2 real matrix with complex eigenvalues, the sqrt is another
      // 2×2 real matrix. Use the Cayley-Hamilton approach:
      // If M = [[a,b],[c,d]], then sqrt(M) = (M + sqrt(det(M))*I) / (trace_of_sqrt)
      // where trace_of_sqrt = sqrt(trace(M) + 2*sqrt(det(M))).
      const a = T[r][r];
      const b2 = T[r][r + 1];
      const c = T[r + 1][r];
      const d = T[r + 1][r + 1];
      const detM = a * d - b2 * c;
      const trM = a + d;

      // For real Schur 2×2 blocks, c is nonzero and det > 0 (complex eigenvalues)
      if (detM < 0) return null; // no real sqrt

      const sqrtDet = Math.sqrt(detM);
      // tau = sqrt(trace(M) + 2*sqrt(det(M)))
      const tauSq = trM + 2 * sqrtDet;
      if (tauSq < 0) return null;
      const tau = Math.sqrt(tauSq);

      if (Math.abs(tau) < 1e-14) return null;

      U[r][r] = (a + sqrtDet) / tau;
      U[r][r + 1] = b2 / tau;
      U[r + 1][r] = c / tau;
      U[r + 1][r + 1] = (d + sqrtDet) / tau;
    }
  }

  // Compute off-diagonal blocks U_{ij} for block columns j > block i
  // Equation: U_{ii}*U_{ij} + U_{ij}*U_{jj} = T_{ij} - sum_{k: i<k<j} U_{ik}*U_{kj}
  // (Higham 2008 eq. 6.7 — Bartels-Stewart on Sylvester eq. U_ii*X + X*U_jj = RHS)
  for (let bj = 1; bj < numBlocks; bj++) {
    for (let bi = bj - 1; bi >= 0; bi--) {
      const ri = blockStart[bi];
      const rj = blockStart[bj];
      const si = blockSize[bi];
      const sj = blockSize[bj];

      // Build RHS = T_{ij} - sum_{bk: bi < bk < bj} U_{ik} * U_{kj}
      const RHS: number[][] = Array.from({ length: si }, (_, ii) =>
        Array.from({ length: sj }, (_, jj) => T[ri + ii][rj + jj])
      );

      for (let bk = bi + 1; bk < bj; bk++) {
        const rk = blockStart[bk];
        const sk = blockSize[bk];
        for (let ii = 0; ii < si; ii++) {
          for (let jj = 0; jj < sj; jj++) {
            let sum = 0;
            for (let kk = 0; kk < sk; kk++) sum += U[ri + ii][rk + kk] * U[rk + kk][rj + jj];
            RHS[ii][jj] -= sum;
          }
        }
      }

      // Solve Sylvester equation: U_ii * X + X * U_jj = RHS
      // where U_ii is si×si, U_jj is sj×sj, X is si×sj.
      // Enumerate all (si*sj) unknowns and solve the linear system.
      const total = si * sj;
      const MAT: number[][] = Array.from({ length: total }, () => new Array(total).fill(0));
      const rhs: number[] = new Array(total).fill(0);

      for (let ii = 0; ii < si; ii++) {
        for (let jj = 0; jj < sj; jj++) {
          const eq = ii * sj + jj;
          // Contribution from U_ii * X: sum_k U_ii[ii,k] * X[k,jj]
          for (let kk = 0; kk < si; kk++) {
            MAT[eq][kk * sj + jj] += U[ri + ii][ri + kk];
          }
          // Contribution from X * U_jj: sum_k X[ii,k] * U_jj[k,jj]
          for (let kk = 0; kk < sj; kk++) {
            MAT[eq][ii * sj + kk] += U[rj + kk][rj + jj];
          }
          rhs[eq] = RHS[ii][jj];
        }
      }

      // Solve the linear system via Gaussian elimination
      const sol = solveLinearSystem(MAT, rhs);
      if (sol === null) return null;

      for (let ii = 0; ii < si; ii++)
        for (let jj = 0; jj < sj; jj++)
          U[ri + ii][rj + jj] = sol[ii * sj + jj];
    }
  }

  return U;
}

/** Gaussian elimination with partial pivoting. Returns null on singular system. */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const Aug = A.map((row, i) => [...row, b[i]]);

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
    if (Math.abs(pivot) < 1e-15) return null;

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
 * Matrix multiply A × B (plain 2-D arrays).
 * Shared by both sqrtm and the Schur back-rotation.
 */
function matMulArr(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n2 = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n2).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) {
      const aik = A[i][k];
      if (aik === 0) continue;
      for (let j = 0; j < n2; j++) C[i][j] += aik * B[k][j];
    }
  return C;
}

function transposeArr(A: number[][]): number[][] {
  const m = A.length;
  const n2 = A[0].length;
  return Array.from({ length: n2 }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

/**
 * Schur-based Björck-Hammarling square root (Higham 2008, Algorithm 6.3).
 *
 * 1. Schur decompose: A = Q · T · Q^T.
 * 2. Compute upper-triangular U with U^2 = T via sqrtmQuasiTriangular.
 * 3. Rotate back: sqrtm(A) = Q · U · Q^T.
 *
 * Returns null if T has a 1×1 block with a negative entry (no real sqrt).
 */
function sqrtmSchur(A: number[][]): number[][] | null {
  const { H: T, Q } = schurInternal(A);
  const U = sqrtmQuasiTriangular(T);
  if (U === null) return null;

  // sqrtm(A) = Q * U * Q^T
  const Qt = transposeArr(Q);
  return matMulArr(matMulArr(Q, U), Qt);
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
    // Try Schur-based Björck-Hammarling path first (handles defective matrices,
    // repeated eigenvalues, and complex-conjugate eigenvalue pairs).
    const schurResult = sqrtmSchur(Aarr);
    if (schurResult !== null) {
      result = schurResult;
    } else {
      // Schur path returned null (e.g. negative 1×1 diagonal block) — fall back
      // to eigendecomposition which gives a better error message.
      result = sqrtmGeneral(Aarr);
    }
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

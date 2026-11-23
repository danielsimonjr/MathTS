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
import { squareFunctionInput, type SquareFunctionInput } from './matrix-function-input.js';
import { eig } from './eig.js';
import { schurInternal, negligibleSubdiagonal } from './schur.js';
import {
  eye,
  matMul,
  transpose,
  matInv,
  gaussJordanSolve,
  ldexpMatrix,
  normInf,
  relativeDifference,
  entryRange,
  withPow2Scale,
  ABS_CUTOFF_LO,
  SQUARED,
} from './common.js';
import { notSquareError } from '@danielsimonjr/mathts-core/internal';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Symmetrize a matrix: return (A + A^T) / 2.
 */
function symmetrize(A: number[][]): number[][] {
  const n = A.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (A[i][j] + A[j][i]) / 2)
  );
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
    let columnNorm = 0;
    for (const value of v) columnNorm = Math.hypot(columnNorm, value);

    // Subtract projections onto previous columns
    for (let k = 0; k < j; k++) {
      let dot = 0;
      for (let i = 0; i < m; i++) dot += Q[i][k] * v[i];
      for (let i = 0; i < m; i++) v[i] -= dot * Q[i][k];
    }

    // Normalize
    let norm = 0;
    for (const value of v) norm = Math.hypot(norm, value);

    if (norm === 0 || norm / columnNorm <= m * Number.EPSILON) {
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
  const tol = eigenvalueTolerance(1e-8, normInf(Asym));

  // Validate eigenvalues (eig on the symmetrized version)
  const { values, vectors } = eig(Asym, { computeVectors: true });

  for (const v of values) {
    if (v.re < -tol) {
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
  const Yeig = matMul(matMul(Q, Dsqrt), Qt);
  const eigMiss = relativeDifference(matMul(Yeig, Yeig), Asym);
  if (eigMiss <= 1e-12) return Yeig;

  // The eigenvectors of a repeated eigenvalue (the zero eigenvalues of a singular matrix) are
  // not orthogonal, and Gram-Schmidt on them alters the other eigenvectors: a PSD matrix of
  // rank 3 and size 10 missed its root by 1e-8 (#1170). The real Schur form of a symmetric
  // matrix is diagonal up to rounding and its orthogonal factor is exact: A = Q T Qᵀ, so
  // sqrtm(A) = Q · diag(sqrt(max(T_ii, 0))) · Qᵀ. The better of the two roots is kept.
  const { H: T, Q: Qs } = schurInternal(Asym);
  const Ds = eye(n);
  for (let i = 0; i < n; i++) Ds[i][i] = Math.sqrt(Math.max(T[i][i], 0));
  const Yschur = matMul(matMul(Qs, Ds), transpose(Qs));
  return relativeDifference(matMul(Yschur, Yschur), Asym) < eigMiss ? Yschur : Yeig;
}

// ---------------------------------------------------------------------------
// General case: Newton iteration with eig-based validation
// ---------------------------------------------------------------------------

/**
 * One Newton square-root update `Y' = (Y + A Y⁻¹) / 2` and the max entrywise
 * change `‖Y' − Y‖_∞`. Returns `null` when `Y` is singular (`matInv` fails).
 */
function newtonSqrtUpdate(A: number[][], Y: number[][]): { next: number[][]; diff: number } | null {
  const n = A.length;
  const Yinv = matInv(Y);
  if (Yinv === null) return null;

  const AYinv = matMul(A, Yinv);
  const next = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (Y[i][j] + AYinv[i][j]) / 2)
  );

  let diff = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) diff = Math.max(diff, Math.abs(next[i][j] - Y[i][j]));

  return { next, diff };
}

/**
 * The size below which a negative real part or an imaginary part of a computed eigenvalue
 * is rounding noise, for a matrix of norm `anorm`. It is `base` and, below `anorm = 1`,
 * relative to `anorm` (#1125). The noise of an eigenvalue grows with the norm, so the
 * tolerance is never below 1e-13 of it: a singular matrix has a real root at each
 * magnitude. The two forms meet at `anorm = base / 1e-13`.
 */
function eigenvalueTolerance(base: number, anorm: number): number {
  return Math.max(base * Math.min(1, anorm), 1e-13 * anorm);
}

/**
 * Stop tolerance of the Newton step for an iterate of largest entry `ymax`: 1e-13 and,
 * below `ymax = 1`, relative to `ymax` (#1125).
 */
function newtonTolerance(ymax: number): number {
  return 1e-13 * Math.min(1, ymax);
}

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
    const step = newtonSqrtUpdate(A, Y);
    if (step === null) return null;
    Y = step.next;
    if (step.diff < newtonTolerance(normInf(Y))) return Y;
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
  const tol = eigenvalueTolerance(1e-7, normInf(A));

  for (const v of values) {
    if (Math.abs(v.im) > tol) {
      throw new Error('matrixSqrtm: complex eigenvalues detected — real square root not supported');
    }
    if (v.re < -tol) {
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

  const root = matMul(matMul(Q, Dsqrt), Qinv);
  if (!(relativeDifference(matMul(root, root), A) <= 1e-8)) {
    throw new Error('matrixSqrtm: no numerically valid real square root was found');
  }
  return root;
}

// ---------------------------------------------------------------------------
// Schur-based Björck-Hammarling algorithm (Higham 2008, Algorithm 6.3)
// ---------------------------------------------------------------------------

/**
 * Compute U such that U^2 = T where T is a quasi-upper-triangular real Schur
 * form matrix. Returns null if any 1×1 diagonal block is negative (no real
 * square root on that block).
 *
 * A negative 1×1 entry `t` with `-t <= zeroNoise · max|T|` is read as a zero eigenvalue
 * (its root is 0) and `clamped` is set in the result: the Schur form of a singular matrix
 * holds rounding noise of that size in place of the zero (#1163). The caller must check
 * that U·U reproduces T, because a root built on a zero eigenvalue does not exist for a
 * nilpotent block. `zeroNoise = 0` clamps nothing.
 *
 * For 1×1 blocks: U_ii = sqrt(T_ii).
 * For 2×2 blocks with complex-conjugate eigenvalue pair: use the Schur-form
 *   2×2 square root formula (Björck 1983 eq. 2.2).
 * Off-diagonal U_ij (i < j): solved from the recurrence
 *   U_ii * U_ij + U_ij * U_jj = T_ij - sum_{k=i+1}^{j-1} U_ik * U_kj
 *
 * Ref: Higham (2008) §6.2, equations (6.4)–(6.7).
 */
function quasiTriangularRoot(
  T: number[][],
  zeroNoise: number
): { U: number[][]; clamped: boolean } | null {
  const n = T.length;
  const U: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let tmax = 0;
  for (const row of T) for (const v of row) tmax = Math.max(tmax, Math.abs(v));
  let clamped = false;

  // Identify block structure (1×1 or 2×2 diagonal blocks)
  const blockStart: number[] = [];
  const blockSize: number[] = [];

  let i = 0;
  while (i < n) {
    // A subdiagonal entry that Schur left non-zero below its deflation tolerance is
    // Hessenberg residue, not a 2×2 block (#1127). The test is the one of the Schur
    // deflation, so the blocks read here are the blocks that Schur left standing (#1171).
    if (i === n - 1 || negligibleSubdiagonal(T, i + 1)) {
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
      if (T[r][r] < 0) {
        // No real sqrt for a negative eigenvalue, unless the entry is rounding noise of a zero.
        if (!(-T[r][r] <= zeroNoise * tmax)) return null;
        clamped = true;
        continue;
      }
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

      // Scale-free: tau^2 = tr + 2 sqrt(det) > 0 for every block with complex eigenvalues. An
      // absolute cutoff rejected a block whose diagonal a power-of-2 window brought to 2^-105.
      if (!(tau > 0)) return null;

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
        for (let jj = 0; jj < sj; jj++) U[ri + ii][rj + jj] = sol[ii * sj + jj];
    }
  }

  return { U, clamped };
}

/**
 * The square root of a quasi-upper-triangular real Schur form (see `quasiTriangularRoot`),
 * with no negative 1×1 entry read as zero. Null when there is no real root.
 *
 * @internal Also used by `matrixLogm` for the 2×2 blocks of its inverse-scaling phase.
 */
export function sqrtmQuasiTriangular(T: number[][]): number[][] | null {
  const root = quasiTriangularRoot(T, 0);
  return root === null ? null : root.U;
}

/**
 * One-column Gauss–Jordan solve. Same zero-pivot rule and zero-factor
 * skip as {@link matInv}; both call {@link gaussJordanSolve}.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const solved = gaussJordanSolve(
    A,
    b.map((value) => [value])
  );
  if (solved === null) return null;
  return solved.map((row) => row[0]);
}

/**
 * Schur-based Björck-Hammarling square root (Higham 2008, Algorithm 6.3).
 *
 * 1. Schur decompose: A = Q · T · Q^T.
 * 2. Compute upper-triangular U with U^2 = T via sqrtmQuasiTriangular.
 * 3. Rotate back: sqrtm(A) = Q · U · Q^T.
 *
 * Returns null if T has a 1×1 block with a negative entry (no real sqrt). A negative entry
 * within 64·eps of max|T| is read as a zero eigenvalue (#1163); the root built on it is kept
 * only when U·U reproduces T to 1e-12 · max|T|.
 */
function sqrtmSchur(A: number[][]): number[][] | null {
  const { H: T, Q } = schurInternal(A);
  const root = quasiTriangularRoot(T, 64 * Number.EPSILON);
  if (root === null) return null;
  const { U, clamped } = root;
  if (clamped && !(relativeDifference(matMul(U, U), T) <= 1e-12)) return null;

  // sqrtm(A) = Q * U * Q^T
  const Qt = transpose(Q);
  return matMul(matMul(Q, U), Qt);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Options for `matrixSqrtm`.
 */
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
 * @param input - Square matrix (n × n): a `DenseMatrix`, a `SparseMatrix`, a nested `number[][]`, or an
 *   object with a `toArray` method that returns a nested array (the MathJS matrix).
 * @param opts  - Optional flags.
 * @returns sqrtm(input), the principal square root.
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
export function matrixSqrtm(input: SquareFunctionInput, opts?: SqrtmOptions): DenseMatrix {
  const A = squareFunctionInput(input);
  const n = A.rows;
  if (n !== A.cols)
    throw notSquareError(`matrixSqrtm: matrix must be square (got ${A.rows}×${A.cols})`);
  if (n === 0) return DenseMatrix.zeros(0, 0);
  if (n === 1) {
    const val = A.get(0, 0);
    if (val < 0) throw new Error(`matrixSqrtm: negative scalar (${val}) has no real square root`);
    return DenseMatrix.fromArray([[Math.sqrt(val)]]);
  }

  // The symmetry test and the pivot floors are absolute cutoffs, so the window is
  // [2^ABS_CUTOFF_LO, 2^SQUARED]; the inner Schur step scales itself (#1104). The
  // exponent is even, so sqrtm(2^e · A) = 2^(e/2) · sqrtm(A) is exact.
  const range = entryRange(A.toFloat64Array());
  const result = withPow2Scale(
    range,
    ABS_CUTOFF_LO,
    SQUARED,
    (e) => {
      const Aarr = A.toArray();
      if (e === 0) return sqrtmKernel(Aarr, opts);
      ldexpMatrix(Aarr, e);
      const r = sqrtmKernel(Aarr, opts);
      ldexpMatrix(r, -e / 2);
      return r;
    },
    true
  );

  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) data[i * n + j] = result[i][j];

  return new DenseMatrix(n, n, data);
}

/** The square root of an n×n array (n ≥ 2), without scaling. */
function sqrtmKernel(Aarr: number[][], opts?: SqrtmOptions): number[][] {
  // Detect symmetry
  const forceSymmetric = opts?.assumeSymmetric ?? false;
  const amax = normInf(Aarr);
  // sqrtm of the zero matrix is the zero matrix; Newton from I only halves toward it.
  if (amax === 0) return Aarr.map((row) => row.map(() => 0));
  // The tolerances are relative to the largest entry below 1 and absolute above it (#1125).
  const isSymm = forceSymmetric || isSymmetricMatrix(Aarr, 1e-8 * Math.min(1, amax));

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

  return result;
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
    const step = newtonSqrtUpdate(A, Y);
    if (step === null) break;
    Y = step.next;
    if (step.diff < 1e-14) break;
  }

  return Y;
}

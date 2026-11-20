/**
 * Matrix Logarithm — Schur-Padé inverse scaling-and-squaring (Slices 5.9a + 6.1)
 *
 * Implements the Schur-Padé algorithm based on:
 *   Higham (2008) "Functions of Matrices: Theory and Computation," Chapter 11
 *   (Algorithm 11.10).
 *
 * Algorithm (general Schur-based path, Slice 6.1):
 *   1. Schur decompose: A = Q · T · Q^T. T is quasi-upper-triangular: a complex-
 *      conjugate eigenvalue pair is a 2×2 block, balanced by a power-of-2 diagonal
 *      similarity so that its two off-diagonal entries have about the same size.
 *   2. Repeatedly take matrix square roots of T (Björck recurrence on quasi-upper-
 *      triangular matrices) until ||T^{1/2^k} - I||_1 < 0.25.
 *   3. Evaluate log(I + X) via 16-point Gauss-Legendre quadrature.
 *   4. Scale back by 2^k; rotate by Q: logm(A) = Q · (2^k · log(T^{1/2^k})) · Q^T.
 *
 * For the eig-based fallback (diagonalisable matrices with positive real
 * eigenvalues): logm(A) = V · diag(log(λ)) · V^{-1}.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { eig } from './eig.js';
import { schurInternal, negligibleSubdiagonal } from './schur.js';
import {
  eye,
  matMul,
  transpose,
  matScale,
  normInf,
  norm1,
  matInv,
  gaussJordanContinue,
  ldexpMatrix,
  relativeDifference,
  entryRange,
  withPow2Scale,
  ABS_CUTOFF_LO,
  FOURTH,
} from './common.js';
import { matrixSqrtNewtonInternal, sqrtmQuasiTriangular } from './sqrtm.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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
/* eslint-disable no-loss-of-precision -- intentional full-precision Gauss-Legendre
   quadrature constants; the extra digits round to the nearest IEEE-754 double. */
const GL16_NODES = [
  0.005299532504175033, 0.02771248846338371, 0.06718439880608412, 0.12229779582249849,
  0.19106187779867811, 0.2709916111713863, 0.35919822461037054, 0.4524937450811813,
  0.5475062549188188, 0.6408017753896295, 0.7290083888286137, 0.8089381222013219,
  0.8777022041775016, 0.9328156011939158, 0.9722875115366163, 0.994700467495825,
];
const GL16_WEIGHTS = [
  0.013576229705877048, 0.031126761969323947, 0.04757925584124639, 0.06231448562776694,
  0.07479799440828837, 0.08457825969750127, 0.09130170752246179, 0.09472530522753425,
  0.09472530522753425, 0.09130170752246179, 0.08457825969750127, 0.07479799440828837,
  0.06231448562776694, 0.04757925584124639, 0.031126761969323947, 0.013576229705877048,
];
/* eslint-enable no-loss-of-precision */

/**
 * Evaluate log(I + X) via 16-point Gauss-Legendre quadrature:
 *   log(I + X) = X * integral_0^1 (I + t*X)^{-1} dt
 *
 * Each quadrature point requires one n×n linear system with n right-hand sides.
 * Requires ||X|| < 1 for accuracy (inverse-scaling ensures this).
 * 16-point GL gives ~32nd-order accuracy for smooth integrands.
 *
 * @param X - The n×n matrix, with a norm below 1.
 * @param eliminate - The elimination of an augmented matrix. The default is
 *   `gaussJordanContinue`; a test passes a counting copy, to pin one elimination per node.
 * @returns log(I + X).
 * @internal
 */
export function logPade(
  X: number[][],
  eliminate: typeof gaussJordanContinue = gaussJordanContinue
): number[][] {
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

    // Solve M * Y = X for all columns in one elimination of the augmented matrix [M | X]:
    // O(n³) per node, where one elimination per column cost O(n⁴). The pivots depend on M
    // only, so every column of Y is the value that a solve of that column alone gives.
    // Then result += w * Y
    const aug = M.map((row, i) => [...row, ...X[i]]);
    eliminate(aug, n, 1e-30);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) result[i][j] += w * aug[i][n + j];
  }

  return result;
}

/** The largest entry of `A - Q·T·Qᵀ`: the backward error of a computed Schur form. */
function schurBackwardError(A: number[][], T: number[][], Q: number[][]): number {
  const R = matMul(matMul(Q, T), transpose(Q));
  let e = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A.length; j++) e = Math.max(e, Math.abs(R[i][j] - A[i][j]));
  return e;
}

// ---------------------------------------------------------------------------
// Block structure of the quasi-triangular Schur form
// ---------------------------------------------------------------------------

/**
 * Marks the rows of each 2×2 diagonal block of a quasi-upper-triangular Schur form T: a
 * subdiagonal entry that the Schur deflation test (`negligibleSubdiagonal`) keeps is the
 * entry of a block, so the reader finds the blocks that Schur left standing (#1171).
 *
 * Returns null when two blocks overlap, or when a block has no complex-conjugate eigenvalue
 * pair (`((a-d)/2)² + bc >= 0`): such a matrix goes to the eigenvalue path. A complex pair
 * is never on the closed negative real axis, so its principal logarithm is real.
 */
function complexBlockMask(T: number[][]): boolean[] | null {
  const n = T.length;
  const mask = new Array<boolean>(n).fill(false);
  for (let i = 1; i < n; i++) {
    if (negligibleSubdiagonal(T, i)) continue;
    if (mask[i - 1]) return null;
    const a = T[i - 1][i - 1];
    const b = T[i - 1][i];
    const c = T[i][i - 1];
    const d = T[i][i];
    if (!(((a - d) / 2) ** 2 + b * c < 0)) return null;
    mask[i - 1] = true;
    mask[i] = true;
  }
  return mask;
}

/** The error for a 1×1 block of the Schur form that is not told from a non-positive value. */
function nonPositiveEigenvalue(d: number, detail = ''): Error {
  return new Error(
    'matrixLogm: non-positive eigenvalue detected — principal logarithm is undefined ' +
      '(eigenvalue ≈ ' +
      d +
      detail +
      ')'
  );
}

/**
 * The Schur form of `D·A·D⁻¹` with `D = diag(2^(i mod 2))`: an exact similarity copy of A (a
 * power-of-2 scale is exact in floating point), whose rounding noise differs from that of the
 * Schur form of A. A full grading `2^i` loses accuracy for large n, and a reversal leaves a
 * symmetric matrix unchanged, so the alternating scale is used.
 */
function secondSchurForm(A: number[][]): { T2: number[][]; mask2: boolean[] | null } {
  const A2 = A.map((row, r) => row.map((v, c) => v * 2 ** ((r % 2) - (c % 2))));
  const T2 = schurInternal(A2).H;
  return { T2, mask2: complexBlockMask(T2) };
}

/**
 * True when the eigenvalue `d` of the first Schur form is confirmed by the second: the
 * nearest 1×1 entry `d2` of T2 is positive and within 1e-3 of `d` in relative size. The
 * rounding noise of a zero eigenvalue is of the size of 1e-16 · max|A| and changes sign and
 * size between the two forms, so a singular matrix at a large scale does not pass. Over
 * 2,000 random matrices of the sweep, the largest relative gap of an accurate eigenvalue
 * was 9.6e-5, and the smallest gap of a singular matrix 7.3e-2: the limit 1e-3 is 10 times
 * above the first and 73 times below the second (#1174).
 */
function confirmedBySecondForm(
  d: number,
  second: { T2: number[][]; mask2: boolean[] | null }
): boolean {
  const { T2, mask2 } = second;
  if (mask2 === null) return false;
  let d2 = NaN;
  let gap = Infinity;
  for (let r = 0; r < T2.length; r++) {
    if (mask2[r]) continue;
    const g = Math.abs(T2[r][r] - d);
    if (g < gap) {
      gap = g;
      d2 = T2[r][r];
    }
  }
  return d2 > 0 && Math.abs(d - d2) <= 1e-3 * d;
}

/**
 * The modulus of the complex-conjugate pair of the 2×2 block of T at rows `r`, `r + 1`. The
 * determinant is above 0 in exact arithmetic (the block has a negative discriminant); if
 * rounding makes it negative the result is NaN, and every test of it is written so that NaN
 * fails closed.
 */
function blockModulus(T: number[][], r: number): number {
  return Math.sqrt(T[r][r] * T[r + 1][r + 1] - T[r][r + 1] * T[r + 1][r]);
}

/**
 * True when the complex pair of modulus `m` of the first Schur form is confirmed by the
 * second: the nearest 2×2 block of T2 has a modulus within 1e-3 of `m` in relative size. The
 * rounding noise of a cluster of zero eigenvalues can form a 2×2 block of modulus
 * 1e-16 · max|A|, which changes between two forms like the noise of one zero eigenvalue (#1174).
 */
function blockConfirmedBySecondForm(
  m: number,
  second: { T2: number[][]; mask2: boolean[] | null }
): boolean {
  const { T2, mask2 } = second;
  if (mask2 === null) return false;
  let gap = Infinity;
  let m2 = NaN;
  // The mask marks both rows of a block and blocks do not overlap, so a marked row that
  // follows the end of the block before it is the first row of a block. Two blocks can be
  // adjacent: the walk steps over both rows of each block.
  for (let r = 0; r + 1 < T2.length; r++) {
    if (!mask2[r]) continue;
    const g = Math.abs(blockModulus(T2, r) - m);
    if (g < gap) {
      gap = g;
      m2 = blockModulus(T2, r);
    }
    r++;
  }
  return m2 > 0 && Math.abs(m - m2) <= 1e-3 * m;
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
 * The 1×1 blocks of T must be positive (a non-positive real eigenvalue has no principal
 * logarithm). A 2×2 block with a complex-conjugate pair is handled in real arithmetic by the
 * quasi-triangular square root; its principal logarithm is real (#1171).
 *
 * Returns null if the matrix cannot be handled by the Schur path. Throws when a 1×1 block is
 * not told from a non-positive eigenvalue: the Newton path would read the same matrix with its
 * own rounding noise and could return a finite matrix for a matrix with no logarithm (#1174).
 */
function logmSchur(A: number[][], tol: number): { logm: number[][]; residue: boolean } | null {
  const { H: T, Q } = schurInternal(A);

  const inBlock = complexBlockMask(T);
  if (inBlock === null) return null;
  // A subdiagonal entry above an absolute 1e-12 that is not the entry of a block is residue
  // of the Schur form of a large matrix.
  let residue = false;
  for (let i = 1; i < T.length; i++)
    if (negligibleSubdiagonal(T, i) && Math.abs(T[i][i - 1]) > 1e-12) residue = true;

  // Check that all 1×1 diagonal entries are strictly positive
  // A positive eigenvalue at or below 1e-14 is accepted only when it is 1e8 times above the
  // backward error of the Schur form, so its logarithm has a relative error of at most
  // 1e-8 (#1125). The rounding noise of a zero eigenvalue is of the size of that error.
  // An eigenvalue at most 1e-8 of the largest diagonal entry is also confirmed on a second
  // Schur form (#1174): the noise of a zero eigenvalue is 1e-16 · max|A|, above 1e-14 from a
  // scale of 2^10 up, so the absolute test alone passes it.
  const n = T.length;
  let backwardError = -1;
  let dmax = 0;
  for (let i = 0; i < n; i++) dmax = Math.max(dmax, Math.abs(T[i][i]));
  // An infinite eigenvalue is neither positive nor non-positive: leave it to the Newton path,
  // whose `eig` names the non-finite entry (NaN keeps its NaN result).
  if (dmax === Infinity) return null;
  let second: { T2: number[][]; mask2: boolean[] | null } | null = null;
  for (let i = 0; i < n; i++) {
    if (inBlock[i]) {
      // A 2×2 block holds a complex pair of modulus m. It is checked like a 1×1 entry of
      // that size: noise of a zero eigenvalue cluster forms such a block (#1174).
      const m = blockModulus(T, i);
      if (!(m > 1e-14)) {
        if (backwardError < 0) backwardError = schurBackwardError(A, T, Q);
        if (!(m > 0 && m >= 1e8 * backwardError))
          throw nonPositiveEigenvalue(m, ', a complex pair that is not above the floor 1e-14');
      }
      if (!(m > 1e-8 * dmax)) {
        second ??= secondSchurForm(A);
        if (!blockConfirmedBySecondForm(m, second))
          throw nonPositiveEigenvalue(m, ', a complex pair not confirmed by a second Schur form');
      }
      i++;
      continue;
    }
    const d = T[i][i];
    if (d <= 1e-14) {
      if (d <= 0) throw nonPositiveEigenvalue(d);
      if (backwardError < 0) backwardError = schurBackwardError(A, T, Q);
      if (d < 1e8 * backwardError)
        throw nonPositiveEigenvalue(d, ', which is not above the floor 1e-14');
    }
    if (d <= 1e-8 * dmax) {
      second ??= secondSchurForm(A);
      if (!confirmedBySecondForm(d, second))
        throw nonPositiveEigenvalue(d, ', not confirmed by a second Schur form');
    }
  }

  // Balance each 2×2 block by an exact power-of-2 diagonal similarity D, so that its two
  // off-diagonal entries have about the same size: log(T) = D⁻¹ · log(D·T·D⁻¹) · D. A
  // non-normal block loses the accuracy of its diagonal in the square-root phase otherwise.
  const dexp = new Array<number>(n).fill(0);
  for (let i = 1; i < n; i++) {
    const secondRowOfBlock = !negligibleSubdiagonal(T, i);
    dexp[i] =
      dexp[i - 1] +
      (secondRowOfBlock ? Math.round(0.5 * Math.log2(Math.abs(T[i - 1][i] / T[i][i - 1]))) : 0);
  }
  const Tb = T.map((row, r) => row.map((v, c) => v * 2 ** (dexp[r] - dexp[c])));

  // Inverse-scaling phase: repeatedly take the quasi-upper-triangular sqrt of T
  let M = Tb;
  let numSqrt = 0;
  const maxSqrt = 64;

  while (numSqrt < maxSqrt) {
    const MminI = M.map((row, i) => row.map((v, j) => v - (i === j ? 1 : 0)));
    if (norm1(MminI) < tol) break;

    const sqrtM = sqrtmQuasiTriangular(M);
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

  // Undo the balance
  logT = logT.map((row, r) => row.map((v, c) => v * 2 ** (dexp[c] - dexp[r])));

  // Rotate: logm(A) = Q * logm(T) * Q^T
  const Qt = transpose(Q);
  return { logm: matMul(matMul(Q, logT), Qt), residue };
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
      // A positive value at or below the floor is not told from 0.
      throw new Error(
        'matrixLogm: non-positive eigenvalue detected — principal logarithm is undefined ' +
          '(eigenvalue ≈ ' +
          v.re +
          (v.re > 0 ? ', which is not above the floor 1e-14)' : ')')
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

/**
 * Options for `matrixLogm`.
 */
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
 * A real matrix with a complex-conjugate eigenvalue pair and no eigenvalue on the closed
 * negative real axis has a real principal logarithm. The Schur path computes it in real
 * arithmetic from the 2×2 blocks of the real Schur form (#1171).
 *
 * Limitations:
 *   - Matrices with non-positive real eigenvalues: principal log is undefined.
 *   - The Newton fallback (taken when the Schur path cannot start) throws for complex
 *     eigenvalues.
 *
 * @param A - Square DenseMatrix with no eigenvalue on the closed negative real axis.
 * @returns logm(A) as a DenseMatrix.
 * @throws Error for matrices with non-positive real eigenvalues.
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
  // The Schur-Padé path forms fourth powers and its cutoffs are absolute, so the
  // window is [2^ABS_CUTOFF_LO, 2^FOURTH] (#1104). logm(2^e · A) = logm(A) + e·ln 2 · I,
  // so the shift is taken off the diagonal.
  const logM = withPow2Scale(entryRange(A.toFloat64Array()), ABS_CUTOFF_LO, FOURTH, (e) => {
    const Aarr = A.toArray();
    if (e === 0) return logmKernel(Aarr, tol);
    ldexpMatrix(Aarr, e);
    const r = logmKernel(Aarr, tol);
    for (let i = 0; i < n; i++) r[i][i] -= e * Math.LN2;
    return r;
  });

  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) data[i * n + j] = logM[i][j];
  return new DenseMatrix(n, n, data);
}

/** The logarithm of an n×n array (n ≥ 1), without scaling. */
function logmKernel(Aarr: number[][], tol: number): number[][] {
  // ----- Schur-Padé path (Slice 6.1) -----
  // Handles: real positive eigenvalues, repeated eigenvalues, defective matrices and
  // complex-conjugate pairs (2×2 blocks). Falls through (returns null) for a Schur form
  // that is not a block-triangular form of that kind.
  const schur = logmSchur(Aarr, tol);
  if (schur !== null) {
    if (!schur.residue) return schur.logm;
    // For a matrix with Schur residue, the Newton path is more accurate (about 1e-16
    // against 1e-14) when it converges, and it can be wrong by 1e11 when it does not
    // (#1125). Its result is kept only when it agrees with the Schur result to 1e-8.
    let newton: number[][] | null = null;
    try {
      newton = logmNewton(Aarr, tol);
    } catch {
      newton = null;
    }
    return newton !== null && relativeDifference(newton, schur.logm) < 1e-8 ? newton : schur.logm;
  }
  return logmNewton(Aarr, tol);
}

/** The eigenvalue check and the Newton inverse-scaling path of `logmKernel`. */
function logmNewton(Aarr: number[][], tol: number): number[][] {
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

    const sqrtM = matrixSqrtNewtonInternal(M);
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

  return logM;
}

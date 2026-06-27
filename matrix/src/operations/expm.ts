/**
 * Matrix Exponential — Scaling-and-Squaring with Padé-13 Approximant
 *
 * Implements Algorithm 10.20 from:
 *   Higham, N. J. (2005). "The scaling and squaring method for the matrix
 *   exponential revisited." SIAM J. Matrix Anal. Appl., 26(4), 1179–1193.
 *
 * Algorithm:
 *   1. Compute s = max(0, ceil(log2(||A||_1 / θ_13))) where θ_13 ≈ 5.372.
 *   2. Scale: B = A / 2^s.
 *   3. Compute the [13/13] Padé approximant R(B) = (U + V)^{-1} * (-U + V).
 *   4. Square s times: expm(A) = R(B)^(2^s).
 *
 * Works for any real square DenseMatrix. For large ||A||, uses scaling to
 * stay within the Padé approximant's accuracy radius.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import { eye, matMul, matAdd, matSub, matScale, norm1 } from './common.js';

// ---------------------------------------------------------------------------
// Padé-13 coefficients (Higham 2005, Table 1 / Algorithm 10.20)
// ---------------------------------------------------------------------------

const THETA_13 = 5.371920351148152;

// Numerator polynomial coefficients b_0 ... b_13 (Higham 2005 eq. 10.33)
const B = [
  64764752532480000, 32382376266240000, 7771770303897600, 1187353796428800, 129060195264000,
  10559470521600, 670442572800, 33522128640, 1323241920, 40840800, 960960, 16380, 182, 1,
];

// ---------------------------------------------------------------------------
// Internal helpers (work on number[][] for generality)
// ---------------------------------------------------------------------------

/** Solve linear system M*X = N via Gauss-Jordan elimination (returns X). */
function matSolve(M: number[][], N: number[][]): number[][] {
  const n = M.length;
  const cols = N[0].length;

  // Augmented matrix [M | N]
  const Aug: number[][] = M.map((row, i) => [...row, ...N[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
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
    if (Math.abs(pivot) < 1e-15) continue;

    for (let j = col; j < n + cols; j++) Aug[col][j] /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = Aug[row][col];
      if (factor === 0) continue;
      for (let j = col; j < n + cols; j++) Aug[row][j] -= factor * Aug[col][j];
    }
  }

  return Aug.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Padé-13 approximant for expm
// ---------------------------------------------------------------------------

/**
 * Evaluate the [13/13] Padé approximant for exp(A).
 *
 * Uses the factored Horner scheme from Higham (2005) eq. 10.33.
 * Returns R(A) = (denominator)^{-1} × numerator evaluated as
 * P_denom^{-1} × P_num.
 */
function pade13(A: number[][]): number[][] {
  const n = A.length;
  const I = eye(n);

  // Compute matrix powers A^2, A^4, A^6
  const A2 = matMul(A, A);
  const A4 = matMul(A2, A2);
  const A6 = matMul(A2, A4);

  // U = A * (A6 * (b13*A6 + b11*A4 + b9*A2) + b7*A6 + b5*A4 + b3*A2 + b1*I)
  // V =      A6 * (b12*A6 + b10*A4 + b8*A2) + b6*A6 + b4*A4 + b2*A2 + b0*I

  // Compute V numerics
  const V1: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      return B[12] * A6[i][j] + B[10] * A4[i][j] + B[8] * A2[i][j];
    })
  );
  const V2inner: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      return B[6] * A6[i][j] + B[4] * A4[i][j] + B[2] * A2[i][j] + B[0] * I[i][j];
    })
  );
  const V = matAdd(matMul(A6, V1), V2inner);

  // Compute U numerics
  const U1: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      return B[13] * A6[i][j] + B[11] * A4[i][j] + B[9] * A2[i][j];
    })
  );
  const U2inner: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      return B[7] * A6[i][j] + B[5] * A4[i][j] + B[3] * A2[i][j] + B[1] * I[i][j];
    })
  );
  const Utmp = matAdd(matMul(A6, U1), U2inner);
  const U = matMul(A, Utmp);

  // R = (V - U)^{-1} * (V + U)
  const VminusU = matSub(V, U);
  const VplusU = matAdd(V, U);
  return matSolve(VminusU, VplusU);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExpmOptions {
  /**
   * When true, return the result as a DenseMatrix.
   * When false (default), work directly on the internal number[][] and
   * return as DenseMatrix anyway — this option is reserved for future use.
   */
  _reserved?: never;
}

/**
 * Compute the matrix exponential of a square DenseMatrix.
 *
 * Uses the Padé-13 scaling-and-squaring algorithm (Higham 2005).
 * Accurate to near machine precision for general real matrices.
 *
 * @param A - Square DenseMatrix (n × n).
 * @returns expm(A) as a DenseMatrix (n × n).
 * @throws Error if A is not square.
 *
 * @example
 * // expm(0) = I
 * matrixExpm(DenseMatrix.zeros(3, 3)) // => identity 3×3
 *
 * @example
 * // expm(t*I) = e^t * I
 * const tI = DenseMatrix.fromArray([[2,0],[0,2]]);
 * matrixExpm(tI) // => [[e^2, 0], [0, e^2]]
 */
export function matrixExpm(A: DenseMatrix): DenseMatrix {
  const n = A.rows;
  if (n !== A.cols) throw new Error(`matrixExpm: matrix must be square (got ${A.rows}×${A.cols})`);
  if (n === 0) return DenseMatrix.zeros(0, 0);

  const Aarr = A.toArray();

  // Determine scaling: find smallest s ≥ 0 with ||A/2^s||_1 ≤ θ_13
  const nA = norm1(Aarr);
  let s = 0;
  if (nA > THETA_13) {
    s = Math.ceil(Math.log2(nA / THETA_13));
  }

  // Scale A
  const scaleFactor = Math.pow(2, s);
  const As = matScale(Aarr, 1 / scaleFactor);

  // Padé-13 approximant
  let R = pade13(As);

  // Squaring phase: R = R^(2^s)
  for (let i = 0; i < s; i++) {
    R = matMul(R, R);
  }

  // Convert back to DenseMatrix
  const data = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) data[i * n + j] = R[i][j];

  return new DenseMatrix(n, n, data);
}

/**
 * Schur Decomposition — Francis QR with double shifts (Slice 6.1)
 *
 * Computes the real Schur decomposition A = Q · T · Q^T where:
 *   - Q is orthogonal (Q^T · Q = I)
 *   - T is quasi-upper-triangular (real Schur form): diagonal blocks are
 *     1×1 (real eigenvalue) or 2×2 (complex-conjugate eigenvalue pair)
 *
 * Algorithm: Householder reduction to upper Hessenberg form followed by
 * Francis double-shift implicit QR iteration (Golub & Van Loan §7.5).
 *
 * References:
 *   Golub & Van Loan (2013) "Matrix Computations," 4th ed., §7.5.
 *   Higham (2008) "Functions of Matrices: Theory and Computation," §1.
 */

import { DenseMatrix } from '../types/DenseMatrix.js';
import {
  eye,
  cloneMatrix,
  householder,
  applyHouseholderLeft,
  applyHouseholderRight,
} from './common.js';

// ---------------------------------------------------------------------------
// Internal helpers
//
// NOTE: schur passes `beta = 2` to `householder` for the degenerate
// negative-x0 branch (H = I − 2·e_1·e_1ᵀ = diag(−1, 1, ..., 1)) — a deliberate
// divergence from eig/svd (which use the default −2). Preserved at the two
// call sites below.
// ---------------------------------------------------------------------------

function hessenbergReduce(A: number[][]): { H: number[][]; Q: number[][] } {
  const n = A.length;
  const H = cloneMatrix(A);
  const Q = eye(n);

  for (let k = 0; k < n - 2; k++) {
    const x: number[] = [];
    for (let i = k + 1; i < n; i++) x.push(H[i][k]);

    const { v, beta } = householder(x, 2);

    if (beta !== 0) {
      applyHouseholderLeft(H, v, beta, k + 1, k);
      applyHouseholderRight(H, v, beta, 0, k + 1);
      applyHouseholderRight(Q, v, beta, 0, k + 1);
    }
  }

  // Zero out below-subdiagonal entries (numerical cleanup)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < i - 1; j++) H[i][j] = 0;

  return { H, Q };
}

function givensParams(a: number, b: number): { c: number; s: number } {
  if (b === 0) return { c: 1, s: 0 };
  if (Math.abs(b) > Math.abs(a)) {
    const t = -a / b;
    const s = 1 / Math.sqrt(1 + t * t);
    return { c: s * t, s };
  }
  const t = -b / a;
  const c = 1 / Math.sqrt(1 + t * t);
  return { c, s: c * t };
}

function applyGivensLeft(A: number[][], c: number, s: number, i: number, k: number, startCol: number): void {
  const n = A[0].length;
  for (let j = startCol; j < n; j++) {
    const temp = c * A[i][j] - s * A[k][j];
    A[k][j] = s * A[i][j] + c * A[k][j];
    A[i][j] = temp;
  }
}

function applyGivensRight(A: number[][], c: number, s: number, i: number, k: number, startRow: number): void {
  const m = A.length;
  for (let j = startRow; j < m; j++) {
    const temp = c * A[j][i] - s * A[j][k];
    A[j][k] = s * A[j][i] + c * A[j][k];
    A[j][i] = temp;
  }
}

function qrStepSingle(H: number[][], Q: number[][], start: number, end: number): void {
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

  let x = H[start][start] - shift;
  let y = H[start + 1][start];

  for (let k = start; k < end; k++) {
    const { c: gc, s: gs } = givensParams(x, y);
    applyGivensLeft(H, gc, gs, k, k + 1, Math.max(0, k - 1));
    applyGivensRight(H, gc, gs, k, k + 1, 0);
    applyGivensRight(Q, gc, gs, k, k + 1, 0);
    if (k < end - 1) {
      x = H[k + 1][k];
      y = H[k + 2][k];
    }
  }
}

function qrStepDouble(H: number[][], Q: number[][], start: number, end: number): void {
  // Francis double-shift: chase the bulge introduced by (H-s1*I)(H-s2*I)
  // where s1, s2 are the eigenvalues of the trailing 2x2 block.
  const n = H.length;
  const a = H[end - 1][end - 1];
  const b = H[end - 1][end];
  const c = H[end][end - 1];
  const d = H[end][end];

  const s = a + d;
  const t = a * d - b * c;

  let x =
    H[start][start] * H[start][start] +
    H[start][start + 1] * H[start + 1][start] -
    s * H[start][start] +
    t;
  let y = H[start + 1][start] * (H[start][start] + H[start + 1][start + 1] - s);
  let z = H[start + 1][start] * H[start + 2][start + 1];

  for (let k = start; k <= end - 2; k++) {
    const { v, beta } = householder([x, y, z], 2);

    const q = Math.max(start, k - 1);

    for (let j = q; j < n; j++) {
      let dot = v[0] * H[k][j] + v[1] * H[k + 1][j] + v[2] * H[k + 2][j];
      dot *= beta;
      H[k][j] -= dot * v[0];
      H[k + 1][j] -= dot * v[1];
      H[k + 2][j] -= dot * v[2];
    }

    const r = Math.min(k + 4, end + 1);
    for (let i = 0; i < r; i++) {
      let dot = v[0] * H[i][k] + v[1] * H[i][k + 1] + v[2] * H[i][k + 2];
      dot *= beta;
      H[i][k] -= dot * v[0];
      H[i][k + 1] -= dot * v[1];
      H[i][k + 2] -= dot * v[2];
    }

    for (let i = 0; i < n; i++) {
      let dot = v[0] * Q[i][k] + v[1] * Q[i][k + 1] + v[2] * Q[i][k + 2];
      dot *= beta;
      Q[i][k] -= dot * v[0];
      Q[i][k + 1] -= dot * v[1];
      Q[i][k + 2] -= dot * v[2];
    }

    x = H[k + 1][k];
    y = H[k + 2][k];
    if (k < end - 2) z = H[k + 3][k];
  }

  const { c: gc, s: gs } = givensParams(x, y);
  applyGivensLeft(H, gc, gs, end - 1, end, end - 2);
  applyGivensRight(H, gc, gs, end - 1, end, 0);
  applyGivensRight(Q, gc, gs, end - 1, end, 0);
}

/**
 * Compute the real Schur decomposition of a square real matrix from a 2-D
 * array. Returns H (quasi-upper-triangular) and Q (orthogonal accumulator).
 */
function schurRaw(
  A: number[][],
  maxIterations: number,
  tolerance: number
): { H: number[][]; Q: number[][] } {
  const n = A.length;

  if (n === 1) {
    return { H: [[A[0][0]]], Q: [[1]] };
  }

  const { H, Q } = hessenbergReduce(A);

  let end = n - 1;
  let iter = 0;

  while (end > 0 && iter < maxIterations) {
    // Deflation: zero out negligible subdiagonal entries
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
      end--;
    } else if (start === end - 1) {
      end -= 2;
    } else {
      if (end - start >= 2) {
        qrStepDouble(H, Q, start, end);
      } else {
        qrStepSingle(H, Q, start, end);
      }
    }
    iter++;
  }

  return { H, Q };
}

// ---------------------------------------------------------------------------
// Public types and API
// ---------------------------------------------------------------------------

export interface SchurResult {
  /** Orthogonal factor Q (Q^T · Q = I, Q · Q^T = I). */
  Q: DenseMatrix;
  /** Quasi-upper-triangular Schur form T (real Schur form). */
  T: DenseMatrix;
}

export interface SchurOptions {
  /** Maximum QR iterations (default: 1000). */
  maxIterations?: number;
  /** Deflation tolerance (default: 1e-12). */
  tolerance?: number;
}

/**
 * Compute the real Schur decomposition of a square matrix:
 *   A = Q · T · Q^T
 *
 * T is quasi-upper-triangular (real Schur form): 1×1 diagonal blocks for
 * real eigenvalues and 2×2 blocks for complex-conjugate pairs. Q is
 * orthogonal.
 *
 * For matrices with all real eigenvalues, T is upper triangular with
 * eigenvalues on the diagonal. For matrices with complex-conjugate eigenvalue
 * pairs, the corresponding 2×2 diagonal block has the form
 *   [[a, b], [-b, a]]  (approximately)
 * and the complex pair is  a ± bi.
 *
 * @param A - Square DenseMatrix (n × n, real entries).
 * @param opts - Optional algorithm parameters.
 * @returns { Q, T } satisfying Q · T · Q^T ≈ A.
 * @throws Error if A is not square.
 */
export function matrixSchur(A: DenseMatrix, opts?: SchurOptions): SchurResult {
  const n = A.rows;
  if (n !== A.cols) throw new Error(`matrixSchur: matrix must be square (got ${A.rows}×${A.cols})`);
  if (n === 0) {
    return {
      Q: DenseMatrix.zeros(0, 0),
      T: DenseMatrix.zeros(0, 0),
    };
  }

  const maxIterations = opts?.maxIterations ?? 1000;
  const tolerance = opts?.tolerance ?? 1e-12;

  const Aarr = A.toArray();
  const { H, Q } = schurRaw(Aarr, maxIterations, tolerance);

  const n2 = n * n;
  const qData = new Float64Array(n2);
  const tData = new Float64Array(n2);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      qData[i * n + j] = Q[i][j];
      tData[i * n + j] = H[i][j];
    }
  }

  return {
    Q: new DenseMatrix(n, n, qData),
    T: new DenseMatrix(n, n, tData),
  };
}

// ---------------------------------------------------------------------------
// Internal export for logm.ts and sqrtm.ts
// ---------------------------------------------------------------------------

/**
 * Low-level Schur decomposition on a 2-D number array.
 * Returns mutable H and Q arrays suitable for further in-place operations.
 * @internal
 */
export function schurInternal(
  A: number[][],
  maxIterations = 1000,
  tolerance = 1e-12
): { H: number[][]; Q: number[][] } {
  return schurRaw(A, maxIterations, tolerance);
}

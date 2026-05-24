/**
 * Tests for matrixSqrtm — matrix square root (eig-based, Slice 5.9a).
 *
 * Coverage:
 *  1.  sqrtm(I) = I  (identity maps to identity)
 *  2.  sqrtm(4 * I) = 2 * I  (scalar multiple of identity)
 *  3.  sqrtm(A)^2 ≈ A  (round-trip for SPD matrix)
 *  4.  SPD case: [[4,2],[2,3]] → result * result ≈ A
 *  5.  Diagonal case: sqrtm(diag(a, b)) = diag(sqrt(a), sqrt(b))
 *  6.  1×1 matrix: sqrtm([[x]]) = [[sqrt(x)]]
 *  7.  Symmetric positive semi-definite (one zero eigenvalue): result * result ≈ A
 *  8.  Negative eigenvalue: throws with clear message
 *  9.  Non-symmetric positive definite matrix
 * 10.  sqrtm result has non-negative diagonal elements for SPD input
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { matrixSqrtm } from '../../src/operations/sqrtm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Frobenius distance between two DenseMatrix objects. */
function frobDiff(A: DenseMatrix, B: DenseMatrix): number {
  const aArr = A.toArray();
  const bArr = B.toArray();
  let s = 0;
  for (let i = 0; i < aArr.length; i++)
    for (let j = 0; j < aArr[0].length; j++) {
      const d = aArr[i][j] - bArr[i][j];
      s += d * d;
    }
  return Math.sqrt(s);
}

/** Make an n×n identity DenseMatrix. */
function eye(n: number): DenseMatrix {
  return DenseMatrix.fromArray(
    Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)))
  );
}

/** Multiply two DenseMatrix objects. */
function matMulDense(A: DenseMatrix, B: DenseMatrix): DenseMatrix {
  const m = A.rows;
  const p = A.cols;
  const n = B.cols;
  const aArr = A.toArray();
  const bArr = B.toArray();
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) for (let j = 0; j < n; j++) C[i][j] += aArr[i][k] * bArr[k][j];
  return DenseMatrix.fromArray(C);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('matrixSqrtm', () => {
  it('1. sqrtm(I) = I (identity → identity)', () => {
    const I3 = eye(3);
    const R = matrixSqrtm(I3);
    expect(frobDiff(R, I3)).toBeLessThan(1e-12);
  });

  it('2. sqrtm(4 * I) = 2 * I', () => {
    const fourI = DenseMatrix.fromArray([
      [4, 0, 0],
      [0, 4, 0],
      [0, 0, 4],
    ]);
    const R = matrixSqrtm(fourI);
    const twoI = DenseMatrix.fromArray([
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2],
    ]);
    expect(frobDiff(R, twoI)).toBeLessThan(1e-12);
  });

  it('3. sqrtm(A)^2 ≈ A for SPD 3×3 matrix', () => {
    // Build SPD: A = B * B^T for well-conditioned B
    const A = DenseMatrix.fromArray([
      [6, 2, 1],
      [2, 5, 1],
      [1, 1, 4],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-8);
  });

  it('4. SPD 2×2: sqrtm([[4,2],[2,3]])^2 ≈ [[4,2],[2,3]]', () => {
    const A = DenseMatrix.fromArray([
      [4, 2],
      [2, 3],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-10);
  });

  it('5. Diagonal: sqrtm(diag(a, b)) = diag(sqrt(a), sqrt(b))', () => {
    const a = 9;
    const b = 16;
    const D = DenseMatrix.fromArray([
      [a, 0],
      [0, b],
    ]);
    const R = matrixSqrtm(D);
    const expected = DenseMatrix.fromArray([
      [Math.sqrt(a), 0],
      [0, Math.sqrt(b)],
    ]);
    expect(frobDiff(R, expected)).toBeLessThan(1e-12);
  });

  it('6. 1×1 matrix: sqrtm([[x]]) = [[sqrt(x)]]', () => {
    const x = 7.29;
    const A = DenseMatrix.fromArray([[x]]);
    const R = matrixSqrtm(A);
    expect(Math.abs(R.get(0, 0) - Math.sqrt(x))).toBeLessThan(1e-12);
  });

  it('7. Symmetric PSD (one zero eigenvalue): sqrtm(A)^2 ≈ A', () => {
    // rank-1 SPD: outer product of [1, 2, 3]
    const A = DenseMatrix.fromArray([
      [1, 2, 3],
      [2, 4, 6],
      [3, 6, 9],
    ]);
    // Should not throw; sqrtm(A)^2 ≈ A
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-8);
  });

  it('8. Negative eigenvalue: throws with informative message', () => {
    const A = DenseMatrix.fromArray([
      [-4, 0],
      [0, 1],
    ]);
    expect(() => matrixSqrtm(A)).toThrow(/negative eigenvalue|not supported|not real/i);
  });

  it('9. Non-symmetric positive definite: sqrtm(A)^2 ≈ A (via general eig path)', () => {
    // Diagonalisable matrix with positive eigenvalues but not symmetric
    // A = [[5, 1], [0, 3]] — upper triangular, eigenvalues 5 and 3
    const A = DenseMatrix.fromArray([
      [5, 1],
      [0, 3],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-8);
  });

  it('10. sqrtm result has non-negative diagonal for SPD input', () => {
    const A = DenseMatrix.fromArray([
      [4, 1, 0],
      [1, 3, 0.5],
      [0, 0.5, 2],
    ]);
    const R = matrixSqrtm(A);
    const Rarr = R.toArray();
    for (let i = 0; i < 3; i++) {
      expect(Rarr[i][i]).toBeGreaterThanOrEqual(-1e-10);
    }
  });

  // ---------------------------------------------------------------------------
  // Slice 6.1 — Schur-Björck-Hammarling general-case tests
  // ---------------------------------------------------------------------------

  it('11. Schur path: defective 2×2 Jordan block (repeated eigenvalue, non-diagonalisable)', () => {
    // A = [[4, 1], [0, 4]] — Jordan block. sqrtm via Björck recurrence:
    // U_00 = sqrt(4) = 2, U_11 = 2, U_01 = T_01/(U_00+U_11) = 1/4 = 0.25
    const A = DenseMatrix.fromArray([
      [4, 1],
      [0, 4],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-10);
    // Verify known closed-form values (Björck-Hammarling)
    const Rarr = R.toArray();
    expect(Math.abs(Rarr[0][0] - 2)).toBeLessThan(1e-10);
    expect(Math.abs(Rarr[1][1] - 2)).toBeLessThan(1e-10);
    expect(Math.abs(Rarr[0][1] - 0.25)).toBeLessThan(1e-10);
    expect(Math.abs(Rarr[1][0])).toBeLessThan(1e-10);
  });

  it('12. Schur path: 3×3 defective Jordan block sqrtm', () => {
    // A = [[4,1,0],[0,4,1],[0,0,4]] — Jordan block of size 3.
    // U_00=U_11=U_22=2, U_01=U_12=0.25, U_02 = (0 - 0.25*0.25)/(2+2) = -0.015625
    const A = DenseMatrix.fromArray([
      [4, 1, 0],
      [0, 4, 1],
      [0, 0, 4],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-8);
    const Rarr = R.toArray();
    // Diagonal
    for (let i = 0; i < 3; i++) expect(Math.abs(Rarr[i][i] - 2)).toBeLessThan(1e-8);
    // Known off-diagonal entries (Björck recurrence)
    expect(Math.abs(Rarr[0][1] - 0.25)).toBeLessThan(1e-8);
    expect(Math.abs(Rarr[1][2] - 0.25)).toBeLessThan(1e-8);
    expect(Math.abs(Rarr[0][2] - (-0.015625))).toBeLessThan(1e-8);
  });

  it('13. Schur path: matrix with complex-conjugate eigenvalues (2D rotation)', () => {
    // A = [[0, -1], [1, 0]] — eigenvalues ±i. sqrtm = rotation by π/4.
    // SciPy reference: sqrtm([[0,-1],[1,0]]) = (1/√2)*[[1,-1],[1,1]]
    const A = DenseMatrix.fromArray([
      [0, -1],
      [1, 0],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-10);
    // Closed form: R = (1/sqrt(2))*[[1,-1],[1,1]]
    const s = 1 / Math.sqrt(2);
    const Rarr = R.toArray();
    expect(Math.abs(Math.abs(Rarr[0][0]) - s)).toBeLessThan(1e-8);
    expect(Math.abs(Math.abs(Rarr[0][1]) - s)).toBeLessThan(1e-8);
    expect(Math.abs(Math.abs(Rarr[1][0]) - s)).toBeLessThan(1e-8);
    expect(Math.abs(Math.abs(Rarr[1][1]) - s)).toBeLessThan(1e-8);
  });

  it('14. Schur path: 4×4 block-diagonal with two complex-eigenvalue blocks', () => {
    // A = [[0,-1,0,0],[1,0,0,0],[0,0,0,-1],[0,0,1,0]] — two rotation blocks (eigenvalues ±i each)
    const A = DenseMatrix.fromArray([
      [0, -1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, -1],
      [0, 0, 1, 0],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-8);
  });

  it('15. Schur path: upper-triangular with repeated positive eigenvalue', () => {
    // A = [[3, 1], [0, 3]] — repeated eigenvalue 3.
    // U_00=U_11=sqrt(3), U_01=1/(2*sqrt(3))
    const A = DenseMatrix.fromArray([
      [3, 1],
      [0, 3],
    ]);
    const R = matrixSqrtm(A);
    const R2 = matMulDense(R, R);
    expect(frobDiff(R2, A)).toBeLessThan(1e-10);
    const Rarr = R.toArray();
    expect(Math.abs(Rarr[0][0] - Math.sqrt(3))).toBeLessThan(1e-8);
    expect(Math.abs(Rarr[1][1] - Math.sqrt(3))).toBeLessThan(1e-8);
    // U_01 = T_01 / (U_00 + U_11) = 1 / (2*sqrt(3))
    expect(Math.abs(Rarr[0][1] - 1 / (2 * Math.sqrt(3)))).toBeLessThan(1e-8);
  });
});

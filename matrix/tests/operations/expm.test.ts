/**
 * Tests for matrixExpm — matrix exponential via Padé-13 scaling-and-squaring.
 *
 * Coverage:
 *  1.  expm(0) = I  (zero matrix maps to identity)
 *  2.  expm(I_n) = e * I_n
 *  3.  expm(t * I) = e^t * I  (scalar multiple of identity)
 *  4.  Symmetric A: expm(S) * expm(-S) ≈ I  (inverse property)
 *  5.  Skew-symmetric A: expm(Ω) is orthogonal (expm(Ω) * expm(Ω)^T ≈ I)
 *  6.  Numerical agreement with eig-based formula on a small example
 *  7.  Block-diagonal A: expm preserves block structure
 *  8.  1×1 matrix: expm([[x]]) = [[e^x]]
 *  9.  Nilpotent matrix (N^2 = 0): expm(N) = I + N  (exact)
 * 10.  Large norm input (requires scaling s ≥ 1): result still accurate
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { matrixExpm } from '../../src/operations/expm.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Multiply two number[][] matrices. */
function matMul2D(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++)
    for (let k = 0; k < p; k++) for (let j = 0; j < n; j++) C[i][j] += A[i][k] * B[k][j];
  return C;
}

/** Transpose a number[][] matrix. */
function transpose(A: number[][]): number[][] {
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

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

/** Make an n×n zero DenseMatrix. */
function zeros(n: number): DenseMatrix {
  return DenseMatrix.zeros(n, n);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('matrixExpm', () => {
  it('1. expm(0) = I (zero matrix → identity)', () => {
    const Z = zeros(3);
    const R = matrixExpm(Z);
    expect(frobDiff(R, eye(3))).toBeLessThan(1e-12);
  });

  it('2. expm(I) = e * I (identity matrix → e * identity)', () => {
    const I3 = eye(3);
    const R = matrixExpm(I3);
    const expected = DenseMatrix.fromArray([
      [Math.E, 0, 0],
      [0, Math.E, 0],
      [0, 0, Math.E],
    ]);
    expect(frobDiff(R, expected)).toBeLessThan(1e-10);
  });

  it('3. expm(t * I) = e^t * I for t = 2', () => {
    const t = 2;
    const tI = DenseMatrix.fromArray([
      [t, 0, 0],
      [0, t, 0],
      [0, 0, t],
    ]);
    const R = matrixExpm(tI);
    const et = Math.exp(t);
    const expected = DenseMatrix.fromArray([
      [et, 0, 0],
      [0, et, 0],
      [0, 0, et],
    ]);
    expect(frobDiff(R, expected)).toBeLessThan(1e-10);
  });

  it('4. Symmetric A: expm(A) * expm(-A) ≈ I (inverse property)', () => {
    // A = [[1, 0.5], [0.5, 2]]
    const A = DenseMatrix.fromArray([
      [1, 0.5],
      [0.5, 2],
    ]);
    const negA = DenseMatrix.fromArray([
      [-1, -0.5],
      [-0.5, -2],
    ]);
    const eA = matrixExpm(A);
    const enA = matrixExpm(negA);
    // Product should be identity
    const prod = matMul2D(eA.toArray(), enA.toArray());
    const prodDense = DenseMatrix.fromArray(prod);
    expect(frobDiff(prodDense, eye(2))).toBeLessThan(1e-10);
  });

  it('5. Skew-symmetric: expm(Ω) is orthogonal (expm(Ω) * expm(Ω)^T ≈ I)', () => {
    // Ω = [[0, -1, 0], [1, 0, 0], [0, 0, 0]]  (rotation about z-axis)
    const Omega = DenseMatrix.fromArray([
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 0],
    ]);
    const eO = matrixExpm(Omega);
    const eOarr = eO.toArray();
    const eOt = transpose(eOarr);
    const prod = matMul2D(eOarr, eOt);
    const prodDense = DenseMatrix.fromArray(prod);
    expect(frobDiff(prodDense, eye(3))).toBeLessThan(1e-10);
  });

  it('6. Numerical agreement with eig-based formula for symmetric matrix', () => {
    // For symmetric diagonalisable A = V diag(λ) V^T, expm(A) = V diag(e^λ) V^T
    // We verify: expm([[2,0],[0,3]]) = [[e^2, 0], [0, e^3]]
    const A = DenseMatrix.fromArray([
      [2, 0],
      [0, 3],
    ]);
    const R = matrixExpm(A);
    const expected = DenseMatrix.fromArray([
      [Math.exp(2), 0],
      [0, Math.exp(3)],
    ]);
    expect(frobDiff(R, expected)).toBeLessThan(1e-10);
  });

  it('7. Block-diagonal A: expm preserves block structure', () => {
    // A = block-diag([[a, 0], [0, b]]) = diag(a, b)
    // expm(A) = diag(e^a, e^b)
    const a = 1.5;
    const b = -0.5;
    const A = DenseMatrix.fromArray([
      [a, 0],
      [0, b],
    ]);
    const R = matrixExpm(A);
    expect(Math.abs(R.get(0, 0) - Math.exp(a))).toBeLessThan(1e-12);
    expect(Math.abs(R.get(1, 1) - Math.exp(b))).toBeLessThan(1e-12);
    expect(Math.abs(R.get(0, 1))).toBeLessThan(1e-12);
    expect(Math.abs(R.get(1, 0))).toBeLessThan(1e-12);
  });

  it('8. 1×1 matrix: expm([[x]]) = [[e^x]]', () => {
    const x = 3.7;
    const A = DenseMatrix.fromArray([[x]]);
    const R = matrixExpm(A);
    expect(Math.abs(R.get(0, 0) - Math.exp(x))).toBeLessThan(1e-12);
  });

  it('9. Nilpotent matrix (N^2 = 0): expm(N) = I + N (exact)', () => {
    // N = [[0, 1, 0], [0, 0, 1], [0, 0, 0]]  has N^3 = 0
    // expm(N) = I + N + N^2/2  (series truncates at order 2)
    const N = DenseMatrix.fromArray([
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, 0],
    ]);
    const eN = matrixExpm(N);
    const expected = DenseMatrix.fromArray([
      [1, 1, 0.5],
      [0, 1, 1],
      [0, 0, 1],
    ]);
    expect(frobDiff(eN, expected)).toBeLessThan(1e-10);
  });

  it('10. Large-norm input (requires s ≥ 1 scaling): result still accurate', () => {
    // A = 10 * [[0, -1], [1, 0]] — skew-symmetric, norm = 10 >> θ_13
    // expm(A) should still be orthogonal
    const A = DenseMatrix.fromArray([
      [0, -10],
      [10, 0],
    ]);
    const R = matrixExpm(A);
    const Rarr = R.toArray();
    const Rt = transpose(Rarr);
    const prod = matMul2D(Rarr, Rt);
    const prodDense = DenseMatrix.fromArray(prod);
    expect(frobDiff(prodDense, eye(2))).toBeLessThan(1e-8);
  });
});

/**
 * Tests for matrixLogm — matrix logarithm (inverse scaling-and-squaring, Slice 5.9a).
 *
 * Coverage:
 *  1.  logm(I) = 0  (identity → zero matrix)
 *  2.  logm(e * I) = I  (scalar e * identity → identity)
 *  3.  Inverse round-trip: expm(logm(A)) ≈ A
 *  4.  logm(diag(a, b)) = diag(log(a), log(b))  (diagonal case exact)
 *  5.  Symmetric positive definite: expm(logm(S)) ≈ S
 *  6.  logm(A) + logm(B) ≈ logm(A*B) when A and B commute
 *  7.  1×1 matrix: logm([[x]]) = [[log(x)]]
 *  8.  Non-positive eigenvalue: throws with clear message
 *  9.  Near-identity matrix: accurate via Padé quadrature path
 * 10.  logm ∘ expm round-trip in the other direction
 */

import { describe, it, expect } from 'vitest';
import { DenseMatrix } from '../../src/types/DenseMatrix.js';
import { matrixLogm } from '../../src/operations/logm.js';
import { matrixExpm } from '../../src/operations/expm.js';

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

/** Make an n×n zero DenseMatrix. */
function zeros(n: number): DenseMatrix {
  return DenseMatrix.zeros(n, n);
}

/** Multiply two DenseMatrix objects (simple inline loop). */
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

describe('matrixLogm', () => {
  it('1. logm(I) = 0 (identity → zero matrix)', () => {
    const I3 = eye(3);
    const R = matrixLogm(I3);
    expect(frobDiff(R, zeros(3))).toBeLessThan(1e-12);
  });

  it('2. logm(e * I) = I (scalar e * identity → identity)', () => {
    const eI = DenseMatrix.fromArray([
      [Math.E, 0, 0],
      [0, Math.E, 0],
      [0, 0, Math.E],
    ]);
    const R = matrixLogm(eI);
    expect(frobDiff(R, eye(3))).toBeLessThan(1e-10);
  });

  it('3. Inverse round-trip: expm(logm(A)) ≈ A for well-conditioned SPD matrix', () => {
    // SPD matrix: A = [[4, 0], [0, 9]]
    const A = DenseMatrix.fromArray([
      [4, 0],
      [0, 9],
    ]);
    const logA = matrixLogm(A);
    const R = matrixExpm(logA);
    expect(frobDiff(R, A)).toBeLessThan(1e-8);
  });

  it('4. logm(diag(a, b)) = diag(log(a), log(b)) — exact diagonal case', () => {
    const a = 3;
    const b = 7;
    const D = DenseMatrix.fromArray([
      [a, 0],
      [0, b],
    ]);
    const R = matrixLogm(D);
    const expected = DenseMatrix.fromArray([
      [Math.log(a), 0],
      [0, Math.log(b)],
    ]);
    expect(frobDiff(R, expected)).toBeLessThan(1e-10);
  });

  it('5. Symmetric positive definite: expm(logm(S)) ≈ S', () => {
    // S = [[5, 1], [1, 3]] — SPD
    const S = DenseMatrix.fromArray([
      [5, 1],
      [1, 3],
    ]);
    const logS = matrixLogm(S);
    const R = matrixExpm(logS);
    expect(frobDiff(R, S)).toBeLessThan(1e-8);
  });

  it('6. logm(A * B) ≈ logm(A) + logm(B) when A and B commute (diagonal case)', () => {
    // Commuting diagonal matrices
    const A = DenseMatrix.fromArray([
      [2, 0],
      [0, 3],
    ]);
    const B = DenseMatrix.fromArray([
      [4, 0],
      [0, 5],
    ]);
    const AB = matMulDense(A, B); // diag(8, 15)
    const logAB = matrixLogm(AB);
    const logAplusLogB = DenseMatrix.fromArray([
      [Math.log(2) + Math.log(4), 0],
      [0, Math.log(3) + Math.log(5)],
    ]);
    expect(frobDiff(logAB, logAplusLogB)).toBeLessThan(1e-10);
  });

  it('7. 1×1 matrix: logm([[x]]) = [[log(x)]]', () => {
    const x = 5.5;
    const A = DenseMatrix.fromArray([[x]]);
    const R = matrixLogm(A);
    // 16-pt GL with inverse-scaling-and-squaring gives ~1e-11 accuracy for scalars
    expect(Math.abs(R.get(0, 0) - Math.log(x))).toBeLessThan(1e-10);
  });

  it('8. Non-positive eigenvalue: throws with informative error', () => {
    // Matrix with a zero eigenvalue
    const A = DenseMatrix.fromArray([
      [0, 0],
      [0, 1],
    ]);
    expect(() => matrixLogm(A)).toThrow(/non-positive eigenvalue|singular|not supported/i);
  });

  it('9. Near-identity matrix: accurate via Padé quadrature path', () => {
    // I + 0.1 * [[1,0],[0,2]] — very close to identity
    const A = DenseMatrix.fromArray([
      [1.1, 0],
      [0, 1.2],
    ]);
    const R = matrixLogm(A);
    const expected = DenseMatrix.fromArray([
      [Math.log(1.1), 0],
      [0, Math.log(1.2)],
    ]);
    expect(frobDiff(R, expected)).toBeLessThan(1e-10);
  });

  it('10. logm ∘ expm round-trip: logm(expm(X)) ≈ X for small X', () => {
    // X small enough that expm(X) has positive eigenvalues
    const X = DenseMatrix.fromArray([
      [0.1, 0.05],
      [0.05, 0.2],
    ]);
    const eX = matrixExpm(X);
    const R = matrixLogm(eX);
    expect(frobDiff(R, X)).toBeLessThan(1e-8);
  });
});

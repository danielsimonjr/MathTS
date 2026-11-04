import { describe, it, expect } from 'vitest';
import {
  subspaceAngles,
  signm,
  fractionalMatrixPower,
  choleskyUpdate,
  choleskyDowndate,
} from '../src/linalg-extra2.js';

const mm = (A: number[][], B: number[][]): number[][] =>
  A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));

describe('linalg-extra2', () => {
  it('subspaceAngles against a line in the plane and orthogonal line', () => {
    const A = [
      [1, 0],
      [0, 1],
      [0, 0],
    ];
    const a = subspaceAngles(A, [[1], [0], [1]]);
    expect(a.length).toBe(1);
    expect(a[0]).toBeCloseTo(Math.PI / 4, 12);
    expect(subspaceAngles(A, [[0], [0], [1]])[0]).toBeCloseTo(Math.PI / 2, 12);
    expect(subspaceAngles(A, [[1], [0], [0]])[0]).toBeCloseTo(0, 12);
  });

  it('signm of a diagonal matrix with mixed signs', () => {
    const S = signm([
      [2, 0],
      [0, -3],
    ]);
    expect(S[0][0]).toBeCloseTo(1, 12);
    expect(S[0][1]).toBeCloseTo(0, 12);
    expect(S[1][0]).toBeCloseTo(0, 12);
    expect(S[1][1]).toBeCloseTo(-1, 12);
  });

  it('fractionalMatrixPower square root of a diagonal matrix', () => {
    const R = fractionalMatrixPower(
      [
        [4, 0],
        [0, 9],
      ],
      0.5
    );
    expect(R[0][0]).toBeCloseTo(2, 10);
    expect(R[0][1]).toBeCloseTo(0, 10);
    expect(R[1][1]).toBeCloseTo(3, 10);
  });

  it('fractionalMatrixPower(A, 0.5) squared recovers A', () => {
    const A = [
      [2, 1],
      [1, 2],
    ];
    const R = fractionalMatrixPower(A, 0.5);
    const RR = mm(R, R);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) expect(RR[i][j]).toBeCloseTo(A[i][j], 10);
  });

  it('fractionalMatrixPower with integer exponent uses exact powers', () => {
    const R = fractionalMatrixPower(
      [
        [1, 1],
        [0, 1],
      ],
      3
    );
    expect(R[0][1]).toBeCloseTo(3, 12);
  });

  it('choleskyUpdate of the identity by [1,1]', () => {
    const L = choleskyUpdate(
      [
        [1, 0],
        [0, 1],
      ],
      [1, 1]
    );
    expect(L[0][0]).toBeCloseTo(1.4142135623730951, 12);
    expect(L[0][1]).toBe(0);
    expect(L[1][0]).toBeCloseTo(0.7071067811865476, 12);
    expect(L[1][1]).toBeCloseTo(1.224744871391589, 12);
  });

  it('choleskyDowndate reverses choleskyUpdate back to identity', () => {
    const up = choleskyUpdate(
      [
        [1, 0],
        [0, 1],
      ],
      [1, 1]
    );
    const down = choleskyDowndate(up, [1, 1]);
    expect(down[0][0]).toBeCloseTo(1, 12);
    expect(down[1][0]).toBeCloseTo(0, 12);
    expect(down[1][1]).toBeCloseTo(1, 12);
  });

  it('choleskyDowndate throws RangeError when not positive definite', () => {
    expect(() =>
      choleskyDowndate(
        [
          [1, 0],
          [0, 1],
        ],
        [2, 0]
      )
    ).toThrow(RangeError);
  });
});

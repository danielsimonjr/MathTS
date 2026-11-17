/**
 * Dogfood #1082: the SVD of a matrix whose leading column entry is negative and whose
 * entries below it are zero. The Householder helper returned beta = -2 for that column.
 * H = I - beta v v^T is orthogonal only for beta 0 or 2, so beta -2 scaled the row by 3.
 * Oracle: NumPy 2.3.5 `np.linalg.svd(A, compute_uv=False)`.
 */
import { describe, it, expect } from 'vitest';
import { svd, singularValues, norm2 } from '../src/operations/svd.js';

const CASES: Array<[number[][], number[]]> = [
  [
    [
      [-3, 0],
      [0, 1],
    ],
    [3, 1],
  ],
  [
    [
      [-3, 0],
      [0, -1],
    ],
    [3, 1],
  ],
  [
    [
      [1, 0],
      [0, -3],
    ],
    [3, 1],
  ],
  [
    [
      [0, -3],
      [1, 0],
    ],
    [3, 1],
  ],
  [
    [
      [-1, 2],
      [3, -4],
    ],
    [5.464985704219043, 0.36596619062625746],
  ],
  [
    [
      [-3, 0, 0],
      [0, 1, 0],
      [0, 0, 2],
    ],
    [3, 2, 1],
  ],
  [
    [
      [-3, 0, 0],
      [0, 0, 0],
    ],
    [3, 0],
  ],
  [
    [
      [-3, 0],
      [0, 0],
      [0, 0],
    ],
    [3, 0],
  ],
];

function reconstruct(A: number[][]): number[][] {
  const { U, S, V } = svd(A);
  const m = A.length;
  const n = A[0].length;
  return Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => S.reduce((acc, s, k) => acc + U[i][k] * s * V[j][k], 0))
  );
}

describe('SVD of a matrix with a negative leading entry (#1082)', () => {
  it.each(CASES)('singularValues(%j) matches NumPy', (A, expected) => {
    const sv = singularValues(A);
    expect(sv).toHaveLength(expected.length);
    expected.forEach((v, i) => expect(sv[i]).toBeCloseTo(v, 12));
  });
  it('norm2([[-3,0],[0,1]]) is 3', () => {
    expect(
      norm2([
        [-3, 0],
        [0, 1],
      ])
    ).toBeCloseTo(3, 12);
  });
  it.each(CASES)('U S V^T rebuilds %j', (A) => {
    const R = reconstruct(A);
    A.forEach((row, i) => row.forEach((v, j) => expect(R[i][j]).toBeCloseTo(v, 10)));
  });
});

/**
 * Dogfood #1287 (review of #1169) - the pivot test of linsolve and lusolve must keep rejecting a
 * rank-deficient matrix. The pivot that a cancellation leaves is a few eps times the terms that
 * cancelled; a floor of 1e-15 (4.5 eps) times the row scale let such a matrix through and
 * returned an answer of size 1e16. The matrices below are exactly rank 2 in decimal arithmetic:
 * the third row is a combination of the first two. The controls are regular and must still solve.
 *
 * The pivot is compared with the largest term that cancelled in its own entry, so the test does
 * not change when a column is multiplied by a constant. A test against the largest entry of the
 * pivot row refused the column-graded systems below, which are regular (closed-form answers).
 */
import { describe, it, expect } from 'vitest';
import { linsolve, lusolve, matrix, sparse } from '../src/index.js';

const rankDeficient: number[][][] = [
  [
    [-0.8, -0.9, 0.4],
    [0.2, 0.3, 0.1],
    [-0.44, -0.5700000000000001, 0.01999999999999999],
  ],
  [
    [0.1, -0.5, -0.8],
    [0.2, -0.7, 0.7],
    [0.09999999999999999, -0.31999999999999995, 0.5800000000000001],
  ],
  [
    [-0.4, 0.1, -1],
    [0.6, -0.1, -0.9],
    [0.72, -0.15000000000000002, 0.36],
  ],
  [
    [0.5, -0.7, -0.4],
    [-0.7, 0.8, -0.1],
    [0.48, -0.6000000000000001, -0.12000000000000002],
  ],
];

describe('#1287 a rank-deficient matrix is singular for linsolve and lusolve', () => {
  rankDeficient.forEach((A, k) => {
    it(`matrix ${k + 1}`, () => {
      expect(() => linsolve(A, [1, 2, 3])).toThrow(/singular/);
      expect(() => lusolve(A, [[1], [2], [3]])).toThrow(/singular/);
      expect(() => lusolve(matrix(A), [[1], [2], [3]])).toThrow(/singular/);
      expect(() => lusolve(sparse(A), [[1], [2], [3]])).toThrow(/singular/);
    });
  });
});

describe('#1287 regular matrices still solve', () => {
  it('diag(1e10, 1e-7) has the solution [1e-10, 1e7]', () => {
    const D = [
      [1e10, 0],
      [0, 1e-7],
    ];
    const x = linsolve(D, [1, 1]);
    expect(x[0]).toBeCloseTo(1e-10, 20);
    expect(Math.abs(x[1] - 1e7)).toBeLessThanOrEqual(1e-9);
    const y = lusolve(D, [[1], [1]]) as number[][];
    expect(Math.abs(y[1][0] - 1e7)).toBeLessThanOrEqual(1e-9);
  });
  it('a 2 x 2 matrix with a pivot of 1e-14 solves, one with a pivot of 0 throws', () => {
    expect(() =>
      linsolve(
        [
          [1, 1],
          [1, 1 + 1e-14],
        ],
        [1, 2]
      )
    ).not.toThrow();
    expect(() =>
      linsolve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2]
      )
    ).toThrow(/singular/);
    expect(() =>
      lusolve(
        [
          [1, 2],
          [2, 4],
        ],
        [[1], [2]]
      )
    ).toThrow(/singular/);
  });
  it('the Hilbert matrix of order 8 (condition number 1.5e10) solves to 1e-5', () => {
    const n = 8;
    const H = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => 1 / (i + j + 1))
    );
    const b = H.map((row) => row.reduce((s, v) => s + v, 0));
    for (const x of linsolve(H, b)) expect(Math.abs(x - 1)).toBeLessThanOrEqual(1e-5);
  });
});

describe('#1287 a regular matrix with a small column still solves', () => {
  // Column 2 is 1e-17 times a column of order 1. Exact answers: x = [0, 1e17] and [0, 1e5].
  const graded: { A: number[][]; x: number[] }[] = [
    {
      A: [
        [1, 1e-17],
        [1, 2e-17],
      ],
      x: [0, 1e17],
    },
    {
      A: [
        [1e12, 1e-5],
        [1e12, 2e-5],
      ],
      x: [0, 1e5],
    },
  ];
  graded.forEach(({ A, x }, k) => {
    it(`column-graded system ${k + 1}`, () => {
      const b = [[1], [2]];
      const answers: number[][] = [
        linsolve(A, [1, 2]),
        (lusolve(A, b) as number[][]).map((row) => row[0]),
        (lusolve(matrix(A), b) as { toArray(): number[][] }).toArray().map((row) => row[0]),
        (lusolve(sparse(A), b) as { toArray(): number[][] }).toArray().map((row) => row[0]),
      ];
      for (const got of answers) {
        expect(Math.abs(got[0])).toBeLessThanOrEqual(1e-12 * Math.abs(x[1]) * 1e-17);
        expect(Math.abs(got[1] - x[1])).toBeLessThanOrEqual(1e-12 * Math.abs(x[1]));
      }
    });
  });

  it('an exactly singular integer matrix throws at every column scale', () => {
    // Row 3 = row 1 + row 2, exact in doubles. Column 3 is scaled by a power of 2.
    for (const s of [1, 2 ** -60, 2 ** 60]) {
      const A = [
        [3, -7, 2 * s],
        [5, 1, -4 * s],
        [8, -6, -2 * s],
      ];
      expect(() => linsolve(A, [1, 2, 3])).toThrow(/singular/);
      expect(() => lusolve(A, [[1], [2], [3]])).toThrow(/singular/);
      expect(() => lusolve(sparse(A), [[1], [2], [3]])).toThrow(/singular/);
    }
  });
});

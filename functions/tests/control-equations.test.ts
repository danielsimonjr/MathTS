import { describe, it, expect } from 'vitest';
import { care, dlyap, dare } from '../src/index.js';

describe('control-theory matrix equations', () => {
  it('care double-integrator -> [[sqrt3,1],[1,sqrt3]]', () => {
    const X = care(
      [
        [0, 1],
        [0, 0],
      ],
      [[0], [1]],
      [
        [1, 0],
        [0, 1],
      ],
      [[1]]
    );
    expect(X[0][0]).toBeCloseTo(Math.sqrt(3), 5);
    expect(X[0][1]).toBeCloseTo(1, 5);
    expect(X[1][0]).toBeCloseTo(1, 5);
    expect(X[1][1]).toBeCloseTo(Math.sqrt(3), 5);
  });

  it('dlyap diag(0.5) with Q=I -> (4/3) I', () => {
    const X = dlyap(
      [
        [0.5, 0],
        [0, 0.5],
      ],
      [
        [1, 0],
        [0, 1],
      ]
    );
    expect(X[0][0]).toBeCloseTo(4 / 3, 6);
    expect(X[1][1]).toBeCloseTo(4 / 3, 6);
    expect(X[0][1]).toBeCloseTo(0, 6);
  });

  it('dare (scipy-pinned) -> [[2.94712297,2.36920541],[2.36920541,4.61313426]]', () => {
    const X = dare(
      [
        [1, 1],
        [0, 1],
      ],
      [[0], [1]],
      [
        [1, 0],
        [0, 1],
      ],
      [[1]]
    );
    // Pinned against scipy.linalg.solve_discrete_are(A, B, Q, R) for this
    // exact (A, B, Q, R) — see functions/src/numeric/control-equations.ts docstring.
    expect(X[0][0]).toBeCloseTo(2.94712297, 6);
    expect(X[0][1]).toBeCloseTo(2.36920541, 6);
    expect(X[1][0]).toBeCloseTo(2.36920541, 6);
    expect(X[1][1]).toBeCloseTo(4.61313426, 6);

    // Self-verifying residual check on the actual DARE equation, independent
    // of the pinned values above:
    //   A^T X A - X - A^T X B (R + B^T X B)^-1 B^T X A + Q ~= 0
    const A = [
      [1, 1],
      [0, 1],
    ];
    const B = [[0], [1]];
    const Q = [
      [1, 0],
      [0, 1],
    ];
    const R = [[1]];
    const At = [
      [A[0][0], A[1][0]],
      [A[0][1], A[1][1]],
    ];
    const matmul = (M: number[][], N: number[][]): number[][] => {
      const rows = M.length;
      const inner = N.length;
      const cols = N[0].length;
      const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < inner; k++) {
          for (let j = 0; j < cols; j++) out[i][j] += M[i][k] * N[k][j];
        }
      }
      return out;
    };
    const AtXA = matmul(matmul(At, X), A);
    const BtXA = matmul([[B[0][0], B[1][0]]], matmul(X, A));
    const BtXB = matmul([[B[0][0], B[1][0]]], matmul(X, B));
    const RplusBtXB = R[0][0] + BtXB[0][0];
    const AtXB = matmul(matmul(At, X), B); // 2x1
    const middle = matmul(AtXB, [[1 / RplusBtXB]]); // 2x1
    const correction = matmul(middle, BtXA); // 2x2
    const residual: number[][] = [
      [0, 0],
      [0, 0],
    ];
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        residual[i][j] = AtXA[i][j] - X[i][j] - correction[i][j] + Q[i][j];
      }
    }
    for (const row of residual) {
      for (const v of row) {
        expect(Math.abs(v)).toBeLessThan(1e-6);
      }
    }

    expect(X[0][1]).toBeCloseTo(X[1][0], 6);
    expect(X.every((row) => row.every(Number.isFinite))).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { MathJSDenseMatrix } from '../src/factories/matrix-bridge.js';

/**
 * Accelerated matrix-bridge multiply/transpose (EXPANSION_PLAN W6).
 * The instance methods route through the native matrix BackendManager.
 */
describe('matrix-bridge accelerated operations', () => {
  it('multiplies two matrices via the native backend', () => {
    const a = new MathJSDenseMatrix([
      [1, 2],
      [3, 4],
    ]);
    const b = new MathJSDenseMatrix([
      [5, 6],
      [7, 8],
    ]);
    expect(a.multiply(b).valueOf()).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('transposes a matrix via the native backend', () => {
    const a = new MathJSDenseMatrix([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(a.transpose().valueOf()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('matches a naive product on a 64x64 matrix', () => {
    const n = 64;
    const grid = (f: (i: number, j: number) => number): number[][] =>
      Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => f(i, j)));
    const A = grid((i, j) => (i * 7 + j) % 11);
    const B = grid((i, j) => (i + j * 3) % 13);

    const got = new MathJSDenseMatrix(A).multiply(new MathJSDenseMatrix(B)).valueOf();

    const expected = grid(() => 0);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const aik = A[i][k];
        for (let j = 0; j < n; j++) expected[i][j] += aik * B[k][j];
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        expect(got[i][j]).toBeCloseTo(expected[i][j], 9);
      }
    }
  });
});

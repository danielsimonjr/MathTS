import { describe, expect, it } from 'vitest';
import { qr, matrix } from '../src/index.js';

interface MatLike {
  valueOf(): number[][];
}
const math = {
  qr: qr as unknown as (a: unknown) => { Q: number[][]; R: number[][] },
  matrix: matrix as unknown as (a: unknown) => MatLike,
};

function matmul(Q: number[][], R: number[][]): number[][] {
  return Q.map((_, i) => R[0].map((__, j) => Q[i].reduce((s, q, k) => s + q * R[k][j], 0)));
}

function relErr(A: number[][], Q: number[][], R: number[][]): number {
  const P = matmul(Q, R);
  let num = 0;
  let den = 0;
  for (let i = 0; i < A.length; i++)
    for (let j = 0; j < A[0].length; j++) {
      num = Math.max(num, Math.abs(P[i][j] - A[i][j]));
      den = Math.max(den, Math.abs(A[i][j]));
    }
  return num / den;
}

const base = (d: number) => [
  [1, 1, 1],
  [1, 1 + d, 1],
  [1, 1, 1 + d],
];
const scaled = (d: number, e: number) => base(d).map((r) => r.map((x) => x * 2 ** e));

describe('qr small-matrix absolute cutoff (#1168)', () => {
  for (const [d, e] of [
    [3e-10, -19],
    [3e-10, -10],
    [1e-12, -10],
    [3e-10, -5],
    [3e-10, -2],
    [3e-10, -1],
    [3e-10, -40],
    [3e-10, -1000],
  ] as const) {
    it(`reconstructs d=${d} at 2^${e}`, () => {
      const A = scaled(d, e);
      const { Q, R } = math.qr(A);
      expect(relErr(A, Q, R)).toBeLessThan(1e-14);
      // Q is scale free: same as the unscaled factor.
      const ref = math.qr(base(d));
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) expect(Math.abs(Q[i][j] - ref.Q[i][j])).toBeLessThan(1e-6);
    });
  }
  it('Matrix input gives the same result as array input', () => {
    const A = scaled(3e-10, -19);
    const r = math.qr(math.matrix(A)) as unknown as { Q: MatLike; R: MatLike };
    expect(relErr(A, r.Q.valueOf(), r.R.valueOf())).toBeLessThan(1e-14);
  });
});

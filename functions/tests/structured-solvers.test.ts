import { describe, it, expect } from 'vitest';
import { thomasSolve, toeplitzSolve, ldl, solveBanded } from '../src/index.js';

describe('structured & indefinite solvers', () => {
  it('thomasSolve tridiagonal -> [1,1,1]', () => {
    const x = thomasSolve([-1, -1], [2, 2, 2], [-1, -1], [1, 0, 1]);
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[1]).toBeCloseTo(1, 8);
    expect(x[2]).toBeCloseTo(1, 8);
  });
  it('toeplitzSolve matches scipy solve_toeplitz -> [0,1]', () => {
    const x = toeplitzSolve([2, 1], [2, 1], [1, 2]);
    expect(x[0]).toBeCloseTo(0, 6);
    expect(x[1]).toBeCloseTo(1, 6);
  });
  it('solveBanded matches dense solve on a tridiagonal (l=u=1)', () => {
    const A = [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ];
    const x = solveBanded(1, 1, A, [1, 0, 1]);
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[2]).toBeCloseTo(1, 8);
  });
  it('ldl reconstructs L D L^T = P A P^T (symmetric indefinite)', () => {
    const A = [
      [1, 2, 3],
      [2, 1, 4],
      [3, 4, 1],
    ]; // symmetric indefinite
    const { L, D, perm } = ldl(A);
    const n = 3;
    const matmul = (X: number[][], Y: number[][]) =>
      X.map((row) => Y[0].map((_, j) => row.reduce((s, xik, k) => s + xik * Y[k][j], 0)));
    const Lt = L[0].map((_, j) => L.map((row) => row[j]));
    const rec = matmul(matmul(L, D), Lt);
    const PAPt = perm.map((pi) => perm.map((pj) => A[pi][pj]));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) expect(rec[i][j]).toBeCloseTo(PAPt[i][j], 6);
  });
});

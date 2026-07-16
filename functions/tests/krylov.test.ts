import { describe, it, expect } from 'vitest';
import { cg, gmres, bicgstab, minres } from '../src/index.js';

const A = [
  [4, 1],
  [1, 3],
];
const b = [1, 2];
const expected = [1 / 11, 7 / 11];

describe('Krylov solvers', () => {
  it('cg solves SPD [[4,1],[1,3]]x=[1,2] -> [1/11, 7/11]', () => {
    const r = cg(A, b);
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
    expect(r.x[1]).toBeCloseTo(expected[1], 8);
    expect(r.converged).toBe(true);
  });

  it('gmres and bicgstab solve a nonsymmetric system -> [1,1]', () => {
    const N = [
      [3, 1],
      [0, 2],
    ];
    const c = [4, 2];
    for (const solver of [gmres, bicgstab]) {
      const r = solver(N, c);
      expect(r.x[0]).toBeCloseTo(1, 6);
      expect(r.x[1]).toBeCloseTo(1, 6);
    }
  });

  it('minres solves a symmetric indefinite system [[0,1],[1,0]]x=[1,2] -> [2,1]', () => {
    const r = minres(
      [
        [0, 1],
        [1, 0],
      ],
      [1, 2]
    );
    expect(r.x[0]).toBeCloseTo(2, 6);
    expect(r.x[1]).toBeCloseTo(1, 6);
  });

  it('cg accepts a matvec function', () => {
    const matvec = (x: number[]) => [4 * x[0] + x[1], x[0] + 3 * x[1]];
    const r = cg(matvec, b);
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
  });

  it('cg with Jacobi preconditioner converges', () => {
    const r = cg(A, b, { preconditioner: 'jacobi' });
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
  });

  it('jacobi preconditioner throws a clear error for a matvec-only operator', () => {
    const matvec = (x: number[]) => [4 * x[0] + x[1], x[0] + 3 * x[1]];
    expect(() => cg(matvec, b, { preconditioner: 'jacobi' })).toThrow(/jacobi/i);
  });

  it('custom preconditioner function is honored', () => {
    // Identity preconditioner via a custom callback should match unpreconditioned CG.
    const r = cg(A, b, { preconditioner: (rv) => rv.slice() });
    expect(r.x[0]).toBeCloseTo(expected[0], 8);
    expect(r.x[1]).toBeCloseTo(expected[1], 8);
  });

  it('cg solves a larger (5x5) SPD tridiagonal system — verified by direct residual', () => {
    // Symmetric positive-definite tridiagonal(-1, 4, -1) — diagonally dominant, SPD.
    const n = 5;
    const M: number[][] = Array.from({ length: n }, (_row, i) =>
      Array.from({ length: n }, (_col, j) => (i === j ? 4 : Math.abs(i - j) === 1 ? -1 : 0))
    );
    const rhs = [1, 2, 3, 4, 5];
    const r = cg(M, rhs);
    expect(r.converged).toBe(true);
    expect(r.residual).toBeLessThan(1e-8);
    // Direct oracle check: A*x should reproduce b (the defining property of a linear solve).
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) sum += M[i][j] * r.x[j];
      expect(sum).toBeCloseTo(rhs[i], 6);
    }
  });

  it('gmres and bicgstab solve a larger (5x5) nonsymmetric system — verified by direct residual', () => {
    const n = 5;
    const M: number[][] = [
      [10, 1, 0, 0, 2],
      [0, 8, 1, 0, 0],
      [1, 0, 9, 2, 0],
      [0, 1, 0, 7, 1],
      [2, 0, 0, 1, 11],
    ];
    const rhs = [1, 2, 3, 4, 5];
    for (const solver of [gmres, bicgstab]) {
      const r = solver(M, rhs);
      expect(r.converged).toBe(true);
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) sum += M[i][j] * r.x[j];
        expect(sum).toBeCloseTo(rhs[i], 5);
      }
    }
  });

  it('minres solves a larger (4x4) symmetric indefinite system — verified by direct residual', () => {
    const M = [
      [2, 1, 0, 0],
      [1, -3, 1, 0],
      [0, 1, 4, 1],
      [0, 0, 1, -2],
    ];
    const rhs = [1, -1, 2, 0];
    const r = minres(M, rhs);
    expect(r.converged).toBe(true);
    for (let i = 0; i < 4; i++) {
      let sum = 0;
      for (let j = 0; j < 4; j++) sum += M[i][j] * r.x[j];
      expect(sum).toBeCloseTo(rhs[i], 5);
    }
  });
});

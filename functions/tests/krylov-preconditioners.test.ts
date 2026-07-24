import { describe, it, expect } from 'vitest';
import { cg, bicgstab, incompleteLU, incompleteCholesky } from '../src/index.js';

/** 2D Poisson (5-point stencil) on a g×g grid: SPD, sparse, ill-conditioned. */
function poisson2D(g: number): number[][] {
  const n = g * g;
  const A: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const idx = (r: number, c: number) => r * g + c;
  for (let r = 0; r < g; r++) {
    for (let c = 0; c < g; c++) {
      const i = idx(r, c);
      A[i][i] = 4;
      if (r > 0) A[i][idx(r - 1, c)] = -1;
      if (r < g - 1) A[i][idx(r + 1, c)] = -1;
      if (c > 0) A[i][idx(r, c - 1)] = -1;
      if (c < g - 1) A[i][idx(r, c + 1)] = -1;
    }
  }
  return A;
}

const matmul = (A: number[][], x: number[]) =>
  A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));

const relResidual = (A: number[][], x: number[], b: number[]) => {
  const r = matmul(A, x).map((v, i) => v - b[i]);
  const rn = Math.sqrt(r.reduce((s, v) => s + v * v, 0));
  const bn = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return rn / bn;
};

describe('ILU(0) / IC(0) factorizations (factor correctness on the pattern)', () => {
  it('incompleteLU reproduces A on its sparsity pattern (ILU(0) property)', () => {
    const A = poisson2D(6); // has fill-in outside the pattern under exact LU
    const { L, U } = incompleteLU(A);
    const n = A.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (A[i][j] === 0 && i !== j) continue; // off-pattern entry: no constraint
        let lu = 0;
        for (let k = 0; k < n; k++) lu += L[i][k] * U[k][j];
        expect(lu).toBeCloseTo(A[i][j], 9);
      }
    }
  });

  it('incompleteCholesky reproduces A on its sparsity pattern (IC(0) property)', () => {
    const A = poisson2D(6);
    const { L } = incompleteCholesky(A);
    const n = A.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (A[i][j] === 0 && i !== j) continue;
        let llt = 0;
        for (let k = 0; k < n; k++) llt += L[i][k] * L[j][k];
        expect(llt).toBeCloseTo(A[i][j], 9);
      }
    }
  });

  it('ILU(0) = exact LU for a tridiagonal matrix (no fill) — L·U === A everywhere', () => {
    const A = [
      [4, 1, 0, 0],
      [1, 4, 1, 0],
      [0, 1, 4, 1],
      [0, 0, 1, 4],
    ];
    const { L, U } = incompleteLU(A);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let lu = 0;
        for (let k = 0; k < 4; k++) lu += L[i][k] * U[k][j];
        expect(lu).toBeCloseTo(A[i][j], 12);
      }
    }
  });

  it('incompleteCholesky throws on a non-SPD (indefinite) matrix', () => {
    expect(() =>
      incompleteCholesky([
        [1, 2],
        [2, 1],
      ])
    ).toThrow(/positive-definite/);
  });
});

describe('Preconditioned Krylov convergence (fewer iterations)', () => {
  const A = poisson2D(8); // n=64, cond ≈ 32 — Jacobi is a no-op here (constant diagonal)
  const n = A.length;
  const b = Array.from({ length: n }, (_v, i) => i + 1);

  it('IC(0)-preconditioned CG converges in strictly fewer iterations than unpreconditioned/Jacobi', () => {
    const plain = cg(A, b, { tol: 1e-8 });
    const jacobi = cg(A, b, { tol: 1e-8, preconditioner: 'jacobi' });
    const ic = cg(A, b, { tol: 1e-8, preconditioner: 'ic' });

    // All converge to the same solution (residual pinned).
    for (const r of [plain, jacobi, ic]) {
      expect(r.converged).toBe(true);
      expect(relResidual(A, r.x, b)).toBeLessThan(1e-7);
    }
    // Jacobi ≈ no-op on a constant-diagonal Poisson matrix; IC(0) beats both.
    expect(ic.iterations).toBeLessThan(plain.iterations);
    expect(ic.iterations).toBeLessThan(jacobi.iterations);
  });

  it('ILU(0)-preconditioned BiCGSTAB converges in fewer iterations than unpreconditioned', () => {
    const plain = bicgstab(A, b, { tol: 1e-8 });
    const ilu = bicgstab(A, b, { tol: 1e-8, preconditioner: 'ilu' });
    for (const r of [plain, ilu]) {
      expect(r.converged).toBe(true);
      expect(relResidual(A, r.x, b)).toBeLessThan(1e-7);
    }
    expect(ilu.iterations).toBeLessThan(plain.iterations);
  });

  it("'ilu'/'ic' require a dense matrix (throw for a matvec operator)", () => {
    const matvec = (x: number[]) => matmul(A, x);
    expect(() => cg(matvec, b, { preconditioner: 'ilu' })).toThrow(/ilu/i);
    expect(() => cg(matvec, b, { preconditioner: 'ic' })).toThrow(/ic/i);
  });

  it('ILU(0) preconditioned solution matches the unpreconditioned solution', () => {
    const plain = bicgstab(A, b, { tol: 1e-10 });
    const ilu = bicgstab(A, b, { tol: 1e-10, preconditioner: 'ilu' });
    for (let i = 0; i < n; i++) expect(ilu.x[i]).toBeCloseTo(plain.x[i], 6);
  });
});

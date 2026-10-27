/**
 * Sprint 2R PR 1 — behavioral parity pins (captured on main b24e3ec2 before routing
 * solvers through `numericJacobian` / core `norm2` / `pairwiseSum`). Independent
 * oracles are cited in each test; literal values guard against silent drift on the
 * fixtures used elsewhere (solveode-jspath, dae, interpn-bvp, fsolve, eigsh, krylov, ols).
 */
import { describe, it, expect } from 'vitest';
import {
  solveBVP,
  solveODE,
  solveDAE,
  fsolve,
  eigsh,
  cg,
  gmres,
  bicgstab,
  minres,
  ols,
} from '../src/index.js';

describe('S2R parity — solveBVP (shooting + FD Jacobian)', () => {
  it("y''=-y, y(0)=0, y(pi/2)=1 — endpoint and a mid-mesh sample", () => {
    const sol = solveBVP(
      (_t, y) => [y[1], -y[0]],
      (y0, yf) => [y0[0] - 0, yf[0] - 1],
      [0, Math.PI / 2]
    );
    const last = sol.y[sol.y.length - 1];
    // Oracle: y = sin(x), y'(pi/2) = cos(pi/2) = 0 (same tolerances as interpn-bvp.test.ts)
    expect(last[0]).toBeCloseTo(1, 3);
    expect(last[0]).toBeCloseTo(1.0000000001925815, 8);
    expect(last[1]).toBeCloseTo(0, 6);
    const midIdx = Math.floor(sol.t.length / 2);
    expect(sol.y[midIdx][0]).toBeCloseTo(Math.sin(sol.t[midIdx]), 6);
  });
});

describe('S2R parity — solveODE stiff (Rosenbrock, FD Jacobian of forcing)', () => {
  it('diag(-1,-1000) linear stiff system at t=1', () => {
    const sol = solveODE((_t: number, y: number[]) => [-y[0], -1000 * y[1]], [0, 1], [1, 1], {
      method: 'Rosenbrock',
      tol: 1e-8,
    }) as { y: number[][] };
    const y = sol.y[sol.y.length - 1];
    expect(y[0]).toBeCloseTo(Math.exp(-1), 4);
    expect(y[0]).toBeCloseTo(0.36787885730720166, 8);
    expect(Math.abs(y[1])).toBeLessThan(1e-100);
  });
});

describe('S2R parity — solveDAE (FD ∂g/∂z and Newton matrix)', () => {
  const f = (_t: number, y: number[], z: number[]) => [z[0] - 2 * y[0]];
  const g = (t: number, y: number[], z: number[]) => [z[0] - (t + y[0])];
  const yExact = (t: number) => t - 1 + 2 * Math.exp(-t);
  const zExact = (t: number) => t + yExact(t);

  it('manufactured index-1 DAE at t=3', () => {
    const sol = solveDAE(f, g, [0, 3], 1, 1, { tol: 1e-9 });
    const yN = sol.y as number[];
    const zN = sol.z as number[];
    expect(yN[yN.length - 1]).toBeCloseTo(yExact(3), 6);
    expect(zN[zN.length - 1]).toBeCloseTo(zExact(3), 6);
    expect(yN[yN.length - 1]).toBeCloseTo(2.0995739020907163, 8);
    expect(zN[zN.length - 1]).toBeCloseTo(5.099573902090716, 8);
  });
});

describe('S2R parity — fsolve (line search uses local norm2)', () => {
  it('[x^2-y, x+y-2] from [0.5,0.5]', () => {
    const x = fsolve((v) => [v[0] ** 2 - v[1], v[0] + v[1] - 2], [0.5, 0.5]);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(1, 10);
    expect(x[0]).toBeCloseTo(1.000000000019661, 8);
    expect(x[1]).toBeCloseTo(0.9999999999803392, 8);
  });
});

describe('S2R parity — eigsh / Krylov (local norm2 in iteration)', () => {
  const T = [
    [2, 1, 0],
    [1, 2, 1],
    [0, 1, 2],
  ];

  it('eigsh LM eigenvalue', () => {
    const ev = eigsh(T, 1, { which: 'LM' }).eigenvalues[0];
    expect(ev).toBeCloseTo(2 + Math.SQRT2, 10);
    expect(ev).toBeCloseTo(3.4142135623730967, 10);
  });

  const expected = [1 / 11, 7 / 11];

  it('cg solution vector', () => {
    const r = cg(
      [
        [4, 1],
        [1, 3],
      ],
      [1, 2]
    );
    expect(r.x[0]).toBeCloseTo(expected[0], 10);
    expect(r.x[1]).toBeCloseTo(expected[1], 10);
    expect(r.iterations).toBe(2);
  });

  it('gmres and bicgstab on upper-triangular system', () => {
    const N = [
      [3, 1],
      [0, 2],
    ];
    const c = [4, 2];
    for (const solver of [gmres, bicgstab]) {
      const r = solver(N, c);
      expect(r.x[0]).toBeCloseTo(1, 8);
      expect(r.x[1]).toBeCloseTo(1, 8);
    }
  });

  it('minres on [[0,1],[1,0]]', () => {
    const r = minres(
      [
        [0, 1],
        [1, 0],
      ],
      [1, 2]
    );
    expect(r.x[0]).toBeCloseTo(2, 8);
    expect(r.x[1]).toBeCloseTo(1, 8);
  });
});

describe('S2R parity — ols (mean / RSS / TSS reductions)', () => {
  it('exact fit y=1+2x1+3x2', () => {
    const X = [
      [1, 1],
      [2, 0],
      [3, 1],
      [4, 0],
    ];
    const y = [6, 5, 10, 9];
    const r = ols(X, y);
    expect(r.coefficients[0]).toBeCloseTo(1, 10);
    expect(r.coefficients[1]).toBeCloseTo(2, 10);
    expect(r.coefficients[2]).toBeCloseTo(3, 10);
    expect(r.r2).toBeCloseTo(1, 12);
    const rss = r.residuals.reduce((s, e) => s + e * e, 0);
    expect(rss).toBeLessThan(1e-20);
  });

  it('noisy line y ~ 2x', () => {
    const r = ols([[1], [2], [3], [4], [5]], [2.1, 3.9, 6.2, 7.8, 10.1]);
    expect(r.coefficients[1]).toBeCloseTo(1.99, 3);
    expect(r.r2).toBeCloseTo(0.9973053289009771, 8);
  });
});

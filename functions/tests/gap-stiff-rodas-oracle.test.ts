/**
 * RODAS (Hairer & Wanner, 4th-order 6-stage L-stable Rosenbrock) stiff ODE solver, plus the
 * analytic-Jacobian (`jac`) option for the stiff methods — pinned to closed-form and scipy oracles.
 *
 * Oracles regenerated with scipy 1.17.1 (Radau, rtol=1e-10 atol=1e-12) and the exact solution of
 * the linear stiff decay y' = -1000 y. RODAS should reach these to 4th-order accuracy in far fewer
 * steps than the 2nd-order Rosenbrock (ode23s) at the same tolerance.
 */
import { describe, it, expect } from 'vitest';
import { solveODE } from '../src/index.js';

const lastState = (sol: { y: number[][] }): number[] => sol.y[sol.y.length - 1];
const lastScalar = (sol: { y: number[] }): number => sol.y[sol.y.length - 1];

describe('solveODE — RODAS 4th-order stiff method', () => {
  it("linear stiff y' = -1000 y, y(0)=1  →  y(0.01) = e^-10 (relerr < 1e-6)", () => {
    const exact = Math.exp(-10); // 4.5399929762484854e-05
    const sol = solveODE((_t, y) => -1000 * (y as number), [0, 0.01], 1, {
      method: 'RODAS',
      tol: 1e-8,
    }) as { t: number[]; y: number[] };
    const y = lastScalar(sol);
    const relerr = Math.abs(y - exact) / exact;
    expect(relerr).toBeLessThan(1e-6);
  });

  it('Robertson stiff kinetics vs scipy Radau (RODAS + analytic Jacobian)', () => {
    // y1' = -0.04 y1 + 1e4 y2 y3
    // y2' =  0.04 y1 - 1e4 y2 y3 - 3e7 y2^2
    // y3' =  3e7 y2^2
    const f = (_t: number, y: number[]): number[] => {
      const [y1, y2, y3] = y;
      return [-0.04 * y1 + 1e4 * y2 * y3, 0.04 * y1 - 1e4 * y2 * y3 - 3e7 * y2 * y2, 3e7 * y2 * y2];
    };
    const jac = (_t: number, y: number[]): number[][] => {
      const [, y2, y3] = y;
      return [
        [-0.04, 1e4 * y3, 1e4 * y2],
        [0.04, -1e4 * y3 - 6e7 * y2, -1e4 * y2],
        [0, 6e7 * y2, 0],
      ];
    };
    // scipy solve_ivp(method='Radau', rtol=1e-10, atol=1e-12): y(40) =
    const scipy = [7.15827069e-1, 9.18553476e-6, 2.84163746e-1];
    const sol = solveODE(f, [0, 40], [1, 0, 0], {
      method: 'RODAS',
      tol: 1e-8,
      jac,
    }) as { t: number[]; y: number[][] };
    const y = lastState(sol);
    expect(y[0]).toBeCloseTo(scipy[0], 4); // relative ~1e-4 on y1
    expect(Math.abs(y[1] - scipy[1])).toBeLessThan(1e-4); // absolute on tiny y2
    expect(y[2]).toBeCloseTo(scipy[2], 4); // relative ~1e-4 on y3
  });

  it('RODAS reaches tight accuracy in far fewer steps than Rosenbrock (ode23s)', () => {
    // Same linear stiff problem, same tolerance: the 4th-order method needs many fewer accepted
    // steps than the 2nd-order one — a direct order-improvement signal.
    const f = (_t: number, y: number[]): number[] => [-1000 * y[0]];
    const exact = Math.exp(-10);
    const rodas = solveODE(f, [0, 0.01], [1], { method: 'RODAS', tol: 1e-8 }) as {
      t: number[];
      y: number[][];
    };
    const rosen = solveODE(f, [0, 0.01], [1], { method: 'Rosenbrock', tol: 1e-8 }) as {
      t: number[];
      y: number[][];
    };
    const rodasErr = Math.abs(rodas.y[rodas.y.length - 1][0] - exact) / exact;
    const rosenErr = Math.abs(rosen.y[rosen.y.length - 1][0] - exact) / exact;
    // RODAS hits the target with a fraction of the steps ode23s needs.
    expect(rodas.t.length).toBeLessThan(rosen.t.length);
    expect(rodasErr).toBeLessThan(1e-6);
    expect(rosenErr).toBeLessThan(1e-2); // ode23s is far coarser at the same tol
  });
});

describe('solveODE — analytic Jacobian (jac) option', () => {
  it('Rosenbrock with analytic jac agrees with the finite-difference path (~1e-6)', () => {
    // Stiff linear system y' = A y with known analytic Jacobian A.
    const A = [
      [-100, 1],
      [0, -1],
    ];
    const f = (_t: number, y: number[]): number[] => [
      A[0][0] * y[0] + A[0][1] * y[1],
      A[1][0] * y[0] + A[1][1] * y[1],
    ];
    const jac = (): number[][] => A;
    const withJac = solveODE(f, [0, 1], [1, 1], { method: 'Rosenbrock', tol: 1e-8, jac }) as {
      y: number[][];
    };
    const withFD = solveODE(f, [0, 1], [1, 1], { method: 'Rosenbrock', tol: 1e-8 }) as {
      y: number[][];
    };
    const a = withJac.y[withJac.y.length - 1];
    const b = withFD.y[withFD.y.length - 1];
    expect(Math.abs(a[0] - b[0])).toBeLessThan(1e-6);
    expect(Math.abs(a[1] - b[1])).toBeLessThan(1e-6);
  });

  it('RODAS with analytic jac agrees with the FD path on a nonlinear stiff system (~1e-6)', () => {
    const f = (_t: number, y: number[]): number[] => [-1000 * (y[0] - Math.cos(y[1])), -y[1]];
    const jac = (_t: number, y: number[]): number[][] => [
      [-1000, -1000 * Math.sin(y[1])],
      [0, -1],
    ];
    const withJac = solveODE(f, [0, 0.5], [2, 1], { method: 'RODAS', tol: 1e-8, jac }) as {
      y: number[][];
    };
    const withFD = solveODE(f, [0, 0.5], [2, 1], { method: 'RODAS', tol: 1e-8 }) as {
      y: number[][];
    };
    const a = withJac.y[withJac.y.length - 1];
    const b = withFD.y[withFD.y.length - 1];
    expect(Math.abs(a[0] - b[0])).toBeLessThan(1e-6);
    expect(Math.abs(a[1] - b[1])).toBeLessThan(1e-6);
  });

  it('throws clearly when jac returns the wrong shape', () => {
    const f = (_t: number, y: number[]): number[] => [-y[0], -y[1]];
    const badJac = (): number[][] => [[-1, 0]]; // 1x2, not 2x2
    expect(() => solveODE(f, [0, 1], [1, 1], { method: 'RODAS', tol: 1e-6, jac: badJac })).toThrow(
      /jac/i
    );
  });
});

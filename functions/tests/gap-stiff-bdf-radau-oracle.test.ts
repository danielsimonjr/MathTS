/**
 * BDF (variable-order variable-step backward differentiation, orders 1–5) and Radau IIA (3-stage,
 * order-5, L-stable implicit Runge-Kutta) stiff ODE methods for `solveODE` — pinned to closed-form
 * and scipy `solve_ivp` oracles.
 *
 * Oracles regenerated with scipy 1.17.1 (2026-07-19):
 *   - Robertson  t=40, method=BDF/Radau, jac supplied, rtol=1e-10 atol=1e-12
 *   - Van der Pol mu=1000, t=3000, rtol=1e-8 atol=1e-10
 *   - Linear stiff decay y' = -1000 y  → exact e^-10; linear system y'=diag(-1,-1000)y → exact e^-1.
 * Both are adaptive to a tolerance, so the SOLUTION at the requested final t is pinned (not the
 * internal step sequence).
 */
import { describe, it, expect } from 'vitest';
import { solveODE } from '../src/index.js';

const lastState = (sol: { y: number[][] }): number[] => sol.y[sol.y.length - 1];
const lastScalar = (sol: { y: number[] }): number => sol.y[sol.y.length - 1];

describe.each(['BDF', 'Radau'] as const)('solveODE — %s stiff method', (method) => {
  it("linear stiff scalar y' = -1000 y, y(0)=1  →  y(0.01) = e^-10 (relerr < 1e-6)", () => {
    const exact = Math.exp(-10); // 4.5399929762484854e-05
    // BDF (order 1–5 NDF) needs tol≈1e-9 to reach 1e-6 global on this short-horizon decay; Radau
    // (order 5) reaches ~1e-11 here. tol=1e-9 makes both pass the same closed-form pin honestly.
    const sol = solveODE((_t, y) => -1000 * (y as number), [0, 0.01], 1, {
      method,
      tol: 1e-9,
    }) as { t: number[]; y: number[] };
    const y = lastScalar(sol);
    expect(Math.abs(y - exact) / exact).toBeLessThan(1e-6);
  });

  it("linear stiff system y'=diag(-1,-1000)y, y(1) = [e^-1, ~0] (exact closed form)", () => {
    const f = (_t: number, y: number[]): number[] => [-y[0], -1000 * y[1]];
    const jac = (): number[][] => [
      [-1, 0],
      [0, -1000],
    ];
    const sol = solveODE(f, [0, 1], [1, 1], { method, tol: 1e-9, jac }) as {
      t: number[];
      y: number[][];
    };
    const y = lastState(sol);
    expect(Math.abs(y[0] - Math.exp(-1)) / Math.exp(-1)).toBeLessThan(1e-6);
    expect(Math.abs(y[1])).toBeLessThan(1e-6); // decayed to ~0 (e^-1000)
  });

  it('Robertson stiff kinetics t=40 vs scipy (analytic Jacobian)', () => {
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
    // scipy solve_ivp(method=BDF/Radau, rtol=1e-10, atol=1e-12) — agree to plotted precision.
    const scipy = [7.15827069e-1, 9.18553476e-6, 2.84163746e-1];
    const sol = solveODE(f, [0, 40], [1, 0, 0], { method, tol: 1e-8, jac }) as {
      t: number[];
      y: number[][];
    };
    const y = lastState(sol);
    expect(y[0]).toBeCloseTo(scipy[0], 4); // relative ~1e-4 on y1
    expect(Math.abs(y[1] - scipy[1])).toBeLessThan(1e-4); // absolute on tiny y2
    expect(y[2]).toBeCloseTo(scipy[2], 4); // relative ~1e-4 on y3
    // mass conservation invariant y1+y2+y3 = 1 (implementation-independent oracle)
    expect(y[0] + y[1] + y[2]).toBeCloseTo(1, 6);
  });
});

describe('solveODE — Van der Pol mu=1000 (very stiff) vs scipy', () => {
  const mu = 1000;
  const f = (_t: number, y: number[]): number[] => [y[1], mu * (1 - y[0] * y[0]) * y[1] - y[0]];
  const jac = (_t: number, y: number[]): number[][] => [
    [0, 1],
    [-2 * mu * y[0] * y[1] - 1, mu * (1 - y[0] * y[0])],
  ];

  it('BDF matches scipy BDF at t=3000 (~1e-3)', () => {
    const scipy = [-1.51060561, 1.17838264e-3];
    const sol = solveODE(f, [0, 3000], [2, 0], { method: 'BDF', tol: 1e-8, jac }) as {
      y: number[][];
    };
    const y = lastState(sol);
    expect(Math.abs(y[0] - scipy[0])).toBeLessThan(1e-3);
  });

  it('Radau matches scipy Radau at t=3000 (~1e-3)', () => {
    const scipy = [-1.51060694, 1.17838e-3];
    const sol = solveODE(f, [0, 3000], [2, 0], { method: 'Radau', tol: 1e-8, jac }) as {
      y: number[][];
    };
    const y = lastState(sol);
    expect(Math.abs(y[0] - scipy[0])).toBeLessThan(1e-3);
  });
});

describe('solveODE — BDF/Radau scalar convenience + variable order', () => {
  it("BDF solves the non-stiff scalar y'=y to y(1)=e (unwrapped scalar result)", () => {
    const sol = solveODE((_t, y) => y as number, [0, 1], 1, { method: 'BDF', tol: 1e-8 }) as {
      y: number[];
    };
    expect(lastScalar(sol)).toBeCloseTo(Math.E, 5);
  });

  it("Radau solves the non-stiff scalar y'=y to y(1)=e", () => {
    const sol = solveODE((_t, y) => y as number, [0, 1], 1, { method: 'Radau', tol: 1e-8 }) as {
      y: number[];
    };
    expect(lastScalar(sol)).toBeCloseTo(Math.E, 5);
  });

  it('the analytic jac shape guard fires for BDF/Radau', () => {
    const f = (_t: number, y: number[]): number[] => [-y[0], -y[1]];
    const badJac = (): number[][] => [[-1, 0]]; // 1x2, not 2x2
    expect(() => solveODE(f, [0, 1], [1, 1], { method: 'BDF', tol: 1e-6, jac: badJac })).toThrow(
      /jac/i
    );
    expect(() => solveODE(f, [0, 1], [1, 1], { method: 'Radau', tol: 1e-6, jac: badJac })).toThrow(
      /jac/i
    );
  });
});

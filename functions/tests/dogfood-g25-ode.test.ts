/**
 * Dogfood G25 — solveODE step limits, stiffness hints, stiffODESolver args (#824 #698 #691).
 */
import { describe, it, expect } from 'vitest';
import { solveODE, stiffODESolver } from '../src/index.js';

const robertson = (_t: number, y: number[]) => {
  const [y1, y2, y3] = y;
  return [-0.04 * y1 + 1e4 * y2 * y3, 0.04 * y1 - 1e4 * y2 * y3 - 3e7 * y2 * y2, 3e7 * y2 * y2];
};

const HAIRER_T40 = [0.7158270684, 9.185534764e-6, 0.284163746];

describe('G25 dogfood — ODE API (#824 #698 #691)', () => {
  it('#824 SHO [0,100] tol 1e-8 completes without raising maxIter', () => {
    const sol = solveODE(
      (_t: unknown, y: unknown) => {
        const v = y as number[];
        return [v[1], -4 * v[0]];
      },
      [0, 100],
      [1, 0],
      {
        method: 'RK45',
        tol: 1e-8,
      }
    ) as { t: number[] };
    expect(sol.t.at(-1)).toBeCloseTo(100, 8);
  });

  it('#824 SHO [0,100] tol 1e-10 completes (accepted-step maxIter)', () => {
    const sol = solveODE(
      (_t: unknown, y: unknown) => {
        const v = y as number[];
        return [v[1], -4 * v[0]];
      },
      [0, 100],
      [1, 0],
      {
        method: 'RK45',
        tol: 1e-10,
      }
    ) as { t: number[] };
    expect(sol.t.at(-1)).toBeCloseTo(100, 8);
  });

  it('#698 Robertson RK45 error names method and suggests stiff solvers', () => {
    const opts = { method: 'RK45' as const, tol: 1e-6, maxIter: 5000 };
    let msg = '';
    try {
      solveODE(robertson, [0, 40], [1, 0, 0], opts);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/solveODE RK45/);
    expect(msg).toMatch(/maxIter/);
    expect(msg).toMatch(/stiff|BDF|Radau|Rosenbrock/);
  });

  it('#698 Radau Robertson matches Hairer reference', () => {
    const sol = solveODE(robertson, [0, 40], [1, 0, 0], { method: 'Radau', tol: 1e-6 }) as {
      y: number[][];
    };
    const yN = sol.y[sol.y.length - 1];
    for (let i = 0; i < 3; i++) {
      expect(yN[i]).toBeCloseTo(HAIRER_T40[i], 5);
    }
  });

  it('#691 stiffODESolver accepts solveODE argument order (f, tspan, y0)', () => {
    const sol = stiffODESolver(robertson, [0, 40], [1, 0, 0]);
    const yN = sol.y[sol.y.length - 1];
    for (let i = 0; i < 3; i++) {
      expect(yN[i]).toBeCloseTo(HAIRER_T40[i], 5);
    }
  });

  it('#691 legacy (f, y0, tspan) still works with legacyArgumentOrder', () => {
    const sol = stiffODESolver(robertson, [1, 0, 0], [0, 40], { legacyArgumentOrder: true });
    const yN = sol.y[sol.y.length - 1];
    for (let i = 0; i < 3; i++) {
      expect(yN[i]).toBeCloseTo(HAIRER_T40[i], 5);
    }
  });

  it('#691 auto-detect keeps historical (y0, tspan) call shape', () => {
    const sol = stiffODESolver(robertson, [1, 0, 0], [0, 40]);
    expect(sol.t.length).toBeGreaterThan(10);
  });
});

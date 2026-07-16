import { describe, it, expect } from 'vitest';
import { stiffODESolver } from '../src/index.js';

const last = (sol: { t: number[]; y: number[][] }) => sol.y[sol.y.length - 1];

describe('stiffODESolver (routes to Rosenbrock)', () => {
  it("scalar stiff decay y'=-15y, y0=[1] over [0,1] → y(1)=e^-15", () => {
    const y = last(stiffODESolver((_t, y) => y.map((v) => -15 * v), [1], [0, 1]));
    expect(y[0]).toBeCloseTo(Math.exp(-15), 8);
  });
  it('stiff system diag(-1,-1000) → [e^-1, ~0], all finite (no null/NaN)', () => {
    const y = last(stiffODESolver((_t, y) => [-y[0], -1000 * y[1]], [1, 1], [0, 1]));
    expect(y[0]).toBeCloseTo(Math.exp(-1), 4);
    expect(Math.abs(y[1])).toBeLessThan(1e-6);
    expect(Number.isFinite(y[0]) && Number.isFinite(y[1])).toBe(true);
  });
});

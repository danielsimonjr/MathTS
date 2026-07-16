import { describe, it, expect } from 'vitest';
import { bfgs } from '../src/index.js';

describe('bfgs (quasi-Newton)', () => {
  it('Rosenbrock from [-1.2,1] -> [1,1], f~0', () => {
    const r = bfgs((v) => (1 - v[0]) ** 2 + 100 * (v[1] - v[0] ** 2) ** 2, [-1.2, 1]);
    expect(r.x[0]).toBeCloseTo(1, 4);
    expect(r.x[1]).toBeCloseTo(1, 4);
    expect(r.fval).toBeLessThan(1e-8);
    expect(r.converged).toBe(true);
  });
  it('quadratic (x-3)^2+(y+1)^2 -> [3,-1]', () => {
    const r = bfgs((v) => (v[0] - 3) ** 2 + (v[1] + 1) ** 2, [0, 0]);
    expect(r.x[0]).toBeCloseTo(3, 6);
    expect(r.x[1]).toBeCloseTo(-1, 6);
  });
  it('bounded: min (x-5)^2 on [0,2] -> x=2 (clipped)', () => {
    const r = bfgs((v) => (v[0] - 5) ** 2, [0], { bounds: [[0, 2]] });
    expect(r.x[0]).toBeCloseTo(2, 4);
  });
  it('analytic gradient path (quadratic)', () => {
    const r = bfgs((v) => v[0] ** 2 + v[1] ** 2, [1, 1], { grad: (v) => [2 * v[0], 2 * v[1]] });
    expect(r.x[0]).toBeCloseTo(0, 6);
    expect(r.x[1]).toBeCloseTo(0, 6);
  });
});

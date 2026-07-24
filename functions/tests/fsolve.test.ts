import { describe, it, expect } from 'vitest';
import { fsolve, root } from '../src/index.js';

describe('fsolve (nonlinear systems, damped Newton)', () => {
  it('[x^2 - y, x + y - 2] from [0.5,0.5] -> [1,1]', () => {
    const x = fsolve((v) => [v[0] ** 2 - v[1], v[0] + v[1] - 2], [0.5, 0.5]);
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[1]).toBeCloseTo(1, 8);
  });
  it('[x^2+y^2-25, x-y-1] from [5,1] -> [4,3]', () => {
    const x = fsolve((v) => [v[0] ** 2 + v[1] ** 2 - 25, v[0] - v[1] - 1], [5, 1]);
    expect(x[0]).toBeCloseTo(4, 6);
    expect(x[1]).toBeCloseTo(3, 6);
  });
  it('residual ~0 at the solution (transcendental)', () => {
    const F = (v: number[]) => [Math.exp(v[0]) + v[1] - 3, v[0] + v[1] * v[1] - 5];
    const x = fsolve(F, [1, 1]);
    const r = F(x);
    expect(Math.hypot(r[0], r[1])).toBeLessThan(1e-8);
  });
  it('root is an alias of fsolve', () => {
    const x = root((v: number[]) => [v[0] - 3], [0]);
    expect(x[0]).toBeCloseTo(3, 8);
  });
});

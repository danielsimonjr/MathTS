import { describe, it, expect } from 'vitest';
import { minimizeConstrained } from '../src/numeric/constrained.js';
import { bfgs } from '../src/numeric/bfgs.js';

describe('minimizeConstrained', () => {
  it('equality constraint: min x²+y² s.t. x+y=1', () => {
    const r = minimizeConstrained((v) => v[0] ** 2 + v[1] ** 2, [0, 0], {
      eq: [(v) => v[0] + v[1] - 1],
    });
    expect(r.x[0]).toBeCloseTo(0.5, 4);
    expect(r.x[1]).toBeCloseTo(0.5, 4);
    expect(r.fx).toBeCloseTo(0.5, 4);
    expect(r.converged).toBe(true);
  });

  it('active inequality: min (x-2)²+(y-2)² s.t. x+y-2 ≤ 0', () => {
    const r = minimizeConstrained((v) => (v[0] - 2) ** 2 + (v[1] - 2) ** 2, [0, 0], {
      ineq: [(v) => v[0] + v[1] - 2],
    });
    expect(r.x[0]).toBeCloseTo(1, 4);
    expect(r.x[1]).toBeCloseTo(1, 4);
    expect(r.fx).toBeCloseTo(2, 4);
  });

  it('no constraints reduces to a single bfgs call', () => {
    const f = (v: number[]): number => v[0] ** 2;
    const r = minimizeConstrained(f, [1]);
    const b = bfgs(f, [1], { tol: 1e-10, maxIter: 500 });
    expect(r.x[0]).toBeCloseTo(b.x[0], 10);
    expect(r.x[0]).toBeCloseTo(0, 5);
    expect(r.constraintViolation).toBe(0);
  });

  it('inactive inequality leaves the unconstrained minimum [0, 0]', () => {
    const r = minimizeConstrained((v) => v[0] ** 2 + v[1] ** 2, [1, 1], {
      ineq: [(v) => v[0] + v[1] - 10],
    });
    expect(Math.abs(r.x[0])).toBeLessThan(1e-4);
    expect(Math.abs(r.x[1])).toBeLessThan(1e-4);
    expect(r.converged).toBe(true);
  });
});

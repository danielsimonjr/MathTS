import { describe, it, expect } from 'vitest';
import { fsolve, root, findRoot } from '../src/index.js';

const SQRT2 = Math.SQRT2;

describe('fsolve (nonlinear systems, damped Newton)', () => {
  it('[x^2 - y, x + y - 2] from [0.5,0.5] -> [1,1]', () => {
    const x = fsolve((v: number[]) => [v[0] ** 2 - v[1], v[0] + v[1] - 2], [0.5, 0.5]);
    expect(x[0]).toBeCloseTo(1, 8);
    expect(x[1]).toBeCloseTo(1, 8);
  });
  it('[x^2+y^2-25, x-y-1] from [5,1] -> [4,3]', () => {
    const x = fsolve((v: number[]) => [v[0] ** 2 + v[1] ** 2 - 25, v[0] - v[1] - 1], [5, 1]);
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

  // #689 — scalar residual must not throw "v is not iterable" (SciPy-style 1-D).
  it('scalar x0 and scalar residual: x^2 - 2 from 1 -> sqrt(2)', () => {
    const x = fsolve((t: number) => t * t - 2, 1);
    expect(x).toHaveLength(1);
    expect(x[0]).toBeCloseTo(SQRT2, 10);
    expect(Math.abs(x[0] - SQRT2)).toBeLessThan(1e-10);
  });

  it('vector residual sqrt(2) stays within 1e-10 (issue #689 vector form)', () => {
    const x = fsolve((v: number[]) => [v[0] * v[0] - 2], [1]);
    expect(x[0]).toBeCloseTo(SQRT2, 10);
    expect(Math.abs(x[0] - SQRT2)).toBeLessThan(1e-10);
  });

  it('scalar return with length-1 x0 is coerced to a residual vector', () => {
    const x = fsolve((v: number[]) => v[0] * v[0] - 2, [1.5]);
    expect(x[0]).toBeCloseTo(SQRT2, 10);
  });

  it('rejects non-array / wrong-length residual with a domain TypeError (#689)', () => {
    expect(() => fsolve((v: number[]) => v[0] * v[0] - 2, [0.5, 0.5])).toThrow(
      /fsolve: F\(x0\) must be a number\[\] of length 2/
    );
    expect(() => fsolve(() => 0, [1, 2] as number[])).toThrow(
      /fsolve: F\(x0\) must be a number\[\] of length 2/
    );
  });

  it('findRoot scalar bracket matches sqrt(2) (SciPy-style 1-D baseline)', () => {
    const r = findRoot((x: number) => x * x - 2, 1, 2);
    expect(Math.abs(r - SQRT2)).toBeLessThan(1e-15);
  });
});

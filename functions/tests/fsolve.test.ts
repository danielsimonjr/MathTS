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

  it('scalar call does not throw "not iterable" and returns the documented length-1 vector', () => {
    let caught: unknown;
    try {
      const x = fsolve((t: number) => t * t - 2, 1);
      expect(Array.isArray(x)).toBe(true);
      expect(x).toHaveLength(1);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeUndefined();
    expect(String(caught ?? '')).not.toMatch(/not iterable/);
  });

  it('negative start selects the negative square root', () => {
    const x = fsolve((t: number) => t * t - 2, -1);
    expect(x[0]).toBeCloseTo(-SQRT2, 10);
  });

  it('cos(x) - x matches the Dottie number (SciPy fsolve)', () => {
    const x = fsolve((t: number) => Math.cos(t) - t, 0.5);
    expect(x[0]).toBeCloseTo(0.7390851332151607, 10);
    expect(Math.abs(Math.cos(x[0]) - x[0])).toBeLessThan(1e-10);
  });

  it('multiple root (x-1)^2 meets the residual tolerance', () => {
    const x = fsolve((t: number) => (t - 1) ** 2, 0);
    expect(Math.abs(x[0] - 1)).toBeLessThan(1e-4);
    expect((x[0] - 1) ** 2).toBeLessThan(1e-10);
  });

  it('cubic multiple root (x-1)^3 meets the residual tolerance', () => {
    const x = fsolve((t: number) => (t - 1) ** 3, 2);
    expect(Math.abs(x[0] - 1)).toBeLessThan(1e-2);
    expect(Math.abs((x[0] - 1) ** 3)).toBeLessThan(1e-10);
  });

  it('derivative near zero (x^3 - x at 1/sqrt(3)) still reaches a root', () => {
    const xCrit = 1 / Math.sqrt(3);
    const x = fsolve((t: number) => t ** 3 - t, xCrit);
    const roots = [-1, 0, 1];
    expect(roots.some((r) => Math.abs(x[0] - r) < 1e-8)).toBe(true);
  });

  it('tol is a max-norm residual tolerance', () => {
    const tol = 1e-2;
    const x = fsolve((t: number) => t * t - 2, 1, { tol });
    expect(Math.abs(x[0] * x[0] - 2)).toBeLessThan(tol);
  });

  it('maxIter is reported when the solve does not converge', () => {
    expect(() => fsolve((t: number) => Math.exp(t), 0, { maxIter: 5 })).toThrow(
      /fsolve: failed to converge within 5 iterations \(max \|F\| = /
    );
    expect(() => fsolve((t: number) => t * t - 2, 100, { maxIter: 1 })).toThrow(
      /fsolve: failed to converge within 1 iteration \(max \|F\| = /
    );
  });

  it('a flat residual reports a singular Jacobian', () => {
    expect(() => fsolve(() => 1, 0)).toThrow(/fsolve: singular Jacobian/);
  });

  it('NaN and Infinity guesses and residuals are reported as non-finite, not "not iterable"', () => {
    expect(() => fsolve((t: number) => t * t - 2, NaN)).toThrow(
      /fsolve: x0 must be a finite number/
    );
    expect(() => fsolve((t: number) => t * t - 2, Infinity)).toThrow(
      /fsolve: x0 must be a finite number/
    );
    expect(() => fsolve((v: number[]) => [v[0] * v[0] - 2], [NaN])).toThrow(
      /fsolve: x0 must be a finite number/
    );
    expect(() => fsolve(() => NaN, 1)).toThrow(/fsolve: non-finite residual at the initial guess/);
    expect(() => fsolve(() => Infinity, 1)).toThrow(/fsolve: non-finite residual/);
    expect(() => fsolve((_v: number[]) => [NaN, 0], [1, 1])).toThrow(/non-finite residual/);
    for (const run of [
      () => fsolve((t: number) => t * t - 2, NaN),
      () => fsolve(() => Infinity, 1),
    ]) {
      try {
        run();
      } catch (err) {
        expect(String(err)).not.toMatch(/not iterable/);
      }
    }
  });

  it('empty x0 is not a trivial root', () => {
    expect(() => fsolve(() => [], [])).toThrow(/fsolve: x0 must be a finite number/);
  });

  it('vector systems are unchanged', () => {
    const circle = fsolve((v: number[]) => [v[0] ** 2 + v[1] ** 2 - 25, v[0] - v[1] - 1], [5, 1]);
    expect(circle[0]).toBeCloseTo(4, 8);
    expect(circle[1]).toBeCloseTo(3, 8);
    const sinRoot = fsolve((t: number) => Math.sin(t), 2);
    expect(sinRoot[0]).toBeCloseTo(Math.PI, 8);
  });
});

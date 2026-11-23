/**
 * The first step of an ODE driver comes from the norms of the state and of f(t0, y0). The sum of
 * squares overflows for a state of 1.34e154 or more, so the norm was Infinity and the first step
 * was NaN or Infinity (#1156). One function (`odeRmsNorm`) now serves `solveODE`, `solveODESystem`,
 * `solveDDE` and `solveDAE`. Each test bounds the run by a count of calls of `f`, never by time.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';
import { odeRmsNorm } from '../src/numeric/ode-norm.js';

type Fn = (...a: unknown[]) => unknown;
const mt = math as unknown as Record<string, Fn>;

/** Wraps `f` so that the 5001st call throws, and exposes the count. */
function capped<A extends unknown[], R>(f: (...a: A) => R): ((...a: A) => R) & { calls: number } {
  const wrapped = ((...a: A): R => {
    if (++wrapped.calls > 5000) throw new Error('CAP: more than 5000 calls of f');
    return f(...a);
  }) as ((...a: A) => R) & { calls: number };
  wrapped.calls = 0;
  return wrapped;
}

describe('odeRmsNorm', () => {
  it('keeps the bits of the plain sum when the squares do not overflow', () => {
    const v = [0.1, -2.5, 3.75, 1e-3, 77];
    let s = 0;
    for (const x of v) s += x * x;
    expect(odeRmsNorm(v)).toBe(Math.sqrt(s / v.length));
  });

  it('is finite when the squares overflow', () => {
    expect(odeRmsNorm([1e200, 1e200])).toBeCloseTo(1e200, -185);
    expect(odeRmsNorm([3e160, 4e160])).toBeCloseTo(Math.sqrt(12.5) * 1e160, -145);
  });

  it('is Infinity for an infinite value and NaN for a NaN', () => {
    expect(odeRmsNorm([Infinity, 1])).toBe(Infinity);
    expect(odeRmsNorm([NaN, 1])).toBeNaN();
  });

  it('gives the stated value for an empty vector: NaN by default', () => {
    expect(odeRmsNorm([])).toBeNaN();
    expect(odeRmsNorm([], 0)).toBe(0);
  });
});

describe('an empty state keeps the result that each driver gave before the shared norm', () => {
  it('solveODESystem stops at once with the not-finite error', () => {
    const f = capped((_t: number, _y: number[]) => []);
    expect(() => mt.solveODESystem(f, [], [0, 1])).toThrow(/not finite/);
    expect(f.calls).toBeLessThan(3);
  });

  it('solveDAE ends with its step-size error in a bounded number of calls', () => {
    // With a NaN norm the first step was NaN, and the run did not end in 200000 calls of f.
    const f = capped((_t: number, _y: number[], _z: number[]) => []);
    const g = (_t: number, _y: number[], _z: number[]): number[] => [];
    expect(() => mt.solveDAE(f, g, [0, 1], [], [])).toThrow(/step size fell below the minimum/);
    expect(f.calls).toBeLessThan(1000);
  });
});

describe('#1156 a large state starts the step of every ODE driver', () => {
  for (const y0 of [1e155, 1e160, 1e300]) {
    it(`solveODESystem y' = -y, y0 ${y0}: reaches t = 1 with y0 * e^-1`, () => {
      const f = capped((_t: number, y: number[]) => [-y[0]]);
      const r = mt.solveODESystem(f, [y0], [0, 1]) as { t: number[]; y: number[][] };
      expect(r.t[r.t.length - 1]).toBe(1);
      expect(r.y[r.y.length - 1][0] / y0).toBeCloseTo(Math.exp(-1), 3);
    });

    it(`solveDDE y' = -y(t - 1), y0 ${y0}: the solution scales with y0`, () => {
      const f = capped((_t: number, _y: number[], yd: number[][]) => [-yd[0][0]]);
      const unit = mt.solveDDE(
        (_t: number, _y: number[], yd: number[][]) => [-yd[0][0]],
        [0, 3],
        [1],
        [1]
      ) as { y: number[][] };
      const r = mt.solveDDE(f, [0, 3], [y0], [1]) as { y: number[][] };
      expect(f.calls).toBeLessThan(1000);
      expect(r.y[r.y.length - 1][0] / y0).toBeCloseTo(unit.y[unit.y.length - 1][0], 6);
    });

    it(`solveDAE y' = -z, 0 = z - y, y0 ${y0}: ends in a bounded number of calls`, () => {
      const f = capped((_t: number, _y: number[], z: number[]) => [-z[0]]);
      const g = (_t: number, y: number[], z: number[]): number[] => [z[0] - y[0]];
      const r = mt.solveDAE(f, g, [0, 1], y0, y0) as { t: number[]; y: number[] };
      expect(r.t[r.t.length - 1]).toBe(1);
      expect(r.y[r.y.length - 1] / y0).toBeCloseTo(Math.exp(-1), 3);
    });
  }

  it('a state that is not finite still stops the run at once', () => {
    const f = capped((_t: number, _y: number[]) => [1]);
    expect(() => mt.solveODESystem(f, [Infinity], [0, 1])).toThrow(/not finite/);
    expect(f.calls).toBeLessThan(3);
  });
});

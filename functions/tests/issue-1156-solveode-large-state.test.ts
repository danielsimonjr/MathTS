/** Regression checks for adaptive Runge–Kutta at large state magnitudes (#1156, #1370). */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

const { solveODE, bignumber, divide, unaryMinus } = math;
type Fn = (t: unknown, y: unknown) => unknown;
type Solution = { t: unknown[]; y: unknown[] };

/** `f` wrapped with a call counter that throws `CAP` after `cap` calls. */
function counted(f: Fn, cap: number): { f: Fn; calls: () => number } {
  let n = 0;
  return {
    f: (t, y) => {
      n++;
      if (n > cap) throw new Error('CAP');
      return f(t, y);
    },
    calls: () => n,
  };
}

const decay: Fn = (_t, y) => (unaryMinus as (v: unknown) => unknown)(y);
const solve = solveODE as unknown as (
  f: Fn,
  tspan: unknown[],
  y0: unknown,
  options?: Record<string, unknown>
) => Solution;

/** The message of the error that `run` throws; the test fails when `run` returns. */
function messageOf(run: () => unknown): string {
  try {
    run();
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error('the call did not throw');
}

describe('RK23 and RK45 use local error relative to state magnitude', () => {
  for (const method of ['RK23', 'RK45']) {
    for (const magnitude of [1, 1e10, 1e300, '1e160', '1e400']) {
      it(`${method} integrates y0=${magnitude} with fewer than 100 derivative calls`, () => {
        const y0 = typeof magnitude === 'string' ? bignumber(magnitude) : magnitude;
        const c = counted(decay, 100);
        const solution = solve(c.f, [0, 1], y0, { method });
        const last = solution.y.at(-1);
        expect(Number(solution.t.at(-1))).toBe(1);
        expect(
          Math.abs(Number(divide(last as never, y0 as never)) / Math.exp(-1) - 1)
        ).toBeLessThan(1e-4);
        expect(c.calls()).toBeLessThan(100);
      });
    }

    for (const tol of [Infinity, -1]) {
      it(`${method} rejects tol=${tol} before invoking the derivative`, () => {
        const c = counted(decay, 50);
        expect(messageOf(() => solve(c.f, [0, 1], 1, { method, tol }))).toMatch(
          /tol.*finite and positive/
        );
        expect(c.calls()).toBe(0);
      });
    }

    it(`${method} follows an analytic oscillator through zero crossings`, () => {
      const oscillator: Fn = (_t, y) => {
        const v = y as number[];
        return [v[1], -v[0]];
      };
      const r = solve(oscillator, [0, 10], [1, 0], { method });
      expect(r.t.at(-1)).toBe(10);
      for (let i = 0; i < r.t.length; i++) {
        const t = r.t[i] as number;
        const y = r.y[i] as number[];
        expect(Math.hypot(y[0] - Math.cos(t), y[1] + Math.sin(t))).toBeLessThan(1e-4);
      }
    });
  }
});

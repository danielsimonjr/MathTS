/**
 * #1156 (and the BigNumber items of #968): the explicit Runge-Kutta drivers of `solveODE` on a
 * very large state, and on a BigNumber state.
 *
 * The error test of RK23 and RK45 is absolute (mathjs parity), and the error estimate of a large
 * state has a rounding floor above any step size that meets `tol`. So no trial is accepted and the
 * step shrinks. A number step stops when `h` reaches 0. A BigNumber `h` never reaches 0, because a
 * decimal has no minimum exponent for this size, so the run ended on the attempt cap only. The
 * drivers now stop a BigNumber step below a floor relative to the span. The underflow error of
 * RK23 and RK45 names the last error estimate when it was finite.
 *
 * Every bound on the work of a run is a count of calls of `f` (an `f` that throws `CAP` stops a
 * run that would spin), never a time.
 */
import { describe, it, expect } from 'vitest';
import * as math from '../src/index.js';

const { solveODE, bignumber, unaryMinus } = math;
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

const bits = (v: number): string => {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, v);
  return view.getBigUint64(0).toString(16).padStart(16, '0');
};

describe('#1156 BigNumber step size underflow', () => {
  it('1: bignumber 1e400 with RK23 stops with a step size underflow, not on the attempt cap', () => {
    const c = counted(decay, 2000);
    const message = messageOf(() =>
      solve(c.f, [0, 1], bignumber('1e400'), { method: 'RK23', maxIter: 20 })
    );
    expect(message).toMatch(/step size underflow.*error estimate.*above tol/);
    expect(message).not.toBe('CAP');
    expect(c.calls()).toBeLessThanOrEqual(1000);
  });

  for (const method of ['RK45', 'RK23']) {
    it(`2: bignumber 1e160 with ${method} stops with a step size underflow`, () => {
      const c = counted(decay, 2000);
      const message = messageOf(() => solve(c.f, [0, 1], bignumber('1e160'), { method }));
      expect(message).toMatch(/step size underflow.*error estimate.*above tol/);
      expect(c.calls()).toBeLessThanOrEqual(1000);
    });
  }

  it('rejects an infinite tolerance before evaluating a large BigNumber state', () => {
    const c = counted(decay, 50);
    expect(() => solve(c.f, [0, 1], bignumber('1e400'), { tol: Infinity })).toThrow(
      /tol.*finite and positive/
    );
    expect(c.calls()).toBe(0);
  });
});

describe('#1156 number step size underflow names its cause', () => {
  for (const y0 of [1e160, 1e300]) {
    for (const method of ['RK23', 'RK45']) {
      it(`4: ${method} with y0 ${y0} stops at t=0 and names the error estimate`, () => {
        const c = counted(decay, 6000);
        const message = messageOf(() => solve(c.f, [0, 1], y0, { method }));
        expect(message).toMatch(
          /^solveODE RK(23|45): step size underflow at t=0 .*error estimate.*above tol/
        );
        expect(c.calls()).toBeLessThanOrEqual(4000);
      });
    }
  }

  for (const method of ['RK45', 'RK23']) {
    it(`7b: tol -1 with ${method} fails validation before integrating`, () => {
      const c = counted(decay, 10000);
      const message = messageOf(() => solve(c.f, [0, 1], 1, { method, tol: -1 }));
      expect(message).toMatch(/tol.*finite and positive/);
      expect(c.calls()).toBe(0);
    });
  }
});

describe('#1156 runs that work today keep their trajectory', () => {
  it('5: y0 = 1 reaches e^-1 with the default tol, with the same point count', () => {
    for (const [method, points] of [
      ['RK23', 22],
      ['RK45', 6],
    ] as const) {
      const r = solve(decay, [0, 1], 1, { method });
      expect(r.t.length, method).toBe(points);
      const last = r.y.at(-1) as number | number[];
      const value = Array.isArray(last) ? last[0] : last;
      expect(Math.abs(value / Math.exp(-1) - 1), method).toBeLessThan(1e-4);
    }
  });

  it('6: bignumber(1) keeps its 64 digits', () => {
    const rk45 = solve(decay, [0, 1], bignumber(1), { method: 'RK45' });
    expect(rk45.t.length).toBe(6);
    expect(String(rk45.y.at(-1))).toBe(
      '0.3678805744341224554198688442057630219573640949156897793407390547'
    );
    const rk23 = solve(decay, [0, 1], bignumber(1), { method: 'RK23' });
    expect(rk23.t.length).toBe(22);
    expect(String(rk23.y.at(-1))).toBe(
      '0.3678768529675089348960226686331219033429769337131078651189612401'
    );
  });

  /** FNV-style 64-bit hash of the bits of t, y0 and y1 of every point. */
  function trajectoryHash(r: Solution): string {
    let h = 0n;
    for (let i = 0; i < r.t.length; i++) {
      const y = r.y[i] as number[];
      for (const v of [r.t[i] as number, y[0], y[1]]) {
        h = ((h * 1099511628211n) ^ BigInt('0x' + bits(v))) & 0xffffffffffffffffn;
      }
    }
    return h.toString(16).padStart(16, '0');
  }

  it('7: an oscillator on [0, 10] is bit-identical to the trajectory before the change', () => {
    const oscillator: Fn = (_t, y) => {
      const v = y as number[];
      return [v[1], -v[0]];
    };
    const expected = {
      RK45: {
        points: 24,
        hash: '87a9814d680061b6',
        last: ['4024000000000000', 'bfead90b92001903', '3fe168c65f29491a'],
      },
      RK23: {
        points: 216,
        hash: '87106d4fee944a8b',
        last: ['4024000000000000', 'bfead95db8c205af', '3fe16870044667b6'],
      },
    } as const;
    for (const method of ['RK45', 'RK23'] as const) {
      const r = solve(oscillator, [0, 10], [1, 0], { method });
      const want = expected[method];
      expect(r.t.length, method).toBe(want.points);
      expect(trajectoryHash(r), method).toBe(want.hash);
      const y = r.y.at(-1) as number[];
      expect([bits(r.t.at(-1) as number), bits(y[0]), bits(y[1])], method).toEqual([...want.last]);
    }
  });
});

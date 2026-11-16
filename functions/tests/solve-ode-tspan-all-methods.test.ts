/**
 * #991: every solveODE method checks tspan at the shared entry (`_solveODE`), and NaN data ends
 * the run. Before the fix, the stiff methods (Rosenbrock, RODAS, BDF, Radau) skipped the RK45
 * tspan check and hung on a bad tspan. Tests whose name contains "(hangs on main)" hang a
 * synchronous loop on the unfixed code, so a vitest timeout cannot stop them. The RED run
 * excludes them by name; their RED evidence is a `timeout 60 node` probe of the built dist.
 */
import { describe, it, expect } from 'vitest';
import { solveODE } from '../src/index.js';

const METHODS = ['RK23', 'RK45', 'Rosenbrock', 'RODAS', 'BDF', 'Radau'] as const;

/** The array solution. The typed dispatch returns `unknown`, so each call site asserts it. */
type Solution = { t: number[]; y: number[][] };

const SHAPE_TEXT = '"tspan" must be an Array of two numeric values or two units [tStart, tEnd]';
const FINITE_TEXT = '"tspan" must contain finite numbers (NaN and Infinity are not allowed)';

const decay = (_t: number, y: number[]): number[] => [-1000 * y[0]];
const rob = (_t: number, y: number[]): number[] => {
  const [y1, y2, y3] = y;
  return [-0.04 * y1 + 1e4 * y2 * y3, 0.04 * y1 - 1e4 * y2 * y3 - 3e7 * y2 * y2, 3e7 * y2 * y2];
};

/** The message a call throws, or null when it returns. */
function errorText(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

describe('solveODE tspan shape, every method', () => {
  for (const method of METHODS) {
    it(`${method}: a tspan of length 1 throws the RK45 text`, () => {
      expect(errorText(() => solveODE(decay, [0], [1], { method }))).toBe(SHAPE_TEXT);
    });

    it(`${method}: a tspan of length 3 throws the RK45 text`, () => {
      expect(errorText(() => solveODE(decay, [0, 1, 2], [1], { method }))).toBe(SHAPE_TEXT);
    });

    it(`${method}: a tspan of strings throws the RK45 text`, () => {
      expect(errorText(() => solveODE(decay, ['a', 1], [1], { method }))).toBe(SHAPE_TEXT);
    });
  }
});

describe('solveODE tspan finite check, every method', () => {
  for (const method of METHODS) {
    it(`${method}: a NaN tspan entry throws`, () => {
      expect(errorText(() => solveODE(decay, [NaN, 1], [1], { method }))).toBe(FINITE_TEXT);
      expect(errorText(() => solveODE(decay, [0, NaN], [1], { method }))).toBe(FINITE_TEXT);
    });

    it(`${method}: an Infinity tspan entry throws (hangs on main)`, () => {
      expect(errorText(() => solveODE(decay, [0, Infinity], [1], { method }))).toBe(FINITE_TEXT);
      expect(errorText(() => solveODE(decay, [-Infinity, 0], [1], { method }))).toBe(FINITE_TEXT);
    });
  }
});

describe('solveODE tspan edge spans, every method', () => {
  for (const method of METHODS) {
    it(`${method}: an equal span returns the single start point`, () => {
      const sol = solveODE(decay, [1, 1], [1], { method }) as Solution;
      expect(sol.t).toEqual([1]);
      expect(sol.y).toEqual([[1]]);
    });

    it(`${method}: a reversed span integrates backward, as SciPy solve_ivp does`, () => {
      // y' = -y from y(1) = 1 back to t = 0 gives y(0) = e (scipy solve_ivp, t_bound < t0).
      const sol = solveODE((_t: number, y: number[]) => [-y[0]], [1, 0], [1], {
        method,
      }) as Solution;
      expect(sol.t[sol.t.length - 1]).toBe(0);
      expect(Math.abs(sol.y[sol.y.length - 1][0] - Math.E)).toBeLessThan(1e-2);
    });
  }
});

describe('solveODE non-array and non-function inputs, same text as RK45', () => {
  it('a non-array y0 throws the RK45 text in every method', () => {
    const want = errorText(() =>
      solveODE(decay, [0, 1], 'a' as unknown as number[], { method: 'RK45' })
    );
    expect(want).not.toBeNull();
    for (const method of METHODS) {
      expect(errorText(() => solveODE(decay, [0, 1], 'a' as unknown as number[], { method }))).toBe(
        want
      );
    }
  });

  it('a non-function f throws the RK45 text in every method', () => {
    const want = errorText(() =>
      solveODE(5 as unknown as typeof decay, [0, 1], [1], { method: 'RK45' })
    );
    expect(want).not.toBeNull();
    for (const method of METHODS) {
      expect(errorText(() => solveODE(5 as unknown as typeof decay, [0, 1], [1], { method }))).toBe(
        want
      );
    }
  });
});

describe('solveODE NaN data ends the run, every method (hangs on main)', () => {
  for (const method of METHODS) {
    it(`${method}: a NaN y0 propagates to the end point and the run ends (hangs on main)`, () => {
      const sol = solveODE(decay, [0, 1], [NaN], { method }) as Solution;
      expect(sol.t[sol.t.length - 1]).toBe(1);
      expect(Number.isNaN(sol.y[sol.y.length - 1][0])).toBe(true);
    });

    it(`${method}: a partly NaN y0 ends with a NaN state (hangs on main)`, () => {
      const sol = solveODE((_t: number, y: number[]) => [-y[0], -y[1]], [0, 1], [1, NaN], {
        method,
      }) as Solution;
      expect(sol.t[sol.t.length - 1]).toBe(1);
      expect(sol.y[sol.y.length - 1].some((v) => Number.isNaN(v))).toBe(true);
    });

    it(`${method}: an f that returns NaN at t0 ends with a NaN state (hangs on main)`, () => {
      const sol = solveODE(() => [NaN], [0, 1], [1], { method }) as Solution;
      expect(sol.t[sol.t.length - 1]).toBe(1);
      expect(Number.isNaN(sol.y[sol.y.length - 1][0])).toBe(true);
    });

    it(`${method}: an f that returns NaN after t0 ends the run (hangs on main)`, () => {
      // The run must end: it either returns a solution or throws an Error. It must not spin.
      const text = errorText(() =>
        solveODE((t: number, y: number[]) => [t > 0.5 ? NaN : -y[0]], [0, 1], [1], { method })
      );
      expect(text === null || text.length > 0).toBe(true);
    });
  }
});

describe('issue #991 call shape (hangs on main)', () => {
  for (const method of METHODS) {
    it(`${method}: solveODE(rob, [1,0,0], [0,40]) throws the tspan shape text`, () => {
      expect(errorText(() => solveODE(rob, [1, 0, 0], [0, 40], { method }))).toBe(SHAPE_TEXT);
    });
  }
});

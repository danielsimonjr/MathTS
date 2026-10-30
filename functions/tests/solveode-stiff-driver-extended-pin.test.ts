/**
 * P6-3 pins that reach every branch of `_linearlyImplicitDriver`: the Hairer initial step
 * (including the 1e-6 fallback), the overshoot clamp, reverse time, the min/max step clamps, an
 * analytic Jacobian, a 3-state system, the `maxIter` error, and the `f` call counts. The driver is
 * compared with the pre-P6-3 bodies in `fixtures/stiff-legacy-reference.ts`, in one process.
 */
import { describe, it, expect } from 'vitest';
import { rosenbrockSolve, rodasSolve } from '../src/numeric/solveODE.js';
import { legacyRosenbrockSolve, legacyRodasSolve } from './fixtures/stiff-legacy-reference.js';
import { STIFF_CASES, STIFF_MAXITER_CASE, type StiffCase } from './fixtures/stiff-driver-cases.js';

type Solve = (
  f: (t: unknown, y: unknown) => number[],
  tspan: unknown[],
  y0: unknown[],
  options?: Record<string, unknown>
) => { t: number[]; y: number[][] };

function run(solve: Solve, c: StiffCase): { calls: number; t: number[]; y: number[][] } {
  let calls = 0;
  const f = (t: unknown, y: unknown): number[] => {
    calls++;
    return c.f(t as number, y as number[]);
  };
  const sol = solve(f, c.tspan, c.y0, c.options as Record<string, unknown>);
  return { calls, t: sol.t, y: sol.y };
}

const METHODS: Array<[string, Solve, Solve]> = [
  ['rosenbrockSolve', rosenbrockSolve as Solve, legacyRosenbrockSolve as Solve],
  ['rodasSolve', rodasSolve as Solve, legacyRodasSolve as Solve],
];

for (const [label, solve, legacy] of METHODS) {
  describe(`${label} against the pre-driver body`, () => {
    for (const c of STIFF_CASES) {
      it(`${c.name}: t, y and the f call count are bit-identical`, () => {
        const want = run(legacy, c);
        const got = run(solve, c);
        expect(want.t.length).toBeGreaterThan(1);
        expect(got.t).toEqual(want.t);
        expect(got.y).toEqual(want.y);
        expect(got.calls).toBe(want.calls);
      });
    }

    it('reports maxIter exhaustion with the unchanged message', () => {
      const message = 'Maximum number of iterations reached, try changing options';
      expect(() => run(legacy, STIFF_MAXITER_CASE)).toThrow(message);
      expect(() => run(solve, STIFF_MAXITER_CASE)).toThrow(message);
    });

    it('carries its own name in the validation errors', () => {
      const name = label === 'rosenbrockSolve' ? 'Rosenbrock' : 'RODAS';
      const f = (): number[] => [0];
      expect(() => solve(f, ['a', 1], [1])).toThrow(
        `The "${name}" stiff method requires numeric tspan`
      );
      expect(() => solve(f, [0, 1], ['x'])).toThrow(
        `The "${name}" stiff method requires plain-number state (y0)`
      );
    });
  });
}

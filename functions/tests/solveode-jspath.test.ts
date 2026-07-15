/**
 * solveODE correctness on the JS reference path, pinned to closed-form solutions.
 *
 * This path had been fully broken: the adaptive Runge-Kutta step combined its stages with the
 * mathjs form `multiply(h, a[i], k)`, which relies on vector·matrix / vector·vector `multiply`
 * semantics that MathTS's typed `multiply` rejects for 1-D operands (it routes them to `dot`), so
 * EVERY call threw `multiply(Array, Array) requires two 2-D matrices`. It stayed green in CI only
 * because the test environment loads the WASM kernel, which took a different code path — scalar
 * ODEs (a non-array y0) and any WASM-less consumer always hit the broken JS path. These tests use
 * scalar y0 (which forces the JS path) and analytic references.
 */
import { describe, it, expect } from 'vitest';
import { solveODE, unit } from '../src/index.js';

const last = (sol: { y: number[] | number[][] }): number | number[] => sol.y[sol.y.length - 1];

describe('solveODE — scalar ODEs (JS reference path)', () => {
  it("y' = -y, y(0)=1  →  y(1) = e^-1", () => {
    const y1 = last(solveODE((_t, y) => -(y as number), [0, 1], 1, { tol: 1e-9 })) as number;
    expect(y1).toBeCloseTo(Math.exp(-1), 5);
  });

  it("y' = y, y(0)=1  →  y(1) = e", () => {
    const y1 = last(solveODE((_t, y) => y as number, [0, 1], 1, { tol: 1e-9 })) as number;
    expect(y1).toBeCloseTo(Math.E, 5);
  });

  it("logistic y' = y(1-y), y(0)=0.5  →  y(t) = 1/(1+e^-t)", () => {
    const y2 = last(
      solveODE((_t, y) => (y as number) * (1 - (y as number)), [0, 2], 0.5, { tol: 1e-9 })
    ) as number;
    expect(y2).toBeCloseTo(1 / (1 + Math.exp(-2)), 5);
  });

  it("backward integration: from t=1 (y=e) back to t=0 gives e² for y'=-y", () => {
    // y' = -y ⇒ y(t) = C e^-t; y(1) = e ⇒ C = e² ⇒ y(0) = e².
    const y0 = last(solveODE((_t, y) => -(y as number), [1, 0], Math.E, { tol: 1e-9 })) as number;
    expect(y0).toBeCloseTo(Math.E * Math.E, 4);
  });

  it('RK23 method also solves the scalar decay', () => {
    const y1 = last(
      solveODE((_t, y) => -(y as number), [0, 1], 1, { method: 'RK23', tol: 1e-9 })
    ) as number;
    expect(y1).toBeCloseTo(Math.exp(-1), 4);
  });
});

describe('solveODE — systems', () => {
  it('harmonic oscillator [y1, -y0], y(0)=[1,0]  →  [cos t, -sin t]', () => {
    const y = last(
      solveODE((_t, s) => [(s as number[])[1], -(s as number[])[0]], [0, 1], [1, 0], { tol: 1e-9 })
    ) as number[];
    expect(y[0]).toBeCloseTo(Math.cos(1), 4);
    expect(y[1]).toBeCloseTo(-Math.sin(1), 4);
  });

  it('decoupled decay [-y0,-2y1,-3y2] matches e^{-t}, e^{-2t}, e^{-3t}', () => {
    const y = last(
      solveODE(
        (_t, s) => [-(s as number[])[0], -2 * (s as number[])[1], -3 * (s as number[])[2]],
        [0, 1],
        [1, 1, 1],
        { tol: 1e-9 }
      )
    ) as number[];
    expect(y[0]).toBeCloseTo(Math.exp(-1), 4);
    expect(y[1]).toBeCloseTo(Math.exp(-2), 4);
    expect(y[2]).toBeCloseTo(Math.exp(-3), 4);
  });
});

describe('solveODE — Unit-valued state (numeric time)', () => {
  it("y' = y with y0 = 5 m gives 5·e m (state-is-Unit falls to the whole-interval step, not NaN)", () => {
    // The initial-step heuristic must NOT run on Unit state (rmsNorm would give NaN → h=NaN).
    const sol = solveODE((_t, y) => y, [0, 1], unit('5 m'), { tol: 1e-6 });
    const yEnd = sol.y[sol.y.length - 1] as { toNumeric: (u: string) => number };
    expect(yEnd.toNumeric('m')).toBeCloseTo(5 * Math.E, 3);
  });
});

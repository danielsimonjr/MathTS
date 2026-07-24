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

describe('solveODE — Rosenbrock stiff method (ode23s)', () => {
  it("solves a linear stiff system y' = diag(-1,-1000) y to its exact solution", () => {
    // y(t) = [e^{-t}, e^{-1000 t}]; the fast (−1000) mode makes this stiff — an explicit method
    // would need a step ~1e-3 to stay stable, this is L-stable and steps at the slow scale.
    const sol = solveODE(
      (_t, y) => [-(y as number[])[0], -1000 * (y as number[])[1]],
      [0, 1],
      [1, 1],
      { method: 'Rosenbrock', tol: 1e-8 }
    );
    const y = sol.y[sol.y.length - 1] as number[];
    expect(y[0]).toBeCloseTo(Math.exp(-1), 4); // slow mode
    expect(Math.abs(y[1])).toBeLessThan(1e-6); // fast mode decayed, no instability
  });

  it('agrees with the explicit RK45 on a non-stiff problem', () => {
    const stiff = solveODE((_t, y) => -(y as number), [0, 1], 1, {
      method: 'Rosenbrock',
      tol: 1e-8,
    });
    const yStiff = stiff.y[stiff.y.length - 1] as number;
    expect(yStiff).toBeCloseTo(Math.exp(-1), 5);
  });

  it('stays stable on stiff Van der Pol (μ=1000) where an explicit method would crawl', () => {
    // Endpoint agreement with scipy BDF (verified out-of-band: y(3000) ≈ [-1.5105, 0.00118]).
    const mu = 1000;
    const sol = solveODE(
      (_t, y) => [
        (y as number[])[1],
        mu * (1 - (y as number[])[0] ** 2) * (y as number[])[1] - (y as number[])[0],
      ],
      [0, 3000],
      [2, 0],
      { method: 'Rosenbrock', tol: 1e-6 }
    );
    const y = sol.y[sol.y.length - 1] as number[];
    expect(y[0]).toBeCloseTo(-1.5105, 2);
    expect(Number.isFinite(y[0]) && Number.isFinite(y[1])).toBe(true);
  });
});

describe('solveODE — large stiff system (matrix-LU-routed per-step solve)', () => {
  // n = 12 ≥ LU_ROUTE_THRESHOLD, so the stiff per-step linear solve routes onto the
  // @danielsimonjr/mathts-matrix lu()/luSolve primitive. Method-of-lines heat equation
  // u_t = D·u_xx (Dirichlet 0 ends); a single sine mode decays as exp(−λt) with
  // λ = D·(2 − 2cos(π/(n+1))). Pin the routed path to that exact closed form.
  const n = 12;
  const D = n * n;
  const f = (_t: number, y: number[]): number[] => {
    const dy = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const l = i > 0 ? y[i - 1] : 0;
      const r = i < n - 1 ? y[i + 1] : 0;
      dy[i] = D * (l - 2 * y[i] + r);
    }
    return dy;
  };
  const y0 = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 1)) / (n + 1)));
  const lambda = D * (2 - 2 * Math.cos(Math.PI / (n + 1)));
  const tEnd = 0.1;
  const mid = Math.floor(n / 2);
  const exact = Math.sin((Math.PI * (mid + 1)) / (n + 1)) * Math.exp(-lambda * tEnd);

  it('RODAS (n=12) matches the exact heat-equation mode', () => {
    const sol = solveODE(f, [0, tEnd], y0, { method: 'RODAS', tol: 1e-8 });
    const y = sol.y[sol.y.length - 1] as number[];
    expect(y[mid]).toBeCloseTo(exact, 6);
    expect(y.every((v) => Number.isFinite(v))).toBe(true);
  });

  it('Rosenbrock (n=12) matches the exact heat-equation mode', () => {
    const sol = solveODE(f, [0, tEnd], y0, { method: 'Rosenbrock', tol: 1e-8 });
    const y = sol.y[sol.y.length - 1] as number[];
    expect(y[mid]).toBeCloseTo(exact, 5);
    expect(y.every((v) => Number.isFinite(v))).toBe(true);
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

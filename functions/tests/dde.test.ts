/**
 * Tests for `solveDDE` — constant-delay delay differential equations
 * `y'(t) = f(t, y(t), [y(t−τ₁), …])` via the method of steps: an adaptive
 * BS23 (Bogacki–Shampine) integrator with a cubic-Hermite continuous extension
 * (dense output) as the history interpolant, the step capped at `min(τ)` so every
 * delayed argument lands in already-computed history.
 *
 * scipy has NO DDE solver, so every oracle here is implementation-independent:
 *  - Method-of-steps EXACT piecewise polynomials (hand-derived, verified against an
 *    independent fine fixed-step method-of-steps integrator in a scratch pass).
 *  - Linear-DDE characteristic roots of `s = a·e^{−sτ}`: the asymptotic decay rate
 *    (real dominant root) and the oscillation period + decay (complex principal root).
 *  - Solution continuity across the derivative-jump breakpoints t0 + kτ.
 *  - ODE-degeneration: a delay so large it never bites reduces the DDE to a plain
 *    ODE, cross-checked against `solveODESystem` (an independent integrator).
 */
import { describe, it, expect } from 'vitest';
import { solveDDE, solveODESystem } from '../src/typed/numeric.js';

describe('solveDDE — method-of-steps exact: y′=−y(t−1), φ=1', () => {
  const f = (_t: number, _y: number[], yd: number[][]) => [-yd[0][0]];
  // Verified piecewise-exact solution (see scratch verification):
  //  [0,1]: 1 − t   [1,2]: t²/2 − 2t + 3/2   [2,3]: 1/6 − (t−1)³/6 + (t−1)² − 1.5(t−1)
  const yExact = (t: number): number => {
    if (t <= 1) return 1 - t;
    if (t <= 2) return (t * t) / 2 - 2 * t + 3 / 2;
    const u = t - 1;
    return 1 / 6 - (u * u * u) / 6 + u * u - 1.5 * u;
  };

  it('matches the exact piecewise polynomial to ~1e-7 over 3 delay intervals', () => {
    const sol = solveDDE(f, [0, 3], 1, [1], { tol: 1e-9 });
    const yq = sol.yInterp as (t: number) => number;
    let maxErr = 0;
    for (const t of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3]) {
      maxErr = Math.max(maxErr, Math.abs(yq(t) - yExact(t)));
    }
    expect(maxErr).toBeLessThan(1e-7);
    // final time is reached exactly
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(3, 10);
  });

  it('accepted output points also lie on the exact solution', () => {
    const sol = solveDDE(f, [0, 3], 1, [1], { tol: 1e-9 });
    const y = sol.y as number[];
    let maxErr = 0;
    for (let i = 0; i < sol.t.length; i++)
      maxErr = Math.max(maxErr, Math.abs(y[i] - yExact(sol.t[i])));
    expect(maxErr).toBeLessThan(1e-7);
  });
});

describe('solveDDE — constant-history growing solution: y′=y(t−1), φ=1', () => {
  const f = (_t: number, _y: number[], yd: number[][]) => [yd[0][0]];
  // [0,1]: 1 + t   [1,2]: t²/2 + 3/2  (verified independently)
  const yExact = (t: number): number => (t <= 1 ? 1 + t : (t * t) / 2 + 1.5);

  it('recovers the known growing piecewise solution to ~1e-7', () => {
    const sol = solveDDE(f, [0, 2], 1, [1], { tol: 1e-9 });
    const yq = sol.yInterp as (t: number) => number;
    let maxErr = 0;
    for (const t of [0.5, 1, 1.5, 2]) maxErr = Math.max(maxErr, Math.abs(yq(t) - yExact(t)));
    expect(maxErr).toBeLessThan(1e-7);
  });
});

describe('solveDDE — multiple constant delays: y′=−y(t−1)−y(t−2), φ=1', () => {
  const f = (_t: number, _y: number[], yd: number[][]) => [-yd[0][0] - yd[1][0]];
  // [0,1]: 1 − 2t   [1,2]: t² − 4t + 2  (verified independently)
  const yExact = (t: number): number => (t <= 1 ? 1 - 2 * t : t * t - 4 * t + 2);

  it('handles two delays and matches the exact solution to ~1e-7', () => {
    const sol = solveDDE(f, [0, 2], 1, [1, 2], { tol: 1e-9 });
    const yq = sol.yInterp as (t: number) => number;
    let maxErr = 0;
    for (const t of [0.5, 1, 1.5, 2]) maxErr = Math.max(maxErr, Math.abs(yq(t) - yExact(t)));
    expect(maxErr).toBeLessThan(1e-7);
  });
});

describe('solveDDE — characteristic-root decay rate: y′=−0.25·y(t−1)', () => {
  // s = −0.25·e^{−s} has dominant REAL root s = −0.357403 (|a| < 1/e ⇒ real, non-oscillatory),
  // so y(t) ~ C·e^{−0.357403·t} in the tail. Measured on an independent fine reference: −0.357403.
  it('the asymptotic decay rate matches the principal characteristic root', () => {
    const f = (_t: number, _y: number[], yd: number[][]) => [-0.25 * yd[0][0]];
    const sol = solveDDE(f, [0, 40], 1, [1], { tol: 1e-10 });
    const yq = sol.yInterp as (t: number) => number;
    const t1 = 25;
    const t2 = 35;
    const rate = Math.log(Math.abs(yq(t2)) / Math.abs(yq(t1))) / (t2 - t1);
    expect(rate).toBeCloseTo(-0.357403, 3); // matches s = −0.357403 to 3 decimals
  });
});

describe('solveDDE — characteristic-root oscillation: y′=−y(t−1)', () => {
  // s = −e^{−s} has complex principal root σ ± iω with σ = −0.318132, ω = 1.337236,
  // period = 2π/ω = 4.698637. Extract period + decay from successive peaks of y(t).
  it('the oscillation period and decay match the complex principal root', () => {
    const f = (_t: number, _y: number[], yd: number[][]) => [-yd[0][0]];
    const sol = solveDDE(f, [0, 30], 1, [1], { tol: 1e-10 });
    const yq = sol.yInterp as (t: number) => number;
    // Sample the dense output on a fine grid and locate positive local maxima for t > 3.
    const dt = 0.002;
    const peaks: Array<{ t: number; y: number }> = [];
    let prev = yq(3 - dt);
    for (let t = 3; t <= 28; t += dt) {
      const cur = yq(t);
      const next = yq(t + dt);
      if (cur > prev && cur >= next && cur > 0) peaks.push({ t, y: cur });
      prev = cur;
    }
    expect(peaks.length).toBeGreaterThanOrEqual(3);
    const period = peaks[1].t - peaks[0].t;
    const sigma = Math.log(peaks[1].y / peaks[0].y) / period;
    expect(period).toBeCloseTo(4.698637, 1); // 2π/ω
    expect(sigma).toBeCloseTo(-0.318132, 2); // Re(principal root)
  });
});

describe('solveDDE — discontinuity propagation and continuity across breakpoints', () => {
  // For y′=−y(t−1), φ≡1: y′ has a jump at t0=0 (φ is flat, but y′(0⁺)=−1). That
  // discontinuity SMOOTHS one order at each breakpoint t0+kτ: y is C⁰ everywhere,
  // y′ is already continuous at t=1, and the jump has moved up to y″ there
  // (y″(1⁻)=0 from the linear φ-interval, y″(1⁺)=1 from the [1,2] quadratic).
  const f = (_t: number, _y: number[], yd: number[][]) => [-yd[0][0]];

  it('lands exactly on each breakpoint t0 + kτ (isolating the derivative jump)', () => {
    const sol = solveDDE(f, [0, 3], 1, [1], { tol: 1e-9 });
    for (const b of [1, 2, 3]) {
      const hit = sol.t.some((t) => Math.abs(t - b) < 1e-9);
      expect(hit).toBe(true);
    }
  });

  it('y stays continuous (C⁰) across the breakpoints t = 1 and t = 2', () => {
    const sol = solveDDE(f, [0, 3], 1, [1], { tol: 1e-9 });
    const yq = sol.yInterp as (t: number) => number;
    for (const b of [1, 2]) {
      const jump = Math.abs(yq(b + 1e-7) - yq(b - 1e-7));
      expect(jump).toBeLessThan(1e-6);
    }
  });

  it('captures the second-derivative jump at t = 1 (0 → 1)', () => {
    const sol = solveDDE(f, [0, 3], 1, [1], { tol: 1e-9 });
    const yq = sol.yInterp as (t: number) => number;
    const d = 1e-3;
    const d2 = (a: number, b: number, c: number) => (a - 2 * b + c) / (d * d);
    const yppLeft = d2(yq(1), yq(1 - d), yq(1 - 2 * d)); // ≈ 0 (linear φ-interval)
    const yppRight = d2(yq(1), yq(1 + d), yq(1 + 2 * d)); // ≈ 1 (quadratic interval)
    expect(Math.abs(yppLeft)).toBeLessThan(0.1);
    expect(yppRight).toBeCloseTo(1, 1);
    expect(Math.abs(yppRight - yppLeft)).toBeGreaterThan(0.5); // genuine y″ jump
  });
});

describe('solveDDE — ODE degeneration when the delay never bites', () => {
  // τ = 100 on [0, 5] ⇒ t − τ < 0 throughout, so y(t−τ) = φ(t−τ) = const, and the DDE
  // reduces to the ODE y′ = −0.5·y + φ. Cross-check against solveODESystem (independent).
  it('reduces to the plain ODE and matches solveODESystem', () => {
    const c = 1; // constant history value
    const fDDE = (_t: number, y: number[], yd: number[][]) => [-0.5 * y[0] + yd[0][0]];
    const dde = solveDDE(fDDE, [0, 5], c, [100], { tol: 1e-10 });
    const yDDE = dde.y as number[];
    // Equivalent ODE: y′ = −0.5 y + c, y(0) = c.
    const fODE = (_t: number, y: number[]) => [-0.5 * y[0] + c];
    const ode = solveODESystem(fODE, [c], [0, 5], { tol: 1e-10 });
    const yODE = ode.y as number[][];
    const ddeFinal = yDDE[yDDE.length - 1];
    const odeFinal = yODE[yODE.length - 1][0];
    // Closed form: y = 2 − e^{−0.5 t} ⇒ y(5) = 2 − e^{−2.5}.
    const exact = 2 - Math.exp(-2.5);
    expect(Math.abs(ddeFinal - odeFinal)).toBeLessThan(1e-6);
    expect(ddeFinal).toBeCloseTo(exact, 6);
  });
});

describe('solveDDE — vector state', () => {
  // Coupled system, single delay τ = 1, history the constant vector [1, 0].
  // On [0,1] both delayed values are the history constants, so it is a linear ODE
  // there; we only check shape + continuity + that it integrates to T.
  it('integrates a 2-component system and returns number[][] for y', () => {
    const f = (_t: number, y: number[], yd: number[][]) => [yd[0][1] - y[0], -yd[0][0]];
    const sol = solveDDE(f, [0, 2], [1, 0], [1], { tol: 1e-8 });
    const y = sol.y as number[][];
    expect(Array.isArray(y[0])).toBe(true);
    expect(y[0]).toHaveLength(2);
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(2, 10);
    // initial state equals φ(t0)
    expect(y[0][0]).toBeCloseTo(1, 12);
    expect(y[0][1]).toBeCloseTo(0, 12);
  });
});

describe('solveDDE — history as a function of t', () => {
  // φ(t) = e^{t} for t ≤ 0. On [0,1]: y′ = y(t−1) = e^{t−1}, y(0)=φ(0)=1
  //  ⇒ y(t) = 1 + e^{t−1} − e^{−1}  (integrate e^{s−1} from 0 to t).
  it('accepts a callable history and matches the closed form', () => {
    const f = (_t: number, _y: number[], yd: number[][]) => [yd[0][0]];
    const hist = (t: number) => Math.exp(t);
    const sol = solveDDE(f, [0, 1], hist, [1], { tol: 1e-10 });
    const yq = sol.yInterp as (t: number) => number;
    const exact = (t: number) => 1 + Math.exp(t - 1) - Math.exp(-1);
    let maxErr = 0;
    for (const t of [0.25, 0.5, 0.75, 1]) maxErr = Math.max(maxErr, Math.abs(yq(t) - exact(t)));
    expect(maxErr).toBeLessThan(1e-8);
  });
});

describe('solveDDE — input validation', () => {
  const f = (_t: number, _y: number[], yd: number[][]) => [-yd[0][0]];
  it('requires T > t0', () => {
    expect(() => solveDDE(f, [1, 0], 1, [1])).toThrow(/T > t0/);
  });
  it('requires at least one positive delay', () => {
    expect(() => solveDDE(f, [0, 1], 1, [])).toThrow(/delay/i);
    expect(() => solveDDE(f, [0, 1], 1, [-1])).toThrow(/positive/i);
  });
});

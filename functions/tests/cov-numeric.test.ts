/**
 * Coverage tests for functions/src/typed/numeric.ts.
 *
 * The existing numeric.test.ts exercises the happy paths of every export;
 * this file targets the remaining uncovered JS branches: secant fallbacks,
 * error/singular paths, the JS fallbacks of WASM-accelerated routines (loess,
 * griddata, rbfInterpolate, leastSquares, cond, rank), basin-hopping
 * (globalMinimize), the shooting BVP solver, event detection, residue /
 * Durand-Kerner root finding, quadprog, linprog (unbounded + extraction), and
 * the heat-equation PDE solver edge cases.
 *
 * NOTE on coverage ceiling: the WASM-accelerated `if (wasm) { ... }` blocks in
 * leastSquares/bezierCurve/loess/griddata/rbfInterpolate/solveODESystem/cond/
 * rank are dead in this environment because no Rust WASM module is loaded
 * (`wasmLoader.getModule()` returns undefined on Node without the wasm-rust
 * toolchain — see CLAUDE.md "WASM JS-fallback on Node"). Those branches are
 * intentionally uncoverable here; all such inputs therefore take the JS path,
 * which we assert below.
 */

import { describe, it, expect } from 'vitest';
import {
  findRoot,
  linsolve,
  minimize,
  globalMinimize,
  leastSquares,
  interpolate,
  pchip,
  bezierCurve,
  bspline,
  loess,
  griddata,
  rbfInterpolate,
  curvefit,
  solveODESystem,
  solveBVP,
  odeAdaptiveStep,
  eventDetection,
  cond,
  rank,
  nullspace,
  residue,
  chebyshevApprox,
  padeApproximant,
  quadprog,
  linprog,
  solvePDE,
} from '../src/typed/numeric.js';

const close = (a: number, b: number, tol = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(tol);

// =============================================================================
// Root finding — error + secant branches
// =============================================================================

describe('findRoot edge branches', () => {
  it('throws when endpoints do not bracket a root', () => {
    expect(() => findRoot((x) => x * x + 1, 1, 2)).toThrow(/opposite signs/);
  });

  it('finds a root where the function is linear (forces secant branch)', () => {
    // A straight line keeps fa, fb, fc collinear so the inverse-quadratic
    // guard (fa !== fc && fb !== fc) fails and the secant branch runs.
    const root = findRoot((x) => 2 * x - 4, 0, 10, { tol: 1e-12, maxIter: 200 });
    close(root, 2, 1e-9);
  });

  it('honors maxIter (returns best estimate without converging)', () => {
    const root = findRoot((x) => x * x - 2, 1, 2, { maxIter: 1 });
    expect(Number.isFinite(root)).toBe(true);
  });

  it('uses inverse-quadratic interpolation on a smooth nonlinear root', () => {
    // exp(x) - 2 over [-1, 2] produces three distinct function values
    // (fa !== fc && fb !== fc) after the first iteration, exercising the
    // inverse-quadratic interpolation branch rather than the secant fallback.
    const root = findRoot((x) => Math.exp(x) - 2, -1, 2, { tol: 1e-13, maxIter: 200 });
    close(root, Math.log(2), 1e-9);
    const root2 = findRoot((x) => Math.cos(x) - x, 0, 1, { tol: 1e-13, maxIter: 200 });
    close(Math.cos(root2), root2, 1e-9);
  });
});

// =============================================================================
// linsolve — error paths
// =============================================================================

describe('linsolve error paths', () => {
  it('throws on empty matrix', () => {
    expect(() => linsolve([], [])).toThrow(/empty/);
  });
  it('throws on non-square matrix', () => {
    expect(() => linsolve([[1, 2, 3]], [1])).toThrow(/square/);
  });
  it('throws on dimension mismatch', () => {
    expect(() =>
      linsolve(
        [
          [1, 0],
          [0, 1],
        ],
        [1, 2, 3]
      )
    ).toThrow(/dimension mismatch/);
  });
  it('throws on singular matrix', () => {
    expect(() =>
      linsolve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2]
      )
    ).toThrow(/singular/);
  });
});

// =============================================================================
// minimize / globalMinimize — expansion, contraction, shrink, basin-hopping
// =============================================================================

describe('minimize / globalMinimize', () => {
  it('minimizes a shifted paraboloid', () => {
    const res = minimize((x) => (x[0] - 1) ** 2 + (x[1] + 2) ** 2, [0, 0], { step: 0.5 });
    close(res[0], 1, 1e-3);
    close(res[1], -2, 1e-3);
  });

  it('minimizes Rosenbrock (exercises expansion/contraction/shrink paths)', () => {
    const rosen = (x: number[]) => (1 - x[0]) ** 2 + 100 * (x[1] - x[0] * x[0]) ** 2;
    const res = minimize(rosen, [-1.2, 1], { maxIter: 4000, tol: 1e-10 });
    expect(rosen(res)).toBeLessThan(1e-2);
  });

  it('globalMinimize finds the global basin within bounds', () => {
    // Deterministic 1-D bowl; basin-hopping should land near 3.
    const res = globalMinimize((x) => (x[0] - 3) ** 2, [[-10, 10]], { nHops: 8, maxIter: 200 });
    close(res[0], 3, 1e-2);
  });

  it('minimizes sharp, curved valleys (exercises reflection/contraction paths)', () => {
    // Exercises the harder reflection/expansion/contraction logic on non-smooth
    // and curved landscapes. (NOTE: the final SHRINK branch, lines ~290-294, is
    // effectively dead for continuous objectives because the contraction point
    // xc = centroid + rho*(worst - centroid) lies between the centroid and the
    // worst vertex and is virtually always better than the worst, so the
    // `fc < fValues[n]` guard succeeds and shrink never runs.)
    const valley = (x: number[]) =>
      100 * (x[1] - x[0] * x[0]) ** 2 + (1 - x[0]) ** 2 + Math.abs(x[0] + x[1]);
    const r1 = minimize(valley, [-2, 3], { step: 1.5, maxIter: 5000, tol: 1e-10 });
    expect(valley(r1)).toBeLessThan(valley([-2, 3]));

    const abs = (x: number[]) => Math.abs(x[0] - 1) + Math.abs(x[1] + 1) + Math.abs(x[0] - x[1]);
    const r2 = minimize(abs, [6, -6], { step: 2, maxIter: 5000, tol: 1e-10 });
    expect(abs(r2)).toBeLessThan(abs([6, -6]));
  });
});

// =============================================================================
// leastSquares (JS path) + cond + rank + nullspace
// =============================================================================

describe('leastSquares / cond / rank / nullspace JS paths', () => {
  it('solves an overdetermined system (small => JS path)', () => {
    // Fit y = 2x + 1 through points with a least-squares slope/intercept.
    const A = [
      [0, 1],
      [1, 1],
      [2, 1],
    ];
    const b = [1, 3, 5];
    const x = leastSquares(A, b);
    close(x[0], 2, 1e-9);
    close(x[1], 1, 1e-9);
  });

  it('cond of identity is ~1; cond of near-singular is large', () => {
    close(
      cond([
        [1, 0],
        [0, 1],
      ]),
      1,
      1e-6
    );
    const big = cond([
      [1, 0],
      [0, 1e-6],
    ]);
    expect(big).toBeGreaterThan(100);
  });

  it('cond returns 0 for an empty matrix', () => {
    expect(cond([])).toBe(0);
  });

  it('cond returns Infinity for a singular AtA (inverse iteration throws)', () => {
    expect(cond([[0]])).toBe(Infinity);
  });

  it('rank counts independent rows; 0 for empty', () => {
    expect(rank([])).toBe(0);
    expect(
      rank([
        [1, 2],
        [2, 4],
      ])
    ).toBe(1);
    expect(
      rank([
        [1, 0],
        [0, 1],
      ])
    ).toBe(2);
  });

  it('nullspace returns [] for empty and a basis for rank-deficient', () => {
    expect(nullspace([])).toEqual([]);
    const basis = nullspace([
      [1, 1, 0],
      [0, 0, 1],
    ]);
    // One free variable => one basis vector; A * v ~ 0.
    expect(basis.length).toBe(1);
    const v = basis[0];
    close(v[0] + v[1], 0, 1e-9);
    close(v[2], 0, 1e-9);
  });
});

// =============================================================================
// Interpolation — spline + linear extrapolation + lagrange + pchip
// =============================================================================

describe('interpolation branches', () => {
  it('throws when fewer than 2 points', () => {
    expect(() => interpolate([1], [1])).toThrow(/at least 2/);
  });

  it('linear interp extrapolates below first and above last node', () => {
    const f = interpolate([0, 1, 2], [0, 10, 20], 'linear');
    close(f(-1), -10, 1e-9); // below range
    close(f(3), 30, 1e-9); // above range
    close(f(0.5), 5, 1e-9); // interior
  });

  it('lagrange reproduces the data points', () => {
    const f = interpolate([0, 1, 2], [1, 2, 5], 'lagrange');
    close(f(0), 1, 1e-9);
    close(f(2), 5, 1e-9);
  });

  it('natural cubic spline passes through nodes + clamps outside', () => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 4, 9];
    const f = interpolate(xs, ys, 'spline');
    close(f(0), 0, 1e-9);
    close(f(3), 9, 1e-9);
    // x below the first knot clamps to segment 0; above last clamps to last.
    expect(Number.isFinite(f(-1))).toBe(true);
    expect(Number.isFinite(f(5))).toBe(true);
  });

  it('pchip 2-point + multi-point + monotonicity guard', () => {
    // 2-point branch (n === 2).
    close(pchip([0, 2], [0, 4], 1), 2, 1e-9);
    // multi-point branch with a local extremum to hit the m[i]=0 guard.
    const xs = [0, 1, 2, 3];
    const ys = [0, 1, 1, 0];
    expect(pchip(xs, ys, 0)).toBeCloseTo(0, 9);
    expect(pchip(xs, ys, 3)).toBeCloseTo(0, 9);
    // query below first and above last node (idx clamping)
    expect(Number.isFinite(pchip(xs, ys, -1))).toBe(true);
    expect(Number.isFinite(pchip(xs, ys, 4))).toBe(true);
  });

  it('pchip throws with fewer than 2 points', () => {
    expect(() => pchip([0], [0], 0)).toThrow(/at least 2/);
  });
});

// =============================================================================
// Bezier / B-spline
// =============================================================================

describe('bezier / bspline', () => {
  it('bezierCurve throws on empty control points', () => {
    expect(() => bezierCurve([], 0.5)).toThrow(/at least 1/);
  });
  it('bezierCurve midpoint of a straight segment', () => {
    const p = bezierCurve(
      [
        [0, 0],
        [2, 4],
      ],
      0.5
    );
    close(p[0], 1, 1e-9);
    close(p[1], 2, 1e-9);
  });
  it('bspline throws when degree >= control point count', () => {
    expect(() =>
      bspline(
        [
          [0, 0],
          [1, 1],
        ],
        2,
        0.5
      )
    ).toThrow(/more control points/);
  });
  it('bspline evaluates a clamped curve at the endpoints', () => {
    const cp = [
      [0, 0],
      [1, 2],
      [2, 0],
      [3, 2],
    ];
    const start = bspline(cp, 2, 0);
    close(start[0], 0, 1e-9);
    close(start[1], 0, 1e-9);
    const mid = bspline(cp, 2, 0.5);
    expect(Number.isFinite(mid[0])).toBe(true);
  });
});

// =============================================================================
// loess / griddata / rbfInterpolate (small inputs => JS path)
// =============================================================================

describe('scattered-data interpolation JS paths', () => {
  it('loess smooths a noisy line (det>0 weighted regression)', () => {
    const xs = Array.from({ length: 10 }, (_, i) => i);
    const ys = xs.map((x) => 2 * x + 1);
    const y = loess(xs, ys, 4.5, 0.6);
    close(y, 2 * 4.5 + 1, 0.5);
  });

  it('loess falls back to weighted mean when det ~ 0 (single distinct x)', () => {
    // All neighbors at the same x make the regression matrix singular,
    // forcing the `Math.abs(det) < 1e-15` early return (weighted mean).
    const xs = [5, 5, 5, 5];
    const ys = [1, 2, 3, 4];
    const y = loess(xs, ys, 5, 0.9);
    expect(Number.isFinite(y)).toBe(true);
  });

  it('griddata IDW reproduces values at exact sample locations + interpolates between', () => {
    const points = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const values = [0, 1, 1, 2];
    const grid = griddata(points, values, [0, 1], [0, 1]);
    // Exact hit at (0,0) returns its value; (1,1) too.
    close(grid[0][0], 0, 1e-9);
    close(grid[1][1], 2, 1e-9);
    // Interior query is a finite blend.
    const mid = griddata(points, values, [0.5], [0.5]);
    expect(Number.isFinite(mid[0][0])).toBe(true);
  });

  it('rbfInterpolate reproduces samples for all three kernels (JS path)', () => {
    const points = [[0], [1], [2], [3]];
    const values = [0, 1, 4, 9];
    const xi = [[1], [2]];
    for (const kernel of ['gaussian', 'multiquadric', 'thinplate'] as const) {
      const out = rbfInterpolate(points, values, xi, kernel);
      expect(out.length).toBe(2);
      close(out[0], 1, 1e-3);
      close(out[1], 4, 1e-3);
    }
  });
});

// =============================================================================
// curvefit — Levenberg-Marquardt
// =============================================================================

describe('curvefit', () => {
  it('recovers parameters of y = a*exp(b*x)', () => {
    const a = 2.5;
    const b = -0.4;
    const xs = Array.from({ length: 15 }, (_, i) => i * 0.3);
    const ys = xs.map((x) => a * Math.exp(b * x));
    const [fa, fb] = curvefit((x, p) => p[0] * Math.exp(p[1] * x), xs, ys, [1, -0.1]);
    close(fa, a, 1e-2);
    close(fb, b, 1e-2);
  });

  it('rejects overshooting steps then converges (lambda-increase branch)', () => {
    // A stiff sinusoidal model fit from a far, wrong frequency guess causes the
    // first Levenberg-Marquardt steps to INCREASE the cost; those steps are
    // rejected and lambda is multiplied by 10 (the else branch) until the
    // trust region shrinks enough to make progress.
    const xs = Array.from({ length: 20 }, (_, i) => i * 0.25);
    const ys = xs.map((x) => 3 * Math.sin(1.5 * x + 0.5));
    const model = (x: number, p: number[]) => p[0] * Math.sin(p[1] * x + p[2]);
    const out = curvefit(model, xs, ys, [1, 0.2, 0]);
    expect(out.length).toBe(3);
    // Fit should reduce the residual substantially from the initial guess.
    const ssr = (p: number[]) => xs.reduce((s, x, i) => s + (ys[i] - model(x, p)) ** 2, 0);
    expect(ssr(out)).toBeLessThan(ssr([1, 0.2, 0]));
  });
});

// =============================================================================
// ODE solvers — system, BVP, adaptive step, event detection
// =============================================================================

describe('ODE solvers', () => {
  it('solveODESystem integrates exponential decay (JS path, n<4)', () => {
    const sol = solveODESystem((_t, y) => [-y[0]], [1], [0, 1], { dt: 0.01 });
    const yEnd = sol.y[sol.y.length - 1][0];
    close(yEnd, Math.exp(-1), 1e-3);
  });

  it('solveODESystem with n>=4 (WASM path attempts, falls through to JS)', () => {
    // 4 state variables triggers the `n >= 4` WASM branch; with no module the
    // try/getModule short-circuits and the JS combination runs.
    const sol = solveODESystem((_t, y) => y.map((v) => -v), [1, 2, 3, 4], [0, 0.5], { dt: 0.05 });
    const last = sol.y[sol.y.length - 1];
    close(last[0], Math.exp(-0.5), 1e-2);
    close(last[3], 4 * Math.exp(-0.5), 1e-1);
  });

  it('solveBVP solves y\'\' = 0 with y(0)=0, y(1)=1 via shooting', () => {
    // State: [y, y']; f = [y', 0]. BC residual: [y0 - 0, yf - 1].
    const sol = solveBVP(
      (_t, y) => [y[1], 0],
      (y0, yf) => [y0[0] - 0, yf[0] - 1],
      [0, 1]
    );
    const last = sol.y[sol.y.length - 1];
    close(last[0], 1, 1e-3);
  });

  it('solveBVP tolerates a singular shooting Jacobian (catch -> break)', () => {
    // If the boundary residual does not depend on the shooting parameters, the
    // numerical Jacobian is singular and linsolve throws; solveBVP catches it
    // and breaks, still returning a valid integrated solution.
    const sol = solveBVP(
      (_t, y) => [y[1], 0],
      () => [1, 1], // nonzero residual independent of guess => singular Jacobian
      [0, 1]
    );
    expect(sol.y.length).toBeGreaterThan(0);
  });

  it('odeAdaptiveStep returns updated state, time, and step size', () => {
    const r = odeAdaptiveStep((_t, y) => [-y[0]], [1], 0, 0.1);
    close(r.y[0], Math.exp(-0.1), 1e-4);
    close(r.t, 0.1, 1e-12);
    expect(r.h).toBeGreaterThan(0);
  });

  it('eventDetection stops when the event crosses zero (bisection branch)', () => {
    // Projectile: y'' = -1; event = height crosses zero on the way down.
    const sol = eventDetection(
      (_t, y) => [y[1], -1],
      [0, 1], // start at ground moving up
      [0, 5],
      (_t, y) => y[0] // event when height returns to 0
    );
    expect(sol.eventTime).toBeDefined();
    close(sol.eventTime as number, 2, 1e-2); // up-and-back takes t=2
  });

  it('eventDetection runs to the end when no crossing occurs', () => {
    const sol = eventDetection(
      (_t, y) => [y[1], 0],
      [0, 1],
      [0, 1],
      () => 1 // never crosses zero
    );
    expect(sol.eventTime).toBeUndefined();
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(1, 6);
  });
});

// =============================================================================
// residue / chebyshevApprox / padeApproximant
// =============================================================================

describe('residue / chebyshev / pade', () => {
  it('residue computes residues at the poles of P/Q', () => {
    // Q(x) = (x-1)(x-2) = 2 - 3x + x^2; P(x) = 1.
    // Residue at x=1: 1/Q'(1) = 1/(2*1-3) = -1; at x=2: 1/(2*2-3)=1.
    const { residues, poles } = residue([1], [2, -3, 1]);
    expect(poles.length).toBe(2);
    const sorted = poles
      .map((p, i) => ({ p, r: residues[i] }))
      .sort((a, b) => a.p - b.p);
    close(sorted[0].p, 1, 1e-4);
    close(sorted[1].p, 2, 1e-4);
    close(sorted[0].r, -1, 1e-3);
    close(sorted[1].r, 1, 1e-3);
  });

  it('chebyshevApprox approximates sin on an interval', () => {
    const approx = chebyshevApprox(Math.sin, 0, Math.PI, 16);
    close(approx(1), Math.sin(1), 1e-6);
    close(approx(2.5), Math.sin(2.5), 1e-6);
  });

  it('padeApproximant of exp Taylor reproduces exp near 0', () => {
    // Taylor coeffs of e^x: 1, 1, 1/2, 1/6, 1/24, ...
    const taylor = [1, 1, 1 / 2, 1 / 6, 1 / 24, 1 / 120];
    const { num, den } = padeApproximant(taylor, 2, 2);
    const evalPoly = (c: number[], x: number) =>
      c.reduce((s, ci, i) => s + ci * x ** i, 0);
    const x = 0.3;
    const approx = evalPoly(num, x) / evalPoly(den, x);
    close(approx, Math.exp(x), 1e-4);
  });

  it('padeApproximant with n=0 returns the truncated numerator and den=[1]', () => {
    const { num, den } = padeApproximant([1, 2, 3, 4], 2, 0);
    expect(den).toEqual([1]);
    expect(num).toEqual([1, 2, 3]);
  });

  it('padeApproximant tolerates a singular denominator system (catch -> b=0)', () => {
    // All-zero Taylor tail makes the denominator linear system singular, so
    // linsolve throws and the catch sets b = 0 (den = [1, 0, ...]).
    const { num, den } = padeApproximant([1, 0, 0, 0, 0], 2, 2);
    expect(den[0]).toBe(1);
    expect(num.length).toBe(3);
  });
});

// =============================================================================
// quadprog / linprog
// =============================================================================

describe('quadprog / linprog', () => {
  it('quadprog minimizes a constrained quadratic', () => {
    // minimize 0.5*(x0^2 + x1^2) - x0 - x1 subject to x0 + x1 <= 1.
    const H = [
      [1, 0],
      [0, 1],
    ];
    const f = [-1, -1];
    const A = [[1, 1]];
    const b = [1];
    const x = quadprog(H, f, A, b);
    // Constrained optimum lies on x0 + x1 = 1, symmetric => (0.5, 0.5).
    close(x[0], 0.5, 1e-2);
    close(x[1], 0.5, 1e-2);
  });

  it('linprog solves a standard maximization-as-minimization LP', () => {
    // maximize x0 + x1 (minimize -x0 - x1) s.t. x0<=4, x1<=3, x0,x1>=0.
    const x = linprog(
      [-1, -1],
      [
        [1, 0],
        [0, 1],
      ],
      [4, 3]
    );
    expect(x).not.toBeNull();
    close((x as number[])[0], 4, 1e-6);
    close((x as number[])[1], 3, 1e-6);
  });

  it('linprog returns null for an unbounded problem', () => {
    // minimize -x0 with the only constraint not bounding x0 from above.
    const x = linprog([-1], [[0]], [5]);
    expect(x).toBeNull();
  });
});

// =============================================================================
// solvePDE — heat equation
// =============================================================================

describe('solvePDE (heat equation)', () => {
  it('diffuses an initial bump toward the boundary values (stable r)', () => {
    const res = solvePDE(
      { alpha: 0.1 },
      { L: 1, nx: 11, nt: 100, T: 0.1 },
      { left: 0, right: 0, initial: (x) => Math.sin(Math.PI * x) }
    );
    expect(res.x.length).toBe(11);
    expect(res.u.length).toBe(11);
    // Boundaries pinned to zero.
    close(res.u[0], 0, 1e-12);
    close(res.u[10], 0, 1e-12);
    // Interior decayed but stays positive for a sine bump.
    expect(res.u[5]).toBeGreaterThan(0);
    expect(res.u[5]).toBeLessThan(1);
  });

  it('still computes when r > 0.5 (CFL branch taken, no throw)', () => {
    const res = solvePDE(
      { alpha: 1 },
      { L: 1, nx: 11, nt: 5, T: 1 },
      { left: 0, right: 0, initial: () => 1 }
    );
    expect(res.u.length).toBe(11);
  });
});

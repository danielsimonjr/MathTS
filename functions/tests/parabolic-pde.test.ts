/**
 * Tests for `solveParabolicPDE` — general 1-D parabolic PDE via method-of-lines
 * onto the BDF stiff solver.
 *
 * Oracles (implementation-independent):
 *  - Exact heat: u_t = D·u_xx, u(x,0)=sin(πx), Dirichlet 0 → u = e^{−Dπ²t}·sin(πx).
 *  - Manufactured reaction-diffusion: pick u=e^{−t}sin(πx), derive source f so the
 *    PDE is satisfied, verify the numeric solution recovers u.
 *  - Neumann insulated ends: u_t=u_xx, u_x=0, u0=cos(πx) → u = e^{−π²t}cos(πx).
 *  - scipy `solve_ivp(method='BDF')` cross-check of the same MOL semi-discretisation
 *    (advection-diffusion), reference value baked in.
 *  - O(h²) spatial convergence (halving h → ~4× error drop).
 */
import { describe, it, expect } from 'vitest';
import { solveParabolicPDE } from '../src/typed/numeric.js';

const PI = Math.PI;

function maxRelErr(numeric: number[], exact: number[]): number {
  let maxAbs = 0;
  let maxDen = 0;
  for (let i = 0; i < exact.length; i++) {
    maxAbs = Math.max(maxAbs, Math.abs(numeric[i] - exact[i]));
    maxDen = Math.max(maxDen, Math.abs(exact[i]));
  }
  return maxAbs / maxDen;
}

/** Exact-heat MOL solution relerr at final time T for a given grid size. */
function heatRelErr(nx: number, T = 0.1, D = 1): number {
  const sol = solveParabolicPDE({
    diffusion: D,
    x0: 0,
    x1: 1,
    T,
    nx,
    u0: (x) => Math.sin(PI * x),
    bcLeft: { type: 'dirichlet', value: 0 },
    bcRight: { type: 'dirichlet', value: 0 },
    tol: 1e-8,
  });
  const last = sol.u[sol.u.length - 1];
  const x = sol.x;
  const exact = x.map((xi) => Math.exp(-D * PI * PI * T) * Math.sin(PI * xi));
  return maxRelErr(last, exact);
}

describe('solveParabolicPDE — exact heat equation', () => {
  it('recovers e^{−Dπ²t} sin(πx) to ~1e-4 on a fine grid', () => {
    const err = heatRelErr(81, 0.1, 1);
    // Spatial 2nd-order truncation dominates (scipy MOL BDF ref: 1.27e-4).
    expect(err).toBeLessThan(3e-4);
  });

  it('boundary and final-time shape are correct', () => {
    const sol = solveParabolicPDE({
      diffusion: 0.5,
      x0: 0,
      x1: 1,
      T: 0.2,
      nx: 41,
      u0: (x) => Math.sin(PI * x),
      bcLeft: { type: 'dirichlet', value: 0 },
      bcRight: { type: 'dirichlet', value: 0 },
    });
    expect(sol.x.length).toBe(41);
    expect(sol.u[0].length).toBe(41);
    // Dirichlet boundary nodes hold their prescribed value at every step.
    for (const row of sol.u) {
      expect(Math.abs(row[0])).toBeLessThan(1e-12);
      expect(Math.abs(row[40])).toBeLessThan(1e-12);
    }
    // Last output time is exactly T.
    expect(sol.t[sol.t.length - 1]).toBeCloseTo(0.2, 12);
  });

  it('exhibits O(h²) spatial convergence (halving h → ~4× error drop)', () => {
    const e41 = heatRelErr(41, 0.1, 1);
    const e81 = heatRelErr(81, 0.1, 1);
    const rate = Math.log2(e41 / e81);
    expect(rate).toBeGreaterThan(1.8);
    expect(rate).toBeLessThan(2.2);
  });
});

describe('solveParabolicPDE — manufactured reaction-diffusion', () => {
  it('recovers u = e^{−t} sin(πx) via the method of manufactured solutions', () => {
    // u_t = D·u_xx + f with D=1, u=e^{−t}sin(πx):
    //   u_t = −e^{−t}sin(πx), u_xx = −π²e^{−t}sin(πx)
    //   f = u_t − u_xx = (π²−1) e^{−t} sin(πx)
    const T = 0.2;
    const sol = solveParabolicPDE({
      diffusion: 1,
      source: (x, t) => (PI * PI - 1) * Math.exp(-t) * Math.sin(PI * x),
      x0: 0,
      x1: 1,
      T,
      nx: 81,
      u0: (x) => Math.sin(PI * x),
      bcLeft: { type: 'dirichlet', value: 0 },
      bcRight: { type: 'dirichlet', value: 0 },
      tol: 1e-9,
    });
    const last = sol.u[sol.u.length - 1];
    const exact = sol.x.map((xi) => Math.exp(-T) * Math.sin(PI * xi));
    const err = maxRelErr(last, exact);
    // scipy MOL BDF reference at nx=81: 1.19e-4.
    expect(err).toBeLessThan(3e-4);
  });

  it('source may depend on u (Fisher-KPP-style logistic reaction runs without error)', () => {
    // u_t = D·u_xx + r·u·(1−u): logistic front. Just exercise the u-dependent source path.
    const sol = solveParabolicPDE({
      diffusion: 0.01,
      source: (_x, _t, u) => 1 * u * (1 - u),
      x0: 0,
      x1: 1,
      T: 0.5,
      nx: 41,
      u0: (x) => (x < 0.5 ? 1 : 0),
      bcLeft: { type: 'dirichlet', value: 1 },
      bcRight: { type: 'dirichlet', value: 0 },
    });
    const last = sol.u[sol.u.length - 1];
    // Solution stays bounded in [0,1] (a physical invariant of KPP).
    for (const v of last) {
      expect(v).toBeGreaterThan(-0.05);
      expect(v).toBeLessThan(1.05);
    }
  });
});

describe('solveParabolicPDE — Neumann boundaries', () => {
  it('insulated ends recover e^{−π²t} cos(πx) to ~1e-4', () => {
    const T = 0.1;
    const sol = solveParabolicPDE({
      diffusion: 1,
      x0: 0,
      x1: 1,
      T,
      nx: 81,
      u0: (x) => Math.cos(PI * x),
      bcLeft: { type: 'neumann', value: 0 },
      bcRight: { type: 'neumann', value: 0 },
      tol: 1e-9,
    });
    const last = sol.u[sol.u.length - 1];
    const exact = sol.x.map((xi) => Math.exp(-PI * PI * T) * Math.cos(PI * xi));
    const err = maxRelErr(last, exact);
    // scipy MOL BDF reference at nx=81: 1.27e-4.
    expect(err).toBeLessThan(3e-4);
  });
});

describe('solveParabolicPDE — scipy MOL/BDF cross-check', () => {
  it('advection-diffusion matches scipy solve_ivp(method=BDF) on the same MOL scheme', () => {
    // u_t = 0.1·u_xx − 0.5·u_x, Dirichlet u(0)=1, u(1)=0, u0=0, T=1, nx=41.
    const sol = solveParabolicPDE({
      diffusion: 0.1,
      advection: -0.5,
      x0: 0,
      x1: 1,
      T: 1,
      nx: 41,
      u0: () => 0,
      bcLeft: { type: 'dirichlet', value: 1 },
      bcRight: { type: 'dirichlet', value: 0 },
      tol: 1e-9,
    });
    const last = sol.u[sol.u.length - 1];
    // scipy reference values at the same nodes (identical semi-discretisation).
    const scipyRef = {
      10: 0.8749779406676574,
      20: 0.6525777630931484,
      30: 0.3780722363589587,
    };
    for (const [k, ref] of Object.entries(scipyRef)) {
      expect(Math.abs(last[Number(k)] - ref)).toBeLessThan(1e-4);
    }
  });

  it('output at requested `times` matches solver interpolation and exact boundary data', () => {
    const sol = solveParabolicPDE({
      diffusion: 1,
      x0: 0,
      x1: 1,
      T: 0.1,
      nx: 41,
      u0: (x) => Math.sin(PI * x),
      bcLeft: { type: 'dirichlet', value: 0 },
      bcRight: { type: 'dirichlet', value: 0 },
      times: [0, 0.05, 0.1],
      tol: 1e-8,
    });
    expect(sol.t).toEqual([0, 0.05, 0.1]);
    expect(sol.u.length).toBe(3);
    // t=0 recovers the initial condition.
    const ic = sol.x.map((xi) => Math.sin(PI * xi));
    expect(maxRelErr(sol.u[0], ic)).toBeLessThan(1e-12);
    // t=0.1 recovers the exact heat solution.
    const exact = sol.x.map((xi) => Math.exp(-PI * PI * 0.1) * Math.sin(PI * xi));
    expect(maxRelErr(sol.u[2], exact)).toBeLessThan(1e-3);
  });
});

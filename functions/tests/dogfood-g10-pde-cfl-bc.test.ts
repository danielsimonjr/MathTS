/**
 * Dogfood G10 — #822 solvePDE CFL, #833 solveParabolicPDE BC shape.
 */
import { describe, expect, it } from 'vitest';
import { solvePDE, solveParabolicPDE } from '../src/typed/numeric.js';

describe('dogfood G10 — solvePDE CFL (#822)', () => {
  it('exact issue repro: r>0.5 throws RangeError naming CFL', () => {
    expect(() =>
      solvePDE(
        { alpha: 1 },
        { L: 1, nx: 21, nt: 5, T: 1 },
        { initial: (x) => Math.sin(Math.PI * x), left: 0, right: 0 }
      )
    ).toThrow(RangeError);
    try {
      solvePDE(
        { alpha: 1 },
        { L: 1, nx: 21, nt: 5, T: 1 },
        { initial: (x) => Math.sin(Math.PI * x), left: 0, right: 0 }
      );
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/CFL/i);
      expect(msg).toMatch(/0\.5/);
      expect(msg).toMatch(/r=\d+/);
      expect(parseFloat(msg.match(/r=([\d.eE+-]+)/)?.[1] ?? '0')).toBeGreaterThan(0.5);
    }
  });

  it('stable explicit step (r ≤ 0.5) returns a finite field', () => {
    const result = solvePDE(
      { alpha: 0.01 },
      { L: 1, nx: 21, nt: 100, T: 0.5 },
      { left: 0, right: 0, initial: (x) => Math.sin(Math.PI * x) }
    );
    expect(result.u.every(Number.isFinite)).toBe(true);
    const dx = 1 / 20;
    const dt = 0.5 / 100;
    const r = (0.01 * dt) / (dx * dx);
    expect(r).toBeLessThanOrEqual(0.5);
    expect(result.u[10]).toBeGreaterThan(0);
    expect(result.u[10]).toBeLessThan(1);
  });

  it('at CFL boundary r = 0.5 still integrates', () => {
    const alpha = 1;
    const L = 1;
    const nx = 21;
    const dx = L / (nx - 1);
    const dt = (0.5 * dx * dx) / alpha;
    const nt = 4;
    const T = dt * nt;
    const r = (alpha * dt) / (dx * dx);
    expect(r).toBeCloseTo(0.5, 12);

    const result = solvePDE(
      { alpha },
      { L, nx, nt, T },
      { left: 0, right: 0, initial: (x) => Math.sin(Math.PI * x) }
    );
    expect(result.u.every(Number.isFinite)).toBe(true);
  });

  it('allowUnstable opts in runs when r > 0.5', () => {
    const result = solvePDE(
      { alpha: 1 },
      { L: 1, nx: 21, nt: 5, T: 1 },
      { left: 0, right: 0, initial: () => 1 },
      { allowUnstable: true }
    );
    expect(result.u.length).toBe(21);
  });
});

describe('dogfood G10 — solveParabolicPDE BC (#833)', () => {
  it('bcLeft: 0 throws TypeError naming { type, value } before BDF', () => {
    expect(() =>
      solveParabolicPDE({
        x0: 0,
        x1: 1,
        T: 0.05,
        nx: 21,
        u0: (x) => Math.sin(Math.PI * x),
        bcLeft: 0 as unknown as { type: 'dirichlet'; value: 0 },
        bcRight: { type: 'dirichlet', value: 0 },
        diffusion: 1,
      })
    ).toThrow(TypeError);
    try {
      solveParabolicPDE({
        x0: 0,
        x1: 1,
        T: 0.05,
        nx: 21,
        u0: (x) => Math.sin(Math.PI * x),
        bcLeft: 0 as unknown as { type: 'dirichlet'; value: 0 },
        bcRight: { type: 'dirichlet', value: 0 },
        diffusion: 1,
      });
    } catch (e) {
      expect((e as Error).message).toMatch(/bcLeft/);
      expect((e as Error).message).toMatch(/dirichlet|neumann/);
      expect((e as Error).message).toMatch(/type/);
      expect((e as Error).message).toMatch(/value/);
    }
  });

  it('bcRight number throws TypeError naming bcRight', () => {
    expect(() =>
      solveParabolicPDE({
        diffusion: 1,
        x0: 0,
        x1: 1,
        T: 0.05,
        nx: 21,
        u0: (x) => Math.sin(Math.PI * x),
        bcLeft: { type: 'dirichlet', value: 0 },
        bcRight: 0 as unknown as { type: 'dirichlet'; value: 0 },
      })
    ).toThrow(/bcRight/);
  });

  it('valid Dirichlet BC matches closed-form heat solution at T=0.05', () => {
    const r = solveParabolicPDE({
      x0: 0,
      x1: 1,
      T: 0.05,
      nx: 21,
      u0: (x) => Math.sin(Math.PI * x),
      bcLeft: { type: 'dirichlet', value: 0 },
      bcRight: { type: 'dirichlet', value: 0 },
      diffusion: 1,
    });
    const tFinal = r.t.at(-1)!;
    const uMid = r.u.at(-1)![10];
    const exact = Math.exp(-(Math.PI ** 2) * tFinal) * Math.sin(Math.PI * 0.5);
    expect(Math.abs(uMid - exact)).toBeLessThan(0.001);
  });
});

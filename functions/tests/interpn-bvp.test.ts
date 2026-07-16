import { describe, it, expect } from 'vitest';
import { interpn, solveBVP } from '../src/index.js';

describe('interpn (regular-grid interpolation)', () => {
  it('bilinear is exact on f=x+y', () => {
    const xs = [0, 1, 2],
      ys = [0, 1, 2];
    const vals = xs.map((x) => ys.map((y) => x + y));
    const out = interpn([xs, ys], vals, [
      [0.5, 0.5],
      [1.5, 0.25],
    ]);
    expect(out[0]).toBeCloseTo(1.0, 8);
    expect(out[1]).toBeCloseTo(1.75, 8);
  });

  it('bilinear reproduces grid node values exactly', () => {
    const xs = [0, 1, 2],
      ys = [0, 2, 4];
    const vals = xs.map((x) => ys.map((y) => x * y));
    expect(interpn([xs, ys], vals, [[1, 2]])[0]).toBeCloseTo(2, 8);
  });

  it('1-D interpolation works too', () => {
    // grids=[[0,1,2]], values=[0,10,20] linear -> at 0.5 -> 5
    const out = interpn([[0, 1, 2]], [0, 10, 20], [[0.5]]);
    expect(out[0]).toBeCloseTo(5, 8);
  });

  it('3-D trilinear interpolation is exact on a linear function', () => {
    const xs = [0, 1, 2],
      ys = [0, 1, 2],
      zs = [0, 1, 2];
    const vals: number[][][] = xs.map((x) => ys.map((y) => zs.map((z) => x + 2 * y + 3 * z)));
    const out = interpn([xs, ys, zs], vals, [
      [0.5, 0.5, 0.5],
      [1.25, 0.75, 0.25],
    ]);
    expect(out[0]).toBeCloseTo(0.5 + 2 * 0.5 + 3 * 0.5, 8);
    expect(out[1]).toBeCloseTo(1.25 + 2 * 0.75 + 3 * 0.25, 8);
  });

  it('throws a clear error on an out-of-bounds query', () => {
    const xs = [0, 1, 2],
      ys = [0, 1, 2];
    const vals = xs.map((x) => ys.map((y) => x + y));
    expect(() => interpn([xs, ys], vals, [[3, 0.5]])).toThrow(/out of bounds/i);
  });

  it('throws on a non-increasing grid axis', () => {
    expect(() => interpn([[1, 0, 2]], [0, 10, 20], [[0.5]])).toThrow(/strictly increasing/i);
  });
});

describe('solveBVP (regression pin)', () => {
  it("solves y'' = -y, y(0)=0, y(pi/2)=1 -> y=sin(x)", () => {
    // State: [y, y']; f = [y', -y]. BC residual: [y0 - 0, yf - 1].
    const sol = solveBVP(
      (_t, y) => [y[1], -y[0]],
      (y0, yf) => [y0[0] - 0, yf[0] - 1],
      [0, Math.PI / 2]
    );
    const last = sol.y[sol.y.length - 1];
    expect(last[0]).toBeCloseTo(1, 3);
    // Mid-mesh check against the exact sin(x) solution.
    const midIdx = Math.floor(sol.t.length / 2);
    expect(sol.y[midIdx][0]).toBeCloseTo(Math.sin(sol.t[midIdx]), 2);
  });

  it('generalizes beyond the 2-state case via an explicit y0Guess (3-state decoupled system)', () => {
    // y1' = -y1, y2' = -2*y2, y3' = -3*y3 on [0,1]; exact solution
    // y_i(t) = exp(-i*t). BCs: y1(0)=1 (start-only), y2(1)=exp(-2) (end-only),
    // y3(0)+y3(1)=1+exp(-3) (mixed, exercising a residual that depends on
    // both endpoints for a state beyond the hardcoded n=2).
    const sol = solveBVP(
      (_t, y) => [-y[0], -2 * y[1], -3 * y[2]],
      (y0, yf) => [y0[0] - 1, yf[1] - Math.exp(-2), y0[2] + yf[2] - (1 + Math.exp(-3))],
      [0, 1],
      [0, 0, 0]
    );
    const last = sol.y[sol.y.length - 1];
    expect(last[0]).toBeCloseTo(Math.exp(-1), 3);
    expect(last[1]).toBeCloseTo(Math.exp(-2), 3);
    expect(last[2]).toBeCloseTo(Math.exp(-3), 3);
  });
});

/**
 * `solveODESystem` with a fixed `dt` takes `span/dt` steps when that quotient is an integer up
 * to rounding, and `ceil(span/dt)` otherwise. Found by the Universal-Physics-Tensor deep dive of
 * 2026-10-15: `dt = 1e-3/1000` over `[0, 1e-3]` gave `span/dt = 1000.0000000000001`, so `ceil`
 * took 1001 steps of `span/1001` and returned 1002 states.
 */
import { describe, expect, it } from 'vitest';
import { solveODESystem } from '../src/index.js';

const decay = (_t: number, y: number[]): number[] => [-y[0]];

describe('solveODESystem fixed-step count', () => {
  it('takes exactly n steps when span/dt is n up to rounding', () => {
    // 1e-3 / (1e-3 / 1000) is 1000.0000000000001 and 1e-3 / (1e-3 / 4000) is 4000.0000000000005.
    for (const n of [1000, 4000]) {
      const r = solveODESystem(decay, [1], [0, 1e-3], { dt: 1e-3 / n });
      expect(r.t.length).toBe(n + 1);
      expect(r.y.length).toBe(n + 1);
      expect(r.t[n]).toBe(1e-3);
      // Every step is span/n: the RK4 result is exp(-1e-3) to the method's order.
      expect(r.y[n][0]).toBeCloseTo(Math.exp(-1e-3), 14);
    }
  });

  it("an exactly integer quotient keeps that count and ends at span's end", () => {
    const r = solveODESystem(decay, [1], [0, 1], { dt: 0.1 }); // 1 / 0.1 is exactly 10
    expect(r.t.length).toBe(11);
    expect(r.t[10]).toBe(1);
  });

  it('a genuinely non-integer span/dt still rounds the count up', () => {
    // 1 / 0.3 = 3.33…: four steps of 0.25.
    const r = solveODESystem(decay, [1], [0, 1], { dt: 0.3 });
    expect(r.t.length).toBe(5);
    expect(r.t[1]).toBe(0.25);
    expect(r.t[4]).toBe(1);
    // 1 / (0.1 * (1 + 1e-12)) is 10 − 1e-11: far outside rounding, so ceil's 10 stands,
    // and 1 / (0.1 * (1 − 1e-12)) is 10 + 1e-11, so ceil's 11 stands.
    expect(solveODESystem(decay, [1], [0, 1], { dt: 0.1 * (1 + 1e-12) }).t.length).toBe(11);
    expect(solveODESystem(decay, [1], [0, 1], { dt: 0.1 * (1 - 1e-12) }).t.length).toBe(12);
  });
});

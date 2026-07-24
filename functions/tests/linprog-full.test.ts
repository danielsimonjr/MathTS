import { describe, it, expect } from 'vitest';
import { linprog } from '../src/index.js';

describe('linprog — two-phase (equality, bounds, status)', () => {
  it('legacy positional signature unchanged -> [1,0]', () => {
    const x = linprog([-1, -1], [[1, 1]], [1]) as number[];
    expect(x[0]).toBeCloseTo(1, 6);
    expect(x[1]).toBeCloseTo(0, 6);
  });
  it('equality: x-y=1, x+y<=4 -> [2.5,1.5], fun=-4', () => {
    const r = linprog([-1, -1], { A_ub: [[1, 1]], b_ub: [4], A_eq: [[1, -1]], b_eq: [1] }) as {
      x: number[];
      fun: number;
      success: boolean;
      status: string;
    };
    expect(r.status).toBe('optimal');
    expect(r.x[0]).toBeCloseTo(2.5, 5);
    expect(r.x[1]).toBeCloseTo(1.5, 5);
    expect(r.fun).toBeCloseTo(-4, 5);
    expect(r.success).toBe(true);
  });
  it('infeasible -> status infeasible', () => {
    const r = linprog([1], { A_ub: [[1], [-1]], b_ub: [1, -3] }) as {
      success: boolean;
      status: string;
    };
    expect(r.status).toBe('infeasible');
    expect(r.success).toBe(false);
  });
  it('bounds: min -x with x in [0,5] -> x=5', () => {
    const r = linprog([-1], { bounds: [[0, 5]] }) as { x: number[]; status: string };
    expect(r.x[0]).toBeCloseTo(5, 5);
  });
});

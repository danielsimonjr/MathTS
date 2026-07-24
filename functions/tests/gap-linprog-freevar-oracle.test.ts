import { describe, it, expect } from 'vitest';
import { linprog } from '../src/index.js';

/**
 * Pinned oracle: scipy 1.17.1
 *
 *   from scipy.optimize import linprog
 *   linprog(c=[1, 0], A_ub=[[0, 1]], b_ub=[3], A_eq=[[1, 1]], b_eq=[1],
 *           bounds=[(None, None), (0, None)])
 *   # success=True, fun=-2.0, x=[-2.0, 3.0]
 *
 *   linprog(c=[1, 0], A_ub=[[0, 1]], b_ub=[3], A_eq=[[1, 1]], b_eq=[1],
 *           bounds=[(0, None), (0, None)])
 *   # success=True, fun=0.0
 *
 * The free variable x0 (bounds lower=null) is negative at the optimum of the
 * first problem — only reachable via the "split into x+/x-" free-variable
 * path in linprogTwoPhase. The second (default x>=0 bounds) problem is the
 * same A_ub/A_eq/b_ub/b_eq but cannot reach that optimum, giving fun=0
 * instead — proving the free-variable path actually changes the feasible
 * region/result rather than being a no-op.
 */
describe('linprog — free-variable (lower=null) bounds path (scipy-pinned)', () => {
  it('free x0 reaches the negative optimum fun=-2, x=[-2,3]', () => {
    const r = linprog([1, 0], {
      A_ub: [[0, 1]],
      b_ub: [3],
      A_eq: [[1, 1]],
      b_eq: [1],
      bounds: [
        [null, null],
        [0, null],
      ],
    }) as { x: number[]; fun: number; success: boolean; status: string };

    expect(r.status).toBe('optimal');
    expect(r.success).toBe(true);
    expect(r.fun).toBeCloseTo(-2, 6);
    expect(r.x[0]).toBeCloseTo(-2, 6);
    expect(r.x[1]).toBeCloseTo(3, 6);
  });

  it('contrast: default bounds (x>=0) on the same constraints gives fun=0', () => {
    const r = linprog([1, 0], {
      A_ub: [[0, 1]],
      b_ub: [3],
      A_eq: [[1, 1]],
      b_eq: [1],
      bounds: [
        [0, null],
        [0, null],
      ],
    }) as { x: number[]; fun: number; success: boolean; status: string };

    expect(r.status).toBe('optimal');
    expect(r.success).toBe(true);
    expect(r.fun).toBeCloseTo(0, 6);
  });
});

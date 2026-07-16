import { describe, it, expect } from 'vitest';
import { linprog } from '../src/index.js';

const feasibleUb = (x: number[], A: number[][], b: number[]) =>
  A.every((row, i) => row.reduce((s, aij, j) => s + aij * x[j], 0) <= b[i] + 1e-9);
const nonneg = (x: number[]) => x.every((v) => v >= -1e-9);

describe('linprog — feasibility', () => {
  it('degenerate case returns a FEASIBLE optimum (scipy obj = -1)', () => {
    const x = linprog([-1, -1], [[1, 1]], [1]) as number[];
    expect(x).not.toBeNull();
    expect(feasibleUb(x, [[1, 1]], [1])).toBe(true); // was [1,1] (infeasible)
    expect(nonneg(x)).toBe(true);
    expect(-(x[0] + x[1])).toBeCloseTo(-1, 6); // optimal objective value
  });
  it('non-degenerate case unchanged (scipy: x=[1.8,1.4], obj=-8.2)', () => {
    const x = linprog(
      [-3, -2],
      [
        [1, 1],
        [2, 1],
      ],
      [3.2, 5]
    ) as number[];
    expect(x[0]).toBeCloseTo(1.8, 4);
    expect(x[1]).toBeCloseTo(1.4, 4);
    expect(
      feasibleUb(
        x,
        [
          [1, 1],
          [2, 1],
        ],
        [3.2, 5]
      )
    ).toBe(true);
  });
  it('a second degenerate/redundant case stays feasible', () => {
    // maximize x+y (min -x-y) s.t. x+y<=2, x<=1, y<=1  -> optimum x=y=1, feasible
    const x = linprog(
      [-1, -1],
      [
        [1, 1],
        [1, 0],
        [0, 1],
      ],
      [2, 1, 1]
    ) as number[];
    expect(
      feasibleUb(
        x,
        [
          [1, 1],
          [1, 0],
          [0, 1],
        ],
        [2, 1, 1]
      )
    ).toBe(true);
    expect(-(x[0] + x[1])).toBeCloseTo(-2, 6);
  });
});

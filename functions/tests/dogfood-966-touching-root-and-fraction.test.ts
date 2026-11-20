/**
 * #966 items 3 and 8 (fixer findings F3, F4): a touching root of the numeric scan is exact to
 * rounding, and a coefficient reads as a small fraction only when it is that fraction's double.
 */
import { describe, it, expect } from 'vitest';
import { solve } from '../src/typed/cas.js';

const numeric = (expr: string): number[] =>
  solve(expr, 'x', { numeric: true, range: [-3, 3] } as never) as number[];

describe('#966 item 3: touching roots of the numeric scan', () => {
  it('(x^2-1)^2 has the touching roots -1 and 1 to 1e-13', () => {
    const r = numeric('(x^2-1)^2');
    expect(r).toHaveLength(2);
    expect(Math.abs(r[0] + 1)).toBeLessThanOrEqual(1e-13);
    expect(Math.abs(r[1] - 1)).toBeLessThanOrEqual(1e-13);
  });

  it('(x-1)^2*(x+1) has the roots -1 and 1 to 1e-13', () => {
    const r = numeric('(x-1)^2*(x+1)');
    expect(r).toHaveLength(2);
    expect(Math.abs(r[0] + 1)).toBeLessThanOrEqual(1e-13);
    expect(Math.abs(r[1] - 1)).toBeLessThanOrEqual(1e-13);
  });

  it('(x-2)^4 keeps its root 2', () => {
    const r = numeric('(x-2)^4');
    expect(r).toHaveLength(1);
    expect(Math.abs(r[0] - 2)).toBeLessThanOrEqual(1e-13);
  });
});

describe('#966 item 8: a coefficient is a fraction only when it is its double', () => {
  it('x - 0.30000000000000004 keeps its typed root', () => {
    expect(solve('x-0.30000000000000004', 'x')).toEqual([0.30000000000000004]);
  });

  it('3*x - 0.9000000000000001 is not read as 3/10', () => {
    expect(solve('3*x-0.9000000000000001', 'x')).toEqual([0.30000000000000004]);
  });

  it('x/3 - 1 still gives 3, and 3*x - 1 still gives 1/3', () => {
    expect(solve('x/3 - 1', 'x')).toEqual([3]);
    expect(solve('3*x-1', 'x')).toEqual([1 / 3]);
  });
});

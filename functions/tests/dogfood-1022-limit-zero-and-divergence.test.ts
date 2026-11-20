/**
 * #1022 follow-ups: a small constant is not zero in `limit`, and the sampling path sees a slow
 * divergence. Expected values from SymPy `limit` (oracle script of the batch fixer).
 */
import { describe, it, expect } from 'vitest';
import { limit } from '../src/typed/cas.js';

type Dir = 'left' | 'right' | undefined;
const ORACLE: [string, number, Dir, number][] = [
  ['1e-15/x', 0, 'right', Infinity],
  ['1e-20/x^2', 0, undefined, Infinity],
  ['(x^3-1e-30)/x', 0, 'right', -Infinity],
  ['sin(x)/(x-pi)', Math.PI, undefined, -1],
  ['log(x)', 0, 'right', -Infinity],
  ['exp(1/x)', 0, 'right', Infinity],
  ['exp(1/x)', 0, 'left', 0],
  ['-log(x)', 0, 'right', Infinity],
  ['log(x)^2', 0, 'right', Infinity],
  ['log(x)^3', 0, 'right', -Infinity],
  ['1/sqrt(x)', 0, 'right', Infinity],
  ['x^x', 0, 'right', 1],
  ['log(x)/x', 0, 'right', -Infinity],
  ['exp(-1/x)', 0, 'right', 0],
  ['1/log(x)', 0, 'right', 0],
];

describe('#1022 limit: relative zero test and divergence of the samples', () => {
  for (const [expr, at, dir, want] of ORACLE) {
    it(`limit(${expr}, x, ${at}, ${dir ?? 'both'}) = ${want}`, () => {
      const got = limit(expr, 'x', at, dir);
      if (Number.isFinite(want)) expect(Math.abs(got - want)).toBeLessThanOrEqual(1e-9);
      else expect(got).toBe(want);
    });
  }

  it('the two sides of exp(1/x) at 0 disagree (NaN)', () => {
    expect(limit('exp(1/x)', 'x', 0)).toBeNaN();
  });
});

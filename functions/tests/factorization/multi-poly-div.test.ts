import { describe, it, expect } from 'vitest';
import {
  fromTerms,
  mulMP,
  equals,
  type MultiPoly,
} from '../../src/typed/factorization/multi-poly.js';
import { multiExactDivide, fromAlgebraExpr } from '../../src/typed/factorization/multi-poly.js';
const mp = (entries: Array<[number[], number]>): MultiPoly =>
  fromTerms(
    ['x', 'y'],
    entries.map(([e, c]) => [e, BigInt(c)])
  );

describe('multi-poly division + bridge', () => {
  it('divides exactly or returns null', () => {
    const xmy = mp([
      [[1, 0], 1],
      [[0, 1], -1],
    ]); // x - y
    const xpy = mp([
      [[1, 0], 1],
      [[0, 1], 1],
    ]); // x + y
    const prod = mulMP(xmy, xpy); // x^2 - y^2
    expect(equals(multiExactDivide(prod, xmy)!, xpy)).toBe(true);
    // (x^2 - y^2) / (x + 2y) is not exact
    const xp2y = mp([
      [[1, 0], 1],
      [[0, 1], 2],
    ]);
    expect(multiExactDivide(prod, xp2y)).toBeNull();
  });
  it('parses an integer multivariate expression', () => {
    const p = fromAlgebraExpr('x^2 - y^2', ['x', 'y'])!;
    expect(
      equals(
        p,
        mp([
          [[2, 0], 1],
          [[0, 2], -1],
        ])
      )
    ).toBe(true);
    expect(fromAlgebraExpr('0.5*x', ['x', 'y'])).toBeNull(); // non-integer
  });
});

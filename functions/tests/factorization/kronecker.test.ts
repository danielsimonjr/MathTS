import { describe, it, expect } from 'vitest';
import { fromTerms, equals, type MultiPoly } from '../../src/typed/factorization/multi-poly.js';
import {
  substitutionBases,
  substitute,
  backSubstitute,
} from '../../src/typed/factorization/kronecker.js';
import type { IntPoly } from '../../src/typed/factorization/integer-poly.js';
const mp = (entries: Array<[number[], number]>): MultiPoly =>
  fromTerms(
    ['x', 'y'],
    entries.map(([e, c]) => [e, BigInt(c)])
  );

describe('Kronecker substitution', () => {
  it('substitute then back-substitute is identity on a valid poly', () => {
    // x^2 - y^2, deg_x=2 deg_y=2 -> bases [1, 3]; F(x) = x^2 - x^6
    const p = mp([
      [[2, 0], 1],
      [[0, 2], -1],
    ]);
    const bases = substitutionBases(p);
    expect(bases.map(String)).toEqual(['1', '3']);
    const F: IntPoly = substitute(p, bases); // degree 6
    const back = backSubstitute(F, bases, [2, 2], ['x', 'y']);
    expect(back).not.toBeNull();
    expect(equals(back!, p)).toBe(true);
  });
  it('rejects a univariate factor whose back-substitution carries out of range', () => {
    // bases [1,3], degBounds [2,2]: exponent 3 -> [0,1] ok; exponent 9 -> [0,3] deg_y=3>2 -> null
    // Build F with an x^9 term to force an invalid carry.
    // (representing 9 in radix (3,3): 9 = 0 + 3*3 -> [0,3], out of range)
    const bases = [1n, 3n];
    const F: IntPoly = new Array(10).fill(0n);
    F[9] = 1n;
    F[0] = 1n;
    expect(backSubstitute(F, bases, [2, 2], ['x', 'y'])).toBeNull();
  });
});

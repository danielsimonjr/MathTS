import { describe, it, expect } from 'vitest';
import {
  fromTerms,
  addMP,
  mulMP,
  degreeIn,
  totalDegree,
  integerContentMP,
  primitivePartMP,
  equals,
  type MultiPoly,
} from '../../src/typed/factorization/multi-poly.js';
const mp = (entries: Array<[number[], number]>): MultiPoly =>
  fromTerms(
    ['x', 'y'],
    entries.map(([e, c]) => [e, BigInt(c)])
  );

describe('multi-poly core', () => {
  it('adds and multiplies', () => {
    // (x + y)(x - y) = x^2 - y^2
    const a = mp([
      [[1, 0], 1],
      [[0, 1], 1],
    ]);
    const b = mp([
      [[1, 0], 1],
      [[0, 1], -1],
    ]);
    expect(
      equals(
        mulMP(a, b),
        mp([
          [[2, 0], 1],
          [[0, 2], -1],
        ])
      )
    ).toBe(true);
    expect(equals(addMP(a, b), mp([[[1, 0], 2]]))).toBe(true);
  });
  it('degrees', () => {
    const p = mp([
      [[2, 0], 1],
      [[0, 3], 1],
    ]); // x^2 + y^3
    expect(degreeIn(p, 0)).toBe(2);
    expect(degreeIn(p, 1)).toBe(3);
    expect(totalDegree(p)).toBe(3);
  });
  it('content and primitive part', () => {
    const p = mp([
      [[2, 0], 2],
      [[0, 0], -2],
    ]); // 2x^2 - 2
    expect(integerContentMP(p)).toBe(2n);
    expect(
      equals(
        primitivePartMP(p),
        mp([
          [[2, 0], 1],
          [[0, 0], -1],
        ])
      )
    ).toBe(true);
  });
});

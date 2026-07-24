import { describe, it, expect } from 'vitest';
import {
  trim,
  degree,
  lc,
  add,
  sub,
  mul,
  scalarMul,
  equals,
  evaluate,
  content,
  primitivePart,
  bigintGcd,
  type IntPoly,
} from '../../src/typed/factorization/integer-poly.js';

const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('integer-poly core', () => {
  it('trims trailing zeros and reports degree', () => {
    expect(trim(P(1, 2, 0, 0))).toEqual(P(1, 2));
    expect(degree(P(1, 2, 3))).toBe(2);
    expect(degree(P())).toBe(-1);
    expect(lc(P(3, 0, 5))).toBe(5n);
  });
  it('adds and multiplies exactly', () => {
    // (1 + x) + (x) = 1 + 2x ; (1 + x)(1 - x) = 1 - x^2
    expect(add(P(1, 1), P(0, 1))).toEqual(P(1, 2));
    expect(mul(P(1, 1), P(1, -1))).toEqual(P(1, 0, -1));
    expect(sub(P(1, 2), P(1, 1))).toEqual(P(0, 1));
    expect(scalarMul(P(1, 2), 3n)).toEqual(P(3, 6));
  });
  it('evaluates via Horner over bigint', () => {
    // x^3 + 2 at x = 10 -> 1002
    expect(evaluate(P(2, 0, 0, 1), 10n)).toBe(1002n);
  });
  it('computes content and primitive part with positive lc', () => {
    // 6x^2 - 6 -> content 6, primitive x^2 - 1
    expect(content(P(-6, 0, 6))).toBe(6n);
    expect(primitivePart(P(-6, 0, 6))).toEqual(P(-1, 0, 1));
    // -2 - 2x -> primitive part 1 + x (lc positive)
    expect(primitivePart(P(-2, -2))).toEqual(P(1, 1));
    expect(bigintGcd(-12n, 18n)).toBe(6n);
    expect(equals(P(1, 2), P(1, 2, 0))).toBe(true);
  });
});

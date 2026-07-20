import { describe, it, expect } from 'vitest';
import {
  exactDivide,
  derivative,
  polyGcdZ,
  landauMignotte,
  modSymmetric,
  type IntPoly,
} from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);

describe('integer-poly division/gcd/bounds', () => {
  it('divides exactly or returns null', () => {
    // (x^2 - 1) / (x - 1) = x + 1
    expect(exactDivide(P(-1, 0, 1), P(-1, 1))).toEqual(P(1, 1));
    // (x^2 + 1) / (x - 1) -> not exact
    expect(exactDivide(P(1, 0, 1), P(-1, 1))).toBeNull();
  });
  it('derivative', () => {
    // d/dx (x^3 + 2x) = 3x^2 + 2
    expect(derivative(P(0, 2, 0, 1))).toEqual(P(2, 0, 3));
  });
  it('gcd over Z is the primitive common factor', () => {
    // gcd(x^2 - 1, x^2 - 2x + 1) = x - 1
    expect(polyGcdZ(P(-1, 0, 1), P(1, -2, 1))).toEqual(P(-1, 1));
  });
  it('modSymmetric reduces into (-m/2, m/2]', () => {
    // coeffs mod 7 in symmetric range: 5 -> -2, 3 -> 3
    expect(modSymmetric(P(5, 3, 7), 7n)).toEqual(P(-2, 3, 0));
  });
  it('landauMignotte is a positive bound', () => {
    expect(landauMignotte(P(-1, 0, 1)) > 0n).toBe(true);
  });
});

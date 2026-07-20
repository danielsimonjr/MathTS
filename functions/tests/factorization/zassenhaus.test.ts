import { describe, it, expect } from 'vitest';
import { factorUnivariateZ } from '../../src/typed/factorization/zassenhaus.js';
import type { IntPoly } from '../../src/typed/factorization/integer-poly.js';
const P = (...c: number[]): IntPoly => c.map(BigInt);
const shape = (f: ReturnType<typeof factorUnivariateZ>) => ({
  constant: f.constant,
  factors: f.factors.map((e) => ({ poly: e.poly, mult: e.mult })),
});

describe('factorUnivariateZ (Zassenhaus)', () => {
  it('x^4 - 1 = (x-1)(x+1)(x^2+1)', () => {
    // sympy: (1, [(x-1,1),(x+1,1),(x^2+1,1)])
    expect(shape(factorUnivariateZ(P(-1, 0, 0, 0, 1)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-1, 1), mult: 1 },
        { poly: P(1, 1), mult: 1 },
        { poly: P(1, 0, 1), mult: 1 },
      ],
    });
  });
  it('x^4 + 1 is irreducible over Q', () => {
    expect(shape(factorUnivariateZ(P(1, 0, 0, 0, 1)))).toEqual({
      constant: 1n,
      factors: [{ poly: P(1, 0, 0, 0, 1), mult: 1 }],
    });
  });
  it('(x^2+1)(x^2+2) = x^4 + 3x^2 + 2', () => {
    expect(shape(factorUnivariateZ(P(2, 0, 3, 0, 1)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(1, 0, 1), mult: 1 },
        { poly: P(2, 0, 1), mult: 1 },
      ],
    });
  });
  it('6x^2 - 6 = 6(x-1)(x+1)', () => {
    expect(shape(factorUnivariateZ(P(-6, 0, 6)))).toEqual({
      constant: 6n,
      factors: [
        { poly: P(-1, 1), mult: 1 },
        { poly: P(1, 1), mult: 1 },
      ],
    });
  });
  it('(x-1)^3 (x+2): multiplicity preserved', () => {
    // f = (x-1)^3 (x+2) = x^4 - x^3 - 3x^2 + 5x - 2
    expect(shape(factorUnivariateZ(P(-2, 5, -3, -1, 1)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-1, 1), mult: 3 },
        { poly: P(2, 1), mult: 1 },
      ],
    });
  });
  it('x^8+x^6+x^4+x^2+1 = (x^4-x^3+x^2-x+1)(x^4+x^3+x^2+x+1)', () => {
    const r = shape(factorUnivariateZ(P(1, 0, 1, 0, 1, 0, 1, 0, 1)));
    expect(r.factors).toEqual([
      { poly: P(1, -1, 1, -1, 1), mult: 1 },
      { poly: P(1, 1, 1, 1, 1), mult: 1 },
    ]);
  });

  it('4x^2 - 9 = (2x-3)(2x+3)', () => {
    expect(shape(factorUnivariateZ(P(-9, 0, 4)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-3, 2), mult: 1 },
        { poly: P(3, 2), mult: 1 },
      ],
    });
  });
  it('6x^2 + x - 2 = (2x-1)(3x+2)', () => {
    expect(shape(factorUnivariateZ(P(-2, 1, 6)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-1, 2), mult: 1 },
        { poly: P(2, 3), mult: 1 },
      ],
    });
  });
  it('2x^3 - 3x^2 - 3x + 2 = (x-2)(2x-1)(x+1)', () => {
    expect(shape(factorUnivariateZ(P(2, -3, -3, 2)))).toEqual({
      constant: 1n,
      factors: [
        { poly: P(-2, 1), mult: 1 },
        { poly: P(-1, 2), mult: 1 },
        { poly: P(1, 1), mult: 1 },
      ],
    });
  });
});

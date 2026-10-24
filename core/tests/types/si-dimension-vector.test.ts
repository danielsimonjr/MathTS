/**
 * Length-10 Unit exponents ↔ the 7 SI base dimensions.
 *
 * Tuple order is the BIPM / UPT order [L, M, T, I, Θ, N, J].
 */

import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';
import { Fraction, FRACTION_ZERO } from '../../src/types/fraction';
import * as siDim from '../../src/types/si-dimension-vector';
import {
  UNIT_DIMENSION_LENGTH,
  fromSiDimensionVector,
  fromSiDimensions,
  toSiDimensionVector,
  toSiDimensions,
} from '../../src/types/si-dimension-vector';
import { dim } from '../../src/types/unit-definitions';

const ZERO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

function expectSiVector(
  actual: readonly Fraction[],
  expected: readonly (bigint | [bigint, bigint])[]
): void {
  expect(actual).toHaveLength(7);
  for (let i = 0; i < 7; i++) {
    const exp = expected[i];
    const frac = Array.isArray(exp) ? new Fraction(exp[0], exp[1]) : new Fraction(exp, 1n);
    expect(actual[i].equals(frac)).toBe(true);
  }
}

describe('si dimension vector', () => {
  it('maps a metre onto length and [1, 0, 0, 0, 0, 0, 0]', () => {
    const metre = [...ZERO];
    metre[1] = 1;
    expect(toSiDimensions(metre)).toEqual(dim({ length: 1 }));
    expectSiVector(toSiDimensionVector(metre), [1n, 0n, 0n, 0n, 0n, 0n, 0n]);
    expect(UNIT_DIMENSION_LENGTH).toBe(10);
  });

  it('maps a newton (kg·m/s²) onto [L, M, T] = [1, 1, -2]', () => {
    const newton = [...ZERO];
    newton[0] = 1;
    newton[1] = 1;
    newton[2] = -2;
    expectSiVector(toSiDimensionVector(newton), [1n, 1n, -2n, 0n, 0n, 0n, 0n]);
    expect(fromSiDimensionVector([1, 1, -2, 0, 0, 0, 0])).toEqual(newton);
    expect(fromSiDimensionVector(toSiDimensionVector(newton))).toEqual(newton);
  });

  it('round-trips a Dimensions record through the length-10 vector', () => {
    const charge = dim({ current: 1, time: 1 });
    const vector = fromSiDimensions(charge);
    expect(vector).toHaveLength(10);
    expect(toSiDimensions(vector)).toEqual(charge);
    expect(vector[7]).toBe(0);
    expect(vector[8]).toBe(0);
    expect(vector[9]).toBe(0);
    expectSiVector(toSiDimensionVector(vector), [0n, 0n, 1n, 1n, 0n, 0n, 0n]);
  });

  it('reads the exponent vector off a live Unit', () => {
    const newton = new Unit(1, 'N');
    expectSiVector(toSiDimensionVector(newton.dimensions), [1n, 1n, -2n, 0n, 0n, 0n, 0n]);
    const coulomb = new Unit(1, 'C');
    expect(toSiDimensions(coulomb.dimensions)).toEqual(dim({ current: 1, time: 1 }));
  });

  it('throws when angle, bit, or solid angle is nonzero', () => {
    const angle = [...ZERO];
    angle[7] = 1;
    expect(() => toSiDimensions(angle)).toThrow(RangeError);
    expectSiVector(toSiDimensionVector(angle, { ignoreExtra: true }), [0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  });

  it('rejects the wrong length and a non-finite exponent', () => {
    expect(() => toSiDimensions([1, 0, 0])).toThrow(/length 10/);
    expect(() => fromSiDimensionVector([1, 0, 0])).toThrow(/length 7/);
    const bad = [...ZERO];
    bad[1] = Number.NaN;
    expect(() => toSiDimensions(bad)).toThrow(TypeError);
    expect(() => toSiDimensionVector(bad)).toThrow(TypeError);
    const inf = [...ZERO];
    inf[1] = Number.POSITIVE_INFINITY;
    expect(() => toSiDimensionVector(inf)).toThrow(TypeError);
    const ninf = [...ZERO];
    ninf[1] = Number.NEGATIVE_INFINITY;
    expect(() => toSiDimensionVector(ninf)).toThrow(TypeError);
    expect(() => fromSiDimensionVector([Number.NaN, 0, 0, 0, 0, 0, 0])).toThrow(TypeError);
    expect(() => fromSiDimensionVector([Number.POSITIVE_INFINITY, 0, 0, 0, 0, 0, 0])).toThrow(
      TypeError
    );
    expect(() => fromSiDimensionVector([Number.NEGATIVE_INFINITY, 0, 0, 0, 0, 0, 0])).toThrow(
      TypeError
    );
  });

  it('does not export toSiDimensionNumbers (owner override: map via toNumber)', () => {
    expect(Object.hasOwn(siDim, 'toSiDimensionNumbers')).toBe(false);
  });

  it('converts exponents via continued fractions against independent Fraction literals', () => {
    // Oracles are `new Fraction(n, d)` literals, not Fraction.fromNumber(x).
    // 1e-7 = 1/10_000_000 exceeds the default maxDenominator 1_000_000, so the
    // last in-cap convergent is 0/1 (same rule as Fraction.fromNumber).
    const cases: readonly { n: number; num: bigint; den: bigint }[] = [
      { n: 0.5, num: 1n, den: 2n },
      { n: 1 / 3, num: 1n, den: 3n },
      { n: 0.1, num: 1n, den: 10n },
      { n: -1.5, num: -3n, den: 2n },
      { n: 2.25, num: 9n, den: 4n },
      { n: 1e-7, num: 0n, den: 1n },
      { n: 123456.25, num: 493825n, den: 4n },
      { n: 1e20, num: 100000000000000000000n, den: 1n },
    ];
    for (const { n, num, den } of cases) {
      const oracle = new Fraction(num, den);
      const vec = [...ZERO];
      vec[1] = n;
      const [L] = toSiDimensionVector(vec);
      expect(L.equals(oracle)).toBe(true);
      expect(L.numerator).toBe(num);
      expect(L.denominator).toBe(den);
      expect(fromSiDimensionVector([n, 0, 0, 0, 0, 0, 0])[1]).toBe(oracle.toNumber());
    }
  });

  it('accepts Fraction components in fromSiDimensionVector', () => {
    const ten = fromSiDimensionVector([
      new Fraction(1n, 1n),
      new Fraction(1n, 1n),
      new Fraction(-2n, 1n),
      0,
      0,
      0,
      0,
    ]);
    expect(ten[0]).toBe(1);
    expect(ten[1]).toBe(1);
    expect(ten[2]).toBe(-2);
    expect(fromSiDimensionVector([new Fraction(1n, 2n), 0, 0, 0, 0, 0, 0])[1]).toBe(0.5);
  });

  it('normalizes negative zero to a zero Fraction without sign artifacts', () => {
    const vec = [...ZERO];
    vec[1] = -0;
    const [L] = toSiDimensionVector(vec);
    expect(L.numerator).toBe(0n);
    expect(L.denominator).toBe(1n);
    expect(Object.is(L.toNumber(), -0)).toBe(false);
    expect(L.equals(new Fraction(0n, 1n))).toBe(true);
    const ten = fromSiDimensionVector([-0, 0, 0, 0, 0, 0, 0]);
    expect(ten[1]).toBe(0);
    expect(Object.is(ten[1], -0)).toBe(false);
  });

  it('compares derived-unit dimensions via Fraction.equals', () => {
    const pascal = new Unit(1, 'Pa');
    const si = toSiDimensionVector(pascal.dimensions);
    expect(si[0].equals(new Fraction(-1n, 1n))).toBe(true);
    expect(si[1].equals(new Fraction(1n, 1n))).toBe(true);
    expect(si[2].equals(new Fraction(-2n, 1n))).toBe(true);
    for (let i = 3; i < 7; i++) {
      expect(si[i].equals(FRACTION_ZERO)).toBe(true);
    }
  });

  it('maps dimensionless units to seven zero Fractions', () => {
    const one = new Unit(1);
    expectSiVector(toSiDimensionVector(one.dimensions), [0n, 0n, 0n, 0n, 0n, 0n, 0n]);
  });
});

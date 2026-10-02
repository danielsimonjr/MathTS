/**
 * Length-10 Unit exponents ↔ the 7 SI base dimensions.
 *
 * Tuple order is the BIPM / UPT order [L, M, T, I, Θ, N, J].
 */

import { describe, it, expect } from 'vitest';
import { Unit } from '../../src/types/unit';
import {
  UNIT_DIMENSION_LENGTH,
  fromSiDimensionVector,
  fromSiDimensions,
  toSiDimensionVector,
  toSiDimensions,
} from '../../src/types/si-dimension-vector';
import { dim } from '../../src/types/unit-definitions';

const ZERO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

describe('si dimension vector', () => {
  it('maps a metre onto length and [1, 0, 0, 0, 0, 0, 0]', () => {
    const metre = [...ZERO];
    metre[1] = 1;
    expect(toSiDimensions(metre)).toEqual(dim({ length: 1 }));
    expect(toSiDimensionVector(metre)).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(UNIT_DIMENSION_LENGTH).toBe(10);
  });

  it('maps a newton (kg·m/s²) onto [L, M, T] = [1, 1, -2]', () => {
    const newton = [...ZERO];
    newton[0] = 1;
    newton[1] = 1;
    newton[2] = -2;
    expect(toSiDimensionVector(newton)).toEqual([1, 1, -2, 0, 0, 0, 0]);
    expect(fromSiDimensionVector([1, 1, -2, 0, 0, 0, 0])).toEqual(newton);
  });

  it('round-trips a Dimensions record through the length-10 vector', () => {
    const charge = dim({ current: 1, time: 1 });
    const vector = fromSiDimensions(charge);
    expect(vector).toHaveLength(10);
    expect(toSiDimensions(vector)).toEqual(charge);
    expect(vector[7]).toBe(0);
    expect(vector[8]).toBe(0);
    expect(vector[9]).toBe(0);
  });

  it('reads the exponent vector off a live Unit', () => {
    const newton = new Unit(1, 'N');
    expect(toSiDimensionVector(newton.dimensions)).toEqual([1, 1, -2, 0, 0, 0, 0]);
    const coulomb = new Unit(1, 'C');
    expect(toSiDimensions(coulomb.dimensions)).toEqual(dim({ current: 1, time: 1 }));
  });

  it('throws when angle, bit, or solid angle is nonzero', () => {
    const angle = [...ZERO];
    angle[7] = 1;
    expect(() => toSiDimensions(angle)).toThrow(RangeError);
    expect(toSiDimensionVector(angle, { ignoreExtra: true })).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('rejects the wrong length and a non-finite exponent', () => {
    expect(() => toSiDimensions([1, 0, 0])).toThrow(/length 10/);
    expect(() => fromSiDimensionVector([1, 0, 0])).toThrow(/length 7/);
    const bad = [...ZERO];
    bad[1] = Number.NaN;
    expect(() => toSiDimensions(bad)).toThrow(TypeError);
  });
});

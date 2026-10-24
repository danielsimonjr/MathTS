import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import {
  Unit,
  isUnit,
  isUnitValue,
  DIMENSIONLESS,
  BASE_UNITS,
  ALL_UNITS,
  getUnitDef,
  SI_PREFIXES,
  getPrefix,
  toSiDimensionVector,
  fromSiDimensionVector,
} from '../src/index.js';

/**
 * Re-export of the dimensional-analysis system from
 * `@danielsimonjr/mathts-core`. `Unit` is directly instantiable, so these are
 * real end-to-end checks. Full unit behaviour is covered by core's own tests.
 */
describe('@danielsimonjr/mathts-units re-export surface', () => {
  it('constructs and converts units', () => {
    const u = new Unit(5, 'km');
    expect(isUnit(u)).toBe(true);
    expect(isUnitValue(u)).toBe(true);
    expect(u.type).toBe('Unit');
    expect(u.value).toBe(5000); // normalized to the base unit (metres)
    expect(u.to('m').value).toBe(5000);
    expect(typeof u.toBest).toBe('function');
  });

  it('exposes the unit registries and prefix helpers', () => {
    expect(typeof getUnitDef).toBe('function');
    expect(typeof getPrefix).toBe('function');
    expect(typeof BASE_UNITS).toBe('object');
    expect(typeof ALL_UNITS).toBe('object');
    expect(typeof SI_PREFIXES).toBe('object');
    expect(DIMENSIONLESS).toBeDefined();
  });

  it('re-exports SI dimension converters with Fraction exponents', () => {
    const newton = new Unit(1, 'N');
    const si = toSiDimensionVector(newton.dimensions);
    expect(si[0].equals(new Fraction(1n, 1n))).toBe(true);
    expect(si[1].equals(new Fraction(1n, 1n))).toBe(true);
    expect(si[2].equals(new Fraction(-2n, 1n))).toBe(true);
    expect(fromSiDimensionVector([1, 1, -2, 0, 0, 0, 0])).toEqual(newton.dimensions);
  });
});

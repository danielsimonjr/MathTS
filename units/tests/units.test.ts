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
  REFUSED_UNIT_SPELLINGS,
  type UnitInstance,
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

/**
 * The facade is an entry point, not a copy: its runtime surface is exactly what it re-exports
 * from core. Adding or dropping an export must be a deliberate change to this list.
 */
const EXPECTED_RUNTIME_EXPORTS = [
  'ALL_UNITS',
  'BASE_UNITS',
  'BEST_PREFIXES',
  'DERIVED_UNITS',
  'DIMENSIONLESS',
  'DimensionMismatchError',
  'LN2_EXACT_SCALE',
  'NAMED_IRRATIONALS',
  'NAMED_SCALES',
  'PI_EXACT_SCALE',
  'REFUSED_UNIT_SPELLINGS',
  'SI_DIMENSION_LENGTH',
  'SI_PREFIXES',
  'UNIT_ALIASES',
  'UNIT_DIMENSION_LENGTH',
  'UNIT_EXACT_SCALE',
  'UNIT_PREFIX_SETS',
  'UNIT_ROWS',
  'UNIT_ROW_ALIASES',
  'Unit',
  'UnitParseError',
  'addExactScales',
  'binaryExactScale',
  'clearExactScaleNumberCache',
  'decimalExactScale',
  'dim',
  'divideExactScales',
  'exactScaleNumberCacheSize',
  'exactScaleOf',
  'exactScaleToNumber',
  'exactScalesEqual',
  'formatExactScale',
  'fromSiDimensionVector',
  'fromSiDimensions',
  'getPrefix',
  'getUnitDef',
  'getUnitPrefix',
  'getUnitRow',
  'irrationalPower',
  'isRationalScale',
  'isUnit',
  'isUnitValue',
  'multiplyExactScales',
  'namedExactScale',
  'namedIrrationalScale',
  'powerExactScale',
  'ratioExactScale',
  'readScaleExpression',
  'readUnitScale',
  'toSiDimensionVector',
  'toSiDimensions',
  'unitPrefixExactScale',
  'unitRowExactOffset',
  'unitRowExactScale',
  'unitRowValue',
];

describe('units facade export surface', () => {
  it('exports exactly the pinned runtime names', async () => {
    const facade = await import('../src/index.js');
    expect(Object.keys(facade).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS].sort());
  });

  it('re-exports the same bindings as core, not copies', async () => {
    const facade = (await import('../src/index.js')) as Record<string, unknown>;
    const core = (await import('@danielsimonjr/mathts-core')) as Record<string, unknown>;
    for (const name of EXPECTED_RUNTIME_EXPORTS) {
      expect(facade[name], name).toBe(core[name]);
    }
  });
});

describe('units facade type surface', () => {
  it('exposes UnitInstance and REFUSED_UNIT_SPELLINGS', () => {
    const u: UnitInstance = new Unit(5, 'm');
    expect(u.toString()).toBe('5 m');
    expect(Object.keys(REFUSED_UNIT_SPELLINGS).length).toBeGreaterThan(0);
  });
});

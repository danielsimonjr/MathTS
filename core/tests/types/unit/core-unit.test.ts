/**
 * Smoke + parity oracles for the relocated `Unit` (Unit-merge Phase 1.2).
 *
 * These pin the SAME expected strings/numbers as the functions-package
 * characterization net (`functions/tests/unit-characterization.test.ts`), proving
 * the core-wired Unit — instantiated from `unitDependencies` (core scalar ops,
 * numeric types, format, config) — behaves identically to the still-in-functions
 * original. If a dependency adapter is subtly wrong (e.g. a broken BigNumber ctor
 * or a mis-ordered subtract), one of these exact oracles breaks.
 */
import { describe, it, expect } from 'vitest';

import { Unit } from '../../../src/types/unit/index';
import { DimensionMismatchError, UnitParseError } from '../../../src/types/unit/errors';

describe('core Unit — parsing & value', () => {
  it('parses compound / prefixed unit strings', () => {
    expect(Unit.parse('5 km/h').toString()).toBe('5 km / h');
    expect(Unit.parse('4e2 cm/s^2').toString()).toContain('cm');
  });

  it('reports numeric value in a requested unit', () => {
    expect(new Unit(2, 'km').toNumeric('m')).toBe(2000);
  });
});

describe('core Unit — conversion', () => {
  it('converts across units (imperial + temperature + compound)', () => {
    expect(new Unit(1, 'm').to('ft').toString()).toBe('3.280839895013123 ft');
    expect(new Unit(2, 'inch').to('cm').toString()).toBe('5.08 cm');
    expect(Unit.parse('20 degC').to('K').toString()).toBe('293.15 K');
    expect(Unit.parse('36 km/h').to('m/s').toString()).toBe('10 m / s');
  });

  it('handles angle + information dimensions', () => {
    expect(Unit.parse('90 deg').to('rad').toString()).toBe('1.5707963267948966 rad');
    expect(Unit.parse('1 byte').to('bit').toString()).toBe('8 bit');
  });

  it('accepts °C / °F degree-symbol notation (preserved from the old core Unit)', () => {
    // The mathjs parser natively rejects '°'; we normalize °C→degC, °F→degF, °→deg
    // so the merged Unit loses no capability the old core Unit had.
    expect(new Unit(20, '°C').to('K').toString()).toBe('293.15 K');
    expect(new Unit(32, '°F').to('degC').toString()).toBe('0 degC');
    expect(Unit.parse('100 °C').to('K').toString()).toBe('373.15 K');
    expect(Unit.parse('90 °').to('rad').toString()).toBe('1.5707963267948966 rad');
  });
});

describe('core Unit — simplify / toSI / arithmetic', () => {
  it('toSI expands to base SI units', () => {
    expect(Unit.parse('1 N').toSI().toString()).toBe('1 (kg m) / s^2');
  });

  it('toBest picks the clean |log10|-minimizing prefix (0.1 mm, 1 kg — not 100.0000…1 µm)', () => {
    // Preserves the old core Unit's toBest behavior: minimize |log10(displayed)| with
    // no engineering offset, so results are clean (mantissa near 1, no float noise).
    expect(new Unit(0.0001, 'm').toBest().toString()).toBe('0.1 mm');
    expect(new Unit(1000, 'g').toBest().toString()).toBe('1 kg');
  });

  it('splitUnit distributes a magnitude across parts (exercises Unit-aware subtractScalar)', () => {
    const parts = new Unit(1.5, 'm').splitUnit(['m', 'cm']);
    expect(parts.map((p) => p.toString())).toEqual(['1 m', '50 cm']);
  });
});

describe('core Unit — JSON envelope compatibility', () => {
  const FromJSON = Unit.fromJSON as (json: unknown) => { toString(): string };

  it('toJSON round-trips through fromJSON', () => {
    const u = new Unit(2, 'km');
    expect(FromJSON(u.toJSON()).toString()).toBe(new Unit(2, 'km').toString());
  });

  it('fromJSON accepts the mathjs envelope', () => {
    expect(
      FromJSON({
        mathjs: 'Unit',
        value: 5,
        unit: 'cm',
        fixPrefix: false,
        skipSimp: true,
      }).toString()
    ).toBe('5 cm');
  });

  it('fromJSON accepts the old core {mathts, value, notation} envelope (no capability loss)', () => {
    expect(FromJSON({ mathts: 'Unit', value: 5, notation: 'cm' }).toString()).toBe('5 cm');
  });
});

describe('core Unit — typed errors (preserved from the old core Unit)', () => {
  it('throws UnitParseError for an unknown or invalid unit', () => {
    expect(() => new Unit(1, 'xyzzy')).toThrow(UnitParseError);
    expect(() => new Unit(1, '$')).toThrow(UnitParseError);
  });

  it('throws DimensionMismatchError converting between incompatible dimensions', () => {
    expect(() => new Unit(1, 'm').to('s')).toThrow(DimensionMismatchError);
  });
});

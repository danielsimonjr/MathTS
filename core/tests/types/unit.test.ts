/**
 * Unit type tests — the core `Unit` is now the single, feature-complete merged
 * implementation (`core/src/types/unit/`). These exercise its public surface via
 * `core/src/types/unit.ts` (the historical import path).
 *
 * Note on arithmetic: the merged Unit does add/subtract/multiply/divide at the
 * OPERATOR level (the `functions` package `add`/`subtract`/`multiply`/`divide`),
 * not as Unit methods — so unit arithmetic is covered by
 * `functions/tests/unit-operators.test.ts`, not here (core cannot import functions).
 *
 * @module @danielsimonjr/mathts-core/tests/types/unit
 */

import { describe, it, expect } from 'vitest';
import { Unit, isUnit, DimensionMismatchError, UnitParseError, dim } from '../../src/types/unit';

/** Displayed magnitude of a Unit's `toString()` (the number before the unit). */
const displayed = (u: { toString(): string }): number => parseFloat(u.toString().split(' ')[0]);

describe('Unit', () => {
  // -----------------------------------------------------------------------
  // Construction / parsing
  // -----------------------------------------------------------------------

  describe('construction', () => {
    it('creates a basic length unit', () => {
      const u = new Unit(5, 'm');
      expect(u.value).toBe(5);
      expect(u.formatUnits()).toBe('m');
      expect(u.type).toBe('Unit');
      expect(u.equalBase(new Unit(1, 'm'))).toBe(true);
    });

    it('applies SI prefix to base units (kilometres → canonical metres)', () => {
      const u = new Unit(5, 'km');
      expect(u.value).toBe(5000);
      expect(u.equalBase(new Unit(1, 'm'))).toBe(true);
    });

    it('applies SI prefix to gram (yielding canonical kilograms)', () => {
      const u = new Unit(500, 'g');
      expect(u.value).toBeCloseTo(0.5, 12); // 500 g = 0.5 kg canonical
      expect(u.equalBase(new Unit(1, 'kg'))).toBe(true);
    });

    it('parses a leading scalar coefficient', () => {
      const u = Unit.parse('5 km');
      expect(u.value).toBe(5000);
      expect(u.formatUnits()).toBe('km');
    });

    it('parses minute as the registered unit, not "milli + in"', () => {
      const u = new Unit(2, 'min');
      expect(u.value).toBe(120); // 2 min = 120 s canonical
      expect(u.equalBase(new Unit(1, 's'))).toBe(true);
      expect(u.equalBase(new Unit(1, 'm'))).toBe(false);
    });

    it('throws UnitParseError for unknown units', () => {
      expect(() => new Unit(1, 'xyzzy')).toThrow(UnitParseError);
    });

    it('throws UnitParseError for invalid expressions', () => {
      expect(() => new Unit(1, '$')).toThrow(UnitParseError);
    });
  });

  // -----------------------------------------------------------------------
  // Composition / parsing (dimensions verified behaviorally via equalBase)
  // -----------------------------------------------------------------------

  describe('compound notations', () => {
    it('parses "m/s" as a speed', () => {
      const u = new Unit(3, 'm/s');
      expect(u.value).toBe(3);
      expect(u.equalBase(new Unit(1, 'km/h'))).toBe(true); // both speed
      expect(u.equalBase(new Unit(1, 'm'))).toBe(false);
    });

    it('parses "m/s^2" as an acceleration', () => {
      const u = new Unit(9.81, 'm/s^2');
      expect(u.value).toBeCloseTo(9.81, 12);
      expect(u.equalBase(new Unit(1, 'ft/s^2'))).toBe(true); // both acceleration
    });

    it('parses "kg m/s^2" as a force (newton-equivalent)', () => {
      const u = new Unit(1, 'kg m/s^2');
      expect(u.value).toBe(1);
      expect(u.equalBase(new Unit(1, 'N'))).toBe(true);
    });

    it('handles m^2 (area)', () => {
      const u = new Unit(4, 'm^2');
      expect(u.value).toBe(4);
      expect(u.equalBase(new Unit(1, 'ft^2'))).toBe(true);
    });

    it('handles "1/s" (frequency dimensions)', () => {
      const u = new Unit(60, '1/s');
      expect(u.value).toBe(60);
      expect(u.equalBase(new Unit(1, 'Hz'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Conversion
  // -----------------------------------------------------------------------

  describe('conversion (.to)', () => {
    it('converts metres to feet', () => {
      const ft = new Unit(1, 'm').to('ft');
      expect(ft.value).toBeCloseTo(1, 12); // canonical value unchanged
      expect(displayed(ft)).toBeCloseTo(3.28084, 4);
    });

    it('converts grams to kilograms', () => {
      const kg = new Unit(1000, 'g').to('kg'); // canonical 1 kg
      expect(displayed(kg)).toBeCloseTo(1, 12);
    });

    it('converts km/h to m/s', () => {
      const ms = new Unit(36, 'km/h').to('m/s'); // 36 km/h = 10 m/s
      expect(displayed(ms)).toBeCloseTo(10, 9);
    });

    it('throws DimensionMismatchError on incompatible target', () => {
      expect(() => new Unit(1, 'm').to('s')).toThrow(DimensionMismatchError);
    });
  });

  describe('temperature conversions', () => {
    it('20 degC converts to 293.15 K; °C is an accepted alias', () => {
      // The merged Unit applies temperature offsets on conversion (mathjs behavior),
      // so `.value` holds the raw magnitude; canonical-ness shows through `.to(K)`.
      expect(displayed(new Unit(20, 'degC').to('K'))).toBeCloseTo(293.15, 9);
      expect(displayed(new Unit(20, '°C').to('K'))).toBeCloseTo(293.15, 9);
    });

    it('converts 0 degC → degF (displayed 32)', () => {
      expect(displayed(new Unit(0, 'degC').to('degF'))).toBeCloseTo(32, 6);
    });

    it('converts 100 °C → °F (displayed 212)', () => {
      expect(displayed(new Unit(100, '°C').to('°F'))).toBeCloseTo(212, 6);
    });

    it('converts 0 K → degC (displayed -273.15)', () => {
      expect(displayed(new Unit(0, 'K').to('degC'))).toBeCloseTo(-273.15, 6);
    });
  });

  // -----------------------------------------------------------------------
  // toBest (clean |log10|-min prefix)
  // -----------------------------------------------------------------------

  describe('toBest()', () => {
    it('0.0001 m → 0.1 mm', () => {
      expect(new Unit(0.0001, 'm').toBest().toString()).toBe('0.1 mm');
    });

    it('1000 g (canonical 1 kg) → 1 kg', () => {
      expect(new Unit(1000, 'g').toBest().toString()).toBe('1 kg');
    });

    it('1000 m → 1 km', () => {
      expect(new Unit(1000, 'm').toBest().toString()).toBe('1 km');
    });

    it('preserves the dimensions of its input', () => {
      const best = new Unit(1500, 'N').toBest();
      expect(best.equalBase(new Unit(1, 'N'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Pretty printing
  // -----------------------------------------------------------------------

  describe('toString()', () => {
    it('formats "5 m" as "5 m"', () => {
      expect(new Unit(5, 'm').toString()).toBe('5 m');
    });

    it('formats a fractional value', () => {
      expect(new Unit(2.5, 'kg').toString()).toBe('2.5 kg');
    });

    it('formats km/h preserving notation', () => {
      const u = new Unit(50, 'km/h');
      expect(u.toString().endsWith('km / h')).toBe(true);
      expect(displayed(u)).toBeCloseTo(50, 9);
    });
  });

  // -----------------------------------------------------------------------
  // JSON roundtrip (mathjs envelope; the {mathts} envelope is also accepted)
  // -----------------------------------------------------------------------

  describe('JSON', () => {
    it('round-trips through toJSON/fromJSON', () => {
      const u = new Unit(5, 'm');
      const json = u.toJSON();
      expect(json.value).toBe(5);
      expect(json.unit).toBe('m');
      const restored = Unit.fromJSON(json);
      expect(restored.value).toBe(5);
      expect(restored.formatUnits()).toBe('m');
    });

    it('preserves canonical value through JSON (km)', () => {
      const restored = Unit.fromJSON(new Unit(5, 'km').toJSON());
      expect(restored.value).toBe(5000);
    });

    it('accepts the legacy {mathts, value, notation} envelope', () => {
      const restored = Unit.fromJSON({
        mathts: 'Unit',
        value: 5,
        notation: 'm',
      } as unknown as ReturnType<Unit['toJSON']>);
      expect(restored.toString()).toBe('5 m');
    });
  });

  // -----------------------------------------------------------------------
  // Equality
  // -----------------------------------------------------------------------

  describe('equality', () => {
    it('equals: same canonical value & dimensions', () => {
      expect(new Unit(1, 'km').equals(new Unit(1000, 'm'))).toBe(true);
    });

    it('not equal: different canonical value', () => {
      expect(new Unit(1, 'km').equals(new Unit(500, 'm'))).toBe(false);
    });

    it('not equal: different dimensions', () => {
      expect(new Unit(1, 'm').equals(new Unit(1, 's'))).toBe(false);
    });

    it('equalBase: dimensions match, values differ', () => {
      const a = new Unit(5, 'm');
      const b = new Unit(10, 'ft');
      expect(a.equalBase(b)).toBe(true);
      expect(a.equals(b)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // isUnit type guard
  // -----------------------------------------------------------------------

  describe('isUnit', () => {
    it('returns true for Unit instances', () => {
      expect(isUnit(new Unit(1, 'm'))).toBe(true);
    });

    it('returns false for plain objects and primitives', () => {
      expect(isUnit({ value: 1, notation: 'm' })).toBe(false);
      expect(isUnit(5)).toBe(false);
      expect(isUnit('5 m')).toBe(false);
      expect(isUnit(null)).toBe(false);
      expect(isUnit(undefined)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  describe('dim() helper', () => {
    it('fills missing fields with 0', () => {
      const d = dim({ length: 1 });
      expect(d.length).toBe(1);
      expect(d.mass).toBe(0);
      expect(d.time).toBe(0);
    });
  });
});

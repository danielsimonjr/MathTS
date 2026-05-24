/**
 * Unit type tests
 * @module @danielsimonjr/mathts-core/tests/types/unit
 */

import { describe, it, expect } from 'vitest';
import { Unit, isUnit, DimensionMismatchError, UnitParseError, dim } from '../../src/types/unit';

describe('Unit', () => {
  // -----------------------------------------------------------------------
  // Construction
  // -----------------------------------------------------------------------

  describe('construction', () => {
    it('creates a basic length unit', () => {
      const u = new Unit(5, 'm');
      expect(u.value).toBe(5);
      expect(u.dimensions.length).toBe(1);
      expect(u.notation).toBe('m');
      expect(u.type).toBe('Unit');
    });

    it('applies SI prefix to base units (kilometres)', () => {
      const u = new Unit(5, 'km');
      expect(u.value).toBe(5000);
      expect(u.dimensions.length).toBe(1);
    });

    it('applies SI prefix to gram (yielding canonical kilograms)', () => {
      const u = new Unit(500, 'g');
      // 500 g = 0.5 kg = 0.5 (canonical mass unit).
      expect(u.value).toBeCloseTo(0.5, 12);
      expect(u.dimensions.mass).toBe(1);
    });

    it('parses a leading scalar coefficient', () => {
      const u = Unit.parse('5 km');
      expect(u.value).toBe(5000);
      expect(u.notation).toBe('km');
    });

    it('parses minute as the registered unit, not "milli + in"', () => {
      // This guards the prefix-ambiguity rule: plain match before prefix.
      const u = new Unit(2, 'min');
      expect(u.value).toBe(120);
      expect(u.dimensions.time).toBe(1);
      expect(u.dimensions.length).toBe(0);
    });

    it('throws UnitParseError for unknown units', () => {
      expect(() => new Unit(1, 'xyzzy')).toThrow(UnitParseError);
    });

    it('throws UnitParseError for invalid expressions', () => {
      expect(() => new Unit(1, '$')).toThrow(UnitParseError);
    });
  });

  // -----------------------------------------------------------------------
  // Composition / parsing
  // -----------------------------------------------------------------------

  describe('compound notations', () => {
    it('parses "m/s"', () => {
      const u = new Unit(3, 'm/s');
      expect(u.value).toBe(3);
      expect(u.dimensions.length).toBe(1);
      expect(u.dimensions.time).toBe(-1);
    });

    it('parses "m/s^2"', () => {
      const u = new Unit(9.81, 'm/s^2');
      expect(u.dimensions.length).toBe(1);
      expect(u.dimensions.time).toBe(-2);
      expect(u.value).toBeCloseTo(9.81, 12);
    });

    it('parses Unicode superscripts ("m/s²")', () => {
      const u = new Unit(9.81, 'm/s²');
      expect(u.dimensions.time).toBe(-2);
    });

    it('parses with middle dot "kg·m/s²" → newton-equivalent', () => {
      const u = new Unit(1, 'kg·m/s^2');
      expect(u.dimensions.mass).toBe(1);
      expect(u.dimensions.length).toBe(1);
      expect(u.dimensions.time).toBe(-2);
      expect(u.value).toBe(1);
    });

    it('handles m^2 (square metres)', () => {
      const u = new Unit(4, 'm^2');
      expect(u.dimensions.length).toBe(2);
      expect(u.value).toBe(4);
    });

    it('handles "1/s" (one over seconds = Hertz dimensions)', () => {
      const u = new Unit(60, '1/s');
      expect(u.dimensions.time).toBe(-1);
      expect(u.value).toBe(60);
    });

    it('"m/s/s" parses as m/s²', () => {
      // Per the parser spec, each / flips the *next* atom only.
      const u = new Unit(1, 'm/s/s');
      expect(u.dimensions.length).toBe(1);
      expect(u.dimensions.time).toBe(-2);
    });
  });

  // -----------------------------------------------------------------------
  // Arithmetic
  // -----------------------------------------------------------------------

  describe('add/sub', () => {
    it('adds two units with matching dimensions', () => {
      const a = new Unit(5, 'm');
      const b = new Unit(3, 'm');
      const c = a.add(b);
      expect(c.value).toBe(8);
      expect(c.dimensions.length).toBe(1);
    });

    it('adds across different but compatible units (km + m)', () => {
      const a = new Unit(1, 'km'); // 1000 m canonical
      const b = new Unit(500, 'm');
      const c = a.add(b);
      expect(c.value).toBe(1500);
    });

    it('subtracts with matching dimensions', () => {
      const a = new Unit(10, 'm');
      const b = new Unit(3, 'm');
      expect(a.sub(b).value).toBe(7);
    });

    it('throws DimensionMismatchError on add with incompatible units', () => {
      expect(() => new Unit(1, 'm').add(new Unit(1, 's'))).toThrow(DimensionMismatchError);
    });

    it('throws DimensionMismatchError on sub with incompatible units', () => {
      expect(() => new Unit(1, 'kg').sub(new Unit(1, 'm'))).toThrow(DimensionMismatchError);
    });
  });

  describe('mul/div', () => {
    it('multiplies two units (length × time)', () => {
      const a = new Unit(5, 'm');
      const b = new Unit(3, 's');
      const c = a.mul(b);
      expect(c.value).toBe(15);
      expect(c.dimensions.length).toBe(1);
      expect(c.dimensions.time).toBe(1);
    });

    it('divides two units (m / s)', () => {
      const a = new Unit(10, 'm');
      const b = new Unit(4, 's');
      const c = a.div(b);
      expect(c.value).toBe(2.5);
      expect(c.dimensions.length).toBe(1);
      expect(c.dimensions.time).toBe(-1);
    });

    it('scalar multiplication preserves dimensions', () => {
      const a = new Unit(5, 'm');
      const c = a.mul(3);
      expect(c.value).toBe(15);
      expect(c.dimensions.length).toBe(1);
    });

    it('scalar division preserves dimensions', () => {
      const a = new Unit(10, 'm');
      const c = a.div(2);
      expect(c.value).toBe(5);
      expect(c.dimensions.length).toBe(1);
    });

    it('mul/div cancel into dimensionless', () => {
      const a = new Unit(5, 'm');
      const c = a.div(new Unit(2, 'm'));
      expect(c.dimensions.length).toBe(0);
      expect(c.value).toBe(2.5);
    });
  });

  describe('pow', () => {
    it('(5 m)^2 yields 25 m²', () => {
      const a = new Unit(5, 'm');
      const c = a.pow(2);
      expect(c.value).toBe(25);
      expect(c.dimensions.length).toBe(2);
    });

    it('negative exponent gives inverse dimensions', () => {
      const a = new Unit(2, 's');
      const c = a.pow(-1);
      expect(c.value).toBe(0.5);
      expect(c.dimensions.time).toBe(-1);
    });

    it('fractional exponent works (sqrt)', () => {
      const a = new Unit(9, 'm^2');
      const c = a.pow(0.5);
      expect(c.value).toBeCloseTo(3, 12);
      expect(c.dimensions.length).toBeCloseTo(1, 12);
    });
  });

  // -----------------------------------------------------------------------
  // Conversion
  // -----------------------------------------------------------------------

  describe('conversion (.to)', () => {
    it('converts metres to feet', () => {
      const u = new Unit(1, 'm');
      const ft = u.to('ft');
      expect(ft.value).toBeCloseTo(1, 12); // canonical value unchanged
      // displayed value: 1 m = 3.28084 ft
      const displayed = parseFloat(ft.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(3.28084, 4);
    });

    it('converts grams to kilograms', () => {
      const u = new Unit(1000, 'g'); // canonical 1 kg
      const kg = u.to('kg');
      const displayed = parseFloat(kg.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(1, 12);
    });

    it('converts km/h to m/s', () => {
      const u = new Unit(36, 'km/h'); // 36 km/h = 10 m/s
      const ms = u.to('m/s');
      const displayed = parseFloat(ms.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(10, 9);
    });

    it('throws DimensionMismatchError on incompatible target', () => {
      expect(() => new Unit(1, 'm').to('s')).toThrow(DimensionMismatchError);
    });
  });

  describe('temperature conversions', () => {
    it('20°C = 293.15 K (canonical)', () => {
      const u = new Unit(20, '°C');
      expect(u.value).toBeCloseTo(293.15, 12);
      expect(u.dimensions.temperature).toBe(1);
    });

    it('converts 20°C → K (displayed)', () => {
      const u = new Unit(20, '°C');
      const k = u.to('K');
      const displayed = parseFloat(k.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(293.15, 9);
    });

    it('converts 0°C → °F (displayed)', () => {
      const u = new Unit(0, '°C');
      const f = u.to('°F');
      const displayed = parseFloat(f.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(32, 6);
    });

    it('converts 100°C → °F', () => {
      const u = new Unit(100, '°C');
      const f = u.to('°F');
      const displayed = parseFloat(f.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(212, 6);
    });

    it('converts 0 K → °C', () => {
      const u = new Unit(0, 'K');
      const c = u.to('°C');
      const displayed = parseFloat(c.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(-273.15, 6);
    });
  });

  // -----------------------------------------------------------------------
  // toBest
  // -----------------------------------------------------------------------

  describe('toBest()', () => {
    it('0.0001 m → 0.1 mm', () => {
      const u = new Unit(0.0001, 'm');
      const best = u.toBest();
      // Either "mm" with value 0.1 or "cm" with 0.01 — pick the one closest
      // to |log10| = 0. mm with 0.1 has |log10| = 1; cm with 0.01 has 2.
      // µm with 100 has |log10| = 2. So mm is the winner.
      expect(best.notation).toBe('mm');
    });

    it('1000 g (canonical 1 kg) → kg', () => {
      const u = new Unit(1000, 'g'); // canonical = 1 kg
      const best = u.toBest();
      expect(best.notation).toBe('kg');
    });

    it('1000 m → km', () => {
      const u = new Unit(1000, 'm');
      const best = u.toBest();
      expect(best.notation).toBe('km');
    });

    it('preserves dimensions of input', () => {
      const u = new Unit(1500, 'N');
      const best = u.toBest();
      expect(best.dimensions.length).toBe(1);
      expect(best.dimensions.mass).toBe(1);
      expect(best.dimensions.time).toBe(-2);
    });
  });

  // -----------------------------------------------------------------------
  // Pretty printing
  // -----------------------------------------------------------------------

  describe('toString()', () => {
    it('formats "5 m" as "5 m"', () => {
      expect(new Unit(5, 'm').toString()).toBe('5 m');
    });

    it('formats with fractional value', () => {
      expect(new Unit(2.5, 'kg').toString()).toBe('2.5 kg');
    });

    it('formats km/h preserving notation', () => {
      const u = new Unit(50, 'km/h');
      // Display in km/h: canonical = 50 * 1000 / 3600 m/s, but displayed should be 50.
      expect(u.toString().endsWith('km/h')).toBe(true);
      const displayed = parseFloat(u.toString().split(' ')[0]);
      expect(displayed).toBeCloseTo(50, 9);
    });
  });

  // -----------------------------------------------------------------------
  // JSON roundtrip
  // -----------------------------------------------------------------------

  describe('JSON', () => {
    it('round-trips through toJSON/fromJSON', () => {
      const u = new Unit(5, 'm');
      const json = u.toJSON();
      expect(json).toEqual({ mathts: 'Unit', value: 5, notation: 'm' });
      const restored = Unit.fromJSON(json);
      expect(restored.value).toBe(5);
      expect(restored.dimensions.length).toBe(1);
      expect(restored.notation).toBe('m');
    });

    it('preserves canonical value through JSON (km)', () => {
      const u = new Unit(5, 'km');
      const restored = Unit.fromJSON(u.toJSON());
      // Canonical value is 5000 (metres).
      expect(restored.value).toBe(5000);
    });
  });

  // -----------------------------------------------------------------------
  // Equality
  // -----------------------------------------------------------------------

  describe('equality', () => {
    it('equals: same canonical value & dimensions', () => {
      const a = new Unit(1, 'km');
      const b = new Unit(1000, 'm');
      expect(a.equals(b)).toBe(true);
    });

    it('not equal: different canonical value', () => {
      const a = new Unit(1, 'km');
      const b = new Unit(500, 'm');
      expect(a.equals(b)).toBe(false);
    });

    it('not equal: different dimensions', () => {
      const a = new Unit(1, 'm');
      const b = new Unit(1, 's');
      expect(a.equals(b)).toBe(false);
    });

    it('dimensionsEqual: dimensions match, values differ', () => {
      const a = new Unit(5, 'm');
      const b = new Unit(10, 'ft');
      expect(a.dimensionsEqual(b)).toBe(true);
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

    it('returns false for plain objects', () => {
      expect(isUnit({ value: 1, notation: 'm' })).toBe(false);
    });

    it('returns false for primitives', () => {
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

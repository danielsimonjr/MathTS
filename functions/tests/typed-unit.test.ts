/**
 * Tests for the typed `to` and `toBest` dispatch wrappers around the core
 * Unit value type.
 *
 * @module @danielsimonjr/mathts-functions/tests/typed-unit
 */

import { describe, it, expect } from 'vitest';
import { Unit, DimensionMismatchError } from '@danielsimonjr/mathts-core';
import { to, toBest } from '../src/typed/unit';

describe('typed to(value, target)', () => {
  it('converts Unit → Unit (m → ft) preserving canonical value', () => {
    const m = new Unit(1, 'm');
    const ft = to(m, 'ft');
    expect(ft).toBeInstanceOf(Unit);
    expect(ft.value).toBeCloseTo(1, 12); // canonical metres unchanged
    expect(ft.formatUnits()).toBe('ft');
  });

  it('converts km → m', () => {
    const km = new Unit(5, 'km');
    const m = to(km, 'm');
    expect(m.value).toBe(5000);
    const displayed = parseFloat(m.toString().split(' ')[0]);
    expect(displayed).toBeCloseTo(5000, 6);
  });

  it('converts 1 hour → seconds', () => {
    const h = new Unit(1, 'h');
    const s = to(h, 's');
    const displayed = parseFloat(s.toString().split(' ')[0]);
    expect(displayed).toBeCloseTo(3600, 6);
  });

  it('handles compound conversion (km/h → m/s)', () => {
    const speed = new Unit(36, 'km/h');
    const result = to(speed, 'm/s');
    const displayed = parseFloat(result.toString().split(' ')[0]);
    expect(displayed).toBeCloseTo(10, 9);
  });

  it('throws DimensionMismatchError on incompatible target', () => {
    const m = new Unit(1, 'm');
    expect(() => to(m, 's')).toThrow(DimensionMismatchError);
  });

  it('constructs from (number, string) form: to(5, "m") yields 5 m', () => {
    const u = to(5, 'm');
    expect(u).toBeInstanceOf(Unit);
    expect(u.value).toBe(5);
    expect(u.formatUnits()).toBe('m');
  });

  it('constructs with SI prefix: to(2, "km") yields canonical 2000 m', () => {
    const u = to(2, 'km');
    expect(u.value).toBe(2000);
    expect(u.formatUnits()).toBe('km');
  });

  it('constructs temperature: to(20, "°C") converts to 293.15 K', () => {
    const u = to(20, '°C');
    expect(u.equalBase(new Unit(0, 'K'))).toBe(true);
    expect(parseFloat(u.to('K').toString().split(' ')[0])).toBeCloseTo(293.15, 9);
  });

  it('dispatch error on bad argument types (string, number)', () => {
    // mathTyped should refuse a signature it doesn't have.
    expect(() => (to as unknown as (...args: unknown[]) => Unit)('5', 1)).toThrow();
  });

  it('result of converted Unit is itself convertible', () => {
    const m = new Unit(1, 'm');
    const ft = to(m, 'ft');
    const back = to(ft, 'm');
    expect(back.value).toBeCloseTo(1, 12);
  });
});

describe('typed toBest(value)', () => {
  it('0.0001 m → mm', () => {
    const u = toBest(new Unit(0.0001, 'm'));
    expect(u.formatUnits()).toBe('mm');
  });

  it('1000 g → kg', () => {
    const u = toBest(new Unit(1000, 'g'));
    expect(u.formatUnits()).toBe('kg');
  });

  it('preserves canonical magnitude (round-trip via .to)', () => {
    const orig = new Unit(1500, 'N');
    const best = toBest(orig);
    expect(best.value).toBeCloseTo(1500, 9); // canonical newton-equivalent
  });

  it('1000000 Pa → MPa', () => {
    const u = toBest(new Unit(1e6, 'Pa'));
    // Best should pick a prefix that minimises |log10(displayed)|. MPa → 1.
    expect(u.formatUnits()).toBe('MPa');
  });

  it('refuses non-Unit arguments via typed-function dispatch', () => {
    expect(() => (toBest as unknown as (x: unknown) => Unit)(5)).toThrow();
  });
});

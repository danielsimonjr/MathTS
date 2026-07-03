import { describe, it, expect } from 'vitest';

import {
  unit,
  add,
  subtract,
  multiply,
  divide,
  smaller,
  larger,
  smallerEq,
  largerEq,
  equal,
  unequal,
  compare,
  abs,
  to,
} from '../src/index.js';

/**
 * Dimensional analysis across the arithmetic + comparison operators (gate G3).
 *
 * The public `unit()` returns the mathjs-derived `Unit` (which keeps add/subtract
 * /comparison logic at the operator level), but the typed operators had been
 * wired to core-`Unit` methods (`a.add`/`a.sub`/`a.dimensionsEqual`) the public
 * Unit doesn't have — so EVERY `unit()` arithmetic/comparison threw. Fixed to the
 * mathjs Unit API (`equalBase` / normalized `value` / `clone` / `multiply` /
 * `divide` / `abs`). Oracles are exact dimensional-analysis values.
 */

const u = unit as (s: string) => { toNumeric(unit?: string): number };
const A = add as (a: unknown, b: unknown) => { toNumeric(unit: string): number };
const S = subtract as (a: unknown, b: unknown) => { toNumeric(unit: string): number };
const M = multiply as (a: unknown, b: unknown) => { toNumeric(unit: string): number };
const D = divide as (a: unknown, b: unknown) => { toNumeric(unit: string): number };

describe('Unit arithmetic — dimensional analysis', () => {
  it('add converts to a common dimension: 5 cm + 3 mm = 5.3 cm = 53 mm', () => {
    const r = A(u('5 cm'), u('3 mm'));
    expect(r.toNumeric('cm')).toBeCloseTo(5.3, 12);
    expect(r.toNumeric('mm')).toBeCloseTo(53, 12);
  });

  it('subtract: 5 cm − 2 cm = 3 cm', () => {
    expect(S(u('5 cm'), u('2 cm')).toNumeric('cm')).toBeCloseTo(3, 12);
  });

  it('scalar scaling: 5 cm × 2 = 10 cm, 6 cm ÷ 2 = 3 cm', () => {
    expect(M(u('5 cm'), 2).toNumeric('cm')).toBeCloseTo(10, 12);
    expect(D(u('6 cm'), 2).toNumeric('cm')).toBeCloseTo(3, 12);
  });

  it('unit × unit builds a compound dimension: 3 m × 4 m = 12 m²', () => {
    expect(M(u('3 m'), u('4 m')).toNumeric('m^2')).toBeCloseTo(12, 12);
  });

  it('unit ÷ unit builds a derived dimension: 10 m ÷ 2 s = 5 m/s (velocity)', () => {
    expect(D(u('10 m'), u('2 s')).toNumeric('m/s')).toBeCloseTo(5, 12);
  });

  it('abs of a negative unit: |−5 cm| = 5 cm', () => {
    expect((abs(u('-5 cm')) as { toNumeric(u: string): number }).toNumeric('cm')).toBeCloseTo(
      5,
      12
    );
  });

  it('adding incompatible dimensions throws (5 cm + 2 s)', () => {
    expect(() => A(u('5 cm'), u('2 s'))).toThrow();
  });
});

describe('Unit comparison — after unit conversion', () => {
  it('ordering respects magnitude across prefixes', () => {
    expect(smaller(u('2 cm'), u('5 cm'))).toBe(true);
    expect(smaller(u('5 cm'), u('2 cm'))).toBe(false);
    expect(larger(u('5 cm'), u('2 cm'))).toBe(true);
    // 5 cm vs 60 mm: 50 mm < 60 mm
    expect(smaller(u('5 cm'), u('60 mm'))).toBe(true);
  });

  it('equality is by physical quantity, not representation: 5 cm = 50 mm', () => {
    expect(equal(u('5 cm'), u('50 mm'))).toBe(true);
    expect(equal(u('5 cm'), u('6 cm'))).toBe(false);
    expect(unequal(u('5 cm'), u('6 cm'))).toBe(true);
  });

  it('smallerEq / largerEq at equality', () => {
    expect(smallerEq(u('5 cm'), u('5 cm'))).toBe(true);
    expect(largerEq(u('5 cm'), u('5 cm'))).toBe(true);
  });

  it('compare returns the sign of the physical difference', () => {
    expect(compare(u('5 cm'), u('2 cm'))).toBe(1);
    expect(compare(u('2 cm'), u('5 cm'))).toBe(-1);
    expect(compare(u('5 cm'), u('50 mm'))).toBe(0);
  });

  it('comparing incompatible dimensions throws (5 cm vs 2 s)', () => {
    expect(() => smaller(u('5 cm'), u('2 s'))).toThrow();
  });
});

describe('Unit operators support both Unit flavors (unit() and to())', () => {
  // `to(value, unit)` returns the CORE Unit (add/sub/dimensionsEqual methods),
  // while `unit(str)` returns the mathjs Unit (equalBase / operator-level add).
  // The operators must handle both — a regression guard for the dual-support path.
  it('to()-produced (core) units add and compare correctly', () => {
    const T = to as (v: number, unit: string) => unknown;
    // core Unit exposes toString (not the mathjs `toNumeric`); 5 m + 3 m = 8 m.
    const r = add(T(5, 'm'), T(3, 'm')) as { toString(): string };
    expect(r.toString()).toContain('8');
    expect(r.toString()).toContain('m');
    expect(smaller(T(2, 'm'), T(5, 'm'))).toBe(true);
    expect(larger(T(5, 'm'), T(2, 'm'))).toBe(true);
  });
});

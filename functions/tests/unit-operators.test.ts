import { describe, it, expect } from 'vitest';
import {
  add,
  subtract,
  multiply,
  divide,
  smaller,
  larger,
  smallerEq,
  largerEq,
  equal,
  compare,
} from '@danielsimonjr/mathts-functions';
import { Unit } from '@danielsimonjr/mathts-core';

/**
 * GC5 — Unit support in arithmetic + comparison operators (mathjs parity). The
 * operators previously rejected Unit ("expected number or bigint or Fraction…").
 */
const u = (v: number, n: string) => new Unit(v, n);

describe('GC5: Unit arithmetic operators', () => {
  it('add / subtract same-dimension units', () => {
    // 5 cm + 3 mm = 5.3 cm = 0.053 m (base)
    expect((add(u(5, 'cm'), u(3, 'mm')) as Unit).value).toBeCloseTo(0.053, 12);
    expect((subtract(u(5, 'cm'), u(2, 'cm')) as Unit).value).toBeCloseTo(0.03, 12);
  });

  it('multiply: unit×unit, unit×scalar, scalar×unit', () => {
    expect((multiply(u(5, 'cm'), 2) as Unit).value).toBeCloseTo(0.1, 12);
    expect((multiply(2, u(5, 'cm')) as Unit).value).toBeCloseTo(0.1, 12);
    expect((multiply(u(2, 'm'), u(3, 'm')) as Unit).value).toBeCloseTo(6, 12); // 6 m²
  });

  it('divide: unit/unit (dimensionless), unit/scalar', () => {
    expect((divide(u(5, 'cm'), 2) as Unit).value).toBeCloseTo(0.025, 12);
    // 10 m / 2 m = 5 (fully cancelled → a plain dimensionless number, mathjs parity)
    expect(divide(u(10, 'm'), u(2, 'm')) as number).toBeCloseTo(5, 12);
  });
});

describe('GC5: Unit comparison operators', () => {
  it('orders units of the same dimension', () => {
    expect(smaller(u(5, 'cm'), u(40, 'mm'))).toBe(false); // 5cm > 40mm
    expect(larger(u(5, 'cm'), u(40, 'mm'))).toBe(true);
    expect(smaller(u(3, 'cm'), u(40, 'mm'))).toBe(true); // 3cm < 40mm
    expect(smallerEq(u(4, 'cm'), u(40, 'mm'))).toBe(true);
    expect(largerEq(u(4, 'cm'), u(40, 'mm'))).toBe(true);
    expect(compare(u(5, 'cm'), u(40, 'mm'))).toBe(1);
  });

  it('equality respects dimension and magnitude', () => {
    expect(equal(u(100, 'cm'), u(1, 'm'))).toBe(true);
    expect(equal(u(100, 'cm'), u(2, 'm'))).toBe(false);
  });

  it('throws when ordering incompatible dimensions', () => {
    expect(() => smaller(u(5, 'cm'), u(2, 's'))).toThrow(/different dimensions/);
  });
});

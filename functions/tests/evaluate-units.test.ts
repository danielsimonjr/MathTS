/**
 * Unit symbols inside `evaluate`. `1 km` is an implicit product of 1 and the
 * valueless unit `km`, matching `unit(1, 'km')`.
 */

import { describe, it, expect } from 'vitest';
import { evaluate } from '../src/factories/evaluate.js';
import { unit } from '../src/index.js';

interface UnitValue {
  value: number | null;
  toString(): string;
  toNumber(unitName: string): number;
  toSI(): { toNumber(unitName: string): number };
}

describe('evaluate unit symbols', () => {
  it('evaluates 1 km as unit(1, "km")', () => {
    const got = evaluate('1 km') as UnitValue;
    const expected = unit(1, 'km') as UnitValue;
    expect(got.toNumber('m')).toBe(expected.toNumber('m'));
    expect(got.toNumber('m')).toBe(1000);
    expect(got.toSI().toNumber('m')).toBe(expected.toSI().toNumber('m'));
  });

  it('evaluates a bare unit symbol as a valueless unit', () => {
    const got = evaluate('km') as UnitValue;
    const expected = unit('km') as UnitValue;
    expect(got.value).toBeNull();
    expect(got.toString()).toBe(expected.toString());
  });

  it('lets a scope binding override the unit symbol', () => {
    expect(evaluate('1 km', { km: 4 })).toBe(4);
  });

  it('still throws for an unknown symbol', () => {
    expect(() => evaluate('notAUnit')).toThrow(/Undefined symbol "notAUnit"/);
  });

  it('leaves ordinary expressions unchanged', () => {
    expect(evaluate('sin(pi / 2)')).toBeCloseTo(1, 12);
    expect(evaluate('2 + 3')).toBe(5);
  });

  it('keeps min as the function, not the minute unit', () => {
    expect(typeof evaluate('min')).toBe('function');
  });
});

import { describe, it, expect } from 'vitest';
import { Unit, UnitParseError } from '../../src/index.js';

describe('UPT U3: affine units in compounds are refused', () => {
  it.each(['degC/s', 'degC*m', '1*degC', 'degC^2', 'J/degC'])(
    'refuses %s with an affine message',
    (str) => {
      expect(() => Unit.parse(str)).toThrow(UnitParseError);
      expect(() => Unit.parse(str)).toThrow(/affine/i);
    }
  );

  it('accepts a single affine unit, with or without a value or parentheses', () => {
    expect(() => Unit.parse('degC')).not.toThrow();
    expect(() => Unit.parse('(degC)')).not.toThrow();
    expect(() => Unit.parse('25 degC')).not.toThrow();
  });

  it('accepts a compound with an affine unit under { affine: "difference" }', () => {
    expect(Unit.parse('5 J/degC', { affine: 'difference' }).toNumeric('J/K')).toBeCloseTo(5, 10);
    expect(Unit.parse('5 J/degF', { affine: 'difference' }).toNumeric('J/K')).toBeCloseTo(9, 10);
  });
});

describe('UPT U4: unit.to(target, { reading: "difference" }) converts an interval', () => {
  it('converts an absolute temperature with the offset', () => {
    expect(Unit.parse('25 degC').to('K').toNumeric()).toBeCloseTo(298.15, 10);
    expect(Unit.parse('1 degC').to('K').toNumeric()).toBeCloseTo(274.15, 10);
  });

  it('converts an interval with no offset shift', () => {
    expect(Unit.parse('25 degC').to('K', { reading: 'difference' }).toNumeric()).toBeCloseTo(
      25,
      10
    );
    expect(Unit.parse('18 degF').to('K', { reading: 'difference' }).toNumeric()).toBeCloseTo(
      10,
      10
    );
    expect(Unit.parse('10 K').to('degF', { reading: 'difference' }).toNumeric()).toBeCloseTo(
      18,
      10
    );
  });
});

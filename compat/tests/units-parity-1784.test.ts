/**
 * #1784 — mathjs 15.3.0 unit parity: `to`, `toBest`, non-finite units, `Unit` without `new`,
 * the `Ah` unit, `Unit.parse` grammar, valueless multiply/divide, `createUnitSingle` aliases,
 * `Unit.isValidAlpha` overrides, SyntaxError from `unit()`, VA/VAR, and complex magnitudes.
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';

type UnitValue = {
  value: unknown;
  units: { unit: { name: string }; prefix: { name: string }; power: number }[];
  toString(): string;
  format(options?: unknown): string;
  multiply(other: unknown): UnitValue;
  divide(other: unknown): UnitValue;
  simplify(): UnitValue;
  toBest(units?: unknown[], options?: Record<string, unknown>): UnitValue;
  equals(other: unknown): boolean;
};

type UnitClass = {
  new (value: unknown, unit?: unknown): UnitValue;
  (value: unknown, unit?: unknown): UnitValue;
  parse(text: string, options?: { allowNoUnits?: boolean }): UnitValue;
  isValidAlpha: (c: string) => boolean;
  createUnit(definitions: Record<string, unknown>): unknown;
  createUnitSingle(name: string, definition?: unknown): unknown;
  UNITS: Record<string, unknown>;
};

describe('#1784 compat unit parity', () => {
  const math = create(all);
  const Unit = math.Unit as unknown as UnitClass;
  const evaluate = (expr: string): UnitValue => math.evaluate(expr) as UnitValue;

  it('to broadcasts over Array and Matrix', () => {
    const converted = math.to([math.unit('1 m'), math.unit('2 m')], 'cm') as unknown as UnitValue[];
    expect(converted.map((u) => u.toString())).toEqual(['100 cm', '200 cm']);
    const matrix = math.to(math.matrix([math.unit('1 m')]), 'cm') as unknown as {
      toArray(): UnitValue[];
    };
    expect(matrix.toArray()[0].toString()).toBe('100 cm');
    expect((math.to(math.unit('1 m'), 'cm') as UnitValue).toString()).toBe('100 cm');
  });

  it('toBest uses the mathjs 1.2 offset', () => {
    const best = new Unit(10, 'm').toBest([math.unit('km'), math.unit('mm'), math.unit('cm')]);
    expect(best.units[0].prefix.name).toBe('m');
    expect(new Unit(-1000, 'cm').toBest().units[0].prefix.name).toBe('c');
  });

  it('stores NaN and +/-Infinity in a Unit and in unit()', () => {
    expect(math.isNaN(new Unit(NaN, 'inch'))).toBe(true);
    expect(math.isFinite(math.unit(-Infinity, 'm'))).toBe(false);
    expect(math.isBounded(math.unit(Infinity, 'm'))).toBe(false);
    expect(new Unit(Infinity, 'm').value).toBe(Infinity);
    expect(math.isNaN(math.matrix([new Unit(3, 'ft'), new Unit(NaN, 'ft')]))).toEqual(
      math.matrix([false, true])
    );
  });

  it('Unit without new throws a SyntaxError', () => {
    expect(() => Unit(2, 'inch')).toThrow(SyntaxError);
    expect(new Unit(2, 'inch').toString()).toBe('2 inch');
  });

  it('knows the ampere-hour as 3600 C', () => {
    const ah = new Unit(1.4, 'Ah');
    expect(ah.value).toBe(1.4 * 3600);
    expect(ah.units[0].unit.name).toBe('Ah');
    const combined = new Unit(2, 'A').multiply(new Unit(3, 'h')).simplify();
    expect(combined.units[0].unit.name).toBe('Ah');
    expect(combined.value).toBe(2 * 3 * 3600);
  });

  it('Unit.parse follows the mathjs grammar', () => {
    const parsed = Unit.parse('1  m^3 / kg s^2');
    expect(parsed.units.map((u) => u.power)).toEqual([3, -1, 2]);
    const nested = Unit.parse('1 (m / ( s / ( kg mol ) / ( lbm / h ) K ) )');
    expect(nested.units.map((u) => u.power)).toEqual([1, -1, 1, 1, 1, -1, -1]);
    expect(() => Unit.parse('ft^3 psi / mol degF')).not.toThrow();
    expect(() => Unit.parse('m degC')).not.toThrow();
    expect(() => Unit.parse('meter/')).toThrow(/Trailing characters/);
  });

  it('unit() throws SyntaxError for an unknown unit', () => {
    expect(() => math.unit('invalid unit')).toThrow(SyntaxError);
  });

  it('valueless unit times or divided by a number keeps its prefix', () => {
    const valuelessF = new Unit(null, 'fahrenheit');
    expect(valuelessF.multiply(math.bignumber(123)).format(12)).toBe('123 fahrenheit');
    expect(valuelessF.multiply(math.fraction(123, 2)).format(12)).toBe('123/2 fahrenheit');
    expect(valuelessF.multiply(math.complex(123, 123)).format(12)).toBe('(123 + 123i) fahrenheit');
    expect(valuelessF.multiply(123).format(12)).toBe('123 fahrenheit');
    expect(valuelessF.divide(math.bignumber(1).div(123)).format(12)).toBe('123 fahrenheit');
    expect(valuelessF.divide(math.complex(0.25, 0.25)).format(12)).toBe('(2 - 2i) fahrenheit');
  });

  it('avoids BigNumber round-off in offset conversions', () => {
    const toNumeric = (value: unknown, unit: string): unknown =>
      (
        math.unit(value, unit === 'degC' ? 'degF' : 'degC') as { toNumeric(u: string): unknown }
      ).toNumeric(unit);
    expect(String(toNumeric(math.bignumber(32), 'degC'))).toBe('0');
    expect(String(toNumeric(math.bignumber(98.6), 'degC'))).toBe('37');
    const fahrenheit = (
      math.unit(math.bignumber(10.5), 'degC') as { toNumeric(u: string): unknown }
    ).toNumeric('degF');
    expect(String(fahrenheit)).toBe('50.9');
  });

  it('createUnitSingle can define aliases that only native core ships', () => {
    const own = create(all);
    const OwnUnit = own.Unit as unknown as UnitClass;
    OwnUnit.createUnitSingle('knot', {
      definition: '0.51444444 m/s',
      aliases: ['knots', 'kts', 'kt'],
    });
    expect(new OwnUnit(1, 'knot').equals(new OwnUnit(1, 'kts'))).toBe(true);
    expect(new OwnUnit(1, 'kt').equals(new OwnUnit(1, 'knots'))).toBe(true);
    expect(() => OwnUnit.createUnitSingle('knots', { definition: '1 m' })).toThrow(
      /already exists/
    );
  });

  it('an assigned Unit.isValidAlpha reaches createUnit and parse', () => {
    const own = create(all);
    const OwnUnit = own.Unit as unknown as UnitClass;
    const original = OwnUnit.isValidAlpha;
    OwnUnit.isValidAlpha = (c: string) => original(c) || c.toUpperCase() !== c.toLowerCase();
    OwnUnit.createUnit({ vteřiny: '1 s' });
    expect(OwnUnit.parse('21 vteřiny').toString()).toBe('21 vteřiny');
  });

  it('formats VA and VAR through evaluate', () => {
    expect(evaluate('4000 VAR + 3000 VA').format()).toBe('(3 + 4i) kVA');
    expect(evaluate('4000 VAR').format()).toBe('(4) kVAR');
    expect(evaluate('4000i VA').format()).toBe('(4) kVAR');
    expect(evaluate('4000i VAR').format()).toBe('(-4) kVA');
    expect(evaluate('abs(4000 VAR + 3000 VA)').format()).toBe('5 kW');
  });

  it('converts a complex magnitude to the last digit', () => {
    const u = new Unit(math.complex(300, 400), 'kPa') as UnitValue & { to(u: string): UnitValue };
    expect(u.to('lbf/in^2').toString()).toBe(
      '(43.511321319062766 + 58.01509509208368i) lbf / in^2'
    );
  });
});

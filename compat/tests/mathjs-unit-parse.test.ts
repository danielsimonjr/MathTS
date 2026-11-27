/**
 * Regression coverage for {@link createMathjsUnitParse} error paths and number modes (#1784).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { createMathjsUnitParse, type MathjsUnitParseHost } from '../src/mathjs-unit-parse.js';

type UnitClass = {
  parse(text: string, options?: { allowNoUnits?: boolean }): { value: unknown; toString(): string };
  (value: unknown, unit?: unknown): unknown;
};

function mockParseHost(overrides?: {
  findUnit?: (
    name: string
  ) => { unit: { dimensions: number[]; base?: { key: string } }; prefix: null } | null;
  isValidAlpha?: (c: string) => boolean;
  fractionAlwaysThrows?: boolean;
}): MathjsUnitParseHost {
  const meter = { dimensions: [1, 0, 0, 0, 0, 0, 0, 0, 0], base: { key: 'LENGTH' } };
  class MockUnitHost {
    units: { unit: typeof meter; prefix: null; power: number }[] = [];
    dimensions: number[] = new Array(9).fill(0);
    value: unknown = null;
    _normalize(value: unknown): unknown {
      return value;
    }
    static BASE_DIMENSIONS = [
      'LENGTH',
      'MASS',
      'TIME',
      'CURRENT',
      'TEMPERATURE',
      'LUMINOUS',
      'AMOUNT',
      'ANGLE',
      'BIT',
    ];
    static UNIT_SYSTEMS = { auto: {} as Record<string, unknown> };
    static typeConverters = {
      BigNumber: (x: unknown) => ({ t: 'bn', x: String(x) }),
      Fraction: (x: unknown) => {
        if (overrides?.fractionAlwaysThrows) throw new SyntaxError('bad fraction');
        return { t: 'fr', x: String(x) };
      },
    };
    static _findUnit =
      overrides?.findUnit ??
      ((name: string) => (name === 'm' || name === 'meter' ? { unit: meter, prefix: null } : null));
    static isValidAlpha = overrides?.isValidAlpha ?? ((c: string) => /[a-zA-Z]/.test(c));
  }
  return MockUnitHost as unknown as MathjsUnitParseHost;
}

describe('mathjs Unit.parse (compat)', () => {
  const math = create(all);
  const Unit = math.Unit as unknown as UnitClass;
  const parseUnknown = Unit.parse as unknown as (
    s: unknown,
    o?: { allowNoUnits?: boolean }
  ) => void;

  it('rejects non-string input', () => {
    expect(() => parseUnknown(12)).toThrow(TypeError);
  });

  it('parses scientific notation in the unit string', () => {
    expect(Unit.parse('1.5e2 m').toString()).toMatch(/150 m/);
  });

  it('reports parse syntax errors', () => {
    expect(() => Unit.parse('1 @ m')).toThrow(/Unexpected/);
    expect(() => Unit.parse('1 notaunit')).toThrow(/not found/);
    expect(() => Unit.parse('m^')).toThrow(/\^.*floating-point/);
    expect(() => Unit.parse('1 m)')).toThrow(/Unmatched "\)"/);
    expect(() => Unit.parse('1 (m')).toThrow(/Unmatched "\("/);
    expect(() => Unit.parse('3')).toThrow(/contains no units/);
    expect(Unit.parse('3', { allowNoUnits: true }).toString()).toBe('3');
  });

  it('honors explicit multiply and divide after the numeric value', () => {
    expect(Unit.parse('2 * m').toString()).toBe('2 m');
    expect(Unit.parse('4 / s').toString()).toMatch(/^4 (\/ s|s\^-1)$/);
  });

  it('uses BigNumber and Fraction config when parsing the value', () => {
    const bn = create(all, { number: 'BigNumber' });
    const BnUnit = bn.Unit as unknown as UnitClass;
    expect(String(BnUnit.parse('1.25 m').value)).toBe('1.25');

    const fr = create(all, { number: 'Fraction' });
    const FrUnit = fr.Unit as unknown as UnitClass;
    const parsed = FrUnit.parse('0.5 m');
    expect(parsed.toString()).toMatch(/0.5 m|1\/2 m/);
  });
});

describe('createMathjsUnitParse (direct)', () => {
  it('covers number modes and trailing parse errors on a minimal host', () => {
    const parse = createMathjsUnitParse(mockParseHost(), () => 'number');
    const ok = parse('2 * meter');
    expect(ok.value).toBe(2);
    expect(ok.units).toHaveLength(1);

    const parseBn = createMathjsUnitParse(mockParseHost(), () => 'BigNumber');
    expect(parseBn('3.5 m').value).toEqual({ t: 'bn', x: '3.5' });

    expect(createMathjsUnitParse(mockParseHost(), () => 'Fraction')('1.25 m').value).toEqual({
      t: 'fr',
      x: '1.25',
    });
    expect(
      createMathjsUnitParse(
        mockParseHost({ fractionAlwaysThrows: true }),
        () => 'Fraction'
      )('1.25 m').value
    ).toBe(1.25);

    expect(parse('+2 meter').value).toBe(2);

    expect(() => parse('meter/')).toThrow(/Trailing characters/);
    expect(parse('.5 m').value).toBe(0.5);
    expect(parse('1 m * m').units).toHaveLength(2);
  });

  it('covers exponent disambiguation and bare numeric edge cases', () => {
    const parse = createMathjsUnitParse(
      mockParseHost({
        findUnit: (name) => {
          const meter = { dimensions: [1, 0, 0, 0, 0, 0, 0, 0, 0], base: { key: 'LENGTH' } };
          if (name === 'm') return { unit: meter, prefix: null };
          if (name === 'exa') return { unit: meter, prefix: null };
          return null;
        },
      }),
      () => undefined
    );

    expect(parse('1.2e3 m').value).toBe(1200);
    expect(parse('4exa m').units).toHaveLength(2);
    expect(parse('2e+1 m').value).toBe(20);

    const parseNoValue = createMathjsUnitParse(mockParseHost(), () => undefined);
    expect(() => parseNoValue('42')).toThrow(/contains no units/);
    expect(parseNoValue('42', { allowNoUnits: true }).units).toHaveLength(0);
  });
});

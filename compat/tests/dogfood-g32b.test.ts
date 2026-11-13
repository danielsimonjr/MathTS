import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { fraction } from '../src/shims.js';
import { Fraction } from '@danielsimonjr/mathts-core';

type UnitOut = { toString(): string; toNumber(): number };
type Formattable = { format(options: { precision: number }): string };

type G32bApi = {
  fraction: (n: number, d: number) => unknown;
  config: (c?: { matrix: string }) => { matrix: string };
  size: (x: unknown) => { constructor: { name: string }; toArray?: () => number[] };
  zeros: (...dims: number[]) => unknown;
  createUnit: (name: string, def: string, options?: { override?: boolean }) => void;
  evaluate: (expr: string) => unknown;
  unit: (v: number, u: string) => { to: (u: string) => UnitOut };
};

describe('dogfood G32b formatting and units', () => {
  const mt = create(all) as unknown as G32bApi;

  it('#743 Fraction toString and toJSON match mathjs style', () => {
    expect(String(fraction(0.1))).toBe('0.1');
    expect(String(new Fraction(1n, 10n))).toBe('0.1');
    const third = mt.fraction(1, 3) as unknown as { n: number; d: number };
    expect(String(third)).toBe('0.(3)');
    const j = JSON.parse(JSON.stringify(third));
    expect(j).toEqual({ mathjs: 'Fraction', n: 1, d: 3 });
    const huge = new Fraction(2n ** 60n, 3n).toJSON();
    expect(huge.n).toBe((2n ** 60n).toString());
    expect(huge.d).toBe(3);
  });

  it('#744 size formats as [2, 3] when config.matrix is Matrix', () => {
    mt.config({ matrix: 'Matrix' });
    const s = mt.size(mt.zeros(2, 3));
    expect(String(s)).toBe('[2, 3]');
    expect(s.constructor.name).toBe('MathJSDenseMatrix');
    expect(
      String(
        mt.size([
          [1, 2, 3],
          [4, 5, 6],
        ])
      )
    ).toBe('[2, 3]');

    mt.config({ matrix: 'Array' });
    const asArray = mt.size(mt.zeros(2, 3));
    expect(Array.isArray(asArray)).toBe(true);
    expect(asArray).toEqual([2, 3]);
    mt.config({ matrix: 'Matrix' });
  });

  it('#739 createUnit replaces furlong only with an explicit override', () => {
    expect(() => mt.createUnit('furlong', '220 yard')).toThrow(/already exists/);
    expect(() => mt.createUnit('furlong', '1 meter')).toThrow(/already exists/);
    expect(() => mt.createUnit('furlong', '220 yard', { override: true })).not.toThrow();
    expect(String(mt.evaluate('1 furlong to meter'))).toContain('201.168');
  });

  it('#739 safe evaluate cannot reach createUnit', () => {
    expect(() => mt.evaluate('createUnit("sneakyUnit", "1 m")')).toThrow();
    expect(() => mt.unit(1, 'sneakyUnit')).toThrow();
  });

  it('#742 litre to millilitre is exactly 1000 mL via rational scales', () => {
    const litres: UnitOut = mt.unit(1, 'L').to('mL');
    expect(String(litres)).toBe('1000 mL');
    expect(litres.toNumber()).toBe(1000);
    const km: UnitOut = mt.unit(1, 'km').to('m');
    expect(String(km)).toBe('1000 m');
    expect(km.toNumber()).toBe(1000);
    const foot: UnitOut = mt.unit(1, 'ft').to('inch');
    expect(foot.toNumber()).toBe(12);
    expect(String(foot)).toBe('12 inch');
  });

  it('#742 the other two pairs of the report: exact scales round once', () => {
    // mathjs 13 and 15 print 1.9685039370078743 inch and 211.99999999999997 degF:
    // they divide or add rounded doubles. 250/127 and 212 are the nearest doubles.
    expect(String(mt.unit(5, 'cm').to('inch'))).toBe('1.968503937007874 inch');
    expect(String(mt.unit(100, 'degC').to('degF'))).toBe('212 degF');
    expect(mt.unit(100, 'degC').to('degF').toNumber()).toBe(212);
  });

  it('#742 a fixed precision makes the strings of both libraries agree', () => {
    const format = (u: UnitOut): string => (u as unknown as Formattable).format({ precision: 14 });
    expect(format(mt.unit(5, 'cm').to('inch'))).toBe('1.9685039370079 inch');
    expect(format(mt.unit(1, 'L').to('mL'))).toBe('1000 mL');
    expect(format(mt.unit(100, 'degC').to('degF'))).toBe('212 degF');
  });
});

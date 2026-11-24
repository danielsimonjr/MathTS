import { describe, expect, it } from 'vitest';
import * as oracle from 'mathjs';
import {
  all,
  cbrt,
  combinations,
  compareNatural,
  create,
  derivative,
  erf,
  log1p,
  log2,
  median,
  norm,
  round,
  toBest,
} from '../src/index.js';

describe('named compatibility function imports', () => {
  it('matches the upstream results across mathematical categories', () => {
    expect(combinations(12, 3)).toBe(oracle.combinations(12, 3));
    expect(log2(16)).toBe(oracle.log2(16));
    expect(median([1, 9, 5])).toBe(oracle.median([1, 9, 5]));
    expect(erf(0.5)).toBeCloseTo(oracle.erf(0.5), 14);
    expect(String(derivative('x^2', 'x'))).toBe(oracle.derivative('x^2', 'x').toString());
  });

  it('accepts string infinity norms for vectors and matrices', () => {
    const vector = [-5, 2, 3];
    for (const p of ['inf', '-inf']) {
      expect(norm(vector, p)).toBe(oracle.norm(vector, p));
    }

    const math = create(all);
    const data = [
      [1, 2],
      [3, 4],
    ];
    const expected = oracle.norm(data, 'inf');
    expect(norm(data, 'inf')).toBe(expected);
    expect(math.norm(math.matrix(data), 'inf')).toBe(expected);
    expect(math.norm(math.sparse(data), 'inf')).toBe(expected);
    expect(math.evaluate('norm([[1, 2], [3, 4]], "inf")')).toBe(expected);
  });

  it('accepts complex values and an optional base for log1p', () => {
    const math = create(all);
    const value = math.complex(1, 2);
    const expected = oracle.log1p(oracle.complex(1, 2));
    const actual = log1p(value);
    expect(actual.re).toBeCloseTo(expected.re, 14);
    expect(actual.im).toBeCloseTo(expected.im, 14);
    expect(log1p(9999, 10)).toBeCloseTo(oracle.log1p(9999, 10), 14);
    expect(math.log1p(9999, 10)).toBeCloseTo(4, 14);
    expect(math.evaluate('log1p(9999, 10)')).toBeCloseTo(4, 14);
    expect(() => log1p([1, 2], 10)).toThrow();
  });

  it('takes cube roots of values with units', () => {
    const math = create(all);
    for (const [value, unit] of [
      [27, 'm'],
      [64, 'cm'],
    ] as const) {
      const expected = oracle.cbrt(oracle.unit(value, unit + '^3'));
      const named = cbrt(math.unit(value, unit + '^3')) as typeof math.speedOfLight;
      const evaluated = math.evaluate('cbrt(' + value + ' ' + unit + '^3)') as typeof named;
      expect(named.toNumeric(unit)).toBeCloseTo(Number(expected.toNumeric(unit)), 12);
      expect(evaluated.toNumeric(unit)).toBeCloseTo(Number(expected.toNumeric(unit)), 12);
    }
  });

  it('rounds units after converting to the requested target unit', () => {
    const math = create(all);
    const target = math.unit('cm');
    const oracleTarget = oracle.unit('cm');
    const value = math.unit('3.241 cm');
    const oracleValue = oracle.unit('3.241 cm');
    const rounded = round(value, 2, target) as typeof math.speedOfLight;
    const integral = round(value, target) as typeof math.speedOfLight;
    expect(integral.toNumeric('cm')).toBeCloseTo(
      Number(oracle.round(oracleValue, oracleTarget).toNumeric('cm')),
      14
    );
    expect(rounded.toNumeric('cm')).toBeCloseTo(
      Number(oracle.round(oracleValue, 2, oracleTarget).toNumeric('cm')),
      14
    );
    expect(String(math.evaluate('round(3.241 cm, 2, cm)'))).toBe('3.24 cm');
    expect(String(round([value, math.unit('2.178 cm'), 0], 2, target))).toBe('3.24 cm,2.18 cm,0');
  });

  it('allows preferred units and an offset in toBest', () => {
    const math = create(all);
    const value = math.unit(10, 'm') as typeof math.speedOfLight;
    const expected = oracle.unit(10, 'm');
    const options = { offset: 1.5 };
    const oracleToBest = oracle.toBest as unknown as (
      value: typeof expected,
      units: string | string[],
      options?: { offset: number }
    ) => typeof expected;
    expect(String(toBest(value, 'cm'))).toBe(String(oracleToBest(expected, ['cm'])));
    expect(String(math.toBest(value, ['mm', 'km'], options))).toBe(
      String(oracleToBest(expected, ['mm', 'km'], options))
    );
    expect(String(math.evaluate('toBest(unit(10, "m"), "mm,km", {offset: 1.5})'))).toBe(
      String(oracleToBest(expected, ['mm', 'km'], options))
    );
  });

  it('naturally orders units by normalized magnitude and dimension', () => {
    const math = create(all);
    for (const [left, right] of [
      ['5 cm', '40 mm'],
      ['1 m', '1000 mm'],
      ['1 m', '1 s'],
    ]) {
      expect(compareNatural(math.unit(left), math.unit(right))).toBe(
        oracle.compareNatural(oracle.unit(left), oracle.unit(right))
      );
    }
    expect(math.evaluate('compareNatural(5cm, 40mm)')).toBe(1);
  });
});

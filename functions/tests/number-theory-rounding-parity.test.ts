import { describe, expect, it } from 'vitest';
import * as ref from 'mathjs';
import { BigNumber, round as coreRound } from '@danielsimonjr/mathts-core';
import {
  bignumber,
  evaluate,
  factorial,
  gcd,
  hypot,
  multinomial,
  pow,
  rightLogShift,
  round,
} from '../src/index.js';

describe('number-theory parity (#1338)', () => {
  it('requires integers for BigNumber factorial and converts multinomial numeric strings', () => {
    expect(() => factorial(bignumber(2.5))).toThrow(/Integer BigNumber expected/);
    expect(multinomial(['2', '3'])).toBe(10);
    expect(gcd([4, 6], [8, 10], 2)).toEqual([2, 2]);
    expect(() => rightLogShift(bignumber(5), 1)).toThrow(TypeError);
    expect(() => evaluate('rightLogShift(bignumber(5), 1)')).toThrow(TypeError);
  });
});

describe('rounding and complex scalar parity (#1339)', () => {
  it('rounds arrays and preserves bigint when a precision is supplied', () => {
    expect(round([1.25, 2.46], 1)).toEqual(ref.round([1.25, 2.46], 1));
    for (const places of [-1, 0, 0.5, 1]) expect(round(55n, places)).toBe(55n);
    expect(round(5n)).toBe(5n);
  });

  it('applies a tolerance snap to the core BigNumber scalar rounding', () => {
    const value = new BigNumber('0.4999999999999999999');
    expect(String(coreRound(value))).toBe(String(ref.round(ref.bignumber(String(value)))));
    expect(String(coreRound(new BigNumber('0.499999')))).toBe('0');
  });

  it('matches the principal complex root and keeps the exact imaginary zero', () => {
    expect(JSON.stringify(pow(-8, 1 / 3))).toBe(JSON.stringify(ref.pow(-8, 1 / 3)));
    expect(evaluate('sqrt(-4)^2')).toMatchObject({ re: -4, im: 0 });
    const result = hypot(bignumber(2), NaN);
    expect(result).toBeInstanceOf(BigNumber);
    expect((result as BigNumber).isNaN()).toBe(true);
  });
});

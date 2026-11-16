/**
 * `number`, `string` and `boolean` follow mathjs. The three functions were bare `Number(x)`,
 * `String(x)` and `Boolean(x)` wrappers. So `boolean('false')` and `boolean(bignumber(0))` gave
 * true. An invalid string gave NaN with no error. No function mapped an array or a matrix.
 */
import { describe, it, expect } from 'vitest';
import { number, string, boolean, fraction, matrix, unit, complex } from '../src/index.js';
import { BigNumber } from '@danielsimonjr/mathts-core';

const arr = (m: unknown) => (m as { toArray(): unknown }).toArray();

describe('number', () => {
  it('maps an array and a matrix element-wise', () => {
    expect(number([1, '2', true])).toEqual([1, 2, 1]);
    expect(arr(number(matrix(['1', '2'])))).toEqual([1, 2]);
  });
  it('an invalid string throws', () => {
    expect(() => number('abc')).toThrow(/not a valid number/);
    expect(Number.isNaN(number('NaN'))).toBe(true);
  });
  it('converts a unit to a value in a valueless unit', () => {
    expect(number(unit('5 cm'), 'mm')).toBeCloseTo(50, 12);
    expect(() => number(0.5, 'cm')).toThrow(TypeError);
    const u = number(unit(BigNumber.parse('5'), 'cm')) as { value: unknown; toString(): string };
    expect(u.value).toBeCloseTo(0.05, 15); // a Unit stores its value in SI, as in mathjs
    expect(u.toString()).toBe('5 cm');
  });
  it('keeps the existing conversions', () => {
    expect(number()).toBe(0);
    expect(number(null)).toBe(0);
    expect(number('')).toBe(0);
    expect(number('0x1f')).toBe(31);
    expect(number(10n)).toBe(10);
    expect(number(BigNumber.parse('2.5'))).toBe(2.5);
    expect(number(fraction(1, 4))).toBe(0.25);
  });
});

describe('string', () => {
  it('maps an array and a matrix element-wise', () => {
    expect(string([1, 2])).toEqual(['1', '2']);
    expect(arr(string(matrix([1, 2])))).toEqual(['1', '2']);
  });
  it('keeps the existing conversions', () => {
    expect(string()).toBe('');
    expect(string(null)).toBe('null');
    expect(string(complex(1, 2))).toBe('1 + 2i');
    expect(string(BigNumber.parse('0.1'))).toBe('0.1');
  });
});

describe('boolean', () => {
  it.each([
    ['true', true],
    ['false', false],
    ['TRUE', true],
    ['False', false],
    ['0', false],
    ['1', true],
    ['2.5', true],
    [' 1', true],
  ])('string %s is %s', (s, want) => {
    expect(boolean(s)).toBe(want);
  });
  it('a string that is not a boolean or a number throws', () => {
    expect(() => boolean('yes')).toThrow(/to a boolean/);
    expect(() => boolean('  true ')).toThrow(/to a boolean/);
    expect(() => boolean('')).toThrow(/to a boolean/);
  });
  it('a zero BigNumber, Fraction or bigint is false', () => {
    expect(boolean(BigNumber.parse('0'))).toBe(false);
    expect(boolean(BigNumber.parse('0.5'))).toBe(true);
    expect(boolean(fraction(0, 1))).toBe(false);
    expect(boolean(0n)).toBe(false);
    expect(boolean(3n)).toBe(true);
  });
  it('maps an array and a matrix element-wise', () => {
    expect(boolean([0, 1])).toEqual([false, true]);
    expect(arr(boolean(matrix([0, 2])))).toEqual([false, true]);
  });
  it('keeps the existing conversions', () => {
    expect(boolean(null)).toBe(false);
    expect(boolean(0)).toBe(false);
    expect(boolean(7)).toBe(true);
  });
});

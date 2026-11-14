/**
 * A string argument converts to a number before any other numeric type, as in mathjs. When two
 * signatures each need one conversion per string argument, typed-function picks the one whose
 * conversions come first in the list, so the order of the string conversions decides the result.
 */
import { describe, expect, it } from 'vitest';
import { createMathTSTyped } from '../../src/index.js';

const typed = createMathTSTyped();

const pick = typed('pick', {
  'number, number': () => 'number',
  'BigNumber, BigNumber': () => 'BigNumber',
  'bigint, bigint': () => 'bigint',
  'Fraction, Fraction': () => 'Fraction',
  'Complex, Complex': () => 'Complex',
}) as (a: unknown, b: unknown) => string;

const one = typed('one', {
  number: () => 'number',
  BigNumber: () => 'BigNumber',
  bigint: () => 'bigint',
  Fraction: () => 'Fraction',
  Complex: () => 'Complex',
}) as (a: unknown) => string;

describe('string conversion order', () => {
  it('converts two strings to numbers', () => {
    expect(pick('3', '2')).toBe('number');
  });

  it('converts one string to a number', () => {
    expect(one('3')).toBe('number');
  });
});

describe('string to number conversion', () => {
  const value = typed('value', { number: (x: number) => x }) as (a: unknown) => number;

  it('reads the whole string, as Number() does', () => {
    expect(value('0x1F')).toBe(31);
    expect(value(' 2 ')).toBe(2);
    expect(value('1e3')).toBe(1000);
  });

  it('rejects a string with trailing characters', () => {
    expect(() => value('3abc')).toThrow('Cannot convert "3abc" to a number');
  });
});

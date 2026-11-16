/**
 * `new Fraction(x)` takes a decimal or ratio string and a BigNumber exactly, as mathjs `fraction` does.
 * The constructor sent the string and the BigNumber to `BigInt(x)`, so `fraction('0.5')`, `fraction('1/3')` and
 * `fraction(bignumber(0.5))` threw "cannot be converted to a BigInt".
 * @module @danielsimonjr/mathts-core/tests/types/fraction-string-bignumber
 */

import { describe, it, expect } from 'vitest';
import { Fraction } from '../../src/types/fraction';
import { BigNumber } from '../../src/types/bignumber';

const ratio = (f: Fraction) => `${f.numerator}/${f.denominator}`;

describe('new Fraction(string)', () => {
  it.each([
    ['0.5', '1/2'],
    ['-0.25', '-1/4'],
    ['1/3', '1/3'],
    ['-2.75', '-11/4'],
    ['3', '3/1'],
    ['0.(3)', '1/3'],
    ['1e-3', '1/1000'],
    ['2.5E2', '250/1'],
    ['-1.5e-2', '-3/200'],
  ])('%s is %s, exactly', (s, want) => {
    expect(ratio(new Fraction(s))).toBe(want);
  });

  it('a string denominator divides', () => {
    expect(ratio(new Fraction('1', '0.5'))).toBe('2/1');
  });

  it('a string that is not a number throws', () => {
    expect(() => new Fraction('abc')).toThrow();
  });
});

describe('new Fraction(BigNumber)', () => {
  it.each([
    ['0.5', '1/2'],
    ['-0.25', '-1/4'],
    ['3', '3/1'],
    ['123456789.125', '987654313/8'],
    ['1e-30', `1/1${'0'.repeat(30)}`],
    ['12345678901234567890.5', '24691357802469135781/2'],
  ])('%s is %s, exactly', (s, want) => {
    expect(ratio(new Fraction(BigNumber.parse(s)))).toBe(want);
  });

  it('a non-finite BigNumber throws', () => {
    expect(() => new Fraction(BigNumber.parse('Infinity'))).toThrow();
  });
});

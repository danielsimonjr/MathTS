/**
 * `bin`, `hex` and `oct` format a BigNumber exactly. The function refused a non-integer. The
 * function also read the value through `toNumber()`, so an integer above 2^53 lost its low
 * digits: `hex(bignumber(2^60 + 1))` gave 0x1000000000000000.
 */
import { describe, it, expect } from 'vitest';
import { bin, hex, oct } from '../src/index.js';
import { BigNumber } from '@danielsimonjr/mathts-core';

const bn = (s: string) => BigNumber.parse(s);

describe('bin / hex / oct of a BigNumber', () => {
  it.each([
    ['2.5', '0b10.1', '0x2.8', '0o2.4'],
    ['-2.5', '-0b10.1', '-0x2.8', '-0o2.4'],
    ['1.75', '0b1.11', '0x1.c', '0o1.6'],
    ['255', '0b11111111', '0xff', '0o377'],
  ])('%s matches mathjs', (x, b, h, o) => {
    expect(bin(bn(x))).toBe(b);
    expect(hex(bn(x))).toBe(h);
    expect(oct(bn(x))).toBe(o);
  });

  it('keeps every digit of an integer above 2^53', () => {
    const v = 2n ** 60n + 1n;
    expect(hex(bn(v.toString()))).toBe('0x' + v.toString(16));
    expect(bin(bn(v.toString()))).toBe('0b' + v.toString(2));
    expect(oct(bn(v.toString()))).toBe('0o' + v.toString(8));
  });

  it('formats a word size exactly', () => {
    expect(hex(bn((2n ** 60n + 1n).toString()), 64)).toBe('0x1000000000000001i64');
    expect(hex(bn('-1'), 64)).toBe('0xffffffffffffffffi64');
    expect(hex(bn('-1'), 8)).toBe('0xffi8');
  });

  it('a non-integer with a word size throws', () => {
    expect(() => hex(bn('2.5'), 8)).toThrow(/integer/);
  });
});

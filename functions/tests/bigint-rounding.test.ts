/**
 * `bigint(x)` rounds a non-integer to the nearest integer, half away from zero, as mathjs does.
 * The function sent every value to `BigInt(x)`, so `bigint(2.5)` threw. A large BigNumber went
 * through a float: `bigint(bignumber('1e30'))` gave 1000000000000000019884624838656n.
 */
import { describe, it, expect } from 'vitest';
import { bigint, fraction, matrix } from '../src/index.js';
import { BigNumber } from '@danielsimonjr/mathts-core';

describe('bigint', () => {
  it.each([
    [2.5, 3n],
    [-2.5, -3n],
    [3.5, 4n],
    [0.5, 1n],
    [-0.5, -1n],
    [2.4, 2n],
    [-2.4, -2n],
    [7, 7n],
    [1e20, 100000000000000000000n],
  ])('number %d is %s', (x, want) => {
    expect(bigint(x)).toBe(want);
  });

  it.each([
    ['2.5', 3n],
    ['-2.5', -3n],
    ['0.5', 1n],
    ['2.4999', 2n],
    ['1e30', 10n ** 30n],
    ['-12345678901234567890.5', -12345678901234567891n],
  ])('BigNumber %s is %s, exactly', (x, want) => {
    expect(bigint(BigNumber.parse(x))).toBe(want);
  });

  it('a Fraction rounds half away from zero', () => {
    expect(bigint(fraction(5, 2))).toBe(3n);
    expect(bigint(fraction(-5, 2))).toBe(-3n);
    expect(bigint(fraction(7, 3))).toBe(2n);
  });

  it('keeps the old cases', () => {
    expect(bigint()).toBe(0n);
    expect(bigint(null)).toBe(0n);
    expect(bigint(true)).toBe(1n);
    expect(bigint(10n)).toBe(10n);
    expect(bigint('42')).toBe(42n);
  });

  it('maps an array and a matrix element-wise', () => {
    expect(bigint([2.5, -0.5])).toEqual([3n, -1n]);
    const m = bigint(matrix([1.5, 2])) as { toArray(): unknown };
    expect(m.toArray()).toEqual([2n, 2n]);
  });

  it('a non-finite value throws', () => {
    expect(() => bigint(NaN)).toThrow();
    expect(() => bigint(Infinity)).toThrow();
  });
});

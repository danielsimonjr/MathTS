/**
 * P7-2 pins: flat-array prod number fast path and fallbacks.
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { prod } from '../src/factories/index.js';

describe('P7-2 prod number path', () => {
  it('seeded n = 10_000 (bit-exact golden)', () => {
    const a: number[] = [];
    let s = 0x7002002;
    for (let i = 0; i < 10_000; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      a.push(0.999 + (s / 0xffffffff) * 0.002);
    }
    let p = a[0];
    for (let i = 1; i < a.length; i++) p *= a[i];
    expect(Object.is(prod(a), p)).toBe(true);
  });

  it('single element', () => {
    expect(prod([7])).toBe(7);
  });

  it('-0 element', () => {
    expect(Object.is(prod([2, -0, 3]), -0)).toBe(true);
  });

  it('NaN', () => {
    expect(Object.is(prod([1, NaN, 2]), NaN)).toBe(true);
  });

  it('Infinity times 0', () => {
    expect(Object.is(prod([Infinity, 0]), NaN)).toBe(true);
  });

  it('Fraction last falls back to generic path', () => {
    const a: unknown[] = new Array(200).fill(2);
    a[199] = new Fraction(1, 2);
    expect(prod(a)).toEqual(new Fraction(1, 2 ** 199));
  });

  it('numeric strings', () => {
    expect(prod(['2', '3'])).toBe(6);
  });

  it('2-D array', () => {
    expect(
      prod([
        [2, 3],
        [4, 5],
      ])
    ).toBe(120);
  });

  it('prod(A, 1)', () => {
    expect(
      prod(
        [
          [2, 3],
          [4, 5],
        ],
        1
      )
    ).toEqual([8, 15]);
  });

  it('empty array error', () => {
    expect(() => prod([])).toThrow('Cannot calculate prod of an empty array');
  });
});

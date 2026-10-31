/**
 * P7-2 pins: flat-array prod number fast path and fallbacks.
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { bignumber, matrix, prod } from '../src/factories/index.js';

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
    const result = prod(a);
    expect(result).toMatchObject({ type: 'Fraction' });
    expect((result as Fraction).valueOf()).toBe(2 ** 199 / 2);
  });

  it('numeric strings', () => {
    expect(prod(['2', '3'])).toBe(6);
  });

  it('a numeric string after numbers is converted by the generic path', () => {
    expect(prod([2, 3, '4'])).toBe(24);
  });

  it('a nested array after numbers continues the fold from the partial product', () => {
    expect(prod([2, 3, [4, 5]])).toBe(120);
    expect(prod([2, [3, 4], 5])).toBe(120);
  });

  it('numbers then a BigNumber continue the fold with BigNumber arithmetic', () => {
    expect(String(prod([2, 3, bignumber('7')]))).toBe('42');
  });

  it('the partial product of the leading numbers is not recomputed or lost', () => {
    const a: unknown[] = new Array(50).fill(1.0000001);
    a.push('2');
    let expected = a[0] as number;
    for (let i = 1; i < 50; i++) expected *= a[i] as number;
    expected *= 2;
    expect(Object.is(prod(a), expected)).toBe(true);
  });

  it('BigNumber array falls back to the generic path', () => {
    const result = prod([bignumber('2'), bignumber('3'), bignumber('7')]);
    expect(String(result)).toBe('42');
  });

  it('Array subclass stays on the generic path', () => {
    class Tagged extends Array<number> {}
    const t = Tagged.from([2, 3, 4]);
    expect(prod(t)).toBe(24);
  });

  it('DenseMatrix input', () => {
    expect(prod(matrix([2, 3, 4]))).toBe(24);
  });

  it('variadic call', () => {
    expect(prod(2, 3, 4)).toBe(24);
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
    ).toEqual([6, 20]);
  });

  it('empty array error', () => {
    expect(() => prod([])).toThrow('Cannot calculate prod of an empty array');
  });

  it('random mixes of numbers, numeric strings and nested arrays match a plain left fold', () => {
    let seed = 0x7002077;
    const next = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const flat = (xs: unknown[]): number[] =>
      xs.flatMap(
        (x) => (Array.isArray(x) ? flat(x) : [typeof x === 'string' ? Number(x) : x]) as number[]
      );
    for (let round = 0; round < 200; round++) {
      const n = 1 + Math.floor(next() * 30);
      const a: unknown[] = [];
      for (let i = 0; i < n; i++) {
        const r = next();
        const v = 0.5 + next();
        if (r < 0.08) a.push(String(v));
        else if (r < 0.14) a.push([v, 0.5 + next()]);
        else a.push(v);
      }
      const values = flat(a);
      let expected = values[0];
      for (let i = 1; i < values.length; i++) expected *= values[i];
      expect(Object.is(prod(a), expected)).toBe(true);
    }
  });
});

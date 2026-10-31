import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { factory_max, factory_min } from '../src/factories/index.js';

describe('P7-3 factory max/min number path', () => {
  it('factory_max seeded flat array', () => {
    const a: number[] = [];
    let s = 0x7003003;
    for (let i = 0; i < 1000; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      a.push(s / 0xffffffff);
    }
    expect(factory_max(a)).toBe(Math.max(...a));
  });

  it('NaN at start, middle, end', () => {
    expect(Object.is(factory_max([NaN, 1, 2]), NaN)).toBe(true);
    expect(Object.is(factory_max([1, NaN, 2]), NaN)).toBe(true);
    expect(Object.is(factory_max([1, 2, NaN]), NaN)).toBe(true);
  });

  it('±0 ordering', () => {
    expect(factory_max([-0, 0])).toBe(0);
    expect(Object.is(factory_min([-0, 0]), -0)).toBe(true);
  });

  it('Fraction last uses generic path', () => {
    const a: unknown[] = new Array(200).fill(1);
    a[199] = new Fraction(3, 2);
    expect(factory_max(a)).toEqual(new Fraction(3, 2));
  });

  it('empty array error', () => {
    expect(() => factory_max([])).toThrow('Cannot calculate max of an empty array');
  });
});

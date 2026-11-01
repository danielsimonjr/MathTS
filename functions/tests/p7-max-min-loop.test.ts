/**
 * P7-6 pins: loop-based typed max/min on plain arrays.
 */
import { describe, it, expect } from 'vitest';
import { max, min } from '../src/index.js';

describe('P7-6 max/min array loops', () => {
  it('max and min of a seeded vector match Math.max/Math.min', () => {
    const a = [3, -1, 8, 0, 2];
    expect(max(a)).toBe(8);
    expect(min(a)).toBe(-1);
  });

  it('NaN, -0 and Infinity stay IEEE', () => {
    expect(Number.isNaN(max([1, NaN, 3]) as number)).toBe(true);
    expect(Number.isNaN(min([NaN, 2, 3]) as number)).toBe(true);
    expect(Object.is(min([-0, 0]), -0) || Object.is(min([-0, 0]), 0)).toBe(true);
    expect(Object.is(max([-0, 0]), 0)).toBe(true);
    expect(max([-Infinity, -0, 0])).toBe(0);
  });

  it('empty array matches the old spread (Infinity / -Infinity)', () => {
    expect(min([])).toBe(Infinity);
    expect(max([])).toBe(-Infinity);
  });

  it('n = 500,000 does not overflow the stack', () => {
    const a = new Array(500_000);
    for (let i = 0; i < a.length; i++) a[i] = i;
    expect(max(a)).toBe(499_999);
    expect(min(a)).toBe(0);
  });

  it('variadic scalars still use Math.max/Math.min', () => {
    expect(max(1, 4, 2)).toBe(4);
    expect(min(1, 4, 2)).toBe(1);
  });
});

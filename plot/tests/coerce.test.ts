import { describe, it, expect } from 'vitest';
import { coerce1d, coerce2d } from '../src/coerce.js';
import { Complex } from '@danielsimonjr/mathts-core';

describe('coerce', () => {
  it('passes through number arrays and Float64Array', () => {
    expect(coerce1d([1, 2, 3])).toEqual([1, 2, 3]);
    expect(coerce1d(new Float64Array([4, 5]))).toEqual([4, 5]);
  });
  it('drops non-finite entries in 1d', () => {
    expect(coerce1d([1, NaN, 2, Infinity, 3])).toEqual([1, 2, 3]);
  });
  it('coerces core Complex via real part', () => {
    expect(coerce1d([new Complex(2, 5), new Complex(3, -1)])).toEqual([2, 3]);
  });
  it('flattens nested arrays', () => {
    expect(coerce1d([[1, 2], [3]])).toEqual([1, 2, 3]);
  });
  it('coerce2d keeps rows and marks non-finite as NaN gaps', () => {
    const g = coerce2d([
      [1, 2],
      [3, NaN],
    ]);
    expect(g[0]).toEqual([1, 2]);
    expect(Number.isNaN(g[1][1])).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { sortNumbersInPlace } from '../src/utils/sort-numbers.js';
import { medianNumbers } from '../src/utils/median-numbers.js';

describe('sortNumbersInPlace', () => {
  it('sorts finite values', () => {
    const a = [3, 1, 2];
    sortNumbersInPlace(a);
    expect(a).toEqual([1, 2, 3]);
  });

  it('NaN follows default compare (finite values first)', () => {
    const a = [NaN, 2, 1];
    sortNumbersInPlace(a);
    expect(a).toEqual([1, 2, NaN]);
  });
});

describe('medianNumbers', () => {
  it('odd and even lengths', () => {
    expect(medianNumbers([1, 3, 2])).toBe(2);
    expect(medianNumbers([1, 2, 3, 4])).toBe(2.5);
  });
});

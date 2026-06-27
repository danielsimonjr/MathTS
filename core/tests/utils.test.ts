import { describe, it, expect } from 'vitest';
import { isNumeric, isComplexLike, isMatrixArray } from '../src/utils';

describe('isNumeric', () => {
  it('should return true for valid numbers', () => {
    expect(isNumeric(42)).toBe(true);
    expect(isNumeric(3.14)).toBe(true);
    expect(isNumeric(-100)).toBe(true);
    expect(isNumeric(0)).toBe(true);
  });

  it('should return false for NaN', () => {
    expect(isNumeric(NaN)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isNumeric('42')).toBe(false);
    expect(isNumeric(null)).toBe(false);
    expect(isNumeric(undefined)).toBe(false);
    expect(isNumeric({})).toBe(false);
  });
});

describe('isComplexLike', () => {
  it('should return true for valid complex-like objects', () => {
    expect(isComplexLike({ re: 3, im: 4 })).toBe(true);
    expect(isComplexLike({ re: 0, im: 0 })).toBe(true);
    expect(isComplexLike({ re: -1, im: 2.5 })).toBe(true);
  });

  it('should return false for invalid complex-like objects', () => {
    expect(isComplexLike({ re: 3 })).toBe(false);
    expect(isComplexLike({ im: 4 })).toBe(false);
    expect(isComplexLike({ re: '3', im: 4 })).toBe(false);
    expect(isComplexLike(null)).toBe(false);
    expect(isComplexLike(42)).toBe(false);
  });
});

describe('isMatrixArray', () => {
  it('should return true for valid 2D numeric arrays', () => {
    expect(
      isMatrixArray([
        [1, 2],
        [3, 4],
      ])
    ).toBe(true);
    expect(isMatrixArray([[1]])).toBe(true);
    expect(isMatrixArray([[1, 2, 3]])).toBe(true);
  });

  it('should return false for invalid 2D numeric arrays', () => {
    expect(isMatrixArray([])).toBe(false);
    expect(isMatrixArray([1, 2, 3])).toBe(false);
    expect(
      isMatrixArray([
        [1, 'a'],
        [3, 4],
      ])
    ).toBe(false);
    expect(isMatrixArray(null)).toBe(false);
  });
});

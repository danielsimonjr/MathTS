import { describe, it, expect } from 'vitest';
import { isNumeric, isComplex, isMatrix } from '../src/utils';

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

describe('isComplex', () => {
  it('should return true for valid complex numbers', () => {
    expect(isComplex({ re: 3, im: 4 })).toBe(true);
    expect(isComplex({ re: 0, im: 0 })).toBe(true);
    expect(isComplex({ re: -1, im: 2.5 })).toBe(true);
  });

  it('should return false for invalid complex numbers', () => {
    expect(isComplex({ re: 3 })).toBe(false);
    expect(isComplex({ im: 4 })).toBe(false);
    expect(isComplex({ re: '3', im: 4 })).toBe(false);
    expect(isComplex(null)).toBe(false);
    expect(isComplex(42)).toBe(false);
  });
});

describe('isMatrix', () => {
  it('should return true for valid matrices', () => {
    expect(
      isMatrix([
        [1, 2],
        [3, 4],
      ])
    ).toBe(true);
    expect(isMatrix([[1]])).toBe(true);
    expect(isMatrix([[1, 2, 3]])).toBe(true);
  });

  it('should return false for invalid matrices', () => {
    expect(isMatrix([])).toBe(false);
    expect(isMatrix([1, 2, 3])).toBe(false);
    expect(
      isMatrix([
        [1, 'a'],
        [3, 4],
      ])
    ).toBe(false);
    expect(isMatrix(null)).toBe(false);
  });
});

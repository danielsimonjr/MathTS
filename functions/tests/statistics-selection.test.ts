/**
 * Statistics Selection Algorithm Tests
 *
 * Tests for quickSelect, medianSelect, minSelect, and maxSelect.
 */

import { describe, it, expect } from 'vitest';
import { quickSelect, medianSelect, minSelect, maxSelect } from '../src/typed/statistics.js';

const EPSILON = 1e-10;

function expectClose(actual: number, expected: number, tol = EPSILON) {
  expect(Math.abs(actual - expected)).toBeLessThan(tol);
}

// =============================================================================
// quickSelect
// =============================================================================

describe('quickSelect', () => {
  it('should find the k-th smallest element (0-indexed)', () => {
    const arr = [3, 1, 4, 1, 5, 9, 2, 6];
    // Sorted: [1, 1, 2, 3, 4, 5, 6, 9]
    expectClose(quickSelect(arr, 0), 1);
    expectClose(quickSelect(arr, 1), 1);
    expectClose(quickSelect(arr, 2), 2);
    expectClose(quickSelect(arr, 3), 3);
    expectClose(quickSelect(arr, 7), 9);
  });

  it('should work with the provided test case', () => {
    expectClose(quickSelect([3, 1, 4, 1, 5, 9], 2), 3);
  });

  it('should handle single-element array', () => {
    expectClose(quickSelect([42], 0), 42);
  });

  it('should handle two-element array', () => {
    expectClose(quickSelect([5, 3], 0), 3);
    expectClose(quickSelect([5, 3], 1), 5);
  });

  it('should not modify the original array', () => {
    const arr = [5, 3, 1, 4, 2];
    const copy = [...arr];
    quickSelect(arr, 2);
    expect(arr).toEqual(copy);
  });

  it('should throw for out-of-range k', () => {
    expect(() => quickSelect([1, 2, 3], -1)).toThrow(RangeError);
    expect(() => quickSelect([1, 2, 3], 3)).toThrow(RangeError);
  });

  it('should handle duplicate values', () => {
    const arr = [5, 5, 5, 5, 5];
    expectClose(quickSelect(arr, 0), 5);
    expectClose(quickSelect(arr, 4), 5);
  });

  it('should handle already sorted array', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expectClose(quickSelect(arr, 4), 5);
  });

  it('should handle reverse sorted array', () => {
    const arr = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    expectClose(quickSelect(arr, 4), 5);
  });
});

// =============================================================================
// medianSelect
// =============================================================================

describe('medianSelect', () => {
  it('should find median of odd-length array', () => {
    expectClose(medianSelect([3, 1, 2]), 2);
  });

  it('should find median of even-length array', () => {
    expectClose(medianSelect([4, 1, 3, 2]), 2.5);
  });

  it('should return NaN for empty array', () => {
    expect(medianSelect([])).toBeNaN();
  });

  it('should return single element', () => {
    expectClose(medianSelect([7]), 7);
  });

  it('should handle larger array', () => {
    expectClose(medianSelect([9, 1, 0, 2, 3, 4, 6, 8, 7, 10, 5]), 5);
  });

  it('should not modify the original array', () => {
    const arr = [5, 3, 1, 4, 2];
    const copy = [...arr];
    medianSelect(arr);
    expect(arr).toEqual(copy);
  });
});

// =============================================================================
// minSelect
// =============================================================================

describe('minSelect', () => {
  it('should find k smallest elements', () => {
    const result = minSelect([9, 3, 7, 1, 5, 8, 2, 6, 4], 3);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should return empty for k=0', () => {
    expect(minSelect([1, 2, 3], 0)).toEqual([]);
  });

  it('should return sorted array for k >= n', () => {
    const result = minSelect([3, 1, 2], 5);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should find single smallest', () => {
    const result = minSelect([5, 3, 8, 1, 9], 1);
    expect(result).toEqual([1]);
  });

  it('should handle duplicates', () => {
    const result = minSelect([3, 1, 1, 2, 3], 3);
    expect(result).toEqual([1, 1, 2]);
  });
});

// =============================================================================
// maxSelect
// =============================================================================

describe('maxSelect', () => {
  it('should find k largest elements', () => {
    const result = maxSelect([9, 3, 7, 1, 5, 8, 2, 6, 4], 3);
    expect(result).toEqual([9, 8, 7]);
  });

  it('should return empty for k=0', () => {
    expect(maxSelect([1, 2, 3], 0)).toEqual([]);
  });

  it('should return sorted descending for k >= n', () => {
    const result = maxSelect([3, 1, 2], 5);
    expect(result).toEqual([3, 2, 1]);
  });

  it('should find single largest', () => {
    const result = maxSelect([5, 3, 8, 1, 9], 1);
    expect(result).toEqual([9]);
  });

  it('should handle duplicates', () => {
    const result = maxSelect([3, 1, 3, 2, 1], 3);
    expect(result).toEqual([3, 3, 2]);
  });
});

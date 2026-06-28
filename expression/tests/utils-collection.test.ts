import { describe, it, expect } from 'vitest';
import { containsCollections, deepForEach, deepMap, reduce } from '../src/utils/collection.js';

// ---------------------------------------------------------------------------
// containsCollections
// ---------------------------------------------------------------------------
describe('containsCollections', () => {
  it('returns true when the array contains a nested array', () => {
    expect(containsCollections([[1, 2], 3])).toBe(true);
  });

  it('returns true when the array contains a Matrix-like object', () => {
    // isMatrix() checks obj.constructor?.prototype?.isMatrix === true
    function MatrixClass(this: unknown) {}
    MatrixClass.prototype.isMatrix = true;
    const matrix = new (MatrixClass as unknown as new () => unknown)();
    expect(containsCollections([1, matrix])).toBe(true);
  });

  it('returns false for arrays of scalars', () => {
    expect(containsCollections([1, 2, 3])).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(containsCollections([])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deepForEach (collection)
// ---------------------------------------------------------------------------
describe('deepForEach (collection)', () => {
  it('iterates over all scalar elements in a flat array', () => {
    const collected: number[] = [];
    deepForEach([1, 2, 3], (v: number) => collected.push(v));
    expect(collected).toEqual([1, 2, 3]);
  });

  it('iterates over all scalar elements in a nested array', () => {
    const collected: number[] = [];
    deepForEach(
      [
        [1, 2],
        [3, 4],
      ],
      (v: number) => collected.push(v)
    );
    expect(collected).toEqual([1, 2, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// deepMap (collection)
// ---------------------------------------------------------------------------
describe('deepMap (collection)', () => {
  it('maps over a flat array', () => {
    const result = deepMap([1, 2, 3], (v: number) => v * 10);
    expect(result).toEqual([10, 20, 30]);
  });

  it('maps over a nested array', () => {
    const result = deepMap(
      [
        [1, 2],
        [3, 4],
      ],
      (v: number) => v + 1
    );
    expect(result).toEqual([
      [2, 3],
      [4, 5],
    ]);
  });

  it('skips zeros when skipZeros is true', () => {
    const result = deepMap([0, 1, 2, 0], (v: number) => v * 10, true);
    // Zeros should be left as-is
    expect(result).toEqual([0, 10, 20, 0]);
  });

  it('does not skip zeros when skipZeros is false', () => {
    const result = deepMap([0, 1, 2], (v: number) => v * 10, false);
    expect(result).toEqual([0, 10, 20]);
  });
});

// ---------------------------------------------------------------------------
// reduce (collection)
// ---------------------------------------------------------------------------
describe('reduce (collection)', () => {
  it('reduces a 1-D array along dim 0 (sum)', () => {
    const result = reduce([1, 2, 3, 4], 0, (acc: number, val: number) => acc + val);
    expect(result).toBe(10);
  });

  it('reduces a 2-D array along dim 0 (column-wise sum)', () => {
    const mat = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const result = reduce(mat, 0, (acc: number, val: number) => acc + val) as number[];
    expect(result).toEqual([9, 12]);
  });

  it('reduces a 2-D array along dim 1 (row-wise sum)', () => {
    const mat = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const result = reduce(mat, 1, (acc: number, val: number) => acc + val) as number[];
    expect(result).toEqual([6, 15]);
  });

  it('throws DimensionError for out-of-range dim', () => {
    expect(() => reduce([1, 2, 3], 5, (a: number, b: number) => a + b)).toThrow();
    expect(() => reduce([1, 2, 3], -1, (a: number, b: number) => a + b)).toThrow();
  });
});

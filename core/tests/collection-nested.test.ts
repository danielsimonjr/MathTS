import { describe, it, expect } from 'vitest';
import { deepForEach, deepMap, reduce } from '../src/collection.js';
import { DimensionError } from '../src/error/DimensionError.js';

describe('collection nested types (runtime)', () => {
  it('deepMap preserves nested shape', () => {
    expect(deepMap([[1, 2], [3]], (n) => n + 1)).toEqual([[2, 3], [4]]);
  });

  it('deepForEach visits leaves in order', () => {
    const visited: number[] = [];
    deepForEach([[1, 2], [3]], (n) => visited.push(n));
    expect(visited).toEqual([1, 2, 3]);
  });

  it('reduce of a vector along dim 0 is a scalar', () => {
    expect(reduce([1, 2, 3], 0, (a, b) => Number(a) + Number(b))).toBe(6);
  });

  it('reduce along dim 0 on a matrix matches a loop oracle', () => {
    const mat = [
      [1, 2],
      [3, 4],
    ];
    const result = reduce(mat, 0, (acc, val) => Number(acc) + Number(val));
    const expected = mat[0].map((_, col) => mat.reduce((sum, row) => sum + row[col], 0));
    expect(result).toEqual(expected);
  });

  it('reduce of an empty vector along dim 0 returns undefined (legacy _reduce)', () => {
    expect(reduce([], 0, (a, b) => Number(a) + Number(b))).toBeUndefined();
  });

  it('throws DimensionError when dim is out of range', () => {
    expect(() => reduce([1, 2, 3], 5, (a, b) => Number(a) + Number(b))).toThrow(DimensionError);
    expect(() => reduce([1, 2, 3], -1, (a, b) => Number(a) + Number(b))).toThrow(DimensionError);
  });

  it('skipZeros: true leaves numeric zeros unchanged', () => {
    expect(deepMap([0, 2], (n) => n + 1, true)).toEqual([0, 3]);
  });
});

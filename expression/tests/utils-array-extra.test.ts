import { describe, it, expect } from 'vitest';
import {
  arraySize,
  validateIndexSourceSize,
  isEmptyIndex,
  resize,
  reshape,
  squeeze,
  concat,
  broadcastArrays,
  getArrayDataType,
} from '../src/utils/array.js';

const typeOf = (v: any): string => (Array.isArray(v) ? 'Array' : typeof v);

describe('arraySize - irregular / scalar edges', () => {
  it('returns [] for a scalar', () => {
    expect(arraySize(5 as any)).toEqual([]);
  });

  it('measures a nested rectangular array', () => {
    expect(
      arraySize([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toEqual([2, 3]);
  });
});

describe('validateIndexSourceSize', () => {
  it('passes when source size matches', () => {
    const value = [1, 2, 3];
    const index = { _sourceSize: [3] } as any;
    expect(() => validateIndexSourceSize(value, index)).not.toThrow();
  });

  it('ignores null source dimensions', () => {
    const value = [1, 2, 3];
    const index = { _sourceSize: [null] } as any;
    expect(() => validateIndexSourceSize(value, index)).not.toThrow();
  });

  it('throws when source size does not match the value', () => {
    const value = [1, 2, 3];
    const index = { _sourceSize: [5] } as any;
    expect(() => validateIndexSourceSize(value, index)).toThrow();
  });
});

describe('isEmptyIndex', () => {
  it('true for an empty string dimension', () => {
    const index = { _dimensions: [''] } as any;
    expect(isEmptyIndex(index)).toBe(true);
  });

  it('false for a non-empty string dimension', () => {
    const index = { _dimensions: ['abc'] } as any;
    expect(isEmptyIndex(index)).toBe(false);
  });

  it('true for an empty array dimension', () => {
    const index = { _dimensions: [{ _data: [], _size: [0] }] } as any;
    expect(isEmptyIndex(index)).toBe(true);
  });

  it('true for an empty range dimension (start === end)', () => {
    const index = { _dimensions: [{ isRange: true, start: 2, end: 2 }] } as any;
    expect(isEmptyIndex(index)).toBe(true);
  });

  it('false for a non-empty range dimension', () => {
    const index = { _dimensions: [{ isRange: true, start: 0, end: 3 }] } as any;
    expect(isEmptyIndex(index)).toBe(false);
  });
});

describe('resize - scalar input and shrink/grow', () => {
  it('wraps a scalar into an array', () => {
    expect(resize(5 as any, [3], 0)).toEqual([5, 0, 0]);
  });

  it('grows and fills with the default value (2-D)', () => {
    const result = resize([[1]], [2, 2], 9);
    expect(result).toEqual([
      [1, 9],
      [9, 9],
    ]);
  });

  it('shrinks an array', () => {
    expect(resize([1, 2, 3, 4], [2])).toEqual([1, 2]);
  });
});

describe('reshape - errors', () => {
  it('throws when sizes is empty', () => {
    expect(() => reshape([1, 2, 3], [])).toThrow();
  });

  it('throws when the product of sizes does not match', () => {
    expect(() => reshape([1, 2, 3, 4], [3, 2])).toThrow();
  });

  it('reshapes a flat array into a matrix', () => {
    expect(reshape([1, 2, 3, 4], [2, 2])).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe('squeeze - multi-dimensional', () => {
  it('removes singleton inner dimensions', () => {
    const result = squeeze([[[1], [2]]]);
    expect(result).toEqual([1, 2]);
  });

  it('squeezes a fully singleton array to a scalar', () => {
    expect(squeeze([[[5]]])).toBe(5);
  });
});

describe('concat / broadcastArrays - single-argument paths', () => {
  it('concat returns the single array when given one', () => {
    expect(concat([1, 2, 3], 0)).toEqual([1, 2, 3]);
  });

  it('broadcastArrays returns the single array when given one', () => {
    expect(broadcastArrays([1, 2, 3] as any)).toEqual([1, 2, 3]);
  });
});

describe('getArrayDataType', () => {
  it('returns the uniform type for a homogeneous array', () => {
    expect(getArrayDataType([1, 2, 3], typeOf)).toBe('number');
  });

  it('returns "mixed" for a mixed-type array', () => {
    expect(getArrayDataType([1, 'a'], typeOf)).toBe('mixed');
  });

  it('handles nested arrays of uniform type', () => {
    expect(
      getArrayDataType(
        [
          [1, 2],
          [3, 4],
        ],
        typeOf
      )
    ).toBe('number');
  });

  it('returns undefined for ragged nested arrays', () => {
    expect(getArrayDataType([[1, 2], [3]], typeOf)).toBeUndefined();
  });
});

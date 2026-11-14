import { describe, it, expect } from 'vitest';
import { reduce, validateDimension } from '../src/collection.js';
import { IndexError } from '../src/error/IndexError.js';

const add = (a: unknown, b: unknown) => (a as number) + (b as number);

describe('dimension validation (#1047)', () => {
  it('throws an IndexError with a true relation for an out-of-range dim', () => {
    expect(() => reduce([[1, 2]], 5, add)).toThrow(IndexError);
    expect(() => reduce([[1, 2]], 5, add)).toThrow('Index out of range (5 > 1)');
    expect(() => reduce([[1, 2]], -1, add)).toThrow('Index out of range (-1 < 0)');
  });

  it('throws a TypeError for a dim that is not an integer', () => {
    for (const dim of [1.5, NaN, Infinity]) {
      expect(() => reduce([[1, 2]], dim, add)).toThrow(TypeError);
      expect(() => reduce([[1, 2]], dim, add)).toThrow('Integer number expected for dimension');
    }
  });

  it('accepts every valid dim', () => {
    expect(reduce([[1, 2]], 0, add)).toEqual([1, 2]);
    expect(reduce([[1, 2]], 1, add)).toEqual([3]);
    expect(() => validateDimension(0, 1)).not.toThrow();
  });
});

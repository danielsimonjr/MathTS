/**
 * Issue #1045: the factory statistics functions accept typed arrays
 * the same way as plain arrays.
 */
import { describe, it, expect } from 'vitest';
import { mathTyped } from '@danielsimonjr/mathts-core';
import { adaptSparse } from '../src/factories/sparse-adapter.js';
import {
  factory_sum,
  factory_mean,
  factory_min,
  factory_max,
  factory_variance,
  factory_std,
  median as factory_median,
  mad as factory_mad,
  mode as factory_mode,
} from '../src/factories/index.js';

const kinds = [Float64Array, Float32Array, Int32Array, Uint8Array] as const;

describe('#1045 factory functions accept typed arrays', () => {
  for (const K of kinds) {
    const data = new K([1, 2, 3, 6]);
    it(`${K.name}: results equal the plain-array results`, () => {
      const plain = [1, 2, 3, 6];
      expect(factory_sum(data)).toBe(factory_sum(plain));
      expect(factory_mean(data)).toBe(factory_mean(plain));
      expect(factory_min(data)).toBe(factory_min(plain));
      expect(factory_max(data)).toBe(factory_max(plain));
      expect(factory_variance(data)).toBe(factory_variance(plain));
      expect(factory_std(data)).toBe(factory_std(plain));
    });
  }

  it('sum of a Float64Array is a number, not the array', () => {
    expect(factory_sum(new Float64Array([1, 2]))).toBe(3);
  });

  it('a typed array keeps its dim argument', () => {
    expect(factory_sum(new Float64Array([1, 2, 3]), 0)).toBe(6);
  });

  it('an empty typed array behaves like an empty array', () => {
    expect(factory_sum(new Float64Array([]))).toBe(factory_sum([]));
    expect(() => factory_mean(new Float64Array([]))).toThrow();
  });

  it('a typed array nested in a plain array behaves like a nested plain array', () => {
    expect(factory_sum([new Float64Array([1, 2])])).toBe(factory_sum([[1, 2]]));
    expect(factory_max([new Int32Array([1, 5]), new Int32Array([3, 4])])).toBe(5);
  });

  it('a function with a typed-array signature accepts a typed array with more arguments', () => {
    const t = new Float64Array([3, 1, 2]);
    expect(factory_median(t)).toBe(factory_median([3, 1, 2]));
    expect(factory_median(t, 0)).toEqual(factory_median([3, 1, 2], 0));
    // `mad` and `mode` take no dimension: as in mathjs, the extra argument is one more value (#964).
    // The public types refuse these two calls, so they go through loosely typed handles.
    const madOf = factory_mad as unknown as (...a: unknown[]) => unknown;
    const modeOf = factory_mode as unknown as (...a: unknown[]) => unknown;
    expect(madOf(t, 1)).toEqual(madOf([3, 1, 2], 1));
    expect(modeOf(new Float64Array([1, 1, 2]), 1)).toEqual(modeOf([1, 1, 2], 1));
  });

  it('the wrapper keeps a typed array only for a typed-array signature', () => {
    const probe = adaptSparse(
      mathTyped('probe', {
        Array: () => 'Array',
        'Array, number': () => 'Array, number',
        Float64Array: () => 'Float64Array',
        '...': () => 'rest',
      }) as (...args: unknown[]) => unknown,
      'probe'
    );
    const t = new Float64Array([1, 2]);
    expect(probe(t)).toBe('Float64Array');
    expect(probe(t, 1)).toBe('Array, number');
    // Core converts another number typed array to Float64Array, so the typed-array signature
    // matches and the wrapper keeps the typed array.
    expect(probe(new Int32Array([1, 2]))).toBe('Float64Array');
    expect(probe(new BigInt64Array([1n, 2n]))).toBe('Array');
    expect(probe(1, 2)).toBe('rest');
  });
});

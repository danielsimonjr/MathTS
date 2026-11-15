/**
 * Issue #1046: the public reductions accept every typed array with number elements.
 * `sum`, `mean`, `variance` and `std` also accept their values as separate arguments, as in mathjs.
 */
import { describe, it, expect } from 'vitest';
import { Fraction } from '@danielsimonjr/mathts-core';
import { sum, mean, min, max, variance, std, median } from '../src/index.js';

const kinds = [
  Float32Array,
  Int32Array,
  Uint32Array,
  Int16Array,
  Uint16Array,
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
] as const;

describe('#1046 public reductions accept every number typed array', () => {
  for (const K of kinds) {
    it(`${K.name} gives the Float64Array result`, () => {
      const t = new K([3, 1, 2, 6]);
      const f = new Float64Array([3, 1, 2, 6]);
      for (const fn of [sum, mean, min, max, variance, std, median] as ((
        x: unknown
      ) => unknown)[]) {
        expect(fn(t)).toBe(fn(f));
      }
    });
  }

  it('a BigInt64Array still throws a type error', () => {
    expect(() => (sum as (x: unknown) => unknown)(new BigInt64Array([1n, 2n]))).toThrow(TypeError);
  });
});

describe('#1046 sum, mean, variance and std take separate arguments', () => {
  it('numbers give the result of the array form', () => {
    expect((sum as (...a: number[]) => unknown)(1, 2, 3)).toBe(6);
    expect(mean(1, 2, 3)).toBe(2);
    expect(variance(1, 2, 3)).toBe(1);
    expect(std(1, 2, 3)).toBe(1);
    expect((sum as (...a: number[]) => unknown)(5)).toBe(5);
  });

  it('exact scalars stay exact', () => {
    const r = (sum as (...a: unknown[]) => unknown)(new Fraction(1, 3), new Fraction(2, 3));
    expect(r).toBeInstanceOf(Fraction);
    expect((r as Fraction).equals(new Fraction(1))).toBe(true);
    expect((sum as (...a: unknown[]) => unknown)(1n, 2n)).toBe(3n);
  });

  it('two arrays are not separate values', () => {
    expect(() => (sum as (...a: unknown[]) => unknown)([1, 2], [3, 4])).toThrow(TypeError);
    expect(() => (mean as (...a: unknown[]) => unknown)([1, 2], [3, 4])).toThrow(TypeError);
  });

  it('the public types accept a typed array and separate numbers', () => {
    // No cast: the typecheck of this file fails when the public types reject these calls.
    const fromTyped: number = mean(new Int32Array([1, 3]));
    const fromBytes: number = variance(new Uint8Array([1, 3]));
    const fromValues: number = mean(1, 2, 3);
    const fromStd: number = std(1, 2, 3);
    expect([fromTyped, fromBytes, fromValues, fromStd]).toEqual([2, 2, 2, 1]);
  });
});

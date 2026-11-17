/**
 * Dogfood #990 (part A): size arguments that would exhaust memory throw a RangeError
 * before the function allocates. Every row here throws at once or is small.
 */
import { describe, it, expect } from 'vitest';
import {
  zeros,
  ones,
  identity,
  range,
  hadamardMatrix,
  stirlingS1,
  stirlingS2,
  bellNumbers,
} from '../src/index.js';

describe('dogfood #990 allocation cap', () => {
  it('zeros and ones throw before they allocate', () => {
    expect(() => zeros(100000, 100000)).toThrow(
      new RangeError('zeros: result too large (100000×100000 exceeds limit of 100000000 elements)')
    );
    expect(() => ones(1e308)).toThrow(/ones: result too large/);
    expect(() => zeros([1e5, 1e5])).toThrow(RangeError);
  });

  it('identity throws before it allocates', () => {
    expect(() => identity([1e5, 1e5])).toThrow(RangeError);
    expect(() => identity(1e6)).toThrow(RangeError);
  });

  it('a sparse result is not limited', () => {
    expect((zeros(1e6, 1e6, 'sparse') as { size(): number[] }).size()).toEqual([1000000, 1000000]);
  });

  it('small results are unchanged', () => {
    const plain = (v: unknown): unknown =>
      Array.isArray(v) ? v : (v as { valueOf(): unknown }).valueOf();
    expect(plain(zeros(2, 3))).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(plain(identity(2))).toEqual([
      [1, 0],
      [0, 1],
    ]);
    expect(plain(range(0, 5))).toEqual([0, 1, 2, 3, 4]);
  });

  it('range throws before it loops on a huge count', () => {
    expect(() => range(0, 1e12)).toThrow(/range: result too large/);
  });

  it('hadamardMatrix checks n before it allocates', () => {
    expect(() => hadamardMatrix(1e308)).toThrow(/n must be a power of 2/);
    expect(() => hadamardMatrix(2 ** 32)).toThrow(/result too large/);
    expect(hadamardMatrix(4)).toEqual([
      [1, 1, 1, 1],
      [1, -1, 1, -1],
      [1, 1, -1, -1],
      [1, -1, -1, 1],
    ]);
  });

  it('bellNumbers saturates', () => {
    expect(bellNumbers(Number.MAX_VALUE)).toBe(Infinity);
    expect(bellNumbers(219)).toBe(Infinity);
    expect(bellNumbers(218)).toBe(6.101309833875321e306);
    expect(bellNumbers(10)).toBe(115975);
  });

  it('stirling numbers throw before they allocate', () => {
    expect(() => stirlingS1(1e6, 1e6)).toThrow(RangeError);
    expect(() => stirlingS2(1e6, 1e6)).toThrow(RangeError);
    expect(stirlingS1(5, 2)).toBe(-50);
    expect(stirlingS2(10, 5)).toBe(42525);
  });
});

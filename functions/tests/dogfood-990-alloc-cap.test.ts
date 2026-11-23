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
  resize,
  matrix,
  bignumber,
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
  it('a zero dimension does not skip the size check', () => {
    expect(() => zeros([1e9, 0])).toThrow(
      new RangeError('zeros: result too large (1000000000×0 exceeds limit of 100000000 elements)')
    );
    expect(() => zeros([1e5, 1e4, 0])).toThrow(RangeError);
    expect(() =>
      (matrix([1]) as unknown as { resize(s: number[]): unknown }).resize([1e9, 0])
    ).toThrow(RangeError);
    expect(zeros([0, 5])).toEqual([]);
    expect(zeros([5, 0])).toEqual([[], [], [], [], []]);
  });

  it('dense and BigNumber sizes throw before they allocate', () => {
    expect(() => zeros(1e5, 1e5, 'dense')).toThrow(RangeError);
    expect(() => zeros(bignumber(1e5), bignumber(1e5))).toThrow(RangeError);
  });

  it('resize throws before it allocates', () => {
    expect(() => resize('ab', [1e9])).toThrow(
      new RangeError('resize: result too large (1000000000 exceeds limit of 100000000 elements)')
    );
    expect(() => resize([1], [1e5, 1e5])).toThrow(RangeError);
    expect(resize('ab', [5], 'x')).toBe('abxxx');
  });

  it('range counts bigint bounds and an excluded end', () => {
    expect(() => range(0n, 10n ** 12n)).toThrow(RangeError);
    expect(() => range(0, 1e8 + 1)).toThrow(/100000001 exceeds/);
  });

  it('hadamardMatrix rejects a non-power of 2 and a large n', () => {
    expect(() => hadamardMatrix(2 ** 53 - 1)).toThrow(/power of 2/);
    expect(() => hadamardMatrix(16384)).toThrow(RangeError);
    expect(() => hadamardMatrix(3)).toThrow(/power of 2/);
  });

  it('stirlingS1 and bellNumbers limit the order', () => {
    expect(() => stirlingS1(10000, 2)).toThrow(RangeError);
    expect(() => bellNumbers(bignumber(2001))).toThrow(
      new RangeError('bellNumbers: n = 2001 exceeds the supported maximum of 2000')
    );
    const b = bellNumbers(bignumber(219)) as { isFinite(): boolean };
    expect(b.isFinite()).toBe(true);
  });
});

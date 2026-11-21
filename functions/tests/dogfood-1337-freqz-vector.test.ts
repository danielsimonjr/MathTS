/**
 * `freqz` reads `b` and `a` as vectors. A matrix with two axes reached `_freqz` through
 * `valueOf()`, which gave rows in place of coefficients: `freqz(zeros(0, 3), zeros(3, 0))` returned a
 * 512 x 0 response and `freqz(matrix([[1, 2], [3, 4]]), identity)` returned 512 values. mathjs 15.2.0
 * throws a RangeError for both. The check reads the size of the argument (`collectionSize`), because
 * the entries of a 0 x 3 matrix are `[]`.
 */
import { describe, expect, it } from 'vitest';
import { freqz, matrix, zeros } from '../src/index.js';

type Fz = (b: unknown, a: unknown, w?: unknown) => { h: unknown; w: unknown };
const fz = freqz as unknown as Fz;

describe('freqz refuses a coefficient argument that is not a vector', () => {
  it('a 0 x 3 and a 3 x 0 matrix throw a RangeError that shows the size', () => {
    expect(() => fz(zeros(0, 3), zeros(3, 0))).toThrow(RangeError);
    expect(() => fz(zeros(0, 3), zeros(3, 0))).toThrow('freqz: b must be a vector (size: [0, 3])');
  });
  it('a 2 x 2 matrix throws', () => {
    expect(() =>
      fz(
        matrix([
          [1, 2],
          [3, 4],
        ]),
        matrix([1])
      )
    ).toThrow('size: [2, 2]');
    expect(() =>
      fz(
        matrix([1, 2]),
        matrix([
          [1, 0],
          [0, 1],
        ]),
        4
      )
    ).toThrow('freqz: a must be a vector (size: [2, 2])');
  });
  it('a 2-D Array throws the same error', () => {
    expect(() => fz([[1, 2]], [1])).toThrow('freqz: b must be a vector (size: [1, 2])');
  });
  it('vectors keep their response', () => {
    const r = fz(matrix([1, 2]), matrix([1]), 4) as { h: { size(): number[] } };
    expect(r.h.size()).toEqual([4]);
    expect((fz([1, 2], [1, 2, 3], 4).h as unknown[]).length).toBe(4);
  });
});

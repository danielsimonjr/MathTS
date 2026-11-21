import { describe, it, expect } from 'vitest';
// Issue #1003: `lstsq(A, b)` with a number typed array `b` returned an all-zero vector before the
// DenseMatrix change (`b.map` of a typed array coerced `[v]` to `v`, so the rows had no length).
// A number typed array is a vector, as for `linsolve`.
import { lstsq } from '../src/index.js';

const A = [
  [1, 2],
  [3, 4],
];

describe('lstsq: a number typed array b is a vector', () => {
  for (const make of [
    (v: number[]) => new Float64Array(v),
    (v: number[]) => new Float32Array(v),
    (v: number[]) => new Int32Array(v),
  ]) {
    it(`${make([1]).constructor.name}`, () => {
      const x = lstsq(A, make([5, 11]) as never) as number[];
      expect(x.length).toBe(2);
      expect(Math.abs(x[0] - 1)).toBeLessThan(1e-12);
      expect(Math.abs(x[1] - 2)).toBeLessThan(1e-12);
    });
  }

  it('a BigInt typed array b is not a vector', () => {
    expect(() => lstsq(A, new BigInt64Array(2) as never)).toThrow(TypeError);
  });
});

import { describe, it, expect } from 'vitest';
// Issue #1003: lstsq with a DenseMatrix right-hand side threw `reading 'length'`. A DenseMatrix b
// is an m x k right side (an n x k result), or a 1 x m row that stands for a vector.
import { DenseMatrix, lstsq } from '../src/index.js';

const A = [
  [1, 2],
  [3, 4],
];

function expectClose(actual: readonly number[], expected: readonly number[], tol = 1e-12): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs(actual[i] - expected[i])).toBeLessThan(tol);
  }
}

// x = [1, 2]: 1*1 + 2*2 = 5 and 3*1 + 4*2 = 11
describe('issue #1003: lstsq accepts a DenseMatrix b', () => {
  for (const [label, makeA] of [
    ['nested array A', () => A],
    ['DenseMatrix A', () => new DenseMatrix(A)],
  ] as const) {
    it(`${label}: a 2 x 1 column b gives the nested 2 x 1 result`, () => {
      const x = lstsq(makeA(), new DenseMatrix([[5], [11]])) as number[][];
      expect(x.length).toBe(2);
      expectClose(x[0], [1]);
      expectClose(x[1], [2]);
    });

    it(`${label}: a 1 x 2 row b is a vector`, () => {
      const x = lstsq(makeA(), new DenseMatrix([5, 11])) as number[];
      expectClose(x, [1, 2]);
    });

    it(`${label}: a 2 x 2 b is a right side with two columns`, () => {
      // columns [5, 11] and [3, 7]: x1 = [1, 2], x2 = [1, 1]
      const x = lstsq(
        makeA(),
        new DenseMatrix([
          [5, 3],
          [11, 7],
        ])
      ) as number[][];
      expectClose(x[0], [1, 1]);
      expectClose(x[1], [2, 1]);
    });
  }

  it('a 3 x 1 b for a 2-row A throws a RangeError that names the shape', () => {
    expect(() => lstsq(A, new DenseMatrix([[5], [11], [1]]))).toThrow(RangeError);
    expect(() => lstsq(A, new DenseMatrix([[5], [11], [1]]))).toThrow(/expected 2 rows/);
  });

  it('pin: a number[] b still works', () => {
    expectClose(lstsq(A, [5, 11]), [1, 2]);
  });

  it('a MathJS-like b (an object with toArray) is read through toArray', () => {
    const duck = { toArray: () => [5, 11] };
    expectClose(lstsq(A, duck as never) as number[], [1, 2]);
  });

  it('a b that is not a vector, a nested array or a matrix throws a TypeError', () => {
    expect(() => lstsq(A, 5 as never)).toThrow(TypeError);
    expect(() => lstsq(A, 5 as never)).toThrow(/lstsq: b must be/);
    expect(() => lstsq(A, null as never)).toThrow(/lstsq: b must be/);
    expect(() => lstsq(A, { toArray: () => 5 } as never)).toThrow(/lstsq: b must be/);
  });
});

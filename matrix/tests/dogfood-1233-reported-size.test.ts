import { describe, it, expect } from 'vitest';
// Issue #1233 (second copy of the shape rule): `toArray()` of a 0 x 3 matrix is `[]`, so a matrix
// object that reports its size only through `size()` (the MathJS contract; a real MathJS matrix has
// no numeric `rows`) read as 0 x 0, which is square. The matrix function returned an empty matrix
// where MathJS throws "Matrix must be square". The size now comes from the core reader `matrixSize`.
// The size [0] (`matrix([])`) is the 0 x 0 matrix, as B2 (#1348) rules for every matrix function.
import { DenseMatrix, lstsq, matrixExpm, matrixLogm, matrixSqrtm } from '../src/index.js';

const fns = { matrixExpm, matrixLogm, matrixSqrtm } as const;

describe('issue #1233: an empty non-square matrix object is not square', () => {
  for (const [name, fn] of Object.entries(fns)) {
    it(`${name} throws the square error for a size() duck of size [0, 3]`, () => {
      const duck = { toArray: () => [] as number[][], size: () => [0, 3] };
      expect(() => fn(duck)).toThrow(RangeError);
      expect(() => fn(duck)).toThrow(/must be square \(got 0.3\)/);
    });

    it(`${name} throws for a duck whose rows is a method (the MathJS shape)`, () => {
      const duck = { toArray: () => [] as number[][], rows: () => 0, size: () => [0, 3] };
      expect(() => fn(duck)).toThrow(/must be square \(got 0.3\)/);
    });

    it(`${name} returns the empty matrix for a size() duck of size [0, 0] or [0]`, () => {
      for (const size of [[0, 0], [0]]) {
        const duck = { toArray: () => [] as number[][], size: () => size };
        const out = fn(duck);
        expect([out.rows, out.cols]).toEqual([0, 0]);
      }
    });
  }
});

describe('issue #1003: lstsq keeps the zero axis of A and b', () => {
  const b03 = { toArray: () => [] as number[][], size: () => [0, 3] };

  it('a 0 x 2 A and a 0 x 3 duck b give a 2 x 3 zero solution', () => {
    const x = lstsq(new DenseMatrix(0, 2, new Float64Array(0)), b03 as never);
    expect(x).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });

  it('a 0 x 2 A and a 0 x 3 DenseMatrix b give a 2 x 3 zero solution', () => {
    const x = lstsq(
      new DenseMatrix(0, 2, new Float64Array(0)),
      new DenseMatrix(0, 3, new Float64Array(0))
    );
    expect(x).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
});

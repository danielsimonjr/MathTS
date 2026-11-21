import { describe, it, expect } from 'vitest';
// Issue #1003 (final review): `linsolve` read the order of `A` from its nested rows. The nested
// data of a matrix with no rows is `[]`, so a 0 x 3 matrix read as the 0 x 0 matrix and threw
// "empty matrix" in place of the square error. The order now comes from the size that the matrix
// reports (`collectionSize`, then `squareOrder`), the B2 (#1348) rule of every square function.
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { linsolve, matrix, zeros } from '../src/index.js';

const bad = (x: unknown): never => x as never;

describe('issue #1003: linsolve reads the zero axis of A from its size', () => {
  const cases: [string, unknown][] = [
    ['native DenseMatrix 0 x 3', new DenseMatrix(0, 3, new Float64Array(0))],
    [
      'native SparseMatrix 0 x 3',
      SparseMatrix.fromDense(new DenseMatrix(0, 3, new Float64Array(0))),
    ],
    ['MathJS matrix 0 x 3', zeros(0, 3, 'dense')],
    ['native DenseMatrix 3 x 0', new DenseMatrix(3, 0, new Float64Array(0))],
    ['MathJS matrix 3 x 0', matrix([[], [], []])],
  ];
  for (const [name, A] of cases) {
    it(`a ${name} A throws the square RangeError`, () => {
      expect(() => linsolve(bad(A), [])).toThrow(RangeError);
      expect(() => linsolve(bad(A), [])).toThrow(/must be square/);
    });
  }

  it('the 0 x 0 matrix keeps the empty-matrix error', () => {
    expect(() => linsolve([], [])).toThrow(/empty matrix/);
    expect(() => linsolve(new DenseMatrix(0, 0, new Float64Array(0)), [])).toThrow(/empty matrix/);
    expect(() => linsolve(bad(matrix([])), [])).toThrow(/empty matrix/);
  });
});

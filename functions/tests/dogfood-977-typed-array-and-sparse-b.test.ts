import { describe, it, expect } from 'vitest';
// Issues #977 and #1003: a number typed array is a vector for `linsolve` (it was before the
// matrix-argument change, for every kind), and a native SparseMatrix `b` is read as a DenseMatrix
// `b` is. The mathjs 15.2.0 `lusolve` accepts a sparse `b`.
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { linsolve } from '../src/index.js';

const A = [
  [1, 2],
  [3, 4],
];

function expectSolution(actual: number[]): void {
  expect(actual.length).toBe(2);
  expect(Math.abs(actual[0] - 1)).toBeLessThan(1e-12);
  expect(Math.abs(actual[1] - 2)).toBeLessThan(1e-12);
}

describe('linsolve: typed-array b and SparseMatrix b', () => {
  it('Float64Array, Float32Array and Int32Array b are vectors', () => {
    expectSolution(linsolve(A, new Float64Array([5, 11])));
    expectSolution(linsolve(A, new Float32Array([5, 11])));
    expectSolution(linsolve(A, new Int32Array([5, 11])));
  });

  it('a BigInt typed array b and a DataView b throw a TypeError that names the type', () => {
    expect(() => linsolve(A, new BigInt64Array(2) as never)).toThrow(/BigInt64Array/);
    expect(() => linsolve(A, new DataView(new ArrayBuffer(16)) as never)).toThrow(TypeError);
  });

  it('a SparseMatrix column b and a SparseMatrix row b', () => {
    expectSolution(linsolve(A, SparseMatrix.fromDense(new DenseMatrix([[5], [11]])) as never));
    expectSolution(linsolve(A, SparseMatrix.fromDense(new DenseMatrix([[5, 11]])) as never));
  });

  it('a SparseMatrix b of another shape throws a TypeError that names the shape', () => {
    const wide = SparseMatrix.fromDense(
      new DenseMatrix([
        [5, 1],
        [11, 1],
      ])
    );
    expect(() => linsolve(A, wide as never)).toThrow(/2 x 2/);
  });

  it('a b that is no matrix type names its class', () => {
    expect(() => linsolve(A, new Map() as never)).toThrow(/got Map/);
  });
});

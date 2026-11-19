/**
 * Dogfood #1231 - lusolve with a right-hand side of more than one column.
 *
 * lusolve, lsolve and usolve solve one column vector (as mathjs does). A right-hand
 * side with more than one column throws "Dimension mismatch" on every path. No path
 * drops a column.
 */
import { describe, it, expect } from 'vitest';
import { lusolve as lusolveFn, matrix, sparse } from '../src/factories/index.js';
type DenseCtor = new (d: { data: unknown[][]; size: number[] }) => unknown;
const DenseMatrix = (matrix([]) as object).constructor as unknown as DenseCtor;

const lusolve = lusolveFn as (a: unknown, b: unknown) => unknown;
const A = [
  [2, 1],
  [1, 3],
];
const A3 = [
  [2, 1, 0],
  [1, 3, 1],
  [0, 1, 4],
];
const B2 = [
  [1, 2],
  [3, 4],
];
const B3 = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];
const kinds: Record<string, (m: number[][]) => unknown> = {
  Array: (m) => m,
  DenseMatrix: (m) => matrix(m),
  SparseMatrix: (m) => sparse(m),
};
const MISMATCH = /Dimension mismatch/;
const throwsRange = (fn: () => unknown) => {
  expect(fn).toThrow(RangeError);
  expect(fn).toThrow(MISMATCH);
};

describe('#1231 lusolve multi-column right-hand side', () => {
  it.each(Object.keys(kinds))('Array A with a multi-column %s b throws', (bn) => {
    throwsRange(() => lusolve(A, kinds[bn](B2)));
    throwsRange(() => lusolve(A3, kinds[bn](B3)));
  });

  it('a DenseMatrix or SparseMatrix A with a multi-column b throws (guard)', () => {
    for (const an of ['DenseMatrix', 'SparseMatrix']) {
      for (const bn of Object.keys(kinds)) {
        expect(() => lusolve(kinds[an](A), kinds[bn](B2)), `${an}/${bn}`).toThrow(MISMATCH);
        expect(() => lusolve(kinds[an](A3), kinds[bn](B3)), `${an}/${bn}`).toThrow(MISMATCH);
      }
    }
  });

  it('Array A with a 1-D DenseMatrix b of the wrong length throws RangeError', () => {
    throwsRange(() => lusolve(A, matrix([5, 10, 1])));
  });

  it('Array A with a ragged b throws', () => {
    throwsRange(() => lusolve(A, [[5], [10, 1]]));
  });

  it('a 1x1 A with a 1x2 b throws', () => {
    throwsRange(() => lusolve([[2]], [[4, 5]]));
  });

  it('Array A with a 1xn row b throws RangeError', () => {
    throwsRange(() => lusolve(A, [[5, 10]]));
    throwsRange(() => lusolve(A, matrix([[5, 10]])));
  });

  it('a 1-column b solves as before', () => {
    expect(lusolve(A, [[5], [10]])).toEqual([[1], [3]]);
    expect(lusolve(A, [5, 10])).toEqual([[1], [3]]);
    expect((lusolve(matrix(A), matrix([[5], [10]])) as { valueOf(): unknown }).valueOf()).toEqual([
      [1],
      [3],
    ]);
  });

  it.each(Object.keys(kinds))('%s A with a wrong-length b throws', (an) => {
    expect(() => lusolve(kinds[an](A), [1, 2, 3])).toThrow(MISMATCH);
    expect(() => lusolve(kinds[an](A), [[1], [2], [3]])).toThrow(MISMATCH);
  });

  it('a 0x0 A with a [0,2] b still throws', () => {
    const b = new DenseMatrix({ data: [], size: [0, 2] });
    expect(() => lusolve([], b)).toThrow(MISMATCH);
    expect(() => lusolve(matrix([]), b)).toThrow(MISMATCH);
  });
});

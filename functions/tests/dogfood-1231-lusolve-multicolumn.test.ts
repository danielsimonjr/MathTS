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
const makers: Record<string, (a: number[][]) => unknown> = {
  Array: (a) => a,
  DenseMatrix: (a) => matrix(a),
  SparseMatrix: (a) => sparse(a),
};
const rhsMakers: Record<string, (b: number[][]) => unknown> = {
  Array: (b) => b,
  DenseMatrix: (b) => matrix(b),
  SparseMatrix: (b) => sparse(b),
};

describe('#1231 lusolve multi-column right-hand side', () => {
  for (const [an, mkA] of Object.entries(makers)) {
    for (const [bn, mkB] of Object.entries(rhsMakers)) {
      it(`${an} A, ${bn} 2-column b throws`, () => {
        expect(() => lusolve(mkA(A), mkB(B2))).toThrow(/Dimension mismatch/);
      });
      it(`${an} A, ${bn} 3-column b throws`, () => {
        expect(() => lusolve(mkA(A3), mkB(B3))).toThrow(/Dimension mismatch/);
      });
    }
  }

  it('a 1-column b solves as before', () => {
    expect(lusolve(A, [[5], [10]])).toEqual([[1], [3]]);
    expect(lusolve(A, [5, 10])).toEqual([[1], [3]]);
    expect((lusolve(matrix(A), matrix([[5], [10]])) as { valueOf(): unknown }).valueOf()).toEqual([
      [1],
      [3],
    ]);
  });

  it.each(['Array', 'DenseMatrix', 'SparseMatrix'])('%s A with a wrong-length b throws', (an) => {
    expect(() => lusolve(makers[an](A), [1, 2, 3])).toThrow(/Dimension mismatch/);
    expect(() => lusolve(makers[an](A), [[1], [2], [3]])).toThrow(/Dimension mismatch/);
  });

  it('a 0x0 A with a [0,2] b still throws', () => {
    const b = new DenseMatrix({ data: [], size: [0, 2] });
    expect(() => lusolve([], b)).toThrow(/Dimension mismatch/);
    expect(() => lusolve(matrix([]), b)).toThrow(/Dimension mismatch/);
  });
});

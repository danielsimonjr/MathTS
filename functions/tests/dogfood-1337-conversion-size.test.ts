/**
 * A storage conversion takes the size of its source (#1337, the class of the batch). The sparse
 * constructor read the size from the nested data of a dense source (`_fromDenseArray(data._data)`),
 * and the nested data of a 0 x 3 matrix is `[]`, so `sparse(zeros(0, 3))` had the size `[0, 0]` and
 * its determinant was 1. mathjs 15.2.0 gives `[0, 0]` as well (its own shape loss); MathTS keeps
 * `[0, 3]`, a stated divergence.
 *
 * The size of a matrix argument is read by one reader (`matrixSize` of core, through
 * `collectionSize`), for every kind: boxed (`size()`), native dense and public CSR (`size` property).
 */
import { describe, expect, it } from 'vitest';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import { det, expm, matrix, pinv, pow, sparse, zeros } from '../src/index.js';

type Boxed = { size(): number[]; storage(): string };
type Un = (a: unknown, ...rest: unknown[]) => unknown;
const sizeOf = (r: unknown): number[] => (r as Boxed).size();

describe('a storage conversion keeps a zero axis', () => {
  it.each([
    [0, 3],
    [3, 0],
    [0, 0],
  ])('dense %i x %i to sparse and back keeps the size', (r, c) => {
    const s = (sparse as Un)(zeros(r, c));
    expect((s as Boxed).storage()).toBe('sparse');
    expect(sizeOf(s)).toEqual([r, c]);
    expect(sizeOf((matrix as Un)(zeros(r, c), 'sparse'))).toEqual([r, c]);
    const back = (matrix as Un)((matrix as Un)(zeros(r, c), 'sparse'), 'dense');
    expect((back as Boxed).storage()).toBe('dense');
    expect(sizeOf(back)).toEqual([r, c]);
  });
  it('a 0 x 3 sparse matrix is not square: det throws (it returned 1)', () => {
    expect(() => (det as Un)((sparse as Un)(zeros(0, 3)))).toThrow(RangeError);
  });
  it('a non-empty conversion keeps its entries', () => {
    const s = (sparse as Un)(
      matrix([
        [1, 0],
        [0, 2],
      ])
    );
    expect(sizeOf(s)).toEqual([2, 2]);
    expect((s as { toArray(): number[][] }).toArray()).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });
});

describe('one size reader for every matrix kind', () => {
  const native = DenseMatrix.zeros(0, 3);
  const csr = SparseMatrix.fromDense(DenseMatrix.zeros(0, 3));
  it('native dense and public CSR 0 x 3 arguments are not square', () => {
    expect(() => (pow as Un)(native, 2)).toThrow(RangeError);
    expect(() => (pow as Un)(csr, 2)).toThrow(RangeError);
    expect(() => (expm as Un)(csr)).toThrow(RangeError);
  });
  it('pinv of a public CSR 0 x 3 matrix has the transposed size', () => {
    const out = (pinv as Un)(csr) as SparseMatrix;
    expect([out.rows, out.cols]).toEqual([3, 0]);
  });
});

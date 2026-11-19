/**
 * Dogfood #1263 - every way to build a sparse matrix rejects an input that is not two dimensional.
 *
 * A sparse matrix is always 2-D. A 1-D array stays an n x 1 column, as in mathjs. An input with
 * three or more axes, or no axis, throws `RangeError: Matrix must be two dimensional (size: ...)`
 * and never builds an invalid matrix.
 */

import { describe, it, expect } from 'vitest';
import { sparse, matrix, zeros, lusolve } from '../src/factories/index.js';
import { MathJSSparseMatrix } from '../src/factories/matrix-bridge.js';

const a3 = [
  [[1], [2]],
  [[3], [4]],
];
const call = (fn: () => unknown) => fn;
const SIZE_3D = 'Matrix must be two dimensional (size: [2, 2, 1])';

type M = { size(): number[]; valueOf(): unknown };

describe('#1263 sparse rejects an input that is not two dimensional', () => {
  it('sparse(Array 3-D) throws RangeError', () => {
    expect(call(() => sparse(a3))).toThrow(new RangeError(SIZE_3D));
    expect(call(() => sparse(a3))).toThrow(RangeError);
  });

  it('sparse(DenseMatrix 3-D) throws RangeError', () => {
    expect(call(() => sparse(matrix(a3)))).toThrow(new RangeError(SIZE_3D));
  });

  it("matrix(a3, 'sparse') throws RangeError", () => {
    expect(call(() => matrix(a3, 'sparse'))).toThrow(new RangeError(SIZE_3D));
  });

  it('the constructor throws for an Array, a { data } object and a Matrix', () => {
    expect(call(() => new MathJSSparseMatrix(a3 as never))).toThrow(RangeError);
    expect(call(() => new MathJSSparseMatrix({ data: a3 } as never))).toThrow(RangeError);
    expect(call(() => new MathJSSparseMatrix(matrix(a3) as never))).toThrow(RangeError);
  });

  it('a 4-D array and a nested non-first row throw', () => {
    expect(call(() => sparse([[[[1]]]]))).toThrow(/size: \[1, 1, 1, 1\]/);
    expect(call(() => sparse([[1], [[2]]]))).toThrow(RangeError);
  });

  it('sparse(5) (no axis) throws RangeError', () => {
    expect(call(() => sparse(5))).toThrow(
      new RangeError('Matrix must be two dimensional (size: [])')
    );
  });

  it('lusolve of the 3-D input throws RangeError, not a TypeError from equalScalar', () => {
    expect(call(() => lusolve(sparse(a3) as never, [1, 2] as never))).toThrow(RangeError);
  });
});

describe('#1263 valid inputs are unchanged', () => {
  it('a 1-D array stays an n x 1 column', () => {
    const s = sparse([1, 2, 3]) as M;
    expect(s.size()).toEqual([3, 1]);
    expect(s.valueOf()).toEqual([[1], [2], [3]]);
  });

  it('an empty 2-D input keeps its size', () => {
    expect((sparse([[]]) as M).size()).toEqual([1, 0]);
    expect((sparse([]) as M).size()).toEqual([0, 0]);
    expect((sparse((zeros(0, 3) as M).valueOf()) as M).size()).toEqual([0, 0]);
    expect((sparse() as M).size()).toEqual([0, 0]);
  });

  it('a 2-D array, a 2-D DenseMatrix and a sparse matrix build the same matrix', () => {
    const want = [
      [1, 0],
      [0, 2],
    ];
    expect((sparse(want) as M).valueOf()).toEqual(want);
    expect((sparse(matrix(want)) as M).valueOf()).toEqual(want);
    expect((sparse(sparse(want)) as M).valueOf()).toEqual(want);
    expect((matrix(want, 'sparse') as M).valueOf()).toEqual(want);
  });

  it('a 1-D DenseMatrix gives a column', () => {
    expect((sparse(matrix([1, 2, 3])) as M).size()).toEqual([3, 1]);
  });
});

describe('#1263 a plain object with dense fields is not a dense matrix', () => {
  it('new MathJSSparseMatrix({ _data, _size }) throws TypeError, as mathjs does', () => {
    const fake = { _data: [[1]], _size: [1, 1] };
    expect(call(() => new MathJSSparseMatrix(fake as never))).toThrow(
      new TypeError('Unsupported type of data (Object)')
    );
  });
});

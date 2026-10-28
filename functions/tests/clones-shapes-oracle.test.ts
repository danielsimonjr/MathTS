/**
 * PR 3 — shape walks (M1 sparse from vectors, M13 Index dimension walk, M17 numeric-square predicates).
 * Independent oracles pinned before consolidating duplicate bodies.
 */

import { describe, it, expect } from 'vitest';
import { Complex } from '@danielsimonjr/mathts-core';
import {
  matrixFromColumns,
  matrixFromRows,
  index,
  range,
  matrix,
  bignumber,
} from '../src/factories/index.js';
import { factoryScope } from '../src/factories/scope.js';
import { createIndexClass } from '../src/type/matrix/MatrixIndex.js';
import { matrixFromVectorList } from '../src/matrix/from-vectors.js';
import {
  isLargeNumericSquare,
  isNumericSquare,
  NATIVE_MATRIX_THRESHOLD,
} from '../src/matrix/native-accel.js';

type SparseMatrix = {
  storage(): string;
  size(): number[];
  toArray(): unknown;
  _values?: unknown[];
  _index?: number[];
  _ptr?: number[];
};

describe('M1 — sparseMatrixFromVectors (matrixFromColumns / Rows)', () => {
  it('sparse column and row builds match their dense oracles for the same entries', () => {
    const fromCols = matrixFromColumns(
      matrix([[1], [0], [3]], 'sparse'),
      matrix([[0], [2], [0]], 'sparse')
    ) as SparseMatrix;
    const fromRows = matrixFromRows(
      matrix([[1, 0, 3]], 'sparse'),
      matrix([[0, 2, 0]], 'sparse')
    ) as SparseMatrix;
    expect(fromCols.storage()).toBe('sparse');
    expect(fromRows.storage()).toBe('sparse');
    expect(fromCols.toArray()).toEqual([
      [1, 0],
      [0, 2],
      [3, 0],
    ]);
    expect(fromRows.toArray()).toEqual([
      [1, 0, 3],
      [0, 2, 0],
    ]);
    expect(fromCols.size()).toEqual([3, 2]);
    expect(fromRows.size()).toEqual([2, 3]);
  });

  it('omits explicit zeros in sparse assembly (CSC values/index/ptr)', () => {
    const result = matrixFromColumns(
      matrix([[1], [0], [3]], 'sparse'),
      matrix([[0], [2], [0]], 'sparse')
    ) as SparseMatrix;
    // Independent CSC oracle: entries (0,0,1), (2,0,3), (1,1,2) sorted col then row.
    expect(result._values).toEqual([1, 3, 2]);
    expect(result._index).toEqual([0, 2, 1]);
    expect(result._ptr).toEqual([0, 2, 3]);
    expect(result.size()).toEqual([3, 2]);
  });

  it('sparse columns: column-vector and row-vector Matrix inputs (row vector transposed)', () => {
    const colVec = matrix([[1], [2], [3]], 'sparse');
    const rowVecAsCol = matrix([[4, 5, 6]], 'sparse');
    expect((matrixFromColumns(colVec, rowVecAsCol) as SparseMatrix).toArray()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('sparse rows: row-vector and column-vector Matrix inputs', () => {
    const rowVec = matrix([[1, 2, 3]], 'sparse');
    const colVecAsRow = matrix([[4], [5], [6]], 'sparse');
    expect((matrixFromRows(rowVec, colVecAsRow) as SparseMatrix).toArray()).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('sparse forEach uses 1-D Matrix size (dense storage) among sparse columns', () => {
    const col1d = matrix([1, 2, 3]);
    const colSparse = matrix([[4], [5], [6]], 'sparse');
    const result = matrixFromColumns(col1d, colSparse) as SparseMatrix;
    expect(result.storage()).toBe('sparse');
    expect(result.toArray()).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
  });

  it('keeps NaN entries (nonzero for sparse)', () => {
    const c0 = matrix([[NaN], [0]], 'sparse');
    const c1 = matrix([[0], [2]], 'sparse');
    const result = matrixFromColumns(c0, c1) as SparseMatrix;
    expect(result._values).toEqual([NaN, 2]);
  });

  it('omits -0 like 0 and keeps ±Infinity', () => {
    const result = matrixFromColumns(
      matrix([[-0], [Infinity]], 'sparse'),
      matrix([[-Infinity], [0]], 'sparse')
    ) as SparseMatrix;
    expect(result._values).toEqual([Infinity, -Infinity]);
    expect(result._index).toEqual([1, 0]);
    expect(result._ptr).toEqual([0, 1, 2]);
  });

  it('single sparse column vector', () => {
    const result = matrixFromColumns(matrix([[1], [2], [3]], 'sparse')) as SparseMatrix;
    expect(result.size()).toEqual([3, 1]);
    expect(result.toArray()).toEqual([[1], [2], [3]]);
  });

  it('mismatched vector lengths throw the exact TypeError text', () => {
    const a = matrix([[1], [2]], 'sparse');
    const b = matrix([[3]], 'sparse');
    expect(() => matrixFromColumns(a, b)).toThrow(
      new TypeError('The vectors had different length: 2 ≠ 1')
    );
    expect(() => matrixFromRows(a, b)).toThrow(
      new TypeError('The vectors had different length: 2 ≠ 1')
    );
  });

  it('empty list throws from matrixFromVectorList before sparse builder runs', () => {
    const spy = () => {
      throw new Error('sparse builder must not run');
    };
    expect(() =>
      matrixFromVectorList([], 'column', spy as never, spy as never, spy as never)
    ).toThrow('At least one column is needed to construct a matrix.');
    expect(() => matrixFromVectorList([], 'row', spy as never, spy as never, spy as never)).toThrow(
      'At least one row is needed to construct a matrix.'
    );
  });
});

describe('M13 — Index dimension walk (size / min / max)', () => {
  it('size() maps scalars to 1 and ranges to range.size()[0]', () => {
    const idx = index(3, 'name', range(1, 4, 2)) as { size(): number[] };
    expect(idx.size()).toEqual([1, 1, 2]);
  });

  it('min and max leave scalar dimensions unchanged', () => {
    const idx = index(0, 'prop', range(2, 5)) as {
      min(): (number | string | undefined)[];
      max(): (number | string | undefined)[];
    };
    expect(idx.min()).toEqual([0, 'prop', 2]);
    expect(idx.max()).toEqual([0, 'prop', 4]);
  });

  it('empty index returns empty size, min, and max', () => {
    const Index = createIndexClass(factoryScope as Parameters<typeof createIndexClass>[0]);
    const idx = new Index();
    expect(idx.size()).toEqual([]);
    expect(idx.min()).toEqual([]);
    expect(idx.max()).toEqual([]);
  });

  it('negative-step range: size is the count, min/max are the extreme values', () => {
    // range(5, 1, -1) → 5, 4, 3, 2
    const idx = index(range(5, 1, -1)) as {
      size(): number[];
      min(): (number | undefined)[];
      max(): (number | undefined)[];
    };
    expect(idx.size()).toEqual([4]);
    expect(idx.min()).toEqual([2]);
    expect(idx.max()).toEqual([5]);
  });

  it('empty ranges yield size 0 and undefined min/max', () => {
    const empty = index(range(1, 1)) as {
      size(): number[];
      min(): (number | undefined)[];
      max(): (number | undefined)[];
    };
    expect(empty.size()).toEqual([0]);
    expect(empty.min()).toEqual([undefined]);
    expect(empty.max()).toEqual([undefined]);
    const backward = index(range(5, 1)) as {
      size(): number[];
      min(): (number | undefined)[];
      max(): (number | undefined)[];
    };
    expect(backward.size()).toEqual([0]);
    expect(backward.min()).toEqual([undefined]);
    expect(backward.max()).toEqual([undefined]);
  });

  it('zero-based and one-based scalar dimensions stay as stored', () => {
    const zero = index(0) as {
      size(): number[];
      min(): (number | string | undefined)[];
      max(): (number | string | undefined)[];
    };
    expect(zero.size()).toEqual([1]);
    expect(zero.min()).toEqual([0]);
    expect(zero.max()).toEqual([0]);
    const one = index(1) as {
      size(): number[];
      min(): (number | string | undefined)[];
      max(): (number | string | undefined)[];
    };
    expect(one.size()).toEqual([1]);
    expect(one.min()).toEqual([1]);
    expect(one.max()).toEqual([1]);
  });

  it('matrix/array dimension: size is the set length, min/max are set extremes', () => {
    const idx = index([2, 0, 5]) as {
      size(): number[];
      min(): (number | undefined)[];
      max(): (number | undefined)[];
    };
    expect(idx.size()).toEqual([3]);
    expect(idx.min()).toEqual([0]);
    expect(idx.max()).toEqual([5]);
  });

  it('BigNumber scalar is converted to number by index(); min/max/size treat it as a scalar', () => {
    const idx = index(bignumber(7)) as {
      size(): number[];
      min(): (number | undefined)[];
      max(): (number | undefined)[];
    };
    expect(idx.size()).toEqual([1]);
    expect(idx.min()).toEqual([7]);
    expect(idx.max()).toEqual([7]);
  });
});

describe('M17 — numeric-square predicates (minSide 1 vs 8)', () => {
  const mk = (n: number): number[][] =>
    Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  it('NATIVE_MATRIX_THRESHOLD is 8', () => {
    expect(NATIVE_MATRIX_THRESHOLD).toBe(8);
  });

  it('side 0 and empty are not numeric square', () => {
    expect(isNumericSquare([])).toBe(false);
    expect(isLargeNumericSquare([])).toBe(false);
    expect(isNumericSquare(mk(0))).toBe(false);
    expect(isLargeNumericSquare(mk(0))).toBe(false);
  });

  it('1×1 is numeric square but not large', () => {
    expect(isNumericSquare([[5]])).toBe(true);
    expect(isLargeNumericSquare([[5]])).toBe(false);
  });

  it('7×7 is numeric square but not large; 8×8 is both', () => {
    expect(isNumericSquare(mk(7))).toBe(true);
    expect(isLargeNumericSquare(mk(7))).toBe(false);
    expect(isNumericSquare(mk(8))).toBe(true);
    expect(isLargeNumericSquare(mk(8))).toBe(true);
  });

  it('Complex entry fails both predicates', () => {
    const withComplex = [
      [new Complex(1, 0), 0],
      [0, 1],
    ] as unknown as number[][];
    expect(isNumericSquare(withComplex)).toBe(false);
    expect(isLargeNumericSquare(withComplex)).toBe(false);
  });

  it('ragged and non-array inputs are rejected', () => {
    expect(isNumericSquare([[1, 2], [3]])).toBe(false);
    expect(isLargeNumericSquare(null)).toBe(false);
    expect(isNumericSquare('not')).toBe(false);
  });

  it('numeric means typeof === "number": NaN and Infinity pass, BigNumber/Complex fail', () => {
    expect(isNumericSquare([[NaN]])).toBe(true);
    expect(isNumericSquare([[Infinity]])).toBe(true);
    expect(isNumericSquare([[-0]])).toBe(true);
    expect(isNumericSquare([[bignumber(1)]])).toBe(false);
    expect(isLargeNumericSquare([[bignumber(1)]])).toBe(false);
    const eightWithBn = mk(8);
    (eightWithBn as unknown[][])[0][0] = bignumber(1);
    expect(isNumericSquare(eightWithBn)).toBe(false);
    expect(isLargeNumericSquare(eightWithBn)).toBe(false);
  });

  it('non-square rectangular arrays fail both predicates, including large-enough sides', () => {
    expect(
      isNumericSquare([
        [1, 2, 3],
        [4, 5, 6],
      ])
    ).toBe(false);
    const eightBySeven = Array.from({ length: 8 }, () => Array.from({ length: 7 }, () => 1));
    expect(isNumericSquare(eightBySeven)).toBe(false);
    expect(isLargeNumericSquare(eightBySeven)).toBe(false);
  });
});

/**
 * Dogfood #1239 - transpose reads only the entries that the column pointers reach.
 *
 * A sparse matrix can keep stale entries after ptr[columns] in its index and value
 * arrays (an in-place compaction, as csAmd does). transpose and valueOf ignore them.
 */
import { describe, it, expect } from 'vitest';
import { sparse, factory_transpose as transpose } from '../src/factories/index.js';

type Data = { values?: number[]; index: number[]; ptr: number[]; size: number[] };
type S = {
  _index: number[];
  _values: number[] | undefined;
  _ptr: number[];
  _size: number[];
  valueOf(): number[][];
  createSparseMatrix(data: Data): S;
};
const t = transpose as (x: unknown) => S;

describe('#1239 transpose of a sparse matrix with stale tail entries', () => {
  it('ignores entries after ptr[columns]', () => {
    const m = sparse([
      [1, 0],
      [2, 3],
    ]) as unknown as S;
    // stale entries: row 1 out of reach of the column pointers
    m._index.push(1, 1);
    m._values!.push(9, 9);
    expect(m.valueOf()).toEqual([
      [1, 0],
      [2, 3],
    ]);
    const r = t(m);
    expect(r._ptr).toEqual([0, 1, 3]);
    expect(r._index).toEqual([0, 0, 1]);
    expect(r._values).toEqual([1, 2, 3]);
    expect(r.valueOf()).toEqual([
      [1, 2],
      [0, 3],
    ]);
  });

  it('ignores a stale entry of a pattern matrix (no values)', () => {
    const m = sparse([
      [1, 0],
      [2, 3],
    ]) as unknown as S;
    m._values = undefined;
    m._index.push(1);
    const r = t(m);
    expect(r._ptr).toEqual([0, 1, 3]);
    expect(r._index).toEqual([0, 0, 1]);
    expect(r._values ?? undefined).toBeUndefined();
  });

  it('ignores a stale entry of a matrix with no rows', () => {
    const base = sparse([[1]]) as unknown as S;
    const m = base.createSparseMatrix({ values: [7], index: [0], ptr: [0, 0, 0, 0], size: [0, 3] });
    const r = t(m);
    expect(r._size).toEqual([3, 0]);
    expect(r._ptr).toEqual([0]);
    expect(r._index).toEqual([]);
  });

  it('a matrix with no stale entries transposes as before', () => {
    const m = sparse([
      [1, 0, 4],
      [0, 0, 5],
    ]) as unknown as S;
    const r = t(m);
    expect(r._size).toEqual([3, 2]);
    expect(r._ptr).toEqual([0, 2, 3]);
    expect(r.valueOf()).toEqual([
      [1, 0],
      [0, 0],
      [4, 5],
    ]);
    // a zero matrix: every column pointer is 0
    expect(t(sparse([[0, 0, 0]]))._ptr).toEqual([0, 0]);
  });

  it('a matrix with no columns still throws the RangeError', () => {
    const base = sparse([[1]]) as unknown as S;
    const m = base.createSparseMatrix({ values: [], index: [], ptr: [0], size: [3, 0] });
    expect(() => t(m)).toThrow(RangeError);
  });
});

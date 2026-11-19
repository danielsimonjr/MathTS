/**
 * Dogfood #1239 - transpose reads only the entries that the column pointers reach.
 *
 * A sparse matrix can keep stale entries after ptr[columns] in its index and value
 * arrays (an in-place compaction, as csAmd does). transpose and valueOf ignore them.
 */
import { describe, it, expect } from 'vitest';
import { sparse, factory_transpose as transpose } from '../src/factories/index.js';

type S = {
  _index: number[];
  _values: number[];
  _ptr: number[];
  valueOf(): number[][];
};

describe('#1239 transpose of a sparse matrix with stale tail entries', () => {
  it('ignores entries after ptr[columns]', () => {
    const m = sparse([
      [1, 0],
      [2, 3],
    ]) as S;
    // stale entries: row 1 out of reach of the column pointers
    m._index.push(1, 1);
    m._values.push(9, 9);
    expect(m.valueOf()).toEqual([
      [1, 0],
      [2, 3],
    ]);
    const t = (transpose as (x: unknown) => S)(m);
    expect(t._ptr).toEqual([0, 1, 3]);
    expect(t.valueOf()).toEqual([
      [1, 2],
      [0, 3],
    ]);
  });
});

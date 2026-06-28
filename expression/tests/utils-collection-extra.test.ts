import { describe, it, expect } from 'vitest';
import { deepForEach, deepMap, reduce, scatter } from '../src/utils/collection.js';

/**
 * Structural mirror of the (non-exported) Matrix interface used by
 * collection.ts. Casting `FakeMatrix` instances to this lets the generic
 * collection helpers infer `T = number` for the matrix branch.
 */
interface CollectionMatrix<T> {
  forEach(callback: (value: T) => void, skipZeros: boolean, recurse: boolean): void;
  map<U>(callback: (value: T) => U, skipZeros: boolean, recurse: boolean): CollectionMatrix<U>;
  size(): number[];
  valueOf(): T[];
  create(data: T[], datatype?: string): CollectionMatrix<T>;
  datatype(): string | undefined;
}

/**
 * A minimal Matrix class satisfying isMatrix (which checks
 * `constructor.prototype.isMatrix === true`) and the Matrix interface used by
 * collection.ts: forEach, map, size, valueOf, create, datatype.
 */
class FakeMatrix {
  _data: unknown[];
  _datatype?: string;
  constructor(data: unknown[], datatype?: string) {
    this._data = data;
    this._datatype = datatype;
  }
  forEach(cb: (x: unknown) => void, _skipZeros: boolean, _recurse: boolean) {
    const walk = (arr: unknown[]) => {
      for (const v of arr) {
        if (Array.isArray(v)) walk(v);
        else cb(v);
      }
    };
    walk(this._data);
  }
  map(cb: (x: unknown) => unknown, _skipZeros: boolean, _recurse: boolean) {
    const walk = (arr: unknown[]): unknown[] => arr.map((v) => (Array.isArray(v) ? walk(v) : cb(v)));
    return new FakeMatrix(walk(this._data), this._datatype);
  }
  size() {
    const s: number[] = [];
    let cur: unknown = this._data;
    while (Array.isArray(cur)) {
      s.push(cur.length);
      cur = cur[0];
    }
    return s;
  }
  valueOf() {
    return this._data;
  }
  create(newData: unknown[], dt?: string) {
    return new FakeMatrix(newData, dt);
  }
  datatype() {
    return this._datatype;
  }
}
(FakeMatrix.prototype as { isMatrix?: boolean }).isMatrix = true;

function makeMatrix(data: unknown[], datatype?: string): CollectionMatrix<number> {
  return new FakeMatrix(data, datatype) as unknown as CollectionMatrix<number>;
}

describe('collection - Matrix branches', () => {
  it('deepForEach iterates a Matrix', () => {
    const collected: number[] = [];
    deepForEach(makeMatrix([1, 2, 3]), (v: number) => collected.push(v));
    expect(collected).toEqual([1, 2, 3]);
  });

  it('deepMap maps a Matrix (no skipZeros)', () => {
    const result = deepMap(makeMatrix([1, 2, 3]), (v: number) => v * 2);
    expect(result.valueOf()).toEqual([2, 4, 6]);
  });

  it('deepMap maps a Matrix with skipZeros', () => {
    const result = deepMap(makeMatrix([0, 1, 0, 2]), (v: number) => v + 100, true);
    expect(result.valueOf()).toEqual([0, 101, 0, 102]);
  });

  it('reduce reduces a Matrix and recreates it via create()', () => {
    const mat = makeMatrix(
      [
        [1, 2],
        [3, 4],
      ],
      'number'
    );
    const reduced = reduce(mat, 0, (acc: number, val: number) => acc + val) as unknown as CollectionMatrix<number>;
    // column-wise sum [1+3, 2+4] = [4, 6]
    expect(reduced.valueOf()).toEqual([4, 6]);
    expect(reduced.datatype()).toBe('number');
  });
});

describe('collection - scatter (sparse)', () => {
  // Build a tiny sparse-matrix-shaped object: a single column with two rows.
  function sparse(values: number[], index: number[], ptr: number[]) {
    return { _values: values, _index: index, _ptr: ptr };
  }

  it('scatters new pattern entries (no value array)', () => {
    const a = sparse([10, 20], [0, 2], [0, 2]);
    const w: number[] = [];
    const u: number[] = [];
    const cindex: number[] = [];
    scatter(a, 0, w, null, u, 1, cindex);
    expect(cindex).toEqual([0, 2]);
    expect(w[0]).toBe(1);
    expect(w[2]).toBe(1);
  });

  it('scatters values with an update callback', () => {
    const a = sparse([10, 20], [0, 2], [0, 2]);
    const w: number[] = [];
    const x: number[] = [];
    const u: number[] = [];
    const cindex: number[] = [];
    scatter(a, 0, w, x, u, 1, cindex, (p: number, q: number) => p + q, false, true, 5);
    // first occurrence: f(value, avalues[k]) = 5 + 10, 5 + 20
    expect(x[0]).toBe(15);
    expect(x[2]).toBe(25);
    expect(u[0]).toBe(1);
  });

  it('scatters values without update (plain copy)', () => {
    const a = sparse([10, 20], [0, 2], [0, 2]);
    const w: number[] = [];
    const x: number[] = [];
    const u: number[] = [];
    const cindex: number[] = [];
    scatter(a, 0, w, x, u, 1, cindex);
    expect(x[0]).toBe(10);
    expect(x[2]).toBe(20);
  });

  it('combines values already present in the column (inverse=false)', () => {
    // ptr [0,2] over a single column with duplicate row index 0 to hit the
    // "i exists in C already" branch.
    const a = sparse([10, 7], [0, 0], [0, 2]);
    const w: number[] = [];
    const x: number[] = [];
    const u: number[] = [];
    const cindex: number[] = [];
    scatter(a, 0, w, x, u, 1, cindex, (p: number, q: number) => p + q, false, true, 5);
    // first: x[0] = 5+10 = 15; second: same row -> x[0] = f(x[0], avalues) = 15+7 = 22
    expect(x[0]).toBe(22);
  });

  it('uses inverse argument order when inverse=true', () => {
    const a = sparse([10], [0], [0, 1]);
    const w: number[] = [];
    const x: number[] = [];
    const u: number[] = [];
    const cindex: number[] = [];
    scatter(a, 0, w, x, u, 1, cindex, (p: number, q: number) => p - q, true, true, 5);
    // inverse: f(avalues[k], value) = 10 - 5 = 5
    expect(x[0]).toBe(5);
  });

  it('pattern branch records repeat-row hits in u', () => {
    const a = sparse([1, 2], [0, 0], [0, 2]);
    const w: number[] = [];
    const u: number[] = [];
    const cindex: number[] = [];
    scatter(a, 0, w, null, u, 1, cindex);
    expect(cindex).toEqual([0]);
    expect(u[0]).toBe(1);
  });
});

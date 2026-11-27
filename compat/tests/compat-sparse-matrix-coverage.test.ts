/**
 * Sparse matrix wrapper branch coverage (#1785).
 */
import { describe, it, expect } from 'vitest';
import { create, all } from '../src/index.js';
import { ensureCompatSparse } from '../src/compat-sparse-matrix.js';

const math = create(all);

describe('compat sparse matrix wrappers (#1785)', () => {
  it('ensureCompatSparse is identity on instances', () => {
    const s = math.sparse([[1]]);
    expect(ensureCompatSparse(s)).toBe(s);
  });

  it('pattern matrices reject map and forEach when values are absent', () => {
    const pattern = math.add(
      new math.SparseMatrix({
        values: null,
        index: [0, 0],
        ptr: [0, 1, 2],
        size: [1, 1],
      }),
      new math.SparseMatrix({
        values: null,
        index: [0],
        ptr: [0, 1],
        size: [1, 1],
      })
    ) as unknown as {
      _values: unknown[] | null;
      map: (cb: () => number) => void;
      forEach: (cb: () => void) => void;
    };
    expect(pattern._values).toBeNull();
    expect(() => pattern.map(() => 1)).toThrow(/Pattern/);
    expect(() => pattern.forEach(() => undefined)).toThrow(/Pattern/);
  });

  it('get/set validate index shape and grow CSC storage on out-of-bounds set', () => {
    const s = math.sparse([[1]]) as unknown as {
      get: (i: unknown, j?: unknown) => unknown;
      set: (i: unknown, v?: unknown, d?: unknown) => unknown;
      size: () => number[];
    };
    expect(s.get(0, 0)).toBe(1);
    expect(() => s.get(0)).toThrow(/Array expected/);
    expect(() => s.get([0, 0, 0])).toThrow(/Dimension/);
    s.set([2, 2], 9, 0);
    expect(s.size()).toEqual([3, 3]);
    expect(s.get([2, 2])).toBe(9);
  });

  it('subset scalar paths, toJSON datatype, clone, and typed valueOf', () => {
    const bn = create(all, { number: 'BigNumber' });
    const s = bn.sparse([
      [bn.bignumber(1), 0],
      [0, bn.bignumber(2)],
    ]) as unknown as {
      subset: (idx: unknown, rep?: unknown) => unknown;
      toJSON: () => { datatype?: string };
      clone: () => { _datatype?: string };
      toArray: () => unknown[][];
      datatype: () => string | undefined;
      map: (cb: (v: unknown) => unknown) => unknown;
      forEach: (cb: (v: unknown) => void) => void;
    };
    (s as { _datatype?: string })._datatype = 'BigNumber';
    expect(s.datatype()).toBe('BigNumber');
    expect(s.toJSON().datatype).toBe('BigNumber');
    expect(() => s.subset(bn.index(0, 0), bn.matrix([[1]]))).toThrow(/Scalar expected/);
    expect(s.subset(bn.index(0, 0))).toBeDefined();
    const cloned = s.clone();
    expect(cloned._datatype).toBe('BigNumber');
    s.map((v) => bn.add(v, 0));
    let hits = 0;
    s.forEach(() => {
      hits++;
    });
    expect(hits).toBeGreaterThan(0);
    expect(bn.isBigNumber(s.toArray()[0][0])).toBe(true);
  });

  it('sparse subset three-arg path and shrinking growth branches', () => {
    const s = math.sparse([
      [1, 2],
      [3, 4],
    ]) as unknown as {
      subset: (idx: unknown, rep?: unknown, def?: unknown) => unknown;
      get: (i: number, j: number) => unknown;
    };
    s.subset(math.index(1, 1), 9, 0);
    expect(s.get(1, 1)).toBe(9);
  });

  it('sparse create() builds another compat sparse matrix', () => {
    const s = math.sparse([[2, 0]]) as unknown as {
      create: (data: unknown, dt?: string) => { type?: string };
    };
    const child = s.create([[4]]);
    expect(child.type).toBe('SparseMatrix');
  });
});
/**
 * Native G17 (#1582): factory CSC sparse storage drops typed structural zeros.
 * Number entries keep exact `=== 0` (1e-100 stays; -0 is dropped; NaN is kept).
 */
import { describe, it, expect } from 'vitest';
import {
  sparse,
  bignumber,
  fraction,
  complex,
  unit,
  add,
  subtract,
  multiply,
  matrixFromColumns,
  matrix,
} from '../src/index.js';

type Sparse = {
  density(): number;
  toArray(): unknown[][];
  storage(): string;
  set(index: number[], value: unknown): Sparse;
};

describe('#1582 factory CSC structural zeros', () => {
  it('number zeros use exact === 0: density 0.5, 1e-100 stays, -0 drops, NaN stays', () => {
    expect(
      (
        sparse([
          [3, 0],
          [5, 0],
        ]) as Sparse
      ).density()
    ).toBe(0.5);
    expect(
      (
        sparse([
          [1e-100, 0],
          [1, 1],
        ]) as Sparse
      ).density()
    ).toBe(0.75);
    expect(
      (
        sparse([
          [3, -0],
          [5, 0],
        ]) as Sparse
      ).density()
    ).toBe(0.5);
    expect(
      (
        sparse([
          [NaN, 0],
          [1, 1],
        ]) as Sparse
      ).density()
    ).toBe(0.75);
  });

  it('BigNumber / Fraction / Complex / Unit zeros are not stored', () => {
    const bn = sparse([
      [bignumber(3), bignumber(0)],
      [bignumber(5), bignumber(0)],
    ]) as Sparse;
    expect(bn.density()).toBe(0.5);
    expect(bn.toArray()[0][1]).toBe(0);

    const fr = sparse([
      [fraction(3), fraction(0)],
      [fraction(5), fraction(0)],
    ]) as Sparse;
    expect(fr.density()).toBe(0.5);

    const cx = sparse([
      [complex(3, 0), complex(0, 0)],
      [complex(5, 0), complex(0, 0)],
    ]) as Sparse;
    expect(cx.density()).toBe(0.5);

    const u = sparse([
      [unit('1 cm'), unit('0 cm')],
      [unit('0 cm'), unit('2 cm')],
    ]) as Sparse;
    expect(u.density()).toBe(0.5);
    expect(u.toArray()[0][1]).toBe(0);
  });

  it('set of a typed zero removes the stored entry', () => {
    const m = sparse([[bignumber(1), bignumber(2)]]) as Sparse;
    m.set([0, 0], bignumber(0));
    expect(m.toArray()[0][0]).toBe(0);
    expect(m.density()).toBe(0.5);
  });

  it('matrixFromColumns omits typed zeros (from-vectors CSC write)', () => {
    const result = matrixFromColumns(
      matrix([[bignumber(1)], [bignumber(0)], [bignumber(3)]], 'sparse'),
      matrix([[bignumber(0)], [bignumber(2)], [bignumber(0)]], 'sparse')
    ) as Sparse & { _values?: unknown[] };
    expect(result.storage()).toBe('sparse');
    expect(result._values).toHaveLength(3);
    expect(result.toArray()[1][0]).toBe(0);
  });

  it('multiply of two number sparse matrices that cancel a cell does not store 0', () => {
    const a = sparse([
      [1, 0],
      [0, 1],
    ]) as Sparse;
    const b = sparse([
      [0, 2],
      [3, 0],
    ]) as Sparse;
    const p = multiply(a, b) as Sparse;
    expect(p.storage()).toBe('sparse');
    expect(p.density()).toBe(0.5);
  });
});

describe('#1582 Unit CSC arithmetic does not pair Unit with numeric 0', () => {
  it('subtract of two sparse Unit matrices', () => {
    const a = sparse([[unit('2 cm'), unit('0 cm')]]);
    const b = sparse([[unit('1 cm'), unit('0 cm')]]);
    const s = subtract(a, b) as Sparse;
    expect(s.storage()).toBe('sparse');
    expect(s.toArray()[0][1]).toBe(0);
  });

  it('add of two number sparse matrices is unchanged (plain numbers)', () => {
    const s = add(
      sparse([
        [1, 0],
        [0, 2],
      ]),
      sparse([
        [3, 0],
        [0, 4],
      ])
    ) as Sparse;
    expect(s.storage()).toBe('sparse');
    expect(s.density()).toBe(0.5);
    expect(s.toArray()).toEqual([
      [4, 0],
      [0, 6],
    ]);
  });
});

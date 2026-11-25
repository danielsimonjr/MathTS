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
  _values?: unknown[];
};

function asSparse(m: unknown): Sparse {
  return m as Sparse;
}

describe('#1582 factory CSC structural zeros', () => {
  it('number zeros use exact === 0: density 0.5, 1e-100 stays, -0 drops, NaN stays', () => {
    expect(
      asSparse(
        sparse([
          [3, 0],
          [5, 0],
        ])
      ).density()
    ).toBe(0.5);
    expect(
      asSparse(
        sparse([
          [1e-100, 0],
          [1, 1],
        ])
      ).density()
    ).toBe(0.75);
    expect(
      asSparse(
        sparse([
          [3, -0],
          [5, 0],
        ])
      ).density()
    ).toBe(0.5);
    expect(
      asSparse(
        sparse([
          [NaN, 0],
          [1, 1],
        ])
      ).density()
    ).toBe(0.75);
  });

  it('BigNumber / Fraction / Complex / Unit zeros are not stored', () => {
    const bn = asSparse(
      sparse([
        [bignumber(3), bignumber(0)],
        [bignumber(5), bignumber(0)],
      ])
    );
    expect(bn.density()).toBe(0.5);
    expect(bn.toArray()[0][1]).toBe(0);

    const fr = asSparse(
      sparse([
        [fraction(3), fraction(0)],
        [fraction(5), fraction(0)],
      ])
    );
    expect(fr.density()).toBe(0.5);

    const cx = asSparse(
      sparse([
        [complex(3, 0), complex(0, 0)],
        [complex(5, 0), complex(0, 0)],
      ])
    );
    expect(cx.density()).toBe(0.5);

    const u = asSparse(
      sparse([
        [unit('1 cm'), unit('0 cm')],
        [unit('0 cm'), unit('2 cm')],
      ])
    );
    expect(u.density()).toBe(0.5);
    expect(u.toArray()[0][1]).toBe(0);
  });

  it('set of a typed zero removes the stored entry', () => {
    const m = asSparse(sparse([[bignumber(1), bignumber(2)]]));
    m.set([0, 0], bignumber(0));
    expect(m.toArray()[0][0]).toBe(0);
    expect(m.density()).toBe(0.5);
  });

  it('matrixFromColumns omits typed zeros (from-vectors CSC write)', () => {
    const result = asSparse(
      matrixFromColumns(
        matrix([[bignumber(1)], [bignumber(0)], [bignumber(3)]], 'sparse'),
        matrix([[bignumber(0)], [bignumber(2)], [bignumber(0)]], 'sparse')
      )
    );
    expect(result.storage()).toBe('sparse');
    expect(result._values).toHaveLength(3);
    expect(result.toArray()[1][0]).toBe(0);
  });

  it('multiply of two number sparse matrices that cancel a cell does not store 0', () => {
    const a = asSparse(
      sparse([
        [1, 0],
        [0, 1],
      ])
    );
    const b = asSparse(
      sparse([
        [0, 2],
        [3, 0],
      ])
    );
    const p = asSparse(multiply(a, b));
    expect(p.storage()).toBe('sparse');
    expect(p.density()).toBe(0.5);
  });
});

describe('#1582 Unit CSC arithmetic does not pair Unit with numeric 0', () => {
  it('subtract of two sparse Unit matrices', () => {
    const a = sparse([[unit('2 cm'), unit('0 cm')]]);
    const b = sparse([[unit('1 cm'), unit('0 cm')]]);
    const s = asSparse(subtract(a, b));
    expect(s.storage()).toBe('sparse');
    expect(s.toArray()[0][1]).toBe(0);
  });

  it('add of two number sparse matrices is unchanged (plain numbers)', () => {
    const s = asSparse(
      add(
        sparse([
          [1, 0],
          [0, 2],
        ]),
        sparse([
          [3, 0],
          [0, 4],
        ])
      )
    );
    expect(s.storage()).toBe('sparse');
    expect(s.density()).toBe(0.5);
    expect(s.toArray()).toEqual([
      [4, 0],
      [0, 6],
    ]);
  });
});

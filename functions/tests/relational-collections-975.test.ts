/**
 * #975 items 1 and 2, #1307: `equal`, `unequal`, `smaller`, `larger`, `smallerEq`, `largerEq`
 * and `compare` take an Array or a matrix, element-wise, as mathjs does.
 *
 * Before the fix the public exports were the scalar-only typed functions. `larger([1,2,3], 1)`
 * threw a TypeError, so the operator `>` and an expression filter such as `x[x > 1]` could not
 * run, and `unequal` of two collections gave one boolean. The mathjs ports in the factory layer
 * already took collections. The typed functions now hold rows (`Array, any` and so on) that call
 * the factory function, so the values and the result storage are those of the mathjs port.
 *
 * The oracle is the mathjs devDependency (15.2.0). A boolean that a sparse result stores as
 * `false` reads as `false` in MathTS and as 0 in mathjs, so sparse results compare by
 * `Number`.
 */
import { describe, it, expect } from 'vitest';
import * as mathjs from 'mathjs';
import { DenseMatrix, SparseMatrix } from '@danielsimonjr/mathts-matrix';
import * as math from '../src/index.js';
import * as compat from '../../compat/src/index.js';

type Fn = (...a: unknown[]) => unknown;
type Lib = Record<string, Fn>;
const MT = math as unknown as Lib;
const MJ = mathjs as unknown as Lib;

const NAMES = [
  'equal',
  'unequal',
  'smaller',
  'larger',
  'smallerEq',
  'largerEq',
  'compare',
] as const;

const A = [
  [1, 2],
  [3, 4],
];

/** The nested Array of a matrix, or the value itself. */
function plain(x: unknown): unknown {
  const t = (x as { toArray?: () => unknown } | null)?.toArray;
  return typeof t === 'function' ? t.call(x) : x;
}

/** A nested value with booleans as numbers (true is 1, false is 0). */
function norm(x: unknown): unknown {
  const v = plain(x);
  if (Array.isArray(v)) return v.map(norm);
  return typeof v === 'boolean' ? Number(v) : v;
}

type Case = [string, (lib: Lib) => unknown[]];
const CASES: Case[] = [
  [
    'Array, Array',
    () => [
      [1, 2],
      [0, 5],
    ],
  ],
  ['Array, scalar', () => [[1, 2, 3], 1]],
  ['scalar, Array', () => [1, [0, 1, 2]]],
  ['2-D Array, 1-D Array (broadcast)', () => [A, [1, 3]]],
  ['dense, scalar', (l) => [l.matrix(A), 2]],
  ['scalar, dense', (l) => [2, l.matrix(A)]],
  [
    'dense, dense',
    (l) => [
      l.matrix(A),
      l.matrix([
        [1, 1],
        [4, 4],
      ]),
    ],
  ],
  [
    'Array, dense',
    (l) => [
      A,
      l.matrix([
        [1, 1],
        [4, 4],
      ]),
    ],
  ],
  [
    'sparse, sparse',
    (l) => [
      l.sparse(A),
      l.sparse([
        [2, 2],
        [2, 2],
      ]),
    ],
  ],
  [
    'sparse with zeros, sparse',
    (l) => [
      l.sparse([
        [1, 0],
        [0, 2],
      ]),
      l.sparse([
        [1, 0],
        [0, 3],
      ]),
    ],
  ],
  [
    'sparse, scalar',
    (l) => [
      l.sparse([
        [1, 0],
        [0, 1],
      ]),
      0,
    ],
  ],
  [
    'sparse, dense',
    (l) => [
      l.sparse(A),
      l.matrix([
        [1, 1],
        [4, 4],
      ]),
    ],
  ],
];

describe('#975 / #1307 values and storage follow mathjs 15.2.0', () => {
  for (const name of NAMES) {
    for (const [label, build] of CASES) {
      it(`${name}: ${label}`, () => {
        const mt = MT[name](...build(MT));
        const mj = MJ[name](...build(MJ));
        expect(norm(mt)).toEqual(norm(mj));
      });
    }
  }
  it('the values of the issues', () => {
    expect(MT.larger([1, 2, 3], 1)).toEqual([false, true, true]);
    expect(MT.equal([1, 2], [1, 2])).toEqual([true, true]);
    expect(MT.compare([1, 2], [2, 2])).toEqual([-1, 0]);
    expect(MT.larger([1, 2], [0, 5])).toEqual([true, false]);
    expect(norm(MT.compare(MT.matrix(A), 2))).toEqual([
      [-1, 0],
      [1, 1],
    ]);
    expect(norm(MT.largerEq(MT.matrix(A), 2))).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(
      norm(
        MT.smallerEq(
          A,
          MT.matrix([
            [1, 1],
            [4, 4],
          ])
        )
      )
    ).toEqual([
      [1, 0],
      [1, 1],
    ]);
    expect(MT.unequal([1, 2], [1, 3])).toEqual([false, true]);
    expect(MT.larger(A, [1, 3])).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(MT.equal([], [])).toEqual([]);
  });
});

describe('#975 item 2: unequal on collections is element-wise', () => {
  it('Arrays', () => {
    expect(MT.unequal([1, 2], [1, 3])).toEqual([false, true]);
  });
  it('two sparse matrices', () => {
    const r = MT.unequal(
      MT.sparse(A),
      MT.sparse([
        [1, 0],
        [3, 4],
      ])
    );
    expect(norm(r)).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });
  it('a dense matrix and a scalar', () => {
    expect(norm(MT.unequal(MT.matrix(A), 2))).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });
  it('a scalar pair is a boolean, and null is only equal to null', () => {
    expect(MT.unequal(1, 2)).toBe(true);
    expect(MT.unequal(0, null)).toBe(true);
    expect(MT.unequal(null, null)).toBe(false);
    expect(MT.unequal([1], null)).toBe(true);
    expect(MT.unequal(null, [1])).toBe(true);
  });
});

describe('#975 rich scalars against a collection', () => {
  it('Fraction', () => {
    expect(MT.larger([MT.fraction(1, 2)], MT.fraction(1, 3))).toEqual([true]);
  });
  it('Unit', () => {
    expect(MT.larger([MT.unit('1 m')], MT.unit('50 cm'))).toEqual([true]);
  });
  it('BigNumber', () => {
    expect(MT.larger([1, 2], MT.bignumber(1))).toEqual([false, true]);
  });
  it('Complex (equal)', () => {
    expect(MT.equal([MT.complex(1, 1)], MT.complex(1, 1))).toEqual([true]);
  });
  it('string', () => {
    expect(MT.larger(['3'], ['2'])).toEqual([true]);
  });
});

describe('#975 result storage', () => {
  it('Array in, Array out; a factory matrix in, a factory dense matrix out', () => {
    expect(Array.isArray(MT.larger([1, 2], 1))).toBe(true);
    expect((MT.larger(MT.matrix(A), 2) as object).constructor.name).toBe('MathJSDenseMatrix');
  });
  it('two CSC operands give a CSC matrix with the mathjs structure', () => {
    const r = MT.smaller(
      MT.sparse(A),
      MT.sparse([
        [2, 2],
        [2, 2],
      ])
    ) as {
      constructor: { name: string };
      _index: number[];
      _ptr: number[];
    };
    const live = MJ.smaller(
      MJ.sparse(A),
      MJ.sparse([
        [2, 2],
        [2, 2],
      ])
    ) as unknown as {
      _index: number[];
      _ptr: number[];
    };
    expect(r.constructor.name).toBe('MathJSSparseMatrix');
    expect(r._index).toEqual(live._index);
    expect(r._ptr).toEqual(live._ptr);
  });
  it('a CSC matrix and a scalar give a dense matrix (mathjs)', () => {
    const r = MT.larger(MT.sparse(A), 1) as { constructor: { name: string } };
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(norm(r)).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });
  const csr = (d: number[][]) => SparseMatrix.fromDense(DenseMatrix.fromArray(d));
  it('a public CSR matrix and a scalar give a factory dense matrix of booleans', () => {
    const r = MT.larger(csr(A), 1) as { constructor: { name: string } };
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
    expect(plain(r)).toEqual([
      [false, true],
      [true, true],
    ]);
  });
  it('two public CSR matrices give a public SparseMatrix of 1 and 0', () => {
    const r = MT.larger(
      csr(A),
      csr([
        [0, 5],
        [3, 1],
      ])
    );
    expect(r).toBeInstanceOf(SparseMatrix);
    expect((plain(r) as number[][]).map((row) => row.map(Boolean))).toEqual([
      [true, false],
      [false, true],
    ]);
  });
  it('a public CSR matrix and an Array give a factory dense matrix of booleans', () => {
    const r = MT.larger(csr(A), [
      [0, 5],
      [3, 1],
    ]) as { constructor: { name: string } };
    expect(r.constructor.name).toBe('MathJSDenseMatrix');
  });
});

describe('#975 comparison tolerance and shapes', () => {
  it('equal([0.1 + 0.2], [0.3]) is [true] (relative tolerance)', () => {
    expect(MT.equal([0.1 + 0.2], [0.3])).toEqual([true]);
  });
  it('a pair of shapes that cannot broadcast throws', () => {
    expect(() => MT.equal([1, 2], [1, 2, 3])).toThrow();
    expect(() => MJ.equal([1, 2], [1, 2, 3])).toThrow();
  });
});

describe('scalar calls keep their rows and values', () => {
  it('larger, equal, compare', () => {
    expect(MT.larger(2, 1)).toBe(true);
    expect(MT.equal(0.1 + 0.2, 0.3)).toBe(true);
    expect(MT.compare(MT.fraction(1, 2), MT.fraction(1, 3))).toBe(1);
    expect(MT.larger(MT.unit('1 m'), MT.unit('50 cm'))).toBe(true);
    expect(MT.equal(MT.fraction(1, 2), 0.5)).toBe(MJ.equal(MJ.fraction(1, 2), 0.5));
  });
});

describe('#1307 operators in an expression', () => {
  const cases: Array<[string, unknown]> = [
    ['[1,2,3] > 1', [false, true, true]],
    ['[1,2,3][[1,2,3] > 1]', [2, 3]],
    ['[1,2] == [1,3]', [true, false]],
    ['[1,2] != [1,3]', [false, true]],
    ['[1,2] <= 1', [true, false]],
    ['[1,2] >= 2', [false, true]],
    ['[1,2] < 2', [true, false]],
    [
      '[[1,2],[3,4]] > 2',
      [
        [false, false],
        [true, true],
      ],
    ],
  ];
  const c = compat.create(compat.all) as unknown as { evaluate: Fn };
  for (const [expr, expected] of cases) {
    it(`functions evaluate("${expr}")`, () => {
      expect(norm((math.evaluate as unknown as Fn)(expr))).toEqual(norm(expected));
    });
    it(`compat evaluate("${expr}")`, () => {
      expect(norm(c.evaluate(expr))).toEqual(norm(expected));
    });
  }
  it('the compat instance function takes a collection', () => {
    const l = (compat.create(compat.all) as unknown as Lib).larger;
    expect(l([1, 2, 3], 1)).toEqual([false, true, true]);
  });
});

/**
 * Dogfood #1219 - lusolve with a Complex entry in A or b.
 *
 * An Array A took the packed Float64 factorization, which dropped the imaginary part
 * of A and of b. An entry that is not a number now takes the typed path, as a
 * DenseMatrix or SparseMatrix A does. Number input is unchanged.
 */
import { describe, it, expect } from 'vitest';
import {
  lusolve as lusolveFn,
  lup,
  slu,
  sparse,
  matrix,
  complex,
  bignumber,
  fraction,
} from '../src/factories/index.js';

const lusolve = lusolveFn as (
  a: unknown,
  b: unknown,
  order?: number,
  threshold?: number
) => unknown;
const i = complex(0, 1);

const col = (x: unknown): Array<{ re: number; im: number }> =>
  (x as { valueOf(): unknown[][] }).valueOf().map((r) => {
    const v = r[0] as { re?: number; im?: number } | number;
    return typeof v === 'number' ? { re: v, im: 0 } : { re: v.re ?? 0, im: v.im ?? 0 };
  });

function expectComplex(x: unknown, want: Array<[number, number]>): void {
  const got = col(x);
  expect(got).toHaveLength(want.length);
  want.forEach(([re, im], k) => {
    expect(got[k].re).toBeCloseTo(re, 12);
    expect(got[k].im).toBeCloseTo(im, 12);
  });
}

describe('lusolve Complex entries (#1219)', () => {
  it('Array A with a Complex entry', () => {
    expectComplex(
      lusolve(
        [
          [i, 0],
          [0, 1],
        ],
        [1, 1]
      ),
      [
        [0, -1],
        [1, 0],
      ]
    );
  });

  it('Array A residual A x = b holds', () => {
    const x = col(
      lusolve(
        [
          [1, 2],
          [3, i],
        ],
        [1, 2]
      )
    );
    // Row 0: x0 + 2 x1 = 1. Row 1: 3 x0 + i x1 = 2, with i (a + bi) = -b + ai.
    expect(x[0].re + 2 * x[1].re).toBeCloseTo(1, 12);
    expect(x[0].im + 2 * x[1].im).toBeCloseTo(0, 12);
    expect(3 * x[0].re - x[1].im).toBeCloseTo(2, 12);
    expect(3 * x[0].im + x[1].re).toBeCloseTo(0, 12);
  });

  it('Complex b with a numeric Array A', () => {
    expectComplex(
      lusolve(
        [
          [2, 1],
          [1, 3],
        ],
        [complex(5, 1), 10]
      ),
      [
        [1, 0.6],
        [3, -0.2],
      ]
    );
  });

  it('Complex b as a column Array and as a Matrix', () => {
    expectComplex(
      lusolve(
        [
          [2, 1],
          [1, 3],
        ],
        [[complex(5, 1)], [10]]
      ),
      [
        [1, 0.6],
        [3, -0.2],
      ]
    );
    expectComplex(
      lusolve(
        [
          [2, 1],
          [1, 3],
        ],
        matrix([complex(5, 1), 10])
      ),
      [
        [1, 0.6],
        [3, -0.2],
      ]
    );
  });

  it('DenseMatrix A and SparseMatrix A', () => {
    expectComplex(
      lusolve(
        matrix([
          [i, 0],
          [0, 1],
        ]),
        [1, 1]
      ),
      [
        [0, -1],
        [1, 0],
      ]
    );
    expectComplex(
      lusolve(
        sparse([
          [i, 0],
          [0, 1],
        ]),
        [1, 1]
      ),
      [
        [0, -1],
        [1, 0],
      ]
    );
    expectComplex(
      lusolve(
        sparse([
          [i, 0],
          [0, 1],
        ]),
        [1, 1],
        1,
        1
      ),
      [
        [0, -1],
        [1, 0],
      ]
    );
    expectComplex(
      lusolve(
        sparse([
          [2, 1],
          [1, 3],
        ]),
        [complex(5, 1), 10]
      ),
      [
        [1, 0.6],
        [3, -0.2],
      ]
    );
    expectComplex(
      lusolve(
        sparse([
          [2, 1],
          [1, 3],
        ]),
        [complex(5, 1), 10],
        1,
        1
      ),
      [
        [1, 0.6],
        [3, -0.2],
      ]
    );
  });

  it('lup and slu factor objects', () => {
    expectComplex(
      lusolve(
        lup(
          matrix([
            [i, 0],
            [0, 1],
          ])
        ),
        [1, 1]
      ),
      [
        [0, -1],
        [1, 0],
      ]
    );
    expectComplex(
      lusolve(
        slu(
          sparse([
            [i, 0],
            [0, 1],
          ]),
          1,
          1
        ),
        [1, 1]
      ),
      [
        [0, -1],
        [1, 0],
      ]
    );
  });

  it('BigNumber and Fraction keep their type on an Array A', () => {
    const bn = lusolve(
      [
        [bignumber(2), bignumber(1)],
        [bignumber(1), bignumber(3)],
      ],
      [bignumber('0.1'), bignumber('0.2')]
    ) as Array<[{ toString(): string; isBigNumber?: boolean }]>;
    expect(bn.map((r) => r[0].toString())).toEqual(['0.02', '0.06']);
    const bnB = lusolve(
      [
        [2, 1],
        [1, 3],
      ],
      [bignumber('0.1'), bignumber('0.2')]
    ) as Array<[{ toString(): string }]>;
    expect(bnB.map((r) => r[0].toString())).toEqual(['0.02', '0.06']);
    const fr = lusolve(
      [
        [fraction(2), fraction(1)],
        [fraction(1), fraction(3)],
      ],
      [fraction(1, 3), fraction(1, 7)]
    ) as Array<[unknown]>;
    expect(fr.map((r) => String(r[0]))).toEqual(['0.1(714285)', '-0.0(095238)']);
  });

  it('a string entry is read as a number, as mathjs does', () => {
    expect(
      lusolve(
        [
          [2, 1],
          [1, 3],
        ],
        [['5'], ['10']]
      )
    ).toEqual([[1], [3]]);
    expect(
      lusolve(
        [
          ['2', 1],
          [1, 3],
        ],
        [5, 10]
      )
    ).toEqual([[1], [3]]);
  });

  it('number input is unchanged', () => {
    expect(
      lusolve(
        [
          [2, 1],
          [1, 3],
        ],
        [5, 10]
      )
    ).toEqual([[1], [3]]);
    expect(lusolve([], [])).toEqual([]);
    expect(() =>
      lusolve(
        [
          [2, 1],
          [1, 3],
        ],
        [
          [1, 2],
          [3, 4],
        ]
      )
    ).toThrow(/Dimension mismatch/);
  });
});

describe('lusolve Array A: shape checks do not depend on the entry type (#1219)', () => {
  const MISMATCH = 'Dimension mismatch. Matrix columns must match vector length.';
  // One Complex, one BigNumber and one number A of each shape. Every kind throws the same error.
  const kinds: Array<[string, unknown]> = [
    ['number', 1],
    ['Complex', i],
    ['BigNumber', bignumber(1)],
  ];

  function expectThrow(fn: () => unknown, type: ErrorConstructor, message: string): void {
    let caught: unknown;
    try {
      fn();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(type);
    expect((caught as Error).constructor).toBe(type);
    expect((caught as Error).message).toBe(message);
  }

  for (const [kind, x] of kinds) {
    const sq = [
      [x, 0],
      [0, 1],
    ];
    it(`${kind} A: a ragged b throws the dimension error`, () => {
      expectThrow(() => lusolve(sq, [[1], [2, 3]]), RangeError, MISMATCH);
    });
    it(`${kind} A: a 1 x n b throws the dimension error`, () => {
      expectThrow(() => lusolve(sq, [[1, 2]]), RangeError, MISMATCH);
    });
    it(`${kind} A: an Array entry of a vector b throws the dimension error`, () => {
      expectThrow(() => lusolve(sq, [1, [2]]), RangeError, MISMATCH);
    });
    it(`${kind} A: a b of the wrong length throws the dimension error`, () => {
      expectThrow(() => lusolve(sq, [1, 2, 3]), RangeError, MISMATCH);
    });
    it(`${kind} A: a non-square A throws the lu square error`, () => {
      expectThrow(
        () =>
          lusolve(
            [
              [x, 0, 0],
              [0, 1, 0],
            ],
            [1, 2]
          ),
        Error,
        'lu: matrix must be square (got 2×3)'
      );
    });
    it(`${kind} A: a ragged A throws the jagged error`, () => {
      expectThrow(
        () => lusolve([[x, 0], [1]], [1, 2]),
        TypeError,
        'Matrix decomposition: jagged nested array at row 1'
      );
    });
  }

  it('a number A with a ragged Complex b throws the dimension error', () => {
    expectThrow(
      () =>
        lusolve(
          [
            [1, 0],
            [0, 1],
          ],
          [[i], [2, 3]]
        ),
      RangeError,
      MISMATCH
    );
  });

  it('a Complex b with an empty A throws the dimension error', () => {
    expectThrow(() => lusolve([], [i]), RangeError, MISMATCH);
  });

  it('a bigint A solves on the typed path (main threw a BigInt conversion TypeError)', () => {
    expect(
      lusolve(
        [
          [2n, 0n],
          [0n, 4n],
        ],
        [2n, 2n]
      )
    ).toEqual([[1], [0.5]]);
  });
});

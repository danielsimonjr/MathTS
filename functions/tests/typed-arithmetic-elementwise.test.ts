import { describe, it, expect } from 'vitest';

import { Complex } from '@danielsimonjr/mathts-core';
import { add, multiply, subtract } from '../src/typed/arithmetic.js';
import { matrix, sparse } from '../src/factories/index.js';

/**
 * Element-wise Array / Matrix support for the typed `add` and `multiply`.
 *
 * Before this, `add([1,2],[3,4])`, `add(denseM,denseM)`, and `add(sparseM,sparseM)`
 * all threw "Too few arguments … index 2" — the typed `add` had no 2-argument
 * Array/Matrix signature and the `'any,any,...any'` variadic doesn't match a
 * 2-arg call in this typed-function fork. `multiply` had `Array,Array` matmul but
 * no scalar-scaling or Matrix-typed operands.
 *
 * Semantics (mathjs parity): `add` is element-wise; `multiply` is matrix
 * multiplication for matrix×matrix (2-D) and element-wise scaling for
 * scalar×collection (element-wise product of two collections is `dotMultiply`).
 */

const A = add as (a: unknown, b: unknown) => unknown;
const M = multiply as (a: unknown, b: unknown) => unknown;
const S = subtract as (a: unknown, b: unknown) => unknown;
const dense = (v: unknown) => (v as { valueOf(): unknown }).valueOf();

describe('add — element-wise Array', () => {
  it('vectors: add([1,2,3],[4,5,6]) = [5,7,9]', () => {
    expect(A([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
  });

  it('matrices (nested): add([[1,2],[3,4]],[[5,6],[7,8]]) = [[6,8],[10,12]]', () => {
    expect(
      A(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [5, 6],
          [7, 8],
        ]
      )
    ).toEqual([
      [6, 8],
      [10, 12],
    ]);
  });

  it('scalar broadcast both directions', () => {
    expect(A([1, 2, 3], 10)).toEqual([11, 12, 13]);
    expect(A(10, [1, 2, 3])).toEqual([11, 12, 13]);
  });

  it('dimension mismatch throws', () => {
    expect(() => A([1, 2, 3], [1, 2])).toThrow();
  });
});

describe('add — element-wise Matrix', () => {
  it('dense: add(matrix, matrix) = element-wise', () => {
    const r = A(
      matrix([
        [1, 2],
        [3, 4],
      ]),
      matrix([
        [5, 6],
        [7, 8],
      ])
    );
    expect(dense(r)).toEqual([
      [6, 8],
      [10, 12],
    ]);
  });

  it('sparse: add(sparse, sparse) = element-wise, stays sparse (CSC)', () => {
    const r = A(
      sparse([
        [1, 0],
        [0, 2],
      ]),
      sparse([
        [0, 3],
        [4, 0],
      ])
    );
    // returned as a SparseMatrix with CSC fields intact
    expect((r as { type?: string }).type).toBe('SparseMatrix');
    expect((r as { _ptr?: number[] })._ptr).toBeDefined();
    expect(dense(r)).toEqual([
      [1, 3],
      [4, 2],
    ]);
  });
});

describe('multiply — scalar scaling + matrix multiplication', () => {
  it('scalar scaling of arrays (both directions)', () => {
    expect(M([1, 2, 3], 2)).toEqual([2, 4, 6]);
    expect(M(2, [1, 2, 3])).toEqual([2, 4, 6]);
  });

  it('dense matrix × matrix = matmul', () => {
    // [[1,2],[3,4]] · [[5,6],[7,8]] = [[19,22],[43,50]]
    const r = M(
      matrix([
        [1, 2],
        [3, 4],
      ]),
      matrix([
        [5, 6],
        [7, 8],
      ])
    );
    expect(dense(r)).toEqual([
      [19, 22],
      [43, 50],
    ]);
  });

  it('scalar × matrix = scaling', () => {
    const r = M(
      3,
      matrix([
        [1, 2],
        [3, 4],
      ])
    );
    expect(dense(r)).toEqual([
      [3, 6],
      [9, 12],
    ]);
  });
});

describe('subtract — element-wise Array', () => {
  it('vectors (the #384 case): subtract([1,2,3],[1,1,1]) = [0,1,2]', () => {
    expect(S([1, 2, 3], [1, 1, 1])).toEqual([0, 1, 2]);
  });

  it('operand order is kept: subtract([1,2,3],[3,2,1]) = [-2,0,2]', () => {
    expect(S([1, 2, 3], [3, 2, 1])).toEqual([-2, 0, 2]);
  });

  it('matrices (nested): subtract([[6,8],[10,12]],[[5,6],[7,8]]) = [[1,2],[3,4]]', () => {
    expect(
      S(
        [
          [6, 8],
          [10, 12],
        ],
        [
          [5, 6],
          [7, 8],
        ]
      )
    ).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('scalar broadcast both directions', () => {
    expect(S([10, 20, 30], 1)).toEqual([9, 19, 29]);
    expect(S(10, [1, 2, 3])).toEqual([9, 8, 7]);
  });

  it('dimension mismatch throws', () => {
    expect(() => S([1, 2, 3], [1, 2])).toThrow(/Dimension mismatch/);
  });

  it('Complex leaves fold through the binary subtract', () => {
    const r = S(
      [new Complex(5, 2), new Complex(1, 1)],
      [new Complex(3, 1), new Complex(1, 1)]
    ) as Complex[];
    expect(r.map((z) => [z.re, z.im])).toEqual([
      [2, 1],
      [0, 0],
    ]);
  });
});

describe('subtract — element-wise Matrix', () => {
  it('dense: subtract(matrix, matrix) = element-wise', () => {
    const r = S(
      matrix([
        [6, 8],
        [10, 12],
      ]),
      matrix([
        [5, 6],
        [7, 8],
      ])
    );
    expect(dense(r)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('sparse: subtract(sparse, sparse) = element-wise, stays sparse (CSC)', () => {
    const r = S(
      sparse([
        [1, 3],
        [4, 2],
      ]),
      sparse([
        [0, 3],
        [4, 0],
      ])
    );
    expect((r as { type?: string }).type).toBe('SparseMatrix');
    expect((r as { _ptr?: number[] })._ptr).toBeDefined();
    expect(dense(r)).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });

  it('matrix and scalar, both directions', () => {
    const m = matrix([
      [1, 2],
      [3, 4],
    ]);
    expect(dense(S(m, 1))).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(dense(S(10, m))).toEqual([
      [9, 8],
      [7, 6],
    ]);
  });
});

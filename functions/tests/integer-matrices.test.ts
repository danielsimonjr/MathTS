import { describe, it, expect } from 'vitest';
import { hermiteNormalForm, smithNormalForm, lll } from '../src/numbertheory/integer-matrices.js';

describe('smithNormalForm', () => {
  it('invariant factors', () => {
    const { invariants } = smithNormalForm([
      [2, 4, 4],
      [-6, 6, 12],
      [10, -4, -16],
    ]);
    expect(invariants).toEqual([2n, 6n, 12n]);
  });
  it('diagonal form is divisibility chain with the same determinant', () => {
    const { D, invariants } = smithNormalForm([
      [2, 4, 4],
      [-6, 6, 12],
      [10, -4, -16],
    ]);
    expect(D[0][1]).toBe(0n);
    expect(invariants[0] * invariants[1] * invariants[2]).toBe(144n);
    expect(invariants[1] % invariants[0]).toBe(0n);
    expect(invariants[2] % invariants[1]).toBe(0n);
  });
});

describe('hermiteNormalForm', () => {
  it('reference matrix', () => {
    expect(
      hermiteNormalForm([
        [2, 3, 6, 2],
        [5, 6, 1, 6],
        [8, 3, 1, 1],
      ])
    ).toEqual([
      [1n, 0n, 50n, -11n],
      [0n, 3n, 28n, -2n],
      [0n, 0n, 61n, -13n],
    ]);
  });
  it('identity is its own HNF', () => {
    expect(
      hermiteNormalForm([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
    ).toEqual([
      [1n, 0n, 0n],
      [0n, 1n, 0n],
      [0n, 0n, 1n],
    ]);
  });
});

describe('lll', () => {
  it('reduces the reference basis', () => {
    expect(
      lll([
        [1, 1, 1],
        [-1, 0, 2],
        [3, 5, 6],
      ])
    ).toEqual([
      [0, 1, 0],
      [1, 0, 1],
      [-1, 0, 2],
    ]);
  });
  it('rejects linearly dependent input', () => {
    expect(() =>
      lll([
        [1, 2],
        [2, 4],
      ])
    ).toThrow(RangeError);
  });
});

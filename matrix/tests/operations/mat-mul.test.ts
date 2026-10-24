/**
 * Public `matMul` export — oracle against an independent naive triple loop.
 */

import { describe, it, expect } from 'vitest';
import { matMul } from '../../src/index.js';

/** Reference product (no zero-skip); same i–k–j order as the canonical implementation. */
function naiveMatMul(A: number[][], B: number[][]): number[][] {
  const m = A.length;
  const p = A[0].length;
  const n = B[0].length;
  const C: number[][] = Array.from({ length: m }, () => new Array(n).fill(0));
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < p; k++) {
      for (let j = 0; j < n; j++) {
        C[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  return C;
}

describe('matMul (public export)', () => {
  it('matches hand-computed 2×2 product', () => {
    expect(
      matMul(
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
      [19, 22],
      [43, 50],
    ]);
  });

  it('matches naive reference on random-shaped finite matrices', () => {
    const A = [
      [0.5, -1, 2],
      [3, 0, -4],
    ];
    const B = [
      [1, 0],
      [2, 1],
      [-1, 3],
    ];
    expect(matMul(A, B)).toEqual(naiveMatMul(A, B));
  });

  it('non-square 2×3 × 3×1', () => {
    expect(
      matMul(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [[1], [2], [3]]
      )
    ).toEqual([[14], [32]]);
  });

  it('1×1', () => {
    expect(matMul([[2]], [[3]])).toEqual([[6]]);
  });

  it('zero entries in A match the naive product (zero-skip path)', () => {
    const A = [
      [0, 2],
      [3, 0],
    ];
    const B = [
      [1, 0],
      [0, 1],
    ];
    expect(matMul(A, B)).toEqual(naiveMatMul(A, B));
  });

  it('N×0 × N×0 with empty columns (inner dimension zero)', () => {
    const A = [[], []];
    const B = [[], []];
    expect(matMul(A, B)).toEqual([[], []]);
  });

  it('preserves non-conformable error: inner dimension mismatch throws on B[row]', () => {
    expect(() =>
      matMul(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [
          [1, 2],
          [3, 4],
        ]
      )
    ).toThrow();
  });

  it('preserves empty-A error contract', () => {
    expect(() => matMul([], [[1]])).toThrow();
  });

  it('preserves empty-B error contract (zero-row B)', () => {
    expect(() => matMul([[1, 2]], [])).toThrow();
  });
});

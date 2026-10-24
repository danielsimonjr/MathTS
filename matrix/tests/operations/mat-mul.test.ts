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

  it('skips a zero in A so 0·NaN does not poison the product', () => {
    // Closed form: only the second column of A contributes → [[2]].
    // A naive loop without the skip yields NaN. This fails if the skip is dropped.
    expect(matMul([[0, 1]], [[NaN], [2]])).toEqual([[2]]);
    expect(matMul([[-0, 1]], [[NaN], [4]])).toEqual([[4]]);
  });

  it('propagates Inf / NaN when the A factor is not skipped', () => {
    expect(matMul([[Infinity, 1]], [[1], [1]])).toEqual([[Infinity]]);
    expect(matMul([[NaN, 1]], [[2], [3]])[0][0]).toBeNaN();
  });

  it('matches the naive oracle on randomized finite (incl. zero) shapes', () => {
    // Independent of matMul: a tiny LCG, not the implementation under test.
    let s = 0x9e3779b9;
    const rnd = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      return (s >>> 0) / 0x100000000;
    };
    const fill = (rows: number, cols: number): number[][] =>
      Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => {
          const u = rnd();
          if (u < 0.2) return 0;
          return rnd() * 20 - 10;
        })
      );
    const shapes: Array<[number, number, number]> = [
      [1, 1, 1],
      [2, 3, 1],
      [3, 2, 4],
      [5, 7, 3],
      [1, 8, 2],
    ];
    for (const [m, p, n] of shapes) {
      for (let t = 0; t < 8; t++) {
        const A = fill(m, p);
        const B = fill(p, n);
        expect(matMul(A, B)).toEqual(naiveMatMul(A, B));
      }
    }
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

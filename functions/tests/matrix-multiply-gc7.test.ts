import { describe, it, expect } from 'vitest';
import { multiply } from '@danielsimonjr/mathts-functions';

/**
 * GC7 (slice) — matrix × matrix multiplication routed through the native
 * DenseMatrix + BackendManager (the accelerated WASM/GPU path). Previously
 * multiply(2DArray, 2DArray) threw "Too few arguments"; this adds the missing
 * signature and the accelerated path in one.
 */
describe('GC7: multiply(2D, 2D) via accelerated backend', () => {
  it('square matrix product', () => {
    expect(
      multiply(
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

  it('non-square (2x3 · 3x2)', () => {
    expect(
      multiply(
        [
          [1, 2, 3],
          [4, 5, 6],
        ],
        [
          [1, 0],
          [0, 1],
          [1, 1],
        ]
      )
    ).toEqual([
      [4, 5],
      [10, 11],
    ]);
  });

  it('identity is a no-op', () => {
    const A = [
      [2, 7],
      [-1, 3],
    ];
    const I = [
      [1, 0],
      [0, 1],
    ];
    expect(multiply(A, I)).toEqual(A);
  });

  it('large product matches the naive reference (exercises the backend threshold)', () => {
    const n = 40;
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i + j) % 7));
    const B = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i * j) % 5));
    const got = multiply(A, B) as number[][];
    const ref = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        let s = 0;
        for (let k = 0; k < n; k++) s += A[i][k] * B[k][j];
        return s;
      })
    );
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) expect(got[i][j]).toBeCloseTo(ref[i][j], 9);
  });

  it('rejects non-2D Array operands with a clear message', () => {
    expect(() => multiply([1, 2, 3], [4, 5, 6])).toThrow(/2-D matrices|dot/);
  });
});

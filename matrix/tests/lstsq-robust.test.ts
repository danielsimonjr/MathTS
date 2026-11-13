import { describe, it, expect } from 'vitest';
// lstsq review contracts (issue #928): minimum-norm solution for rank-deficient
// input, scaling safety, matrix right-hand sides, wide systems.
import { lstsq } from '../src/index.js';

const mul = (A: number[][], x: number[]) => A.map((r) => r.reduce((s, a, j) => s + a * x[j], 0));
const normalEq = (A: number[][], x: number[], b: number[]) => {
  const r = mul(A, x).map((v, i) => b[i] - v);
  let worst = 0;
  for (let j = 0; j < A[0].length; j++) {
    worst = Math.max(worst, Math.abs(r.reduce((s, ri, i) => s + ri * A[i][j], 0)));
  }
  return worst;
};

describe('lstsq robustness', () => {
  it('columns equal to within rounding are treated as dependent (minimum-norm, as NumPy)', () => {
    for (const e of [1e-16, 1e-15]) {
      const A = [
        [1, 1],
        [1, 1 + e],
        [1, 1],
      ];
      const b = [1, 2, 3];
      const x = lstsq(A, b) as number[];
      expect(Math.hypot(x[0], x[1])).toBeLessThan(1e3);
      expect(normalEq(A, x, b)).toBeLessThan(1e-6);
    }
  });

  it('exactly rank-deficient input returns the minimum-norm solution', () => {
    const A = [
      [1, 1],
      [1, 1],
      [1, 1],
    ];
    const x = lstsq(A, [1, 2, 3]) as number[];
    expect(x[0]).toBeCloseTo(1, 12);
    expect(x[1]).toBeCloseTo(1, 12);
  });

  it('wide system returns the minimum-norm solution', () => {
    const x = lstsq([[1, 1]], [2]) as number[];
    expect(x[0]).toBeCloseTo(1, 12);
    expect(x[1]).toBeCloseTo(1, 12);
  });

  it('handles tiny and huge scales without false errors', () => {
    const t = lstsq(
      [
        [1e-170, 0],
        [0, 1e-170],
        [1e-170, 1e-170],
      ],
      [1e-170, 2e-170, 3e-170]
    ) as number[];
    expect(t[0]).toBeCloseTo(1, 10);
    expect(t[1]).toBeCloseTo(2, 10);
    const h = lstsq(
      [
        [1e160, 0],
        [0, 1e155],
      ],
      [1e160, 1e155]
    ) as number[];
    expect(h[0]).toBeCloseTo(1, 10);
    expect(h[1]).toBeCloseTo(1, 10);
  });

  it('accepts a matrix right-hand side and returns an n x k matrix', () => {
    const A = [
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const X = lstsq(A, [
      [1, 0],
      [2, 1],
      [2, 5],
    ]) as number[][];
    expect(X).toHaveLength(2);
    expect(X[0]).toHaveLength(2);
    expect(X[0][0]).toBeCloseTo(2 / 3, 12);
    expect(X[1][0]).toBeCloseTo(0.5, 12);
  });

  it('rejects a b of the wrong length', () => {
    expect(() =>
      lstsq(
        [
          [1, 1],
          [1, 2],
        ],
        [1, 2, 3]
      )
    ).toThrow(RangeError);
  });

  it('Vandermonde 20x12 satisfies the normal equations', () => {
    const A: number[][] = [];
    const b: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t = i / 19;
      A.push(Array.from({ length: 12 }, (_, j) => t ** j));
      b.push(Math.sin(3 * t));
    }
    expect(normalEq(A, lstsq(A, b) as number[], b)).toBeLessThan(1e-9);
  });
});

/**
 * UPT N5: leastSquares equilibrates columns; linsolve keeps its absolute pivot limit.
 */
import { describe, it, expect } from 'vitest';
import { leastSquares, linsolve } from '../src/index.js';

describe('UPT N5 leastSquares', () => {
  const A = [
    [1, 0],
    [0, 1],
    [1, 1],
  ];
  const b = [1, 1, 2];

  it('solves the well-conditioned base system', () => {
    const x = leastSquares(A, b);
    expect(x[0]).toBeCloseTo(1, 12);
    expect(x[1]).toBeCloseTo(1, 12);
  });

  it('solves a well-conditioned system scaled by 1e-9', () => {
    const As = A.map((row) => row.map((v) => v * 1e-9));
    const x = leastSquares(As, b);
    expect(x[0] / 1e9).toBeCloseTo(1, 10);
    expect(x[1] / 1e9).toBeCloseTo(1, 10);
  });

  it('solves a well-conditioned system scaled by 1e9', () => {
    const As = A.map((row) => row.map((v) => v * 1e9));
    const x = leastSquares(As, b);
    expect(x[0] * 1e9).toBeCloseTo(1, 10);
    expect(x[1] * 1e9).toBeCloseTo(1, 10);
  });

  it('throws on a 1e-14 near-copy column', () => {
    expect(() =>
      leastSquares(
        [
          [1, 1 + 1e-14],
          [1, 1],
          [1, 1],
        ],
        [1, 1, 2]
      )
    ).toThrow(/singular/);
  });

  it('throws on a zero column', () => {
    expect(() =>
      leastSquares(
        [
          [1, 0],
          [2, 0],
          [3, 0],
        ],
        [1, 2, 3]
      )
    ).toThrow(/singular/);
  });

  it('solves columns of very different scale', () => {
    const As = [
      [1, 0],
      [0, 1e-6],
      [1, 1e-6],
    ];
    const x = leastSquares(As, [1, 1e-6, 1 + 1e-6]);
    expect(x[0]).toBeCloseTo(1, 10);
    expect(x[1]).toBeCloseTo(1, 4);
  });
});

describe('UPT N5 linsolve public limit', () => {
  it('still throws on a pivot below the absolute 1e-15 limit', () => {
    expect(() =>
      linsolve(
        [
          [1e-16, 0],
          [0, 1],
        ],
        [1, 1]
      )
    ).toThrow(/singular/);
  });
});

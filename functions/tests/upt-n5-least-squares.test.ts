/**
 * UPT N5: leastSquares equilibrates columns; linsolve keeps a pivot limit of 1e-15 of the pivot row.
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
  it('still throws on a pivot below 1e-15 of its row', () => {
    expect(() =>
      linsolve(
        [
          [1e-16, 1],
          [0, 1],
        ],
        [1, 1]
      )
    ).toThrow(/singular/);
  });

  it('solves a pivot that is small only against other rows (#1169)', () => {
    const x = linsolve(
      [
        [1e-16, 0],
        [0, 1],
      ],
      [1, 1]
    );
    expect(x[0] / 1e16).toBeCloseTo(1, 14);
    expect(x[1]).toBe(1);
  });
});

describe('N5 leastSquares column norm', () => {
  it('solves a 200000-row system without a call-stack overflow', () => {
    const m = 200000;
    const A = Array.from({ length: m }, (_, k) => [1, k % 2]);
    const b = A.map((row) => 2 * row[0] + 3 * row[1]);
    const x = leastSquares(A, b);
    expect(x[0]).toBeCloseTo(2, 8);
    expect(x[1]).toBeCloseTo(3, 8);
  });
  it('solves entries near 1e-170 (the sum of squares would underflow)', () => {
    const A = [
      [1e-170, 0],
      [0, 1e-170],
      [1e-170, 1e-170],
    ];
    const x = leastSquares(A, [1, 1, 2]);
    expect(x[0] * 1e-170).toBeCloseTo(1, 10);
    expect(x[1] * 1e-170).toBeCloseTo(1, 10);
  });
});

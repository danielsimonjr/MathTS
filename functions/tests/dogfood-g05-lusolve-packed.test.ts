/**
 * Dogfood relay G05 — lusolve packed f64 (#701).
 */

import { describe, it, expect, vi } from 'vitest';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { lup, lusolve } from '../src/factories/index.js';

describe('lusolve on nested input reads the packed U factor without a nested copy', () => {
  // A diagonally dominant 40x40 system whose solution is known: x[i] = i + 1.
  const n = 40;
  const A = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? n + 1 : ((i * 7 + j * 3) % 5) / 10))
  );
  const want = Array.from({ length: n }, (_, i) => i + 1);
  const b = A.map((row) => row.reduce((s, v, j) => s + v * want[j], 0));

  it('does not call DenseMatrix.toArray or DenseMatrix.get', () => {
    const toArray = vi.spyOn(DenseMatrix.prototype, 'toArray');
    const get = vi.spyOn(DenseMatrix.prototype, 'get');
    try {
      const x = lusolve(A, b) as number[][];
      expect(toArray).not.toHaveBeenCalled();
      expect(get).not.toHaveBeenCalled();
      expect(x).toHaveLength(n);
      // Positive control: the spies see calls on the matrix package that lusolve uses.
      DenseMatrix.fromArray(A).toArray();
      expect(toArray).toHaveBeenCalledTimes(1);
    } finally {
      toArray.mockRestore();
      get.mockRestore();
    }
  });

  it('returns a fresh column of n single-number rows that solves the system', () => {
    const x = lusolve(A, b) as number[][];
    expect(Array.isArray(x)).toBe(true);
    expect(x).toHaveLength(n);
    for (let i = 0; i < n; i++) {
      expect(x[i]).toHaveLength(1);
      expect(x[i][0]).toBeCloseTo(want[i], 9);
    }
    const again = lusolve(A, b) as number[][];
    expect(again).not.toBe(x);
    expect(again[0]).not.toBe(x[0]);
  });

  it('keeps the singular check: a zero pivot, a non-finite entry and a tiny pivot throw', () => {
    expect(() =>
      lusolve(
        [
          [1, 2],
          [2, 4],
        ],
        [1, 2]
      )
    ).toThrow(/singular/i);
    expect(() =>
      lusolve(
        [
          [1, Number.NaN],
          [0, 1],
        ],
        [1, 1]
      )
    ).toThrow(/singular/i);
    expect(() =>
      lusolve(
        [
          [1, 1],
          [1, 1 + 4e-16],
        ],
        [1, 1]
      )
    ).toThrow(/singular/i);
  });
});

describe('G05 #701 — lusolve accepts square Float64Array', () => {
  it('packed 2×2 row-major matches issue AC', () => {
    const A = new Float64Array([4, 3, 6, 3]);
    const x = lusolve(A, [10, 12]) as number[][];
    expect(x[0][0]).toBeCloseTo(1, 10);
    expect(x[1][0]).toBeCloseTo(2, 10);
  });

  it('issue repro: length-4 buffer is [[1,2],[3,4]] when converted to DenseMatrix', () => {
    const data = new Float64Array([1, 2, 3, 4]);
    const x = lusolve(data, [1, 0]) as number[][];
    expect(x.length).toBe(2);
    expect(Number.isFinite(x[0][0])).toBe(true);
    expect(Number.isFinite(x[1][0])).toBe(true);
  });

  it('rejects non-square packed buffer with a clear error', () => {
    expect(() => lusolve(new Float64Array([1, 2, 3]), [1])).toThrow(TypeError);
  });

  it('accepts { data, rows, cols } and does not treat it as an LU decomposition', () => {
    const x = lusolve({ data: new Float64Array([4, 3, 6, 3]), rows: 2, cols: 2 }, [10, 12]) as
      number[][] | { valueOf(): number[][] };
    const cols = Array.isArray(x) ? x : x.valueOf();
    expect(cols[0][0]).toBeCloseTo(1, 10);
    expect(cols[1][0]).toBeCloseTo(2, 10);
  });

  it('still solves a real { L, U, p } decomposition', () => {
    const A = [
      [4, 3],
      [6, 3],
    ];
    const factors = lup(A) as { L: unknown; U: unknown; p: number[] };
    const direct = lusolve(A, [10, 12]) as number[][];
    const fromFactors = lusolve(factors, [10, 12]) as { valueOf(): number[][] };
    const cols = fromFactors.valueOf();
    expect(cols[0][0]).toBeCloseTo(direct[0][0], 10);
    expect(cols[1][0]).toBeCloseTo(direct[1][0], 10);
    expect(factors.p).toBeDefined();
  });

  it('rejects a packed buffer whose length does not match rows*cols', () => {
    expect(() => lusolve({ data: new Float64Array([1, 2, 3]), rows: 2, cols: 2 }, [1, 0])).toThrow(
      TypeError
    );
  });
});

/**
 * Dogfood relay G05 — lusolve packed f64 (#701).
 */

import { describe, it, expect } from 'vitest';
import { lup, lusolve } from '../src/factories/index.js';

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

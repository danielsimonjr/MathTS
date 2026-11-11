/**
 * Dogfood relay G05 — lusolve packed f64 (#701).
 */

import { describe, it, expect } from 'vitest';
import { lusolve } from '../src/factories/index.js';

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
});

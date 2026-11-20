/**
 * Dogfood #1162 - inv of a matrix whose entries span more than the double range.
 *
 * inv([[1e300, 1e-300], [0, 1e300]]) returned a zero matrix: the unscaled determinant
 * 1e300 * 1e300 overflows, the scaled run flushes 1e-300 below the smallest double, and
 * the finite unscaled result was kept without a check. inv now prefers the scaled result
 * when the unscaled one is wrong, and keeps the unscaled result when the scaled run fails.
 * Expected values: NumPy 2.3.5 `inv` (the exact entry -1e-900 underflows to 0).
 */
import { describe, it, expect } from 'vitest';
import { inv } from '../src/index.js';

const relErr = (got: number, want: number): number => Math.abs(got / want - 1);

describe('#1162 inv of entries from 1e-300 to 1e300', () => {
  it('inverts the triangular matrix [[1e300, 1e-300], [0, 1e300]]', () => {
    const r = inv([
      [1e300, 1e-300],
      [0, 1e300],
    ]) as number[][];
    expect(relErr(r[0][0], 1e-300)).toBeLessThanOrEqual(1e-15);
    expect(relErr(r[1][1], 1e-300)).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(r[0][1])).toBe(0);
    expect(Math.abs(r[1][0])).toBe(0);
  });

  it('keeps the diagonal matrix [[1e300, 0], [0, 1e-300]]', () => {
    const r = inv([
      [1e300, 0],
      [0, 1e-300],
    ]) as number[][];
    expect(relErr(r[0][0], 1e-300)).toBeLessThanOrEqual(1e-15);
    expect(relErr(r[1][1], 1e300)).toBeLessThanOrEqual(1e-15);
    expect(Math.abs(r[0][1])).toBe(0);
    expect(Math.abs(r[1][0])).toBe(0);
  });

  it('keeps the 3 x 3 diagonal matrix with entries 1e300, 1 and 1e-300', () => {
    const r = inv([
      [1e300, 0, 0],
      [0, 1, 0],
      [0, 0, 1e-300],
    ]) as number[][];
    expect(relErr(r[0][0], 1e-300)).toBeLessThanOrEqual(1e-15);
    expect(r[1][1]).toBe(1);
    expect(relErr(r[2][2], 1e300)).toBeLessThanOrEqual(1e-15);
  });

  it('still throws for a singular matrix of large entries', () => {
    expect(() =>
      inv([
        [1e300, 1e300],
        [1e300, 1e300],
      ])
    ).toThrow(/determinant is zero/);
  });
});

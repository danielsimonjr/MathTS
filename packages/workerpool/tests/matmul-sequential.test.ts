/**
 * matmulSequential: the one sequential matmul kernel. The inline branch of
 * MathWorkerPool.matmul and the synchronous `matmul` in functions both call it.
 */
import { describe, it, expect } from 'vitest';
import { MathWorkerPool, matmulSequential } from '../src/index.js';

// 2x3 times 3x4: aRows != bCols, values not symmetric.
const A = Float64Array.of(1, 2, 3, 4, 5, 6);
const B = Float64Array.of(7, -8, 9, 10, 11, 12, -13, 14, 15, 16, 17, -18);

function naive(a: Float64Array, m: number, k: number, b: Float64Array, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let p = 0; p < k; p++) s += a[i * k + p] * b[p * n + j];
      out.push(s);
    }
  return out;
}

// Worked by hand: row 0 of A = (1, 2, 3), column 0 of B = (7, 11, 15) -> 7 + 22 + 45 = 74.
const AB = [74, 64, 34, -16, 173, 124, 73, 2];

describe('matmulSequential', () => {
  it('multiplies a 2x3 by a 3x4 matrix (row-major)', () => {
    const r = matmulSequential(A, 2, 3, B, 4);
    expect(r).toBeInstanceOf(Float64Array);
    expect(Array.from(r)).toEqual(AB);
    expect(naive(A, 2, 3, B, 4)).toEqual(AB);
  });

  it('returns a fresh array and does not change the inputs', () => {
    const a = A.slice();
    const b = B.slice();
    const r = matmulSequential(a, 2, 3, b, 4);
    expect(r).not.toBe(a);
    expect(r).not.toBe(b);
    expect(Array.from(a)).toEqual(Array.from(A));
    expect(Array.from(b)).toEqual(Array.from(B));
  });

  it('keeps NaN, and a sum that starts at +0 turns -0 into 0 (Object.is)', () => {
    const r = matmulSequential(Float64Array.of(-0, NaN), 1, 2, Float64Array.of(1, 0), 1);
    expect(Object.is(r[0], NaN)).toBe(true);
    const z = matmulSequential(Float64Array.of(-0), 1, 1, Float64Array.of(1), 1);
    expect(Object.is(z[0], 0)).toBe(true);
  });

  it('gives an empty result for 0 rows', () => {
    expect(matmulSequential(new Float64Array(0), 0, 3, B, 4).length).toBe(0);
  });

  it('throws the shape errors of the inline branch', () => {
    expect(() => matmulSequential(Float64Array.of(1, 2, 3), 2, 3, B, 4)).toThrow(
      'matmul: a has 3 elements, expected 2x3'
    );
    expect(() => matmulSequential(A, 2, 3, new Float64Array(5), 4)).toThrow(
      'matmul: inner dimensions must match (b has 5 elements, expected aCols*bCols = 3*4)'
    );
  });

  it('is the kernel of the inline MathWorkerPool.matmul branch', async () => {
    const pool = new MathWorkerPool();
    const r = await pool.matmul(A, 2, 3, B, 4);
    expect(r.parallelized).toBe(false);
    expect(Array.from(r.result)).toEqual(AB);
    await pool.terminate();
  });
});

/**
 * The plain matrix helpers matmul, transpose, matvec and outer are synchronous.
 *
 * computePool.matmul stays the explicit worker path, and it gives the same values.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { computePool } from '@danielsimonjr/mathts-parallel';
import { matmul, transpose, matvec, outer } from '../src/index.js';

function same(actual: ArrayLike<number>, expected: ArrayLike<number>): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    if (!Object.is(actual[i], expected[i])) {
      throw new Error(`index ${i}: got ${actual[i]}, expected ${expected[i]}`);
    }
  }
}

// 2x3 times 3x4: aRows != bCols, values not symmetric.
const MA = Float64Array.of(1, 2, 3, 4, 5, 6);
const MB = Float64Array.of(7, -8, 9, 10, 11, 12, -13, 14, 15, 16, 17, -18);

describe('matmul, transpose, matvec, outer are synchronous', () => {
  afterAll(async () => {
    await computePool.terminate();
  });

  it('matmul multiplies a 2x3 by a 3x4 matrix', () => {
    const out = matmul(MA, 2, 3, MB, 4);
    expect(out).not.toBeInstanceOf(Promise);
    same(out, [74, 64, 34, -16, 173, 124, 73, 2]);
  });

  it('matmul throws on a shape mismatch', () => {
    expect(() => matmul(MA, 2, 3, new Float64Array(5), 4)).toThrow(/inner dimensions must match/);
    expect(() => matmul(Float64Array.of(1, 2), 2, 3, MB, 4)).toThrow(/a has 2 elements/);
  });

  it('transpose turns a 2x3 matrix into 3x2', () => {
    const out = transpose(MA, 2, 3);
    expect(out).not.toBeInstanceOf(Promise);
    same(out, [1, 4, 2, 5, 3, 6]);
    expect(() => transpose(MA, 4, 4)).toThrow('transpose: data length 6 !== rows*cols (16)');
  });

  it('matvec multiplies a 2x3 matrix by a 3-vector', () => {
    const out = matvec(MA, 2, 3, Float64Array.of(1, -1, 2));
    expect(out).not.toBeInstanceOf(Promise);
    same(out, [5, 11]);
    expect(() => matvec(MA, 2, 3, Float64Array.of(1, 2))).toThrow(
      'matvec: vector length 2 !== cols (3)'
    );
    expect(() => matvec(MA, 3, 3, Float64Array.of(1, 2, 3))).toThrow(
      'matvec: matrix length 6 !== rows*cols (9)'
    );
  });

  it('outer gives the 2x3 outer product', () => {
    const out = outer(Float64Array.of(1, -2), Float64Array.of(3, 0, -0));
    expect(out).not.toBeInstanceOf(Promise);
    same(out, [3, 0, -0, -6, -0, 0]);
  });

  it('computePool.matmul is the worker path and equals matmul above 4 096 elements', async () => {
    await computePool.initialize();
    // Fail, not skip, when the pool is not ready.
    expect(computePool.isReady()).toBe(true);
    const m = 70;
    const k = 65;
    const n = 72;
    const a = new Float64Array(m * k);
    const b = new Float64Array(k * n);
    for (let i = 0; i < a.length; i++) a[i] = Math.sin(i) * 3 - 0.25;
    for (let i = 0; i < b.length; i++) b[i] = Math.cos(i * 1.7) * 2 + 0.125;
    const seq = matmul(a, m, k, b, n);
    const par = await computePool.matmul(a, m, k, b, n, { forceParallel: true });
    expect(par.parallelized).toBe(true);
    same(par.result, seq);
  });
});

/**
 * Oracle for row-block gemm (M10 pin): sequential multiply vs hand product.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { ParallelMatrix } from '../src/ParallelMatrix.js';

function handMatmul(
  a: Float64Array,
  aRows: number,
  aCols: number,
  b: Float64Array,
  bCols: number
): Float64Array {
  const out = new Float64Array(aRows * bCols);
  for (let i = 0; i < aRows; i++) {
    for (let j = 0; j < bCols; j++) {
      let s = 0;
      for (let k = 0; k < aCols; k++) s += a[i * aCols + k] * b[k * bCols + j];
      out[i * bCols + j] = s;
    }
  }
  return out;
}

describe('ParallelMatrix multiply gemm oracle', () => {
  afterEach(async () => {
    await ParallelMatrix.terminate();
  });

  it('2×3 by 3×2 hand product (sequential path)', async () => {
    ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
    const a = new Float64Array([1, 2, 3, 4, 5, 6]);
    const b = new Float64Array([7, 8, 9, 10, 11, 12]);
    const result = await ParallelMatrix.multiply(a, 2, 3, b, 3, 2);
    expect(Array.from(result)).toEqual([58, 64, 139, 154]);
  });

  it('1×1 multiply', async () => {
    ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
    const a = new Float64Array([3]);
    const b = new Float64Array([4]);
    const result = await ParallelMatrix.multiply(a, 1, 1, b, 1, 1);
    expect(result[0]).toBe(12);
  });

  it('tall matrix parallel blocks match hand product', async () => {
    ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false, maxWorkers: 3 });
    const aRows = 9;
    const aCols = 4;
    const bCols = 2;
    const a = new Float64Array(aRows * aCols);
    const b = new Float64Array(aCols * bCols);
    for (let i = 0; i < a.length; i++) a[i] = i + 1;
    for (let i = 0; i < b.length; i++) b[i] = (i % 5) + 1;
    const result = await ParallelMatrix.multiply(a, aRows, aCols, b, aCols, bCols);
    const ref = handMatmul(a, aRows, aCols, b, bCols);
    for (let i = 0; i < ref.length; i++) expect(result[i]).toBeCloseTo(ref[i], 9);
  });

  it('zero rows yields empty result buffer', async () => {
    ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
    const a = new Float64Array(0);
    const b = new Float64Array(0);
    const result = await ParallelMatrix.multiply(a, 0, 3, b, 3, 2);
    expect(result.length).toBe(0);
  });
});

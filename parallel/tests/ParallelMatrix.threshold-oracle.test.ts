/**
 * Boundary sizes for parallel vs sequential dispatch (M9 pin).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { ParallelMatrix } from '../src/ParallelMatrix.js';

describe('ParallelMatrix parallel threshold boundaries', () => {
  afterEach(async () => {
    await ParallelMatrix.terminate();
  });

  it('size 1 uses sequential path at default threshold', async () => {
    ParallelMatrix.configure({ minSizeForParallel: 1000, useSharedMemory: false });
    const a = new Float64Array([2]);
    const b = new Float64Array([3]);
    const add = await ParallelMatrix.add(a, b, 1);
    expect(add[0]).toBe(5);
    const scaled = await ParallelMatrix.scale(a, 4, 1);
    expect(scaled[0]).toBe(8);
    expect(await ParallelMatrix.dotProduct(a, b, 1)).toBe(6);
    expect(await ParallelMatrix.sum(a, 1)).toBe(2);
  });

  it('size just below minSizeForParallel stays sequential', async () => {
    ParallelMatrix.configure({ minSizeForParallel: 1000, useSharedMemory: false });
    const n = 999;
    const a = new Float64Array(n);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      a[i] = i;
      b[i] = 1;
    }
    const result = await ParallelMatrix.add(a, b, n);
    for (let i = 0; i < n; i++) expect(result[i]).toBe(i + 1);
  });

  it('size at minSizeForParallel uses workers', async () => {
    ParallelMatrix.configure({ minSizeForParallel: 1000, useSharedMemory: false });
    const n = 1000;
    const a = new Float64Array(n);
    const b = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      a[i] = i;
      b[i] = 1;
    }
    const result = await ParallelMatrix.add(a, b, n);
    for (let i = 0; i < n; i++) expect(result[i]).toBe(i + 1);
  });
});

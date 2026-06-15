/**
 * ParallelMatrix — worker-dispatched (parallel) path coverage.
 *
 * ParallelMatrix.test.ts forces sequential mode (minSizeForParallel: Infinity)
 * and only covers the in-process fallbacks. This suite lowers the threshold so
 * the static methods fan work out to real worker_threads running the built
 * dist/matrix.worker.js, then checks every parallel result against a sequential
 * oracle. It also covers scale/elementMultiply/subtract/dotProduct/sum and the
 * getStats reporter, plus the toSharedBuffer SharedArrayBuffer branch.
 *
 * ParallelMatrix holds a single static worker pool, so configure()/terminate()
 * are sequenced carefully and the pool is torn down between config changes.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { ParallelMatrix } from '../src/ParallelMatrix.js';

// ---------------------------------------------------------------------------
// Sequential oracles
// ---------------------------------------------------------------------------

function seqMatmul(
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

function seqTranspose(data: Float64Array, rows: number, cols: number): Float64Array {
  const out = new Float64Array(rows * cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) out[j * rows + i] = data[i * cols + j];
  }
  return out;
}

function ramp(n: number, start = 1): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = start + i;
  return out;
}

describe('ParallelMatrix — worker-dispatched paths', () => {
  afterEach(async () => {
    await ParallelMatrix.terminate();
  });

  describe('multiply()', () => {
    it('parallel matmul matches the sequential oracle (non-shared memory)', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      // 8×6 · 6×5 — more rows than workers so blocks scatter.
      const aRows = 8;
      const aCols = 6;
      const bCols = 5;
      const a = ramp(aRows * aCols);
      const b = ramp(aCols * bCols);

      const result = await ParallelMatrix.multiply(a, aRows, aCols, b, aCols, bCols);
      const ref = seqMatmul(a, aRows, aCols, b, bCols);

      expect(result.length).toBe(aRows * bCols);
      for (let i = 0; i < ref.length; i++) expect(result[i]).toBeCloseTo(ref[i], 9);
    });

    it('parallel matmul with SharedArrayBuffer enabled matches the oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: true });
      const aRows = 5;
      const aCols = 4;
      const bCols = 3;
      const a = ramp(aRows * aCols);
      const b = ramp(aCols * bCols);

      const result = await ParallelMatrix.multiply(a, aRows, aCols, b, aCols, bCols);
      const ref = seqMatmul(a, aRows, aCols, b, bCols);
      for (let i = 0; i < ref.length; i++) expect(result[i]).toBeCloseTo(ref[i], 9);
    });
  });

  describe('elementwise add / subtract / elementMultiply', () => {
    it('parallel add matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const a = ramp(20, 1);
      const b = ramp(20, 100);
      const result = await ParallelMatrix.add(a, b, a.length);
      for (let i = 0; i < a.length; i++) expect(result[i]).toBeCloseTo(a[i] + b[i], 9);
    });

    it('parallel subtract matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const a = ramp(20, 100);
      const b = ramp(20, 1);
      const result = await ParallelMatrix.subtract(a, b, a.length);
      for (let i = 0; i < a.length; i++) expect(result[i]).toBeCloseTo(a[i] - b[i], 9);
    });

    it('parallel elementMultiply matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const a = ramp(20, 1);
      const b = ramp(20, 2);
      const result = await ParallelMatrix.elementMultiply(a, b, a.length);
      for (let i = 0; i < a.length; i++) expect(result[i]).toBeCloseTo(a[i] * b[i], 9);
    });

    it('returns an empty array for size 0 (elementwise short-circuit)', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const result = await ParallelMatrix.add(new Float64Array(0), new Float64Array(0), 0);
      expect(result.length).toBe(0);
    });
  });

  describe('scale()', () => {
    it('parallel scale matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const a = ramp(20, 1);
      const result = await ParallelMatrix.scale(a, 2.5, a.length);
      for (let i = 0; i < a.length; i++) expect(result[i]).toBeCloseTo(a[i] * 2.5, 9);
    });

    it('returns an empty array for size 0', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const result = await ParallelMatrix.scale(new Float64Array(0), 3, 0);
      expect(result.length).toBe(0);
    });
  });

  describe('dotProduct()', () => {
    it('parallel dot product matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const a = ramp(25, 1);
      const b = ramp(25, 1);
      let ref = 0;
      for (let i = 0; i < a.length; i++) ref += a[i] * b[i];
      const result = await ParallelMatrix.dotProduct(a, b, a.length);
      expect(result).toBeCloseTo(ref, 6);
    });

    it('returns 0 for size 0', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const result = await ParallelMatrix.dotProduct(new Float64Array(0), new Float64Array(0), 0);
      expect(result).toBe(0);
    });
  });

  describe('sum()', () => {
    it('parallel sum matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const a = ramp(30, 1);
      let ref = 0;
      for (let i = 0; i < a.length; i++) ref += a[i];
      const result = await ParallelMatrix.sum(a, a.length);
      expect(result).toBeCloseTo(ref, 6);
    });

    it('returns 0 for size 0', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      const result = await ParallelMatrix.sum(new Float64Array(0), 0);
      expect(result).toBe(0);
    });
  });

  describe('transpose()', () => {
    it('parallel transpose matches the sequential oracle', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      // 7×4 → 4×7
      const rows = 7;
      const cols = 4;
      const data = ramp(rows * cols);
      const result = await ParallelMatrix.transpose(data, rows, cols);
      const ref = seqTranspose(data, rows, cols);
      expect(result.length).toBe(rows * cols);
      for (let i = 0; i < ref.length; i++) expect(result[i]).toBeCloseTo(ref[i], 9);
    });
  });

  describe('sequential fallbacks (below threshold)', () => {
    // minSizeForParallel: Infinity forces the in-process loops, exercising the
    // sequential bodies (and the elementwise op callbacks) of every method.
    it('subtract computes element-wise difference sequentially', async () => {
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
      const a = new Float64Array([10, 20, 30]);
      const b = new Float64Array([1, 2, 3]);
      const result = await ParallelMatrix.subtract(a, b, 3);
      expect(Array.from(result)).toEqual([9, 18, 27]);
    });

    it('elementMultiply computes Hadamard product sequentially', async () => {
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
      const a = new Float64Array([2, 3, 4]);
      const b = new Float64Array([5, 6, 7]);
      const result = await ParallelMatrix.elementMultiply(a, b, 3);
      expect(Array.from(result)).toEqual([10, 18, 28]);
    });

    it('scale multiplies by a scalar sequentially', async () => {
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
      const a = new Float64Array([1, 2, 3, 4]);
      const result = await ParallelMatrix.scale(a, 3, 4);
      expect(Array.from(result)).toEqual([3, 6, 9, 12]);
    });

    it('dotProduct sums products sequentially', async () => {
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
      const a = new Float64Array([1, 2, 3]);
      const b = new Float64Array([4, 5, 6]);
      const result = await ParallelMatrix.dotProduct(a, b, 3);
      expect(result).toBeCloseTo(32);
    });

    it('sum adds elements sequentially', async () => {
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
      const a = new Float64Array([1, 2, 3, 4, 5]);
      const result = await ParallelMatrix.sum(a, 5);
      expect(result).toBeCloseTo(15);
    });
  });

  describe('block-count edge cases (empty trailing block guard)', () => {
    // maxWorkers=4 with size=5 makes ceil(5/4)=2 rows/block → blocks
    // consume 2,2,1,0; the 4th block start index >= size, exercising the
    // `if (start >= size) break` / `if (startRow >= rows) break` guards.
    it('elementwise add tolerates a trailing empty block', async () => {
      ParallelMatrix.configure({
        minSizeForParallel: 1,
        useSharedMemory: false,
        maxWorkers: 4,
      });
      const a = ramp(5, 1);
      const b = ramp(5, 10);
      const result = await ParallelMatrix.add(a, b, 5);
      for (let i = 0; i < 5; i++) expect(result[i]).toBeCloseTo(a[i] + b[i], 9);
    });

    it('scale tolerates a trailing empty block', async () => {
      ParallelMatrix.configure({
        minSizeForParallel: 1,
        useSharedMemory: false,
        maxWorkers: 4,
      });
      const a = ramp(5, 1);
      const result = await ParallelMatrix.scale(a, 2, 5);
      for (let i = 0; i < 5; i++) expect(result[i]).toBeCloseTo(a[i] * 2, 9);
    });

    it('dotProduct tolerates a trailing empty block', async () => {
      ParallelMatrix.configure({
        minSizeForParallel: 1,
        useSharedMemory: false,
        maxWorkers: 4,
      });
      const a = ramp(5, 1);
      const b = ramp(5, 1);
      let ref = 0;
      for (let i = 0; i < 5; i++) ref += a[i] * b[i];
      expect(await ParallelMatrix.dotProduct(a, b, 5)).toBeCloseTo(ref, 6);
    });

    it('sum tolerates a trailing empty block', async () => {
      ParallelMatrix.configure({
        minSizeForParallel: 1,
        useSharedMemory: false,
        maxWorkers: 4,
      });
      const a = ramp(5, 1);
      let ref = 0;
      for (let i = 0; i < 5; i++) ref += a[i];
      expect(await ParallelMatrix.sum(a, 5)).toBeCloseTo(ref, 6);
    });

    it('multiply tolerates a trailing empty row block', async () => {
      ParallelMatrix.configure({
        minSizeForParallel: 1,
        useSharedMemory: false,
        maxWorkers: 4,
      });
      // 5 rows of A → ceil(5/4)=2 → 4th block empty.
      const a = ramp(5 * 3);
      const b = ramp(3 * 2);
      const result = await ParallelMatrix.multiply(a, 5, 3, b, 3, 2);
      const ref = seqMatmul(a, 5, 3, b, 2);
      for (let i = 0; i < ref.length; i++) expect(result[i]).toBeCloseTo(ref[i], 9);
    });

    it('transpose tolerates a trailing empty row block', async () => {
      ParallelMatrix.configure({
        minSizeForParallel: 1,
        useSharedMemory: false,
        maxWorkers: 4,
      });
      const data = ramp(5 * 3);
      const result = await ParallelMatrix.transpose(data, 5, 3);
      const ref = seqTranspose(data, 5, 3);
      for (let i = 0; i < ref.length; i++) expect(result[i]).toBeCloseTo(ref[i], 9);
    });
  });

  describe('configure() with a live pool', () => {
    it('tears down an existing worker pool when reconfigured', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      // Create the pool by running a parallel op.
      await ParallelMatrix.add(ramp(10), ramp(10), 10);
      expect(ParallelMatrix.getStats()).not.toBeNull();
      // Reconfiguring with a live pool must terminate + null it.
      ParallelMatrix.configure({ minSizeForParallel: 2, useSharedMemory: false });
      expect(ParallelMatrix.getStats()).toBeNull();
    });
  });

  describe('getStats()', () => {
    it('returns null before the pool is created', async () => {
      // Fresh state: configure tears down any existing pool.
      ParallelMatrix.configure({ minSizeForParallel: Infinity, useSharedMemory: false });
      await ParallelMatrix.terminate();
      expect(ParallelMatrix.getStats()).toBeNull();
    });

    it('reports worker/task counts once the pool exists', async () => {
      ParallelMatrix.configure({ minSizeForParallel: 1, useSharedMemory: false });
      // Trigger pool creation via a parallel op.
      await ParallelMatrix.add(ramp(10), ramp(10), 10);
      const stats = ParallelMatrix.getStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalWorkers).toBeGreaterThan(0);
      expect(stats!.idleWorkers + stats!.busyWorkers).toBe(stats!.totalWorkers);
      expect(stats!.pendingTasks).toBeGreaterThanOrEqual(0);
      expect(stats!.activeTasks).toBeGreaterThanOrEqual(0);
    });
  });
});

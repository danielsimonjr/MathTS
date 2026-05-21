/**
 * Regression tests for real parallel kernel dispatch.
 *
 * The rest of the suite deliberately keeps data below the parallel threshold,
 * so it only exercises the sequential fallback. These tests force the parallel
 * path to guard two foundational bugs:
 *   1. The pool was created without a worker script, so named-method dispatch
 *      ('sumChunk', ...) threw `Unknown method`.
 *   2. Float64Array chunks were produced with subarray() (a view over the full
 *      buffer), so every chunk past the first read the wrong data region.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MathWorkerPool } from '../src/index.js';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));

describe('parallel kernel dispatch (real workers)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    // Worker threads load the built dist/worker.js; build it if it is missing.
    if (!existsSync(workerScript)) {
      execSync('npx tsup src/worker.ts --format esm', { cwd: pkgRoot, stdio: 'ignore' });
    }
    pool = new MathWorkerPool({ maxWorkers: 3, parallelThreshold: 10, chunkSize: 7 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool?.terminate();
  });

  it('dispatches sumChunk to a real worker', async () => {
    const data = Float64Array.from({ length: 100 }, (_, i) => i + 1);
    const r = await pool.sum(data, { forceParallel: true });
    expect(r.parallelized).toBe(true);
    expect(r.result).toBe(5050);
  });

  it('chunks non-uniform Float64Array data correctly', async () => {
    const data = Float64Array.from({ length: 100 }, (_, i) => i + 1);
    const v = await pool.variance(data, { forceParallel: true });
    expect(v.parallelized).toBe(true);
    expect(v.result.mean).toBeCloseTo(50.5, 9);
    expect(v.result.variance).toBeCloseTo((100 * 100 - 1) / 12, 6);

    const mm = await pool.minMax(data, { forceParallel: true });
    expect(mm.result.min).toBe(1);
    expect(mm.result.max).toBe(100);
    expect(mm.result.minIdx).toBe(0);
    expect(mm.result.maxIdx).toBe(99);
  });

  it('runs elementwise and unary kernels with correct results', async () => {
    const a = Float64Array.from({ length: 100 }, (_, i) => i);
    const b = Float64Array.from({ length: 100 }, (_, i) => i * 2);

    const sum = await pool.elementwise(a, b, 'add', { forceParallel: true });
    expect(sum.parallelized).toBe(true);
    expect(Array.from(sum.result.slice(0, 4))).toEqual([0, 3, 6, 9]);
    expect(sum.result[99]).toBe(297);

    const sq = await pool.unary(a, 'square', { forceParallel: true });
    expect(sq.result[10]).toBe(100);
    expect(sq.result[99]).toBe(99 * 99);
  });

  it('runs matmul across worker row-blocks', async () => {
    const A = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const B = new Float64Array([1, 0, 0, 1, 1, 1]);
    const r = await pool.matmul(A, 4, 3, B, 2, { forceParallel: true });
    expect(r.parallelized).toBe(true);
    expect(Array.from(r.result)).toEqual([4, 5, 10, 11, 16, 17, 22, 23]);
  });
});

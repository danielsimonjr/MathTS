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
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { pairwiseSum, pairwiseDot, norm2, scaledDistance } from '@danielsimonjr/mathts-core';
import { MathWorkerPool } from '../src/index.js';

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const tsdownCli = createRequire(import.meta.url).resolve('tsdown/run');
const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));

describe('parallel kernel dispatch (real workers)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    // Worker threads load the built dist/worker.js; build it if it is missing.
    if (!existsSync(workerScript)) {
      // The package's own tsdown, not `npx`: npm refuses to run in this workspace (EOVERRIDE).
      // `--no-clean` keeps the rest of dist/ (the tsc declarations, index.js).
      execFileSync(
        process.execPath,
        [tsdownCli, 'src/worker.ts', '--format', 'esm', '--no-clean'],
        { cwd: pkgRoot, stdio: 'ignore' }
      );
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

  it('dispatches prodChunk to a real worker', async () => {
    // Use values near 1 to avoid overflow; sequential reference for comparison.
    const data = Float64Array.from({ length: 100 }, (_, i) => 1 + ((i % 5) - 2) * 0.001);
    const expected = data.reduce((acc, v) => acc * v, 1);
    const r = await pool.prod(data, { forceParallel: true });
    expect(r.parallelized).toBe(true);
    const relErr = Math.abs(r.result - expected) / Math.abs(expected);
    expect(relErr).toBeLessThan(1e-10);
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

  it('applies a caller-supplied kernel in parallel', async () => {
    const data = Float64Array.from({ length: 100 }, (_, i) => i);

    const cubed = await pool.applyKernel(data, '(x) => x * x * x', {
      forceParallel: true,
    });
    expect(cubed.parallelized).toBe(true);
    expect(cubed.result[4]).toBe(64);
    expect(cubed.result[99]).toBe(99 * 99 * 99);

    // Self-contained source with a nested helper (IIFE pattern).
    const withHelper = await pool.applyKernel(
      data,
      '(() => { function dbl(v) { return v * 2; } return (x) => dbl(x) + 1; })()',
      { forceParallel: true }
    );
    expect(withHelper.result[10]).toBe(21);
  });

  it('applies a caller-supplied binary kernel in parallel', async () => {
    const a = Float64Array.from({ length: 100 }, (_, i) => i);
    const b = Float64Array.from({ length: 100 }, (_, i) => i + 1);

    const hyp = await pool.applyKernel2(a, b, '(a, b) => Math.sqrt(a * a + b * b)', {
      forceParallel: true,
    });
    expect(hyp.parallelized).toBe(true);
    expect(hyp.result[3]).toBeCloseTo(Math.sqrt(9 + 16), 12);
    expect(hyp.result[99]).toBeCloseTo(Math.sqrt(99 * 99 + 100 * 100), 12);
  });
});

describe('stable kernels, transfers and view normalization (real workers)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    pool = new MathWorkerPool({ maxWorkers: 3, parallelThreshold: 10, chunkSize: 64 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool?.terminate();
  });

  it('parallel norm of a 1e200-scaled vector is finite and matches the sequential norm', async () => {
    const data = Float64Array.from({ length: 1000 }, (_, i) => (1 + (i % 9)) * 1e200);
    const par = await pool.norm(data, { forceParallel: true });
    const seq = await pool.norm(data, { forceSequential: true });
    expect(par.parallelized).toBe(true);
    expect(Number.isFinite(par.result)).toBe(true);
    expect(Math.abs(par.result - seq.result) / seq.result).toBeLessThan(1e-14);
    expect(Math.abs(par.result - norm2(data)) / seq.result).toBeLessThan(1e-14);
  });

  it('parallel distance of 1e-200-scaled vectors does not flush to zero', async () => {
    const a = Float64Array.from({ length: 500 }, (_, i) => (i + 1) * 1e-200);
    const b = new Float64Array(500);
    const par = await pool.distance(a, b, { forceParallel: true });
    expect(par.result).toBeGreaterThan(0);
    expect(Math.abs(par.result - scaledDistance(a, b)) / par.result).toBeLessThan(1e-14);
  });

  it('parallel sum and dot match the pairwise kernels on ill-conditioned data', async () => {
    const x = Float64Array.from({ length: 5000 }, (_, i) => 1e6 + (i % 13) * 1e-3);
    const y = Float64Array.from({ length: 5000 }, (_, i) => 1 + (i % 7) * 1e-9);
    const sum = await pool.sum(x, { forceParallel: true });
    const dot = await pool.dot(x, y, { forceParallel: true });
    expect(Math.abs(sum.result - pairwiseSum(x)) / sum.result).toBeLessThan(1e-15);
    expect(Math.abs(dot.result - pairwiseDot(x, y)) / dot.result).toBeLessThan(1e-15);
  });

  it('operands are not detached by the transfer of their slices', async () => {
    const a = Float64Array.from({ length: 300 }, (_, i) => i);
    const b = Float64Array.from({ length: 300 }, (_, i) => 2 * i);
    const r = await pool.elementwise(a, b, 'add', { forceParallel: true });
    expect(r.parallelized).toBe(true);
    expect(a.length).toBe(300);
    expect(b.length).toBe(300);
    expect(r.result[299]).toBe(897);
  });

  it('matmul, transpose, matvec and outer read a subarray view with a byteOffset correctly', async () => {
    const padded = (len: number, f: (i: number) => number) => {
      const buf = new Float64Array(len + 16);
      for (let i = 0; i < len; i++) buf[8 + i] = f(i);
      return buf.subarray(8, 8 + len); // byteOffset 64, buffer longer than the view
    };
    const rows = 12;
    const cols = 9;
    const A = padded(rows * cols, (i) => (i % 11) - 4);
    const B = padded(cols * 5, (i) => (i % 7) - 3);
    const v = padded(cols, (i) => i + 1);
    const u = padded(rows, (i) => i - 5);
    expect(A.byteOffset).toBe(64);

    const exactOf = (x: Float64Array) => Float64Array.from(x);
    const force = { forceParallel: true };

    const mm = await pool.matmul(A, rows, cols, B, 5, force);
    const mmRef = await pool.matmul(exactOf(A), rows, cols, exactOf(B), 5, {
      forceSequential: true,
    });
    expect(mm.parallelized).toBe(true);
    expect(Array.from(mm.result)).toEqual(Array.from(mmRef.result));

    const tr = await pool.transpose(A, rows, cols, force);
    expect(tr.parallelized).toBe(true);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) expect(tr.result[j * rows + i]).toBe(A[i * cols + j]);
    }

    const mv = await pool.matvec(A, rows, cols, v, force);
    const mvRef = await pool.matvec(exactOf(A), rows, cols, exactOf(v), { forceSequential: true });
    expect(Array.from(mv.result)).toEqual(Array.from(mvRef.result));

    const ou = await pool.outer(u, v, force);
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) expect(ou.result[i * cols + j]).toBe(u[i] * v[j]);
    }
  });

  it('matmul rejects mismatched buffer sizes at every size', async () => {
    const small = new Float64Array(6);
    await expect(pool.matmul(small, 2, 3, new Float64Array(5), 2)).rejects.toThrow(
      /inner dimensions must match/
    );
    await expect(pool.matmul(new Float64Array(5), 2, 3, new Float64Array(6), 2)).rejects.toThrow(
      /a has 5 elements/
    );
    const big = new Float64Array(400);
    await expect(
      pool.matmul(big, 20, 20, new Float64Array(399), 20, { forceParallel: true })
    ).rejects.toThrow(/inner dimensions must match/);
  });

  it('histogram validates bins, ignores non-finite samples and handles a constant range', async () => {
    const data = Float64Array.from({ length: 200 }, () => 3);
    await expect(pool.histogram(data, 0)).rejects.toThrow(/bins must be a positive integer/);
    await expect(pool.histogram(data, 2.5)).rejects.toThrow(/bins must be a positive integer/);
    for (const options of [{ forceParallel: true }, { forceSequential: true }]) {
      const flat = await pool.histogram(data, 4, undefined, undefined, options);
      expect(flat.result).toEqual([200, 0, 0, 0]);
      const dirty = Float64Array.from([
        1,
        2,
        NaN,
        Infinity,
        -Infinity,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
      ]);
      const h = await pool.histogram(dirty, 2, undefined, undefined, options);
      // 11 finite samples (1..11); NaN and +-Infinity are dropped.
      expect(h.result.reduce((x: number, y: number) => x + y, 0)).toBe(11);
    }
  });
});

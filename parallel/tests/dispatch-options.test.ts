import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';
import {
  parallelAdd,
  parallelScale,
  parallelSqrt,
  parallelMap,
  parallelFilter,
  parallelSum,
  parallelMean,
  parallelNorm,
  parallelMinMax,
  parallelVariance,
  parallelHistogram,
  parallelMatmul,
  parallelTranspose,
  parallelMatvec,
  parallelOuter,
  parallelDot,
  parallelDistance,
} from '../src/operations/index.js';

/**
 * `forceParallel` / `forceSequential` used to be accepted by every free function in
 * `operations/` and ignored. They now reach `ComputePool`, which picks the branch.
 * `parallelized` on the result says which branch ran, and each case checks the numbers.
 */
describe('operations: forceParallel / forceSequential are honored', () => {
  let pool: ComputePool;
  // A pool whose thresholds would parallelize everything big and nothing tiny.
  let eager: ComputePool;

  beforeAll(async () => {
    pool = new ComputePool({ maxWorkers: 2, chunkSize: 16 });
    await pool.initialize();
    eager = new ComputePool({
      maxWorkers: 2,
      chunkSize: 100,
      thresholdElements: 10,
      thresholdByOp: {
        add: 'always',
        scale: 'always',
        sum: 'always',
        norm: 'always',
        matmul: 'always',
        transpose: 'always',
      },
    });
    await eager.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool.terminate();
    await eager.terminate();
  });

  const ramp = (n: number, f: (i: number) => number = (i) => i) =>
    Float64Array.from({ length: n }, (_, i) => f(i));

  describe('element-wise', () => {
    it('forceSequential on a huge input computes inline and correctly', async () => {
      const a = ramp(200_000);
      const b = ramp(200_000, (i) => 2 * i);
      const normal = await parallelAdd(a, b, { pool: eager });
      expect(normal.parallelized).toBe(true); // the threshold alone would parallelize it
      const forced = await parallelAdd(a, b, { pool: eager, forceSequential: true });
      expect(forced.parallelized).toBe(false);
      expect(forced.chunks).toBe(1);
      expect(forced.result[199_999]).toBe(3 * 199_999);
      expect(Array.from(forced.result.subarray(0, 50))).toEqual(
        Array.from(normal.result.subarray(0, 50))
      );
    });

    it('forceParallel on a tiny input goes to the workers and is correct', async () => {
      const a = Float64Array.of(1, 2, 3);
      const b = Float64Array.of(10, 20, 30);
      const normal = await parallelAdd(a, b, { pool });
      expect(normal.parallelized).toBe(false); // add is 'never' by default
      const forced = await parallelAdd(a, b, { pool, forceParallel: true });
      expect(forced.parallelized).toBe(true);
      expect(Array.from(forced.result)).toEqual([11, 22, 33]);
    });

    it('forwards through scale and the unary functions', async () => {
      const x = ramp(8, (i) => i * i);
      const s = await parallelScale(x, 3, { pool, forceParallel: true });
      expect(s.parallelized).toBe(true);
      expect(Array.from(s.result)).toEqual(Array.from(x, (v) => 3 * v));
      const r = await parallelSqrt(x, { pool, forceParallel: true });
      expect(r.parallelized).toBe(true);
      expect(Array.from(r.result)).toEqual(Array.from(x, Math.sqrt));
    });

    it('forceSequential wins when both flags are set', async () => {
      const r = await parallelAdd(ramp(50), ramp(50), {
        pool,
        forceParallel: true,
        forceSequential: true,
      });
      expect(r.parallelized).toBe(false);
    });
  });

  describe('reductions', () => {
    it('sum / mean / norm / variance / minMax obey the flags in both directions', async () => {
      const x = ramp(40, (i) => i + 1);
      const sum = await parallelSum(x, { pool, forceParallel: true });
      expect(sum.parallelized).toBe(true);
      expect(sum.result).toBe(820);
      expect((await parallelSum(x, { pool: eager, forceSequential: true })).parallelized).toBe(
        false
      );

      const mean = await parallelMean(x, { pool, forceParallel: true });
      expect(mean.parallelized).toBe(true);
      expect(mean.result).toBeCloseTo(20.5, 12);

      const norm = await parallelNorm(x, { pool, forceParallel: true });
      expect(norm.parallelized).toBe(true);
      expect(norm.result).toBeCloseTo(Math.sqrt((40 * 41 * 81) / 6), 10);
      expect((await parallelNorm(x, { pool: eager, forceSequential: true })).parallelized).toBe(
        false
      );

      const v = await parallelVariance(x, { pool, forceParallel: true });
      expect(v.parallelized).toBe(true);
      expect(v.result.variance).toBeCloseTo((40 * 40 - 1) / 12, 10);

      const mm = await parallelMinMax(x, { pool, forceParallel: true });
      expect(mm.parallelized).toBe(true);
      expect(mm.result).toMatchObject({ min: 1, max: 40, minIdx: 0, maxIdx: 39 });
    });

    it('dot, distance and histogram forward the flags', async () => {
      const a = ramp(30, (i) => i);
      const b = ramp(30, () => 1);
      const dot = await parallelDot(a, b, { pool, forceParallel: true });
      expect(dot.parallelized).toBe(true);
      expect(dot.result).toBe(435);
      const dist = await parallelDistance(a, b, { pool, forceParallel: true });
      expect(dist.parallelized).toBe(true);
      expect(dist.result).toBeCloseTo(Math.sqrt(a.reduce((s, v) => s + (v - 1) ** 2, 0)), 10);
      const hist = await parallelHistogram(a, 3, undefined, undefined, {
        pool,
        forceParallel: true,
      });
      expect(hist.parallelized).toBe(true);
      expect(hist.result).toEqual([10, 10, 10]);
    });
  });

  describe('linear algebra', () => {
    const rows = 6;
    const cols = 4;
    const A = ramp(rows * cols, (i) => (i % 5) - 2);
    const B = ramp(cols * 3, (i) => (i % 3) + 1);

    it('matmul: forceParallel on a tiny product, forceSequential on a big one', async () => {
      const seq = await parallelMatmul(A, rows, cols, B, 3, { pool, forceSequential: true });
      expect(seq.parallelized).toBe(false);
      const par = await parallelMatmul(A, rows, cols, B, 3, { pool, forceParallel: true });
      expect(par.parallelized).toBe(true);
      expect(Array.from(par.result)).toEqual(Array.from(seq.result));

      const n = 80;
      const big = ramp(n * n, (i) => (i % 7) - 3);
      const normal = await parallelMatmul(big, n, n, big, n, { pool: eager });
      expect(normal.parallelized).toBe(true);
      const forced = await parallelMatmul(big, n, n, big, n, {
        pool: eager,
        forceSequential: true,
      });
      expect(forced.parallelized).toBe(false);
      expect(forced.result[0]).toBe(normal.result[0]);
      expect(forced.result[n * n - 1]).toBe(normal.result[n * n - 1]);
    });

    it('transpose, matvec and outer forward the flags', async () => {
      const t = await parallelTranspose(A, rows, cols, { pool, forceParallel: true });
      expect(t.parallelized).toBe(true);
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) expect(t.result[j * rows + i]).toBe(A[i * cols + j]);
      }
      const v = ramp(cols, (i) => i + 1);
      const mv = await parallelMatvec(A, rows, cols, v, { pool, forceParallel: true });
      expect(mv.parallelized).toBe(true);
      const ref = await parallelMatvec(A, rows, cols, v, { pool, forceSequential: true });
      expect(ref.parallelized).toBe(false);
      expect(Array.from(mv.result)).toEqual(Array.from(ref.result));
      const o = await parallelOuter(v, v, { pool, forceParallel: true });
      expect(o.parallelized).toBe(true);
      expect(o.result[3 * cols + 2]).toBe(4 * 3);
    });
  });

  describe('array operations', () => {
    it('map and filter: forceParallel on 6 items, forceSequential above the threshold', async () => {
      const items = [1, 2, 3, 4, 5, 6];
      const par = await parallelMap(items, (x: number) => x * 2, { pool, forceParallel: true });
      expect(par.parallelized).toBe(true);
      expect(par.result).toEqual([2, 4, 6, 8, 10, 12]);

      const many = Array.from({ length: 100 }, (_, i) => i);
      const normal = await parallelFilter(many, (x: number) => x % 2 === 0, { pool: eager });
      expect(normal.parallelized).toBe(true);
      const seq = await parallelFilter(many, (x: number) => x % 2 === 0, {
        pool: eager,
        forceSequential: true,
      });
      expect(seq.parallelized).toBe(false);
      expect(seq.result).toEqual(normal.result);
    });
  });

  it('forceParallel on a pool that was never initialized lazy-inits workers', async () => {
    const idle = new ComputePool({ maxWorkers: 2 });
    expect(idle.isReady()).toBe(false);
    const r = await parallelAdd(Float64Array.of(1, 2), Float64Array.of(3, 4), {
      pool: idle,
      forceParallel: true,
    });
    expect(r.parallelized).toBe(true);
    expect(Array.from(r.result)).toEqual([4, 6]);
    expect(idle.isReady()).toBe(true);
    const s = await idle.sum(Float64Array.of(1, 2, 3), { forceParallel: true });
    expect(s.parallelized).toBe(true);
    expect(s.result).toBe(6);
    await idle.terminate();
  });
});

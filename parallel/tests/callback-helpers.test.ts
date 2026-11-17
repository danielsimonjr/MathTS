import { describe, it, expect, afterAll } from 'vitest';
import { ComputePool } from '../src/ComputePool.js';
import {
  parallelMap,
  parallelFilter,
  parallelFind,
  parallelSort,
  parallelForEach,
  parallelSome,
  parallelEvery,
  parallelCount,
  parallelReduce,
} from '../src/operations/index.js';

// #1027: every callback helper must send self-contained function source to the worker.
describe('parallel callback helpers on the worker path (#1027)', () => {
  const pool = new ComputePool({ maxWorkers: 2, minWorkers: 1 });
  const data = Array.from({ length: 4096 }, (_, i) => i);
  const opts = { pool, forceParallel: true };

  afterAll(async () => {
    await pool.terminate(true);
  });

  it('parallelMap', async () => {
    const r = await parallelMap(data, (x) => x * 2, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result[10]).toBe(20);
  });

  it('parallelFilter', async () => {
    const r = await parallelFilter(data, (x) => x % 2 === 0, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result.length).toBe(2048);
  });

  it('parallelFind', async () => {
    const r = await parallelFind(data, (x) => x > 4000, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result.found).toBe(true);
  });

  it('parallelSort', async () => {
    const r = await parallelSort([...data].reverse(), (a, b) => a - b, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result[0]).toBe(0);
    expect(r.result[4095]).toBe(4095);
  });

  it('parallelReduce', async () => {
    const r = await parallelReduce(data, (a: number, x: number) => a + x, 0, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result).toBe(4095 * 2048);
  });

  it('parallelSome', async () => {
    const r = await parallelSome(data, (x) => x === 4000, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result).toBe(true);
  });

  it('parallelCount', async () => {
    const r = await parallelCount(data, (x) => x < 100, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result).toBe(100);
  });

  it('parallelEvery returns true when all pass, false when one fails', async () => {
    const yes = await parallelEvery(data, (x) => x >= 0, opts);
    expect(yes.parallelized).toBe(true);
    expect(yes.result).toBe(true);
    const no = await parallelEvery(data, (x) => x < 4000, opts);
    expect(no.result).toBe(false);
  });

  it('parallelForEach runs on the worker path and returns one slot per item', async () => {
    const r = await parallelForEach(data, () => {}, opts);
    expect(r.parallelized).toBe(true);
    expect(r.result.length).toBe(data.length);
  });

  it('parallelEvery and parallelForEach keep the sequential path correct', async () => {
    const seq = { pool, forceSequential: true };
    expect((await parallelEvery(data, (x) => x >= 0, seq)).result).toBe(true);
    expect((await parallelEvery(data, (x) => x < 5, seq)).result).toBe(false);
    expect((await parallelForEach([1, 2], () => {}, seq)).result.length).toBe(2);
  });
});

// #1016
describe('ComputePool.workerCount after terminate (#1016)', () => {
  it('agrees with stats().totalWorkers once terminated, and recovers on initialize()', async () => {
    const pool = new ComputePool({ maxWorkers: 3, minWorkers: 1 });
    expect(pool.workerCount).toBe(3); // configured capacity before any start
    await pool.initialize();
    await pool.terminate(true);
    expect(pool.stats().totalWorkers).toBe(0);
    expect(pool.workerCount).toBe(0);
    expect(pool.isReady()).toBe(false);
    await pool.initialize();
    expect(pool.workerCount).toBe(3);
    await pool.terminate(true);
  });
});

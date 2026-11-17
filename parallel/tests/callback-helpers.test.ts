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
    expect(r.result.every((v) => v === undefined)).toBe(true);
  });

  it('parallelEvery and parallelForEach keep the sequential path correct', async () => {
    const seq = { pool, forceSequential: true };
    expect((await parallelEvery(data, (x) => x >= 0, seq)).result).toBe(true);
    expect((await parallelEvery(data, (x) => x < 5, seq)).result).toBe(false);
    expect((await parallelForEach([1, 2], () => {}, seq)).result.length).toBe(2);
  });

  it('parallelEvery keeps a closure on the sequential path', async () => {
    // A mutable binding: Bun inlines a `const` number into the callback source, and the
    // callback then captures nothing.
    let limit = 0;
    limit += 10;
    const r = await parallelEvery([1, 2, 3], (x) => x < limit, { pool, forceSequential: true });
    expect(r.result).toBe(true);
    const below = await parallelEvery([1, 2, 30], (x) => x < limit, { pool });
    expect(below.parallelized).toBe(false);
    expect(below.result).toBe(false);
  });

  it('parallelEvery stops at the first failing item on the sequential path', async () => {
    let calls = 0;
    const r = await parallelEvery(
      data,
      (x) => {
        calls++;
        return x < 3;
      },
      { pool, forceSequential: true }
    );
    expect(r.result).toBe(false);
    expect(calls).toBe(4);
  });

  it('rejects a closure on the worker path, as parallelMap does', async () => {
    let limit = 0;
    limit += 5000;
    const usesOuter = (x: number) => x < limit;
    await expect(parallelMap(data, usesOuter, opts)).rejects.toThrow('limit is not defined');
    await expect(parallelEvery(data, usesOuter, opts)).rejects.toThrow('limit is not defined');
    await expect(
      parallelForEach(
        data,
        (x) => {
          void (x < limit);
        },
        opts
      )
    ).rejects.toThrow('limit is not defined');
  });

  it('parallelEvery gives the worker a named function and a parameter named item', async () => {
    const named = await parallelEvery(
      data,
      function atLeastZero(x) {
        return x >= 0;
      },
      opts
    );
    expect(named.result).toBe(true);
    expect((await parallelEvery(data, (item) => item !== 3000, opts)).result).toBe(false);
  });

  it('leaves the toString of the user callback unchanged', async () => {
    const predicate = (x: number) => x >= 0;
    const each = (_x: number) => {};
    await parallelEvery(data, predicate, opts);
    await parallelForEach(data, each, opts);
    expect(Object.hasOwn(predicate, 'toString')).toBe(false);
    expect(Object.hasOwn(each, 'toString')).toBe(false);
  });

  it('parallelForEach keeps a closure on the sequential path', async () => {
    let seen = 0;
    const r = await parallelForEach(
      [1, 2, 3],
      (x) => {
        seen += x;
      },
      { pool, forceSequential: true }
    );
    expect(seen).toBe(6);
    expect(r.result).toEqual([undefined, undefined, undefined]);
  });

  it('runs the issue inputs with no force option', async () => {
    const big = Array.from({ length: 200000 }, (_, i) => i);
    const every = await parallelEvery(big, (x) => x >= 0, { pool });
    expect(every.result).toBe(true);
    expect(every.parallelized).toBe(true);
    const each = await parallelForEach(big, () => {}, { pool });
    expect(each.result.length).toBe(200000);
  });

  it('accepts method, bound and native callables on the sequential path only', async () => {
    const o = {
      p(x: number) {
        return x >= 0;
      },
    };
    const callables: Array<(x: number) => boolean> = [
      o.p,
      ((x: number) => x >= 0).bind(null),
      Number.isFinite,
    ];
    for (const fn of callables) {
      expect((await parallelEvery([1, 2, 3], fn, { pool, forceSequential: true })).result).toBe(
        true
      );
      await expect(parallelEvery(data, fn, opts)).rejects.toThrow();
      await expect(parallelMap(data, fn, opts)).rejects.toThrow();
    }
  });

  it("keeps '$&' in the callback source on the worker path", async () => {
    const r = await parallelEvery(data, (x) => '$&'.length === 2 && x >= 0, opts);
    expect(r.result).toBe(true);
  });
});

// #1016
describe('ComputePool.workerCount after terminate (#1016)', () => {
  it('agrees with stats().totalWorkers once terminated, and recovers on initialize()', async () => {
    const pool = new ComputePool({ maxWorkers: 3, minWorkers: 1 });
    try {
      expect(pool.workerCount).toBe(3); // configured capacity before any start
      await pool.initialize();
      await pool.terminate(true);
      expect(pool.stats().totalWorkers).toBe(0);
      expect(pool.workerCount).toBe(0);
      expect(pool.isReady()).toBe(false);
      await expect(pool.map([1], (x) => x)).rejects.toThrow('ComputePool has been terminated');
      await pool.initialize();
      expect(pool.workerCount).toBe(3);
    } finally {
      await pool.terminate(true);
    }
  });

  it('liveWorkerCount is 0 fresh, at least 1 after initialize(), 0 after terminate()', async () => {
    const pool = new ComputePool({ maxWorkers: 2, minWorkers: 1 });
    try {
      expect(pool.liveWorkerCount).toBe(0);
      await pool.initialize();
      expect(pool.liveWorkerCount).toBeGreaterThanOrEqual(1);
      await pool.terminate(true);
      expect(pool.liveWorkerCount).toBe(0);
    } finally {
      await pool.terminate(true);
    }
  });
});

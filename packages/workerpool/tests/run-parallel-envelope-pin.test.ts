import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { MathWorkerPool, type ParallelResult } from '../src/index.js';

/**
 * P6-7 pins for the shared parallel envelope: `sum`/`prod`/`norm` (via `reduceScalar`), and
 * `map`/`filter` (via `runArrayChunks`), `sort` and `reduce`, all of which go through `runParallel`.
 *
 * The envelope is: below the threshold run `sequential()` and report `chunks: 1`,
 * `parallelized: false`, `workersUsed: 0`; otherwise chunk, read `stats()` once, send every chunk in
 * order, combine, and report `chunks: chunks.length`, `parallelized: true`,
 * `workersUsed: min(chunks, stats.totalWorkers)`. Each test records the call order of the private
 * chunk helpers, `stats` and `exec`, so a merge cannot reorder, drop or duplicate a step.
 */

const pkgRoot = fileURLToPath(new URL('..', import.meta.url));
const tsdownCli = createRequire(import.meta.url).resolve('tsdown/run');
const workerScript = fileURLToPath(new URL('../dist/worker.js', import.meta.url));

type Event =
  | { kind: 'chunkArray' }
  | { kind: 'chunkFloat64Array' }
  | { kind: 'stats' }
  | { kind: 'exec'; method: string; params: unknown[]; extra: number };

/** One deliberate choke point for private method access: TS `private` is compile-time only. */
type Instrumentable = {
  chunkArray: (...args: unknown[]) => unknown;
  chunkFloat64Array: (...args: unknown[]) => unknown;
  stats: (...args: unknown[]) => unknown;
  exec: (method: string, params: unknown[], ...rest: unknown[]) => Promise<unknown>;
};

function instrument(pool: MathWorkerPool, totalWorkers?: number) {
  const events: Event[] = [];
  const surface = pool as unknown as Instrumentable;
  const originals = {
    chunkArray: surface.chunkArray,
    chunkFloat64Array: surface.chunkFloat64Array,
    stats: surface.stats,
    exec: surface.exec,
  };
  surface.chunkArray = function (this: MathWorkerPool, ...args: unknown[]) {
    events.push({ kind: 'chunkArray' });
    return originals.chunkArray.apply(this, args);
  };
  surface.chunkFloat64Array = function (this: MathWorkerPool, ...args: unknown[]) {
    events.push({ kind: 'chunkFloat64Array' });
    return originals.chunkFloat64Array.apply(this, args);
  };
  surface.stats = function (this: MathWorkerPool, ...args: unknown[]) {
    events.push({ kind: 'stats' });
    const real = originals.stats.apply(this, args) as Record<string, number>;
    return totalWorkers === undefined ? real : { ...real, totalWorkers };
  };
  surface.exec = function (
    this: MathWorkerPool,
    method: string,
    params: unknown[],
    ...rest: unknown[]
  ) {
    events.push({ kind: 'exec', method, params, extra: rest.length });
    return originals.exec.call(this, method, params, ...rest);
  };
  return {
    events,
    restore() {
      const own = surface as unknown as Record<string, unknown>;
      delete own.chunkArray;
      delete own.chunkFloat64Array;
      delete own.stats;
      delete own.exec;
    },
  };
}

const execEvents = (events: Event[]) =>
  events.filter((e): e is Extract<Event, { kind: 'exec' }> => e.kind === 'exec');

describe('runParallel envelope pins (P6-7)', () => {
  let pool: MathWorkerPool;

  beforeAll(async () => {
    if (!existsSync(workerScript)) {
      execFileSync(
        process.execPath,
        [tsdownCli, 'src/worker.ts', '--format', 'esm', '--no-clean'],
        { cwd: pkgRoot, stdio: 'ignore' }
      );
    }
    pool = new MathWorkerPool({ maxWorkers: 2, parallelThreshold: 8, chunkSize: 4 });
    await pool.initialize();
  }, 60_000);

  afterAll(async () => {
    await pool?.terminate();
  });

  function expectEnvelope(r: ParallelResult<unknown>, shape: Partial<ParallelResult<unknown>>) {
    expect(Number.isFinite(r.duration)).toBe(true);
    expect(r.duration).toBeGreaterThanOrEqual(0);
    expect(r.chunks).toBe(shape.chunks);
    expect(r.parallelized).toBe(shape.parallelized);
    expect(r.workersUsed).toBe(shape.workersUsed);
  }

  const SEQ = { chunks: 1, parallelized: false, workersUsed: 0 };

  // 10 elements, chunkSize 4 -> chunks of 4, 4 and 2.
  const ARR = [5, 3, 9, 1, 7, 2, 8, 6, 4, 0];
  const F64 = Float64Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const F64_SHORT = Float64Array.from([1, 2, 3, 4, 5, 6, 7]);

  describe('sequential path (below the threshold)', () => {
    it('does not chunk, read stats or exec for any operation', async () => {
      const probe = instrument(pool);
      try {
        const short = [3, 1, 2];
        const m = await pool.map(short, (x) => x * 2);
        const f = await pool.filter(short, (x) => x > 1);
        const s = await pool.sort(short, (a, b) => b - a);
        const r = await pool.reduce(short, (acc: number, x: number) => acc + x, 100);
        const sum = await pool.sum(F64_SHORT);
        const prod = await pool.prod(F64_SHORT);
        const norm = await pool.norm(F64_SHORT);

        expect(m.result).toEqual([6, 2, 4]);
        expect(f.result).toEqual([3, 2]);
        expect(s.result).toEqual([3, 2, 1]);
        expect(r.result).toBe(106);
        expect(sum.result).toBe(28);
        expect(prod.result).toBe(5040);
        expect(norm.result).toBe(Math.sqrt(140));
        for (const x of [m, f, s, r, sum, prod, norm]) expectEnvelope(x, SEQ);
        expect(probe.events).toEqual([]);
      } finally {
        probe.restore();
      }
    });

    it('forceSequential wins over a large input and forceParallel', async () => {
      const probe = instrument(pool);
      try {
        const r = await pool.map(ARR, (x) => x + 1, { forceSequential: true });
        expect(r.result).toEqual(ARR.map((x) => x + 1));
        expectEnvelope(r, SEQ);
        const s = await pool.sum(F64, { forceSequential: true, forceParallel: true });
        expect(s.result).toBe(55);
        expectEnvelope(s, SEQ);
        expect(probe.events).toEqual([]);
      } finally {
        probe.restore();
      }
    });

    it('a sequential error rejects before any worker is used', async () => {
      const probe = instrument(pool);
      try {
        await expect(
          pool.map([1], () => {
            throw new Error('seq-boom');
          })
        ).rejects.toThrow('seq-boom');
        expect(probe.events).toEqual([]);
      } finally {
        probe.restore();
      }
    });

    it('sort does not mutate its input on either path', async () => {
      const input = [3, 1, 2];
      const copy = [...input];
      await pool.sort(input, (a, b) => a - b);
      expect(input).toEqual(copy);
      const big = [...ARR];
      await pool.sort(big, (a, b) => a - b);
      expect(big).toEqual(ARR);
    });
  });

  describe('parallel path (at or above the threshold)', () => {
    it('map: chunk, stats, then one mapChunk per chunk in source order', async () => {
      const fn = (x: number) => x * 10;
      const probe = instrument(pool, 5);
      try {
        const r = await pool.map(ARR, fn);
        expect(r.result).toEqual(ARR.map(fn));
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(probe.events.map((e) => e.kind)).toEqual([
          'chunkArray',
          'stats',
          'exec',
          'exec',
          'exec',
        ]);
        expect(execEvents(probe.events)).toEqual([
          { kind: 'exec', method: 'mapChunk', params: [[5, 3, 9, 1], fn.toString()], extra: 0 },
          { kind: 'exec', method: 'mapChunk', params: [[7, 2, 8, 6], fn.toString()], extra: 0 },
          { kind: 'exec', method: 'mapChunk', params: [[4, 0], fn.toString()], extra: 0 },
        ]);
      } finally {
        probe.restore();
      }
    });

    it('filter: chunk, stats, then one filterChunk per chunk in source order', async () => {
      const predicate = (x: number) => x % 2 === 1;
      const probe = instrument(pool, 5);
      try {
        const r = await pool.filter(ARR, predicate);
        expect(r.result).toEqual(ARR.filter(predicate));
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(probe.events.map((e) => e.kind)).toEqual([
          'chunkArray',
          'stats',
          'exec',
          'exec',
          'exec',
        ]);
        expect(execEvents(probe.events)).toEqual([
          {
            kind: 'exec',
            method: 'filterChunk',
            params: [[5, 3, 9, 1], predicate.toString()],
            extra: 0,
          },
          {
            kind: 'exec',
            method: 'filterChunk',
            params: [[7, 2, 8, 6], predicate.toString()],
            extra: 0,
          },
          { kind: 'exec', method: 'filterChunk', params: [[4, 0], predicate.toString()], extra: 0 },
        ]);
      } finally {
        probe.restore();
      }
    });

    it('map and filter honour options.chunkSize and fall back to config.chunkSize', async () => {
      const a = await pool.map(ARR, (x) => x, { forceParallel: true, chunkSize: 3 });
      expect(a.chunks).toBe(4);
      expect(a.result).toEqual(ARR);
      const b = await pool.filter(ARR, () => true, { forceParallel: true, chunkSize: 10 });
      expect(b.chunks).toBe(1);
      expect(b.result).toEqual(ARR);
      const c = await pool.map(ARR, (x) => x, { forceParallel: true });
      expect(c.chunks).toBe(3);
    });

    it('sort with a comparator: k-way merge of per-chunk sorts, comparator source sent', async () => {
      const compare = (a: number, b: number) => b - a;
      const probe = instrument(pool, 5);
      try {
        const r = await pool.sort(ARR, compare);
        expect(r.result).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(probe.events.map((e) => e.kind)).toEqual([
          'chunkArray',
          'stats',
          'exec',
          'exec',
          'exec',
        ]);
        expect(execEvents(probe.events).map((e) => [e.method, e.params, e.extra])).toEqual([
          ['sortChunk', [[5, 3, 9, 1], compare.toString()], 0],
          ['sortChunk', [[7, 2, 8, 6], compare.toString()], 0],
          ['sortChunk', [[4, 0], compare.toString()], 0],
        ]);
      } finally {
        probe.restore();
      }
    });

    it('sort without a comparator sends undefined, not an empty string', async () => {
      const words = ['pear', 'fig', 'apple', 'kiwi', 'plum', 'date', 'lime', 'mango', 'nut', 'oat'];
      const probe = instrument(pool, 5);
      try {
        const r = await pool.sort(words);
        expect(r.result).toEqual([...words].sort());
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(execEvents(probe.events).map((e) => [e.method, e.params[1]])).toEqual([
          ['sortChunk', undefined],
          ['sortChunk', undefined],
          ['sortChunk', undefined],
        ]);
        expect(execEvents(probe.events).map((e) => (e.params[0] as string[]).length)).toEqual([
          4, 4, 2,
        ]);
      } finally {
        probe.restore();
      }
    });

    it('sort keeps equal elements in chunk order (stable across the merge)', async () => {
      const rows = [
        { k: 1, id: 'a' },
        { k: 0, id: 'b' },
        { k: 1, id: 'c' },
        { k: 0, id: 'd' },
        { k: 1, id: 'e' },
        { k: 0, id: 'f' },
        { k: 1, id: 'g' },
        { k: 0, id: 'h' },
        { k: 1, id: 'i' },
        { k: 0, id: 'j' },
      ];
      const r = await pool.sort(rows, (x, y) => x.k - y.k, { forceParallel: true });
      expect(r.result.map((x) => x.id).join('')).toBe(
        [...rows]
          .sort((x, y) => x.k - y.k)
          .map((x) => x.id)
          .join('')
      );
    });

    it('reduce with a non-zero initial: every chunk and the combine start from `initial`', async () => {
      const add = (acc: number, x: number) => acc + x;
      const probe = instrument(pool, 5);
      try {
        const r = await pool.reduce(ARR, add, 100);
        // Each of the 3 chunks folds from 100, then the combine folds the 3 partials from 100.
        const partials = [100 + 5 + 3 + 9 + 1, 100 + 7 + 2 + 8 + 6, 100 + 4 + 0];
        expect(r.result).toBe(partials.reduce(add, 100));
        expect(r.result).toBe(100 + 300 + 45);
        expect(r.result).not.toBe(ARR.reduce(add, 100));
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(probe.events.map((e) => e.kind)).toEqual([
          'chunkArray',
          'stats',
          'exec',
          'exec',
          'exec',
        ]);
        expect(execEvents(probe.events).map((e) => [e.method, e.params, e.extra])).toEqual([
          ['reduceChunk', [[5, 3, 9, 1], add.toString(), 100], 0],
          ['reduceChunk', [[7, 2, 8, 6], add.toString(), 100], 0],
          ['reduceChunk', [[4, 0], add.toString(), 100], 0],
        ]);
      } finally {
        probe.restore();
      }
    });

    it('reduce with initial 0 equals the sequential reduce', async () => {
      const add = (acc: number, x: number) => acc + x;
      const par = await pool.reduce(ARR, add, 0, { forceParallel: true });
      const seq = await pool.reduce(ARR, add, 0, { forceSequential: true });
      expect(par.result).toBe(45);
      expect(seq.result).toBe(45);
      expectEnvelope(seq, SEQ);
    });

    it('sum: chunkFloat64Array, stats, then one sumChunk per slice with (buffer, 0, length)', async () => {
      const probe = instrument(pool, 5);
      try {
        const r = await pool.sum(F64);
        expect(r.result).toBe(55);
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(probe.events.map((e) => e.kind)).toEqual([
          'chunkFloat64Array',
          'stats',
          'exec',
          'exec',
          'exec',
        ]);
        const calls = execEvents(probe.events);
        expect(calls.map((e) => e.method)).toEqual(['sumChunk', 'sumChunk', 'sumChunk']);
        expect(calls.map((e) => e.extra)).toEqual([0, 0, 0]);
        expect(calls.map((e) => [e.params[1], e.params[2]])).toEqual([
          [0, 4],
          [0, 4],
          [0, 2],
        ]);
        expect(calls.map((e) => Array.from(new Float64Array(e.params[0] as ArrayBuffer)))).toEqual([
          [1, 2, 3, 4],
          [5, 6, 7, 8],
          [9, 10],
        ]);
      } finally {
        probe.restore();
      }
    });

    it('prod: one prodChunk per slice, partials multiplied from 1', async () => {
      const probe = instrument(pool, 5);
      try {
        const r = await pool.prod(F64);
        expect(r.result).toBe(3628800);
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(execEvents(probe.events).map((e) => e.method)).toEqual([
          'prodChunk',
          'prodChunk',
          'prodChunk',
        ]);
      } finally {
        probe.restore();
      }
    });

    it('norm: one normChunk per slice, square root of the summed partials', async () => {
      const probe = instrument(pool, 5);
      try {
        const r = await pool.norm(F64);
        expect(r.result).toBe(Math.sqrt(385));
        expectEnvelope(r, { chunks: 3, parallelized: true, workersUsed: 3 });
        expect(execEvents(probe.events).map((e) => e.method)).toEqual([
          'normChunk',
          'normChunk',
          'normChunk',
        ]);
      } finally {
        probe.restore();
      }
    });

    it('scalar reductions honour options.chunkSize', async () => {
      const r = await pool.sum(F64, { forceParallel: true, chunkSize: 3 });
      expect(r.result).toBe(55);
      expect(r.chunks).toBe(4);
    });

    it('workersUsed is min(chunks, stats().totalWorkers) for every operation', async () => {
      for (const totalWorkers of [0, 1, 2, 3, 9]) {
        const probe = instrument(pool, totalWorkers);
        try {
          const expected = Math.min(3, totalWorkers);
          const results = [
            await pool.map(ARR, (x) => x),
            await pool.filter(ARR, () => true),
            await pool.sort(ARR, (a, b) => a - b),
            await pool.reduce(ARR, (acc: number, x: number) => acc + x, 0),
            await pool.sum(F64),
            await pool.prod(F64),
            await pool.norm(F64),
          ];
          for (const r of results) {
            expect(r.chunks).toBe(3);
            expect(r.parallelized).toBe(true);
            expect(r.workersUsed).toBe(expected);
          }
        } finally {
          probe.restore();
        }
      }
    });

    it('stats is read once per parallel call, after chunking and before the first exec', async () => {
      const probe = instrument(pool);
      try {
        await pool.sum(F64);
        const kinds = probe.events.map((e) => e.kind);
        expect(kinds.filter((k) => k === 'stats')).toHaveLength(1);
        expect(kinds.indexOf('chunkFloat64Array')).toBeLessThan(kinds.indexOf('stats'));
        expect(kinds.indexOf('stats')).toBeLessThan(kinds.indexOf('exec'));
      } finally {
        probe.restore();
      }
    });

    it('a worker error rejects the call and no result is returned', async () => {
      await expect(
        pool.map(ARR, (x) => {
          if (x === 9) throw new Error('par-boom');
          return x;
        })
      ).rejects.toThrow(/par-boom/);
      await expect(
        pool.filter(ARR, (x) => {
          if (x === 9) throw new Error('par-boom-filter');
          return true;
        })
      ).rejects.toThrow(/par-boom-filter/);
    });

    it('empty input stays sequential with the empty result of each operation', async () => {
      const probe = instrument(pool);
      try {
        const results = [
          await pool.map([], (x) => x),
          await pool.filter([], () => true),
          await pool.sort([]),
          await pool.reduce([], (acc: number, x: number) => acc + x, 7),
          await pool.sum(new Float64Array(0)),
          await pool.prod(new Float64Array(0)),
          await pool.norm(new Float64Array(0)),
        ];
        expect(results.map((r) => r.result)).toEqual([[], [], [], 7, 0, 1, 0]);
        for (const r of results) expectEnvelope(r, SEQ);
        expect(probe.events).toEqual([]);
      } finally {
        probe.restore();
      }
    });
  });
});

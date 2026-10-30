import { describe, expect, it, vi } from 'vitest';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import {
  createScalarBuilder,
  scalarCanonicalKey,
  type ScalarGrammar,
  type ScalarNode,
} from '@danielsimonjr/mathts-expression';
import type { WorkerPool } from '@danielsimonjr/mathts-parallel';
import { compileScalar } from '../src/scalar-compile.js';
import {
  searchScalars,
  type ScalarSearchOptions,
  type ScalarSearchProblem,
  type ScalarSearchResult,
  type SearchProgress,
} from '../src/scalar-search.js';

interface FakePoolRecord {
  readonly script: string;
  readonly calls: { timeoutMs: unknown; items: number; rows: number }[];
  terminated: number;
}

const world = vi.hoisted(() => ({
  pools: [] as FakePoolRecord[],
  failExecute: false,
}));

// Stands in for the real WorkerPool: no thread starts, but each call goes through a
// structured copy and the worker's own evaluation function, and every pool is recorded.
vi.mock('@danielsimonjr/mathts-parallel', async (importOriginal) => {
  const original = await importOriginal<typeof import('@danielsimonjr/mathts-parallel')>();
  class FakeWorkerPool {
    private readonly record: FakePoolRecord;
    constructor(script: string) {
      this.record = { script, calls: [], terminated: 0 };
      world.pools.push(this.record);
    }
    async execute(data: unknown, _transferables?: unknown, timeoutMs?: unknown): Promise<unknown> {
      // Loaded here and not in the factory: that module reaches the mocked package, and a
      // factory that waits for a module that waits for the factory never finishes.
      const { runScalarBatchTask } = await import('../src/scalar-batch-task.js');
      const task = structuredClone(data) as Parameters<typeof runScalarBatchTask>[0];
      this.record.calls.push({
        timeoutMs,
        items: task.items.length,
        rows: task.columns[0]?.length ?? 0,
      });
      if (world.failExecute) {
        throw new Error('Worker task timed out after 30000ms');
      }
      return structuredClone(runScalarBatchTask(task));
    }
    async terminate(): Promise<void> {
      this.record.terminated += 1;
    }
  }
  return { ...original, WorkerPool: FakeWorkerPool };
});

const b = createScalarBuilder();
const X = b.symbol('x');
const P = b.symbol('p');

function linspace(n: number, lo: number, hi: number): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    out[i] = lo + ((hi - lo) * i) / (n - 1);
  }
  return out;
}

function problemOf(rows: number, planted: ScalarNode, parameters?: number[]): ScalarSearchProblem {
  const xs = linspace(rows, -1, 1);
  const names = parameters === undefined ? undefined : ['p'];
  const observed = compileScalar(planted, { variables: ['x'], parameters: names }).evaluate(
    [xs],
    parameters
  ).values;
  return { variables: ['x'], columns: [xs], observed, parameters: names };
}

const grammar: ScalarGrammar = {
  variables: ['x'],
  binary: ['+', '*'],
  unary: [],
  literals: [1],
  maxSize: 9,
};
const planted = b.op('+', [b.op('*', [b.op('*', [X, X]), b.op('*', [X, X])]), b.op('*', [X, X])]);

async function drain(
  problem: ScalarSearchProblem,
  options: ScalarSearchOptions
): Promise<{ progress: SearchProgress[]; result: ScalarSearchResult }> {
  const gen = searchScalars(problem, options);
  const progress: SearchProgress[] = [];
  for (;;) {
    const step = await gen.next();
    if (step.done) {
      return { progress, result: step.value };
    }
    progress.push(step.value);
  }
}

function expectSameRun(a: SearchProgress[], c: SearchProgress[]): void {
  expect(a).toHaveLength(c.length);
  a.forEach((event, i) => {
    const other = c[i]!;
    expect(event.evaluations).toBe(other.evaluations);
    expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      other.front.map((row) => scalarCanonicalKey(row.item))
    );
    event.front.forEach((row, j) => {
      expect(Object.is(row.loss, other.front[j]!.loss)).toBe(true);
    });
    event.fittedParameters.forEach((values, j) => {
      expect([...values].every((v, k) => Object.is(v, other.fittedParameters[j]![k]))).toBe(true);
    });
  });
}

const base = {
  grammar,
  populationSize: 12,
  tournamentSize: 4,
  maxEvaluations: 300,
} as const;

describe('searchScalars with parallel evaluation', () => {
  it('equals the serial run for the same seed, event by event', async () => {
    const problem = problemOf(120, planted);
    const serial = await drain(problem, { ...base, rng: createSeededRng(7) });
    const before = world.pools.length;
    const parallel = await drain(problem, { ...base, rng: createSeededRng(7), parallel: {} });
    expectSameRun(parallel.progress, serial.progress);
    expect(parallel.result.evaluations).toBe(serial.result.evaluations);
    expect(world.pools.length - before).toBe(1);
  });

  it('evaluates through the pool, one call per chunk of every generation, at 30000 ms', async () => {
    const problem = problemOf(120, planted);
    const before = world.pools.length;
    await drain(problem, { ...base, rng: createSeededRng(7), parallel: {} });
    const pool = world.pools[before]!;
    expect(pool.script.endsWith('/scalar-batch.worker.js')).toBe(true);
    expect(pool.calls.length).toBeGreaterThan(0);
    expect(pool.calls.every((call) => call.timeoutMs === 30_000 && call.rows === 120)).toBe(true);
    // 300 evaluations: every tree was scored by the pool, none on the caller thread.
    expect(pool.calls.reduce((sum, call) => sum + call.items, 0)).toBe(300);
  });

  it('equals the serial run when parameters are refitted on the caller thread', async () => {
    const law = b.op('*', [P, X]);
    const problem = problemOf(120, law, [2]);
    const fitting = {
      ...base,
      grammar: { ...grammar, parameters: ['p'] },
      optimizeProbability: 1,
      maxEvaluations: 150,
    };
    const serial = await drain(problem, { ...fitting, rng: createSeededRng(3) });
    const parallel = await drain(problem, { ...fitting, rng: createSeededRng(3), parallel: {} });
    expectSameRun(parallel.progress, serial.progress);
    const best = parallel.result.front.reduce((a, c) => (c.loss < a.loss ? c : a));
    expect(best.loss).toBeLessThan(1e-12);
    expect(parallel.result.fittedParameters.length).toBeGreaterThan(0);
  });

  it('equals the serial run with several islands', async () => {
    const problem = problemOf(120, planted);
    const islands = { ...base, populations: 3, fractionReplaced: 0.3, maxEvaluations: 360 };
    const serial = await drain(problem, { ...islands, rng: createSeededRng(5) });
    const parallel = await drain(problem, { ...islands, rng: createSeededRng(5), parallel: {} });
    expectSameRun(parallel.progress, serial.progress);
  });

  it('starts no pool below 100 rows', async () => {
    const before = world.pools.length;
    const problem = problemOf(99, planted);
    const serial = await drain(problem, { ...base, rng: createSeededRng(7) });
    const parallel = await drain(problem, { ...base, rng: createSeededRng(7), parallel: {} });
    expect(world.pools.length).toBe(before);
    expectSameRun(parallel.progress, serial.progress);
  });

  it('terminates the pool it started, once, when the search ends', async () => {
    const before = world.pools.length;
    await drain(problemOf(120, planted), { ...base, rng: createSeededRng(7), parallel: {} });
    expect(world.pools.length - before).toBe(1);
    expect(world.pools[before]!.terminated).toBe(1);
  });

  it('terminates the pool when the consumer stops early', async () => {
    const before = world.pools.length;
    const gen = searchScalars(problemOf(120, planted), {
      ...base,
      rng: createSeededRng(7),
      parallel: {},
    });
    await gen.next();
    await gen.next();
    expect(world.pools[before]!.terminated).toBe(0);
    await gen.return(undefined as unknown as ScalarSearchResult);
    expect(world.pools[before]!.terminated).toBe(1);
  });

  it('rejects, and terminates the pool, when a worker call fails', async () => {
    const before = world.pools.length;
    world.failExecute = true;
    try {
      await expect(
        drain(problemOf(120, planted), { ...base, rng: createSeededRng(7), parallel: {} })
      ).rejects.toThrow(/timed out/);
    } finally {
      world.failExecute = false;
    }
    expect(world.pools[before]!.terminated).toBe(1);
  });

  it('uses a pool it is given and leaves it running', async () => {
    const calls: unknown[] = [];
    const pool = {
      execute: async (data: unknown, _t?: unknown, timeoutMs?: unknown) => {
        calls.push(timeoutMs);
        const { runScalarBatchTask } = await import('../src/scalar-batch-task.js');
        return runScalarBatchTask(data as Parameters<typeof runScalarBatchTask>[0]);
      },
    } as unknown as Pick<WorkerPool, 'execute'>;
    const before = world.pools.length;
    const problem = problemOf(120, planted);
    const serial = await drain(problem, { ...base, rng: createSeededRng(7) });
    const parallel = await drain(problem, {
      ...base,
      rng: createSeededRng(7),
      parallel: { pool, timeoutMs: 5_000 },
    });
    expectSameRun(parallel.progress, serial.progress);
    expect(world.pools.length).toBe(before);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((t) => t === 5_000)).toBe(true);
  });

  it('rejects a timeout of zero, which would turn the guard off', async () => {
    const before = world.pools.length;
    for (const timeoutMs of [0, -5, Number.NaN]) {
      await expect(
        drain(problemOf(120, planted), {
          ...base,
          rng: createSeededRng(7),
          parallel: { timeoutMs },
        })
      ).rejects.toThrow(RangeError);
    }
    expect(world.pools.length).toBe(before);
  });
});

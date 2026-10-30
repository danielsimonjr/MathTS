import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '@danielsimonjr/mathts-core';
import { createScalarBuilder, scalarCanonicalKey } from '@danielsimonjr/mathts-expression';
import {
  compileScalar,
  searchScalars,
  type ScalarSearchOptions,
  type ScalarSearchProblem,
  type ScalarSearchResult,
  type SearchProgress,
} from '@danielsimonjr/mathts-functions';
import { WorkerPool } from '@danielsimonjr/mathts-parallel';

/**
 * Real worker threads, through the built packages (`dist`): the worker script is the
 * sibling of `functions/dist/index.js` that `searchScalars` resolves by URL.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKER_SCRIPT = resolve(REPO, 'functions', 'dist', 'scalar-batch.worker.js');

const b = createScalarBuilder();
const X = b.symbol('x');
const ROWS = 128;

function problem(): ScalarSearchProblem {
  const xs = new Float64Array(ROWS);
  for (let i = 0; i < ROWS; i += 1) {
    xs[i] = -1 + (2 * i) / (ROWS - 1);
  }
  const planted = b.op('+', [b.op('*', [b.op('*', [X, X]), b.op('*', [X, X])]), b.op('*', [X, X])]);
  const observed = compileScalar(planted, { variables: ['x'] }).evaluate([xs]).values;
  return { variables: ['x'], columns: [xs], observed };
}

const options: Omit<ScalarSearchOptions, 'rng'> = {
  grammar: { variables: ['x'], binary: ['+', '*'], unary: [], literals: [1], maxSize: 9 },
  populationSize: 12,
  tournamentSize: 4,
  maxEvaluations: 240,
};

async function drain(
  extra: Partial<ScalarSearchOptions>
): Promise<{ progress: SearchProgress[]; result: ScalarSearchResult }> {
  const gen = searchScalars(problem(), { ...options, rng: createSeededRng(7), ...extra });
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
  expect(a.length).toBeGreaterThan(1);
  expect(a).toHaveLength(c.length);
  a.forEach((event, i) => {
    expect(event.evaluations).toBe(c[i]!.evaluations);
    expect(event.front.map((row) => scalarCanonicalKey(row.item))).toEqual(
      c[i]!.front.map((row) => scalarCanonicalKey(row.item))
    );
    event.front.forEach((row, j) => {
      expect(Object.is(row.loss, c[i]!.front[j]!.loss)).toBe(true);
    });
  });
}

describe('searchScalars parallel vs serial (built packages, real workers)', () => {
  it('ships the worker script next to the bundle', () => {
    expect(existsSync(WORKER_SCRIPT)).toBe(true);
  });

  it('a pool of real workers gives the serial front and losses, with the timeout set', async () => {
    const serial = await drain({});
    const pool = new WorkerPool(pathToFileURL(WORKER_SCRIPT).href, 2);
    const calls: { timeoutMs: number | undefined; rows: number }[] = [];
    const counting: Pick<WorkerPool, 'execute'> = {
      execute: <T, R>(data: T, transferables?: Transferable[], timeoutMs?: number) => {
        calls.push({
          timeoutMs,
          rows: (data as { columns: Float64Array[] }).columns[0]!.length,
        });
        return pool.execute<T, R>(data, transferables, timeoutMs);
      },
    };
    try {
      const parallel = await drain({ parallel: { pool: counting } });
      expectSameRun(parallel.progress, serial.progress);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every((call) => call.timeoutMs === 30_000 && call.rows === ROWS)).toBe(true);
    } finally {
      await pool.terminate();
    }
  }, 120_000);

  it('the pool the search starts itself gives the same run and is shut down after it', async () => {
    const serial = await drain({});
    const parallel = await drain({ parallel: {} });
    expectSameRun(parallel.progress, serial.progress);
  }, 120_000);

  it('a call that outlives its timeout rejects, even while no worker is up yet', async () => {
    // One millisecond is shorter than starting a worker thread, so the first call is
    // still queued when it expires and must be rejected by the timeout, not left hanging.
    await expect(drain({ parallel: { timeoutMs: 1 } })).rejects.toThrow(/timed out after 1ms/);
  }, 60_000);
});

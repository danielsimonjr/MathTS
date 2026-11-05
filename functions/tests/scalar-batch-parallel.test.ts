import { describe, expect, it, vi } from 'vitest';
import { createScalarBuilder, type ScalarNode } from '@danielsimonjr/mathts-expression';
import type { WorkerPool } from '@danielsimonjr/mathts-parallel';
import { buildTape, compileScalar } from '../src/scalar-compile.js';
import {
  DEFAULT_SCALAR_PARALLEL_TIMEOUT_MS,
  evaluateScalarPopulation,
  resolveParallelTimeout,
  resolveScalarBatchWorkerScript,
  SCALAR_PARALLEL_MIN_ROWS,
  type ScalarPopulationEvalItem,
} from '../src/scalar-batch-parallel.js';
import {
  runScalarBatchTask,
  type ScalarBatchTask,
  type ScalarBatchTaskResult,
} from '../src/scalar-batch-task.js';

const b = createScalarBuilder();
const x = b.symbol('x');
const p = b.symbol('p');

const trees: readonly ScalarNode[] = [
  b.op('+', [b.op('*', [x, x]), x]),
  b.op('*', [p, b.call('sin', x)]),
  b.op('/', [b.number(1), x]),
  b.call('log', x),
  b.op('+', [x, b.op('*', [p, p])]),
];

function column(n: number): Float64Array[] {
  const col = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    col[i] = -1 + (2 * i) / Math.max(1, n - 1);
  }
  return [col];
}

type Execute = Pick<WorkerPool, 'execute'>['execute'];

interface Loopback {
  readonly pool: Pick<WorkerPool, 'execute'>;
  readonly calls: { payload: ScalarBatchTask; transferables: unknown; timeoutMs: unknown }[];
}

/**
 * A pool that does what a worker does: it receives a structured copy of the task, runs
 * `runScalarBatchTask` on it, and answers with a structured copy of the result.
 */
function loopback(order: 'forward' | 'reverse' = 'forward'): Loopback {
  const calls: Loopback['calls'] = [];
  const execute = (async (data: unknown, transferables?: unknown, timeoutMs?: unknown) => {
    const payload = structuredClone(data as ScalarBatchTask);
    calls.push({ payload: data as ScalarBatchTask, transferables, timeoutMs });
    const result: ScalarBatchTaskResult = runScalarBatchTask(payload);
    const rows = order === 'reverse' ? [...result.rows].reverse() : result.rows;
    return structuredClone({ rows });
  }) as Execute;
  return { pool: { execute }, calls };
}

function sameBits(a: Float64Array, c: Float64Array): boolean {
  return a.length === c.length && a.every((v, i) => Object.is(v, c[i]));
}

function items(): ScalarPopulationEvalItem[] {
  return trees.map((node, i) => ({ index: 10 + i, node, params: [0.5 + i] }));
}

const options = (columns: Float64Array[]) => ({
  variables: ['x'],
  parameters: ['p'],
  columns,
  items: items(),
});

function serialValues(columns: Float64Array[]) {
  return items().map((item) =>
    compileScalar(item.node, { variables: ['x'], parameters: ['p'] }).evaluate(columns, item.params)
  );
}

describe('evaluateScalarPopulation', () => {
  it('uses the threshold the plan names and a positive default timeout', () => {
    expect(SCALAR_PARALLEL_MIN_ROWS).toBe(100);
    expect(DEFAULT_SCALAR_PARALLEL_TIMEOUT_MS).toBe(30_000);
  });

  it('does not call the pool below the threshold, and matches compileScalar', async () => {
    const columns = column(SCALAR_PARALLEL_MIN_ROWS - 1);
    const { pool, calls } = loopback();
    const results = await evaluateScalarPopulation({ ...options(columns), parallel: { pool } });
    expect(calls).toHaveLength(0);
    const reference = serialValues(columns);
    results.forEach((result, i) => {
      expect(result.index).toBe(10 + i);
      expect(sameBits(result.batch.values, reference[i]!.values)).toBe(true);
    });
  });

  it('calls the pool at the threshold, with the timeout as the third argument', async () => {
    const columns = column(SCALAR_PARALLEL_MIN_ROWS);
    const { pool, calls } = loopback();
    const results = await evaluateScalarPopulation({ ...options(columns), parallel: { pool } });
    expect(calls.length).toBeGreaterThanOrEqual(1);
    for (const call of calls) {
      expect(call.timeoutMs).toBe(30_000);
      expect(call.transferables).toBeUndefined();
      expect(call.payload.variables).toEqual(['x']);
      expect(call.payload.columns[0]).toHaveLength(SCALAR_PARALLEL_MIN_ROWS);
    }
    const shipped = calls.flatMap((call) => call.payload.items.map((item) => item.candidateIndex));
    expect([...shipped].sort((a, c) => a - c)).toEqual([0, 1, 2, 3, 4]);
    const reference = serialValues(columns);
    results.forEach((result, i) => {
      expect(result.index).toBe(10 + i);
      expect(sameBits(result.batch.values, reference[i]!.values)).toBe(true);
      expect([...result.batch.valid]).toEqual([...reference[i]!.valid]);
      expect(result.batch.allValid).toBe(reference[i]!.allValid);
    });
  });

  it('puts results back in item order whatever order the workers answer in', async () => {
    const columns = column(200);
    const { pool } = loopback('reverse');
    const results = await evaluateScalarPopulation({ ...options(columns), parallel: { pool } });
    const reference = serialValues(columns);
    expect(results.map((r) => r.index)).toEqual([10, 11, 12, 13, 14]);
    results.forEach((result, i) => {
      expect(sameBits(result.batch.values, reference[i]!.values)).toBe(true);
    });
  });

  it('carries NaN and invalid rows across unchanged', async () => {
    const columns = column(128);
    const { pool } = loopback();
    const results = await evaluateScalarPopulation({ ...options(columns), parallel: { pool } });
    const log = results[3]!.batch;
    expect(log.allValid).toBe(false);
    expect(log.valid.some((v) => v === 0)).toBe(true);
    log.values.forEach((v, i) => {
      if (log.valid[i] === 0) {
        expect(Number.isNaN(v)).toBe(true);
      }
    });
  });

  it('keeps two items that share an index apart', async () => {
    const columns = column(150);
    const { pool } = loopback();
    const results = await evaluateScalarPopulation({
      variables: ['x'],
      columns,
      items: [
        { index: 7, node: trees[0]! },
        { index: 7, node: trees[2]! },
      ],
      parallel: { pool },
    });
    const first = compileScalar(trees[0]!, { variables: ['x'] }).evaluate(columns);
    const second = compileScalar(trees[2]!, { variables: ['x'] }).evaluate(columns);
    expect(sameBits(results[0]!.batch.values, first.values)).toBe(true);
    expect(sameBits(results[1]!.batch.values, second.values)).toBe(true);
  });

  it('forwards the timeout it was given', async () => {
    const { pool, calls } = loopback();
    await evaluateScalarPopulation({
      ...options(column(100)),
      parallel: { pool, timeoutMs: 1_234 },
    });
    expect(calls.every((call) => call.timeoutMs === 1_234)).toBe(true);
  });

  it('refuses a timeout that would switch the guard off, before any work', async () => {
    const execute = vi.fn();
    const pool = { execute } as unknown as Pick<WorkerPool, 'execute'>;
    for (const timeoutMs of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(
        evaluateScalarPopulation({ ...options(column(100)), parallel: { pool, timeoutMs } })
      ).rejects.toThrow(RangeError);
    }
    // Also below the threshold: a bad option is a bad option, not something rows excuse.
    await expect(
      evaluateScalarPopulation({ ...options(column(10)), parallel: { pool, timeoutMs: 0 } })
    ).rejects.toThrow(RangeError);
    expect(execute).not.toHaveBeenCalled();
    expect(() => resolveParallelTimeout(undefined)).not.toThrow();
  });

  it('rejects when a worker call rejects, e.g. on a timeout', async () => {
    const pool = {
      execute: vi.fn(async () => {
        throw new Error('Worker task timed out after 30000ms');
      }),
    } as unknown as Pick<WorkerPool, 'execute'>;
    await expect(
      evaluateScalarPopulation({ ...options(column(100)), parallel: { pool } })
    ).rejects.toThrow(/timed out/);
  });

  it('rejects an answer whose length is not the row count', async () => {
    const pool = {
      execute: async (data: unknown) => {
        const result = runScalarBatchTask(data as ScalarBatchTask);
        return {
          rows: result.rows.map((row) => ({ ...row, values: row.values.slice(0, 3) })),
        };
      },
    } as unknown as Pick<WorkerPool, 'execute'>;
    await expect(
      evaluateScalarPopulation({ ...options(column(100)), parallel: { pool } })
    ).rejects.toThrow(/3 values for 100 rows/);
  });

  it('rejects when a worker leaves out a tree', async () => {
    const pool = {
      execute: async (data: unknown) => {
        const result = runScalarBatchTask(data as ScalarBatchTask);
        return { rows: result.rows.slice(1) };
      },
    } as unknown as Pick<WorkerPool, 'execute'>;
    await expect(
      evaluateScalarPopulation({ ...options(column(100)), parallel: { pool } })
    ).rejects.toThrow(/no worker result/);
  });

  it('returns an empty list for no items and leaves a mismatched problem to compileScalar', async () => {
    const { pool, calls } = loopback();
    expect(
      await evaluateScalarPopulation({
        variables: ['x'],
        columns: column(100),
        items: [],
        parallel: { pool },
      })
    ).toEqual([]);
    await expect(
      evaluateScalarPopulation({
        variables: ['x'],
        columns: [],
        items: [{ index: 0, node: trees[0]! }],
        parallel: { pool },
      })
    ).rejects.toThrow(/expected 1 columns, got 0/);
    expect(calls).toHaveLength(0);
  });

  it('ships a worker script URL that sits next to the module', () => {
    const url = resolveScalarBatchWorkerScript();
    expect(url.startsWith('file:')).toBe(true);
    expect(url.endsWith('/scalar-batch.worker.js')).toBe(true);
  });
});

describe('runScalarBatchTask', () => {
  it('reports a shape error the way compileScalar does', () => {
    const built = buildTape(trees[0]!, { variables: ['x'] }, 'compileScalar:');
    const task: ScalarBatchTask = {
      variables: ['x'],
      columns: [],
      tapes: [{ tape: built.tape, rootReg: built.rootReg, nRegs: built.nRegs }],
      items: [
        {
          candidateIndex: 0,
          tapeIndex: 0,
          params: [],
          parameters: built.parameters,
        },
      ],
    };
    expect(() => runScalarBatchTask(task)).toThrow(/compileScalar: expected 1 columns, got 0/);
  });
});

describe('SR-12: one compile per structure', () => {
  const sqrtNode = b.call('sqrt', x);

  it('gives two same-structure trees with different parameters different results (serial)', async () => {
    const columns = column(120);
    const results = await evaluateScalarPopulation({
      variables: ['x'],
      parameters: ['p'],
      columns,
      items: [
        { index: 0, node: trees[1]!, params: [1] },
        { index: 1, node: trees[1]!, params: [2] },
      ],
    });
    expect(results).toHaveLength(2);
    const first = results[0]!.batch;
    const second = results[1]!.batch;
    expect(sameBits(first.values, second.values)).toBe(false);
    const reference = compileScalar(trees[1]!, {
      variables: ['x'],
      parameters: ['p'],
    });
    expect(sameBits(first.values, reference.evaluate(columns, [1]).values)).toBe(true);
    expect(sameBits(second.values, reference.evaluate(columns, [2]).values)).toBe(true);
  });

  it('gives two same-structure trees with different parameters different results (workers)', async () => {
    const columns = column(120);
    const { pool, calls } = loopback();
    const results = await evaluateScalarPopulation({
      variables: ['x'],
      parameters: ['p'],
      columns,
      items: [
        { index: 0, node: trees[1]!, params: [1] },
        { index: 1, node: trees[1]!, params: [2] },
        { index: 2, node: trees[1]!, params: [3] },
        { index: 3, node: trees[1]!, params: [4] },
      ],
      parallel: { pool },
    });
    expect(sameBits(results[0]!.batch.values, results[1]!.batch.values)).toBe(false);
    const reference = compileScalar(trees[1]!, {
      variables: ['x'],
      parameters: ['p'],
    });
    for (const [i, params] of [1, 2, 3, 4].entries()) {
      expect(sameBits(results[i]!.batch.values, reference.evaluate(columns, [params]).values)).toBe(
        true
      );
    }
    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Two workers (stubbed) split four copies into two messages of two items; each
    // message carries the one shared tape and both items reference it by index.
    vi.stubGlobal('navigator', { hardwareConcurrency: 3 });
    try {
      const { pool: singlePool, calls: singleCalls } = loopback();
      const single = await evaluateScalarPopulation({
        variables: ['x'],
        parameters: ['p'],
        columns,
        items: [
          { index: 0, node: trees[1]!, params: [1] },
          { index: 1, node: trees[1]!, params: [2] },
          { index: 2, node: trees[1]!, params: [3] },
          { index: 3, node: trees[1]!, params: [4] },
        ],
        parallel: { pool: singlePool },
      });
      expect(singleCalls).toHaveLength(2);
      for (const call of singleCalls) {
        expect(call.payload.tapes).toHaveLength(1);
        expect(call.payload.items.map((item) => item.tapeIndex)).toEqual([0, 0]);
      }
      expect(sameBits(single[0]!.batch.values, results[0]!.batch.values)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('marks only the invalid tree invalid in a mixed batch (serial and workers)', async () => {
    const columns = column(120);
    const serial = await evaluateScalarPopulation({
      variables: ['x'],
      columns,
      items: [
        { index: 0, node: b.op('+', [x, b.number(1)]) },
        { index: 1, node: sqrtNode },
      ],
    });
    expect(serial[0]!.batch.allValid).toBe(true);
    expect(serial[1]!.batch.allValid).toBe(false);
    expect(serial[1]!.batch.valid.some((v) => v === 1)).toBe(true);
    expect(serial[1]!.batch.valid.some((v) => v === 0)).toBe(true);
    serial[1]!.batch.values.forEach((v, i) => {
      if (serial[1]!.batch.valid[i] === 0) expect(Number.isNaN(v)).toBe(true);
    });

    const { pool } = loopback();
    const parallel = await evaluateScalarPopulation({
      variables: ['x'],
      columns,
      items: [
        { index: 0, node: b.op('+', [x, b.number(1)]) },
        { index: 1, node: sqrtNode },
      ],
      parallel: { pool },
    });
    expect(sameBits(parallel[0]!.batch.values, serial[0]!.batch.values)).toBe(true);
    expect([...parallel[1]!.batch.valid]).toEqual([...serial[1]!.batch.valid]);
    expect(sameBits(parallel[1]!.batch.values, serial[1]!.batch.values)).toBe(true);
  });

  it('keeps same-key stored shapes that evaluate differently on separate tapes', async () => {
    const triple = b.op('*', [b.op('*', [x, x]), x]);
    const cube = b.op('^', [x, b.number(3)]);
    const columns = [Float64Array.of(1.0142857142857142, 2, -3, 0.5)];
    const serial = await evaluateScalarPopulation({
      variables: ['x'],
      columns,
      items: [
        { index: 0, node: triple },
        { index: 1, node: cube },
      ],
    });
    expect(serial[0]!.batch.values[0]).toBe(1.0434723032069968);
    expect(serial[1]!.batch.values[0]).toBe(1.043472303206997);

    const big = column(SCALAR_PARALLEL_MIN_ROWS);
    big[0]![0] = 1.0142857142857142;
    const { pool } = loopback();
    const parallel = await evaluateScalarPopulation({
      variables: ['x'],
      columns: big,
      items: [
        { index: 0, node: triple },
        { index: 1, node: cube },
        { index: 2, node: triple },
        { index: 3, node: cube },
      ],
      parallel: { pool },
    });
    expect(Object.is(parallel[0]!.batch.values[0], serial[0]!.batch.values[0])).toBe(true);
    expect(Object.is(parallel[1]!.batch.values[0], serial[1]!.batch.values[0])).toBe(true);
    expect(sameBits(parallel[2]!.batch.values, parallel[0]!.batch.values)).toBe(true);
    expect(sameBits(parallel[3]!.batch.values, parallel[1]!.batch.values)).toBe(true);
    // Two workers (stubbed) split the four items into two messages of two; each
    // message carries both distinct tapes and its items reference them by index.
    vi.stubGlobal('navigator', { hardwareConcurrency: 3 });
    try {
      const { pool: singlePool, calls: singleCalls } = loopback();
      const single = await evaluateScalarPopulation({
        variables: ['x'],
        columns: big,
        items: [
          { index: 0, node: triple },
          { index: 1, node: cube },
          { index: 2, node: triple },
          { index: 3, node: cube },
        ],
        parallel: { pool: singlePool },
      });
      expect(singleCalls).toHaveLength(2);
      for (const call of singleCalls) {
        expect(call.payload.tapes).toHaveLength(2);
        expect(call.payload.items.map((item) => item.tapeIndex)).toEqual([0, 1]);
      }
      expect(Object.is(single[0]!.batch.values[0], 1.0434723032069968)).toBe(true);
      expect(Object.is(single[1]!.batch.values[0], 1.043472303206997)).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reuses one tape for copies of the same tree (serial and workers)', async () => {
    const columns = column(120);
    const serial = await evaluateScalarPopulation({
      variables: ['x'],
      parameters: ['p'],
      columns,
      items: [
        { index: 0, node: trees[4]!, params: [1] },
        { index: 1, node: trees[4]!, params: [1] },
      ],
    });
    expect(sameBits(serial[0]!.batch.values, serial[1]!.batch.values)).toBe(true);
    expect(serial[0]!.batch.values).not.toBe(serial[1]!.batch.values);

    // Two workers (stubbed) split the four copies into two messages of two; each
    // message carries the one shared tape.
    vi.stubGlobal('navigator', { hardwareConcurrency: 3 });
    try {
      const { pool: singlePool, calls: singleCalls } = loopback();
      await evaluateScalarPopulation({
        variables: ['x'],
        parameters: ['p'],
        columns,
        items: [
          { index: 0, node: trees[4]!, params: [1] },
          { index: 1, node: trees[4]!, params: [1] },
          { index: 2, node: trees[4]!, params: [1] },
          { index: 3, node: trees[4]!, params: [1] },
        ],
        parallel: { pool: singlePool },
      });
      expect(singleCalls).toHaveLength(2);
      for (const call of singleCalls) {
        expect(call.payload.tapes).toHaveLength(1);
        expect(call.payload.items.map((item) => item.tapeIndex)).toEqual([0, 0]);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

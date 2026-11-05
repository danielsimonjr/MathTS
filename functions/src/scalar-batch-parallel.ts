/**
 * Evaluates many scalar trees over shared columns, on worker threads when asked to (M14).
 *
 * The caller opts in with `parallel`; without it every tree runs through
 * {@link compileScalar} on the caller thread. With it, populations over at least
 * {@link SCALAR_PARALLEL_MIN_ROWS} rows are compiled to tapes here and the tapes are
 * evaluated by `scalar-batch.worker.js` through {@link WorkerPool.execute}, with a
 * timeout that always applies. Both paths run the same `evaluateScalarTape`, so the values
 * agree bit for bit.
 *
 * @packageDocumentation
 */

import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { WorkerPool } from '@danielsimonjr/mathts-parallel';
import {
  buildTape,
  compileScalar,
  createBatchTapeCache,
  evaluateScalarTape,
  type CompileScalarOptions,
  type ScalarBatchResult,
} from './scalar-compile.js';
import {
  SCALAR_BATCH_MESSAGE_PREFIX,
  type ScalarBatchTask,
  type ScalarBatchTaskItem,
  type ScalarBatchTaskResult,
  type ScalarBatchTaskTape,
} from './scalar-batch-task.js';

/**
 * Smallest row count that is sent to workers. 100 is the `n` from which the M3 tape beats
 * the per-row interpreter in every run of the `scalar` benchmark (`docs/BENCHMARK_RESULTS.md`,
 * section "`evaluateScalar` vs `compileScalar` (M3 batch evaluator) - 2026-10-25"). That
 * table compares the two evaluators on the caller thread; it did not time a worker round
 * trip, so this is the plan's floor for using the pool and not a measured break-even. The
 * pool is opt-in, and nothing here claims a speed-up.
 */
export const SCALAR_PARALLEL_MIN_ROWS = 100;

/** Timeout applied to every worker call when the caller does not choose one. */
export const DEFAULT_SCALAR_PARALLEL_TIMEOUT_MS = 30_000;

/** URL of the built worker, a sibling of the module that contains this code. */
export function resolveScalarBatchWorkerScript(): string {
  return new URL('./scalar-batch.worker.js', import.meta.url).href;
}

/** Starts the pool that {@link evaluateScalarPopulation} uses when it is not given one. */
export function createScalarBatchPool(): WorkerPool {
  return new WorkerPool(resolveScalarBatchWorkerScript());
}

/** How to run a population on workers. */
export interface ScalarPopulationParallelOptions {
  /**
   * Milliseconds a worker call may take, queueing included, before it is cancelled, the
   * worker replaced and the evaluation rejected. Must be positive: `0` would switch the
   * pool's timeout off. Default 30000.
   */
  readonly timeoutMs?: number;
  /** A pool to use, which the caller owns and terminates. Default: one for the call. */
  readonly pool?: Pick<WorkerPool, 'execute'>;
}

export interface ScalarPopulationEvalItem {
  /** Returned unchanged with the result. */
  readonly index: number;
  readonly node: ScalarNode;
  readonly params?: ArrayLike<number>;
}

export interface EvaluateScalarPopulationOptions extends CompileScalarOptions {
  readonly columns: readonly Float64Array[];
  readonly items: readonly ScalarPopulationEvalItem[];
  readonly parallel?: ScalarPopulationParallelOptions;
}

export interface ScalarPopulationEvalResult {
  readonly index: number;
  readonly batch: ScalarBatchResult;
}

/** Positive, finite timeout, or a `RangeError`: a zero would silently disable the guard. */
export function resolveParallelTimeout(timeoutMs: number | undefined): number {
  const value = timeoutMs ?? DEFAULT_SCALAR_PARALLEL_TIMEOUT_MS;
  if (!(Number.isFinite(value) && value > 0)) {
    throw new RangeError(`parallel.timeoutMs must be a finite number > 0, got ${value}`);
  }
  return value;
}

function defaultWorkerCount(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return Math.max(2, navigator.hardwareConcurrency - 1);
  }
  return 4;
}

/** Splits `items` into at most `chunks` runs of consecutive items whose sizes differ by at most 1. */
function partition<T>(items: readonly T[], chunks: number): T[][] {
  const k = Math.min(Math.max(1, chunks), items.length);
  const base = Math.floor(items.length / k);
  let extra = items.length % k;
  const out: T[][] = [];
  let start = 0;
  for (let c = 0; c < k; c += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    extra -= extra > 0 ? 1 : 0;
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

function evaluateSerial(options: EvaluateScalarPopulationOptions): ScalarPopulationEvalResult[] {
  const compileOptions: CompileScalarOptions = {
    variables: options.variables,
    parameters: options.parameters,
    constants: options.constants,
  };
  const probe = new Float64Array(compileOptions.parameters?.length ?? 0).fill(1);
  const tapeFor = createBatchTapeCache(
    probe,
    (node) => compileScalar(node, compileOptions),
    (compiled, params) => compiled.evaluate(options.columns, params)
  );
  return options.items.map((item) => ({
    index: item.index,
    batch: tapeFor(item.node).evaluate(options.columns, item.params),
  }));
}

function taskItem(
  tapeIndex: number,
  item: ScalarPopulationEvalItem,
  position: number,
  parameters: readonly string[]
): ScalarBatchTaskItem {
  return {
    candidateIndex: position,
    tapeIndex,
    params: item.params === undefined ? [] : Array.from(item.params),
    parameters,
  };
}

/**
 * Compiles every item to a tape entry, one per distinct stored shape (SR-12). Items
 * whose stored shapes share a canonical key share one tape only when both shapes
 * evaluate `Object.is`-identically over the columns with a probe vector of ones;
 * otherwise the shape keeps its own tape. The tapes stay caller-built, exactly as
 * before, so worker results remain bit-identical to the serial batch.
 */
function buildTapeEntries(
  options: EvaluateScalarPopulationOptions,
  compileOptions: CompileScalarOptions
): { tapes: ScalarBatchTaskTape[]; indexByNode: (node: ScalarNode) => number } {
  const probe = new Float64Array(compileOptions.parameters?.length ?? 0).fill(1);
  const tapeFor = createBatchTapeCache(
    probe,
    (node) => buildTape(node, compileOptions, SCALAR_BATCH_MESSAGE_PREFIX),
    (entry, params) =>
      evaluateScalarTape(
        entry.tape,
        entry.rootReg,
        entry.nRegs,
        options.columns,
        options.variables,
        params,
        compileOptions.parameters ?? [],
        SCALAR_BATCH_MESSAGE_PREFIX
      )
  );
  const tapes: ScalarBatchTaskTape[] = [];
  const indexOfTape = new Map<ScalarBatchTaskTape, number>();
  return {
    tapes,
    indexByNode: (node) => {
      const entry = tapeFor(node);
      let index = indexOfTape.get(entry);
      if (index === undefined) {
        index = tapes.length;
        tapes.push(entry);
        indexOfTape.set(entry, index);
      }
      return index;
    },
  };
}

async function evaluateOnPool(
  pool: Pick<WorkerPool, 'execute'>,
  timeoutMs: number,
  options: EvaluateScalarPopulationOptions,
  rows: number
): Promise<ScalarPopulationEvalResult[]> {
  const compileOptions: CompileScalarOptions = {
    variables: options.variables,
    parameters: options.parameters,
    constants: options.constants,
  };
  const build = buildTapeEntries(options, compileOptions);
  const items = options.items.map((item, position) => ({
    item,
    position,
    tapeIndex: build.indexByNode(item.node),
  }));
  const variables = options.variables.slice();
  const parameters = compileOptions.parameters ?? [];
  const replies = await Promise.all(
    partition(items, defaultWorkerCount()).map((chunk) => {
      // Each message carries only the tapes its chunk references, reindexed locally,
      // so a shared tape is never shipped twice inside one message.
      const localIndex = new Map<number, number>();
      const tapes: ScalarBatchTaskTape[] = [];
      const task: ScalarBatchTask = {
        items: chunk.map(({ item, position, tapeIndex }) => {
          let local = localIndex.get(tapeIndex);
          if (local === undefined) {
            local = tapes.length;
            localIndex.set(tapeIndex, local);
            tapes.push(build.tapes[tapeIndex]!);
          }
          return taskItem(local, item, position, parameters);
        }),
        tapes,
        columns: options.columns,
        variables,
      };
      return pool.execute<ScalarBatchTask, ScalarBatchTaskResult>(task, undefined, timeoutMs);
    })
  );

  const byPosition = new Map<number, ScalarBatchResult>();
  for (const reply of replies) {
    for (const row of reply.rows) {
      if (row.values.length !== rows || row.valid.length !== rows) {
        throw new Error(
          `evaluateScalarPopulation: worker returned ${row.values.length} values for ${rows} rows`
        );
      }
      byPosition.set(row.candidateIndex, {
        values: row.values,
        valid: row.valid,
        allValid: row.allValid,
      });
    }
  }
  return options.items.map((item, position) => {
    const batch = byPosition.get(position);
    if (batch === undefined) {
      throw new Error(`evaluateScalarPopulation: no worker result for item ${position}`);
    }
    return { index: item.index, batch };
  });
}

/**
 * Evaluates every item over `columns`, in the order given.
 *
 * Without `parallel`, or with fewer than {@link SCALAR_PARALLEL_MIN_ROWS} rows, each tree
 * runs on the caller thread and no pool is touched. Otherwise the trees are compiled here,
 * split into consecutive chunks, evaluated by the workers, and put back in item order by
 * position. A pool that was not passed in is created for the call and terminated after it.
 *
 * @throws {RangeError} `parallel.timeoutMs` is not a positive finite number.
 * @throws A worker error, a timeout, or a tree that cannot be compiled.
 */
export async function evaluateScalarPopulation(
  options: EvaluateScalarPopulationOptions
): Promise<ScalarPopulationEvalResult[]> {
  const timeoutMs =
    options.parallel === undefined ? 0 : resolveParallelTimeout(options.parallel.timeoutMs);
  const matched = options.columns.length === options.variables.length;
  const rows = options.variables.length === 0 ? 1 : (options.columns[0]?.length ?? 0);
  if (
    options.parallel === undefined ||
    !matched ||
    rows < SCALAR_PARALLEL_MIN_ROWS ||
    options.items.length === 0
  ) {
    return evaluateSerial(options);
  }
  const given = options.parallel.pool;
  const pool = given ?? createScalarBatchPool();
  try {
    return await evaluateOnPool(pool, timeoutMs, options, rows);
  } finally {
    if (given === undefined) {
      await (pool as WorkerPool).terminate();
    }
  }
}

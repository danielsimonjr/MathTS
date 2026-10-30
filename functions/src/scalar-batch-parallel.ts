/**
 * Parallel batch evaluation of scalar populations over shared columns (M14).
 *
 * Threshold {@link SCALAR_PARALLEL_MIN_ROWS} = 100 rows from
 * `docs/BENCHMARK_RESULTS.md` — section `evaluateScalar` vs `compileScalar`
 * (M3 batch evaluator) — 2026-10-25 (two Node runs; batch wins at n = 100).
 *
 * @packageDocumentation
 */

import type { ScalarNode } from '@danielsimonjr/mathts-expression';
import { WorkerPool } from '@danielsimonjr/mathts-parallel';
import {
  buildTape,
  compileScalar,
  type CompileScalarOptions,
  type ScalarBatchResult,
} from './scalar-compile.js';

/** Use worker pool when row count is at least this (see module header citation). */
export const SCALAR_PARALLEL_MIN_ROWS = 100;

const DEFAULT_PARALLEL_TIMEOUT_MS = 30_000;
const COMPILE_PREFIX = 'compileScalar:';

/** Resolve the built worker script without Node built-ins (browser-safe). */
export function resolveScalarBatchWorkerScript(): string {
  const isNode = typeof process !== 'undefined' && !!process.versions?.node;
  if (!isNode) {
    return new URL('./scalar-batch.worker.js', import.meta.url).href;
  }
  return new URL('../dist/scalar-batch.worker.js', import.meta.url).href;
}

export interface ScalarPopulationEvalItem {
  readonly index: number;
  readonly node: ScalarNode;
  readonly params?: ArrayLike<number>;
}

export interface ScalarPopulationParallelOptions {
  readonly timeoutMs?: number;
  readonly pool?: Pick<WorkerPool, 'execute'>;
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

let defaultPool: WorkerPool | null = null;

function getDefaultPool(): WorkerPool {
  if (!defaultPool) {
    defaultPool = new WorkerPool(resolveScalarBatchWorkerScript());
  }
  return defaultPool;
}

function rowCount(columns: readonly Float64Array[], variables: readonly string[]): number {
  if (variables.length === 0) return 1;
  return columns[0]?.length ?? 0;
}

function defaultWorkerCount(): number {
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    return Math.max(2, navigator.hardwareConcurrency - 1);
  }
  return 4;
}

function partitionItems<T>(items: readonly T[], chunks: number): T[][] {
  const n = items.length;
  if (n === 0) return [];
  const k = Math.min(Math.max(1, chunks), n);
  const out: T[][] = [];
  const base = Math.floor(n / k);
  let rem = n % k;
  let start = 0;
  for (let c = 0; c < k; c++) {
    const size = base + (rem > 0 ? 1 : 0);
    if (rem > 0) rem--;
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

interface WorkerItemPayload {
  readonly candidateIndex: number;
  readonly tape: ReturnType<typeof buildTape>['tape'];
  readonly rootReg: number;
  readonly nRegs: number;
  readonly params: number[];
  readonly parameters: readonly string[];
}

interface WorkerPayload {
  readonly items: readonly WorkerItemPayload[];
  readonly columns: readonly Float64Array[];
  readonly variables: readonly string[];
}

interface WorkerResultRow {
  readonly candidateIndex: number;
  readonly values: Float64Array;
  readonly valid: Uint8Array;
  readonly allValid: boolean;
}

interface WorkerResult {
  readonly rows: readonly WorkerResultRow[];
}

function evaluateSerial(options: EvaluateScalarPopulationOptions): ScalarPopulationEvalResult[] {
  const compileOpts: CompileScalarOptions = {
    variables: options.variables,
    parameters: options.parameters,
    constants: options.constants,
  };
  return options.items.map((item) => {
    const compiled = compileScalar(item.node, compileOpts);
    const batch = compiled.evaluate(options.columns, item.params);
    return { index: item.index, batch };
  });
}

function buildWorkerItems(
  items: readonly ScalarPopulationEvalItem[],
  compileOpts: CompileScalarOptions
): WorkerItemPayload[] {
  return items.map((item) => {
    const { tape, rootReg, nRegs, parameters } = buildTape(item.node, compileOpts, COMPILE_PREFIX);
    const params = item.params === undefined ? [] : (Array.from(item.params) as number[]);
    return {
      candidateIndex: item.index,
      tape,
      rootReg,
      nRegs,
      params,
      parameters,
    };
  });
}

async function evaluateParallelChunk(
  pool: Pick<WorkerPool, 'execute'>,
  timeoutMs: number,
  payload: WorkerPayload
): Promise<WorkerResultRow[]> {
  const result = await pool.execute<WorkerPayload, WorkerResult>(payload, undefined, timeoutMs);
  return [...result.rows];
}

/**
 * Evaluate many scalar trees on the same column buffers. Below
 * {@link SCALAR_PARALLEL_MIN_ROWS} rows, or when `parallel` is omitted, runs
 * {@link compileScalar} on the caller thread. At or above the threshold with
 * `parallel` set, dispatches tape batches through {@link WorkerPool.execute}.
 */
export async function evaluateScalarPopulation(
  options: EvaluateScalarPopulationOptions
): Promise<ScalarPopulationEvalResult[]> {
  const nRows = rowCount(options.columns, options.variables);
  const usePool =
    options.parallel !== undefined && nRows >= SCALAR_PARALLEL_MIN_ROWS && options.items.length > 0;

  if (!usePool) {
    return evaluateSerial(options);
  }

  const timeoutMs = options.parallel!.timeoutMs ?? DEFAULT_PARALLEL_TIMEOUT_MS;
  const pool = options.parallel!.pool ?? getDefaultPool();
  const compileOpts: CompileScalarOptions = {
    variables: options.variables,
    parameters: options.parameters,
    constants: options.constants,
  };

  const workerItems = buildWorkerItems(options.items, compileOpts);
  const chunks = partitionItems(workerItems, defaultWorkerCount());
  const columns = options.columns.map((c) => new Float64Array(c));
  const variables = options.variables.slice();

  const chunkResults = await Promise.all(
    chunks.map((items) =>
      evaluateParallelChunk(pool, timeoutMs, {
        items,
        columns,
        variables,
      })
    )
  );

  const merged = new Map<number, ScalarBatchResult>();
  for (const rows of chunkResults) {
    for (const row of rows) {
      merged.set(row.candidateIndex, {
        values: row.values,
        valid: row.valid,
        allValid: row.allValid,
      });
    }
  }

  return options.items.map((item) => {
    const batch = merged.get(item.index);
    if (!batch) {
      throw new Error(`evaluateScalarPopulation: missing worker result for index ${item.index}`);
    }
    return { index: item.index, batch };
  });
}

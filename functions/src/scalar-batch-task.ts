/**
 * The unit of work that crosses to a scalar batch worker (M14), and the function that
 * does it. The worker entry and the tests both call {@link runScalarBatchTask}, so the
 * message a worker receives is evaluated by one body, on or off the main thread.
 *
 * @packageDocumentation
 */

import { evaluateScalarTape, type buildTape } from './scalar-compile.js';

/** Prefix of every error the tape evaluator throws for a batch task. */
export const SCALAR_BATCH_MESSAGE_PREFIX = 'compileScalar:';

type Tape = ReturnType<typeof buildTape>['tape'];

/** One compiled tape, shared by every task item that references it by index. */
export interface ScalarBatchTaskTape {
  readonly tape: Tape;
  readonly rootReg: number;
  readonly nRegs: number;
}

/** One tree evaluation: a tape index into `ScalarBatchTask.tapes` plus its parameters. */
export interface ScalarBatchTaskItem {
  /** Position of the tree in the caller's list; results come back under it. */
  readonly candidateIndex: number;
  /** Index into `ScalarBatchTask.tapes` of the compiled structure this tree evaluates. */
  readonly tapeIndex: number;
  readonly params: readonly number[];
  readonly parameters: readonly string[];
}

/** Several trees over the same columns; this is the message payload. */
export interface ScalarBatchTask {
  readonly items: readonly ScalarBatchTaskItem[];
  /** Distinct compiled structures, referenced by `ScalarBatchTaskItem.tapeIndex`. */
  readonly tapes: readonly ScalarBatchTaskTape[];
  readonly columns: readonly Float64Array[];
  readonly variables: readonly string[];
}

export interface ScalarBatchTaskRow {
  readonly candidateIndex: number;
  readonly values: Float64Array;
  readonly valid: Uint8Array;
  readonly allValid: boolean;
}

export interface ScalarBatchTaskResult {
  readonly rows: readonly ScalarBatchTaskRow[];
}

/** Evaluates every tree of `task` over its columns, in order. */
export function runScalarBatchTask(task: ScalarBatchTask): ScalarBatchTaskResult {
  const rows: ScalarBatchTaskRow[] = [];
  for (const item of task.items) {
    const entry = task.tapes[item.tapeIndex];
    if (entry === undefined) {
      throw new Error(`scalar-batch task: no tape for index ${item.tapeIndex}`);
    }
    const batch = evaluateScalarTape(
      entry.tape,
      entry.rootReg,
      entry.nRegs,
      task.columns,
      task.variables,
      item.params,
      item.parameters,
      SCALAR_BATCH_MESSAGE_PREFIX
    );
    rows.push({
      candidateIndex: item.candidateIndex,
      values: batch.values,
      valid: batch.valid,
      allValid: batch.allValid,
    });
  }
  return { rows };
}

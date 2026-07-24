/**
 * Shared message/result shapes between `timeout-runner.ts` (the coordinator,
 * running on the caller's thread) and `run-worker.ts` (the `worker_threads`
 * entry point that actually executes the workbook). Kept in its own module so
 * neither side needs to import the other's runtime code — the worker script
 * stays a minimal, independently loadable entry point.
 *
 * Cell outputs are pre-formatted to strings (via `formatResult`) before they
 * cross the worker boundary: `postMessage` uses the structured-clone
 * algorithm, which cannot faithfully reproduce engine class instances
 * (Complex, matrices, BigNumber, …) — it either drops their prototype or
 * throws. Formatting to a string in the worker (the same rendering every
 * other report consumer already uses) sidesteps that entirely.
 */
import type { CellResult } from './types.js';

/** A `CellResult` with its output pre-formatted to a string (or absent). */
export interface SerializedCellResult {
  id: string;
  type: CellResult['type'];
  status: CellResult['status'];
  output?: string;
  error?: string;
}

/** A `RunResult` whose cells are `SerializedCellResult`s. */
export interface SerializedRunResult {
  cells: SerializedCellResult[];
  ok: boolean;
}

export interface WorkerSuccessMessage {
  ok: true;
  report: SerializedRunResult;
}

export interface WorkerFailureMessage {
  ok: false;
  error: string;
}

/** The single message a worker posts back before exiting. */
export type WorkerMessage = WorkerSuccessMessage | WorkerFailureMessage;

/** `workerData` passed to `run-worker.ts` when it is spawned. */
export interface RunWorkerData {
  /** Raw `.mtsw` source (YAML) — the worker parses it itself. */
  source: string;
}

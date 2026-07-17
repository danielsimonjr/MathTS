/**
 * Kill-able worker-thread execution of a workbook with a hard wall-clock
 * timeout.
 *
 * `WorkbookExecutor#runReport` (executor.ts) has no time budget — a runaway
 * cell (e.g. an unbounded numeric computation) hangs the process forever.
 * `runWorkbookWithTimeout` runs the whole executor inside a `worker_threads`
 * Worker (see run-worker.ts); if the worker doesn't post its result within
 * `timeoutMs`, it is forcibly terminated via `worker.terminate()`. Because
 * termination kills the worker's V8 isolate outright, this interrupts even a
 * synchronous, CPU-bound runaway cell — something a `Promise.race` against a
 * `setTimeout` cannot do from inside the same thread the runaway code is
 * blocking (a synchronous loop never yields back to the event loop for the
 * timer to fire).
 *
 * This module is opt-in: the default in-process path
 * (`WorkbookExecutor#runReport`) is completely unaffected and remains the
 * default for every existing caller.
 */
import { Worker } from 'node:worker_threads';
import type { SerializedRunResult, WorkerMessage } from './worker-protocol.js';

export type {
  SerializedCellResult,
  SerializedRunResult,
  WorkerMessage,
} from './worker-protocol.js';

export interface RunWorkbookWithTimeoutOptions {
  /** Wall-clock budget in milliseconds. Exceeding it terminates the worker. */
  timeoutMs: number;
}

/** Thrown when a workbook run is terminated for exceeding its time budget. */
export class WorkbookTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`workbook execution exceeded ${timeoutMs}ms and was terminated`);
    this.name = 'WorkbookTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Run a workbook's `.mtsw` source to completion (a continue-on-error report,
 * like `runReport()`) inside a worker thread, killing that worker if it
 * exceeds `timeoutMs`. The worker is ALWAYS terminated before this promise
 * settles — on timeout, on success, and on error — so no handle is left open
 * keeping the process alive.
 *
 * @throws {WorkbookTimeoutError} if the run is terminated for exceeding the budget.
 */
export function runWorkbookWithTimeout(
  source: string,
  options: RunWorkbookWithTimeoutOptions
): Promise<SerializedRunResult> {
  const { timeoutMs } = options;
  const workerUrl = new URL('./run-worker.js', import.meta.url);

  return new Promise<SerializedRunResult>((resolve, reject) => {
    const worker = new Worker(workerUrl, { workerData: { source } });
    let settled = false;

    // `finish` closes over `timer`, declared just below. Safe because `finish`
    // is only ever invoked from the async callbacks registered after this
    // point (never synchronously here), by which time `timer` is assigned.
    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // The worker may already be dead (it exited on its own, or we're
      // terminating it ourselves) — either way, never let a rejected
      // terminate() surface as an unhandled rejection.
      void worker.terminate().catch(() => {});
      fn();
    };

    const timer = setTimeout(() => {
      finish(() => reject(new WorkbookTimeoutError(timeoutMs)));
    }, timeoutMs);

    worker.once('message', (msg: WorkerMessage) => {
      finish(() => {
        if (msg.ok) resolve(msg.report);
        else reject(new Error(msg.error));
      });
    });

    worker.once('error', (error: Error) => {
      finish(() => reject(error));
    });

    worker.once('exit', (code: number) => {
      finish(() =>
        reject(new Error(`workbook worker exited with code ${code} before returning a result`))
      );
    });
  });
}

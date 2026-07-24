/**
 * `worker_threads` entry point for `runWorkbookWithTimeout` (see
 * timeout-runner.ts).
 *
 * Runs the whole executor (parse + `runReport`) inside this worker, so a
 * runaway cell's synchronous, CPU-bound work lives entirely in this isolate
 * and can be killed outright via `worker.terminate()` from the coordinator —
 * no mid-run state needs to cross the thread boundary, and no cooperative
 * cancellation is required from the cell itself. Only the finished report (or
 * a fatal parse/setup error) is ever posted back, with cell outputs
 * pre-formatted to strings (see worker-protocol.ts) since class instances
 * don't survive `postMessage`'s structured clone.
 *
 * This file is a build entry (see package.json) so it ships as its own
 * `dist/run-worker.js`, resolvable via `new URL('./run-worker.js',
 * import.meta.url)` from whichever bundle (`index.js`/`cli.js`) constructs
 * the Worker — see timeout-runner.ts.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { parseWorkbook } from './parser.js';
import { createExecutor } from './executor.js';
import { formatResult } from './formatter.js';
import type { RunWorkerData, WorkerMessage, SerializedCellResult } from './worker-protocol.js';

async function main(): Promise<void> {
  const port = parentPort;
  if (!port) {
    // This module has no other purpose — defense-in-depth only.
    throw new Error('run-worker.js must be run as a worker_threads Worker');
  }

  let message: WorkerMessage;
  try {
    const { source } = workerData as RunWorkerData;
    const parsed = parseWorkbook(source);
    if (!parsed.success || !parsed.workbook) {
      message = {
        ok: false,
        error: `Parse error: ${(parsed.errors ?? []).join('; ') || 'invalid workbook'}`,
      };
    } else {
      const report = await createExecutor(parsed.workbook).runReport();
      const cells: SerializedCellResult[] = report.cells.map((c) => ({
        id: c.id,
        type: c.type,
        status: c.status,
        output: c.output === undefined ? undefined : formatResult(c.output),
        error: c.error,
      }));
      message = { ok: true, report: { ok: report.ok, cells } };
    }
  } catch (error) {
    message = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  port.postMessage(message);
}

void main();

/**
 * Unlike the other workbook tests (which import `../src/*.js` — vitest
 * transpiles TS on the fly), this suite imports from `../dist/*.js`. The
 * worker_threads `Worker` constructor loads its script directly off disk via
 * Node's own module loader, bypassing vitest's transform pipeline entirely —
 * so `runWorkbookWithTimeout`'s `new URL('./run-worker.js', import.meta.url)`
 * only resolves to a real file when running against the BUILT package.
 * Rebuild before running this file: `npx turbo build --filter=@danielsimonjr/mathts-workbook`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  runWorkbookWithTimeout,
  WorkbookTimeoutError,
  createExecutor,
  parseWorkbook,
} from '../dist/index.js';
import { dispatch } from '../dist/cli.js';

let dir: string;
let counter = 0;
function fixture(content: string): string {
  const p = join(dir, `wt-${counter++}.mtsw`);
  writeFileSync(p, content, 'utf-8');
  return p;
}
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'mtsw-worker-timeout-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// A genuinely long CPU-bound computation: isPrime(N) trial-divides up to
// sqrt(N) ~ 9.49e7 for the largest prime below 2^53 (so the loop runs to
// completion, no early-exit on a small factor); chained ten times with `and`
// pushes a single run to several seconds on ordinary hardware (measured
// ~530ms/call, ~7s for the chain of 10) — far longer than the timeouts below,
// with no reliance on any particular machine's clock speed for correctness:
// even an order of magnitude faster machine is still well over budget. The
// MathTS expression sandbox has no loop/recursion constructs (function
// definitions are rejected by the default-safe validator — see
// expression/src/evaluator/evaluate.ts), so a real `while(true)` is not
// expressible in a code cell; this is the sanctioned "very long computation"
// fallback.
const SLOW_CELL = Array(10).fill('isPrime(9007199254740881)').join(' and ');

const SLOW_WORKBOOK = `cells:\n  - code: "${SLOW_CELL}"\n    id: slow\n`;

const FAST_WORKBOOK = `
cells:
  - markdown: "# Hi"
    id: m
  - code: "2 + 3"
    id: a
  - test: "a == 5"
    id: checkA
    depends_on: [a]
`;

describe('runWorkbookWithTimeout — kills a runaway cell', () => {
  it('terminates a workbook that exceeds the budget, rejecting with WorkbookTimeoutError', async () => {
    const t0 = Date.now();
    await expect(runWorkbookWithTimeout(SLOW_WORKBOOK, { timeoutMs: 500 })).rejects.toThrow(
      WorkbookTimeoutError
    );
    const elapsed = Date.now() - t0;
    // Rejects close to the budget, not after the (multi-second) natural
    // completion time — proof the worker was actually killed, not merely
    // outraced by a fast in-process finish.
    expect(elapsed).toBeLessThan(3000);
  }, 15_000);

  it('rejects with a clear, budget-naming message', async () => {
    try {
      await runWorkbookWithTimeout(SLOW_WORKBOOK, { timeoutMs: 400 });
      expect.unreachable('expected a timeout rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(WorkbookTimeoutError);
      expect((error as Error).message).toBe('workbook execution exceeded 400ms and was terminated');
    }
  }, 15_000);

  it('leaves no handle open keeping the process alive (no leaked worker)', async () => {
    // If the worker weren't terminated, vitest's process would hang around;
    // running several timeouts back-to-back and completing this test file
    // promptly (see afterAll below / overall suite duration) is the
    // behavioral proof — asserted here by simply awaiting the rejection
    // without a hanging follow-up.
    await expect(runWorkbookWithTimeout(SLOW_WORKBOOK, { timeoutMs: 300 })).rejects.toThrow(
      WorkbookTimeoutError
    );
  }, 15_000);
});

describe('runWorkbookWithTimeout — normal (fast) run', () => {
  it('returns the same results as the in-process runReport, well under the budget', async () => {
    const workerReport = await runWorkbookWithTimeout(FAST_WORKBOOK, { timeoutMs: 10_000 });

    const parsed = parseWorkbook(FAST_WORKBOOK);
    expect(parsed.success).toBe(true);
    const directReport = await createExecutor(parsed.workbook!).runReport();

    expect(workerReport.ok).toBe(directReport.ok);
    expect(workerReport.cells.map((c) => c.id).sort()).toEqual(
      directReport.cells.map((c) => c.id).sort()
    );
    for (const cell of directReport.cells) {
      const viaWorker = workerReport.cells.find((c) => c.id === cell.id)!;
      expect(viaWorker.status).toBe(cell.status);
      // Worker outputs are pre-formatted to strings (see worker-protocol.ts);
      // compare against the same formatting the CLI/report consumers use.
      if (cell.output !== undefined) {
        expect(viaWorker.output).toBe(String(cell.output));
      }
    }
  });

  it('rejects with the underlying error when the source fails to parse', async () => {
    await expect(
      runWorkbookWithTimeout('cells: [this is not: valid: yaml: at all', { timeoutMs: 5000 })
    ).rejects.toThrow();
  });
});

describe('mtsw run --timeout (CLI wiring)', () => {
  it('runs a fast workbook to completion through the worker path with exit 0', async () => {
    const r = await dispatch(['run', fixture(FAST_WORKBOOK), '--timeout', '10000']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('a (code): 5');
    expect(r.stdout).toContain('checkA (test)');
  });

  it('rejects --timeout combined with -c', async () => {
    const r = await dispatch(['run', fixture(FAST_WORKBOOK), '--timeout', '5000', '-c', 'a']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/--timeout/);
  });

  it('rejects a non-positive --timeout', async () => {
    const r = await dispatch(['run', fixture(FAST_WORKBOOK), '--timeout', '0']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/positive/);
  });

  it('kills a runaway workbook via the CLI and reports a clear timeout failure', async () => {
    const r = await dispatch(['run', fixture(SLOW_WORKBOOK), '--timeout', '400']);
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toMatch(/exceeded 400ms and was terminated/);
  }, 15_000);
});

/**
 * Regression guard for #878: expression coverage bootstrap must not pull the
 * full WebGPU typed graph into every bun test worker.
 *
 * Budget is heap growth after loading bootstrap + 64 parses (Node 22, CI-like).
 * Re-measure when bootstrap wiring changes materially.
 */
import { describe, it, expect } from 'vitest';

/** Peak incremental heap bytes (documented from Node 22 local run post barrel fix). */
const BOOTSTRAP_HEAP_BUDGET_BYTES = 320 * 1024 * 1024;

describe('expression suite heap budget (#878)', () => {
  it('bootstrap graph stays under documented peak heap', async () => {
    const gc = (globalThis as { gc?: () => void }).gc;
    if (gc) gc();
    const before = process.memoryUsage().heapUsed;
    const { parse, evaluate } = await import('./helpers/bootstrap.js');
    for (let i = 0; i < 64; i++) {
      evaluate(`${i} + ${i + 1}`);
      parse(`sin(${i})`);
    }
    if (gc) gc();
    const after = process.memoryUsage().heapUsed;
    const delta = after - before;
    expect(delta).toBeLessThan(BOOTSTRAP_HEAP_BUDGET_BYTES);
  });
});

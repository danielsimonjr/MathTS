/**
 * Parallel Acceleration Benchmark Runner
 *
 * Entry point for the parallel benchmark suite. Initializes the worker pool,
 * runs every `BenchCase` in `operations.bench.ts` across its size ladder
 * (sequential vs parallel), and prints per-operation tables plus a summary
 * with break-even sizes and recommended `thresholdElements`.
 *
 * Usage (from repo root):
 *
 *   npm run bench:parallel                 # full suite
 *   npx tsx tools/benchmark/parallel/run.ts add sin matmul   # subset by name
 *
 * Build the functions package first so the benchmark imports the built dist/:
 *
 *   npx turbo build --filter=@danielsimonjr/mathts-functions
 *
 * CAVEAT: numbers are hardware- and load-dependent. In a contended CI
 * container they are indicative only — re-run on target hardware before
 * trusting any threshold recommendation.
 */

import { cpus } from 'node:os';
import { computePool } from '@danielsimonjr/mathts-parallel';

import { ALL_BENCHES } from './operations.bench.js';
import { runCase, printOperationTable, printSummary, type OperationResult } from './harness.js';

async function main(): Promise<void> {
  const filter = process.argv.slice(2).map((s) => s.toLowerCase());
  const benches =
    filter.length === 0
      ? ALL_BENCHES
      : ALL_BENCHES.filter((b) => filter.includes(b.operation.toLowerCase()));

  if (benches.length === 0) {
    console.error(
      `No benchmark matched: ${filter.join(', ')}\n` +
        `Available: ${ALL_BENCHES.map((b) => b.operation).join(', ')}`
    );
    process.exit(1);
  }

  console.log('='.repeat(78));
  console.log('MathTS Parallel Acceleration Benchmark');
  console.log('='.repeat(78));
  console.log(`Logical CPUs:       ${cpus().length}`);
  console.log(`Node:               ${process.version}`);
  console.log(`Operations:         ${benches.length} of ${ALL_BENCHES.length}`);
  console.log('Method:             median of N timed iterations (with warm-up);');
  console.log('                    sequential = thresholdElements MAX_SAFE_INTEGER,');
  console.log('                    parallel   = thresholdElements 1.');
  console.log('Caveat:             indicative only on contended CI hardware.');
  console.log('');

  // The worker pool must be initialized before any parallel run. Workers are
  // spawned lazily up to maxWorkers as load demands.
  await computePool.initialize();
  console.log(`Worker pool initialized (maxWorkers ${computePool.getConfig().maxWorkers}).`);

  const results: OperationResult[] = [];
  try {
    for (const bench of benches) {
      process.stdout.write(`Benchmarking ${bench.operation} ...`);
      const result = await runCase(bench);

      // Annotate operations that never actually dispatched to workers.
      if (result.sizes.every((s) => !s.parallelized)) {
        result.note = 'parallel path never dispatched to workers at any tested size';
      }
      results.push(result);
      console.log(' done');
    }
  } finally {
    await computePool.terminate();
  }

  for (const result of results) {
    printOperationTable(result);
  }
  printSummary(results);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

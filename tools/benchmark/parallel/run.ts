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
 *   npx tsx tools/benchmark/parallel/run.ts --json            # also write results.json
 *   npx tsx tools/benchmark/parallel/run.ts matmul --json=out.json  # subset + custom path
 *
 * Build the functions package first so the benchmark imports the built dist/:
 *
 *   npx turbo build --filter=@danielsimonjr/mathts-functions
 *
 * CAVEAT: numbers are hardware- and load-dependent. In a contended CI
 * container they are indicative only — re-run on target hardware before
 * trusting any threshold recommendation.
 */

import { writeFileSync } from 'node:fs';
import { arch, cpus, platform } from 'node:os';
import { computePool } from '@danielsimonjr/mathts-parallel';

import { ALL_BENCHES } from './operations.bench.js';
import { runCase, printOperationTable, printSummary, type OperationResult } from './harness.js';
import { buildBenchReport } from './report.js';

const DEFAULT_JSON_PATH = 'tools/benchmark/parallel/results.json';

async function main(): Promise<void> {
  // Split `--json` / `--json=<path>` (machine-readable artifact for the WS-2
  // threshold retune) from the positional operation-name filter.
  const argv = process.argv.slice(2);
  const jsonArg = argv.find((a) => a === '--json' || a.startsWith('--json='));
  const jsonPath = jsonArg
    ? jsonArg.includes('=')
      ? jsonArg.slice(jsonArg.indexOf('=') + 1)
      : DEFAULT_JSON_PATH
    : null;
  const filter = argv.filter((a) => a !== jsonArg).map((s) => s.toLowerCase());
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

  if (jsonPath) {
    const report = buildBenchReport(results, {
      generated: new Date().toISOString(),
      machine: {
        logicalCpus: cpus().length,
        node: process.version,
        arch: arch(),
        platform: platform(),
      },
    });
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\nWrote machine-readable report: ${jsonPath}`);
    console.log('  (per-op `recommendedThreshold` feeds the WS-2 DEFAULT_THRESHOLD_BY_OP retune)');
  }
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});

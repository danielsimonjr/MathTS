/**
 * Hypothesis Test Parallel Dispatch Benchmark (Slice 3.10)
 *
 * Measures sequential-vs-parallel wall-clock time for the four hypothesis
 * tests at sample sizes sweeping from below to well above the 4096-element
 * worker-dispatch threshold:
 *
 *  - chiSquareTest (1D): element-wise (o-e)²/e reduction via applyKernel2 + sum
 *  - kolmogorovSmirnovTest: sort on main thread, CDF evaluation via applyKernel
 *  - mannWhitneyTest: sort on main thread, rank-sum via parallel dot
 *  - shapiroWilkTest: sort on main thread, W-numerator via parallel dot
 *
 * Run manually (no npm script registered — per Slice 3.10 guidance):
 *
 *   npx turbo build --filter=@danielsimonjr/mathts-functions
 *   npx tsx tools/benchmark/parallel/hypothesis.bench.ts
 *
 * Notes
 * -----
 * - shapiroWilkTest is capped at 5000 observations by the algorithm.
 * - kolmogorovSmirnovTest and mannWhitneyTest do not have an algorithmic cap
 *   but the benchmark caps them at 32 768 to keep runtime reasonable.
 * - chiSquareTest (1D) is the only test where the post-sort work is all
 *   element-wise; it is expected to benefit the most from parallelism.
 * - For the sort-dominated tests (KS/MW/SW), the sort stays on the main
 *   thread and only the post-sort linear algebra is dispatched, so speedup
 *   is bounded by Amdahl's law on the non-sort fraction.
 *
 * Usage:
 *   npx tsx tools/benchmark/parallel/hypothesis.bench.ts [chiSquareTest] [kolmogorovSmirnovTest] ...
 */

import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  chiSquareTest,
  kolmogorovSmirnovTest,
  mannWhitneyTest,
  shapiroWilkTest,
} from '@danielsimonjr/mathts-functions';

import { runCase, printOperationTable, printSummary, type BenchCase } from './harness.js';
import type { OperationResult } from './harness.js';

// ---------------------------------------------------------------------------
// Input generators
// ---------------------------------------------------------------------------

/** Seeded LCG pseudo-random number generator (reproducible). */
function lcgRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function uniformArray(n: number, seed = 42): number[] {
  const rand = lcgRand(seed);
  return Array.from({ length: n }, () => rand());
}

function normalArray(n: number, seed = 42): number[] {
  const rand = lcgRand(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u1 = rand() || 1e-15;
    const u2 = rand();
    const mag = Math.sqrt(-2 * Math.log(u1));
    out.push(mag * Math.cos(2 * Math.PI * u2));
    if (out.length < n) out.push(mag * Math.sin(2 * Math.PI * u2));
  }
  return out.slice(0, n);
}

// ---------------------------------------------------------------------------
// Benchmark cases
// ---------------------------------------------------------------------------

// chiSquareTest: sizes from 512 (below threshold) to 32 768 (8× threshold)
const SIZES_CHI = [512, 1024, 2048, 4096, 8192, 16384, 32768];

const chiSquareBench: BenchCase = {
  operation: 'chiSquareTest',
  category: 'hypothesis',
  sizeUnit: 'categories',
  sizes: SIZES_CHI,
  label: (n) => `${n}`,
  iterations: (n) => (n >= 16384 ? 5 : n >= 4096 ? 10 : 15),
  run: async (n: number) => {
    const rand = lcgRand(n); // deterministic per size
    const observed = Array.from({ length: n }, () => Math.floor(rand() * 100) + 1);
    const expected = new Array(n).fill(50);
    return chiSquareTest(observed, expected);
  },
};

// kolmogorovSmirnovTest: sizes 512 to 16 384 (well above sort dominance)
const SIZES_KS = [512, 1024, 2048, 4096, 8192, 16384];

const ksBench: BenchCase = {
  operation: 'kolmogorovSmirnovTest',
  category: 'hypothesis',
  sizeUnit: 'observations',
  sizes: SIZES_KS,
  label: (n) => `${n}`,
  iterations: (n) => (n >= 8192 ? 5 : n >= 2048 ? 10 : 15),
  run: async (n: number) => {
    const sample = normalArray(n, n);
    return kolmogorovSmirnovTest(sample);
  },
};

// mannWhitneyTest: combined size = n1 + n2; half each
const SIZES_MW = [512, 1024, 2048, 4096, 8192, 16384];

const mwBench: BenchCase = {
  operation: 'mannWhitneyTest',
  category: 'hypothesis',
  sizeUnit: 'combined elements',
  sizes: SIZES_MW,
  label: (n) => `${n} (${n / 2}+${n / 2})`,
  iterations: (n) => (n >= 8192 ? 5 : n >= 2048 ? 10 : 15),
  run: async (n: number) => {
    const half = n / 2;
    const s1 = uniformArray(half, n);
    const s2 = uniformArray(half, n + 1);
    return mannWhitneyTest(s1, s2);
  },
};

// shapiroWilkTest: capped at 5000 by algorithm; sizes up to 4096 (the threshold)
const SIZES_SW = [256, 512, 1024, 2048, 4096];

const swBench: BenchCase = {
  operation: 'shapiroWilkTest',
  category: 'hypothesis',
  sizeUnit: 'observations',
  sizes: SIZES_SW,
  label: (n) => `${n}`,
  iterations: (n) => (n >= 2048 ? 10 : 15),
  run: async (n: number) => {
    const sample = normalArray(n, n);
    return shapiroWilkTest(sample);
  },
};

const ALL_HYPOTHESIS_BENCHES: BenchCase[] = [chiSquareBench, ksBench, mwBench, swBench];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const filter = process.argv.slice(2).map((s) => s.toLowerCase());
  const benches =
    filter.length === 0
      ? ALL_HYPOTHESIS_BENCHES
      : ALL_HYPOTHESIS_BENCHES.filter((b) => filter.includes(b.operation.toLowerCase()));

  if (benches.length === 0) {
    const available = ALL_HYPOTHESIS_BENCHES.map((b) => b.operation).join(', ');
    console.error(`No benchmark matched: ${filter.join(', ')}\nAvailable: ${available}`);
    process.exit(1);
  }

  console.log('='.repeat(78));
  console.log('MathTS Hypothesis Tests — Parallel Dispatch Benchmark (Slice 3.10)');
  console.log('='.repeat(78));
  console.log(`Node:       ${process.version}`);
  console.log(`Operations: ${benches.length} of ${ALL_HYPOTHESIS_BENCHES.length}`);
  console.log('Method:     median of N iterations; seq = MAX_SAFE_INT threshold,');
  console.log('            par = threshold 1 (always dispatch).');
  console.log('Note:       Sort always stays on the main thread for KS/MW/SW; only the');
  console.log('            post-sort linear computation is parallelised. Speedup is');
  console.log('            bounded by the non-sort fraction (Amdahl).');
  console.log('');

  await computePool.initialize();
  console.log(`Worker pool initialized (maxWorkers ${computePool.getConfig().maxWorkers}).`);
  console.log('');

  const results: OperationResult[] = [];
  try {
    for (const bench of benches) {
      process.stdout.write(`Benchmarking ${bench.operation} ...`);
      const result = await runCase(bench);
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

  console.log('');
  console.log('Slice 3.10 findings:');
  console.log('  chiSquareTest: applyKernel2 reduction — expect speedup at ≥ 4096 categories.');
  console.log('  kolmogorovSmirnovTest: applyKernel (normal CDF) — minor; sort dominates.');
  console.log('  mannWhitneyTest: dot(ranks, indicator) — minor; sort dominates.');
  console.log('  shapiroWilkTest: dot(a, sorted) — minor; sort and coeff computation dominate.');
  console.log('');
  console.log('If KS/MW/SW show no reliable speedup, the per-op threshold can be set to');
  console.log('  "never" in DEFAULT_THRESHOLD_BY_OP (ComputePool.ts) without changing the');
  console.log('  function signatures (chiSquareTest will still win).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Integration Ops Parallel Acceleration Benchmark
 *
 * Measures worker-dispatch speedup for the four numerical integration ops at a
 * geometric range of input sizes, comparing the sequential and parallel paths.
 *
 * Ops covered:
 *  - trapzF64   — trapezoidal summation over a Float64Array
 *  - simpsonF64 — Simpson weighted-sum over a Float64Array
 *  - gaussQuad  — composite Gauss-Legendre dot-product reduction
 *  - romberg    — adaptive Romberg integration with parallel summation
 *
 * Worker dispatch thresholds (defined in functions/src/typed/integration.ts):
 *  - trapzF64 / simpsonF64: ARRAY_WORKER_THRESHOLD = 65,536 elements
 *  - gaussQuad / romberg:   GAUSS_WORKER_THRESHOLD = 64 sub-intervals
 *
 * Usage (from repo root — build first):
 *
 *   npx turbo build --filter=@danielsimonjr/mathts-functions
 *   npx tsx tools/benchmark/parallel/integration.bench.ts
 *
 * CAVEAT: numbers are hardware- and load-dependent; re-run on target hardware.
 */

import { computePool } from '@danielsimonjr/mathts-parallel';
import {
  trapzF64,
  simpsonF64,
  gaussQuad,
  romberg,
  GAUSS_WORKER_THRESHOLD,
  ARRAY_WORKER_THRESHOLD,
} from '@danielsimonjr/mathts-functions';

import {
  runCase,
  printOperationTable,
  printSummary,
  type BenchCase,
  type OperationResult,
} from './harness.js';

// ---------------------------------------------------------------------------
// BenchCase definitions
// ---------------------------------------------------------------------------

/** Sizes for trapzF64 / simpsonF64 (element count in the y-array). */
const ARRAY_SIZES = [4_096, 16_384, 65_536, 131_072, 524_288].map((n) => n);

const trapzF64Bench: BenchCase = {
  operation: 'trapzF64',
  category: 'integration',
  sizeUnit: 'elements',
  sizes: ARRAY_SIZES,
  run: async (size: number) => {
    const ys = new Float64Array(size);
    const dx = Math.PI / (size - 1);
    for (let i = 0; i < size; i++) ys[i] = Math.sin((i * Math.PI) / (size - 1));
    return trapzF64(ys, dx);
  },
};

const simpsonF64Bench: BenchCase = {
  operation: 'simpsonF64',
  category: 'integration',
  sizeUnit: 'elements',
  // Simpson requires an odd number of points (even sub-intervals)
  sizes: ARRAY_SIZES.map((n) => (n % 2 === 0 ? n + 1 : n)),
  run: async (size: number) => {
    // Ensure odd point count (even sub-intervals)
    const pts = size % 2 === 0 ? size + 1 : size;
    const ys = new Float64Array(pts);
    const dx = Math.PI / (pts - 1);
    for (let i = 0; i < pts; i++) ys[i] = Math.sin((i * Math.PI) / (pts - 1));
    return simpsonF64(ys, dx);
  },
};

/** Sub-interval counts for gaussQuad composite mode. */
const GAUSS_SIZES = [16, 32, 64, 128, 512, 2048];

const gaussQuadBench: BenchCase = {
  operation: 'gaussQuad (composite)',
  category: 'integration',
  sizeUnit: 'sub-intervals',
  sizes: GAUSS_SIZES,
  label: (n: number) => `n=${n}`,
  run: async (n: number) => {
    // Use a non-trivial integrand
    return Promise.resolve(gaussQuad(Math.sin, 0, Math.PI, n));
  },
  iterations: (n: number) => (n <= 64 ? 50 : n <= 512 ? 20 : 10),
};

const rombergBench: BenchCase = {
  operation: 'romberg',
  category: 'integration',
  sizeUnit: 'tolerance-exp',
  sizes: [1e-4, 1e-6, 1e-8, 1e-10, 1e-12],
  label: (tol: number) => `tol=${tol.toExponential(0)}`,
  run: async (tol: number) => {
    return romberg(Math.sin, 0, Math.PI, tol);
  },
  iterations: () => 10,
};

export const ALL_INTEGRATION_BENCHES: BenchCase[] = [
  trapzF64Bench,
  simpsonF64Bench,
  gaussQuadBench,
  rombergBench,
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('='.repeat(78));
  console.log('MathTS Integration Ops Parallel Benchmark');
  console.log('='.repeat(78));
  console.log(`GAUSS_WORKER_THRESHOLD : ${GAUSS_WORKER_THRESHOLD} sub-intervals`);
  console.log(`ARRAY_WORKER_THRESHOLD : ${ARRAY_WORKER_THRESHOLD} elements`);
  console.log('');

  await computePool.initialize();

  const filter = process.argv.slice(2).map((s) => s.toLowerCase());
  const benches =
    filter.length === 0
      ? ALL_INTEGRATION_BENCHES
      : ALL_INTEGRATION_BENCHES.filter((b) =>
          filter.some((f) => b.operation.toLowerCase().includes(f))
        );

  const results: OperationResult[] = [];
  for (const bench of benches) {
    const result = await runCase(bench);
    printOperationTable(result);
    results.push(result);
  }

  printSummary(results);

  await computePool.terminate();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

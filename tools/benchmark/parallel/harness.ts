/**
 * Parallel Acceleration Benchmark Harness
 *
 * Reusable timing harness for measuring the worker-pool parallel acceleration
 * (`@danielsimonjr/mathts-parallel`'s `ComputePool`) against the sequential
 * baseline, across a geometric range of input sizes.
 *
 * The two execution paths are forced as follows:
 *
 *  - **sequential**: `computePool.updateConfig({ thresholdElements:
 *    Number.MAX_SAFE_INTEGER })`. Every operation falls back to its on-thread
 *    sequential implementation because no input ever exceeds the threshold.
 *  - **parallel**: `computePool.updateConfig({ thresholdElements: <low> })`.
 *    Operations dispatch their large `Float64Array` / large-matrix work to the
 *    worker pool.
 *
 * Timing uses `performance.now()`, a warm-up phase, and several timed
 * iterations; the **median** is reported (robust against scheduler jitter in
 * a noisy CI container).
 *
 * This module is the durable deliverable — the one-time numbers it produces
 * are a hardware-specific snapshot. Re-run on target hardware for authoritative
 * thresholds.
 */

import { computePool } from '@danielsimonjr/mathts-parallel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One (size, sequential, parallel) measurement for a single operation. */
export interface SizeResult {
  /** Reported input size — element count, matrix dimension, or point count. */
  size: number;
  /** Human-readable label for the size axis (e.g. "1e5" or "256x256"). */
  sizeLabel: string;
  /** Median sequential wall-clock time (ms). */
  seqMs: number;
  /** Median parallel wall-clock time (ms). */
  parMs: number;
  /** seqMs / parMs. > 1 means parallel is faster. */
  speedup: number;
  /** Whether the parallel run actually dispatched to workers. */
  parallelized: boolean;
  /** Number of chunks the parallel run split into (0 if not parallelized). */
  chunks: number;
}

/** Full result set for one benchmarked operation. */
export interface OperationResult {
  /** Operation name, e.g. "add", "matmul", "parallelFFT". */
  operation: string;
  /** Category for grouping in the report. */
  category: string;
  /** What the `size` field counts ("elements", "matrix dim", "points"). */
  sizeUnit: string;
  /** Per-size measurements, in ascending size order. */
  sizes: SizeResult[];
  /**
   * Smallest tested size from which parallel beats sequential *and continues
   * to win* at every larger tested size, or `null` if no such size exists
   * (parallel never reliably faster). A non-persistent one-off win does not
   * count — see `runCase`.
   */
  breakEvenSize: number | null;
  /** Optional note (e.g. "never parallelized — below pool threshold"). */
  note?: string;
}

/** A benchmark case: produces fresh inputs and runs the op for a given size. */
export interface BenchCase {
  operation: string;
  category: string;
  sizeUnit: string;
  /** Geometric ladder of sizes to sweep. */
  sizes: number[];
  /** Optional per-size label override (defaults to scientific notation). */
  label?: (size: number) => string;
  /**
   * Run the operation once at the given size. The harness calls this in both
   * the sequential and parallel configurations; the function itself does not
   * need to know which mode it is in — only `thresholdElements` differs.
   *
   * Implementations should allocate inputs *inside* this callback (or accept
   * pre-allocated inputs via a closure) and must `await` the operation so the
   * timer captures the full cost.
   */
  run: (size: number) => Promise<unknown>;
  /**
   * Optional iteration-count override for a given size. Large sizes are
   * expensive, so fewer iterations are used; the default policy is in
   * `defaultIterations`.
   */
  iterations?: (size: number) => number;
}

// ---------------------------------------------------------------------------
// Timing primitives
// ---------------------------------------------------------------------------

/** Median of a numeric sample (robust central tendency). */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Default iteration policy: more iterations for cheap (small) inputs, fewer
 * for expensive ones. Keeps each operation's total runtime bounded.
 */
export function defaultIterations(size: number): number {
  if (size <= 1e3) return 25;
  if (size <= 1e4) return 15;
  if (size <= 1e5) return 9;
  if (size <= 1e6) return 5;
  return 3;
}

/**
 * Time an async function: `warmup` untimed runs, then `iterations` timed runs.
 * Returns the median wall-clock time in milliseconds.
 */
export async function timeMedian(
  fn: () => Promise<unknown>,
  iterations: number,
  warmup = 2
): Promise<number> {
  for (let i = 0; i < warmup; i++) {
    await fn();
  }
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

// ---------------------------------------------------------------------------
// Threshold control
// ---------------------------------------------------------------------------

/** Force every operation onto the sequential path. */
export function forceSequential(): void {
  computePool.updateConfig({ thresholdElements: Number.MAX_SAFE_INTEGER });
}

/**
 * Force operations onto the parallel path. A low threshold means anything
 * above `threshold` elements dispatches to the worker pool.
 */
export function forceParallel(threshold = 1): void {
  computePool.updateConfig({ thresholdElements: threshold });
}

// ---------------------------------------------------------------------------
// Core runner
// ---------------------------------------------------------------------------

/**
 * Run one benchmark case across its full size ladder, timing the sequential
 * and parallel paths at each size.
 *
 * The worker pool must already be initialized by the caller (see `runSuite`).
 */
export async function runCase(bench: BenchCase): Promise<OperationResult> {
  const label = bench.label ?? sciLabel;
  const iterFor = bench.iterations ?? defaultIterations;
  const sizes: SizeResult[] = [];

  for (const size of bench.sizes) {
    const iterations = iterFor(size);

    // --- Sequential path -----------------------------------------------------
    forceSequential();
    const seqMs = await timeMedian(() => bench.run(size), iterations);

    // --- Parallel path -------------------------------------------------------
    forceParallel(1);
    const parMs = await timeMedian(() => bench.run(size), iterations);

    // Probe whether the parallel run genuinely dispatched to workers. We do
    // this once, after timing, via the pool's own ParallelResult metadata is
    // not available through the high-level functions API, so we re-derive it
    // from the pool's shouldParallelize decision instead.
    const parallelized = computePool.shouldParallelize(size);

    const speedup = seqMs / parMs;
    sizes.push({
      size,
      sizeLabel: label(size),
      seqMs,
      parMs,
      speedup,
      parallelized,
      chunks: 0,
    });
  }

  // Break-even = smallest size from which parallel wins *and keeps winning*
  // at every larger tested size. Requiring the win to persist filters out a
  // single noisy sample producing a spurious one-off "win" — important on a
  // contended CI box. A threshold set at a non-persistent crossover would be
  // wrong, so this is the conservative, decision-relevant definition.
  let breakEvenSize: number | null = null;
  for (let i = 0; i < sizes.length; i++) {
    if (sizes.slice(i).every((r) => r.speedup > 1)) {
      breakEvenSize = sizes[i].size;
      break;
    }
  }

  return {
    operation: bench.operation,
    category: bench.category,
    sizeUnit: bench.sizeUnit,
    sizes,
    breakEvenSize,
  };
}

/** Scientific-notation label for an element count, e.g. 100000 -> "1e5". */
export function sciLabel(size: number): string {
  if (size >= 1000 && Math.log10(size) % 1 === 0) {
    return `1e${Math.log10(size)}`;
  }
  return size.toLocaleString('en-US');
}

/** Square-matrix label, e.g. 256 -> "256x256". */
export function squareLabel(dim: number): string {
  return `${dim}x${dim}`;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const COL = { size: 14, seq: 14, par: 14, speedup: 12, verdict: 12 };

/** Pad a string to a fixed width (right). */
function pad(s: string, w: number): string {
  return s.length >= w ? s : s + ' '.repeat(w - s.length);
}

/** Print a per-operation results table to stdout. */
export function printOperationTable(result: OperationResult): void {
  console.log('');
  console.log(`## ${result.operation}  (${result.category}; size = ${result.sizeUnit})`);
  if (result.note) console.log(`   ${result.note}`);
  console.log(
    pad('size', COL.size) +
      pad('seq (ms)', COL.seq) +
      pad('par (ms)', COL.par) +
      pad('speedup', COL.speedup) +
      pad('verdict', COL.verdict)
  );
  console.log('-'.repeat(COL.size + COL.seq + COL.par + COL.speedup + COL.verdict));
  for (const r of result.sizes) {
    const verdict = r.speedup > 1 ? 'parallel' : 'sequential';
    console.log(
      pad(r.sizeLabel, COL.size) +
        pad(r.seqMs.toFixed(3), COL.seq) +
        pad(r.parMs.toFixed(3), COL.par) +
        pad(`${r.speedup.toFixed(2)}x`, COL.speedup) +
        pad(verdict, COL.verdict)
    );
  }
  if (result.breakEvenSize === null) {
    console.log('   break-even: NONE — parallel never beat sequential at any tested size');
  } else {
    console.log(`   break-even: ${sciLabel(result.breakEvenSize)} ${result.sizeUnit}`);
  }
}

/**
 * Convert a break-even size to the element count `ComputePool.shouldParallelize`
 * actually compares against `thresholdElements`. For element-count operations
 * the break-even *is* the element count; for square-matrix / point-count
 * operations the internal element count is the square of the size axis
 * (`distanceMatrix` builds an n*n matrix; `matmul`/decompositions gate on
 * `rows*cols`). This is what a per-operation `thresholdElements` should be set
 * to, not the raw size-axis value.
 */
export function breakEvenElementCount(r: OperationResult): number | null {
  if (r.breakEvenSize === null) return null;
  switch (r.sizeUnit) {
    case 'matrix dim':
    case 'image side':
    case 'points':
      return r.breakEvenSize * r.breakEvenSize;
    default:
      return r.breakEvenSize;
  }
}

/** Print the cross-operation summary table (break-even + recommendations). */
export function printSummary(results: OperationResult[]): void {
  console.log('');
  console.log('='.repeat(92));
  console.log('SUMMARY — break-even sizes and recommended thresholdElements');
  console.log('='.repeat(92));
  console.log(
    pad('operation', 26) +
      pad('category', 16) +
      pad('best speedup', 18) +
      pad('break-even', 16) +
      'recommended thresholdElements'
  );
  console.log('-'.repeat(92));
  for (const r of results) {
    const best = r.sizes.reduce((m, s) => (s.speedup > m.speedup ? s : m), r.sizes[0]);
    const breakEven =
      r.breakEvenSize === null ? 'never' : `${sciLabel(r.breakEvenSize)} ${r.sizeUnit}`;
    const elements = breakEvenElementCount(r);
    const reco =
      elements === null
        ? 'do not parallelize (set MAX_SAFE_INTEGER)'
        : `~${elements.toLocaleString('en-US')}`;
    console.log(
      pad(r.operation, 26) +
        pad(r.category, 16) +
        pad(`${best.speedup.toFixed(2)}x @ ${best.sizeLabel}`, 18) +
        pad(breakEven, 16) +
        reco
    );
  }
  console.log('');
  console.log('NOTE: current code uses a flat thresholdElements = 50000 for every operation.');
  console.log(
    'These numbers are indicative only (noisy CI container) — re-run on target hardware.'
  );
}

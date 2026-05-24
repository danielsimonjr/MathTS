/**
 * Regression Parallelization Probe (one-shot diagnostic)
 *
 * Measures whether routing the `AᵀA` and `Aᵀb` formations of `polyFit` and
 * `leastSquares` through `computePool.matmul` / `computePool.matvec` actually
 * beats the on-thread sequential nested-loop implementation.
 *
 * This is a *probe*, not a permanent bench case — the production
 * `polyFit` / `leastSquares` are still sync, so making the bench loop call
 * them via `forceSequential` / `forceParallel` would show identical numbers
 * (the sync code never touches the pool). We measure candidate async
 * implementations here and decide whether to land them in production based
 * on the data.
 *
 * Usage:
 *   npx turbo build --filter=@danielsimonjr/mathts-parallel
 *   npx tsx tools/benchmark/parallel/regression-probe.ts
 */

import { performance } from 'node:perf_hooks';
import { computePool } from '@danielsimonjr/mathts-parallel';

// ---------------------------------------------------------------------------
// Sequential references — copy of the production polyFit/leastSquares core
// (re-implemented locally so we don't import the built dist which itself is
// pure sequential and we'd just be measuring the same code twice).
// ---------------------------------------------------------------------------

/** Sequential AᵀA for a row-major flat m×n matrix. Returns flat n×n. */
function sequentialAtA(A: Float64Array, m: number, n: number): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < m; k++) s += A[k * n + i] * A[k * n + j];
      out[i * n + j] = s;
    }
  }
  return out;
}

/** Sequential Aᵀb. */
function sequentialAtb(A: Float64Array, m: number, n: number, b: Float64Array): Float64Array {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < m; k++) s += A[k * n + i] * b[k];
    out[i] = s;
  }
  return out;
}

/** Solve n×n linear system by Gaussian elimination with partial pivoting. */
function solveSystem(AtA: Float64Array, Atb: Float64Array, n: number): Float64Array {
  // Augmented matrix
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = new Array(n + 1);
    for (let j = 0; j < n; j++) row[j] = AtA[i * n + j];
    row[n] = Atb[i];
    A.push(row);
  }
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > maxVal) {
        maxVal = Math.abs(A[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) [A[col], A[maxRow]] = [A[maxRow], A[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let j = col; j <= n; j++) A[row][j] -= factor * A[col][j];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = A[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j];
    x[i] /= A[i][i];
  }
  return x;
}

/** Transpose a row-major m×n matrix into a flat n×m. */
function transpose(A: Float64Array, m: number, n: number): Float64Array {
  const out = new Float64Array(n * m);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) out[j * m + i] = A[i * n + j];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Candidate implementations
// ---------------------------------------------------------------------------

interface LSResult {
  x: Float64Array;
}

/** Pure sequential leastSquares. */
function leastSquaresSequential(A: Float64Array, m: number, n: number, b: Float64Array): LSResult {
  const AtA = sequentialAtA(A, m, n);
  const Atb = sequentialAtb(A, m, n, b);
  return { x: solveSystem(AtA, Atb, n) };
}

/**
 * Parallel candidate: form AᵀA via computePool.matmul (Aᵀ × A), then
 * Aᵀb via computePool.matvec. Solve sequentially (n×n is small).
 */
async function leastSquaresParallel(
  A: Float64Array,
  m: number,
  n: number,
  b: Float64Array
): Promise<LSResult> {
  const At = transpose(A, m, n); // n×m
  // AᵀA: (n×m) × (m×n) = n×n
  const atA = await computePool.matmul(At, n, m, A, n);
  // Aᵀb: (n×m) × (m) = n
  const atB = await computePool.matvec(At, n, m, b);
  return { x: solveSystem(atA.result, atB.result, n) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randMatrix(m: number, n: number): Float64Array {
  const A = new Float64Array(m * n);
  for (let i = 0; i < A.length; i++) A[i] = Math.random() * 2 - 1;
  return A;
}

function randVec(m: number): Float64Array {
  const b = new Float64Array(m);
  for (let i = 0; i < m; i++) b[i] = Math.random() * 2 - 1;
  return b;
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function timeMedian(fn: () => unknown | Promise<unknown>, iters: number, warmup = 2) {
  for (let i = 0; i < warmup; i++) await fn();
  const samples: number[] = [];
  for (let i = 0; i < iters; i++) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  return median(samples);
}

// ---------------------------------------------------------------------------
// Test ladders
// ---------------------------------------------------------------------------

interface Case {
  label: string;
  m: number;
  n: number;
  iters: number;
}

// polyFit-like: large m (samples), small n = degree+1 (4, 8, 16)
const POLYFIT_CASES: Case[] = [
  { label: 'polyFit deg=3, m=1k', m: 1000, n: 4, iters: 15 },
  { label: 'polyFit deg=3, m=10k', m: 10000, n: 4, iters: 10 },
  { label: 'polyFit deg=3, m=100k', m: 100000, n: 4, iters: 5 },
  { label: 'polyFit deg=7, m=10k', m: 10000, n: 8, iters: 8 },
  { label: 'polyFit deg=7, m=100k', m: 100000, n: 8, iters: 4 },
  { label: 'polyFit deg=15, m=10k', m: 10000, n: 16, iters: 6 },
  { label: 'polyFit deg=15, m=100k', m: 100000, n: 16, iters: 3 },
];

// leastSquares: also wide / tall variations
const LS_CASES: Case[] = [
  { label: 'LS m=500,  n=50', m: 500, n: 50, iters: 10 },
  { label: 'LS m=1k,   n=100', m: 1000, n: 100, iters: 6 },
  { label: 'LS m=2k,   n=200', m: 2000, n: 200, iters: 5 },
  { label: 'LS m=10k,  n=100', m: 10000, n: 100, iters: 4 },
  { label: 'LS m=20k,  n=100', m: 20000, n: 100, iters: 3 },
  { label: 'LS m=5k,   n=200', m: 5000, n: 200, iters: 3 },
  { label: 'LS m=10k,  n=200', m: 10000, n: 200, iters: 2 },
  { label: 'LS m=1k,   n=500', m: 1000, n: 500, iters: 3 }, // wide-ish
];

async function runLadder(cases: Case[], label: string): Promise<void> {
  console.log('');
  console.log('='.repeat(78));
  console.log(label);
  console.log('='.repeat(78));
  console.log(
    'case'.padEnd(28) +
      'seq ms'.padStart(10) +
      'par ms'.padStart(10) +
      'speedup'.padStart(12) +
      'verdict'.padStart(14)
  );
  console.log('-'.repeat(74));

  for (const c of cases) {
    const A = randMatrix(c.m, c.n);
    const b = randVec(c.m);

    // Sanity check: parallel and sequential should give numerically close
    // answers (sample one input — formed inside the timing closure is fine).
    const refSeq = leastSquaresSequential(A, c.m, c.n, b);
    const refPar = await leastSquaresParallel(A, c.m, c.n, b);
    let maxDiff = 0;
    for (let i = 0; i < c.n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(refSeq.x[i] - refPar.x[i]));
    }
    if (maxDiff > 1e-6) {
      console.log(`!! ${c.label} numeric mismatch: maxDiff=${maxDiff.toExponential(2)}`);
    }

    const seqMs = await timeMedian(() => leastSquaresSequential(A, c.m, c.n, b), c.iters);
    const parMs = await timeMedian(() => leastSquaresParallel(A, c.m, c.n, b), c.iters);
    const speedup = seqMs / parMs;
    const verdict = speedup > 1.1 ? 'parallel' : speedup > 0.9 ? 'tie' : 'sequential';
    console.log(
      c.label.padEnd(28) +
        seqMs.toFixed(3).padStart(10) +
        parMs.toFixed(3).padStart(10) +
        `${speedup.toFixed(2)}x`.padStart(12) +
        verdict.padStart(14)
    );
  }
}

async function main(): Promise<void> {
  await computePool.initialize();
  // Force the parallel path to actually dispatch — without this every matmul
  // call would just run sequentially in-process and we'd be measuring nothing.
  computePool.updateConfig({ thresholdElements: 1 });
  console.log(`Worker pool initialized (maxWorkers ${computePool.getConfig().maxWorkers}).`);

  try {
    await runLadder(POLYFIT_CASES, 'polyFit-shaped least squares (small n, varied m)');
    await runLadder(LS_CASES, 'leastSquares (general overdetermined / wide systems)');
  } finally {
    await computePool.terminate();
  }
}

main().catch((e) => {
  console.error('Probe failed:', e);
  process.exit(1);
});

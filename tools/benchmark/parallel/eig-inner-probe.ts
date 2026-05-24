/**
 * Eig/SVD inner-loop dispatch probe.
 *
 * The end-to-end eig/svd bench is misleading because the JS-fallback code does
 * not dispatch to the worker pool — both "seq" and "par" runs execute the same
 * code path. The real question is whether any *individual* inner-loop step
 * (one matmul, one Householder/Givens sweep, one Q accumulation) is large
 * enough to amortize a worker dispatch round-trip if we did dispatch it.
 *
 * This probe measures:
 *
 *   1. The cost of a *single* in-thread matmul at n×n (the size of one QR-step
 *      transformation accumulation).
 *   2. The cost of a *single* `computePool.matmul` dispatch at n×n (worker
 *      round-trip + serialization + compute).
 *   3. The cost of a single sequential Givens sweep over n columns (one inner
 *      QR step), as a sanity check.
 *   4. The cost of a single Householder bilateral update — the dominant cost
 *      of the Hessenberg reduction (eig) / bidiagonalization (svd). This is
 *      O(n²) per Householder, n total Householders.
 *
 * If (2) >= (1), dispatching the inner work cannot win regardless of how many
 * QR iterations the outer loop runs.
 *
 * Run from repo root:
 *   npx tsx tools/benchmark/parallel/eig-inner-probe.ts
 */

import { computePool } from '@danielsimonjr/mathts-parallel';

function randFloat(size: number): Float64Array {
  const out = new Float64Array(size);
  for (let i = 0; i < size; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

function sequentialMatmul(a: Float64Array, n: number, b: Float64Array): Float64Array {
  const out = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const aik = a[i * n + k];
      for (let j = 0; j < n; j++) {
        out[i * n + j] += aik * b[k * n + j];
      }
    }
  }
  return out;
}

// One sweep of n Givens rotations over an n×n matrix (rough proxy for the
// per-QR-step inner work in eig.ts/qrStep). Pure in-thread.
function sequentialGivensSweep(A: Float64Array, n: number): void {
  for (let k = 0; k < n - 1; k++) {
    const c = Math.cos(0.1 + k * 1e-3);
    const s = Math.sin(0.1 + k * 1e-3);
    for (let j = 0; j < n; j++) {
      const a1 = A[k * n + j];
      const a2 = A[(k + 1) * n + j];
      A[k * n + j] = c * a1 - s * a2;
      A[(k + 1) * n + j] = s * a1 + c * a2;
    }
  }
}

// One Householder bilateral update applied to a length-len vector at column k
// of an n×n matrix — proxies the inner loop of `hessenberg()` /
// `bidiagonalize()`. Pure in-thread.
function sequentialHouseholderBilateral(A: Float64Array, n: number, k: number): void {
  const len = n - k;
  const v = new Float64Array(len);
  for (let i = 0; i < len; i++) v[i] = (i + 1) * 1e-3;
  const beta = 1.0;

  // Left: (I - beta*v*v') * A[k:n, k:n]
  for (let j = k; j < n; j++) {
    let dot = 0;
    for (let i = 0; i < len; i++) dot += v[i] * A[(k + i) * n + j];
    dot *= beta;
    for (let i = 0; i < len; i++) A[(k + i) * n + j] -= dot * v[i];
  }
  // Right: A[k:n, k:n] * (I - beta*v*v')
  for (let i = k; i < n; i++) {
    let dot = 0;
    for (let j = 0; j < len; j++) dot += A[i * n + k + j] * v[j];
    dot *= beta;
    for (let j = 0; j < len; j++) A[i * n + k + j] -= dot * v[j];
  }
}

async function median(fn: () => Promise<number>, iters: number): Promise<number> {
  const samples: number[] = [];
  // warm-up
  for (let i = 0; i < 2; i++) await fn();
  for (let i = 0; i < iters; i++) samples.push(await fn());
  samples.sort((a, b) => a - b);
  return samples[samples.length >> 1];
}

async function probeAtSize(n: number): Promise<void> {
  const iters = n >= 256 ? 5 : n >= 128 ? 10 : 20;

  // (1) sequential matmul
  const a = randFloat(n * n);
  const b = randFloat(n * n);
  const seqMatmulMs = await median(async () => {
    const t0 = performance.now();
    sequentialMatmul(a, n, b);
    return performance.now() - t0;
  }, iters);

  // (2) ComputePool matmul (worker dispatch)
  const parMatmulMs = await median(async () => {
    const t0 = performance.now();
    await computePool.matmul(a, n, n, b, n);
    return performance.now() - t0;
  }, iters);

  // (3) sequential Givens sweep (one inner QR step's worth of work)
  const M = randFloat(n * n);
  const givensMs = await median(async () => {
    const t0 = performance.now();
    sequentialGivensSweep(M, n);
    return performance.now() - t0;
  }, iters);

  // (4) sequential Householder bilateral update at k=1 (largest single step
  // in the Hessenberg/bidiag reduction).
  const H = randFloat(n * n);
  const householderMs = await median(async () => {
    const t0 = performance.now();
    sequentialHouseholderBilateral(H, n, 1);
    return performance.now() - t0;
  }, iters);

  // QR steps per call: roughly 2*n for unsymmetric eig (double-shift), ~n for symmetric.
  const estimatedQRSteps = 2 * n;
  const cumulativeGivensMs = givensMs * estimatedQRSteps;
  const cumulativeParDispatchMs = parMatmulMs * estimatedQRSteps;

  // Hessenberg/bidiag reductions are n Householders, decreasing size from n-1 to 1.
  // Total cost ~ Σ (n-k)² ~ n³/3.
  const estimatedHessenbergCost = ((n * n * n) / 3) * (householderMs / ((n - 1) * (n - 1)));

  console.log('');
  console.log(`n = ${n}`);
  console.log(`  sequential matmul (n×n):       ${seqMatmulMs.toFixed(3)} ms`);
  console.log(`  ComputePool.matmul (n×n):      ${parMatmulMs.toFixed(3)} ms`);
  console.log(`  matmul speedup:                ${(seqMatmulMs / parMatmulMs).toFixed(2)}x`);
  console.log(`  single Givens sweep (n cols):  ${givensMs.toFixed(3)} ms`);
  console.log(`  single Householder bilateral:  ${householderMs.toFixed(3)} ms`);
  console.log(`  est. Hessenberg/bidiag total:  ${estimatedHessenbergCost.toFixed(1)} ms`);
  console.log(
    `  Givens × ${estimatedQRSteps} QR steps:        ${cumulativeGivensMs.toFixed(1)} ms (sequential)`
  );
  console.log(
    `  if dispatched each QR step:    ${cumulativeParDispatchMs.toFixed(1)} ms (worker dispatch × ${estimatedQRSteps})`
  );
  const innerViable = parMatmulMs < givensMs;
  const householderViable = parMatmulMs < householderMs;
  console.log(
    `  inner QR step dispatch:        ${innerViable ? 'YES — pool faster than one step' : 'NO — pool overhead > one step'}`
  );
  console.log(
    `  Householder step dispatch:     ${householderViable ? 'YES — pool faster than one step' : 'NO — pool overhead > one step'}`
  );
}

async function main(): Promise<void> {
  await computePool.initialize();
  console.log('='.repeat(78));
  console.log('Eig/SVD inner-loop dispatch probe');
  console.log('='.repeat(78));
  console.log(`Worker pool maxWorkers: ${computePool.getConfig().maxWorkers}`);

  // Force parallel for computePool.matmul calls
  computePool.updateConfig({ thresholdElements: 1 });

  try {
    for (const n of [32, 64, 96, 128, 192, 256]) {
      await probeAtSize(n);
    }
  } finally {
    await computePool.terminate();
  }
}

main().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});

/**
 * Tensor Decompositions Benchmark
 *
 * Benchmarks:
 *   - tensorQr  on n×n×n at n ∈ {8, 16, 32}
 *   - tensorSvd (truncated, maxdim=k) at same sizes with k ∈ {n/4, n/2}
 *   - tensorEig (symmetric path, symmetric: true) at n ∈ {8, 16, 32, 64}
 *
 * For rank-3 tensors of shape [n, n, n] we treat the first axis as "row" and
 * axes [1, 2] as "col", giving an effective matrix of size n × n^2.
 * For tensorEig we need a square effective matrix, so we use a rank-2 tensor
 * of shape [n, n] (symmetric positive-definite).
 *
 * Note: n=64 for QR/SVD produces a 64×4096 matrix. The Householder QR is
 * O(m * n^2) = O(64 * 4096^2) ≈ 1 billion FLOPs — benchmarking is
 * intentionally kept at n≤32 for these to complete within the 2-min budget.
 */

import { Tensor } from '../../../tensor/src/Tensor.js';
import { tensorSvd } from '../../../tensor/src/operations/svd.js';
import { tensorQr } from '../../../tensor/src/operations/qr.js';
import { tensorEig } from '../../../tensor/src/operations/eig.js';

// ───────────────────────── helpers ─────────────────────────

function randomTensor(shape: number[]): Tensor {
  const size = shape.reduce((a, b) => a * b, 1);
  const data = new Float64Array(size);
  for (let i = 0; i < size; i++) data[i] = Math.random();
  return new Tensor(shape, data);
}

/** Build a symmetric positive-definite rank-2 tensor of shape [m, m]. */
function randomSymmetricTensor(m: number): Tensor {
  const data = new Float64Array(m * m);
  // A^T A + m*I  is SPD
  const raw = new Float64Array(m * m);
  for (let i = 0; i < m * m; i++) raw[i] = Math.random();
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let v = 0;
      for (let k = 0; k < m; k++) v += raw[i * m + k] * raw[j * m + k];
      data[i * m + j] = v;
    }
    data[i * m + i] += m; // ensure positive-definiteness
  }
  return new Tensor([m, m], data);
}

function measureTime(fn: () => void, iterations: number): number {
  for (let i = 0; i < Math.min(2, iterations); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  return (end - start) / iterations;
}

// ───────────────────────── QR ─────────────────────────

interface QrResult {
  n: number;
  msPerOp: number;
}

async function benchmarkQr(n: number, iterations: number): Promise<QrResult> {
  const t = randomTensor([n, n, n]);
  // row axis = [0], col axes = [1, 2] → effective matrix n × n^2
  const msPerOp = measureTime(() => {
    tensorQr(t, [0]);
  }, iterations);
  return { n, msPerOp };
}

// ───────────────────────── SVD ─────────────────────────

interface SvdResult {
  n: number;
  maxdim: number;
  msPerOp: number;
}

async function benchmarkSvd(n: number, maxdim: number, iterations: number): Promise<SvdResult> {
  const t = randomTensor([n, n, n]);
  const msPerOp = measureTime(() => {
    tensorSvd(t, [0], { maxdim });
  }, iterations);
  return { n, maxdim, msPerOp };
}

// ───────────────────────── Eig ─────────────────────────

interface EigResult {
  n: number;
  msPerOp: number;
}

async function benchmarkEig(n: number, iterations: number): Promise<EigResult> {
  // Use n×n symmetric matrix so the effective matrix is square.
  const t = randomSymmetricTensor(n);
  const msPerOp = measureTime(() => {
    tensorEig(t, [0], { symmetric: true });
  }, iterations);
  return { n, msPerOp };
}

// ───────────────────────── printing ─────────────────────────

function printQrResults(results: QrResult[]): void {
  console.log('\n=== tensorQr Benchmark (shape [n, n, n], rowAxes=[0]) ===\n');
  console.log('| n  | ms/op   |');
  console.log('|:--:|--------:|');
  for (const r of results) {
    console.log(`| ${String(r.n).padStart(2)} | ${r.msPerOp.toFixed(3).padStart(7)} |`);
  }
  console.log('');
}

function printSvdResults(results: SvdResult[]): void {
  console.log('\n=== tensorSvd Benchmark (shape [n, n, n], rowAxes=[0], truncated) ===\n');
  console.log('| n  | maxdim | ms/op   |');
  console.log('|:--:|:------:|--------:|');
  for (const r of results) {
    console.log(
      `| ${String(r.n).padStart(2)} | ${String(r.maxdim).padStart(6)} | ${r.msPerOp.toFixed(3).padStart(7)} |`
    );
  }
  console.log('');
}

function printEigResults(results: EigResult[]): void {
  console.log('\n=== tensorEig Benchmark (shape [n, n], symmetric=true) ===\n');
  console.log('| n  | ms/op   |');
  console.log('|:--:|--------:|');
  for (const r of results) {
    console.log(`| ${String(r.n).padStart(2)} | ${r.msPerOp.toFixed(3).padStart(7)} |`);
  }
  console.log('');
}

// ───────────────────────── main ─────────────────────────

async function main(): Promise<void> {
  // QR and SVD operate on [n, n, n] tensors → effective matrix n × n^2.
  // n=32 → QR of 32×1024: fast. n=64 → 64×4096: O(64 * 4096^2) ≈ very slow.
  // Cap QR/SVD at n=32 to stay within 2-min wall budget.
  const qrSvdSizes = [8, 16, 32];
  // Eig operates on a symmetric n×n matrix — much faster.
  const eigSizes = [8, 16, 32, 64];

  // ── tensorQr ──────────────────────────────────────────
  const qrIters: Record<number, number> = { 8: 100, 16: 20, 32: 5 };

  console.log('Running tensorQr benchmarks...');
  const qrResults: QrResult[] = [];
  for (const n of qrSvdSizes) {
    console.log(`  QR n=${n} (${qrIters[n]} iter${qrIters[n] > 1 ? 's' : ''})...`);
    qrResults.push(await benchmarkQr(n, qrIters[n]));
  }

  // ── tensorSvd ─────────────────────────────────────────
  const svdIters: Record<number, number> = { 8: 100, 16: 20, 32: 5 };

  console.log('Running tensorSvd benchmarks...');
  const svdResults: SvdResult[] = [];
  for (const n of qrSvdSizes) {
    for (const frac of [0.25, 0.5]) {
      const maxdim = Math.max(1, Math.round(n * frac));
      const iters = svdIters[n];
      console.log(`  SVD n=${n} maxdim=${maxdim} (${iters} iter${iters > 1 ? 's' : ''})...`);
      svdResults.push(await benchmarkSvd(n, maxdim, iters));
    }
  }

  // ── tensorEig ─────────────────────────────────────────
  // Eig on n×n symmetric matrix — each benchmark is O(n^3) Householder + QR iterations.
  const eigIters: Record<number, number> = { 8: 200, 16: 50, 32: 10, 64: 3 };

  console.log('Running tensorEig benchmarks...');
  const eigResults: EigResult[] = [];
  for (const n of eigSizes) {
    const iters = eigIters[n];
    console.log(`  Eig n=${n} (${iters} iter${iters > 1 ? 's' : ''})...`);
    eigResults.push(await benchmarkEig(n, iters));
  }

  // ── print ──────────────────────────────────────────────
  printQrResults(qrResults);
  printSvdResults(svdResults);
  printEigResults(eigResults);
}

main().catch(console.error);

export { benchmarkQr, benchmarkSvd, benchmarkEig, QrResult, SvdResult, EigResult };

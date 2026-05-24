/**
 * Tensor.tensordot Benchmark
 *
 * Benchmarks `Tensor.tensordot(other, axes)` at sizes [8, 16, 24, 32] for
 * square 3-D tensors with 1-axis and 2-axis contractions.
 *
 * The pure-JS einsum back-end is O(n^5) for 1-axis and O(n^4) for 2-axis.
 * Larger sizes (64, 128) would take minutes per iteration. The benchmark
 * caps at n=32 to keep the full suite ≤ 2 min.
 *
 * Shape: [n, n, n] x [n, n, n]
 *   - 1-axis: contract axis 2 of `a` with axis 0 of `b` → shape [n, n, n, n]
 *             FLOPs ≈ 2 * n^5  (n^4 output elements, each costing n muls)
 *   - 2-axis: contract axes (1,2) of `a` with axes (0,1) of `b` → shape [n, n]
 *             FLOPs ≈ 2 * n^4  (n^2 output elements, each costing n^2 muls)
 */

import { Tensor } from '../../../tensor/src/Tensor.js';

function randomTensor3D(n: number): Tensor {
  const size = n * n * n;
  const data = new Float64Array(size);
  for (let i = 0; i < size; i++) data[i] = Math.random();
  return new Tensor([n, n, n], data);
}

interface TensordotResult {
  size: number;
  axisCount: number;
  msPerOp: number;
  gflops: number;
}

function measureTime(fn: () => void, iterations: number): number {
  for (let i = 0; i < Math.min(3, iterations); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  return (end - start) / iterations;
}

async function benchmarkTensordot(
  n: number,
  axisCount: 1 | 2,
  iterations: number
): Promise<TensordotResult> {
  const a = randomTensor3D(n);
  const b = randomTensor3D(n);

  let axes: ReadonlyArray<readonly [number, number]>;
  let flops: number;

  if (axisCount === 1) {
    // contract axis 2 of a with axis 0 of b
    axes = [[2, 0]];
    // output shape [n, n, n, n], each element sums n terms → 2*n^5 FLOPs
    flops = 2 * n ** 5;
  } else {
    // contract axes (1,2) of a with (0,1) of b
    axes = [
      [1, 0],
      [2, 1],
    ];
    // output shape [n, n], each element sums n^2 terms → 2*n^4 FLOPs
    flops = 2 * n ** 4;
  }

  const msPerOp = measureTime(() => {
    a.tensordot(b, axes);
  }, iterations);

  const gflops = flops / (msPerOp * 1e6);
  return { size: n, axisCount, msPerOp, gflops };
}

function printResults(results: TensordotResult[]): void {
  console.log('\n=== Tensor.tensordot Benchmark (3-D tensors, [n,n,n] x [n,n,n]) ===\n');
  console.log('| Size (n) | Axes | ms/op   | GFLOPS |');
  console.log('|:--------:|:----:|--------:|-------:|');
  for (const r of results) {
    console.log(
      `| ${String(r.size).padStart(8)} | ${String(r.axisCount).padStart(4)} | ${r.msPerOp.toFixed(3).padStart(7)} | ${r.gflops.toFixed(3).padStart(6)} |`
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  // Pure-JS einsum: 1-axis is O(n^5), 2-axis is O(n^4).
  // n=24 for 1-axis ≈ 1.6s/op → 2 calls (1 warmup + 1 measured) ≈ 3s.
  // n=32 for 1-axis ≈ 7s/op → 14s for a single data point — excluded to
  // keep wall time ≤ 2 min across the full suite.
  const configs: Array<{ n: number; axisCount: 1 | 2; iters: number }> = [
    { n: 8, axisCount: 1, iters: 100 },
    { n: 16, axisCount: 1, iters: 5 },
    { n: 24, axisCount: 1, iters: 1 },
    { n: 8, axisCount: 2, iters: 200 },
    { n: 16, axisCount: 2, iters: 20 },
    { n: 24, axisCount: 2, iters: 5 },
    { n: 32, axisCount: 2, iters: 2 },
  ];

  console.log('Running Tensor.tensordot benchmarks...');
  const results: TensordotResult[] = [];
  for (const { n, axisCount, iters } of configs) {
    console.log(`  n=${n}, ${axisCount}-axis (${iters} iter${iters > 1 ? 's' : ''})...`);
    results.push(await benchmarkTensordot(n, axisCount, iters));
  }

  printResults(results);
}

main().catch(console.error);

export { benchmarkTensordot, TensordotResult };

/**
 * Tensor.contract Benchmark
 *
 * Benchmarks the named-index contraction of two 3-D tensors sharing 1 index
 * at edge dimensions [8, 16, 24, 32]. Reports ms/op and GFLOPS.
 *
 * The Tensor.einsum implementation is pure-JS O(n^5) for 3-D×3-D contracting
 * 1 axis. Larger dimensions (64+) take tens of seconds per iteration —
 * the benchmark deliberately caps at n=32 to keep the full suite ≤ 2 min.
 * Re-run at larger sizes locally when a WASM/matmul-routed fast path lands.
 *
 * Contract of shape [n, n, n] x [n, n, n] over 1 shared axis:
 *   Result shape [n, n, n, n]; FLOPs ≈ 2 * n^5
 */

import { Tensor } from '../../../tensor/src/Tensor.js';
import { idx } from '../../../tensor/src/named-index.js';

/**
 * Generate a random 3-D tensor of shape [n, n, n] with the middle axis
 * labelled by the shared Index `shared`.
 */
function randomTensor3D(n: number, sharedIdx: ReturnType<typeof idx>): Tensor {
  const size = n * n * n;
  const data = new Float64Array(size);
  for (let i = 0; i < size; i++) data[i] = Math.random();
  // axes: [free_a, shared, free_b]
  return new Tensor([n, n, n], data, [idx(n, 'a'), sharedIdx, idx(n, 'b')]);
}

interface ContractResult {
  dim: number;
  msPerOp: number;
  gflops: number;
}

/**
 * Measure average execution time (ms).
 */
function measureTime(fn: () => void, iterations: number): number {
  // Warmup
  for (let i = 0; i < Math.min(3, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  return (end - start) / iterations;
}

async function benchmarkContract(n: number, iterations: number): Promise<ContractResult> {
  const shared = idx(n, 'shared');
  const a = randomTensor3D(n, shared);
  const b = randomTensor3D(n, shared);

  const msPerOp = measureTime(() => {
    a.contract(b);
  }, iterations);

  // FLOPs: for each of n^2 free (a,b) combos we sum n products → 2*n^3 per free pair × n^2 pairs = 2*n^5
  // More precisely: result shape is [n_a, n_b, n_a2, n_b2] = [n,n,n,n], contraction dim = n
  // ops ≈ 2 * n^5 in the general case with 2 free dims each side
  const flops = 2 * n ** 5;
  const gflops = flops / (msPerOp * 1e6);

  return { dim: n, msPerOp, gflops };
}

function printResults(results: ContractResult[]): void {
  console.log('\n=== Tensor.contract Benchmark (3-D, 1 shared axis) ===\n');
  console.log('| Edge dim (n) | ms/op   | GFLOPS |');
  console.log('|:------------:|--------:|-------:|');
  for (const r of results) {
    console.log(
      `| ${String(r.dim).padStart(12)} | ${r.msPerOp.toFixed(3).padStart(7)} | ${r.gflops.toFixed(3).padStart(6)} |`
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  // The pure-JS einsum is O(n^5) for 3-D×3-D with 1 shared axis.
  // n=24 → ~3s per op (1 warmup + 1 measured = 6s for iters=1 + warmup).
  // n=32 → ~7s per op → too slow per the 2-min total budget.
  const configs: Array<{ dim: number; iters: number }> = [
    { dim: 8, iters: 100 },
    { dim: 16, iters: 5 },
    { dim: 24, iters: 1 },
  ];

  console.log('Running Tensor.contract benchmarks...');
  const results: ContractResult[] = [];
  for (const { dim, iters } of configs) {
    console.log(`  n=${dim} (${iters} iter${iters > 1 ? 's' : ''})...`);
    results.push(await benchmarkContract(dim, iters));
  }

  printResults(results);
}

main().catch(console.error);

export { benchmarkContract, ContractResult };

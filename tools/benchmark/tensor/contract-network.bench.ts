/**
 * contractNetwork Benchmark
 *
 * Benchmarks `contractNetwork` on N ∈ {4, 8, 12, 16} tensors.
 * Reports ms/op for the exact-DP ('exact') and greedy ('greedy') algorithms.
 *
 * Network topology: a linear MPS chain. Interior tensors have shape
 * [bond, phys, bond]; the two end tensors are [phys, bond] and [bond, phys].
 * In a chain every adjacent pair shares exactly one bond index, so any
 * pairwise contraction planned by the optimizer has a shared index and
 * `Tensor.contract` never hits the "no shared indices" guard.
 *
 * Size constraints:
 *   - BOND_DIM = 2, PHYS_DIM = 2 keeps the final output ≤ phys^N * 1 = 2^N.
 *   - At N=16 the final tensor has 2^14 = 16K elements (the two end bonds
 *     are contracted away), which is perfectly tractable.
 *   - The bottleneck is the intermediate tensors during sequential
 *     contraction — the greedy/exact optimiser chooses the order to minimise
 *     this. Both algorithms are benchmarked at all N.
 *
 * Note: for N=16 the exact-DP visits 3^16 ≈ 43M subsets during planning,
 * which can be slow (tens of seconds) on this hardware. We report both
 * algorithms; exact is only timed at N ≤ 12 to stay within the 2-min budget.
 */

import { Tensor } from '../../../tensor/src/Tensor.js';
import { contractNetwork } from '../../../tensor/src/contraction-sequence.js';
import { idx } from '../../../tensor/src/named-index.js';

const BOND_DIM = 2;
const PHYS_DIM = 2;

/**
 * Build a linear MPS chain of N site tensors.
 * Site 0:   [phys0,  bond0]         (rank 2)
 * Site i:   [bond_{i-1}, phys_i, bond_i]  (rank 3)  for 0 < i < N-1
 * Site N-1: [bond_{N-2}, phys_{N-1}]      (rank 2)
 */
function buildChain(N: number): Tensor[] {
  const bonds: ReturnType<typeof idx>[] = [];
  for (let i = 0; i < N - 1; i++) bonds.push(idx(BOND_DIM, `b${i}`));

  const tensors: Tensor[] = [];
  for (let i = 0; i < N; i++) {
    let shape: number[];
    let labels: ReturnType<typeof idx>[];

    if (i === 0) {
      shape = [PHYS_DIM, BOND_DIM];
      labels = [idx(PHYS_DIM, `p${i}`), bonds[0]];
    } else if (i === N - 1) {
      shape = [BOND_DIM, PHYS_DIM];
      labels = [bonds[i - 1], idx(PHYS_DIM, `p${i}`)];
    } else {
      shape = [BOND_DIM, PHYS_DIM, BOND_DIM];
      labels = [bonds[i - 1], idx(PHYS_DIM, `p${i}`), bonds[i]];
    }

    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float64Array(size);
    for (let k = 0; k < size; k++) data[k] = Math.random();
    tensors.push(new Tensor(shape, data, labels));
  }
  return tensors;
}

interface NetworkResult {
  N: number;
  exactMs: number | null;
  greedyMs: number;
}

function measureTime(fn: () => void, iterations: number): number {
  for (let i = 0; i < Math.min(2, iterations); i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const end = performance.now();
  return (end - start) / iterations;
}

async function benchmarkNetwork(
  N: number,
  exactIters: number,
  greedyIters: number
): Promise<NetworkResult> {
  const tensors = buildChain(N);

  let exactMs: number | null = null;
  if (exactIters > 0) {
    exactMs = measureTime(() => {
      contractNetwork(tensors, { algorithm: 'exact' });
    }, exactIters);
  }

  const greedyMs = measureTime(() => {
    contractNetwork(tensors, { algorithm: 'greedy' });
  }, greedyIters);

  return { N, exactMs, greedyMs };
}

function printResults(results: NetworkResult[]): void {
  console.log('\n=== contractNetwork Benchmark (MPS chain, bond_dim=2, phys_dim=2) ===\n');
  console.log('| N tensors | exact ms/op | greedy ms/op | exact/greedy ratio |');
  console.log('|:---------:|------------:|-------------:|-------------------:|');
  for (const r of results) {
    const exactStr = r.exactMs !== null ? r.exactMs.toFixed(3).padStart(11) : '         n/a';
    const ratioStr =
      r.exactMs !== null ? (r.exactMs / r.greedyMs).toFixed(2).padStart(18) : '               n/a';
    console.log(
      `| ${String(r.N).padStart(9)} | ${exactStr} | ${r.greedyMs.toFixed(3).padStart(12)} | ${ratioStr} |`
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  // Exact DP at N=16 visits 43M subsets. With bond_dim=2 this can still be
  // slow. We time exact only up to N=12 and provide greedy at N=16 too.
  const configs: Array<{ N: number; exactIters: number; greedyIters: number }> = [
    { N: 4, exactIters: 200, greedyIters: 200 },
    { N: 8, exactIters: 50, greedyIters: 50 },
    { N: 12, exactIters: 5, greedyIters: 5 },
    { N: 16, exactIters: 0, greedyIters: 3 },
  ];

  console.log('Running contractNetwork benchmarks...');
  const results: NetworkResult[] = [];
  for (const { N, exactIters, greedyIters } of configs) {
    const desc = exactIters > 0 ? 'exact+greedy' : 'greedy only';
    console.log(`  N=${N} (${desc})...`);
    results.push(await benchmarkNetwork(N, exactIters, greedyIters));
  }

  printResults(results);
}

main().catch(console.error);

export { benchmarkNetwork, NetworkResult };

/**
 * Parallel Computing Example
 *
 * Demonstrates parallel operations using ComputePool.
 *
 * Run from repo root:
 *   bun --tsconfig-override=tsconfig.base.json examples/parallel-computing.ts
 */

import { computePool } from '@danielsimonjr/mathts-parallel';

async function main() {
  console.log('=== MathTS Parallel Computing ===\n');

  console.log('Initializing compute pool...');
  await computePool.initialize();

  const stats = computePool.stats();
  console.log(`Workers available: ${stats.totalWorkers}\n`);

  const SIZE = 100000;
  console.log(`Creating test data (${SIZE.toLocaleString()} elements)...\n`);

  const data = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    data[i] = Math.random() * 100;
  }

  console.log('--- Statistical Operations ---');

  const sumResult = await computePool.sum(data);
  console.log(`Sum: ${sumResult.result.toFixed(2)}`);
  console.log(`  Duration: ${sumResult.duration.toFixed(2)}ms`);
  console.log(`  Parallelized: ${sumResult.parallelized}`);

  const meanResult = await computePool.mean(data);
  console.log(`\nMean: ${meanResult.result.toFixed(4)}`);

  const varianceResult = await computePool.variance(data);
  console.log(`\nVariance: ${varianceResult.result.variance.toFixed(4)}`);
  console.log(`Std Dev: ${varianceResult.result.std.toFixed(4)}`);

  const minMaxResult = await computePool.minMax(data);
  console.log(
    `\nMin: ${minMaxResult.result.min.toFixed(4)} at index ${minMaxResult.result.minIdx}`
  );
  console.log(`Max: ${minMaxResult.result.max.toFixed(4)} at index ${minMaxResult.result.maxIdx}`);

  console.log('\n--- Element-wise Operations ---');

  const a = new Float64Array([1, 2, 3, 4, 5]);
  const b = new Float64Array([10, 20, 30, 40, 50]);

  const added = await computePool.add(a, b);
  console.log(`a = [${Array.from(a).join(', ')}]`);
  console.log(`b = [${Array.from(b).join(', ')}]`);
  console.log(`a + b = [${Array.from(added.result).join(', ')}]`);

  const scaled = await computePool.scale(a, 3);
  console.log(`\na * 3 = [${Array.from(scaled.result).join(', ')}]`);

  const sqrts = await computePool.sqrt(new Float64Array([1, 4, 9, 16, 25]));
  console.log(`\nsqrt([1,4,9,16,25]) = [${Array.from(sqrts.result).join(', ')}]`);

  console.log('\n--- Matrix Operations ---');

  const A = new Float64Array([1, 2, 3, 4]);
  const B = new Float64Array([5, 6, 7, 8]);

  console.log('Matrix A (2x2):');
  console.log(`  [${A[0]}, ${A[1]}]`);
  console.log(`  [${A[2]}, ${A[3]}]`);

  console.log('\nMatrix B (2x2):');
  console.log(`  [${B[0]}, ${B[1]}]`);
  console.log(`  [${B[2]}, ${B[3]}]`);

  const C = await computePool.matmul(A, 2, 2, B, 2);
  const c = C.result;
  console.log('\nA * B:');
  console.log(`  [${c[0]}, ${c[1]}]`);
  console.log(`  [${c[2]}, ${c[3]}]`);

  const dot = await computePool.dot(new Float64Array([1, 2, 3]), new Float64Array([4, 5, 6]));
  console.log(`\nDot product [1,2,3] · [4,5,6] = ${dot.result}`);

  console.log('\n--- Batch Operations (Promise.all) ---');

  const largeData = new Float64Array(50000);
  for (let i = 0; i < largeData.length; i++) {
    largeData[i] = Math.random();
  }

  const startBatch = performance.now();
  const [batchSum, batchMean, batchStd] = await Promise.all([
    computePool.sum(largeData),
    computePool.mean(largeData),
    computePool.std(largeData),
  ]);
  const batchDuration = performance.now() - startBatch;

  console.log(`Computed sum, mean, std in parallel:`);
  console.log(`  Sum: ${batchSum.result.toFixed(2)}`);
  console.log(`  Mean: ${batchMean.result.toFixed(4)}`);
  console.log(`  Std: ${batchStd.result.toFixed(4)}`);
  console.log(`  Total duration: ${batchDuration.toFixed(2)}ms`);

  console.log('\n--- Cleanup ---');
  await computePool.terminate();
  console.log('Compute pool terminated.');

  console.log('\n=== Done ===');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

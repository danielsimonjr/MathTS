/**
 * GPU Matrix Multiplication Benchmark
 *
 * Compares GPU vs CPU performance for matrix multiplication.
 * Run in a WebGPU-capable browser for GPU measurements.
 *
 * Usage:
 *   npx tsx tools/benchmark/gpu/matmul.bench.ts
 *
 * Note: Full GPU benchmarks require browser environment with WebGPU.
 */

import {
  GPUBackend,
  getGlobalGPUBackend,
  destroyGlobalGPUBackend,
} from '../../../matrix/src/backends/GPUBackend.js';

/**
 * CPU matrix multiplication (reference)
 */
function cpuMatmul(
  a: Float32Array,
  b: Float32Array,
  M: number,
  K: number,
  N: number
): Float32Array {
  const result = new Float32Array(M * N);
  for (let i = 0; i < M; i++) {
    for (let j = 0; j < N; j++) {
      let sum = 0;
      for (let k = 0; k < K; k++) {
        sum += a[i * K + k] * b[k * N + j];
      }
      result[i * N + j] = sum;
    }
  }
  return result;
}

/**
 * Generate random matrix
 */
function randomMatrix(rows: number, cols: number): Float32Array {
  const data = new Float32Array(rows * cols);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return data;
}

/**
 * Benchmark a function
 */
async function benchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number = 10,
  warmupIterations: number = 3
): Promise<{ name: string; mean: number; std: number; min: number; max: number }> {
  // Warmup
  for (let i = 0; i < warmupIterations; i++) {
    await fn();
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
  const std = Math.sqrt(variance);
  const min = Math.min(...times);
  const max = Math.max(...times);

  return { name, mean, std, min, max };
}

/**
 * Format benchmark result
 */
function formatResult(result: {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
}): string {
  return `${result.name}: ${result.mean.toFixed(2)}ms ± ${result.std.toFixed(2)}ms (min: ${result.min.toFixed(2)}, max: ${result.max.toFixed(2)})`;
}

/**
 * Calculate GFLOPS for matmul
 * FLOPs = 2 * M * N * K (multiply-add for each element)
 */
function calculateGflops(M: number, N: number, K: number, timeMs: number): number {
  const flops = 2 * M * N * K;
  return flops / (timeMs * 1e6);
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('Matrix Multiplication Benchmark');
  console.log('================================\n');

  // Test sizes (square matrices)
  const sizes = [64, 128, 256, 512, 1024];

  console.log('CPU Benchmark Results:');
  console.log('-----------------------');

  for (const size of sizes) {
    const M = size;
    const K = size;
    const N = size;

    const a = randomMatrix(M, K);
    const b = randomMatrix(K, N);

    // Fewer iterations for larger sizes
    const iterations = size <= 256 ? 10 : 5;

    const result = await benchmark(
      `CPU ${M}x${K} × ${K}x${N}`,
      () => cpuMatmul(a, b, M, K, N),
      iterations
    );

    const gflops = calculateGflops(M, N, K, result.mean);
    console.log(`${formatResult(result)} - ${gflops.toFixed(2)} GFLOPS`);
  }

  // GPU benchmark (will only work in browser)
  console.log('\nGPU Benchmark:');
  console.log('--------------');

  const backend = getGlobalGPUBackend();
  const initialized = await backend.initialize();

  if (!initialized) {
    console.log('WebGPU not available - GPU benchmarks skipped');
    console.log('Run this benchmark in a WebGPU-capable browser for GPU measurements.');
  } else {
    console.log('GPU initialized successfully!');

    for (const size of sizes) {
      const M = size;
      const K = size;
      const N = size;

      const a = randomMatrix(M, K);
      const b = randomMatrix(K, N);

      const iterations = 10;

      const result = await benchmark(
        `GPU ${M}x${K} × ${K}x${N}`,
        () => backend.matmul(a, b, M, K, N),
        iterations
      );

      const gflops = calculateGflops(M, N, K, result.mean);
      console.log(`${formatResult(result)} - ${gflops.toFixed(2)} GFLOPS`);
    }

    // Comparison
    console.log('\nSpeedup Comparison:');
    console.log('-------------------');

    for (const size of sizes) {
      const M = size;
      const K = size;
      const N = size;

      const a = randomMatrix(M, K);
      const b = randomMatrix(K, N);

      const cpuResult = await benchmark('CPU', () => cpuMatmul(a, b, M, K, N), 5);

      const gpuResult = await benchmark('GPU', () => backend.matmul(a, b, M, K, N), 5);

      const speedup = cpuResult.mean / gpuResult.mean;
      console.log(
        `${M}x${M}: CPU ${cpuResult.mean.toFixed(2)}ms, GPU ${gpuResult.mean.toFixed(2)}ms, ` +
          `Speedup: ${speedup.toFixed(2)}x`
      );
    }
  }

  destroyGlobalGPUBackend();
  console.log('\nBenchmark complete.');
}

// Run if executed directly
main().catch(console.error);

/**
 * GPU Element-wise Operations Benchmark
 *
 * Compares GPU vs CPU performance for element-wise matrix operations.
 * Run in a WebGPU-capable browser for GPU measurements.
 *
 * Usage:
 *   npx tsx tools/benchmark/gpu/elementwise.bench.ts
 */

import {
  GPUBackend,
  getGlobalGPUBackend,
  destroyGlobalGPUBackend,
} from '../../../matrix/src/backends/GPUBackend.js';

/**
 * CPU element-wise operations
 */
const cpuOps = {
  add(a: Float32Array, b: Float32Array): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] + b[i];
    }
    return result;
  },

  scale(a: Float32Array, scalar: number): Float32Array {
    const result = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = a[i] * scalar;
    }
    return result;
  },

  sum(a: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += a[i];
    }
    return sum;
  },
};

/**
 * Generate random matrix
 */
function randomMatrix(elements: number): Float32Array {
  const data = new Float32Array(elements);
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
  iterations: number = 20,
  warmupIterations: number = 5
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
function formatResult(result: { mean: number; std: number }): string {
  return `${result.mean.toFixed(3)}ms ± ${result.std.toFixed(3)}ms`;
}

/**
 * Calculate throughput (GB/s)
 * For addition: read 2 arrays + write 1 array = 3 * elements * 4 bytes
 */
function calculateThroughput(elements: number, timeMs: number, factor: number = 3): number {
  const bytes = elements * 4 * factor;
  return bytes / (timeMs * 1e6);
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('Element-wise Operations Benchmark');
  console.log('===================================\n');

  // Test sizes (total elements)
  const sizes = [
    { name: '64KB', elements: 16384 }, // 64KB
    { name: '256KB', elements: 65536 }, // 256KB
    { name: '1MB', elements: 262144 }, // 1MB
    { name: '4MB', elements: 1048576 }, // 4MB
    { name: '16MB', elements: 4194304 }, // 16MB
    { name: '64MB', elements: 16777216 }, // 64MB
  ];

  // CPU Benchmarks
  console.log('CPU Benchmark Results:');
  console.log('-----------------------\n');

  console.log('Addition (a + b):');
  for (const { name, elements } of sizes) {
    const a = randomMatrix(elements);
    const b = randomMatrix(elements);

    const result = await benchmark(name, () => cpuOps.add(a, b), elements > 1000000 ? 10 : 20);

    const throughput = calculateThroughput(elements, result.mean);
    console.log(`  ${name}: ${formatResult(result)} - ${throughput.toFixed(2)} GB/s`);
  }

  console.log('\nScalar multiplication (a * 2.5):');
  for (const { name, elements } of sizes) {
    const a = randomMatrix(elements);

    const result = await benchmark(name, () => cpuOps.scale(a, 2.5), elements > 1000000 ? 10 : 20);

    const throughput = calculateThroughput(elements, result.mean, 2);
    console.log(`  ${name}: ${formatResult(result)} - ${throughput.toFixed(2)} GB/s`);
  }

  console.log('\nSum reduction:');
  for (const { name, elements } of sizes) {
    const a = randomMatrix(elements);

    const result = await benchmark(name, () => cpuOps.sum(a), elements > 1000000 ? 10 : 20);

    const throughput = calculateThroughput(elements, result.mean, 1);
    console.log(`  ${name}: ${formatResult(result)} - ${throughput.toFixed(2)} GB/s`);
  }

  // GPU Benchmarks
  console.log('\n\nGPU Benchmark:');
  console.log('--------------');

  const backend = getGlobalGPUBackend();
  const initialized = await backend.initialize();

  if (!initialized) {
    console.log('WebGPU not available - GPU benchmarks skipped');
    console.log('Run this benchmark in a WebGPU-capable browser for GPU measurements.');
  } else {
    console.log('GPU initialized successfully!\n');

    // Assume square matrices for simplicity
    const gpuSizes = [
      { name: '256x256', rows: 256, cols: 256 },
      { name: '512x512', rows: 512, cols: 512 },
      { name: '1024x1024', rows: 1024, cols: 1024 },
      { name: '2048x2048', rows: 2048, cols: 2048 },
      { name: '4096x4096', rows: 4096, cols: 4096 },
    ];

    console.log('Addition (GPU):');
    for (const { name, rows, cols } of gpuSizes) {
      const elements = rows * cols;
      const a = randomMatrix(elements);
      const b = randomMatrix(elements);

      const result = await benchmark(name, () => backend.add(a, b, rows, cols), 20);

      const throughput = calculateThroughput(elements, result.mean);
      console.log(`  ${name}: ${formatResult(result)} - ${throughput.toFixed(2)} GB/s`);
    }

    console.log('\nScalar multiplication (GPU):');
    for (const { name, rows, cols } of gpuSizes) {
      const elements = rows * cols;
      const a = randomMatrix(elements);

      const result = await benchmark(name, () => backend.scale(a, 2.5, rows, cols), 20);

      const throughput = calculateThroughput(elements, result.mean, 2);
      console.log(`  ${name}: ${formatResult(result)} - ${throughput.toFixed(2)} GB/s`);
    }

    // Crossover analysis
    console.log('\n\nCPU vs GPU Crossover Analysis:');
    console.log('-------------------------------');
    console.log('Finding the matrix size where GPU becomes faster...\n');

    for (const { name, rows, cols } of gpuSizes.slice(0, 3)) {
      const elements = rows * cols;
      const a = randomMatrix(elements);
      const b = randomMatrix(elements);

      const cpuResult = await benchmark('CPU', () => cpuOps.add(a, b), 10);
      const gpuResult = await benchmark('GPU', () => backend.add(a, b, rows, cols), 10);

      const speedup = cpuResult.mean / gpuResult.mean;
      const winner = speedup > 1 ? 'GPU' : 'CPU';

      console.log(
        `${name}: CPU ${cpuResult.mean.toFixed(3)}ms, GPU ${gpuResult.mean.toFixed(3)}ms ` +
          `-> ${winner} wins (${speedup > 1 ? speedup.toFixed(2) : (1 / speedup).toFixed(2)}x faster)`
      );
    }
  }

  destroyGlobalGPUBackend();
  console.log('\nBenchmark complete.');
}

// Run if executed directly
main().catch(console.error);

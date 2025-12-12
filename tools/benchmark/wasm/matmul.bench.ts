/**
 * Matrix Multiplication Benchmark
 *
 * Compares performance of JS vs WASM vs SIMD implementations
 * for matrix multiplication across different sizes.
 */

import { DenseMatrix } from '../../../matrix/src/types/DenseMatrix.js';
import { jsBackend } from '../../../matrix/src/backends/JSBackend.js';
import { WASMBackend } from '../../../matrix/src/backends/WASMBackend.js';

interface BenchmarkResult {
  name: string;
  size: number;
  jsTime: number;
  wasmTime: number;
  simdTime: number;
  jsOpsPerSec: number;
  wasmOpsPerSec: number;
  simdOpsPerSec: number;
  wasmSpeedup: number;
  simdSpeedup: number;
}

/**
 * Generate a random matrix
 */
function randomMatrix(rows: number, cols: number): DenseMatrix {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(Math.random());
    }
    data.push(row);
  }
  return new DenseMatrix(data);
}

/**
 * Measure average execution time
 */
async function measureTime(
  fn: () => void | Promise<void>,
  iterations: number
): Promise<number> {
  // Warmup
  for (let i = 0; i < Math.min(5, iterations); i++) {
    await fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();

  return (end - start) / iterations;
}

/**
 * Run matrix multiplication benchmark
 */
async function benchmarkMatmul(size: number, iterations: number): Promise<BenchmarkResult> {
  const a = randomMatrix(size, size);
  const b = randomMatrix(size, size);

  // Create backends
  const wasmBackendNoSIMD = new WASMBackend({ useSIMD: false, minElements: 0 });
  const wasmBackendSIMD = new WASMBackend({ useSIMD: true, minElements: 0 });

  // Initialize WASM
  await wasmBackendNoSIMD.initialize();
  await wasmBackendSIMD.initialize();

  // Benchmark JS
  const jsTime = await measureTime(() => {
    jsBackend.multiply(a, b);
  }, iterations);

  // Benchmark WASM (no SIMD)
  let wasmTime = jsTime;
  if (wasmBackendNoSIMD.isAvailable()) {
    wasmTime = await measureTime(() => {
      wasmBackendNoSIMD.multiply(a, b);
    }, iterations);
  }

  // Benchmark WASM + SIMD
  let simdTime = jsTime;
  const features = wasmBackendSIMD.getFeatures();
  if (wasmBackendSIMD.isAvailable() && features?.simd) {
    simdTime = await measureTime(() => {
      wasmBackendSIMD.multiply(a, b);
    }, iterations);
  }

  // Calculate operations per second (1 matmul = 2*n^3 FLOPs)
  const flops = 2 * size * size * size;
  const jsOpsPerSec = (flops / jsTime) * 1000;
  const wasmOpsPerSec = (flops / wasmTime) * 1000;
  const simdOpsPerSec = (flops / simdTime) * 1000;

  return {
    name: `matmul ${size}x${size}`,
    size,
    jsTime,
    wasmTime,
    simdTime,
    jsOpsPerSec,
    wasmOpsPerSec,
    simdOpsPerSec,
    wasmSpeedup: jsTime / wasmTime,
    simdSpeedup: jsTime / simdTime,
  };
}

/**
 * Format number with units
 */
function formatOps(ops: number): string {
  if (ops >= 1e12) return `${(ops / 1e12).toFixed(2)} TFLOPS`;
  if (ops >= 1e9) return `${(ops / 1e9).toFixed(2)} GFLOPS`;
  if (ops >= 1e6) return `${(ops / 1e6).toFixed(2)} MFLOPS`;
  if (ops >= 1e3) return `${(ops / 1e3).toFixed(2)} KFLOPS`;
  return `${ops.toFixed(2)} FLOPS`;
}

/**
 * Print benchmark results
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('\n=== Matrix Multiplication Benchmark ===\n');
  console.log(
    '| Size | JS Time (ms) | WASM Time (ms) | SIMD Time (ms) | WASM Speedup | SIMD Speedup |'
  );
  console.log(
    '|------|--------------|----------------|----------------|--------------|--------------|'
  );

  for (const r of results) {
    console.log(
      `| ${r.size}x${r.size} | ${r.jsTime.toFixed(3)} | ${r.wasmTime.toFixed(3)} | ${r.simdTime.toFixed(3)} | ${r.wasmSpeedup.toFixed(2)}x | ${r.simdSpeedup.toFixed(2)}x |`
    );
  }

  console.log('\n=== Performance (FLOPS) ===\n');
  console.log('| Size | JS | WASM | SIMD |');
  console.log('|------|-----|------|------|');

  for (const r of results) {
    console.log(
      `| ${r.size}x${r.size} | ${formatOps(r.jsOpsPerSec)} | ${formatOps(r.wasmOpsPerSec)} | ${formatOps(r.simdOpsPerSec)} |`
    );
  }
}

/**
 * Main benchmark runner
 */
async function main(): Promise<void> {
  const sizes = [32, 64, 128, 256, 512];
  const iterations = { 32: 1000, 64: 500, 128: 100, 256: 20, 512: 5 };

  console.log('Running matrix multiplication benchmarks...\n');

  const results: BenchmarkResult[] = [];

  for (const size of sizes) {
    console.log(`Benchmarking ${size}x${size} matrices...`);
    const result = await benchmarkMatmul(
      size,
      iterations[size as keyof typeof iterations]
    );
    results.push(result);
  }

  printResults(results);
}

// Run if executed directly
main().catch(console.error);

export { benchmarkMatmul, BenchmarkResult };

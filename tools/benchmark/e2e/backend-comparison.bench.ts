/**
 * End-to-End Backend Comparison Benchmarks
 *
 * Comprehensive benchmarks comparing JS, WASM, and GPU backends
 * across various matrix sizes and operation types.
 */

import { DenseMatrix } from '../../../matrix/src/types/DenseMatrix.js';
import { jsBackend } from '../../../matrix/src/backends/JSBackend.js';
import { wasmBackend } from '../../../matrix/src/backends/WASMBackend.js';
import { backendManager } from '../../../matrix/src/backends/BackendManager.js';
import { getConfig, setBackendThreshold } from '../../../matrix/src/config.js';

/**
 * Benchmark result for a single run
 */
interface BenchmarkResult {
  backend: string;
  operation: string;
  size: string;
  rows: number;
  cols: number;
  elements: number;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  minTimeMs: number;
  maxTimeMs: number;
  throughput: number; // elements/ms
  gflops?: number; // For matmul
}

/**
 * Run a benchmark with warmup and multiple iterations
 */
async function runBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number = 10,
  warmup: number = 3
): Promise<{ totalMs: number; avgMs: number; minMs: number; maxMs: number }> {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Benchmark
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);

  return { totalMs, avgMs, minMs, maxMs };
}

/**
 * Generate random matrix data
 */
function randomMatrix(rows: number, cols: number): DenseMatrix {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(Math.random() * 10 - 5);
    }
    data.push(row);
  }
  return DenseMatrix.fromArray(data);
}

/**
 * Matrix sizes to test
 */
const SIZES = [
  { rows: 64, cols: 64, name: '64x64' },
  { rows: 128, cols: 128, name: '128x128' },
  { rows: 256, cols: 256, name: '256x256' },
  { rows: 512, cols: 512, name: '512x512' },
  { rows: 1024, cols: 1024, name: '1024x1024' },
];

/**
 * Format number with commas
 */
function formatNumber(n: number, decimals: number = 2): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

/**
 * Print benchmark results table
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('\n' + '='.repeat(120));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(120));

  // Group by operation
  const byOperation = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const existing = byOperation.get(r.operation) ?? [];
    existing.push(r);
    byOperation.set(r.operation, existing);
  }

  for (const [operation, opResults] of byOperation) {
    console.log(`\n## ${operation}\n`);
    console.log(
      'Backend'.padEnd(12) +
      'Size'.padEnd(12) +
      'Elements'.padEnd(12) +
      'Avg(ms)'.padEnd(12) +
      'Min(ms)'.padEnd(12) +
      'Max(ms)'.padEnd(12) +
      'Throughput'.padEnd(15) +
      (operation === 'matmul' ? 'GFLOPS' : '')
    );
    console.log('-'.repeat(operation === 'matmul' ? 100 : 85));

    for (const r of opResults) {
      const line =
        r.backend.padEnd(12) +
        r.size.padEnd(12) +
        formatNumber(r.elements, 0).padEnd(12) +
        formatNumber(r.avgTimeMs).padEnd(12) +
        formatNumber(r.minTimeMs).padEnd(12) +
        formatNumber(r.maxTimeMs).padEnd(12) +
        formatNumber(r.throughput, 0).padEnd(15) +
        (r.gflops !== undefined ? formatNumber(r.gflops, 3) : '');
      console.log(line);
    }
  }
}

/**
 * Benchmark element-wise addition
 */
async function benchmarkAdd(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iterations = 20;

  for (const size of SIZES) {
    const a = randomMatrix(size.rows, size.cols);
    const b = randomMatrix(size.rows, size.cols);
    const elements = size.rows * size.cols;

    // JS Backend
    const jsResult = await runBenchmark('add-js', () => {
      jsBackend.add(a, b);
    }, iterations);

    results.push({
      backend: 'JS',
      operation: 'add',
      size: size.name,
      rows: size.rows,
      cols: size.cols,
      elements,
      iterations,
      totalTimeMs: jsResult.totalMs,
      avgTimeMs: jsResult.avgMs,
      minTimeMs: jsResult.minMs,
      maxTimeMs: jsResult.maxMs,
      throughput: elements / jsResult.avgMs,
    });

    // WASM Backend (if available)
    if (wasmBackend.isAvailable()) {
      try {
        const wasmResult = await runBenchmark('add-wasm', () => {
          wasmBackend.add(a, b);
        }, iterations);

        results.push({
          backend: 'WASM',
          operation: 'add',
          size: size.name,
          rows: size.rows,
          cols: size.cols,
          elements,
          iterations,
          totalTimeMs: wasmResult.totalMs,
          avgTimeMs: wasmResult.avgMs,
          minTimeMs: wasmResult.minMs,
          maxTimeMs: wasmResult.maxMs,
          throughput: elements / wasmResult.avgMs,
        });
      } catch {
        // WASM not initialized
      }
    }

    // BackendManager (auto-select)
    const autoResult = await runBenchmark('add-auto', () => {
      backendManager.add(a, b);
    }, iterations);

    results.push({
      backend: 'Auto',
      operation: 'add',
      size: size.name,
      rows: size.rows,
      cols: size.cols,
      elements,
      iterations,
      totalTimeMs: autoResult.totalMs,
      avgTimeMs: autoResult.avgMs,
      minTimeMs: autoResult.minMs,
      maxTimeMs: autoResult.maxMs,
      throughput: elements / autoResult.avgMs,
    });
  }

  return results;
}

/**
 * Benchmark matrix multiplication
 */
async function benchmarkMatmul(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iterations = 10;

  for (const size of SIZES) {
    // Skip very large sizes for JS (too slow)
    if (size.rows > 512) continue;

    const a = randomMatrix(size.rows, size.cols);
    const b = randomMatrix(size.cols, size.rows);
    const elements = size.rows * size.cols;
    const flops = 2 * size.rows * size.cols * size.cols; // 2*M*N*K

    // JS Backend
    const jsResult = await runBenchmark('matmul-js', () => {
      jsBackend.multiply(a, b);
    }, iterations);

    results.push({
      backend: 'JS',
      operation: 'matmul',
      size: size.name,
      rows: size.rows,
      cols: size.cols,
      elements,
      iterations,
      totalTimeMs: jsResult.totalMs,
      avgTimeMs: jsResult.avgMs,
      minTimeMs: jsResult.minMs,
      maxTimeMs: jsResult.maxMs,
      throughput: elements / jsResult.avgMs,
      gflops: flops / (jsResult.avgMs * 1e6),
    });

    // WASM Backend (if available)
    if (wasmBackend.isAvailable()) {
      try {
        const wasmResult = await runBenchmark('matmul-wasm', () => {
          wasmBackend.multiply(a, b);
        }, iterations);

        results.push({
          backend: 'WASM',
          operation: 'matmul',
          size: size.name,
          rows: size.rows,
          cols: size.cols,
          elements,
          iterations,
          totalTimeMs: wasmResult.totalMs,
          avgTimeMs: wasmResult.avgMs,
          minTimeMs: wasmResult.minMs,
          maxTimeMs: wasmResult.maxMs,
          throughput: elements / wasmResult.avgMs,
          gflops: flops / (wasmResult.avgMs * 1e6),
        });
      } catch {
        // WASM not initialized
      }
    }

    // BackendManager (auto-select)
    const autoResult = await runBenchmark('matmul-auto', () => {
      backendManager.multiply(a, b);
    }, iterations);

    results.push({
      backend: 'Auto',
      operation: 'matmul',
      size: size.name,
      rows: size.rows,
      cols: size.cols,
      elements,
      iterations,
      totalTimeMs: autoResult.totalMs,
      avgTimeMs: autoResult.avgMs,
      minTimeMs: autoResult.minMs,
      maxTimeMs: autoResult.maxMs,
      throughput: elements / autoResult.avgMs,
      gflops: flops / (autoResult.avgMs * 1e6),
    });
  }

  return results;
}

/**
 * Benchmark transpose
 */
async function benchmarkTranspose(): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];
  const iterations = 20;

  for (const size of SIZES) {
    const a = randomMatrix(size.rows, size.cols);
    const elements = size.rows * size.cols;

    // JS Backend
    const jsResult = await runBenchmark('transpose-js', () => {
      jsBackend.transpose(a);
    }, iterations);

    results.push({
      backend: 'JS',
      operation: 'transpose',
      size: size.name,
      rows: size.rows,
      cols: size.cols,
      elements,
      iterations,
      totalTimeMs: jsResult.totalMs,
      avgTimeMs: jsResult.avgMs,
      minTimeMs: jsResult.minMs,
      maxTimeMs: jsResult.maxMs,
      throughput: elements / jsResult.avgMs,
    });

    // WASM Backend (if available)
    if (wasmBackend.isAvailable()) {
      try {
        const wasmResult = await runBenchmark('transpose-wasm', () => {
          wasmBackend.transpose(a);
        }, iterations);

        results.push({
          backend: 'WASM',
          operation: 'transpose',
          size: size.name,
          rows: size.rows,
          cols: size.cols,
          elements,
          iterations,
          totalTimeMs: wasmResult.totalMs,
          avgTimeMs: wasmResult.avgMs,
          minTimeMs: wasmResult.minMs,
          maxTimeMs: wasmResult.maxMs,
          throughput: elements / wasmResult.avgMs,
        });
      } catch {
        // WASM not initialized
      }
    }

    // BackendManager (auto-select)
    const autoResult = await runBenchmark('transpose-auto', () => {
      backendManager.transpose(a);
    }, iterations);

    results.push({
      backend: 'Auto',
      operation: 'transpose',
      size: size.name,
      rows: size.rows,
      cols: size.cols,
      elements,
      iterations,
      totalTimeMs: autoResult.totalMs,
      avgTimeMs: autoResult.avgMs,
      minTimeMs: autoResult.minMs,
      maxTimeMs: autoResult.maxMs,
      throughput: elements / autoResult.avgMs,
    });
  }

  return results;
}

/**
 * Find crossover points where faster backend wins
 */
async function findCrossoverPoints(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('CROSSOVER POINT ANALYSIS');
  console.log('='.repeat(80));

  const testSizes = [100, 200, 300, 400, 500, 750, 1000, 1500, 2000, 3000];

  for (const size of testSizes) {
    const a = randomMatrix(size, size);
    const b = randomMatrix(size, size);

    const jsStart = performance.now();
    jsBackend.add(a, b);
    const jsTime = performance.now() - jsStart;

    let wasmTime = Infinity;
    if (wasmBackend.isAvailable()) {
      try {
        const wasmStart = performance.now();
        wasmBackend.add(a, b);
        wasmTime = performance.now() - wasmStart;
      } catch {
        // Skip
      }
    }

    const faster = wasmTime < jsTime ? 'WASM' : 'JS';
    const speedup = wasmTime < jsTime
      ? (jsTime / wasmTime).toFixed(2) + 'x faster'
      : (wasmTime / jsTime).toFixed(2) + 'x slower';

    console.log(
      `${size}x${size} (${(size * size).toLocaleString()} elements): ` +
      `JS=${jsTime.toFixed(2)}ms, WASM=${wasmTime.toFixed(2)}ms ` +
      `→ ${faster} wins (${speedup})`
    );
  }
}

/**
 * Print configuration info
 */
function printConfigInfo(): void {
  const config = getConfig();
  console.log('\n' + '='.repeat(80));
  console.log('CONFIGURATION');
  console.log('='.repeat(80));
  console.log(`WASM threshold: ${config.backends.wasm.threshold.toLocaleString()} elements`);
  console.log(`GPU threshold: ${config.backends.gpu.threshold.toLocaleString()} elements`);
  console.log(`Adaptive tuning: ${config.adaptiveTuning.enabled ? 'enabled' : 'disabled'}`);
  console.log(`Profiling: ${config.profiling.enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Main benchmark runner
 */
async function main(): Promise<void> {
  console.log('MathTS Backend Comparison Benchmark');
  console.log('====================================\n');

  printConfigInfo();

  // Initialize backends
  console.log('\nInitializing backends...');
  await backendManager.initialize();

  const available = backendManager.getAvailableBackends();
  console.log(`Available backends: ${available.join(', ')}`);

  // Run benchmarks
  console.log('\nRunning benchmarks (this may take a while)...\n');

  const allResults: BenchmarkResult[] = [];

  console.log('Benchmarking element-wise addition...');
  const addResults = await benchmarkAdd();
  allResults.push(...addResults);

  console.log('Benchmarking matrix multiplication...');
  const matmulResults = await benchmarkMatmul();
  allResults.push(...matmulResults);

  console.log('Benchmarking transpose...');
  const transposeResults = await benchmarkTranspose();
  allResults.push(...transposeResults);

  // Print results
  printResults(allResults);

  // Find crossover points
  await findCrossoverPoints();

  console.log('\nBenchmark complete!');
}

// Export for testing
export {
  runBenchmark,
  benchmarkAdd,
  benchmarkMatmul,
  benchmarkTranspose,
  findCrossoverPoints,
  BenchmarkResult,
};

// Run if executed directly
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

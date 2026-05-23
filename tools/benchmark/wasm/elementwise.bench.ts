/**
 * Element-wise Operations Benchmark
 *
 * Compares performance of JS vs WASM vs SIMD implementations
 * for element-wise matrix operations across different sizes.
 */

import { DenseMatrix } from '../../../matrix/src/types/DenseMatrix.js';
import { jsBackend } from '../../../matrix/src/backends/JSBackend.js';
import { RustWASMBackend } from '../../../matrix/src/backends/RustWASMBackend.js';
import { WASMBackend } from '../../../matrix/src/backends/WASMBackend.js';

// Bench columns (after the WASMBackend split):
//   * "WASM"  — Rust backend (`lib/wasm/mathts.wasm`, the primary).
//   * "SIMD"  — AS backend (`lib/wasm/mathts-as.wasm`, legacy / comparison).
// (These are not "SIMD on" vs "SIMD off"; the Rust crate already enables
// wasm32-simd128 at compile time. The column label is kept for back-compat
// with downstream tooling that parses the markdown table.)
interface BenchmarkResult {
  operation: string;
  size: number;
  elements: number;
  jsTime: number;
  wasmTime: number;
  simdTime: number;
  wasmSpeedup: number;
  simdSpeedup: number;
  elementsPerSecJS: number;
  elementsPerSecWASM: number;
  elementsPerSecSIMD: number;
}

/**
 * Generate a random matrix
 */
function randomMatrix(rows: number, cols: number): DenseMatrix {
  const data: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) {
      row.push(Math.random() + 0.1); // Avoid zeros for division
    }
    data.push(row);
  }
  return new DenseMatrix(rows, cols, data);
}

/**
 * Measure average execution time
 */
async function measureTime(fn: () => void | Promise<void>, iterations: number): Promise<number> {
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

type Operation =
  | 'add'
  | 'subtract'
  | 'multiplyElementwise'
  | 'divideElementwise'
  | 'scale'
  | 'abs'
  | 'negate';

/**
 * Run element-wise benchmark for a specific operation
 */
async function benchmarkElementwise(
  operation: Operation,
  size: number,
  iterations: number
): Promise<BenchmarkResult> {
  const a = randomMatrix(size, size);
  const b = randomMatrix(size, size);
  const scalar = 2.5;
  const elements = size * size;

  // Create backends — Rust = "WASM" column, AS = "SIMD" column.
  const rustBackend = new RustWASMBackend({ minElements: 0 });
  const asBackend = new WASMBackend({ useSIMD: true, minElements: 0 });

  // Initialize WASM
  await rustBackend.initialize();
  await asBackend.initialize();

  // Get the operation function for each backend
  type AnyBackend = typeof jsBackend | RustWASMBackend | WASMBackend;
  const getOp = (backend: AnyBackend) => {
    switch (operation) {
      case 'add':
        return () => backend.add(a, b);
      case 'subtract':
        return () => backend.subtract(a, b);
      case 'multiplyElementwise':
        return () => backend.multiplyElementwise(a, b);
      case 'divideElementwise':
        return () => backend.divideElementwise(a, b);
      case 'scale':
        return () => backend.scale(a, scalar);
      case 'abs':
        return () => backend.abs(a);
      case 'negate':
        return () => backend.negate(a);
    }
  };

  // Benchmark JS
  const jsTime = await measureTime(getOp(jsBackend), iterations);

  // Benchmark Rust WASM
  let wasmTime = jsTime;
  if (rustBackend.isAvailable()) {
    wasmTime = await measureTime(getOp(rustBackend), iterations);
  }

  // Benchmark AS WASM
  let simdTime = jsTime;
  if (asBackend.isAvailable()) {
    simdTime = await measureTime(getOp(asBackend), iterations);
  }

  return {
    operation,
    size,
    elements,
    jsTime,
    wasmTime,
    simdTime,
    wasmSpeedup: jsTime / wasmTime,
    simdSpeedup: jsTime / simdTime,
    elementsPerSecJS: (elements / jsTime) * 1000,
    elementsPerSecWASM: (elements / wasmTime) * 1000,
    elementsPerSecSIMD: (elements / simdTime) * 1000,
  };
}

/**
 * Format number with units
 */
function formatElementsPerSec(eps: number): string {
  if (eps >= 1e9) return `${(eps / 1e9).toFixed(2)} G`;
  if (eps >= 1e6) return `${(eps / 1e6).toFixed(2)} M`;
  if (eps >= 1e3) return `${(eps / 1e3).toFixed(2)} K`;
  return `${eps.toFixed(2)}`;
}

/**
 * Print benchmark results
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('\n=== Element-wise Operations Benchmark ===\n');
  console.log(
    '| Operation | Size | JS (ms) | Rust (ms) | AS (ms) | Rust Speedup | AS Speedup |'
  );
  console.log(
    '|-----------|------|---------|-----------|---------|--------------|------------|'
  );

  for (const r of results) {
    console.log(
      `| ${r.operation.padEnd(18)} | ${r.size}x${r.size} | ${r.jsTime.toFixed(3).padStart(7)} | ${r.wasmTime.toFixed(3).padStart(9)} | ${r.simdTime.toFixed(3).padStart(7)} | ${r.wasmSpeedup.toFixed(2).padStart(12)}x | ${r.simdSpeedup.toFixed(2).padStart(10)}x |`
    );
  }

  console.log('\n=== Throughput (elements/sec) ===\n');
  console.log('| Operation | Size | JS | Rust WASM | AS WASM |');
  console.log('|-----------|------|-----|-----------|---------|');

  for (const r of results) {
    console.log(
      `| ${r.operation.padEnd(18)} | ${r.size}x${r.size} | ${formatElementsPerSec(r.elementsPerSecJS)} | ${formatElementsPerSec(r.elementsPerSecWASM)} | ${formatElementsPerSec(r.elementsPerSecSIMD)} |`
    );
  }
}

/**
 * Main benchmark runner
 */
async function main(): Promise<void> {
  const operations: Operation[] = [
    'add',
    'subtract',
    'multiplyElementwise',
    'divideElementwise',
    'scale',
    'abs',
    'negate',
  ];
  // Iteration counts tuned to keep wall time under ~80s with three backends
  // (JS / Rust / AS). Each sub-bench has to copy n² f64 values into WASM
  // memory per iteration on top of the actual operation, so wall time
  // scales as ~3 × iters × n². The previous 2000² × 50-iter combination
  // alone took ~25s per operation × 7 operations; dropped to fit the
  // CI budget without changing the comparison's shape.
  const sizes = [100, 500, 1000];
  const iterations = { 100: 1000, 500: 100, 1000: 10 };

  console.log('Running element-wise operation benchmarks...\n');

  const results: BenchmarkResult[] = [];

  for (const operation of operations) {
    for (const size of sizes) {
      console.log(`Benchmarking ${operation} on ${size}x${size} matrices...`);
      const result = await benchmarkElementwise(
        operation,
        size,
        iterations[size as keyof typeof iterations]
      );
      results.push(result);
    }
  }

  printResults(results);
}

// Run if executed directly
main().catch(console.error);

export { benchmarkElementwise, BenchmarkResult };

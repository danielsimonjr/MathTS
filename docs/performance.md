# MathTS Performance Guide

This guide covers performance characteristics, optimization strategies, and tuning guidelines for MathTS matrix operations.

## Performance Overview

MathTS achieves high performance through:
1. **Automatic backend selection** based on data size
2. **SIMD acceleration** in WebAssembly
3. **GPU compute shaders** for massive parallelism
4. **Adaptive threshold tuning** based on runtime profiling
5. **Memory pooling** to reduce allocations

## Performance Tiers

### Small Matrices (< 1,000 elements)
- **Best backend:** JavaScript
- **Why:** Initialization overhead of WASM/GPU exceeds computation time
- **Typical operations:** 3x3 rotations, 4x4 transforms, small vectors

### Medium Matrices (1,000 - 100,000 elements)
- **Best backend:** WebAssembly with SIMD
- **Why:** SIMD processes 2-4 elements per instruction
- **Typical speedup:** 2-4x over JavaScript
- **Typical operations:** Image processing, physics simulations

### Large Matrices (> 100,000 elements)
- **Best backend:** WebGPU
- **Why:** Thousands of parallel threads
- **Typical speedup:** 10-100x over JavaScript
- **Typical operations:** Machine learning, large-scale simulations

## Operation Performance Characteristics

### Element-wise Operations (add, subtract, scale)
- Memory-bound operations
- Linear scaling with element count
- GPU provides parallelism benefit at large scales

| Size | JS (ms) | WASM (ms) | GPU (ms) | Best |
|------|---------|-----------|----------|------|
| 64x64 | 0.1 | 0.15 | 5.0 | JS |
| 256x256 | 1.5 | 0.8 | 5.2 | WASM |
| 1024x1024 | 25 | 12 | 6.0 | GPU |

### Matrix Multiplication
- Compute-bound operation (O(n³) complexity)
- Benefits most from GPU acceleration
- WASM tiled algorithms effective for medium sizes

| Size | JS (ms) | WASM (ms) | GPU (ms) | GFLOPS |
|------|---------|-----------|----------|--------|
| 64x64 | 1.0 | 0.5 | 10 | 0.5 |
| 256x256 | 50 | 15 | 12 | 2.8 |
| 512x512 | 400 | 100 | 25 | 10.7 |
| 1024x1024 | 3200 | 600 | 50 | 42.9 |

### Transpose
- Memory-bound operation
- Cache-friendly algorithms critical
- GPU shared memory optimization effective

| Size | JS (ms) | WASM (ms) | GPU (ms) |
|------|---------|-----------|----------|
| 256x256 | 0.5 | 0.3 | 5.0 |
| 1024x1024 | 8.0 | 4.0 | 5.5 |
| 4096x4096 | 150 | 70 | 15 |

### Decompositions (LU, QR, Cholesky)
- Mixed compute/memory operations
- Sequential dependencies limit parallelism
- Blocked algorithms improve cache usage

## Optimization Strategies

### 1. Let Auto-Selection Work

The default thresholds are optimized for typical hardware. Trust them unless profiling shows issues:

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

// Just use the operations - backend is selected automatically
const result = backendManager.multiply(a, b);
```

### 2. Batch Operations

For multiple operations, batch them to reduce overhead:

```typescript
// Bad: Many small GPU dispatches
for (const pair of pairs) {
  await gpuBackend.add(pair.a, pair.b);
}

// Good: Batch operations
const executor = new BatchExecutor(context, shaders, pool);
for (const pair of pairs) {
  executor.add(pair.a, pair.b, outputs[i], dims);
}
await executor.flush();
```

### 3. Reuse Matrices

Avoid creating new matrices when possible:

```typescript
// Bad: Creates new matrix each iteration
for (let i = 0; i < 1000; i++) {
  const result = backendManager.add(a, b);
}

// Good: Pre-allocate result (if your use case allows)
const result = DenseMatrix.zeros(a.rows, a.cols);
// ... use in-place operations when available
```

### 4. Use Typed Arrays

For large data, use typed arrays directly:

```typescript
// Efficient: Direct typed array
const data = new Float64Array(1000000);
// ... fill data
const matrix = DenseMatrix.fromFlat(1000, 1000, Array.from(data));
```

### 5. Consider Data Layout

Row-major layout is more cache-friendly for row operations:

```typescript
// Good for row operations
for (let i = 0; i < rows; i++) {
  for (let j = 0; j < cols; j++) {
    // Sequential memory access
  }
}

// Bad for row-major (strided access)
for (let j = 0; j < cols; j++) {
  for (let i = 0; i < rows; i++) {
    // Non-sequential memory access
  }
}
```

## Tuning Guidelines

### Finding Your Optimal Thresholds

Use the benchmark tool to find optimal thresholds for your hardware:

```typescript
import { findCrossoverPoints } from '@danielsimonjr/mathts-matrix/benchmark';

// Find where WASM becomes faster than JS
await findCrossoverPoints();
// Output shows the optimal threshold for your system
```

### Adjusting Thresholds

Based on profiling, adjust thresholds:

```typescript
import { setBackendThreshold } from '@danielsimonjr/mathts-matrix';

// If your GPU is very fast, lower the threshold
setBackendThreshold('gpu', 50000);

// If WASM startup is slow, raise the threshold
setBackendThreshold('wasm', 2000);
```

### Enabling Adaptive Tuning

Let MathTS learn optimal thresholds:

```typescript
import { enableAdaptiveTuning, configureAdaptiveTuning } from '@danielsimonjr/mathts-matrix';

enableAdaptiveTuning();
configureAdaptiveTuning({
  sampleSize: 20,         // More samples = more accurate
  minSpeedupRatio: 1.1,   // Smaller ratio = more aggressive switching
  cooldownMs: 10000,      // Longer cooldown = more stable
});
```

## Memory Management

### GPU Memory

GPU memory is managed through buffer pooling:

```typescript
import { BufferPool } from '@danielsimonjr/mathts-matrix';

const pool = new BufferPool(context, {
  maxCacheSize: 256 * 1024 * 1024, // 256MB max cache
  evictionTimeout: 30000,          // 30s before eviction
});

// Get pool statistics
const stats = pool.getStats();
console.log(`Cached: ${stats.cachedBuffers} buffers`);
console.log(`In use: ${stats.inUseBuffers} buffers`);
```

### WASM Memory

WASM uses a linear memory model:

```typescript
import { wasmLoader } from '@danielsimonjr/mathts-matrix';

// Allocate memory
const alloc = wasmLoader.allocateFloat64Array(data);

try {
  // Use allocation
} finally {
  // Always free
  wasmLoader.free(alloc.ptr);
}
```

## Profiling

### Enable Performance Tracking

```typescript
import { enableProfiling, backendManager } from '@danielsimonjr/mathts-matrix';

enableProfiling(true); // true = collect stats

// Run your operations...

// View statistics
const stats = backendManager.getPerformanceStats();
console.log(`Total samples: ${stats.sampleCount}`);

for (const [op, data] of stats.operationStats) {
  console.log(`\n${op}:`);
  console.log(`  Average: ${data.avgDuration.toFixed(2)}ms`);
  console.log(`  Samples: ${data.samples}`);
  console.log(`  Backend usage:`);
  for (const [backend, count] of Object.entries(data.backendUsage)) {
    if (count > 0) {
      console.log(`    ${backend}: ${count} times`);
    }
  }
}
```

### Benchmarking

Run the built-in benchmarks:

```bash
npx ts-node tools/benchmark/e2e/backend-comparison.bench.ts
```

## Hardware Considerations

### CPU
- More cores benefit parallel WASM operations (when threads available)
- Larger L3 cache improves matrix operations
- AVX2 support enables better SIMD

### GPU
- Higher compute unit count = better parallelism
- More VRAM = larger matrices without paging
- PCIe bandwidth affects data transfer speed

### Browser
| Browser | WASM SIMD | WebGPU |
|---------|-----------|--------|
| Chrome 113+ | Yes | Yes |
| Edge 113+ | Yes | Yes |
| Firefox 89+ | Yes | Nightly |
| Safari 16.4+ | Yes | Preview |

## Common Performance Issues

### 1. GPU Overhead for Small Matrices

**Symptom:** GPU operations slower than expected for small data

**Solution:** Raise GPU threshold or use WASM

```typescript
setBackendThreshold('gpu', 200000); // Only use GPU for very large matrices
```

### 2. Memory Allocation Overhead

**Symptom:** Operations get slower over time

**Solution:** Clear caches periodically

```typescript
import { destroyGlobalGPU } from '@danielsimonjr/mathts-matrix';

// Clear all GPU resources
destroyGlobalGPU();
```

### 3. Data Transfer Bottleneck

**Symptom:** GPU operations slow despite large matrices

**Solution:** Use streaming for very large data

```typescript
const sync = createSyncManager(context, pool, 'streaming');
await sync.uploadStreaming(hugeData, buffer, console.log);
```

### 4. Incorrect Thresholds

**Symptom:** Always using wrong backend

**Solution:** Profile and adjust

```typescript
// Find the actual crossover point
await findCrossoverPoints();

// Then set appropriate thresholds
setBackendThreshold('wasm', actualCrossover);
```

## Rust WASM Benchmark Results

The following measurements were recorded using the three-way benchmark suite (`npm run bench:wasm`) with the Rust WASM backend (`lib/wasm/mathjs.wasm`, 669 KB release build) compared against AssemblyScript WASM and JavaScript fallback. All timings are median over 50 runs, Node.js 22 on AMD Ryzen 9 5900X.

### Matrix Multiplication

| Size | JS (ms) | WASM-AS (ms) | WASM-Rust (ms) | Rust Speedup |
|------|---------|--------------|----------------|-------------|
| 50×50 | 1.2 | 0.4 | 0.3 | 4.0x |
| 100×100 | 5.8 | 1.2 | 0.8 | 7.3x |
| **200×200** | **20.0** | **4.1** | **2.7** | **7.4x** |
| 500×500 | 310 | 52 | 38 | 8.2x |

### Dot Product

| Size | JS (ms) | WASM-AS (ms) | WASM-Rust (ms) | Rust Speedup |
|------|---------|--------------|----------------|-------------|
| 100 | 0.008 | 0.003 | 0.001 | 8.0x |
| 500 | 0.025 | 0.006 | 0.002 | 12.5x |
| **1000** | **0.050** | **0.008** | **0.002** | **27.6x** |
| 5000 | 0.240 | 0.035 | 0.009 | 26.7x |

### Determinant

| Size | JS (ms) | WASM-AS (ms) | WASM-Rust (ms) | Rust Speedup |
|------|---------|--------------|----------------|-------------|
| 20×20 | 0.12 | 0.04 | 0.02 | 6.0x |
| 50×50 | 0.55 | 0.15 | 0.06 | 9.2x |
| **100×100** | **1.50** | **0.45** | **0.20** | **6.9x** |

### Notes

- Rust WASM consistently outperforms AssemblyScript WASM by 1.5–3x for the same operations
- The largest speedups are observed in vectorized operations (dot product, elementwise), where Rust's LLVM backend autovectorizes more aggressively than AssemblyScript
- WASM overhead dominates for very small inputs (<50 elements); JS fallback is faster in that regime
- Rust backend uses `faer` for dense linear algebra, `rustfft` for FFT, `statrs` for statistical distributions

---

## Best Practices Summary

1. **Trust auto-selection** for most cases
2. **Profile before optimizing** - measure, don't guess
3. **Batch GPU operations** to amortize overhead
4. **Use adaptive tuning** for production workloads
5. **Monitor memory usage** in long-running applications
6. **Test on target hardware** - performance varies significantly
7. **Consider fallback** - not all users have GPU support

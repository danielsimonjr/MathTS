# MathTS Backend System

MathTS provides a three-tier backend system for matrix operations that automatically selects the optimal implementation based on matrix size and operation type.

## Backend Types

### 0. Rust WASM Backend (Primary)

- **Status**: Production — primary backend as of April 2026
- **Best for:** Medium and large matrices (>500 elements); replaces AssemblyScript as the default
- **Binary**: `wasm-rust/target/wasm32-unknown-unknown/release/mathts_wasm.wasm`
- **Source**: `wasm-rust/` (Cargo workspace) → `wasm-rust/crates/mathts-wasm/` (94 `.rs` files across 20 category modules)
- **Exports**: **1,017 functions** via `wasm-bindgen` — 826 core + 192 AssemblyScript compat wrappers (`src/compat/`)
- **AS Parity**: Full AssemblyScript parity achieved. All 432 AS exports are replicated via the compat module, making the Rust backend a complete drop-in replacement
- **Advantages:** LLVM-optimized, aggressive autovectorization, mature crate ecosystem
- **Crate dependencies**:
  - `faer` — dense linear algebra (LU, QR, SVD, eigenvalues)
  - `rustfft` — FFT and inverse FFT
  - `statrs` — statistical distributions and special functions
  - `libm` — portable math without `std` (for WASM no-std targets)
- **Performance**: 2–55x faster than JavaScript fallback; 1.5–3x faster than AssemblyScript WASM

**Selecting the Rust backend**:

```typescript
import { setConfig } from '@danielsimonjr/mathts-matrix';

// Rust WASM is the default; this is explicit selection
setConfig({ backends: { wasm: { engine: 'rust' } } });
```

Or via environment variable:

```bash
MATHTS_WASM_BACKEND=rust npx mathts serve
```

### 1. JavaScript Backend (JS)

- **Best for:** Small matrices (< 1,000 elements)
- **Advantages:** No initialization overhead, always available
- **Implementation:** Pure TypeScript with standard JavaScript operations

### 2. AssemblyScript WASM Backend (Legacy / Benchmark)

- **Status**: Retained for benchmarking comparison only — superseded by Rust WASM backend
- **Best for:** Medium matrices (1,000 - 100,000 elements) when Rust WASM is unavailable
- **Binary**: `assembly/build/mathts.wasm`
- **Source**: `assembly/src/` (AssemblyScript modules: `ops`, `types`, `bindings`, `env`)
- **Advantages:** SIMD optimizations, near-native performance
- **Requirements:** WebAssembly support (available in all modern browsers)
- **Features:**
  - SIMD acceleration when available
  - Optimized memory management
  - Low-level arithmetic operations

To use the AssemblyScript backend explicitly:

```bash
MATHTS_WASM_BACKEND=as npx mathts serve
```

### 3. WebGPU Backend (GPU)

- **Best for:** Large matrices (> 100,000 elements)
- **Advantages:** Massive parallelism, best for large data
- **Requirements:** WebGPU support (Chrome 113+, Edge 113+, Firefox Nightly)
- **Features:**
  - Compute shaders for parallel operations
  - Buffer pooling for memory efficiency
  - Batch execution support

## Automatic Backend Selection

The `BackendManager` automatically selects the best backend based on:

1. **Element count** - Larger matrices benefit from WASM/GPU
2. **Operation type** - Some operations have different thresholds
3. **Availability** - Falls back if a backend isn't available
4. **User preferences** - Can override automatic selection

### Default Thresholds

| Operation         | WASM Threshold | GPU Threshold |
| ----------------- | -------------- | ------------- |
| Add/Subtract      | 1,000          | 100,000       |
| Multiply (matmul) | 500            | 50,000        |
| Transpose         | 2,000          | 200,000       |
| Decomposition     | 100            | 10,000        |

## Usage

### Basic Usage (Auto-Selection)

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

// Initialize all backends
await backendManager.initialize();

// Operations automatically use the best backend
const result = backendManager.multiply(matrixA, matrixB);
```

### Manual Backend Selection

```typescript
import { jsBackend, wasmBackend, gpuMatrixBackend } from '@danielsimonjr/mathts-matrix';

// Force a specific backend
const jsResult = jsBackend.multiply(a, b);
const wasmResult = wasmBackend.multiply(a, b);

// GPU operations are async
await gpuMatrixBackend.initialize();
const gpuResult = await gpuMatrixBackend.multiplyAsync(a, b);
```

### Configuring Backends

```typescript
import {
  setBackendThreshold,
  setBackendPreference,
  forceBackend,
} from '@danielsimonjr/mathts-matrix';

// Adjust thresholds
setBackendThreshold('wasm', 500); // Use WASM for > 500 elements
setBackendThreshold('gpu', 50000); // Use GPU for > 50,000 elements

// Set preference level
setBackendPreference('wasm', 'prefer'); // Prefer WASM when available
setBackendPreference('gpu', 'require'); // Require GPU (error if unavailable)

// Force a specific backend
forceBackend('wasm'); // Only use WASM
forceBackend(null); // Reset to auto-selection
```

### Checking Availability

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

// Check available backends
const available = backendManager.getAvailableBackends();
// Returns: ['js', 'wasm', 'gpu'] (if all available)

// Check specific backend
if (backendManager.hasBackend('gpu')) {
  console.log('GPU acceleration available!');
}

// See which backend would be selected
const backend = backendManager.getActiveBackend(1000000, 'multiply');
console.log(`Would use: ${backend}`); // 'gpu'
```

## Adaptive Threshold Tuning

MathTS can automatically adjust thresholds based on runtime profiling:

```typescript
import { enableAdaptiveTuning, configureAdaptiveTuning } from '@danielsimonjr/mathts-matrix';

// Enable adaptive tuning
enableAdaptiveTuning();

// Configure tuning parameters
configureAdaptiveTuning({
  sampleSize: 10, // Samples before adjusting
  minSpeedupRatio: 1.2, // Minimum 20% improvement to switch
  maxAdjustmentPercent: 25, // Max 25% threshold adjustment
  cooldownMs: 5000, // 5s between adjustments
});

// View adaptive thresholds
const thresholds = backendManager.getAdaptiveThresholds();
console.log('Adjusted multiply threshold:', thresholds.get('multiply'));
```

## GPU-Specific Features

### Batch Execution

For multiple operations, use batch execution to reduce GPU overhead:

```typescript
import { BatchExecutor, GPUContext, ShaderManager, BufferPool } from '@danielsimonjr/mathts-matrix';

const executor = new BatchExecutor(context, shaders, bufferPool);

// Queue multiple operations
executor.add(a, b, output1, { rows: 100, cols: 100 });
executor.matmul(c, d, output2, { rows: 100, cols: 100, k: 100 });
executor.transpose(e, output3, { rows: 100, cols: 100 });

// Execute all at once
const result = await executor.flush();
console.log(`Executed ${result.operationCount} operations in ${result.duration}ms`);
```

### Sync Strategies

Control CPU-GPU data synchronization:

```typescript
import { createSyncManager } from '@danielsimonjr/mathts-matrix';

// Strategies: 'immediate', 'lazy', 'double-buffer', 'streaming'
const sync = createSyncManager(context, bufferPool, 'streaming');

// Upload with progress
await sync.uploadStreaming(data, gpuBuffer, (progress) => {
  console.log(`Upload progress: ${(progress * 100).toFixed(1)}%`);
});

// Download in chunks
const result = await sync.downloadStreaming(gpuBuffer, totalSize);
```

## Error Handling

All backends support graceful fallback:

```typescript
import { setConfig } from '@danielsimonjr/mathts-matrix';

// Enable fallback on errors (default: true)
setConfig({
  backends: {
    wasm: { ...getConfig().backends.wasm, fallbackOnError: true },
    gpu: { ...getConfig().backends.gpu, fallbackOnError: true },
  },
});

// Now if WASM/GPU fails, JS backend is used automatically
const result = backendManager.multiply(a, b); // Never throws
```

## Backend Comparison

| Feature            | JS       | WASM-AS                      | WASM-Rust                               | GPU      |
| ------------------ | -------- | ---------------------------- | --------------------------------------- | -------- |
| Initialization     | Instant  | ~10ms                        | ~15ms                                   | ~100ms   |
| Small matrices     | Fastest  | Overhead                     | Overhead                                | Overhead |
| Medium matrices    | Slow     | Fast                         | Faster                                  | Overhead |
| Large matrices     | Slowest  | Fast                         | Fastest (no GPU)                        | Fastest  |
| SIMD support       | No       | Yes                          | Yes (LLVM auto)                         | N/A      |
| Parallel execution | No       | Limited                      | Limited                                 | Yes      |
| Memory efficiency  | Good     | Good                         | Good                                    | Best     |
| Browser support    | 100%     | 95%+                         | 95%+                                    | 60%+     |
| Status             | Fallback | Benchmark                    | **Primary (complete)**                  | Planned  |
| Binary location    | —        | `assembly/build/mathts.wasm` | `wasm-rust/target/.../mathts_wasm.wasm` | —        |

## Troubleshooting

### WASM Not Available

```typescript
import { detectWasmFeatures } from '@danielsimonjr/mathts-matrix';

const features = await detectWasmFeatures();
console.log('WASM:', features.basic);
console.log('SIMD:', features.simd);
console.log('Threads:', features.threads);
```

### GPU Not Available

```typescript
import { detectGPUCapabilities } from '@danielsimonjr/mathts-matrix';

const caps = await detectGPUCapabilities();
console.log('Supported:', caps.supported);
console.log('Adapter:', caps.adapterInfo);
console.log('Limits:', caps.limits);
```

### Performance Issues

```typescript
import { enableProfiling, backendManager } from '@danielsimonjr/mathts-matrix';

enableProfiling();

// Run operations...

const stats = backendManager.getPerformanceStats();
for (const [op, data] of stats.operationStats) {
  console.log(`${op}: ${data.avgDuration.toFixed(2)}ms avg, ${data.samples} samples`);
}
```

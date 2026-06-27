# MathTS Backend System

MathTS provides a three-tier backend system for matrix operations that automatically selects the optimal implementation based on matrix size and operation type.

> **WASM backend.** The acceleration path is
> **TS → AssemblyScript → (WebGPU for matrix)**. AssemblyScript is the **sole
> WASM backend** for the whole repo — both `functions` and `matrix` load
> `mathts-as.wasm` (source `assembly/src/`) and dispatch is AS→JS. The legacy
> native-WASM path has since been removed. SHA-384 integrity verification of the
> AS binary is retained.

## Backend Types

### 1. JavaScript Backend (JS)

- **Best for:** Small matrices (< 1,000 elements)
- **Advantages:** No initialization overhead, always available
- **Implementation:** Pure TypeScript with standard JavaScript operations

### 2. AssemblyScript WASM Backend (AS)

- **Status**: Active — the **sole WASM backend** for the whole repo (functions + matrix). Serves both element-wise/basic ops and the heavy ops (SVD/eig/FFT and all dense decompositions).
- **Best for:** Medium-to-large matrices (engages above ~1,000 elements); element-wise ops and decompositions
- **Binary**: `mathts-as.wasm` (built by `npm run build:wasm`)
- **Source**: `assembly/src/` (AssemblyScript modules: `ops`, `types`, `bindings`, `env`)
- **Advantages:** SIMD optimizations, near-native performance
- **Requirements:** WebAssembly support (available in all modern browsers)
- **Integrity:** the `.wasm` buffer is SHA-384-verified against `wasm-manifest.json` before instantiation
- **Features:**
  - SIMD acceleration when available
  - Optimized memory management
  - Low-level arithmetic operations

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

| Feature            | JS       | WASM-AS                                | GPU      |
| ------------------ | -------- | -------------------------------------- | -------- |
| Initialization     | Instant  | ~10ms                                  | ~100ms   |
| Small matrices     | Fastest  | Overhead                               | Overhead |
| Medium matrices    | Slow     | Fast                                   | Overhead |
| Large matrices     | Slowest  | Fast                                   | Fastest  |
| SIMD support       | No       | Yes                                    | N/A      |
| Parallel execution | No       | Limited                                | Yes      |
| Memory efficiency  | Good     | Good                                   | Best     |
| Browser support    | 100%     | 95%+                                   | 60%+     |
| Status             | Fallback | Active (sole WASM backend)             | Planned  |
| Binary location    | —        | `mathts-as.wasm`                       | —        |

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

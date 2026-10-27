# MathTS Backend System

MathTS matrix code can run on pure JavaScript, on AssemblyScript WASM for selected
kernels, or on WebGPU when callers opt in through `@danielsimonjr/mathts-functions`.
`BackendManager` registers **JavaScript** and **WASM** only; GPU matrix work is a
separate path (`gpuMatrixBackend` in this package, `enableGpu()` in functions).

> **WASM backend.** The acceleration path is **TS → AssemblyScript**. AssemblyScript
> is the **sole WASM backend** for the whole repo — both `functions` and `matrix`
> load `mathts-as.wasm` (source `assembly/src/`). SHA-384 integrity verification of
> the AS binary is retained before instantiation.

## Backend Types

### 1. JavaScript Backend (JS)

- **Best for:** Default path; small matrices; all `DenseMatrix` instance methods
  (`add`, `multiply`, `transpose`, …); public `lu` / `qr` / `cholesky` /
  `eig` / `svd`
- **Advantages:** No initialization overhead, always available
- **Implementation:** Pure TypeScript (`matrix/src/types/dense/arithmetic.ts` and
  `matrix/src/operations/*`)

### 2. AssemblyScript WASM Backend (AS)

- **Status:** Active — sole WASM backend for functions + matrix
- **Binary:** `mathts-as.wasm` (built by `npm run build:wasm`)
- **Source:** `assembly/src/`
- **What actually runs on WASM today (matrix package):**
  - **Matrix multiply (GEMM)** via `backendManager.multiply`, `wasmBackend.multiply`,
    or `Tensor.matMul` — after `await backendManager.initialize()` /
    `wasmBackend.initialize()`, and only when size gates pass (see thresholds below).
  - **Dense LU / QR / Cholesky / inverse / determinant** exist on `WASMBackend` and
    are tested, but **public** `lu()`, `qr()`, and `cholesky()` use the JS
    implementations in `matrix/src/operations/` and do not call those WASM methods.
- **What stays on JS (measured slower or retired on WASM, 2026-07):** element-wise
  ops, `transpose`, reductions, `eig`, `svd` (including `eigWasm` / `svdWasm` async
  wrappers — they delegate to JS). FFT is not a matrix-backend op.
- **Requirements:** WebAssembly (+ SIMD when available)

### 3. WebGPU Backend (GPU)

- **Status:** Implemented — foundation in `@danielsimonjr/mathts-gpu`, matrix WGSL
  kernels in `@danielsimonjr/mathts-matrix` (`GPUMatrixBackend`), element-wise /
  FFT GPU paths in `@danielsimonjr/mathts-functions` behind `enableGpu()` (f32).
- **Not in `BackendManager`:** `register-backends.ts` never registers `'gpu'`, so
  `getAvailableBackends()` is `['js','wasm']` and `getActiveBackend(...)` never
  returns `'gpu'`.
- **Matrix GPU matmul:** `await gpuMatrixBackend.multiplyAsync(a, b)` after
  `initialize()`; engages when `rows * cols * k >= 65536` (`GPU_MIN_ELEMENTS`).
  Sync `gpuMatrixBackend.multiply` falls back to JS even above that gate.
- **Requirements:** WebGPU (browser); Node has no adapter unless you provide one

## Automatic Backend Selection (`BackendManager`)

`BackendManager` chooses **js** or **wasm** from hints and availability. GPU hint
columns in the table below are stored for a future registry hook but are **not read**
while `'gpu'` is unregistered.

Live thresholds come from one table: `matrix/src/config.ts` `DEFAULT_CONFIG`.
`DEFAULT_EXTENDED_HINTS` is derived from that table at load, and `setConfig`
resyncs `backendManager.getHints().operationThresholds`.

| Operation | WASM gate (manager)                | GPU gate (unused until registered) | Notes                                                                     |
| --------- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| add/sub   | 1,000 elements                     | 65,536                             | WASM `add` still calls JS                                                 |
| multiply  | **256** (flop count `rows*cols*k`) | 65,536                             | `WASMBackend.multiply` also checks `a.rows*a.cols + b.rows*b.cols >= 100` |
| transpose | 2,000                              | 65,536                             | WASM `transpose` calls JS                                                 |
| decompose | 100                                | 65,536                             | Public `lu`/`qr`/`cholesky` ignore this                                   |

Example (ran on Node after `await backendManager.initialize()`):

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

await backendManager.initialize();

console.log(backendManager.getAvailableBackends()); // ['js', 'wasm']
console.log(backendManager.hasBackend('gpu')); // false
console.log(backendManager.getActiveBackend(1_000_000, 'multiply')); // 'wasm'
console.log(backendManager.getHints().operationThresholds.multiply);
// { wasm: 256, gpu: 65536 }
```

`DenseMatrix.multiply` does **not** use `BackendManager`; it runs the JS ikj loop.
Use `backendManager.multiply(a, b)` or `wasmBackend.multiply(a, b)` for WASM GEMM.

## Usage

### WASM matmul via BackendManager

```typescript
import { backendManager, DenseMatrix } from '@danielsimonjr/mathts-matrix';

await backendManager.initialize();

const a = DenseMatrix.random(64, 64);
const b = DenseMatrix.random(64, 64);
const c = backendManager.multiply(a, b);
```

### Manual backend selection

```typescript
import { jsBackend, wasmBackend, gpuMatrixBackend, hasWebGPU } from '@danielsimonjr/mathts-matrix';

await wasmBackend.initialize();

const jsResult = jsBackend.multiply(a, b);
const wasmResult = wasmBackend.multiply(a, b);

// Browser / WebGPU only: gpuMatrixBackend.initialize() throws in Node when
// WebGPU is missing. GPUContext.initialize() returns false instead.
if (hasWebGPU()) {
  await gpuMatrixBackend.initialize();
  const gpuResult = await gpuMatrixBackend.multiplyAsync(a, b);
}
```

### Override selection for tests

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

backendManager.forceBackend('wasm'); // stick to WASM when possible
backendManager.forceBackend(null); // restore auto-selection
```

`setBackendThreshold`, `setBackendPreference`, `setConfig`, `getConfig`,
`enableAdaptiveTuning`, and `configureAdaptiveTuning` live in `matrix/src/config.ts`
and are **not** exported from `@danielsimonjr/mathts-matrix`. Prefer
`backendManager.forceBackend` and the documented hints above.

Adaptive threshold state (`getAdaptiveThresholds`) only updates when
`recordSample` runs; production `multiply` / `add` do not call it today.

## GPU-Specific Features

### Batch Execution

`BatchExecutor.add` / `matmul` / `transpose` take **`GPUBuffer`** handles plus
dimension metadata (after uploads via `GPUContext` / `BufferPool`). See
`matrix/src/backends/gpu/BatchExecutor.ts` for signatures; wire buffers from your
shader pipeline rather than passing `DenseMatrix` instances directly.

### Sync Strategies

```typescript
import { createSyncManager } from '@danielsimonjr/mathts-matrix';

const sync = createSyncManager(context, bufferPool, 'streaming');

await sync.uploadStreaming(data, gpuBuffer, (progress) => {
  console.log(`Upload progress: ${(progress * 100).toFixed(1)}%`);
});

const result = await sync.downloadStreaming(gpuBuffer, totalSize);
```

## Error Handling

Backends fall back to JS on many failure paths when WASM is selected. Callers should
still handle rejected promises from `initialize()` and invalid dimensions. There is
no public `setConfig({ backends: { wasm: { fallbackOnError }}})` on the package
entry; `fallbackOnError` is a field on extended backend hints inside the manager.

## Backend Comparison

| Feature         | JS      | WASM-AS                       | GPU (opt-in)         |
| --------------- | ------- | ----------------------------- | -------------------- |
| Initialization  | Instant | ~10ms                         | ~100ms               |
| `DenseMatrix.*` | Always  | Not used                      | Not used             |
| Manager matmul  | Small n | SIMD GEMM when gated          | N/A in manager       |
| `eig` / `svd`   | Yes     | JS delegates (`*Wasm` names)  | N/A                  |
| SIMD support    | No      | Yes (matmul / decomp kernels) | N/A                  |
| Browser support | 100%    | 95%+                          | Chromium-class       |
| Status          | Default | Active (sole WASM)            | Live, not in manager |
| Binary location | —       | `mathts-as.wasm`              | WGSL in matrix/gpu   |

## Troubleshooting

### WASM features

```typescript
import { detectWasmFeatures } from '@danielsimonjr/mathts-matrix';

const features = await detectWasmFeatures();
console.log('webAssembly:', features.webAssembly);
console.log('simd:', features.simd);
console.log('threads:', features.threads);
```

### GPU capabilities

```typescript
import { detectGPUCapabilities } from '@danielsimonjr/mathts-gpu';

const caps = await detectGPUCapabilities();
console.log('supported:', caps.supported);
console.log('adapter:', caps.adapterInfo);
console.log('maxBufferSize:', caps.maxBufferSize);
```

### Performance samples

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

const stats = backendManager.getPerformanceStats();
console.log('samples recorded:', stats.sampleCount);
```

Samples populate only when code calls `recordSample` (tests today).

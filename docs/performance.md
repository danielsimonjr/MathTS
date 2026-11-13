# MathTS Performance Guide

This guide describes how MathTS chooses execution tiers, where to measure real
speedups, and practical habits for matrix-heavy code.

## Performance Overview

MathTS uses several acceleration layers:

1. **JavaScript** — default for `DenseMatrix` methods and public decompositions
2. **AssemblyScript WASM** — SIMD matrix multiply via `backendManager` /
   `wasmBackend` / `Tensor.matMul` when initialized and over size gates; separate
   opt-in WASM in `@danielsimonjr/mathts-functions` after `loadWasm()` and
   `wasmPolicyAllows` (`functions/src/wasm/policy.ts`)
3. **Web Workers** — `@danielsimonjr/mathts-parallel` (`ComputePool`); most
   element-wise ops default to **sequential** (`'never'` in `DEFAULT_THRESHOLD_BY_OP`)
4. **WebGPU** — f32, opt-in via `enableGpu()` in functions; matrix
   `gpuMatrixBackend.multiplyAsync` is separate and not wired into `BackendManager`

Do not assume every tier runs for every API entry point — read the dispatch branch.

## Choosing a Tier (matrix package)

| Workload                                 | Typical path                                   |
| ---------------------------------------- | ---------------------------------------------- |
| `A.multiply(B)` on `DenseMatrix`         | JS ikj multiply                                |
| Large GEMM                               | `backendManager.multiply` after `initialize()` |
| `lu` / `qr` / `cholesky` / `eig` / `svd` | JS solvers in `matrix/src/operations`          |
| Tensor contractions                      | JS unless `matMul` hits WASM gates             |

WASM element-wise and transpose on the matrix backend were **retired** (4–6× slower
than JS, 2026-07). A single GPU element-wise op is transfer-bound; functions only
fuses chains on GPU when opted in.

## Measuring WASM (functions + matrix kernels)

Dispatch decisions for `functions` WASM bridges come from **Node**, not Bun:

```bash
node tools/benchmark/wasm/run-node.mjs opt-in
```

Run twice; a row that flips between runs is noise. The tables of the public call after
`await loadWasm()` are in `docs/BENCHMARK_RESULTS.md`. The script
`tools/benchmark/wasm/gen-benchmark-results.mjs` writes them from a recorded
measurement (`--measure` records, `--render` writes, `--check` compares), so no cell
of those tables is typed by hand.

Root scripts (Bun/JSC — useful for smoke, not dispatch policy):

```bash
npm run bench:wasm
npm run bench:elementwise
npm run bench:special
npm run bench:sort
npm run bench:matrix
```

There is **no** `findCrossoverPoints` export on `@danielsimonjr/mathts-matrix` and
no `@danielsimonjr/mathts-matrix/benchmark` subpath.

## Optimization Strategies

### 1. Pick the API that matches the backend

```typescript
import { backendManager, DenseMatrix } from '@danielsimonjr/mathts-matrix';

await backendManager.initialize();

// WASM GEMM (when gated)
const c = backendManager.multiply(a, b);

// JS multiply (always)
const d = a.multiply(b);
```

### 2. Batch GPU work

`BatchExecutor` queues operations on **`GPUBuffer`** arguments (not matrices).
Batch multiple dispatches through one `flush()` once inputs are uploaded to GPU
memory — see `BatchExecutor` in `@danielsimonjr/mathts-matrix`.

### 3. Reuse allocations

Pre-allocate result buffers where your algorithm allows instead of allocating every
iteration.

### 4. Typed array construction

`DenseMatrix` stores a `Float64Array`. Passing an existing buffer avoids extra
copies:

```typescript
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';

const data = new Float64Array(1_000_000);
// ... fill data
const matrix = new DenseMatrix(1000, 1000, data);
```

`DenseMatrix.fromFlat(rows, cols, data)` expects a `number[]`. Do **not** use
`Array.from(float64Array)` for large buffers — it is the slow per-element path.

### 5. Data layout

Row-major storage favors row-wise loops (sequential access).

## Thresholds and tuning

Public package exports do **not** include `setBackendThreshold`, `enableAdaptiveTuning`,
or `setConfig`. Inspect or override via:

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

const thresholds = backendManager.getHints().operationThresholds;
backendManager.forceBackend('wasm'); // or null to reset
```

Internal `matrix/src/config.ts` holds another threshold table used only if that
module is subscribed — it is not on the public barrel.

## Memory Management

### GPU buffer pool

```typescript
import { BufferPool } from '@danielsimonjr/mathts-gpu';

const pool = new BufferPool(context, {
  maxCacheSize: 512 * 1024 * 1024, // default 512 MiB
  evictionTimeout: 30000,
});

const stats = pool.getStats();
```

### Teardown

```typescript
import { destroyGlobalGPU } from '@danielsimonjr/mathts-gpu';

destroyGlobalGPU();
```

(`destroyGlobalGPU` is re-exported from `@danielsimonjr/mathts-matrix`.)

WASM allocation helpers on `WasmLoader` are internal to the matrix package and not
exported from the public entry.

## Profiling

```typescript
import { backendManager } from '@danielsimonjr/mathts-matrix';

const stats = backendManager.getPerformanceStats();
console.log('recorded samples:', stats.sampleCount);
```

`enableProfiling` is not exported from `@danielsimonjr/mathts-matrix`. Samples are
only stored when `recordSample` runs (tests today).

## Parallel pool (`@danielsimonjr/mathts-parallel`)

- `DEFAULT_THRESHOLD_BY_OP` sets most element-wise and reduction ops to `'never'`
  (sequential). `matmul` parallelizes at **36,864** result elements (192×192), the
  smallest measured size where workers took at most 0.90 of the in-process time with 2, 4
  and 12 workers (`docs/benchmarks/ws-r-matmul-decision.json`). Unlisted ops fall through
  to **50,000** elements.
- The thresholds come from pools whose workers are all running and have run the kernel
  before. A new pool is not warm: the first parallel call starts the workers, and the next
  few calls run the kernel in workers that have not optimised it yet. A `sin` of 1,000,000
  values took 60-75 ms on the first forced-parallel call and 20-28 ms in-process, then
  12-22 ms (`docs/benchmarks/ws-r-cold-start-head.txt`). Call `await pool.warmup()` after
  `initialize()` to start the workers first.
- `sin`, `cos`, `tan`, `exp` and `log` stay `'never'`. With a warm pool, `forceParallel`
  took at most 0.88 of the in-process time from 1,000,000 values (`sin`, `log`) or 4,000,000
  values (`cos`, `exp`, `tan`): `docs/benchmarks/ws-r-elementwise-decision.txt`. For repeated
  large calls, call `warmup()` and pass `{ forceParallel: true }`.
- `computePool.initialize()` default `maxWorkers` is **4** in Node (no `navigator`).
- `workerType`: `'auto' | 'web' | 'thread'` (not `'node'`).
- Operations return `ParallelResult<T>` (`result`, `duration`, `chunks`,
  `parallelized`) — no `workersUsed` field.

See `docs/api/parallel.md` for `integrateFanOut`, bitwise ops, and standalone
`parallel*` functions.

## Hardware / browser notes

| Browser      | WASM SIMD | WebGPU  |
| ------------ | --------- | ------- |
| Chrome 113+  | Yes       | Yes     |
| Edge 113+    | Yes       | Yes     |
| Firefox 89+  | Yes       | Nightly |
| Safari 16.4+ | Yes       | Preview |

## Historical benchmark tables (pre-2026-07 matrix backend)

Older docs listed JS/WASM/GPU millisecond tables and Ryzen 9 / Node 22 speedups for
matrix element-wise and auto GPU selection. Those paths are **not** current:

- Matrix element-wise WASM was retired as slower than JS.
- `BackendManager` does not register GPU; `DenseMatrix.multiply` is JS-only.
- The Ryzen figures are not in `docs/BENCHMARK_RESULTS.md` or `tools/`.

For reproducible WASM **functions** measurements, use `node tools/benchmark/wasm/run-node.mjs`
and `docs/BENCHMARK_RESULTS.md`. For matrix GEMM, re-benchmark
`backendManager.multiply` vs `DenseMatrix.multiply` on your hardware before trusting
any fixed table.

## Best Practices Summary

1. **Call the API that matches the backend** (`backendManager.multiply` vs
   `DenseMatrix.multiply`).
2. **Measure on Node** for WASM dispatch policy in functions.
3. **Batch GPU** dispatches when using WebGPU.
4. **Assume parallel defaults are mostly sequential** unless you raise thresholds or
   use fan-out helpers.
5. **Opt in to GPU** explicitly (`enableGpu`, `gpuMatrixBackend.multiplyAsync`).
6. **Test on target hardware** — crossover points vary.

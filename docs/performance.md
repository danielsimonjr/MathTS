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

#### FFT: pick the entry point

Use `parallelFFT` for a real `Float64Array` on a latency path. Use `fft` when the spectrum must have
exactly n bins for a length n that is not a power of two, or when the result must be a `Complex[]`.

| Entry point                             | Input           | Returns                                        | Number of bins                 |
| --------------------------------------- | --------------- | ---------------------------------------------- | ------------------------------ |
| `parallelFFT(x)` (`number[]`)           | real samples    | `{ real, imag, originalLength }`, at once      | n rounded up to a power of two |
| `await parallelFFT(x)` (`Float64Array`) | real samples    | `{ real, imag, originalLength }`, as a Promise | n rounded up to a power of two |
| `fft(x)`                                | real or complex | `Complex[]`                                    | n                              |

`parallelFFT` runs the optimized radix core on the calling thread. It splits the work across workers
only when `computePool.shouldParallelize` allows it, and the tuned decision for this operation is
"never". `fft` builds one `Complex` object for each bin.

The table compares the entry points with `fft.js` 4.0.4. The tool is
`tools/benchmark/functions/fft-entry-points.bench.mjs`; its header gives the command. Host: Node
v26.13.0, Windows 11 x64, Intel Core i7-8850H (6 cores, 12 threads). Date: 2026-11-20. The host ran
other jobs during the measurement, so compare the ratios and do not compare the milliseconds with
another machine.

Each round times every entry point once, in an order that alternates between rounds. The ratio of an
entry point is its median over the per-round ratios to `fft.js` of the same round. The `fft.js` row
"plan per call" builds `new FFT(n)` and its two work arrays inside the timed call, as
`docs/persona-sessions/bench/2026-11-11-performance-engineer.mjs` does. The `fft.js` row "plan and
arrays reused" builds them once, so it is the best case of `fft.js`. The input is one fixed
pseudo-random real signal.

| Entry point                       | n = 2^16: ms | ratio to `fft.js` | n = 2^20: ms | ratio to `fft.js` |
| --------------------------------- | -----------: | ----------------: | -----------: | ----------------: |
| `fft(number[])`                   |        29.31 |              1.15 |      1019.45 |              1.61 |
| `fft(Float64Array)`               |        28.86 |              1.13 |      1041.70 |              1.56 |
| `parallelFFT(number[])`           |        28.75 |              1.06 |       697.11 |              1.03 |
| `await parallelFFT(Float64Array)` |        23.36 |              0.89 |       659.64 |              1.02 |
| `fft.js`, plan per call           |        25.29 |              1.00 |       670.21 |              1.00 |
| `fft.js`, plan and arrays reused  |        10.45 |              0.41 |       349.93 |              0.52 |

The 2^16 column is one run of 31 rounds, and the 2^20 column is one run of 11 rounds. Three more
runs of the 2^16 case with the same protocol gave ratios within 0.07 of these. At 2^20 the ratios of
the 11 rounds of `await parallelFFT(Float64Array)` range from 0.81 to 1.07, so read that entry as
equal to `fft.js` with a plan per call. Of the public entry points, `parallelFFT` is the fastest at both sizes,
and `fft` is 1.13 to 1.61 times slower than `fft.js`. No public entry point matches `fft.js` when
`fft.js` keeps its plan and arrays: that case is 2.0 to 3.1 times faster than every entry point here.

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
  (sequential). `matmul` parallelizes at **7,077,888** multiply-adds (`aRows * aCols * bCols`; 192×192×192),
  the smallest measured square size where workers took at most 0.90 of the in-process time
  with 2, 4 and 12 workers. The measured grid is square and comes from one host (`docs/benchmarks/ws-r-matmul-decision.json`). Unlisted ops fall through
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

# @danielsimonjr/mathts-parallel

## 0.3.2

### Patch Changes

- 538c672: WS-2 addendum: the seven bitwise ops (`bitAnd`/`bitOr`/`bitXor`/`bitNot`/`leftShift`/`rightArithShift`/`rightLogShift`) gated via a **nameless** `shouldParallelize(len)` — the untested global 50 000 threshold. Benchmarked (`tools/benchmarks/ws2-bitwise-ops.mjs`, medians of 9 interleaved reps): the worker path loses 7–25× at every size up to 4M elements (0.04–0.15× — Int32Array element-wise is maximally memory-bound). All seven are now named `OpName`s set to `'never'`, and the methods pass their op name so the entries govern — inline execution for every caller (a speedup at ≥50k sizes that previously dispatched to workers). Worker-kernel test coverage is preserved via an explicit per-op-map override in the forced-parallel suite.

## 0.3.1

### Patch Changes

- 6cd4dfd: WS-2 threshold-retune completion: the five `OpName`s absent from `DEFAULT_THRESHOLD_BY_OP` (`histogram`, `transpose`, `matvec`, `outer`, `integrateChunk`) silently rode the untested 50 000 global threshold — and the first four `ComputePool` methods dispatched to the worker pool **unconditionally** (no `shouldParallelize` gate), paying worker copy overhead on every call. Benchmarked (`tools/benchmarks/ws2-missing-ops.mjs`, medians of 9 interleaved reps): histogram 0.23–0.56×, transpose 0.01–0.28×, matvec 0.00–0.05×, outer 0.01–0.50× at every size up to 4.2M elements — memory-bound/copy-dominated, no break-even. All five are now `'never'`, and the four methods gate with an inline sequential fallback (numerically identical, dimension validation preserved) — a significant speedup for every caller. `integrateFanOut` remains caller-opt-in via `workerCount`; its entry documents that cheap integrands lose ~50–100× (expensive ms-scale integrands are the one case the fan-out pays). Every `OpName` now has an explicit, benchmark-sourced threshold.

## 0.3.0

### Minor Changes

- - **feat (GC14):** export `DEFAULT_THRESHOLD_BY_OP` as the canonical, benchmark-tuned
    per-op parallelization-threshold source of truth; `ThresholdDispatcher` now derives
    its overlapping `matmul` threshold from it (was 10000, now the canonical 4096) so
    the two threshold mechanisms cannot silently diverge.

## 0.2.2

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## Unreleased

### Tests

- Raised line coverage of the active parallel modules to ≥90% (parallel subtotal
  ~67% → ~99%). Added worker-dispatched (parallel-path) tests for `ComputePool`
  (`pow`/`sign`/`tensordot` via `applyKernel`, the `integrateFanOut` /
  `distributionSampleFanOut` fan-outs, `fftBatch`, `distanceMatrix`,
  `applyKernel`/`applyKernel2`, `prod`, `exec`, the `workerCount` getter, and the
  remaining bitwise length-mismatch guards) and for `ParallelMatrix`
  (`multiply`/`add`/`subtract`/`elementMultiply`/`scale`/`dotProduct`/`sum`/
  `transpose` parallel and sequential paths, SharedArrayBuffer toggle, `getStats`,
  and live-pool reconfiguration). Filled the `ThresholdDispatcher.calculateChunks`
  per-category branches, the unbalanced `chunkArray` path, and `parallelTan`.
  All new tests assert parallel results against a sequential oracle.
- De-flaked the `WorkerPool.execute()` timeout test: removed the brittle
  `elapsed >= 40ms` wall-clock lower bound (a scheduling/`Date.now()`-resolution
  race) and kept the correctness contract (rejects with a timeout error + the
  hung worker is terminated), relying on the test timeout as the hang guard.

## 0.2.1

### Patch Changes

- Pin `@danielsimonjr/mathts-workerpool` to an exact version instead of `*`, so a matched package set always installs together.

## 0.2.0

### Minor Changes

- 65c12de: Fix and extend parallel execution.
  - **workerpool** — `MathWorkerPool` created its pool with `createPool(null)`, so
    workerpool loaded its generic worker instead of the MathTS kernels and every
    named-kernel dispatch threw `Unknown method`. The built `dist/worker.js` is
    now resolved and loaded, so the parallel layer runs in workers for the first
    time. Float64Array chunking is fixed (`subarray` shared the whole buffer →
    `slice`). Adds the generic `applyKernel` (unary) and `applyKernel2` (binary)
    worker kernels and a batched-FFT kernel (`fftBatchChunk` / `fftBatch`).
  - **parallel** — `ComputePool` exposes `applyKernel` / `applyKernel2` / `fftBatch`.
  - **functions** — parallel `Float64Array` overloads for all 10 distribution
    functions and all 28 special functions; `parallelFFTMagnitude` /
    `parallelFFTPower` now dispatch to worker threads; `spectrogram`, `fft2d`, and
    `parallelConv` (with `parallelXCorr` / `parallelAutoCorr`) dispatch their
    independent FFTs to the worker pool; `parallelFFT` / `parallelIFFT` run a
    genuinely parallel single transform via a four-step decomposition. Completes
    the element-wise `Float64Array` overloads across arithmetic and trigonometry,
    and adds a parallel `parallelStatProd` reduction. Adds the parallel all-pairs
    `distanceMatrix` geometry function and the WebGPU-accelerated matrix
    operations `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and `gpuScale` (new async
    exports, transparent CPU fallback, f32 GPU path).

    **Breaking:** `characteristicPolynomial`, `matrixPower`, `matrixLog`,
    `polarDecomposition`, `jordanForm`, `spectrogram`, `fft2d`, `parallelIFFT`,
    and `parallelStatProd`'s `Float64Array` overload are now async — their
    O(n^3) products / FFT batches / reductions are offloaded to the worker pool.

### Patch Changes

- Updated dependencies [65c12de]
  - @danielsimonjr/mathts-workerpool@0.2.0

## 0.1.3

### Patch Changes (Security — additive)

- 862ae30: `WorkerPool.execute()` now accepts an optional `timeoutMs`
  argument. When the worker does not reply within `timeoutMs` the pool
  calls `worker.terminate()`, evicts the dead worker from its rosters,
  spawns a replacement so capacity is preserved, and rejects with
  `"Worker task timed out after Nms"`. Pass `0` or omit to keep legacy
  untimed behaviour. Closes a DoS vector where a hung worker could block
  the queue indefinitely. Adds `parallel/tests/WorkerPool.timeout.test.ts`
  (2 tests).

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests

- Updated dependencies [e771b4e]
  - @danielsimonjr/mathts-workerpool@0.1.1

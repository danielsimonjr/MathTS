# @danielsimonjr/mathts-parallel

## 0.4.0

### Minor Changes

- b8bf018: **Numerical accuracy: `sum` / `mean` were ~46,000× less accurate than NumPy. Fixed.**

  `sum` accumulated naively (`s += x`), so its error grew as **O(n)·ε**. NumPy uses pairwise
  summation, whose error grows as **O(log n)·ε**. Measured on 1e6 copies of `0.1` (exact answer
  100000):

  | accumulation              | relative error                      |
  | ------------------------- | ----------------------------------- |
  | naive (what shipped)      | **1.3e-11**                         |
  | **pairwise (now)**        | **2.9e-16** — identical to `np.sum` |
  | `fsum` (new, compensated) | **0** — exact                       |

  `mean`, `std`, and `variance` all inherit `sum`'s error, so this was the single largest accuracy
  defect in the library. Pairwise costs the _same number of additions_ — measured 1.03× **faster**
  than the naive loop (eight independent accumulators break the serial dependency chain). There was
  no trade here; the naive version was simply worse.

  **`norm(x, 2)` no longer overflows or underflows — and NumPy still does.** The obvious
  `sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable range. MathTS now
  uses LAPACK's `dnrm2` scaling:

  ```ts
  norm([1e200, 1e200, 1e200, 1e200], 2); // 2e200    (np.linalg.norm: inf)
  norm([1e-200, 1e-200, 1e-200, 1e-200], 2); // 2e-200   (naive squaring: 0 — silently wrong)
  ```

  The underflow case is the dangerous one: a plausible `0` rather than an obvious `inf`.

  **New: `fsum(x)`** — exactly-rounded summation (Neumaier), the equivalent of Python's `math.fsum`.
  Pairwise cannot recover a value catastrophic cancellation has already destroyed:

  ```ts
  sum([1e16, 1, -1e16]); // 0  (np.sum gives 0.0 too — the 1 is annihilated by the 1e16)
  fsum([1e16, 1, -1e16]); // 1  (exact)
  ```

  ~2–4× slower, so it is opt-in. Reach for it when the result is a small difference of large terms.

  **`@danielsimonjr/mathts-core`** now exports the primitives directly: `pairwiseSum`, `neumaierSum`,
  `norm2`.

  **`@danielsimonjr/mathts-parallel`** gains a dependency on `core` for these primitives, and its
  `ComputePool.sum` / `.norm` sequential paths use them (0 new cycles).

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-core@0.7.0

## 0.3.4

### Patch Changes

- 8e9aadb: **Fix: published type declarations did not compile for consumers.**

  A consumer building with `skipLibCheck: false` could not compile against these packages:

  - `TS7016` — the `workerpool` fork declares `types: types/index.d.ts`, but that is a build
    output never committed and never generated for a `github:` dependency, so the module
    resolved fully **untyped**. `@danielsimonjr/mathts-workerpool` now ships a canonical ambient
    declaration (`workerpool.d.ts`) from `dist/` and references it from its own `index.d.ts`, so
    types resolve the same way for us and for consumers. The internal `paths` shims that had
    papered over this (compile-time only, never shipped) were removed, ending the two-tier
    reality where our builds passed and consumers' broke.
  - `TS2665` — `matrix`'s emitted `.d.ts` contained an illegal `declare module 'workerpool'`
    augmentation, inlined by the dts bundler from **516 stale generated `.d.ts` files that had
    accumulated inside `src/`** (untracked `tsc` emissions shadowing their sibling `.ts`). These
    were being picked up as build input and corrupting the published surface. Removed.

- Updated dependencies [8e9aadb]
  - @danielsimonjr/mathts-workerpool@0.2.1

## 0.3.3

### Patch Changes

- 7b2b651: Remove 8 dead (unreachable, unexported, untested) source files surfaced by the upgraded dependency-graph tool: `expression` `ArgumentsError.ts`; `functions` `utils/{function,log,lruQueue,bignumber/constants}.ts` (a closed import subgraph reachable from nothing); `matrix` `types.ts`; `parallel` `workers/compute.worker.ts` (a superseded worker never built — `matrix.worker.ts` is the live one); `wasm` `env/abort.ts` (a custom AssemblyScript abort handler never wired via asconfig, tree-shaken by `asc`). None were reachable from any package entry point or build root, so the published bundles are byte-identical; this is a source-tree cleanup. Verified: build 22/22, wasm build, typecheck 28/28, test 44/44, eslint clean.

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

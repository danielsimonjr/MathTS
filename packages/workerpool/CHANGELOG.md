# @danielsimonjr/mathts-workerpool

## 0.5.0

### Minor Changes

- 59581d0: The radix-2 FFT cores read each twiddle from a table of one `Math.cos` and one `Math.sin` call per index. The earlier cores multiplied each twiddle by the step, so the rounding error grew with the index. The round trip `parallelFFT` then `parallelIFFT` at n = 4096 was 640 ULP of the largest sample; it is about 4 ULP now. The spectrum of a power-of-two length changes in the last bits, so this release is minor and not patch. The `workerpool` copy and the `functions` copy give the same bits on one runtime. Two runtimes can still differ in the last bit, because V8 and JavaScriptCore round `Math.cos` and `Math.sin` differently.
- b95de8a: **Breaking:** Node 20 is dropped (`engines.node` >=22.12); packed-consumer contract (#886, #888, #890, #893, #905, #912, #914, #916, #930).
  
  Every package sets `engines.node` to `>=22.12`, and CI tests 22.x and 24.x.
  
  Every `exports` entry gains a `default` condition equal to `import`, so `require()` of the ES build works at run time on Node >= 22.12 (`mathts-wasm` has top-level await and stays import-only). Node 22.12 prints an `ExperimentalWarning` for it; 22.13 and later do not. On Node 22.11 and earlier, `require()` reports `ERR_REQUIRE_ESM`; use `import()`. TypeScript accepts the `require()` of these packages from CommonJS under `moduleResolution: nodenext`; `node16` reports TS1471. Issue #736 closed docs-only because its acceptance allowed documenting ESM-only; the `default` condition is the `require(esm)` fix.
  
  Published `.d.ts` files name no Node, workerpool, DOM or WebGPU global, so strict `tsc` with no `@types/node` passes. The `mathts-gpu` handle types are the WebGPU global types when the consumer has them, and interfaces of the package when it has not. `mathts-workerpool` ships a `browser` build (the worker is one classic script), so a bundler pulls no Node builtin into `mathts-compat`. README code fences carry a runtime tag. `functions/evaluate` is not a size saving; use `mathts-expression` for a small bundle.

### Patch Changes

- 3e0fb02: `ComputePool.matmul` runs a product in the calling thread below 7,077,888 multiply-adds (`aRows * aCols * bCols`, 192 x 192 x 192), up from 4,096 result elements. A `thresholdByOp.matmul` value set by a user now counts multiply-adds. The matrix kernel packs two columns of B and gives the same bits as the plain triple loop. The in-process `sin`, `cos`, `tan`, `exp` and `log` run one loop per function. New `ComputePool.warmup(count?)` starts the workers before the first parallel call.

## 0.4.1

### Patch Changes

- 8d727a1: ComputePool lazy-inits workers on parallel dispatch, throws after `terminate()` on every compute method, and rejects a swapped `matmul` call before stringifying buffers. Workerpool sizes large-array chunks from `maxWorkers` with a 65,536-element floor, resolves `new URL('./worker.js', import.meta.url)`, and rewrites Vite's prebundled `/.vite/deps/worker.js` to the package worker. An in-flight `initialize()` cannot leave workers running after `terminate()`.
- a07bf29: Packaging P2 (dogfood G29): ship LICENSE in tarballs, homepage/bugs links, `exports['./package.json']`, honest `sideEffects`, JS source maps from tsdown, and workerpool types that typecheck without `@types/node` (via updated `@danielsimonjr/workerpool` patch).

## 0.4.0

### Minor Changes

- 2c631ff: New export `matmulSequential(a, aRows, aCols, b, bCols)`: the sequential row-major matrix product. `@danielsimonjr/mathts-workerpool` exports it, and `@danielsimonjr/mathts-parallel` re-exports it. The inline branch of `MathWorkerPool.matmul` (below the worker threshold) now calls it, and the synchronous `matmul` of `@danielsimonjr/mathts-functions` uses it at every size. The function throws the same shape errors as `MathWorkerPool.matmul`. The worker kernel uses the same loop order, so the results are equal bit for bit.

## 0.3.0

### Minor Changes

- 78f8a1c: The `sumChunk`, `dotChunk`, `normChunk` and `distanceChunk` kernels use the same stable accumulation as `ComputePool`'s sequential path: pairwise sum and dot, and BLAS-style scaled partials combined scale-aware for `norm` and `distance`. A parallel `norm` of a 1e200-scaled vector is now finite and matches the sequential result; sums and dots can differ in the last bits from before. `normChunk` and `distanceChunk` now return `[scale, ssq]` partials instead of a sum of squares. The copies live in `worker-numerics.ts` and are pinned bit-for-bit to core by a parity test.
  
  Slices that a method owns are moved to the worker by transfer instead of cloned, and kernels return their fresh result buffers by transfer. `matmul`, `transpose`, `matvec` and `outer` send each task only its own row block; operands every task needs are copied once from an exact buffer. Passing a `subarray` view with a non-zero `byteOffset` (matmul, transpose, matvec, outer, distanceMatrix) no longer reads the wrong region. `matmul`, `transpose` and `matvec` validate buffer sizes; `histogram` requires a positive integer `bins`, ignores non-finite samples and handles a constant range. Length-mismatch errors read `<op>: lengths must match (<a> vs <b>)`.

## 0.2.7

### Patch Changes

- ce66065: Phase 6 P6-6: consolidate worker pool `exec` / `execFunction` via `_timedExec` (clone reduction).
- 7e71f31: Phase 6 P6-8: shared `tensordotRange` kernel in workerpool (clone reduction).
- e59fe83: Consolidate log-gamma and accurate erfc/normal-CDF scalars for hypothesis, distributions, and worker kernels; remove duplicate worker log-gamma.
- 19c4ba7: Export `mulberry32`, `boxMuller`, and `rowMajorStrides` from core; deduplicate tensor, functions, parallel, and worker copies.
- 0573f58: Share worker scalar sum/prod/norm shell (clones plan PR-H).
- 2761c87: Comment-only: FFT header in `fft-core.ts` now references `functions/src/signal/fft-core-f64.ts` (no runtime change).
- c33fca2: Phase 6 P6-7: consolidate map/filter/sort/reduce parallel envelope via `runParallel` (clone reduction).
- 747c740: Sprint 2R batch 2: dedupe workerpool `map`/`filter` dispatch (`runChunks`), Float64/Int32 chunk helpers (`chunkTyped`, `chunkPairTyped`), and multi-index iteration (`forEachMultiIndex` for the worker bundle and `@internal` export).

## 0.2.6

### Patch Changes

- 788e4e4: Shipped function sources are now compiled in the global scope through one helper, `compileFunctionSource`, instead of a direct `eval` inside each worker kernel. A direct `eval` let the shipped code read and reassign the kernel's own locals, made the engine de-optimise the kernel, and stopped esbuild from minifying it (8 `direct-eval` build warnings). A function source that depended on a kernel's locals was already a bug; any self-contained function behaves as before.

## 0.2.5

### Patch Changes

- a13ce7e: The published `.d.ts` files now carry explicit `.js` extensions on relative imports, so a consumer on `moduleResolution` `node16` or `nodenext` can use them.
  
  Declaration emit runs under `module`/`moduleResolution` `nodenext` (`tsconfig.dts.base.json`). `tsc` copies a relative specifier into the `.d.ts` verbatim and synthesises one for an inferred type, so the emit mode is what decides whether the extension is there. An extensionless relative import in `src` is now a build error instead of a silent consumer break. A NodeNext consumer type check of the packed tarballs reported 60 errors before this change (53 TS2834, 7 TS2709) and reports 0 after it.
  
  `@danielsimonjr/mathts-functions` also imports `Decimal` and `Complex` as named exports of `decimal.js` and `complex.js`. NodeNext resolves those two packages as CommonJS, where the default export is a namespace and not usable as a type (TS2709).

## 0.2.4

### Patch Changes

- 2959b0d: Adopt `@danielsimonjr/workerpool@10.2.2`, which uses `parentPort` in a `node:worker_threads` worker under Bun. Remove the `bun-worker-bridge.ts` workaround; `worker.ts` now calls `worker(methods)` directly.

## 0.2.3

### Patch Changes

- 8473590: Declare `typed-function` and `workerpool` as registry `npm:` aliases (`npm:@danielsimonjr/typed-function@5.0.0-alpha.4`, `npm:@danielsimonjr/workerpool@10.2.1`) instead of `github:` git dependencies. npm 10 (bundled with Node 20 and 22) failed to install these packages with "git dep preparation failed ... Cannot read properties of null (reading 'edgesOut')". The registry builds are code-identical to the git HEADs that were resolved before, and the import names do not change.

## 0.2.2

### Patch Changes

- 57c8ffd: Worker threads now answer under Bun. Bun defines Web Worker globals inside a `node:worker_threads` worker, which sent workerpool down its browser path, where tasks never arrived. Under Node the bridge does nothing.

## 0.2.1

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

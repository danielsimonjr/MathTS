# @danielsimonjr/mathts-workerpool

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

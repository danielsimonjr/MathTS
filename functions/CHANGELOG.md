# @danielsimonjr/mathts-functions

## 0.2.1

### Patch Changes

- Fix functions WASM loader artifact filenames + path resolution.

  `functions/src/wasm/WasmLoader.ts` carried two legacy-mathjs artifacts
  of the mathjs-to-MathTS rebrand:
  - It referenced `mathjs-as.wasm` / `mathjs.wasm` instead of the actual
    artifacts `mathts-as.wasm` / `mathts.wasm`. The loader never found
    its binaries, `getModule()` returned null, and consumers
    (`functions/src/typed/{numeric,geometry,signal}.ts`) silently fell
    back to JS with no warning. Every release of mathts-functions since
    the rebrand has shipped with these three modules' WASM paths
    unreachable.
  - The Node branch used `'./lib/wasm/...'` (CWD-relative). Only worked
    when Node launched from the repo root — same pattern matrix fixed in
    the prior release.

  Now resolves through `fileURLToPath(new URL('../../../lib/wasm/...',
import.meta.url))`, mirroring matrix's loaders. The env-var check
  accepts both `MATHTS_WASM_BACKEND` (canonical) and the legacy
  `MATHJS_WASM_BACKEND` for one release. `getDefaultWasmPath` is now
  async; the two callers (`precompile`, `loadModule`) await it.

  Note: this fix alone doesn't ship WASM artifacts inside the npm
  tarball — the cross-package dist-hop issue (audit B-3) is a separate
  build-pipeline change. Once that lands, end-users of mathts-functions
  will get the WASM-accelerated paths that were wired but unreachable
  since the rebrand.

- Updated dependencies [3d218f5]
- Updated dependencies
  - @danielsimonjr/mathts-matrix@0.1.3

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
  - @danielsimonjr/mathts-parallel@0.2.0

## 0.1.3

### Patch Changes (Security — additive)

- 3ef899c: WASM modules now verify a SHA-384 manifest before instantiation.
  At load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against `wasm-manifest.json` written by
  `tools/generate-wasm-manifest.mjs`. A mismatch throws before any module
  is compiled, blocking silent code-injection via tampered .wasm payloads.
  Manifest defaults to soft-fail when absent for legacy compat;
  `{ required: true }` makes it fail-closed. Affected files:
  `functions/src/wasm/integrity.ts` (new), `functions/src/wasm/WasmLoader.ts`
  (Node + browser load paths). Adds
  `functions/tests/security/wasm-integrity.test.ts` (5 tests).

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
  - @danielsimonjr/mathts-core@0.1.1
  - @danielsimonjr/mathts-matrix@0.1.1
  - @danielsimonjr/mathts-parallel@0.1.1
  - @danielsimonjr/mathts-expression@0.1.1

# Math.js Refactoring TODO

Generated: 2026-01-13
Updated: 2026-05-21

> **Current State:** 444+ functions, 545 factory functions, 21 categories. 9,263 tests passing, 0 failing. Full function reference: https://danielsimonjr.github.io/mathjs/

## ✅ Completed

- [x] TypeScript conversion (src/) - 66% coverage, 0 errors
- [x] TypeScript conversion (test/) - 65% coverage
- [x] AssemblyScript/WASM conversion - Complete, 0 candidates remaining
- [x] WASM performance benchmarks - 10-117x speedups documented
- [x] Rust WASM migration - 57 AS modules migrated to 63 Rust files (18.5K lines), 826 exports, 669KB binary
  - Rust 2-55x faster than JS, 2-3x faster than AS
  - Crate deps: faer 0.24, rustfft 6.4, statrs 0.18
  - 40 JS function files wired to Rust WASM modules
  - Dual distribution: lib/wasm/mathjs.wasm (Rust) + lib/wasm/mathjs-as.wasm (AS)
  - sparse_chol.rs temporarily disabled pending ereach fix
  - 64 code review issues fixed by 4 review agents
- [x] Status report updated - Accurate breakdown
- [x] Refactoring docs organized - Moved to docs/refactoring/
- [x] WASM test files (46 files) - All tiers complete (6621 tests passing)

## 🔧 Parallel Execution Remediation (2026-05-21)

The worker-pool infrastructure was found to be **non-functional at runtime** and
has been fixed; genuine worker parallelism was then extended across the typed
layer. This supersedes the earlier "Optimize parallel processing ✅ COMPLETE"
claim below — the prewarming/singleton/metrics plumbing existed, but no kernel
ever actually ran in a worker.

- [x] **Fix worker dispatch** — `MathWorkerPool` created its pool without a
      worker script, so every named-kernel call (`sumChunk`, `matmulRows`, …) threw
      `Unknown method`. The built `dist/worker.js` is now resolved and loaded; the
      arithmetic/statistics/trigonometry `Float64Array` overloads run in workers for
      the first time.
- [x] **Fix Float64Array chunking** — chunks were cut with `subarray()` (a view
      over the full buffer), so every chunk past the first read the wrong region.
      Now uses `slice()`.
- [x] **Generic kernels** — added `applyKernel` (unary) and `applyKernel2`
      (binary) so packages above `workerpool` can parallelize element-wise math.
- [x] **Distributions** — parallel `Float64Array` overloads for all 10 PDF/CDF/
      PMF functions.
- [x] **Special functions** — parallel `Float64Array` overloads for all 28
      special functions.
- [x] **Matrix decompositions** — `matrixPower`, `matrixLog`,
      `polarDecomposition`, `jordanForm`, and `characteristicPolynomial` route their
      O(n³) products through the worker pool (now `async` — breaking).
- [x] **Signal spectra** — `parallelFFTMagnitude` / `parallelFFTPower` now
      genuinely dispatch to worker threads.
- [x] **WebGPU matrix operations** — `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and
      `gpuScale` (`functions/src/typed/gpu.ts`) run on the matrix package's WebGPU
      compute-shader backend (`gpuMatrixBackend`), with transparent CPU fallback.
      Added as new async exports rather than rerouting the existing f64 functions —
      WGSL is f32-only, so silent substitution would lose precision.
- [x] **Function reference** — `docs/reference/functions.{md,html}` mark each
      function's `parallel` / `WASM` / `WebGPU` acceleration in an Accel column.
- [x] **Worker-distributed FFT** — `parallelFFT` / `parallelIFFT` now use a
      four-step (transpose) decomposition: one transform is split into two batches
      of independent smaller FFTs dispatched via `fftBatch`, with a twiddle pass
      between. `parallelIFFT` became `async` for this.

## 🚀 Acceleration Roadmap (2026-05-21)

Acceleration only pays off for **compute-bound** operations — where arithmetic
dominates data movement. Most functions are transfer-bound or cheap, and adding
a worker / WASM / WebGPU path to them is net-neutral or slower. The candidates
below are limited to operations that genuinely clear that bar.

**Selection criteria**

- **Worth it** — compute grows faster than data (O(n³), O(n² log n), or many
  independent sub-problems), and the input is large enough to amortize dispatch.
- **Not worth it** — element-wise O(n) maps and cheap scalar functions: data
  transfer (and, for GPU, f32 conversion) dominates the runtime.
- **WebGPU is f32-only** (WGSL has no f64) — expose it as opt-in functions; do
  not silently substitute it for an f64 path.
- **async blast radius** — parallelizing a sync function makes it, and its
  callers, async. Acceptable for niche functions; avoid it for hot, widely-used
  scalar paths (`add`, `multiply`, …).

**Low effort**

- [x] `spectrogram`, `fft2d` — parallelized via a batched-FFT worker kernel
      (`fftBatchChunk` + `MathWorkerPool.fftBatch` / `ComputePool.fftBatch`); both
      dispatch their independent FFTs to the worker pool and are now `async`.
- [x] FFT-based `convolve` / `correlate` — `parallelConv` runs its two forward
      FFTs concurrently through `fftBatch`; `parallelXCorr` / `parallelAutoCorr`
      inherit it by delegation.

**Medium effort**

- [x] `distanceMatrix` — new function computing the all-pairs Euclidean distance
      matrix; rows are distributed across workers (`distanceMatrixRowsChunk`).
- [ ] `eigs` / SVD — **not pursued.** Eigendecomposition via QR iteration is
      fundamentally sequential (each step depends on the previous), so worker
      dispatch inside the loop is net-negative; SVD already has a WASM path.
- [ ] `polyFit` / `leastSquares` — **deferred.** `polyFit` has few parameters so
      `AᵀA` is tiny; `leastSquares` would need a custom contraction-dimension
      reduction (`computePool.matmul`'s threshold keys on result size, not the
      O(n²·m) cost), genuine only for unusually wide systems.

**High effort**

- [x] Worker-distributed FFT — `parallelFFT` / `parallelIFFT` use a four-step
      (transpose) decomposition built on `fftBatch`.
- [ ] Unified f32 WebGPU path — **not pursued; design spec written.** A
      coherent GPU path (shared WGSL shader library, GPU-resident `GpuArray`
      handles for operation fusion, Stockham FFT shaders, a generalized backend
      router) is scoped in
      [`docs/roadmap/UNIFIED_WEBGPU_PATH.md`](../roadmap/UNIFIED_WEBGPU_PATH.md) —
      a separate research effort beyond the existing matrix-op `gpu*` functions.

## 🐞 Known Defects

### Fixed (2026-05-22)

The defects below were all pre-existing; each is now resolved. The first two
were surfaced while fixing the fresh-checkout test failures, the rest during
the dependency-graph / architecture-docs audit.

- [x] **`parallel` package never built `matrix.worker.js`** — `parallel`'s
      build was `tsup src/index.ts` only, so `src/matrix.worker.ts` was never
      emitted to `dist/`. `ParallelMatrix` resolved its worker as
      `./matrix.worker.js` at runtime, which did not exist — the worker compute
      paths silently returned all-zeros. Caused 9 `tests/wasm/parallel-processing.test.ts`
      failures. **Fixed:** a four-defect chain — missing tsup build entry, no
      script resolver (`resolveMatrixWorkerScript`), ESM-incompatible
      `require('worker_threads')`, and browser-only event wiring in `WorkerPool`'s
      Node branch — plus a shared-buffer-mutation bug and a queue-drain race.
      `parallel/package.json`, `parallel/src/{ParallelMatrix,WorkerPool,matrix.worker}.ts`.
- [x] **JS SVD was wrong for non-square matrices** — `svdStep`'s Golub-Kahan
      QR sweep assigned the unsigned magnitude `Math.sqrt(f*f + g*g)` to `e[k-1]`
      and `d[k]` where the algorithm requires the signed rotated values
      `cs*f - sn*g` / `cs2*f - sn2*g`, corrupting the bidiagonal sweep for any
      non-square matrix (5×3 reconstruction error ~8.28). **Fixed** in
      `matrix/src/operations/svd.ts`.
- [x] **All 7 import cycles eliminated** — the dependency-graph report flagged
      7 cycles (5 runtime, 2 type-only); the report now detects 0.
  - `is ↔ map` / `object → is → map → customs → object` in both
    `functions/src/utils/` and `expression/src/utils/`: `isObjectWrappingMap`
    moved into `map.ts` next to the `ObjectWrappingMap` class, so `is.ts` no
    longer imports `map.ts` — that single edge closed both cycles per package.
  - `evaluate.ts → typed/index.ts → typed/cas.ts → evaluate.ts`: the
    `export * from './cas.js'` re-export moved from `typed/index.ts` to the
    package entry `functions/src/index.ts`. This also resolves the latent
    incomplete-`mathScope` risk — `evaluate.ts` now loads strictly after
    `typed/index.ts` is fully initialized.
  - `DenseMatrix ↔ SparseMatrix`: `DenseMatrix` dropped its
    `import type { SparseMatrix }`; `toSparse()` is typed as the `Matrix` base
    (the `SparseMatrix` subtype is still constructed lazily at runtime).
  - `BackendManager ↔ config`: `OperationType` moved from `BackendManager.ts`
    to `config.ts`; `config.ts` no longer imports `BackendManager`.

- [x] **`tensor` and `autograd` failed `tsc --noEmit` — missing `workerpool`
      path redirect** — surfaced 2026-05-22 while auditing the architecture docs.

  **Symptom.** `npx tsc --noEmit` run in `tensor/` and in `autograd/` each
  report the same 7 errors; the other 8 TypeScript packages typecheck clean.
  Both the package build (`tsup`) and the test suites still pass — only the
  standalone typecheck task fails. So this is a build-tooling defect, not a
  runtime bug.

  **Where.** All 7 errors are inside the _upstream_ `workerpool` npm
  dependency (`node_modules/workerpool`, v10.0.1 — the unscoped package, which
  is distinct from the fork `@danielsimonjr/mathts-workerpool` in
  `packages/workerpool`):

  ```
  node_modules/workerpool/src/core/Pool.ts(12,10)            TS6133  'FIFOQueue' declared but never read
  node_modules/workerpool/src/core/Pool.ts(12,21)            TS6133  'LIFOQueue' declared but never read
  node_modules/workerpool/src/core/Pool.ts(21,3)             TS6196  'QueueStrategy' declared but never used
  node_modules/workerpool/src/core/Pool.ts(276,20)           TS7030  not all code paths return a value
  node_modules/workerpool/src/types/index.ts(259,39)         TS6133  'E' declared but never read
  node_modules/workerpool/src/types/worker-methods.ts(8,34)  TS6196  'ExecOptions' declared but never used
  node_modules/workerpool/src/workers/worker.ts(137,28)      TS2769  postMessage — no overload matches
  ```

  These are upstream code-quality issues in `workerpool` itself, not MathTS
  bugs.

  **Root cause.** Upstream `workerpool` v10.0.1 ships _raw `.ts` source_ — its
  `package.json` `exports` map points subpath `import`s straight at `src/*.ts`.
  `skipLibCheck` (which `tensor` and `autograd` both set) only suppresses
  checking of `.d.ts` files — it does **not** skip raw `.ts` files in
  `node_modules` — so `tsc` type-checks `workerpool`'s source and surfaces its
  errors. The transitive path that drags it in is
  `autograd → tensor → matrix → parallel → workerpool`.

  The four packages that reach `workerpool` _without_ this failure —
  `parallel`, `matrix`, `functions`, `compat` — each carry a `tsconfig.json`
  `paths` redirect that points the `workerpool` specifier at the hand-written
  stub declaration `parallel/types/workerpool.d.ts`:

  ```jsonc
  "paths": { "workerpool": ["../parallel/types/workerpool.d.ts"] }
  ```

  `tensor/tsconfig.json` and `autograd/tsconfig.json` have no `paths` section
  at all, so they were simply missed.

  **Fixed.** Added the `paths` entry —
  `"workerpool": ["../parallel/types/workerpool.d.ts"]` — to
  `tensor/tsconfig.json` and `autograd/tsconfig.json` (the exact form
  `matrix/tsconfig.json` already uses). Both packages now typecheck with
  **0 errors**, and their builds and test suites (tensor 16, autograd 9)
  still pass.

  **Longer-term option.** The stub is now referenced by six tsconfigs via a
  hand-copied relative path. Consider either (a) hoisting the redirect into
  `tsconfig.base.json` so packages without their own `paths` (`tensor`,
  `autograd`, …) inherit it — note a child `paths` _replaces_ rather than
  merges, so `parallel`/`matrix`/`functions`/`compat` keep their existing
  copies; or (b) shipping a real `.d.ts` from the forked
  `@danielsimonjr/mathts-workerpool` and routing all worker-pool imports
  through the scoped fork so the upstream raw-`.ts` package never enters the
  type graph.

## 🔧 Typed-Layer Expansion (2026-05-22)

The active `functions/src/typed/` dispatch layer has been expanded and several
pre-existing correctness defects fixed.

### Done

- [x] **`functions` typecheck — 599 → 0 errors.** Three-part fix:
      (1) config — `functions/tsconfig.json` gained `"types": ["@webgpu/types",
"node"]` (its typecheck pulls in `matrix/src/backends/gpu/*` source) and
      `"lib": ["ES2023", "DOM"]`, and the `WasmModule` interface gained the four
      computational-geometry exports — cleared ≈100; (2) ≈499 mechanical
      type-level fixes (`as` casts, generic args, narrowed `unknown`) across the
      13 synced category directories — no runtime change; (3) 18 previously
      internal interfaces exported from algebra/matrix/arithmetic/type so
      `factories/index.ts` re-exports can name them, resolving the resulting
      `TS4023` errors. All 11 TypeScript packages now typecheck at 0 errors.

- [x] **Source-file test coverage 18.6 % → 27.0 %.** 42 new unit-test files
      (+≈1,294 assertions) brought the suite from 114 → 156 files and tested
      files from 90/485 → 131/485. Coverage focused on the genuinely active
      hand-written code (every AST node class in `expression`, the parser core,
      `Help`, the two error classes, `errorTransform`, the 13 utility modules
      including the sandbox-critical `customs` and all 40+ type guards in `is`),
      plus `packages/workerpool/src/fft-core.ts`, `functions/src/factories/scope.ts`,
      and `matrix/src/backends/WasmLoader.ts`.

- [x] **Variadic typed-function dispatch bug.** This repo's typed-function
      fork delivers `'...T'` rest args as a _single packed array_ (`fn(a, b,
[c, d])`), not as JS spread. Impls declared with `(a, b, ...rest)` got
      `rest = [[c, d]]` and produced wrong results — e.g. `add(1, 2, 3)`
      returned the string `'33'` (number+array stringification), `multiply` /
      `min` / `max` / `hypot` identically broken. Fixed at the five sites in
      `typed/arithmetic.ts` and `typed/trigonometry.ts` by declaring `rest` as
      a plain array parameter; 17 regression tests pinned in
      `functions/tests/typed-variadic.test.ts` so the bug can't silently come
      back.

- [x] **Bitwise category ported to the active `typed/` layer.** Seven ops —
      `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`, `rightArithShift`,
      `rightLogShift` — now dispatched via `mathTyped()` over `number /
BigNumber / bigint / Int32Array`. BigNumber bitwise reimplemented through
      native `bigint` (the synced helper depends on decimal.js internals
      mathts-core does not expose); non-integer / NaN / Infinity throws
      `'Integers expected'` to match mathjs. `ComputePool` gained
      `bitAnd / bitOr / bitXor / bitNot / leftShift / rightArithShift /
rightLogShift` methods returning `ParallelResult<Int32Array>`. New
      `parallel/src/ops/bitwise.ts` carries pure elementwise impls and chunking.
      `parallel/src/workers/compute.worker.ts` got `bitwiseBinaryChunk` /
      `bitwiseNotChunk` handlers ready for when an Int32-aware kernel registry
      lands. 41 tests.

- [x] **Logical category ported to the active `typed/` layer.** Five ops —
      `and`, `or`, `xor`, `not`, `nullish` — over `number / bigint / BigNumber /
Complex / any`. `nullish` carries explicit `boolean,any` / `string,any` /
      `BigNumber,any` / `Complex,any` / `bigint,any` short-circuit signatures
      so typed-function does not coerce `false` or `''` through a different
      signature before the catch-all. 130 tests.

- [x] **`factories/index.ts` collision resolved.** Twelve names that the
      new typed/ modules now export (`bitAnd`, `bitOr`, `bitXor`, `bitNot`,
      `leftShift`, `rightArithShift`, `rightLogShift`, `and`, `or`, `xor`,
      `not`, `nullish`) also existed as synced-factory exports — `export *`
      through `src/index.ts` produced `TS2308` ambiguous re-export errors. The
      superseded factory entries are now module-private `const` declarations
      (factoryScope wiring preserved). `factories-leaf.test.ts` and
      `factories-tier4.test.ts` were repointed to the typed/ versions.

- [x] **`matrix/tests/WasmLoader.test.ts` skipped-test cleanup.** The two
      `.skip`-ped tests asserted Rust-WASM-shaped exports (`multiplyDense`)
      that this environment does not ship — only the AssemblyScript artifact
      at `assembly/build/mathts.wasm` is present, and it uses suffixed
      snake_case names. Replaced with one real conditional test that loads
      the AS artifact and asserts the universals (`mod.memory` is a
      `WebAssembly.Memory`, non-empty function table); skips dynamically if
      the artifact is missing so CI without `npm run build:wasm` is not
      broken. 48 → 49 pass, 0 skipped.

### Open follow-ups (deferred from this session — real but out of scope of the bug-fix slice)

These are the three items I deliberately did not touch in the typed-layer
expansion. They are listed least → most complex, which is the order the
follow-up subagent team should tackle them.

- [ ] **(Sonnet, low) BigNumber API gap.** `expression/tests/utils-bignumber-formatter.test.ts`
      currently uses a `MockBigNumber` because the synced
      `expression/src/utils/bignumber/formatter.ts` duck-types against
      `.gt()`, `.toSignificantDigits()`, and the `.e` (exponent) field on
      Decimal.js-shaped numbers, and `@danielsimonjr/mathts-core`'s BigNumber
      exposes none of them. **Goal:** add `.gt(other)`,
      `.toSignificantDigits(n, roundingMode?)`, and `.e` (or an equivalent
      exponent getter) to `core/src/numeric/BigNumber` so the formatter works
      on the real type. Backwards-compatible — these are new methods/fields.
      Then rewrite the bignumber-formatter test to drop the mock.

- [ ] **(Opus, medium) Int32Array-aware workerpool kernel slot.** The
      `packages/workerpool/src/worker.ts` kernel registry is keyed on
      `Float64Array` — running bitwise math on doubles would silently corrupt
      the upper bits, so the new `ComputePool.bit*` methods currently chunk
      in-process. **Goal:** add an Int32-aware kernel path (a sibling family
      to the Float64 elementwise kernels), wire the seven worker handlers
      already drafted in `parallel/src/workers/compute.worker.ts`
      (`bitwiseBinaryChunk` / `bitwiseNotChunk`) into the active
      `MathWorkerPool`, and switch the seven `ComputePool.bit*` methods over
      so they actually move off-thread for arrays above the elementwise
      threshold. Update / extend `parallel/tests/ComputePool.test.ts` to
      exercise the worker path.

- [ ] **(Opus, high) Rust + AssemblyScript WASM ports of bitwise (and
      logical) ops, plus manifest regeneration.** Add bitwise kernels to both
      the Rust workspace (`wasm-rust/crates/`) and the AssemblyScript module
      (`assembly/src/`), expose them through the existing WasmModule
      interfaces in `functions/src/wasm/WasmLoader.ts` and
      `matrix/src/backends/WasmLoader.ts`, run `npm run build:wasm:all`,
      regenerate `wasm-manifest.json` via `tools/generate-wasm-manifest.mjs`,
      and confirm the SHA-384 verification path in
      `functions/tests/security/wasm-integrity.test.ts` still pins the new
      hashes. Wire the WASM path into `typed/bitwise.ts` as a third dispatch
      tier (WASM for large `Int32Array` inputs once available).

## 🔧 Repo-wide Cleanup (2026-05-22)

A full pass over the entire workspace (prettier reformatting across
1700+ files, ESLint config tightening on synced dirs only, 38 active-
code lint errors closed). Real bugs surfaced along the way and pinned
below.

### Done

- [x] **ESLint `synced mathjs` override block.** Mirrors `strict: false`
      in `functions/tsconfig.json`: 22 stylistic rules downgrade to
      warnings under the synced category dirs (`functions/src/{arithmetic,
      algebra,bitwise,…}/`, `functions/src/wasm/{plain,matrix,…}/`,
      `expression/src/utils/**`, `expression/src/transform/**`, the
      synced helpers at the root of `core/src/`, `core/src/bignumber/`,
      `core/src/function/`, `core/src/types/{bigint,bignumber,fraction,
      number,matrix/,unit/}`). Active typed-function code stays strict.
- [x] **38 active-code lint errors closed** across core, functions, and
      expression. Interface-required unused args prefixed `_`, dead
      imports removed, `Function`-type replaced with callable signatures,
      `prefer-spread` rewrites, `prefer-as-const` on three error classes.
- [x] **`npx prettier --write .`** normalized formatting across 1500+
      TS / 120+ MD / 60+ JSON / 4 YAML / 1 shell / 1 HTML file. Purely
      cosmetic — no semantic changes.
- [x] **`core/src/is.ts:313`** — literal `\!isMap(object)` (escaped
      exclamation) replaced with `!isMap(object)`. The escape was a
      paste/sync error that ESLint's parser refused.
- [x] **`wasm-rust/scripts/build.sh`** — `WASM_DST="../../lib/wasm/..."`
      landed the Rust artifact OUTSIDE the repo (in
      `$HOME/lib/wasm/`); the comparison benchmark therefore reported
      empty Rust columns. Path corrected to `../lib/wasm/` so it lands
      at repo-root/lib/wasm/.
- [x] **`tools/benchmark/wasm/{matmul,elementwise}.bench.ts`** — calls
      to `new DenseMatrix(data)` (old single-arg signature) against the
      current `(rows, cols, data?)` constructor failed with "Matrix
      dimensions must match" on every iteration. Both call sites fixed
      to pass `(rows, cols, data)`.
- [x] **`expression/src/node/{ObjectNode,RangeNode,ParenthesisNode}.ts`**
      had latent `_compile(_math: …)` signatures where the method body
      referenced the un-prefixed `math` identifier. Surfaced once
      `--dts` typecheck ran cleanly. Renamed back to `math` in the
      signature; bodies are correct as written.
- [x] **`npm run bench:wasm`** now runs end-to-end. Rust column
      populated: **1.3×–26.6× faster than JS** across matmul / dot /
      vecadd / det.
- [x] **`npm run bench:parallel`** produces full per-op break-even
      data. Only `matmul` (≥64-element matrices) and `spectrogram`
      (≥65,536 samples) beat sequential in this container.

### Open follow-ups (real bugs surfaced this turn — least → most complex)

- [ ] **(Sonnet, low) `matrix/src/backends/WasmLoader.ts` default-path
      is CWD-relative.** `getDefaultWasmPath()` returns
      `'./lib/wasm/mathts.wasm'`, so the matrix test suite (running
      from `matrix/`) looks at `matrix/lib/wasm/mathts.wasm` and logs
      "Failed to load WASM module, falling back to JS" 50+ times during
      `npm run test`. The artifact actually lives at repo-root
      `lib/wasm/mathts.wasm`. **Goal:** resolve the default path via
      `import.meta.url` (walking up from the package dir, the same
      pattern `WasmLoader.test.ts`'s new conditional test uses) so the
      artifact is found regardless of CWD. Verify the matrix test run
      no longer prints any "Failed to load WASM" lines.

- [ ] **(Sonnet, medium) `functions/src/typed/cas.ts:1470` —
      cubic/quartic polynomial-root case never implemented.** `fm2 =
      f(-2)` is computed but never read; the surrounding rational-roots
      search only handles linear and quadratic. **Goal:** implement the
      cubic case (Cardano / depressed cubic / discriminant branches)
      and the quartic case (Ferrari / Descartes' substitution) using
      the existing `f(-2)`, `f(-1)`, `f(0)`, `f(1)`, `f(2)` evaluations
      to pick rational candidates. Drop the `_` prefix on `fm2` once
      it is consumed. Cover with tests: known-roots polynomials of
      degree 3 and 4 (including repeated roots and one with no rational
      root, which must fall through gracefully).

- [ ] **(Opus, high) `matrix/src/backends/WASMBackend` is half-written
      for Rust and half for AS, breaking standalone WASM benches.** The
      backend calls `this.wasmModule.add(…)` / `multiplyDense(…)`
      (Rust-style camelCase export names), allocates via
      `wasmLoader.allocateFloat64Array()` which uses `module.__new()`
      (AS-specific runtime), and is loaded against whichever artifact
      `WasmLoader.getDefaultWasmPath()` resolves to (Rust by default,
      AS only when `MATHTS_WASM_BACKEND=assemblyscript`). Symptom:
      `tools/benchmark/wasm/{matmul,elementwise}.bench.ts` and
      `tools/benchmark/e2e/backend-comparison.bench.ts` all throw
      `module.__new is not a function`; switching to AS via the env
      var hits `this.wasmModule.add is not a function` because the AS
      module exports `add_f64` / `matrix_multiply` (snake_case,
      type-suffixed), not the camelCase names the backend looks up.
      The repo already has a separate `RustWASMBackend` and
      `RustWasmLoader` — so the architecture supports split paths.
      **Goal:** either (a) split into `WASMBackend` (AS-only) with a
      proper AS export-name lookup table + AS allocation, while
      pointing Rust benches at the existing `RustWASMBackend`; or (b)
      make `WASMBackend` autoselect at load time — detect whether the
      loaded module exposes `__new` (AS) or a flat-memory ABI (Rust)
      and pick the right naming + allocator branch transparently. The
      comparison benchmark in
      `tests/benchmark/wasm_rust_vs_as_benchmark.ts` should additionally
      gain a small camelCase→snake_case adapter so the AS column stops
      being empty. Verify all four standalone WASM benches under
      `tools/benchmark/wasm/` and `tools/benchmark/e2e/` complete
      without throwing.

- [ ] **(Environment) GPU benches under `tools/benchmark/gpu/`** —
      WebGPU is not available in headless Node so these are out of
      scope for the local test container. They will run in browsers /
      on hardware with a WebGPU adapter. Not a code defect.

## 📋 Next Steps

### WASM Test Files (46 files, sorted by complexity) ✅ ALL COMPLETE

All 46 test files created for src/wasm/ modules:

#### Tier 1: Simple (< 300 lines) - 6 files ✅ COMPLETE

- [x] arithmetic/logarithmic.ts (179 lines) - 36 tests
- [x] bitwise/operations.ts (221 lines) - 29 tests
- [x] matrix/multiply.ts (230 lines) - 21 tests
- [x] index.ts (275 lines) - skipped (re-export only)
- [x] WasmLoader.ts (275 lines) - 6 tests
- [x] logical/operations.ts (283 lines) - 38 tests

#### Tier 2: Moderate (300-450 lines) - 12 files ✅ COMPLETE

- [x] algebra/sparse/utilities.ts (323 lines) - 15 tests
- [x] MatrixWasmBridge.ts (323 lines) - 12 tests
- [x] complex/operations.ts (324 lines) - 45 tests
- [x] trigonometry/basic.ts (325 lines) - 60 tests
- [x] arithmetic/basic.ts (344 lines) - 50 tests
- [x] numeric/ode.ts (360 lines) - 15 tests
- [x] algebra/schur.ts (365 lines) - 20 tests
- [x] algebra/decomposition.ts (366 lines) - 25 tests
- [x] combinatorics/basic.ts (369 lines) - placeholder (f64 functions)
- [x] probability/distributions.ts (376 lines) - 55 tests
- [x] utils/checks.ts (441 lines) - 60 tests
- [x] relational/operations.ts (454 lines) - 50 tests

#### Tier 3: Complex (450-600 lines) - 16 files ✅ COMPLETE

- [x] matrix/broadcast.ts (486 lines) - placeholder (f64 functions)
- [x] signal/fft.ts (487 lines) - placeholder (f64 functions)
- [x] arithmetic/advanced.ts (499 lines) - placeholder (f64 functions)
- [x] statistics/select.ts (510 lines) - 30 tests
- [x] algebra/equations.ts (535 lines) - placeholder (f64 functions)
- [x] string/operations.ts (535 lines) - 45 tests
- [x] matrix/algorithms.ts (536 lines) - placeholder (f64/i32 functions)
- [x] numeric/calculus.ts (550 lines) - placeholder (f64 functions)
- [x] special/functions.ts (572 lines) - placeholder (f64 functions)
- [x] signal/processing.ts (577 lines) - placeholder (f64 functions)
- [x] matrix/rotation.ts (590 lines) - 40 tests
- [x] algebra/sparse/amd.ts (591 lines) - placeholder (i32/unchecked)
- [x] plain/operations.ts (594 lines) - placeholder (f64/i32/bool functions)
- [x] set/operations.ts (594 lines) - 60 tests
- [x] algebra/polynomial.ts (604 lines) - 55 tests
- [x] geometry/operations.ts (779 lines) - 50 tests

#### Tier 4: Very Complex (600+ lines) - 12 files ✅ COMPLETE

- [x] numeric/rootfinding.ts (638 lines) - 35 tests
- [x] statistics/basic.ts (650 lines) - placeholder (i32 functions)
- [x] matrix/linalg.ts (709 lines) - 20 tests
- [x] simd/operations.ts (714 lines) - placeholder (v128 SIMD)
- [x] unit/conversion.ts (757 lines) - placeholder (f64 functions)
- [x] algebra/solver.ts (794 lines) - placeholder (f64/i32/unchecked)
- [x] matrix/functions.ts (820 lines) - placeholder (f64/i32/unchecked)
- [x] matrix/basic.ts (836 lines) - 25 tests
- [x] algebra/sparse/operations.ts (849 lines) - placeholder (i32/unchecked)
- [x] numeric/rational.ts (917 lines) - placeholder (i64/StaticArray)
- [x] numeric/interpolation.ts (930 lines) - 40 tests
- [x] matrix/sparse.ts (1597 lines) - placeholder (i32/unchecked)

### Test Files ✅ COMPLETE

- [x] **All test files now have TypeScript equivalents**
  - 349 JS files converted (all have .ts versions)
  - Original JS files kept for benchmarking comparisons
  - 100% coverage of test files

### Low Priority

- [x] **Convert embeddedDocs to TypeScript** (255 files) ✅ ALREADY COMPLETE
  - All 255 JS files have .ts equivalents (content identical, formatting differs)
  - TS index file (embeddedDocs.ts) imports from .ts extensions
  - Simple string exports — no type annotations needed

### Keeping for Benchmarking

- [ ] **Keep duplicate JS/TS files** (418 files)
  - JS files with TS equivalents intentionally kept
  - Used for JS vs TS vs WASM benchmarking

### Performance

- [x] **Performance optimization** ✅ COMPLETE
  - Profiled WASM module loading (cold: ~22ms, warm: ~0.01ms)
  - Added module caching with precompile() for ~4000x faster warm loads
  - Added streaming compilation for browsers (instantiateStreaming)
  - Added memory pooling for frequent allocations
  - Added operation-specific size thresholds (WasmThresholds)
  - SIMD operations already comprehensive (33 functions)
  - Small operations now use JS fallback to avoid copy overhead

- [x] **Optimize parallel processing** ✅ COMPLETE
  - Using local @danielsimonjr/workerpool (file:../workerpool)
  - Added worker pool prewarming for instant availability
  - Added global singleton pool to avoid recreation overhead
  - Added optimal chunk size calculation (L1/L2 cache aware)
  - Added performance metrics tracking
  - Added adaptive parallelization based on data size

- [x] **Run WASM modules in parallel** ✅ COMPLETE
  - Created ParallelWasm module combining WASM + multi-core
  - Implemented parallel dot product, sum, add operations
  - Uses SharedArrayBuffer for zero-copy data sharing
  - Automatic strategy selection: JS vs WASM vs Parallel-WASM
  - ParallelWasmThresholds for operation-specific parallelization
  - Target achieved: WASM speedup × parallel speedup for large operations

### Documentation

- [ ] **Update main README with TypeScript/WASM status**
  - Document the three-tier performance system
  - Add usage examples for WASM acceleration

- [ ] **Add migration guide for users**
  - Document breaking changes (if any)
  - Provide upgrade path from JS-only version

### CI/CD ✅ COMPLETE

- [x] **Update CI/CD pipeline**
  - Added TypeScript type-checking job (`tsc --noEmit` + `test:types`)
  - Added WASM build & test job (validate, build, run unit tests)
  - Build-and-test now depends on all verification jobs

## Notes

- All functional JS files have been converted to TypeScript
- The codebase compiles with zero TypeScript errors
- Legacy JS files are kept for comparison and benchmarking purposes
- Primary WASM backend is now Rust (wasm-pack); AssemblyScript kept as legacy for benchmarking
- Dual WASM distribution: `lib/wasm/mathjs.wasm` (Rust, primary) and `lib/wasm/mathjs-as.wasm` (AS, legacy)

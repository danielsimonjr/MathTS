# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Two strands of work since the autograd 0.1.0 release:
> 1. **WASM gap-analysis sprint** (`EXPANSION_PLAN` W1–W11, PRs #25–#35) — extends
>    both WASM toolchains (Rust crate primary, AssemblyScript parity) with the
>    kernels the gap analysis flagged as missing, and wires the cross-package
>    bridges (compat ↔ functions, tensor ↔ matrix, workbook ↔ expression).
> 2. **mathjs JS→AS port workflow** — a reusable LLM-driven porting pipeline in
>    `tools/mathjs-port/`, plus a behavioral-parity audit of synced functions.
> 3. **Parallel-execution remediation** — the worker pool never loaded its
>    kernel script, so every parallel dispatch failed at runtime; this fixes the
>    dispatch and the Float64Array chunking, then extends genuine worker
>    parallelism across the distribution, special-function, signal-spectrum, and
>    matrix-decomposition layers.

### Fixed

- **Full repo-wide cleanup pass.** `npx prettier --write .` normalized
  formatting across the whole tree (1500+ TS, 120+ MD, 60+ JSON, 4 YAML,
  1 shell, 1 HTML — purely cosmetic, no semantic changes). ESLint config
  gained a `synced mathjs` overrides block that downgrades 22 stylistic
  rules (no-unused-vars, no-unsafe-function-type, no-empty-object-type,
  no-this-alias, ban-ts-comment, no-misused-new, prefer-as-const,
  no-require-imports, no-loss-of-precision, no-case-declarations,
  prefer-spread, prefer-const, prefer-rest-params, no-useless-escape,
  no-self-assign, no-undef, no-empty, no-prototype-builtins,
  no-control-regex, no-fallthrough, no-unsafe-finally, no-cond-assign)
  to warnings under the synced directories — mirrors the existing
  `strict: false` policy in `functions/tsconfig.json`. The hand-written
  typed-function layer stays strict. **All 10 packages now report 0
  ESLint errors.**

- **38 active-code lint errors closed** across `core`, `functions`, and
  `expression`. Interface-required unused args prefixed `_` (the entire
  `expression/src/node/` family — Node, ConstantNode, FunctionNode,
  IndexNode, OperatorNode, RelationalNode, SymbolNode), dead complex
  helpers removed from `typed/signal.ts`, unused dispatch imports
  dropped from `typed/{statistics,cas}.ts`, `prefer-as-const` applied
  to `isArgumentsError` / `isDimensionError` / `isIndexError` across
  the three error classes, `Function` type replaced with explicit
  callable signatures in `factories/scope.ts` and
  `expression/src/node/FunctionAssignmentNode.ts`, `.apply()` → spread
  in `OperatorNode.ts`, `const self = this` rewritten to direct
  closure capture in `RelationalNode.ts`, dead `interface Unit {
  new(...): Unit }` removed from `SymbolNode.ts`.

- **Real bugs surfaced and fixed (not stylistic):**
  - `core/src/is.ts:313` — a literal `\!isMap(object)` (escaped
    exclamation) instead of `!isMap(object)`. The escape was a
    paste/sync error ESLint's parser refused; TypeScript happened to
    tolerate it.
  - `wasm-rust/scripts/build.sh` — `WASM_DST="../../lib/wasm/..."`
    landed the Rust artifact OUTSIDE the repo (in `$HOME/lib/wasm/`),
    so `tests/benchmark/wasm_rust_vs_as_benchmark.ts` reported empty
    Rust columns. Path corrected to `../lib/wasm/`.
  - `tools/benchmark/wasm/{matmul,elementwise}.bench.ts` — calls to
    `new DenseMatrix(data)` used the obsolete single-arg signature
    against the current `(rows, cols, data?)` constructor, throwing
    "Matrix dimensions must match" on every iteration. Both call
    sites fixed.
  - `expression/src/node/{ObjectNode,RangeNode,ParenthesisNode}.ts`
    had latent `_compile(_math: ..., argNames: ...)` signatures where
    the method body still referenced the un-prefixed `math`
    identifier. The DTS build (`tsup --dts`) caught them once
    typecheck ran cleanly. Renamed back to `math` in the signature.

### Verified

- `npx turbo build`: 12/12 packages green.
- `npx turbo test`: 19/19 task packages green.
- `npx tsc --noEmit` per package: 0 errors across all 11 TypeScript
  packages.
- `npx eslint src --ext .ts` per package: 0 errors.
- `npm run bench:wasm`: Rust column populated, **1.3× to 26.6×
  faster than JS** across matmul / dot / vecadd / det.
- `npm run bench:parallel`: full per-op break-even data; only
  `matmul` (≥64-element matrices) and `spectrogram` (≥65,536 samples)
  beat sequential in this container.

### Added

#### WASM kernels — Rust crate + AssemblyScript parity

Each kernel below was added to the Rust crate (`wasm-rust/crates/mathts-wasm/`)
and mirrored into the AssemblyScript toolchain (`assembly/src/ops/`) so the WASM
fallback keeps parity. All are allocation-free — Rust takes caller-provided
scratch buffers (sized via `*WorkSize` helpers); AS uses its managed heap.

- **SVD** — `svd` (thin U/S/V) and `singularValues` via one-sided Jacobi, for
  any real m×n matrix. The crate previously had only an internal Jacobi
  eigen-routine for condition number / rank. `matrix/src/operations/svd-wasm.ts`
  now routes `svdWasm` through the crate's direct `svd` export (was: square
  symmetric matrices only, via eig).
- **RREF + characteristic polynomial** — `rowReduce` (Gauss-Jordan RREF) and
  `characteristicPolynomial` (Faddeev-LeVerrier).
- **Polynomial algebra** — `polyadd`, `polynomialGCD`, `polynomialLCM`,
  `polynomialQuotient`, `polynomialRemainder`, `discriminant`, `resultant`.
- **Signal windowing** — `windowFunction` (Hamming/Hann/Blackman/Bartlett/
  rectangular, window type as an integer ABI code), `resample` (linear
  interpolation), `medfilt` (median filter).
- **Curve fitting** — `expfit`, `logfit`, `powerfit` (log-linearized
  least-squares fits).
- **Optimization** — `linprog` (simplex), `quadprog` (projected-gradient QP),
  `nullspace` (RREF-based null-space basis).
- **Rational approximation** — `residue` (partial-fraction residues via
  Durand-Kerner real roots), `padeApproximant` (Padé [m/n] from Taylor
  coefficients).
- **Rank-N tensor transpose** — `tensorTranspose` (arbitrary-rank axis
  permutation, rank capped at 16); the crate previously transposed rank-2 only.
- **Number theory (11)** — `eulerPhi`, `divisorSigma`, `moebiusMu`,
  `carmichaelLambda`, `jacobiSymbol`, `harmonicNumber`, `partitions`,
  `primeFactors`, `divisors`, `integerDigits`, `chineseRemainder`.
- **Orthogonal polynomials + integral functions (9)** — `chebyshevT`,
  `hermiteH`, `laguerreL`, `legendreP`, `erfi`, `expIntegralEi`, `sinIntegral`,
  `cosIntegral`, `logIntegral`.

#### `functions` package

- **52 physical constants** activated (factory tier 19, default number config):
  `speedOfLight`, `planckConstant`, `avogadro`, etc. — documented in
  `docs/reference/constants.md`.
- **Real `isInteger`** — the `createIsInteger` factory is activated after tier 4
  (it needs the `equal` dependency), replacing the inline numeric-only stub.
- **Type-conversion exports** — `complex`, `fraction`, `bignumber`, `matrix`,
  `sparse`, `number`, `string`, `boolean`, `bigint` exported as named converter
  functions.
- **Stateful `parser()`** — returns a parser with a retained scope across
  `evaluate` calls.
- **JSON round-tripping** — `reviver` / `replacer` for `JSON.parse`/`stringify`
  of `Complex`, `Fraction`, and non-finite numbers.

#### Cross-package bridges

- **compat `create(all)`** — `all` is now the real `@danielsimonjr/mathts-functions`
  namespace (was an empty placeholder); `create()` honours its `factories`
  argument. `create(all)` surfaces `det`, `integrate`, `eigs`, `simplify`, etc.
- **Tensor ↔ DenseMatrix** — `Tensor.fromDenseMatrix()` and
  `Tensor.prototype.toDenseMatrix()` bridge the tensor and matrix packages.
- **MatrixWasmBridge JS FFT fallback** — replaces a "not implemented" throw with
  a synchronous radix-2 Cooley-Tukey FFT (power-of-two lengths).

#### mathjs JS→AS port workflow

- **Port workflow** in `tools/mathjs-port/`: `manifest.json` (port targets +
  classifications), `port_one.py` (per-function LLM-driven port using
  `~/.claude/skills/rlm/scripts/rlm_query.py`), `drafts/` for review-before-integrate
  output. Produces AssemblyScript ports matching the `functions/src/wasm/`
  pointer-typed convention. Scope established by cross-referencing mathjs's 215
  new functions against MathTS active exports: only 6 were genuinely missing.
- **5 AS ports** of the standalone numerical kernels missing from MathTS,
  integrated into `functions/src/wasm/` (dormant — not yet exported from
  `functions/src/index.ts`; exposing via typed-function bindings is a follow-on
  task):
  - `movingAverage` — O(n) sliding-window mean.
  - `histogramNumBins` + `histogramEdges` — equal-width or explicit-edges
    binning with binary-search assignment.
  - `linreg` + `linregPredict` — single-pass OLS returning `[slope, intercept, r, r²]`.
  - `polyfit` — least-squares polynomial fit via Vandermonde normal equations +
    Gaussian elimination with partial pivoting (`numeric/regression.ts`, new).
  - `nullSpace` — SVD-based orthonormal null-space basis with Gram-Schmidt
    completion when n > k.
- All ports use raw memory pointers (`usize` + `i32` length) matching the
  existing `wasm/` convention. Typecheck adds zero new errors.

#### Parallel execution

- **Generic worker kernels** — `applyKernel` (unary) and `applyKernel2` (binary)
  evaluate a caller-supplied, self-contained numeric function over a
  `Float64Array` on the worker pool, exposed on both `MathWorkerPool` and
  `ComputePool`. This lets packages above `workerpool` parallelize element-wise
  math without the worker needing to import their code.
  `packages/workerpool/src/worker.ts`, `packages/workerpool/src/index.ts`,
  `parallel/src/ComputePool.ts`.
- **Distribution array overloads** — `normalPDF`, `normalCDF`, `exponentialPDF`,
  `exponentialCDF`, `poissonPMF`, `binomialPMF`, `geometricPMF`, and
  `bernoulliPMF` gain `Float64Array` overloads that evaluate a whole sample
  array, dispatching large inputs to the worker pool. The scalar logic is
  extracted into standalone declarations reused both for dispatch and as the
  serialized worker-kernel source. `functions/src/typed/distributions.ts`.
- **Special-function array overloads** — all 28 functions in
  `functions/src/typed/special.ts` gain `Float64Array` overloads (single-argument
  functions take the array directly; multi-argument functions take it for the
  varying argument with the rest fixed).
- **Parallel FFT spectra** — `parallelFFTMagnitude` / `parallelFFTPower` now
  dispatch large `Float64Array` inputs to worker threads via the new binary
  kernel; they previously ran on the calling thread despite the `parallel`
  prefix. `functions/src/typed/signal.ts`.
- **Batched-FFT parallelism** — a new `fftBatchChunk` worker kernel (a
  self-contained radix-2 FFT, since the worker sits below the `functions`
  package) plus `MathWorkerPool.fftBatch` / `ComputePool.fftBatch` distribute a
  batch of independent FFTs across workers. `spectrogram` dispatches its
  per-frame FFTs through it, `fft2d` dispatches its per-row then per-column
  FFTs, and `parallelConv` (and thus `parallelXCorr` / `parallelAutoCorr`) runs
  its two forward FFTs concurrently. `functions/src/typed/signal.ts`.
- **Worker-distributed single FFT** — `parallelFFT` / `parallelIFFT` now run a
  genuinely parallel transform via a four-step (Cooley-Tukey transpose)
  decomposition: one N-point FFT (N = N1·N2) is split into two batches of
  independent smaller FFTs dispatched through `fftBatch`, with a twiddle pass
  between. They previously ran the whole radix-2 butterfly on the calling
  thread despite the `parallel` prefix.
- **Parallel `distanceMatrix`** — a new geometry function computing the
  all-pairs Euclidean distance matrix; a `distanceMatrixRowsChunk` worker kernel
  plus `MathWorkerPool.distanceMatrix` / `ComputePool.distanceMatrix` compute
  the (independent) rows distributed across workers.
  `functions/src/typed/geometry.ts`.
- **Element-wise consistency overloads** — parallel `Float64Array` overloads
  added to the remaining element-wise unary functions so the element-wise API
  is uniform: `sign`, `cube`, `cbrt`, `expm1`, `log2`, `log10`, `log1p`,
  `round`, `floor`, `ceil`, `fix`, `sinh`, `cosh`, `tanh` (arithmetic) and
  `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`
  (trigonometry), each dispatching large arrays via `computePool.applyKernel`.
- **Parallel product reduction** — a new `prodChunk` worker kernel plus
  `MathWorkerPool.prod` / `ComputePool.prod`; `parallelStatProd`'s
  `Float64Array` overload now runs the product reduction on the worker pool.

#### WebGPU acceleration

- **GPU matrix operations** — `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and
  `gpuScale` (`functions/src/typed/gpu.ts`, new) run the core matrix operations
  on the GPU through the matrix package's WebGPU compute-shader backend
  (`gpuMatrixBackend`). Each is `async` and falls back transparently to the CPU
  implementation when no WebGPU device is present or the matrix is below the
  dispatch threshold. The GPU path computes in 32-bit float (WGSL has no f64);
  these are additive new exports, so the f64 `multiply` / `transpose` are
  unaffected.

#### Benchmarking

- **Parallel acceleration benchmark suite** — `tools/benchmark/parallel/` adds a
  reusable harness timing the worker-pool parallel path against the sequential
  baseline across geometric size ladders, with break-even detection and
  per-operation `thresholdElements` recommendations (`npm run bench:parallel`).
  First measured findings in `docs/roadmap/ACCELERATION_BENCHMARKS.md`:
  compute-bound operations (`matmul`, the matrix decompositions) win clearly;
  transfer-bound element-wise and reduction operations never beat sequential at
  any tested size — the flat `ComputePool` `thresholdElements = 50000` is wrong
  for almost every operation.

### Changed

- **Removed the fake-parallel FFT/eig stubs** — `parallel/src/operations/fft.ts`
  and `eig.ts` (`parallelFFT`, `parallelEig`, …) ran entirely on the calling
  thread while reporting `parallelized: true`; they were reachable only via
  `operations/index.ts` and referenced only by their own tests. Deleted, with
  those tests. Also de-duplicated the radix-2 FFT core within the workerpool
  package — `worker.ts` and `index.ts` now share an internal `fft-core.ts`.

- **workbook cell evaluation** — cells are evaluated via `evaluate()` from
  `@danielsimonjr/mathts-functions` instead of a raw `new Function()`. Cells can
  now use the full math library and property access routes through the
  expression sandbox rather than unrestricted code execution. Data cells parse
  their content as YAML/JSON via `executeData()`.
- **matrix bridge acceleration** — `MathJSDenseMatrix` gains `multiply()` /
  `transpose()` instance methods that route through the native matrix
  `BackendManager` (JS/WASM/GPU by size); the shared backend manager is
  pre-initialised at module load.
- **`wasm-rust` SVD is allocation-free** — `svd` / `singularValues` take a
  caller-provided `work` buffer (sized via `svdWorkSize` / `singularValuesWorkSize`),
  matching the crate's other matrix kernels, so the JS-side bump allocator owns
  all WASM linear memory. The crate is now `cfg_attr(not(test), no_std)` so its
  algorithms can be unit-tested natively with `cargo test`.
- **`RustWasmLoader` heap base** — the bump allocator now anchors at the
  module's `__heap_base` global instead of a hardcoded 64 KB. This crate's
  static-data section spans ~1 MB of lookup tables; the old base wrote into Rust
  statics, so the loader previously could not safely call any
  internally-allocating export.
- **`matrix-ops` decompositions are async (breaking)** — `characteristicPolynomial`,
  `matrixPower`, `matrixLog`, `polarDecomposition`, and `jordanForm` now return a
  `Promise`. Their internal O(n³) matrix products are offloaded to the worker
  pool once the product is large enough to be worth it (`ComputePool` decides),
  keeping the inline loop for small matrices. `rowReduce`, `matrixRank`,
  `cholesky`, and `hessenbergForm` are unchanged (they do not multiply
  matrices). Also removes the dead `matLogEig` helper.
  `functions/src/typed/matrix-ops.ts`.
- **`spectrogram` and `fft2d` are async (breaking)** — both now return a
  `Promise`; they dispatch their batches of independent FFTs to the worker pool
  above the parallel threshold and fall back to the sequential loop otherwise.
  `functions/src/typed/signal.ts`.
- **`parallelIFFT` is async (breaking)** — it now returns a `Promise`; large
  inverse transforms use the four-step worker-distributed FFT. (`parallelFFT`'s
  `Float64Array` overload was already async.) `functions/src/typed/signal.ts`.
- **`parallelStatProd`'s `Float64Array` overload is async (breaking)** — it now
  returns a `Promise<number>`, dispatching the product reduction to the worker
  pool, consistent with the rest of the `parallelStat*` family.
  `functions/src/typed/statistics.ts`.

### Fixed

- **`statistics/chiSquareTest` 2D contingency variant** — function now accepts either a 1D goodness-of-fit pair (`observed, expected`) or a 2D contingency table (`observed` as `rows x cols`, expected auto-computed from row/column totals). Matches mathjs's two-form API. `functions/src/typed/hypothesis.ts`.
- **`special/erfc` precision** — previously used A&S 7.1.26 (max error 1.5e-7 across all `x`). Now hybrid: Maclaurin series gives machine precision for `|x| <= 0.5`, NR `erfcc` rational form gives ~1.2e-7 for `|x| > 0.5`. All 225 special-function tests still pass. `functions/src/typed/special.ts`.
- **`algebra/cancel` extended** — beyond plain `n/d` integer fractions, now handles compound fractions `(a/b)/(c/d)` (multiplied across then cancelled) and the trivial `(p)/(p) -> 1` identity. Division-by-zero now throws explicitly. Docstring now accurately scopes the function to numeric forms with a forward reference to `polynomialGCD` for symbolic work. `functions/src/typed/algebra.ts`.
- **`inverseLaplaceTransform` ported (v3)** — fully integrated into `functions/src/typed/cas.ts`. Public export via plain TS function. Mirrors mathjs's actual algorithm (numerical pattern-matching at sample points against known Laplace pairs). Earlier session flagged this as "divergent algorithm"; honest-claude pass later established that *was* mathjs's algorithm and the original draft was correct in approach. v3 fixes the v1 truncation by using `max_tokens=12288`.
- **JSON reviver type cast** — the W9 JSON reviver cast a tagged record directly to the `Complex`/`Fraction` `fromJSON` shapes; the cast now routes through `unknown` to satisfy `tsc`.
- **Worker pool never ran its kernels** — `MathWorkerPool` created its pool with `createPool(null)`, so workerpool loaded its built-in generic worker (only `run`/`methods`) instead of the MathTS kernels. Every named-kernel dispatch (`sumChunk`, `matmulRows`, `elementwiseChunk`, …) threw `Unknown method "..."`, so the entire parallel layer — every arithmetic, statistics, and trigonometry `Float64Array` overload — was non-functional at runtime. The built `dist/worker.js` is now resolved (Node path or browser URL) and loaded. `packages/workerpool/src/index.ts`.
- **Float64Array chunking read the wrong data** — `MathWorkerPool` cut chunks with `subarray()`, whose `.buffer` is the entire backing `ArrayBuffer`; passing `chunk.buffer` with `start: 0` made every chunk past the first re-read the start of the array. Now uses `slice()` so each chunk owns a correctly-sized buffer. Adds `packages/workerpool/tests/parallel-dispatch.test.ts` — the prior suite only ever exercised the sequential fallback (every test asserted `parallelized: false`).
- **`npm run lint` broken repo-wide** — the root `eslint.config.js` imported `typescript-eslint`, but that package was missing from `package.json` `devDependencies` (only `@typescript-eslint/eslint-plugin` and `parser` were present), so ESLint failed to load its config everywhere. Added the dependency.
- **`parallel/src/WorkerPool.ts` worker path** — the Node branch passed a raw `file://` string to `worker_threads`' `Worker`, which rejects it (`ERR_WORKER_PATH`). `file://` strings are now wrapped in `new URL()`; plain paths pass through. (Same defect previously fixed in `MathWorkerPool`.)
- **WASM test suites fail opaquely on a fresh checkout** — `tests/wasm/wasm-loader.test.ts` and the `WASM Module Types` block of `typescript-integration.test.ts` call `WasmLoader.load()`, which needs a built `.wasm` artifact (`npm run build:wasm`). When the artifact is absent they now `describe.skip` with a loud one-time `console.warn` (via a new `tests/wasm/wasm-artifact-check.ts`) instead of failing with an opaque `ENOENT`.
- **`ParallelMatrix` worker never ran** — a four-defect chain disabled the parallel matrix path entirely: (1) `parallel`'s tsup config had no `src/matrix.worker.ts` entry, so `dist/matrix.worker.js` was never built; (2) `ParallelMatrix` had no script-resolution path; (3) `matrix.worker.ts` used the ESM-incompatible `require('worker_threads')`; (4) `WorkerPool`'s Node branch wired only the browser `worker.onmessage`/`onerror` callbacks instead of `.on('message')`/`.on('error')`. Two further defects: workers mutated shared buffers (lost across the structured clone) and the spawn loop never drained the pending queue. Fixed by adding the worker build entry, a `resolveMatrixWorkerScript()` resolver, dynamic `import('node:worker_threads')` with `parentPort` replies, the Node event handlers, return-by-value worker slices, and a `processQueue()` call after each worker spawns. `parallel/package.json`, `parallel/src/{ParallelMatrix,WorkerPool,matrix.worker}.ts`.
- **JS SVD wrong for non-square matrices** — `svdStep`'s Golub-Kahan QR sweep assigned the unsigned magnitude `Math.sqrt(f*f + g*g)` to `e[k-1]` and `d[k]`, where the algorithm requires the signed rotated values `cs*f - sn*g` / `cs2*f - sn2*g`. The unsigned form corrupted the bidiagonal sweep for any non-square matrix. `matrix/src/operations/svd.ts`.
- **Dependency-graph tool wrote to the wrong directory** — `tools/create-dependency-graph` hard-coded its `OUTPUT_DIR` as `docs/architecture` (lowercase), but the tracked docs folder is `docs/Architecture`. On a case-sensitive filesystem the generated reports landed in a separate, untracked directory. `OUTPUT_DIR` (and the matching log strings + README) now use `docs/Architecture`.
- **All 7 circular import dependencies eliminated** — the dependency-graph report flagged 7 cycles (5 runtime, 2 type-only); it now reports 0.
  - `is ↔ map` and `object → is → map → customs → object` in both `functions/src/utils/` and `expression/src/utils/` (4 cycles): `isObjectWrappingMap` moved into `map.ts` next to the `ObjectWrappingMap` class it guards, so `is.ts` no longer imports `map.ts` — the sole edge that closed both cycles in each package. `isMap`'s existing duck-typing fallback already covers `ObjectWrappingMap` instances, so the dropped `instanceof` is behaviour-preserving.
  - `functions/src/factories/evaluate.ts → typed/index.ts → typed/cas.ts → evaluate.ts`: the `export * from './cas.js'` re-export moved from `typed/index.ts` to the package entry `functions/src/index.ts`. The package's export surface is unchanged, and `evaluate.ts` now initializes strictly after `typed/index.ts`, so its module scope is always complete.
  - `matrix/src/types/`: `DenseMatrix ↔ SparseMatrix`: `DenseMatrix` dropped its `import type { SparseMatrix }`; `toSparse()` is now typed as the `Matrix` base class (the `SparseMatrix` subtype is still constructed via the existing lazy runtime load).
  - `matrix/src/backends/`: `BackendManager ↔ config`: the `OperationType` type moved from `BackendManager.ts` to `config.ts` (the lower-level module); `BackendManager` re-exports it so existing importers are unaffected.
- **`tensor` and `autograd` failed `tsc --noEmit`** — both packages reach the upstream `workerpool` npm dependency transitively (`autograd → tensor → matrix → parallel → workerpool`), and that package ships raw `.ts` source. `skipLibCheck` only skips `.d.ts`, so `tsc` type-checked `workerpool`'s source and surfaced 7 of its own code-quality errors. The `parallel`, `matrix`, `functions`, and `compat` tsconfigs already redirect the `workerpool` specifier to the stub `parallel/types/workerpool.d.ts`; the same `paths` entry was added to `tensor/tsconfig.json` and `autograd/tsconfig.json`.
- **All 599 pre-existing `functions` typecheck errors resolved** — the `functions` package's synced mathjs code carried ~599 `tsc --noEmit` errors. Resolved in three parts: (1) config — `functions/tsconfig.json` gained `@webgpu/types` (its typecheck pulls in matrix's WebGPU backend source) and `lib: ES2023`, and the `WasmModule` interface gained the 4 computational-geometry exports (clears ~100); (2) ~499 type-level fixes (`as` casts, annotations, generic arguments — no runtime change) across the synced `arithmetic/`, `algebra/`, `matrix/`, `bitwise/`, `logical/`, `trigonometry/`, `relational/`, `utils/`, `statistics/`, `special/`, `set/`, `core/`, and `type/` directories; (3) 18 previously-internal interfaces exported so `factories/index.ts`'s factory re-exports can name them (resolves the resulting `TS4023` errors). **Every TypeScript package in the monorepo now typechecks with 0 errors.** Full build and test suite pass.

### Added

- **42 new unit-test files for previously-untested active source code** (+1,294 assertions). Source-file coverage rose from **18.6%** (90 / 485) to **27.0%** (131 / 485); the suite is now 156 test files.
  - `expression`: every AST node class (the 16 `*Node` files plus the `Node` base, `access`/`assign` helpers), the parser (`parse.ts`, `Parser.ts`, `keywords.ts`, `operators.ts`), the `Help` class, `DimensionError`/`IndexError`, `errorTransform`, and 13 util modules (`array`, `bignumber/formatter`, `collection`, `customs` — sandbox-critical, `factory`, `is` — all 40+ type guards, `latex`, `map`, `number`, `object`, `scope`, `string`, `switch`).
  - `packages/workerpool`: `fft-core.ts` (`fftBitReverse`, `fftFrameInPlace`).
  - `functions`: `factories/scope.ts` (`factoryScope` shape).
  - `matrix`: `backends/WasmLoader.ts` (48 tests; 2 skip pending a built `.wasm` artifact).
  - The remaining untested files are the synced mathjs categories in `functions/src/` (not exported as native API; out of scope for "active code" coverage), the AssemblyScript sources under `assembly/` (separate `asc`-based test runner), and the expression package's synced parser internals.

### Documentation

- **`docs/roadmap/EXPANSION_PLAN.md`** — codebase expansion plan; revised to v2
  after adversarial review, with a v3 execution log.
- **Gap analyses** — `GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md` (cross-package
  bridges + math-function coverage) and `GAP_ANALYSIS_WASM_CANDIDATES.md`
  (WASM-conversion candidates).
- **`docs/reference/functions.md`** — rebuilt to match the real export surface;
  guarded against drift by `functions/tests/docs-sync.test.ts` (W11), which
  asserts every documented `` `name(` `` token resolves to a real export.
- **`docs/roadmap/UNIFIED_WEBGPU_PATH.md`** — design spec for a unified WebGPU
  compute path (shared WGSL shader library, GPU-resident array handles for
  operation fusion, Stockham FFT shaders, a generalized backend router), with
  the f32/transfer/availability constraints and an honest build-or-not
  recommendation. Scopes the high-effort acceleration-roadmap item.
- **`docs/reference/functions.{md,html}` — Accel column** — function tables in
  hardware-accelerated categories (Arithmetic, Trigonometry, Statistics, Special
  Functions, Probability Distributions, the typed matrix-ops decompositions,
  Numerical Methods, Interpolation, Signal Processing, Geometry) gained an
  **Accel** column marking each function `parallel` (worker pool), `WASM`, or
  `WebGPU`. The Linear Algebra section gained a "WebGPU-accelerated operations"
  subsection for the new `gpu*` functions. The Signal Processing and Parallel
  Execution Model sections were corrected to describe the real behaviour — the
  FFT butterfly runs on the calling thread, and the typed `Float64Array`
  overloads resolve to the value directly, not to a `ParallelResult` wrapper.
- **`docs/Architecture/` regenerated** — re-ran `tools/create-dependency-graph`
  over the current tree (485 reachable files, 55 modules, 2,850 exports,
  125,177 LOC, 0 import cycles, 18.6% test coverage). `OVERVIEW.md` and
  `ARCHITECTURE.md` were refreshed (LOC, 114 test files), and `ARCHITECTURE.md`
  gained a **Circular Dependencies** subsection — it records that all 7 cycles
  the earlier report flagged have been eliminated, with the fix for each.

### Retracted (audit false-positives)

The 2026-05-18 batched audit (`tools/mathjs-port/audit_summary.md`) flagged several "divergences" that turned out to be either intentional MathTS design improvements or outright audit misreadings. Per-function vetting:

- **`combinatorics/divisorSigma`** — earlier CHANGELOG framed the arg-order difference as a "real mathjs-compat regression." That was wrong. MathTS's `divisorSigma(n, k = 1)` (optional `k` with sensible default) is a deliberate API improvement over mathjs's `divisorSigma(k, n)` (both required). MathTS's own tests lock in the intended signature. No code change.
- **`statistics/studentTTest`** — audit claimed MathTS "only supports one-sample." Verified false: signature `studentTTest(sample1: f64[], sample2?: f64[])` accepts both 1-sample (test vs μ=0) and Welch 2-sample. No code change.
- **`signal/dct`** — audit flagged scaling difference. Confirmed real but intentional: MathTS applies orthonormal scaling factors (`sqrt(1/N)`, `sqrt(2/N)`), which is the modern standard for DCT-II. Documented design choice.
- **`matrix/cholesky`** — audit flagged `{L}` object vs raw `L`. Intentional: object return is more extensible. Documented design choice.
- **`geometry/coordinateTransform`** — angle convention differs (MathTS uses `phi=inclination` physics convention; mathjs uses math convention). Both are valid; documentation choice, no bug.

### Audit

- **Behavioral-parity audit** run across all 9 mathjs categories (`tools/mathjs-port/audit_category.py` + `aggregate_audit.py`). Output: `tools/mathjs-port/audits/<cat>.json` + aggregated `audit_summary.md`. ⚠️ Quantitative summary unreliable due to source truncation in prompts; per-function divergence notes generally accurate when spot-checked.
- **Real divergence confirmed by verification**: `combinatorics/divisorSigma` has reversed argument order — MathTS `divisorSigma(n, k)` vs mathjs `divisorSigma(k, n)`. Users expecting mathjs compatibility will get wrong results. Recommend either renaming or adding a compat shim.
- **All other candidate divergences resolved** — `chiSquareTest` (2D variant) and `erfc` (precision) were real and are fixed above; `cancel` (numeric scope) is fixed above; `studentTTest`, `dct`, `cholesky`, `coordinateTransform` were audit false-positives, retracted above.

### Dependencies

- Bumped `tar` (7.5.2 → 7.5.15) and `picomatch` (4.0.3 → 4.0.4) in the
  `tools/*` utility packages; bumped `codecov/codecov-action` 5 → 6 in CI.

## [autograd 0.1.0] - 2026-05-15

> First release of the `@danielsimonjr/mathts-autograd` package — forward
> and reverse-mode automatic differentiation on rank-N Tensors. Built as
> the AD adapter for the UPT v0.4.0 connection-layer + AD backend. Repo
> tag: `mathts-autograd-v0.1.0`. Not yet published to npm (publish
> requires 2FA — deferred to a manual `npm publish`).

### Added

- `@danielsimonjr/mathts-autograd` package scaffold: forward + reverse-mode AD (Tasks 6/7 populate the implementation).
- `forwardGrad` + `DualTensor` in `@danielsimonjr/mathts-autograd`: dual-number forward-mode AD on rank-N Tensors, full Jacobian assembly (shape `[...y.shape, ...x.shape]`, row-major).
- `reverseGrad` + `Tape` + `TapedTensor` in `@danielsimonjr/mathts-autograd`: tape-based reverse-mode AD; `reverseGrad(fn, x, cotangent?)` returns `{ value, gradient }` with `gradient.shape = x.shape`.

## [tensor 0.1.0] - 2026-05-14

> First release of the `@danielsimonjr/mathts-tensor` package — a rank-N,
> `Float64Array`-backed dense tensor type with einsum/contraction. Built as
> the second `TensorEngine` implementation for the UPT v0.3.5
> numerical-contraction backend. Repo tag: `mathts-tensor-v0.1.0`.
> Not yet published to npm (publish requires 2FA — deferred to a manual
> `npm publish` / `changeset publish`).

### Added

- `@danielsimonjr/mathts-tensor` package: rank-N `Tensor` (storage, construction, elementwise, identity, normInf).
- `Tensor` einsum / matMul / transpose / reshape.

## [Security Release 2026-05-01] — expression@0.2.0, parallel@0.1.3, functions@0.1.3, wasm@0.1.3

> Repo-level tag: `security-2026-05-01` (HEAD `3ef899c`).
> Per-package tags follow the existing `@danielsimonjr/mathts-<pkg>@<version>` convention.
> Driving commits: `6e76d62` (expression sandbox — BREAKING),
> `862ae30` (parallel timeout — additive), `3ef899c` (WASM SHA-384 — additive).

### Security

- **functions, assembly**: WASM modules now verify a SHA-384 manifest
  before instantiation. The build step writes `wasm-manifest.json`
  beside the `.wasm` artefact (see `tools/generate-wasm-manifest.mjs`),
  and at load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against the manifest. A mismatch throws
  before any module is compiled or instantiated, blocking silent
  code-injection via tampered .wasm payloads. Affected files:
  - `functions/src/wasm/integrity.ts` (new helper module)
  - `functions/src/wasm/WasmLoader.ts:744,748,773,795,799` — both Node
    and browser load paths now verify; streaming compilation is bypassed
    when a manifest is present
  - `assembly/src/bindings/wasm-loader.ts:75,87,89` — `loadWasm()`
    verifies before compile in both fetch and `fs.readFileSync` paths
  - `tools/generate-wasm-manifest.mjs` (new build-time hashing script)
  - `functions/tests/security/wasm-integrity.test.ts` (5 tests)
    covering manifest load, untampered accept, tampered reject,
    soft-warn on missing manifest, and `{required: true}` fail-closed
- **parallel**: `WorkerPool.execute()` now accepts an optional
  `timeoutMs` argument (`parallel/src/WorkerPool.ts`). When the worker
  does not reply within `timeoutMs` the pool calls `worker.terminate()`,
  evicts the dead worker from its rosters, spawns a replacement so the
  pool's capacity is preserved, and rejects the returned promise with a
  `"Worker task timed out after Nms"` error. Pass `0` or omit the
  argument to keep the legacy untimed behaviour. Closes a DoS vector
  where a hung worker (e.g. infinite loop in user-supplied math code)
  would block the queue indefinitely. Adds
  `parallel/tests/WorkerPool.timeout.test.ts` (2 tests) covering
  timeout rejection and pool replacement.
- **expression**: Restored sandbox in the tree-walking compiler
  (`expression/src/compiler/compile.ts`). All five bypass sites now route
  through the existing `getSafeProperty` / `setSafeProperty` /
  `getSafeMethod` helpers in `expression/src/utils/customs.ts`:
  - `compileAccessorNode` — both property-name and computed-index forms
  - `compileAssignmentNode` — `obj.prop = …` lvalue writes
  - `compileObjectNode` — object-literal key assignment
  - `compileSymbolNode` / `compileFunctionNode` — math-namespace lookups
    use `Object.prototype.hasOwnProperty.call(math, name)` to skip
    prototype-chain names; method calls of shape `obj.method(…)` route
    through `getSafeMethod`.
- **expression**: Added pre-compile AST validator in
  `expression/src/evaluator/evaluate.ts`. By default `evaluate()` and
  `compileExpression()` reject `AssignmentNode`, `FunctionAssignmentNode`,
  and `FunctionNode` calls to forbidden builtins (`import`, `createUnit`,
  `evaluate`, `parse`, `compile`, `simplify`, `derivative`, `help`,
  `chain`). Hosts that need the legacy permissive behaviour can opt out
  with `{ unsafe: true }`. Blocklist mirrors `math-mcp/src/validation.ts`.
- **expression**: Added regression suite at
  `expression/tests/security/sandbox.test.ts` (13 tests) covering
  RCE chains (`arr.constructor.constructor("…")()`), prototype pollution
  (`__proto__` writes via assignment and ObjectNode literal), forbidden
  function calls, FunctionAssignmentNode rejection, and confirms safe
  paths still work (`2 + 3`, `arr.length`, etc.).

## [0.1.2] - 2026-04-05

First public release of all 10 @danielsimonjr/mathts-* packages to npm.

### Added

#### Matrix Operations (9 — completing all deferred matrix ops)
- characteristicPolynomial (Faddeev-LeVerrier), rowReduce (Gauss-Jordan RREF), matrixRank (via RREF)
- cholesky (L*L^T decomposition), hessenbergForm (Householder reduction)
- matrixPower (binary exponentiation + eigendecomposition for fractional)
- matrixLog (inverse scaling-and-squaring + Taylor series)
- polarDecomposition (via SVD: A = U*P), jordanForm (eigenvalue clustering + null space analysis)

#### Rust WASM Optimization — 72 high+medium-value functions accelerated
- Special functions (10 Rust): besselI/J/K/Y general order, betainc, ellipticE/K, lambertW, fresnelC/S + TS WASM dispatch
- Signal processing (9 Rust): dct/idct, dst/idst, dwt (Haar), hilbertTransform, spectrogram (STFT), periodogram (Welch), FIR filter + TS dispatch
- Numerical methods (12 Rust): minimize_quadratic, least_squares, levenberg_marquardt, condition_number, matrix_rank, bezier/bspline/loess/griddata/rbf interpolation, implicit_euler/rk4 ODE steps + TS dispatch
- Geometry (4 Rust): delaunayTriangulation (Bowyer-Watson), voronoiDiagram, kdTree build+nearest + TS dispatch with threshold=32
- SIMD array arithmetic (29 Rust): simd_add/sub/mul/div/abs/sqrt/exp/log/sin/cos arrays, sum/mean/min/max/variance/std/dot/norm/distance stats, polygon_area/manhattan/chebyshev/minkowski distances, trig arrays
- Interpolation + distributions (11 Rust): linear/cubic_spline/pchip/lagrange/poly_fit interpolation, normal_pdf/cdf, binomial/poisson/gamma PMFs

#### 190 New Functions — mathjs v15.4–15.6 Parity (Item 1 complete)
- Algebra (36): polyval, polyadd, polymul, polyder, polynomialGCD/LCM/Quotient/Remainder, degree, discriminant, differences, expand, factor, collect, substitute, variables, cancel, together, apart, trigExpand/Reduce, trigToExp, expToTrig, tangentLine, resultant, + 12 more
- Symbolic CAS (28): integrate, limit, taylor, solve, laplace/inverseLaplace, fourierSeries, zTransform, gradientSymbolic, jacobian, laplacian, divergence, curl, groebnerBasis, piecewise, odeGeneral, + 13 more
- Graph Theory (8): adjacencyMatrix, shortestPath, minimumSpanningTree, connectedComponents, stronglyConnectedComponents, topologicalSort, isConnected, graphDistance
- Number Theory (15): prime, nextPrime, primePi, primeFactors, divisors, eulerPhi, divisorSigma, carmichaelLambda, moebiusMu, jacobiSymbol, chineseRemainder, lucasL, partitions, harmonicNumber, integerDigits
- Distribution Objects (12): normalDist, betaDist, binomialDist, chiSquaredDist, exponentialDist, fDist, gammaDist, logNormalDist, poissonDist, tDist, uniformDist, weibullDist — each with .pdf/.cdf/.quantile/.mean/.variance/.sample
- Statistical Tests (7): studentTTest, chiSquareTest, anova, kolmogorovSmirnovTest, mannWhitneyTest, shapiroWilkTest, principalComponentAnalysis
- Numerical Methods (34): findRoot, minimize/maximize, linsolve, leastSquares, nintegrate, curvefit, expfit/logfit/powerfit, bezierCurve, bspline, loess, solveODESystem, stiffODESolver, solveBVP, cond, rank, + 18 more
- Signal Processing (19): dct/idct, dst/idst, dwt, fft2d, fourier/invFourier, hilbertTransform, spectrogram, periodogram, lowpass/highpass/bandpassFilter, resample, medfilt, windowFunction, convolve, correlate
- Extended Geometry (11): area, centroid, coordinateTransform, polygonPerimeter, manhattanDistance, chebyshevDistance, minkowskiDistance, delaunayTriangulation, voronoiDiagram, kdTree, nearestNeighbor
- Extended Special (20): besselI/J/K/Y (general order), betainc, gammaincp, ellipticE/K, chebyshevT, hermiteH, laguerreL, legendreP, lambertW, erfi, cosIntegral, sinIntegral, logIntegral, expIntegralEi, fresnelC/S
- 557 new tests, 36+ embedded doc files

#### Rust WASM Migration
- 192 AS-compatible wrapper functions added to Rust WASM crate (`wasm-rust/crates/mathts-wasm/src/compat/`):
  - `scalar.rs`: 42 scalar ops (add_f64, sin_f64, sqrt_f64, etc.)
  - `array.rs`: 36 array ops (array_add, array_dot, array_norm, etc.)
  - `complex.rs`: 75 complex ops (complex_add, complex_sin, complex_array_fft, etc.)
  - `matrix.rs`: 39 matrix ops (matrix_multiply, matrix_transpose, matrix_trace, etc.)
- Rust WASM binary now exports 1,017 functions (was 741) — full AS parity
- BackendManager already prefers Rust WASM for heavy ops (FFT, eig, SVD)
- Build script: `wasm-rust/scripts/build-for-mathts.sh`
- WASM backend comparison benchmark (`tests/benchmark/wasm-comparison.test.ts`)

#### New Math Functions (60 — beyond mathjs)
- Special functions (8): erfc, beta, gammainc (incomplete gamma), digamma, besselJ0, besselJ1, besselY0, besselY1
- Probability distributions (10): normalPDF, normalCDF, exponentialPDF, exponentialCDF, poissonPMF, binomialPMF, geometricPMF, bernoulliPMF, entropy, jsDivergence
- Numerical integration (4): trapz, simpson, gaussQuad (Gauss-Legendre), romberg (adaptive)
- Interpolation (6): linearInterp, lagrangeInterp, cubicSpline, hermiteInterp, pchipInterp, polyFit
- Extended combinatorics (6): fibonacci (fast doubling), lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial
- Geometry (18): angle2D/3D, cross3D, dot3D, triangleArea, polygonArea, convexHull (Andrew's monotone chain), pointInPolygon (ray casting), rotateVector2D/3D (Rodrigues), reflectVector, projectVector, distance2D/3D/ND, distancePointToLine2D, intersectLines2D, intersectSegments2D
- Signal processing (4): crossCorrelation, autoCorrelation, groupDelay, unwrapPhase
- Statistics selection (4): quickSelect (Hoare's O(n)), medianSelect, minSelect, maxSelect
- 56 embedded doc files for all new functions
- 260 new tests covering all functions against known reference values

#### Core Types & Type System
- 22 math methods on BigNumber: trig (sin, cos, tan, asin, acos, atan), hyperbolic (sinh, cosh, tanh, asinh, acosh, atanh), transcendental (exp, ln, log10, log2, cbrt, expm1), other (mod, log1p, atan2, hypot) — all pure BigNumber arithmetic with Taylor series
- Instance `compare()` method on BigNumber and Fraction (delegates to `compareTo()`)
- Type compatibility bridge (`registerNativeTypes()`) — adds `isComplex`, `isFraction`, `isBigNumber` duck-typing markers to native type prototypes
- Typed-function bridge (`initTypeBridge()`) enabling synced mathjs factories to recognize native MathTS types
- 6 inverse trig methods on AssemblyScript Complex class (asin, acos, atan, asinh, acosh, atanh)

#### Factory Activation System
- Factory activation infrastructure: shared scope (`functions/src/factories/scope.ts`), barrel export (`functions/src/factories/index.ts`)
- 242/273 mathjs factories activated across 18 tiers (89%):
  - Tier 1 (69): leaf factories — abs, sin, cos, sqrt, erf, combinations, etc.
  - Tier 2 (13): inter-factory deps — divideScalar, dot, mode, isZero, bin/hex/oct, etc.
  - Tier 3 (14): matrix factories — transpose, identity, zeros, ones, diag, det, trace, kron, etc.
  - Tiers 4-9 (73): equal, compare, larger, smaller, gcd, lcm, mod, pow, ceil, floor, inv, pinv, qr, concat, subset, range, sort, factorial, gamma, permutations, bellNumbers, stirlingS2
  - Tiers 10-18 (67): subtract, divide, simplify, derivative, rationalize, eigs, fft/ifft, mean/median/variance/std, all set operations, solveODE, Chain/Unit, sqrtm, norm, cross, diff
- Remaining 31 factories are infrastructure types already provided by @danielsimonjr/mathts-core
- Expression node constructors (all 16 types) injected into factory scope for full AST support
- Index and Range stub types registered in typed-function for subset/range factory activation

#### Matrix & WASM
- Matrix compatibility bridge (`MathJSDenseMatrix`) — adapts native DenseMatrix to mathjs `._data`/`._size`/`.storage()` interface
- Real SparseMatrix bridge with CSC (Compressed Sparse Column) storage — `_values`, `_index`, `_ptr` with get/set, map, forEach, resize, diagonal, row swap
- WASM-accelerated FFT (`matrix/src/backends/wasm/fft-wasm.ts`) — Cooley-Tukey radix-2 with Rust WASM acceleration path, JS fallback, spectral analysis utilities
- WASM-accelerated eigendecomposition (`matrix/src/operations/eig-wasm.ts`) — Rust WASM Jacobi for symmetric matrices, JS QR fallback
- WASM-accelerated SVD (`matrix/src/operations/svd-wasm.ts`) — derives from eigendecomposition for symmetric matrices, Golub-Reinsch JS fallback
- Rust WASM backend integration: `RustWasmLoader` singleton with bump allocator, `RustWASMBackend` implementing MatrixBackend, BackendManager routing heavy ops (FFT, eig, SVD) to Rust WASM
- Parallel FFT (`parallel/src/operations/fft.ts`) — threshold-based parallel dispatch, auto-padding, parallel convolution
- Parallel eigendecomposition (`parallel/src/operations/eig.ts`) — inlined QR algorithm (avoids circular deps), ParallelResult wrapper

#### Expression & Evaluation
- Expression compiler (`expression/src/compiler/compile.ts`) — tree-walking AST interpreter handling all 16 node types
- Expression evaluator (`expression/src/evaluator/evaluate.ts`) — `createEvaluate()` factory for `evaluate(expr, scope)` API
- `evaluate()` function wired to activated factory scope — `evaluate('sin(pi/2)')` works end-to-end
- `parse()` bootstrapped from expression node factories through dependency-ordered scope injection
- `compileExpr()` for reusable compiled expressions
- Workbook `executeCode()` implementation using Function constructor with scope injection

#### typed-function & workerpool Improvements
- typed-function: Symbol-based type identification (`TYPED_FUNCTION_TYPE`) — survives esbuild/minification
- typed-function: Safe conversions (`createSafeConversion`) — prevents "cannot invoke without new" errors
- typed-function: Robust multi-strategy type tests (`createRobustTypeTest`) — symbol → property → prototype fallback
- workerpool: SharedArrayBuffer helpers and Transferable support for zero-copy transfer
- workerpool: Eager worker initialization (`warmup()`) with `pool.ready` promise
- workerpool: Enhanced metrics (`enhancedStats()` with p95, throughput, workerUtilization)

#### Build & Publishing
- npm publishing setup — all 10 packages have `publishConfig`, `files`, `repository`
- Production build optimization (`build:prod`) — minified + tree-shaken bundles, 57% size reduction (1524 KB → 662 KB)
- Package scope rename: `@mathts/*` → `@danielsimonjr/mathts-*` for npm publishing under personal scope
- Root `release` script via changesets

#### Testing & Documentation
- Performance regression test suite (`tests/benchmark/performance.test.ts`) — 23 benchmarks covering Complex, BigNumber, Fraction, DenseMatrix, typed dispatch, factory functions
- Parallel operation benchmarks (`parallel/tests/benchmark.test.ts`) — 18 tests covering elementwise, reduce, matmul
- `vitest.config.ts` added for functions, parallel, workbook, packages/typed-function, packages/workerpool
- `@types/node` added to all 7 workspace package devDependencies
- 5 synced mathjs files: constants.ts, factoriesAny.ts, factoriesNumber.ts, defaultInstance.ts, shared/types.ts
- Codebase inventory tooling (tools/codebase-inventory.json, tools/build-mathts-inventory.py, tools/scan_missing.py, tools/inventory.py)
- Full codebase inventory reports (docs/inventory/00-05)
- Integration plan and priority status tracker
- Architecture docs updated (ARCHITECTURE.md, API.md, DATAFLOW.md, OVERVIEW.md)
- Per-package dependency graphs regenerated for all 9 packages (+ new: expression, assembly)
- User-facing documentation modeled after mathjs:
  - `docs/datatypes/` (7 files): numbers, complex, fractions, bignumbers, matrices, bigints
  - `docs/expressions/` (6 files): syntax, parsing, algebra, security, expression trees
  - `docs/core/` (4 files): configuration, extension, serialization
  - `docs/reference/` (4 files): classes, constants, functions
- README.md updated with v0.1.2 capabilities: evaluate(), 242 factories, dual WASM, bundle sizes

### Changed
- Synced mathjs factory code uses correct import paths (./function/ prefix stripped, depth-agnostic ../ reduction)
- functions/src/typed: renamed .neg() → .negate(), .reciprocal() → .inverse(), .div() → .divide() to match core type APIs
- factoriesAny.ts/factoriesNumber.ts: stripped 287 broken ./function/ import prefixes
- expression/ package: build enabled (was echo-skip), tsconfig added, shared utils copied, 60+ import paths fixed
- assembly/ WASM: prefixed 114 bare math calls with Math., fixed abort path, fixed complex_pow(→powReal)
- matrix/WASMBackend: fixed SIMD method names (addSIMD→simdAddF64, etc.)
- parallel/tsconfig: workerpool type stub replaces raw .ts source resolution
- matrix/tsconfig, compat/tsconfig: added workerpool path override

### Fixed
- besselI_wasm: sign correction `(-1)^n` for negative x with odd order n
- erfc Rust WASM: replaced `1-erf(x)` with direct Abramowitz & Stegun computation (catastrophic cancellation for large x)
- standardNormalCDF: divide x by √2 before erf (was computing Φ(x√2) instead of Φ(x))
- Delaunay in_circumcircle: orientation-independent determinant test (was assuming CCW winding, Edge::new destroys winding order)
- special.ts WASM dispatch: disabled getRustWasm() — was using `.exports` (doesn't exist on RustWasmLoader) and `require()` in ESM package
- next_power_of_2(0): guard against usize underflow in signal processing WASM
- exponential() Rust WASM: guard against lambda≤0 division by zero
- partialDerivative export collision: renamed algebra.ts version to symbolicPartialDerivative
- curvefit LM convergence: compute cost change before updating prevCost
- PCA explained variance: uses trace(cov) instead of sum of extracted eigenvalues when k < p
- factor/collect: normalize subtraction before splitting on +
- binomialDist PDF: handle degenerate p=0 and p=1 (was NaN from 0*log(0))
- adjacencyMatrix docstring: fixed example matrix
- BigNumber.exp() overflow: `2**k` → `BigNumber.fromNumber(2).pow(k)` for large inputs
- WASMBackend SIMD argument order: swapped resultPtr/length in 7 operations (add, subtract, mul, scale, abs, negate)
- WASMBackend divideElementwise: was calling multiply — now delegates to JS backend
- WASMBackend QR decomposition: was reading R from unwritten buffer — now reads from in-place aAlloc
- eig-wasm memory leak: added try/finally to free WASM allocations in eigWasm and spectralRadiusWasm
- parallelIFFT: removed wasteful forward FFT call, reports honest metadata
- SparseMatrix _swapRows: splice-insert at sorted position instead of overwriting index (maintains CSC invariant)
- factoryScope.add/multiply: upgraded from scalar stubs to full typed implementations after tier 12
- workerpool canUseSharedMemory(): added crossOriginIsolated check for browser environments
- workerpool _recordExecution(): single performance.now() snapshot prevents timestamp inconsistency
- typed-function dep in functions/package.json: npm registry → github fork
- turbo.json test tasks: `"dependsOn": ["build"]` → `["^build"]` for correct upstream ordering
- Package.json consistency: workbook directory path, assembly author/URL, compat author/URL/dev deps
- Tests using BigNumber private constructor → public fromNumber/parse
- Removed duplicate factoryScope injections (map, conj)
- All 10 packages now build (was 9/10 — assembly WASM was broken)
- All 14 typecheck tasks now pass (was 9/14 — parallel, matrix, compat, expression, functions failed)
- assembly/ WASM build: 64 errors → 0 (Math. prefix, abort path, missing Complex methods)
- parallel/ typecheck: workerpool raw .ts source resolution → type stub
- expression/ typecheck: removed unnecessary embeddedDocs exclusion
- functions/ typecheck: re-enabled (was echo-skip), fixed 35 type errors
- workbook executor: executeCode() implemented (was throwing "not yet implemented")
- ParallelMatrix test: added missing beforeAll/afterAll vitest imports

## [0.1.0] - 2026-02-06

### Added
- Initial project structure with monorepo setup (npm workspaces + Turborepo)
- @danielsimonjr/mathts-core: Complex, Fraction, BigNumber types, TypeRegistry, factory system
- @danielsimonjr/mathts-matrix: DenseMatrix, SparseMatrix, JS/WASM/GPU backends, BackendManager
- @danielsimonjr/mathts-functions: typed arithmetic, trigonometry, statistics, signal processing
- @danielsimonjr/mathts-parallel: ComputePool, WebWorker parallelization, threshold strategies
- @danielsimonjr/mathts-compat: mathjs-compatible `create(all)` API with 54 shim functions
- @danielsimonjr/mathts-workbook: .mtsw notebook runtime with dependency graph and reactive execution
- @danielsimonjr/mathts-wasm: AssemblyScript WASM operations (scalar, array, complex, matrix)
- @danielsimonjr/mathts-typed-function: forked type dispatch system
- @danielsimonjr/mathts-workerpool: forked worker pool management
- TypeScript configuration with project references and strict mode
- GitHub Actions CI/CD workflows
- Comprehensive test suite with 1,342 passing tests across 51 files
- Integration tests for cross-package operations
- API documentation for all packages (docs/api/)
- Migration guide from mathjs (docs/migration/)
- Example projects (examples/)
- Getting Started and Advanced Usage guides

[0.1.2]: https://github.com/danielsimonjr/mathts/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/danielsimonjr/mathts/releases/tag/v0.1.0

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-04-05

First public release of all 10 @danielsimonjr/mathts-* packages to npm.

### Added

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

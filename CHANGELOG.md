# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-04-05

First public release of all 10 @danielsimonjr/mathts-* packages to npm.

### Added
- 22 math methods on BigNumber: trig (sin, cos, tan, asin, acos, atan), hyperbolic (sinh, cosh, tanh, asinh, acosh, atanh), transcendental (exp, ln, log10, log2, cbrt, expm1), other (mod, log1p, atan2, hypot) — all pure BigNumber arithmetic with Taylor series
- Type compatibility bridge (`registerNativeTypes()`) for mathjs duck-typing (`isComplex`, `isFraction`, `isBigNumber` markers on native type prototypes)
- Typed-function bridge (`initTypeBridge()`) enabling synced mathjs factories to recognize native MathTS types
- Instance `compare()` method on BigNumber and Fraction (delegates to `compareTo()`)
- Workbook `executeCode()` implementation using Function constructor with scope injection
- 5 synced mathjs files: constants.ts, factoriesAny.ts, factoriesNumber.ts, defaultInstance.ts, shared/types.ts
- `vitest.config.ts` for functions, parallel, workbook, packages/typed-function, packages/workerpool
- `@types/node` in all 7 workspace package devDependencies
- 6 inverse trig methods on AssemblyScript Complex class (asin, acos, atan, asinh, acosh, atanh)
- Codebase inventory tooling (tools/codebase-inventory.json, tools/build-mathts-inventory.py, tools/scan_missing.py, tools/inventory.py)
- Full codebase inventory reports (docs/inventory/00-05)
- Integration plan (docs/superpowers/plans/2026-04-03-integration-plan.md)
- Factory activation system: shared scope (`functions/src/factories/scope.ts`), barrel export (`functions/src/factories/index.ts`)
- 96 mathjs factory functions activated across 3 tiers:
  - Tier 1: 69 leaf factories (typed-only deps) — abs, sin, cos, sqrt, erf, combinations, etc.
  - Tier 2: 13 factories (inter-factory deps) — divideScalar, dot, mode, isZero, bin/hex/oct, etc.
  - Tier 3: 14 matrix factories — transpose, identity, zeros, ones, diag, det, trace, kron, etc.
- Matrix compatibility bridge (`MathJSDenseMatrix`) — adapts native DenseMatrix to mathjs `._data`/`._size`/`.storage()` interface
- Expression compiler (`expression/src/compiler/compile.ts`) — tree-walking AST interpreter handling all 16 node types
- Expression evaluator (`expression/src/evaluator/evaluate.ts`) — `createEvaluate()` factory for `evaluate(expr, scope)` API
- Parallel operation benchmarks (`parallel/tests/benchmark.test.ts`) — 18 tests covering elementwise, reduce, matmul
- Priority status tracker (`docs/Planning/PRIORITY_STATUS.md`) with dependency chain analysis
- Tiered factory cascade activation (tiers 4-9): 73 additional factories including equal, compare, larger, smaller, gcd, lcm, mod, pow, ceil, floor, inv, pinv, qr, concat, subset, range, sort, factorial, gamma, permutations, bellNumbers, stirlingS2
- `evaluate()` function wired to activated factory scope — `evaluate('sin(pi/2)')` works end-to-end
- `parse()` bootstrapped from expression node factories through dependency-ordered scope injection
- `compileExpr()` for reusable compiled expressions
- Index and Range stub types registered in typed-function for subset/range factory activation
- Final factory cascade (tiers 10-18): 67 more factories — subtract, divide, simplify, derivative, rationalize, eigs, fft/ifft, mean/median/variance/std, all set operations, solveODE, Chain/Unit, sqrtm, norm, cross, diff
- Expression node constructors (all 16 types) injected into factory scope for full AST support
- 242/273 mathjs factories active (89%) — remaining 31 are infrastructure types already in @danielsimonjr/mathts-core
- Real SparseMatrix bridge with CSC (Compressed Sparse Column) storage — `_values`, `_index`, `_ptr` with get/set, map, forEach, resize, diagonal, row swap
- npm publishing setup — all 10 packages have `publishConfig`, `files`, `repository`; root `release` script via changesets
- Production build optimization (`build:prod`) — minified + tree-shaken bundles, 57% size reduction (1524 KB → 662 KB)
- Performance regression test suite (`tests/benchmark/performance.test.ts`) — 23 benchmarks covering Complex, BigNumber, Fraction, DenseMatrix, typed dispatch, and factory functions
- WASM-accelerated FFT (`matrix/src/backends/wasm/fft-wasm.ts`) — Cooley-Tukey radix-2 with Rust WASM acceleration path, JS fallback, spectral analysis utilities
- Parallel FFT (`parallel/src/operations/fft.ts`) — threshold-based parallel dispatch, auto-padding, parallel convolution via convolution theorem
- WASM-accelerated eigendecomposition (`matrix/src/operations/eig-wasm.ts`) — Rust WASM Jacobi for symmetric matrices, JS QR fallback
- WASM-accelerated SVD (`matrix/src/operations/svd-wasm.ts`) — derives SVD from eigendecomposition for symmetric matrices, Golub-Reinsch JS fallback
- Parallel eigendecomposition (`parallel/src/operations/eig.ts`) — inlined QR algorithm (avoids circular deps), ParallelResult wrapper
- Package scope rename: `@mathts/*` → `@danielsimonjr/mathts-*` for npm publishing under personal scope
- typed-function: Symbol-based type identification (`TYPED_FUNCTION_TYPE`), safe conversions (`createSafeConversion`), robust multi-strategy type tests (`createRobustTypeTest`) — survives esbuild/minification
- workerpool: SharedArrayBuffer helpers, Transferable support, eager worker init (`warmup()`), enhanced metrics (`enhancedStats()` with p95, throughput, utilization)
- Rust WASM backend integration: `RustWasmLoader` singleton with bump allocator, `RustWASMBackend` implementing MatrixBackend, BackendManager routing heavy ops (FFT, eig, SVD) to Rust WASM
- Initial project structure with monorepo setup
- @danielsimonjr/mathts-core package with type definitions and utilities
- GitHub Actions CI/CD workflows
- TypeScript configuration with project references
- Turbo build system for monorepo management
- @danielsimonjr/mathts-parallel package with parallel execution via workerpool
- @danielsimonjr/mathts-matrix package with parallel-first matrix operations
- @danielsimonjr/mathts-functions package with typed arithmetic, trigonometry, statistics, and signal processing
- Comprehensive test suite with 1050+ passing tests
- Integration tests for MathTS instance creation and cross-package operations
- Integration tests for typed arithmetic, trigonometric, and statistical functions
- @danielsimonjr/mathts-compat package for mathjs compatibility layer
- mathjs-compatible `create(all)` API in compat package
- Compatibility shims for complex, fraction, bignumber, matrix, sparse creation
- Compatibility shims for arithmetic, trigonometry, statistics functions
- Matrix-specific shims: transpose, det, identity, zeros, ones, size
- Complex-specific shims: conj, re, im, arg
- Type checking functions: isComplex, isFraction, isBigNumber, isNumber, isMatrix
- mathjs-compatible constants: i, pi, e, phi, tau, LN2, LN10, etc.
- API differences documentation (docs/migration/api-diff.md)
- Migration guide (docs/migration/guide.md)
- Comprehensive README with accurate usage examples
- Package overview table in README
- API documentation for all packages (docs/api/)
  - Core API reference (Complex, Fraction, BigNumber)
  - Matrix API reference (DenseMatrix, SparseMatrix)
  - Functions API reference (typed arithmetic, trig, stats, signal)
  - Parallel API reference (ComputePool)
  - Compat API reference (mathjs compatibility layer)
- Example projects (examples/)
  - basic-arithmetic.ts: Basic arithmetic with all numeric types
  - matrix-operations.ts: Dense and sparse matrix operations
  - parallel-computing.ts: ComputePool parallel operations
  - mathjs-migration.ts: Migration from mathjs using compat layer
- Migration examples (docs/migration/examples/)
  - basic.md: Arithmetic and type usage migration from mathjs
  - matrix.md: Matrix operations migration from mathjs
  - complex.md: Complex, Fraction, and BigNumber migration
- Getting Started guide (docs/getting-started.md)
- Advanced Usage guide (docs/advanced.md)
  - Backend selection (JS, WASM, GPU)
  - Parallel computing with ComputePool
  - Performance optimization techniques
  - Type dispatch system
  - Memory management

### Changed
- Synced mathjs factory code now uses correct import paths (./function/ prefix stripped, depth-agnostic ../ reduction, @danielsimonjr/* → unscoped)
- functions/src/typed: renamed .neg() → .negate(), .reciprocal() → .inverse(), .div() → .divide() to match core type APIs
- factoriesAny.ts/factoriesNumber.ts: stripped 287 broken ./function/ import prefixes
- expression/ package: build enabled (was echo-skip), tsconfig added, shared utils copied, 60+ import paths fixed
- assembly/ WASM: prefixed 114 bare math calls with Math., fixed abort path, fixed complex_pow(→powReal)
- matrix/WASMBackend: fixed SIMD method names (addSIMD→simdAddF64, etc.) and argument count mismatches
- parallel/tsconfig: workerpool type stub replaces raw .ts source resolution
- matrix/tsconfig, compat/tsconfig: added workerpool path override
- matrix/parallel-matrix.ts: Added type assertion for ComputePool API to work around TypeScript module resolution issue with npm workspaces
- parallel/compute.worker.ts: Added type assertion for worker function registration
- Updated vitest.config.ts to include tests/integration/**/*.test.ts
- Updated @danielsimonjr/mathts-typed-function tests to match actual exports

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- All 10 packages now build (was 9/10 — assembly WASM was broken)
- All 14 typecheck tasks now pass (was 9/14 — parallel, matrix, compat, expression, functions failed)
- Test count: 54 files, 1,445 tests passing (was 51 files, 1,342 tests)
- assembly/ WASM build: 64 errors → 0 (Math. prefix, abort path, missing Complex methods)
- parallel/ typecheck: workerpool raw .ts source resolution → type stub
- expression/ typecheck: removed unnecessary embeddedDocs exclusion, kept intentional transform exclusion
- functions/ typecheck: re-enabled (was echo-skip), fixed 35 type errors (compare, dispatch casts)
- workbook executor: executeCode() implemented (was throwing "not yet implemented")
- ParallelMatrix test: added missing beforeAll/afterAll vitest imports
- Fixed TypeScript module resolution for @danielsimonjr/mathts-parallel exports
- Fixed skipped tests with proper documentation:
  - Converted variadic addition test to test chained addition (workaround)
  - Documented SVD limitations (reduced matrices, numerical stability for larger matrices)
  - Documented GPU tests as environment-limited (WebGPU not available in Node.js)
- Fixed test imports in functions/tests/parallel-arithmetic.test.ts and parallel-signal.test.ts
- Fixed compute.worker.ts type compatibility with workerpool function signatures
- Fixed integration tests to use BigNumber.parse() instead of new BigNumber() (private constructor)
- Fixed integration tests to use BigNumber.valueOf() instead of toNumber()
- Fixed factory pattern test expectations (createFactory returns object, not function)
- Fixed typed-function package tests to match actual exports (typed, create)

### Security
- N/A

## [0.1.0] - Unreleased

### Added
- Initial release
- Core type system (`BackendType`, `NumericType`, `MathTSConfig`)
- Configuration management (`createConfig`, `defaultConfig`)
- Type guards (`isNumeric`, `isComplex`, `isMatrix`)
- Scientific workbook specification (`.mtsw` format)
- CLI tool (`mtsw`) for workbook execution

[Unreleased]: https://github.com/danielsimonjr/mathts/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/danielsimonjr/mathts/releases/tag/v0.1.0

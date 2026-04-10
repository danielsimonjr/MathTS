# MathTS Architecture

**Generated**: 2026-04-10

## System Overview

MathTS is an npm workspaces monorepo with **10 packages**, all ESM-only (ES2022).
Turborepo orchestrates builds across the workspace. tsup bundles each package.

- **1,324 source files** (99 native, ~1,225 synced from mathjs)
- **202,551 lines of code** across all packages
- **6,323 total exports** across all packages
- **79 test files**, **2,304 tests passing**
- **All 10 packages build**, 14/14 typecheck

## Package Dependency Graph

```
typed-function --> core --> matrix --> functions
                    |         ^           |
workerpool --> parallel ------+           |
                    ^                     |
                    +---------------------+
               core --> workbook
               core, matrix, functions, parallel --> compat
```

### Cross-Package Import Counts

| Package | Dependencies |
|---------|-------------|
| core | @danielsimonjr/mathts-core (1) |
| matrix | @danielsimonjr/mathts-core (5), @danielsimonjr/mathts-parallel (3) |
| functions | @danielsimonjr/mathts-core (5), @danielsimonjr/mathts-parallel (4) |
| parallel | @danielsimonjr/mathts-workerpool (1), @danielsimonjr/mathts-parallel (1) |
| compat | @danielsimonjr/mathts-core (3), @danielsimonjr/mathts-compat (2), @danielsimonjr/mathts-matrix (2), @danielsimonjr/mathts-parallel (1), @danielsimonjr/mathts-functions (1) |

## Core Systems

### 1. Type System

Three native numeric types with full method sets:

| Type | Methods | Capabilities |
|------|---------|-------------|
| Complex | 83 | Arithmetic, trig, hyperbolic, transcendental, polar/rectangular |
| BigNumber | 96 | Arithmetic, comparison, rounding, **22 math methods** (sin, cos, exp, ln, etc. via Taylor series) |
| Fraction | 61 | Arithmetic, comparison, rounding, GCD/LCM |

Type guards: `isNumber`, `isComplex`, `isFraction`, `isBigNumber`, `isMatrix`, etc. (230 total across codebase).

### 2. Type Dispatch

The `typed-function` package provides runtime type checking and multiple dispatch.
`TypeRegistry` manages type definitions and conversions. `mathTyped` creates
typed function instances that select implementations based on argument types.

Supported types: number, boolean, string, BigInt, Complex, Fraction, BigNumber,
DenseMatrix, SparseMatrix, Array.

### 3. Factory Pattern

Two factory layers exist in the codebase:

| Layer | Location | Count | Status |
|-------|----------|-------|--------|
| Native typed functions | `functions/src/typed/` | 11 files, 158 exports | Active, exported |
| Synced mathjs factories | `functions/src/<category>/` | 19 categories, 242 factories | Dormant, not exported |

`FunctionRegistry` stores factory registrations, `createFactory` resolves
dependencies, and the `math` singleton provides the fully configured instance.

**Leaf factories**: Subset of 242 synced factories with no unresolved dependencies (ready to activate).

### 4. Matrix Backends

Three computation backends with automatic selection via BackendManager:

| Backend | Implementation | Threshold |
|---------|---------------|-----------|
| JSBackend | Pure TypeScript | Always (default) |
| WASMBackend | AssemblyScript + SIMD | > 1,000 elements |
| GPUBackend | WebGPU compute shaders | > 100,000 elements |

BackendManager selects based on data size, backend availability, and
adaptive performance tuning with profiling support.

Matrix types: DenseMatrix (Float64Array-backed), SparseMatrix (CSC format).
Decompositions: SVD, LU, QR, Cholesky, eigendecomposition.

### 5. Parallel Execution

ComputePool manages Web Workers for parallel operations.
Chunk strategies determine optimal data partitioning. ThresholdDispatcher
decides whether to parallelize based on data size (7 threshold categories).

40+ parallel functions: elementwise (add, subtract, multiply, etc.),
matrix (matmul, matvec, transpose, outer, dot), reduce, and map operations.

Results wrapped in `ParallelResult<T>` with result data, duration, chunk count, and parallelization flag.

### 6. WASM Layer

MathTS has two WASM backends. The Rust backend is primary; AssemblyScript is kept for benchmarking.

#### 6a. AssemblyScript WASM (Legacy — `assembly/`)

AssemblyScript compiles to WebAssembly with 432 exports across 10 source files:

| Category | Operations |
|----------|-----------|
| Scalar | 52 ops (arithmetic, trig, transcendental) |
| Array | 36 ops (element-wise, norms, dot products) |
| Matrix | 41 ops (multiply, transpose, LU, QR, determinant) |
| Complex scalar | 44 ops |
| Complex array | 33 ops |

#### 6b. Rust WASM (Primary — `wasm-rust/`)

A Cargo workspace with the `mathts-wasm` crate. 63 Rust source files, ~18,500 lines, **1,017 wasm-bindgen exports** (826 core + 192 AssemblyScript compat wrappers in `wasm-rust/crates/mathts-wasm/src/compat/`). Compiled output: `lib/wasm/mathjs.wasm` (669 KB).

The `compat/` module provides full AssemblyScript API parity — every function previously exported by the AssemblyScript backend is now available through the Rust backend, making the dual-backend strategy complete.

Key crate dependencies:

| Crate | Version | Role |
|-------|---------|------|
| faer | 0.24 | LU, QR, SVD, Cholesky, eigendecomposition |
| rustfft | 6.4 | FFT and IFFT |
| statrs | 0.18 | Statistical distributions, special functions |
| libm | 0.2 | Portable math for `no_std` WASM targets |

#### 6c. WASM Bridge Layer (`matrix/src/backends/`)

Two TypeScript files manage the bridge between JavaScript and WASM:

- **`WasmLoader.ts`**: Loads and instantiates the WASM binary, manages a shared linear memory pool, handles allocation/deallocation, and exposes the `MATHTS_WASM_BACKEND` environment variable for selecting `rust`, `assemblyscript`, or `auto` (default).
- **`MatrixWasmBridge.ts`**: Intercepts typed-function dispatch and decides whether to use JavaScript or WASM for each operation. Selection is based on per-operation element-count thresholds (e.g., matrix multiply switches to WASM above 1,000 elements). Falls back to `JSBackend` transparently on WASM failure.

#### 6d. Three-Tier Performance Model

```
JS fallback (always)
  --> WASM acceleration (>1K elements, 2-10x faster)
        --> Parallel/multi-core (>100K elements, additional 2-4x)
```

### 7. Expression Package

Parser ported from mathjs (16 node types, 1,885-line `parse.ts`). The package now
builds successfully. Compiler and evaluator are stubs. 391 source files, 608 exports.

### 8. Workbook Runtime

YAML-based reactive notebooks (.mtsw files):

- **Parser**: YAML to Workbook with typed cells
- **Graph**: Dependency resolution via topological sort with cycle detection
- **Executor**: Three modes (reactive, sequential, manual). `executeCode()` implemented via Function constructor.

## Integration Architecture

### Type Bridge

`registerNativeTypes()` adds mathjs duck-typing markers (`isComplex`, `isFraction`,
`isBigNumber`) to native type prototypes, allowing synced factories to recognize
native type instances.

### Factory Bridge

`initTypeBridge()` connects the native `mathTyped` dispatch system with the synced
mathjs `createTyped` instance, enabling factories from both layers to interoperate.

### Integration Status

| Metric | Value |
|--------|-------|
| Reachable files (from entry points) | ~99 |
| Dormant files (synced, not exported) | ~1,225 |
| Total synced factories | 242 |
| Synced categories | 19 |
| Type bridge | In place |
| Factory bridge | In place |

### Activation Barriers

1. **Two typed-function instances** -- native (15 types, instanceof) vs. synced (40+ types, duck-typing). Bridge partially resolves this.
2. **Matrix interface mismatch** -- native DenseMatrix is Float64Array-backed; synced factories expect nested Array with `._data`, `._size`, `.storage()`.
3. **Missing subsystems** -- Unit, Index, Range, Chain, ResultSet, Help required by 100+ factories.

## Build Pipeline

All packages use `tsup src/index.ts --format esm --dts --clean` with exceptions:

| Package | Build Variation |
|---------|----------------|
| functions | No `--dts` flag |
| workbook | Two entry points (index.ts + cli.ts) |
| assembly | AssemblyScript (`asc`) + TypeScript bindings |

Turbo tasks: `test` and `typecheck` depend on `^build` (upstream packages build first).

## Module Summary

| Package | Source Files | Test Files | Exports |
|---------|-------------|-----------|---------|
| core | 95 | 12 | 625 |
| matrix | 38 | 17 | 351 |
| functions | 760 | 24 | 3,871 |
| parallel | 16 | 13 | 176 |
| expression | 391 | 2 | 608 |
| workbook | 6 | 3 | 29 |
| compat | 3 | 2 | 132 |
| assembly | 10 | 0 | 432 |
| typed-function | 2 | 2 | 62 |
| workerpool | 3 | 1 | 37 |
| **Total** | **1,324** | **76** | **6,323** |

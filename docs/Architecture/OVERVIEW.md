# MathTS Project Overview

**Generated**: 2026-04-03

## What is MathTS?

MathTS is a ground-up TypeScript rewrite of [math.js](https://mathjs.org),
designed for modern JavaScript runtimes with native support for WebAssembly
(WASM), WebGPU compute shaders, and Web Workers for parallel computation.
It maintains API compatibility with math.js through a dedicated compatibility layer.

## Design Goals

- **Type Safety**: Full TypeScript with strict mode, leveraging the type system for correctness
- **Performance**: Automatic backend selection (JS/WASM/GPU) based on data size
- **Compatibility**: Drop-in replacement for math.js via `@danielsimonjr/mathts-compat`
- **Modularity**: Tree-shakeable ESM packages -- use only what you need
- **Parallelism**: First-class Web Worker support for large-scale computation

## Key Metrics

| Metric | Value |
|--------|-------|
| Total Source Files | 1,247 |
| Lines of Code | 193,073 |
| Total Exports | 5,399 |
| Reachable Exports | 1,562 |
| Classes | 53 |
| Interfaces | 345 |
| Functions | 2,047 |
| Type Guards | 230 |
| Constants | 1,781 |
| Test Files | 54 |
| Total Tests | 1,445 |

## Packages

| Package | Description | Source Files | Tests | Exports |
|---------|-------------|-------------|-------|---------|
| `@danielsimonjr/mathts-typed-function` | Type dispatch system (forked) | 2 | 1 | 53 |
| `@danielsimonjr/mathts-workerpool` | Worker pool management (forked) | 3 | 1 | 29 |
| `@danielsimonjr/mathts-core` | Types, typed-function, factory | 95 | 12 | 625 |
| `@danielsimonjr/mathts-matrix` | DenseMatrix, SparseMatrix, backends | 33 | 14 | 305 |
| `@danielsimonjr/mathts-functions` | Math functions via typed dispatch | 750 | 9 | 3,564 |
| `@danielsimonjr/mathts-parallel` | ComputePool, WebWorker operations | 14 | 10 | 162 |
| `@danielsimonjr/mathts-expression` | Parser/evaluator (stubs for compiler) | 331 | 0 | 528 |
| `@danielsimonjr/mathts-workbook` | .mtsw notebook runtime + CLI | 6 | 3 | 29 |
| `@danielsimonjr/mathts-compat` | mathjs compatibility shim | 3 | 2 | 132 |
| `assembly` | WASM source (AssemblyScript) | 10 | 0 | 432 |

## Two-Layer Code Architecture

### Active Layer (native MathTS)

~99 files in `core/`, `matrix/`, `functions/src/typed/`, `parallel/`, `workbook/`, `compat/`.
These are exported, tested, and built. Includes:

- **3 numeric types**: Complex (83 methods), Fraction (61 methods), BigNumber (96 methods including 22 math functions)
- **96 typed function exports**: arithmetic (48), trigonometry (20), statistics (19), signal (8), bridge (1)
- **Matrix system**: DenseMatrix + SparseMatrix with JS/WASM/GPU backends
- **Parallel**: ComputePool with 40+ parallel operations
- **WASM**: 432 exports (scalar, array, matrix, complex operations)

### Dormant Layer (synced from mathjs)

~1,173 files synced from the mathjs fork. 19 categories, 231 factory-pattern functions.
Not exported from package entry points. Support files in `functions/src/{utils,core,plain,type,expression,error,wasm}/`.

## Computation Backends

MathTS has three computation backends selected automatically based on operation size and availability:

| Backend | Source | Status | Description |
|---------|--------|--------|-------------|
| JavaScript | `matrix/src/backends/JSBackend.ts` | Always available | Pure TypeScript fallback |
| AssemblyScript WASM | `assembly/` | Legacy (benchmarking) | 432 exports, SIMD-optimized |
| Rust WASM | `wasm-rust/` | **Primary** | 63 source files, 826 exports, 669 KB binary |

The Rust WASM backend is a Cargo workspace rooted at `wasm-rust/` with the `mathts-wasm` crate. It uses:
- **faer** — high-performance linear algebra (LU, QR, SVD, eigendecomposition)
- **rustfft** — FFT and inverse FFT
- **statrs** — statistical distributions and special functions
- **libm** — portable math (sin, cos, exp, log, etc.) for `no_std` WASM targets

`matrix/src/backends/MatrixWasmBridge.ts` handles automatic JS-vs-WASM selection based on per-operation size thresholds. `matrix/src/backends/WasmLoader.ts` loads the WASM binary, manages a memory pool, and selects the active backend via the `MATHTS_WASM_BACKEND` environment variable.

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (strict, ES2022) |
| Modules | ESM-only |
| Build | tsup + Turborepo |
| Test | Vitest |
| WASM (primary) | Rust + wasm-bindgen (`wasm-rust/`) |
| WASM (legacy) | AssemblyScript (`assembly/`) |
| GPU | WebGPU compute shaders |
| Parallelism | Web Workers (worker_threads) |
| Notebooks | YAML-based .mtsw format |

## Quick Start

```typescript
// Direct imports (tree-shakeable)
import { add, multiply } from "@danielsimonjr/mathts-functions";
import { DenseMatrix } from "@danielsimonjr/mathts-matrix";
import { Complex, Fraction, BigNumber } from "@danielsimonjr/mathts-core";

// mathjs-compatible API
import { create, all } from "@danielsimonjr/mathts-compat";
const math = create(all);
math.add(1, 2);
```

## Current Status

| Package | Status | Notes |
|---------|--------|-------|
| Core | Stable | Types with full method sets, factory, typed dispatch |
| Matrix | Stable | Dense/Sparse with JS backend; WASM/GPU backends available |
| Functions | Active | 96 typed exports across arithmetic, trig, statistics, signal |
| Parallel | Active | ComputePool, 40+ operations, 7 threshold categories |
| Workbook | Active | YAML parsing, dep graphs, executor via Function constructor |
| Expression | Builds | Parser ported (16 node types), compiler/evaluator are stubs |
| Compat | Active | 54 shims wired to real implementations, 87 test cases |
| Assembly | Legacy | 432 WASM exports, kept for benchmarking against Rust backend |
| Rust WASM | Active | 826 exports, 669 KB binary, primary WASM backend |

## Integration Progress

### Bridges in Place

- **Type bridge** (`registerNativeTypes()`): Adds mathjs duck-typing markers to native Complex/Fraction/BigNumber, enabling synced factory recognition
- **Factory bridge** (`initTypeBridge()`): Connects native `mathTyped` dispatch with synced `createTyped` instance

### Activation Readiness

| Metric | Value |
|--------|-------|
| Leaf factories (no unresolved deps) | 81 |
| Total synced factories | 231 |
| Synced categories | 19 |
| Dormant files | ~1,158 |
| Reachable files | ~89 |

### Remaining Barriers

- **Matrix interface mismatch**: Native DenseMatrix (Float64Array) vs. synced expectations (nested Array with `._data`)
- **Missing subsystems**: Unit, Index, Range, Chain, ResultSet, Help (needed by 100+ factories)
- **Two dispatch instances**: Native mathTyped (15 types) vs. synced createTyped (40+ types), partially bridged

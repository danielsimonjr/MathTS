# MathTS Project Overview

**Generated**: 2026-02-06

## What is MathTS?

MathTS is a ground-up TypeScript rewrite of [math.js](https://mathjs.org),
designed for modern JavaScript runtimes with native support for WebAssembly
(WASM), WebGPU compute shaders, and Web Workers for parallel computation.
It maintains API compatibility with math.js through a dedicated compatibility layer.

## Design Goals

- **Type Safety**: Full TypeScript with strict mode, leveraging the type system for correctness
- **Performance**: Automatic backend selection (JS/WASM/GPU) based on data size
- **Compatibility**: Drop-in replacement for math.js via `@danielsimonjr/mathts-compat`
- **Modularity**: Tree-shakeable ESM packages - use only what you need
- **Parallelism**: First-class Web Worker support for large-scale computation

## Key Metrics

| Metric | Value |
|--------|-------|
| Active Source Files | 75 |
| Lines of Code | 27,380 |
| Total Exports | 1,245 |
| Classes | 27 |
| Interfaces | 75 |
| Functions | 366 |
| Type Guards | 21 |
| Constants | 305 |
| Test Files | 51 |
| Total Tests | 1,342 |
| Statement Coverage | 82.14% |

## Packages

| Package | Description | Active Files |
|---------|-------------|-------------|
| `@danielsimonjr/mathts-typed-function` | Type dispatch system (forked) | 1 |
| `@danielsimonjr/mathts-workerpool` | Worker pool management (forked) | 1 |
| `@danielsimonjr/mathts-core` | Types, typed-function integration, factory | 9 |
| `@danielsimonjr/mathts-matrix` | DenseMatrix, SparseMatrix, backends | 26 |
| `@danielsimonjr/mathts-functions` | Math functions via typed dispatch | 6 |
| `@danielsimonjr/mathts-parallel` | ComputePool, WebWorker operations | 10 |
| `@danielsimonjr/mathts-expression` | Parser/evaluator (incomplete) | 8 |
| `@danielsimonjr/mathts-workbook` | .mtsw notebook runtime + CLI | 5 |
| `@danielsimonjr/mathts-compat` | mathjs compatibility shim | 2 |
| `assembly` | WASM source (AssemblyScript) | 7 |

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript (strict, ES2022) |
| Modules | ESM-only |
| Build | tsup + Turborepo |
| Test | Vitest |
| WASM | AssemblyScript |
| GPU | WebGPU compute shaders |
| Parallelism | Web Workers (worker_threads) |
| Notebooks | YAML-based .mtsw format |

## Quick Start

```typescript
// Direct imports (tree-shakeable)
import { add, multiply } from "@danielsimonjr/mathts-functions";
import { DenseMatrix } from "@danielsimonjr/mathts-matrix";
import { Complex, Fraction } from "@danielsimonjr/mathts-core";

// mathjs-compatible API
import { create, all } from "@danielsimonjr/mathts-compat";
const math = create(all);
math.add(1, 2);
```

## Project Status

| Package | Status | Notes |
|---------|--------|-------|
| Core | Stable | Types, factory, typed dispatch |
| Matrix | Stable | Dense/Sparse with JS backend; WASM/GPU experimental |
| Functions | Active | Arithmetic, trig, statistics, signal processing |
| Parallel | Active | ComputePool, elementwise and matrix operations |
| Workbook | Active | YAML parsing, dependency graphs, execution modes |
| Expression | Incomplete | Parser nodes defined, evaluator in progress |
| Compat | Active | mathjs API shim layer |
| Assembly | Broken | AssemblyScript compiler issues |

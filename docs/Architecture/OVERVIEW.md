# MathTS Project Overview

**Generated**: 2026-04-10

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
| Total Source Files | 1,324 |
| Lines of Code | 202,551 |
| Total Exports | 6,323 |
| Test Files | 90 |
| Total Tests | 2,864 |
| Typed Function Exports | 374 (17 modules) |
| Synced Factory Functions | 242 (19 categories) |

## Packages

| Package | Description | Source Files | Tests | Exports |
|---------|-------------|-------------|-------|---------|
| `@danielsimonjr/mathts-typed-function` | Type dispatch system (forked) | 2 | 2 | 62 |
| `@danielsimonjr/mathts-workerpool` | Worker pool management (forked) | 3 | 1 | 37 |
| `@danielsimonjr/mathts-core` | Types, typed-function, factory | 95 | 12 | 625 |
| `@danielsimonjr/mathts-matrix` | DenseMatrix, SparseMatrix, backends | 38 | 17 | 351 |
| `@danielsimonjr/mathts-functions` | Math functions via typed dispatch | 760 | 24 | 3,871 |
| `@danielsimonjr/mathts-parallel` | ComputePool, WebWorker operations | 16 | 13 | 176 |
| `@danielsimonjr/mathts-expression` | Parser/evaluator (stubs for compiler) | 391 | 2 | 608 |
| `@danielsimonjr/mathts-workbook` | .mtsw notebook runtime + CLI | 6 | 3 | 29 |
| `@danielsimonjr/mathts-compat` | mathjs compatibility shim | 3 | 2 | 132 |
| `assembly` | WASM source (AssemblyScript) | 10 | 0 | 432 |
| `wasm-rust` | Rust WASM (primary backend) | 63 | — | 1,017 |

## Two-Layer Code Architecture

### Active Layer (native MathTS)

~99 files in `core/`, `matrix/`, `functions/src/typed/`, `parallel/`, `workbook/`, `compat/`.
These are exported, tested, and built. Includes:

- **3 numeric types**: Complex (83 methods), Fraction (61 methods), BigNumber (96 methods including 22 math functions)
- **374 typed function exports** across 17 modules: arithmetic (54), trigonometry (20), statistics (25), signal (33), special (29), distributions (11), integration (4), interpolation (6), combinatorics (21), geometry (31), algebra (37), cas (30), graph (8), dist-objects (13), hypothesis (14), numeric (37), bridge (1)
- **Matrix system**: DenseMatrix + SparseMatrix with JS/WASM/GPU backends
- **Parallel**: ComputePool with 40+ parallel operations
- **WASM**: 432 AssemblyScript exports (legacy) + **1,017 Rust WASM exports** (primary, full AS parity via compat module)

### Beyond mathjs — ~250 New Functions

The following function categories go beyond the mathjs API surface, available as native typed exports:

| Module | Count | Functions |
|--------|-------|-----------|
| Special | 29 | `erfc`, `beta`, `gammainc`, `digamma`, `besselJ0/1/Y0/Y1`, Legendre, Chebyshev, Laguerre, zeta, etc. |
| Distributions | 11 | `normalPDF/CDF`, `exponentialPDF/CDF`, `poissonPMF`, `binomialPMF`, `geometricPMF`, `bernoulliPMF`, `entropy`, `jsDivergence` |
| Integration | 4 | `trapz`, `simpson`, `gaussQuad`, `romberg` |
| Interpolation | 6 | `linearInterp`, `lagrangeInterp`, `cubicSpline`, `hermiteInterp`, `pchipInterp`, `polyFit` |
| Combinatorics | 21 | `fibonacci`, `lucas`, `doubleFactorial`, `risingFactorial`, `fallingFactorial`, `subfactorial`, `partition`, Stirling/Bell numbers, etc. |
| Geometry | 31 | `angle2D/3D`, `cross3D`, `dot3D`, `triangleArea`, `polygonArea`, `convexHull`, `pointInPolygon`, `rotateVector2D/3D`, Bezier, splines, Voronoi, and more |
| Signal | 33 | `parallelFFT/IFFT`, convolution, correlation, `groupDelay`, `unwrapPhase`, STFT, window functions (+21 new) |
| **Algebra** | **37** | `polyval`, `polyadd`, `polymul`, `polyder`, `polynomialGCD`, `factor`, `expand`, `substitute`, `discriminant`, etc. |
| **CAS** | **30** | `integrate`, `limit`, `partialDerivative`, `jacobian`, `laplacian`, `laplace`, `taylor`, `solve`, `groebnerBasis`, etc. |
| **Graph Theory** | **8** | `adjacencyMatrix`, `shortestPath`, `minimumSpanningTree`, `connectedComponents`, `topologicalSort`, `isConnected`, etc. |
| **Distribution Objects** | **13** | `normalDist`, `betaDist`, `binomialDist`, `gammaDist`, `tDist`, `uniformDist`, `poissonDist`, etc. (objects with pdf/cdf/sample) |
| **Hypothesis Tests** | **14** | `studentTTest`, `chiSquareTest`, `anova`, `kolmogorovSmirnovTest`, `mannWhitneyTest`, `shapiroWilkTest`, `PCA`, etc. |
| **Numerical Methods** | **37** | `findRoot`, `linsolve`, `minimize`, `maximize`, `leastSquares`, `nintegrate`, `bezierCurve`, `rbfInterpolate`, etc. |

### Dormant Layer (synced from mathjs)

~1,225 files synced from the mathjs fork. 19 categories, 242 factory-pattern functions.
Not exported from package entry points. Support files in `functions/src/{utils,core,plain,type,expression,error,wasm}/`.

## Computation Backends

MathTS has three computation backends selected automatically based on operation size and availability:

| Backend | Source | Status | Description |
|---------|--------|--------|-------------|
| JavaScript | `matrix/src/backends/JSBackend.ts` | Always available | Pure TypeScript fallback |
| AssemblyScript WASM | `assembly/` | Legacy (benchmarking) | 432 exports, SIMD-optimized |
| Rust WASM | `wasm-rust/` | **Primary** | 63 source files, **1,017 exports** (826 core + 192 AS compat), 669 KB binary |

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
| Functions | Active | 374 typed exports across 17 modules (arithmetic, trig, stats, signal, special, distributions, integration, interpolation, combinatorics, geometry, algebra, CAS, graph theory, distribution objects, hypothesis tests, numerical methods, bridge) |
| Parallel | Active | ComputePool, 40+ operations, 7 threshold categories |
| Workbook | Active | YAML parsing, dep graphs, executor via Function constructor |
| Expression | Builds | Parser ported (16 node types), compiler/evaluator are stubs |
| Compat | Active | 54 shims wired to real implementations, 87 test cases |
| Assembly | Legacy | 432 WASM exports, kept for benchmarking against Rust backend |
| Rust WASM | **Complete** | **1,017 exports** (826 core + 192 AS compat), 669 KB binary, primary WASM backend with full AS parity |

## Integration Progress

### Bridges in Place

- **Type bridge** (`registerNativeTypes()`): Adds mathjs duck-typing markers to native Complex/Fraction/BigNumber, enabling synced factory recognition
- **Factory bridge** (`initTypeBridge()`): Connects native `mathTyped` dispatch with synced `createTyped` instance

### Activation Readiness

| Metric | Value |
|--------|-------|
| Total synced factories | 242 |
| Synced categories | 19 |
| Dormant files | ~1,225 |
| Reachable files | ~99 |

### Remaining Barriers

- **Matrix interface mismatch**: Native DenseMatrix (Float64Array) vs. synced expectations (nested Array with `._data`)
- **Missing subsystems**: Unit, Index, Range, Chain, ResultSet, Help (needed by 100+ factories)
- **Two dispatch instances**: Native mathTyped (15 types) vs. synced createTyped (40+ types), partially bridged

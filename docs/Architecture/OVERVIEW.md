# MathTS Project Overview

**Generated**: 2026-05-22

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

Metrics below are reachable-file scope (485 active files; 902 dormant synced
files excluded), per the 2026-05-22 dependency-graph report.

| Metric | Value |
|--------|-------|
| Reachable TypeScript Files | 485 (of 1,387 total; 902 dormant) |
| Lines of Code | 125,177 (reachable) |
| Total Exports | 2,850 (704 re-exports) |
| Test Files | 114 (18.6% source-file coverage) |
| Modules | 55 |
| Circular Dependencies | 0 |
| Typed Function Exports | 374+ (20 modules, including GPU) |
| Synced Factory Functions | 242 (19 categories) |

## Packages

The monorepo has **12 npm packages** plus the `wasm-rust` Cargo crate (not an
npm package). File counts are reachable (active) files from the 2026-05-22 report.

| Package | Description | Active Files | Version |
|---------|-------------|-------------|---------|
| `@danielsimonjr/mathts-typed-function` | Type dispatch system (forked) | 1 | 0.1.2 |
| `@danielsimonjr/mathts-workerpool` | Worker pool management (forked) | 2 | 0.1.2 |
| `@danielsimonjr/mathts-core` | Types, typed-function, factory | 10 | 0.1.2 |
| `@danielsimonjr/mathts-matrix` | DenseMatrix, SparseMatrix, backends | 34 | 0.1.2 |
| `@danielsimonjr/mathts-tensor` | Rank-N Float64Array-backed dense Tensor (einsum/contraction) | 2 | 0.1.0 |
| `@danielsimonjr/mathts-autograd` | Forward + reverse-mode automatic differentiation over Tensor | 5 | 0.1.0 |
| `@danielsimonjr/mathts-functions` | Math functions via typed dispatch | 352 | 0.1.3 |
| `@danielsimonjr/mathts-parallel` | ComputePool, WebWorker operations | 10 | 0.1.3 |
| `@danielsimonjr/mathts-expression` | Parser/compiler/evaluator (fully functional) | 45 | 0.2.0 |
| `@danielsimonjr/mathts-workbook` | .mtsw notebook runtime + CLI | 5 | 0.1.2 |
| `@danielsimonjr/mathts-compat` | mathjs compatibility shim | 2 | 0.1.2 |
| `@danielsimonjr/mathts-wasm` (`assembly`) | WASM source (AssemblyScript) | 17 | 0.1.3 |
| `wasm-rust` | Rust WASM (primary backend; Cargo crate) | 63 | — |

## Two-Layer Code Architecture

### Active Layer (native MathTS)

485 reachable files across `core/`, `matrix/`, `tensor/`, `autograd/`, `functions/`, `parallel/`, `expression/`, `workbook/`, `compat/`, and the WASM packages.
These are exported, tested, and built. Includes:

- **3 numeric types**: Complex (83 methods), Fraction (61 methods), BigNumber (96 methods including 22 math functions)
- **374+ typed function exports** across 20 modules: arithmetic (54), trigonometry (20), statistics (25), signal (33), special (29), distributions (11), integration (4), interpolation (6), combinatorics (21), geometry (31), algebra (37), cas (30), graph (8), dist-objects (13), hypothesis (14), numeric (37), bridge (1), gpu (4), matrix-ops, and typed-bridge
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

902 files synced from the mathjs fork. 19 categories, 242 factory-pattern functions.
Not exported from package entry points. Support files in `functions/src/{utils,core,plain,type,expression,error,wasm}/`.

## Computation Backends

MathTS has three computation backends selected automatically based on operation size and availability:

| Backend | Source | Status | Description |
|---------|--------|--------|-------------|
| JavaScript | `matrix/src/backends/JSBackend.ts` | Always available | Pure TypeScript fallback |
| AssemblyScript WASM | `assembly/` | Legacy (benchmarking) | 432 exports, SIMD-optimized |
| Rust WASM | `wasm-rust/` | **Primary** | 63 source files, **1,017 exports** (826 core + 192 AS compat) |

The Rust WASM backend is a Cargo workspace rooted at `wasm-rust/` with the `mathts-wasm` crate. It uses:
- **faer** — high-performance linear algebra (LU, QR, SVD, eigendecomposition)
- **rustfft** — FFT and inverse FFT
- **statrs** — statistical distributions and special functions
- **libm** — portable math (sin, cos, exp, log, etc.) for `no_std` WASM targets

`matrix/src/backends/MatrixWasmBridge.ts` handles automatic JS-vs-WASM selection based on per-operation size thresholds. `matrix/src/backends/WasmLoader.ts` loads the WASM binary (Rust output under `wasm-rust/target/wasm32-unknown-unknown/release/`), manages a memory pool, and selects the active backend via the `MATHTS_WASM_BACKEND` environment variable.

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
| Tensor | Active | Rank-N Float64Array-backed dense Tensor with einsum/contraction |
| Autograd | Active | Forward + reverse-mode automatic differentiation over Tensor |
| Functions | Active | 374+ typed exports across 20 modules (arithmetic, trig, stats, signal, special, distributions, integration, interpolation, combinatorics, geometry, algebra, CAS, graph theory, distribution objects, hypothesis tests, numerical methods, bridge, gpu, matrix-ops, typed-bridge) |
| Parallel | Active | ComputePool, 40+ operations, 7 threshold categories |
| Workbook | Active | YAML parsing, dep graphs, executor; `executeCode()` evaluates cells via `evaluate()` from functions |
| Expression | Active | Parser (16 node types), compiler, and evaluator fully functional; sandbox-hardened (2026-05-01 security release) |
| Compat | Active | 54 shims wired to real implementations, 87 test cases |
| Assembly | Legacy | 432 WASM exports, kept for benchmarking against Rust backend |
| Rust WASM | **Complete** | **1,017 exports** (826 core + 192 AS compat), primary WASM backend with full AS parity |

## Integration Progress

### Bridges in Place

- **Type bridge** (`registerNativeTypes()`): Adds mathjs duck-typing markers to native Complex/Fraction/BigNumber, enabling synced factory recognition
- **Factory bridge** (`initTypeBridge()`): Connects native `mathTyped` dispatch with synced `createTyped` instance

### Activation Readiness

| Metric | Value |
|--------|-------|
| Total synced factories | 242 |
| Synced categories | 19 |
| Dormant files | 902 |
| Reachable files | 485 |

### Remaining Barriers

- **Matrix interface mismatch**: Native DenseMatrix (Float64Array) vs. synced expectations (nested Array with `._data`)
- **Missing subsystems**: Unit, Index, Range, Chain, ResultSet, Help (needed by 100+ factories)
- **Two dispatch instances**: Native mathTyped (15 types) vs. synced createTyped (40+ types), partially bridged

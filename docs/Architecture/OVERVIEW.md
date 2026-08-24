# MathTS Project Overview

**Generated**: 2026-07-01

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

Metrics below cover the **single active code graph** — every file is reachable
from a package `src/index.ts` — per the 2026-07-01 dependency-graph report. The
old dormant synced-from-mathjs mirror (formerly 904 dormant files) was **deleted
2026-06-27**; there is now one graph, 846 files, all reachable (0 unused, 0
dormant). Regenerate with `tools/create-dependency-graph` for current figures.

| Metric                       | Value                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| TypeScript Files             | 846 (0 unused, 0 dormant — single active graph)              |
| Lines of Code                | 158,032                                                      |
| Total Exports                | 4,088 (1,204 re-exports)                                     |
| Modules                      | 70                                                           |
| Circular Dependencies        | 0 runtime (2 type-only)                                      |
| Classes / Interfaces / Funcs | 50 / 358 / 1,461 (135 type guards, 1,417 constants, 0 enums) |
| `functions` Package Exports  | 828 names (686 callable functions; `typed/` = 30 files)      |

## Packages

The monorepo has **22 npm packages**. The 12 primary packages are listed below;
the other 10 are thin re-export leaf packages (`parser`, `ast`, `evaluator`,
`units`, `numbers`, `linalg`, `arithmetic`, `trigonometry`, `statistics`,
`signal`) — see `ARCHITECTURE.md`. AssemblyScript (`assembly/`) is the sole WASM
toolchain. File counts are reachable (active) files from the dependency-graph
report.

| Package                                   | Description                                                  | Active Files | Version |
| ----------------------------------------- | ------------------------------------------------------------ | ------------ | ------- |
| `@danielsimonjr/mathts-typed-function`    | Type dispatch system (forked)                                | 1            | 0.1.2   |
| `@danielsimonjr/mathts-workerpool`        | Worker pool management (forked)                              | 2            | 0.2.0   |
| `@danielsimonjr/mathts-core`              | Types, typed-function, factory                               | 15           | 0.3.1   |
| `@danielsimonjr/mathts-matrix`            | DenseMatrix, SparseMatrix, backends                          | 43           | 0.1.12  |
| `@danielsimonjr/mathts-tensor`            | Rank-N Float64Array-backed dense Tensor (einsum/contraction) | 21           | 0.2.2   |
| `@danielsimonjr/mathts-autograd`          | Forward + reverse-mode automatic differentiation over Tensor | 6            | 0.3.2   |
| `@danielsimonjr/mathts-functions`         | Math functions via typed dispatch                            | 391          | 0.8.0   |
| `@danielsimonjr/mathts-parallel`          | ComputePool, WebWorker operations                            | 11           | 0.3.0   |
| `@danielsimonjr/mathts-expression`        | Parser/compiler/evaluator (fully functional)                 | 302          | 0.4.2   |
| `@danielsimonjr/mathts-workbook`          | .mtsw notebook runtime + CLI                                 | 14           | 0.1.8   |
| `@danielsimonjr/mathts-compat`            | mathjs compatibility shim                                    | 3            | 0.2.5   |
| `@danielsimonjr/mathts-wasm` (`assembly`) | WASM backend (AssemblyScript) — sole WASM toolchain          | 27           | 0.1.5   |

## Single Active Code Graph

MathTS is **one active code graph** — every file is reachable from a package
`src/index.ts` (846 files, 0 unused, 0 dormant). The former synced-from-mathjs
**dormant mirror (904 files) was deleted 2026-06-27** (455 files / ~58.6k LOC
purged), and the _valuable_ synced code was **activated** — wired into the live
graph via `functions/src/factories/index.ts`. There is no longer an
active/dormant split. Highlights:

- **3 numeric types**: Complex (83 methods), Fraction (61 methods), BigNumber (96 methods including 22 math functions)
- **`@danielsimonjr/mathts-functions`** exports **828 names (686 callable functions)** at `functions@0.8.0`. The typed-dispatch source dir (`functions/src/typed/`) holds 30 files spanning arithmetic, trigonometry, statistics, signal, special, distributions, combinatorics, geometry, algebra, CAS, hypothesis tests, numeric/optimization, bitwise, relational, and set domains.
- **Activated mathjs factory layer**: the mathjs-derived factory functions are wired into the live graph via `functions/src/factories/index.ts` (reachable from `functions/src/index.ts`) — first-class active code, not dormant.
- **Matrix system**: DenseMatrix + SparseMatrix with JS/WASM/GPU backends
- **Parallel**: ComputePool with 40+ parallel operations
- **WASM**: **314 AssemblyScript function exports** — the sole WASM backend

### Beyond the mathjs API surface

Native typed exports go well beyond the mathjs API. The 2026-06 gap-closure
added descriptive statistics, a distribution CDF/PDF/quantile surface,
hypothesis tests, structured-matrix/decomposition helpers, digital-filter
design, geometry/quaternions, optimizers, clustering, and symbolic integration.
Categories (examples, not exhaustive):

| Category               | Examples                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Special functions      | `erfc`, `beta`, `gammainc`, `digamma`, `besselJ0/1/Y0/Y1`, Legendre, Chebyshev, Laguerre, zeta                                       |
| Distributions          | `normalPDF/CDF`, `poissonPMF`, `binomialPMF`, quantiles, plus distribution objects (`normalDist`, `betaDist`, …) with pdf/cdf/sample |
| Integration & interp   | `trapz`, `simpson`, `gaussQuad`, `romberg`, `cubicSpline`, `pchipInterp`, `polyFit`, `rbfInterpolate`                                |
| Combinatorics          | `fibonacci`, `lucas`, `doubleFactorial`, `subfactorial`, `partition`, Stirling/Bell numbers                                          |
| Geometry & quaternions | `cross3D`, `triangleArea`, `polygonArea`, `convexHull`, `rotateVector2D/3D`, Bezier, splines, Voronoi                                |
| Signal                 | `parallelFFT/IFFT`, convolution, correlation, `groupDelay`, `unwrapPhase`, STFT, window functions, filter design                     |
| Algebra & CAS          | `polyval`, `factor`, `expand`, `integrate`, `limit`, `jacobian`, `taylor`, `solve`, `groebnerBasis`                                  |
| Graph theory           | `adjacencyMatrix`, `shortestPath`, `minimumSpanningTree`, `connectedComponents`, `topologicalSort`                                   |
| Hypothesis tests       | `studentTTest`, `chiSquareTest`, `anova`, `kolmogorovSmirnovTest`, `mannWhitneyTest`, `shapiroWilkTest`, `PCA`                       |
| Numerical / optimizers | `findRoot`, `linsolve`, `minimize`, `maximize`, `leastSquares`, `nintegrate`                                                         |

> Exact per-category counts move with each release — see the generated
> `dependency-graph.json` for the authoritative export list.

## Computation Backends

MathTS has three computation backends selected automatically based on operation size and availability:

| Backend             | Source                             | Status                | Description                                      |
| ------------------- | ---------------------------------- | --------------------- | ------------------------------------------------ |
| JavaScript          | `matrix/src/backends/JSBackend.ts` | Always available      | Pure TypeScript fallback                         |
| AssemblyScript WASM | `assembly/`                        | **Sole WASM backend** | 314 function exports (326 total), SIMD-optimized |
| WebGPU              | `matrix/src/backends/gpu/`         | >100K elements        | WebGPU compute shaders                           |

The AssemblyScript backend compiles `assembly/src/` (28 source files) to a
single `mathts-as.wasm` binary, bundled into both `matrix/dist/wasm/` and
`functions/dist/wasm/`. There is no backend-selection step — AssemblyScript is
the sole WASM toolchain.

`matrix/src/backends/WASMBackend.ts` is the sole WASM matrix backend and handles
automatic JS-vs-WASM selection based on per-operation size thresholds.
`matrix/src/backends/WasmLoader.ts` loads the AssemblyScript binary
(`mathts-as.wasm`) and manages a memory pool using the AS managed allocator.

## Technology Stack

| Component   | Technology                   |
| ----------- | ---------------------------- |
| Language    | TypeScript (strict, ES2022)  |
| Modules     | ESM-only                     |
| Build       | tsup + Turborepo             |
| Test        | Vitest                       |
| WASM        | AssemblyScript (`assembly/`) |
| GPU         | WebGPU compute shaders       |
| Parallelism | Web Workers (worker_threads) |
| Notebooks   | YAML-based .mtsw format      |

## Quick Start

```typescript
// Direct imports (tree-shakeable)
import { add, multiply } from '@danielsimonjr/mathts-functions';
import { DenseMatrix } from '@danielsimonjr/mathts-matrix';
import { Complex, Fraction, BigNumber } from '@danielsimonjr/mathts-core';

// mathjs-compatible API
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);
math.add(1, 2);
```

## Current Status

| Package    | Status      | Notes                                                                                                                                                                                                                                                                                                                          |
| ---------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Core       | Stable      | Types with full method sets, factory, typed dispatch                                                                                                                                                                                                                                                                           |
| Matrix     | Stable      | Dense/Sparse with JS backend; WASM/GPU backends available                                                                                                                                                                                                                                                                      |
| Tensor     | Active      | Rank-N Float64Array-backed dense Tensor with einsum/contraction                                                                                                                                                                                                                                                                |
| Autograd   | Active      | Forward + reverse-mode automatic differentiation over Tensor                                                                                                                                                                                                                                                                   |
| Functions  | Active      | 828 exports (686 callable functions) at `functions@0.8.0`; typed dispatch (`typed/`, 30 files) plus the activated mathjs factory layer, all in one live graph (arithmetic, trig, stats, signal, special, distributions, combinatorics, geometry, algebra, CAS, graph theory, hypothesis tests, numerical/optimizers, and more) |
| Parallel   | Active      | ComputePool, 40+ operations, 7 threshold categories                                                                                                                                                                                                                                                                            |
| Workbook   | Active      | YAML parsing, dep graphs, executor; `executeCode()` evaluates cells via `evaluate()` from functions                                                                                                                                                                                                                            |
| Expression | Active      | Parser (16 node types), compiler, and evaluator fully functional; sandbox-hardened (2026-05-01 security release)                                                                                                                                                                                                               |
| Compat     | Active      | 54 shims wired to real implementations, 87 test cases                                                                                                                                                                                                                                                                          |
| Assembly   | **Primary** | Sole WASM backend — 314 function exports (326 total) in `mathts-as.wasm`; powers `matrix` heavy ops (SIMD matmul + LU/QR/Cholesky/inverse/determinant) and `functions` kernels (AS → JS dispatch)                                                                                                                              |

## Integration Status

The mathjs-derived factory layer is **activated** — wired into the live graph
via `functions/src/factories/index.ts` (reachable from
`functions/src/index.ts`), so it is first-class active code. The former dormant
synced mirror (904 files) was deleted 2026-06-27; the codebase is now a **single
active graph of 846 files** (0 dormant, 0 unused). The pre-activation
"activation readiness" scoreboard (242 factories / 19 categories / 904 dormant /
555 reachable) no longer applies.

### Bridges in Place

- **Type bridge** (`registerNativeTypes()`): Adds mathjs duck-typing markers to native Complex/Fraction/BigNumber, enabling the activated factory functions to recognize native types
- **Factory bridge** (`initTypeBridge()`): Connects native `mathTyped` dispatch with the activated factory `createTyped` instance

### Known Integration Edges

Some factory subsystems still carry integration seams from the porting era:

- **Matrix interface**: native DenseMatrix (Float64Array) vs. some factory expectations (nested Array with `._data`)
- **Auxiliary subsystems**: Unit, Index, Range, Chain, ResultSet, Help are used by a subset of factories
- **Dispatch instances**: native `mathTyped` and the factory `createTyped` instance are bridged rather than unified

## Verification

Generated 2026-08-07 by `repo_map.py map`.
Regenerate: `python repo_map.py map <repo> --out <dir>` · Check: `python repo_map.py check <repo> --docs docs/Architecture`

> **Reachability metrics are deliberately absent.** `repo_map` treats this repo as a single
> package and finds **0 entry-point roots** for the workspace umbrella, so `reachableFiles`,
> `dormantFiles`, `orphanedFiles` and `testOnlyFiles` would be artifacts of that empty root
> set rather than measurements — it emits a warning saying so. The repo's own CDG runs in
> monorepo mode with per-package roots and IS authoritative for reachability; read
> `FILE_INVENTORY.md` for those figures. The two tools disagree by scope, not correctness.

| Claim                | Value  | Source                |
| -------------------- | ------ | --------------------- |
| totalTypeScriptFiles | 1881   | dependency-graph.json |
| totalLinesOfCode     | 332379 | dependency-graph.json |
| totalExports         | 7620   | dependency-graph.json |
| totalModules         | 5      | dependency-graph.json |
| runtimeCircularDeps  | 0      | dependency-graph.json |
| typeOnlyCircularDeps | 0      | dependency-graph.json |

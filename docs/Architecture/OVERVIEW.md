# MathTS Project Overview

## What is MathTS?

MathTS is a ground-up TypeScript rewrite of [math.js](https://mathjs.org),
designed for modern JavaScript runtimes with native support for WebAssembly
(WASM), WebGPU compute shaders, and Web Workers for parallel computation.
It maintains API compatibility with math.js through a dedicated compatibility layer.

## Design Goals

- **Type Safety**: Full TypeScript with strict mode, leveraging the type system for correctness
- **Performance**: JS/WASM via `BackendManager` (per-op size thresholds); GPU opt-in (`enableGpu()` / explicit `gpuMatmul`)
- **Compatibility**: Drop-in replacement for math.js via `@danielsimonjr/mathts-compat`
- **Modularity**: Tree-shakeable ESM packages -- use only what you need
- **Parallelism**: First-class Web Worker support for large-scale computation

## Key Metrics

The figures below come from `docs/Architecture/dependency-graph.json` (`statistics`). They cover the `src/` tree of every workspace package. Regenerate them with `npm run docs:deps:full`.

There is one active code graph. Every file is reachable from a package `src/index.ts`.

| Metric                       | Value                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| TypeScript Files             | 1,189 (0 unused)                                             |
| Lines of Code                | 198,637                                                      |
| Total Exports                | 6,145 (2,592 re-exports)                                     |
| Modules                      | 82                                                           |
| Circular Dependencies        | 0 runtime (0 type-only)                                      |
| Classes / Interfaces / Funcs | 58 / 530 / 1,954 (158 type guards, 1,617 constants, 0 enums) |

## Packages

The monorepo has **24 npm packages**. The 14 primary packages are listed below;
the other 10 are thin re-export leaf packages (`parser`, `ast`, `evaluator`,
`units`, `numbers`, `linalg`, `arithmetic`, `trigonometry`, `statistics`,
`signal`) — see `ARCHITECTURE.md`. AssemblyScript (`assembly/`) is the sole WASM
toolchain. The Active Files column counts the `src/` files of each package, per
`dependency-graph.json`; regenerate with `npm run docs:deps:full`.

| Package                                   | Description                                                  | Active Files |
| ----------------------------------------- | ------------------------------------------------------------ | ------------ |
| `@danielsimonjr/mathts-typed-function`    | Type dispatch system (forked)                                | 1            |
| `@danielsimonjr/mathts-workerpool`        | Worker pool management (forked)                              | 6            |
| `@danielsimonjr/mathts-gpu`               | Shared WebGPU device, buffer pool and shader manager         | 8            |
| `@danielsimonjr/mathts-core`              | Types, typed-function, factory, seeded RNG                   | 48           |
| `@danielsimonjr/mathts-matrix`            | DenseMatrix, SparseMatrix, backends                          | 45           |
| `@danielsimonjr/mathts-tensor`            | Rank-N Float64Array-backed dense Tensor (einsum/contraction) | 21           |
| `@danielsimonjr/mathts-autograd`          | Forward + reverse-mode automatic differentiation over Tensor | 6            |
| `@danielsimonjr/mathts-functions`         | Math functions via typed dispatch                            | 478          |
| `@danielsimonjr/mathts-parallel`          | ComputePool, WebWorker operations                            | 14           |
| `@danielsimonjr/mathts-expression`        | Parser/compiler/evaluator (fully functional)                 | 477          |
| `@danielsimonjr/mathts-plot`              | Headless SVG 2D/3D plotting for MathTS                       | 21           |
| `@danielsimonjr/mathts-workbook`          | .mtsw notebook runtime + CLI                                 | 25           |
| `@danielsimonjr/mathts-compat`            | mathjs compatibility shim                                    | 3            |
| `@danielsimonjr/mathts-wasm` (`assembly`) | WASM backend (AssemblyScript) — sole WASM toolchain          | 26           |

Versions are not listed here. Each package's `package.json` gives its version.

## Single Active Code Graph

MathTS is **one active code graph**. Every file is reachable from a package
`src/index.ts`. The `src/` tree of every workspace package has 1,189 files and
0 unused files, per `dependency-graph.json` (regenerate with `npm run docs:deps:full`).
The mathjs-derived factories are wired into the graph via
`functions/src/factories/index.ts`. Highlights:

- **3 numeric types**: Complex (83 methods), Fraction (61 methods), BigNumber (96 methods including 22 math functions)
- **`@danielsimonjr/mathts-functions`**: the typed-dispatch source dir (`functions/src/typed/`) holds 40 files, including `factorization/`. They span arithmetic, trigonometry, statistics, signal, special, distributions, combinatorics, geometry, algebra, CAS, hypothesis tests, numeric/optimization, bitwise, relational, and set domains.
- **mathjs factory layer**: the mathjs-derived factory functions are wired into the graph via `functions/src/factories/index.ts` (reachable from `functions/src/index.ts`).
- **Matrix system**: DenseMatrix / SparseMatrix methods and public `lu`/`qr`/`cholesky` stay JS; WASM GEMM is `backendManager` (GPU is opt-in, not registered)
- **Parallel**: ComputePool with 40+ parallel operations
- **WASM**: see [`wasm-pairing.md` › _WASM binary exports_](./wasm-pairing.md#wasm-binary-exports) for function and total export counts (315 / 327 at last regen)

### ScalarNode toolkit, batch compile, and Pareto front (Sprint 1R)

- **`expression/src/scalar-structure.ts`**: `forEachScalar`, `mapScalar`, `scalarSize`, `scalarDepth`, `scalarComplexity`, `scalarSymbols`, `scalarCanonical`, `scalarCanonicalKey`, `scalarEquals`, and `ScalarComplexityWeights` — PySR-style canonical keys (`+`/`*` flattening; `a-b` → `a+(-1)*b`; `a/b` → `a*b^-1`; no constant-fold of `^`).
- **`functions/src/scalar-compile.ts`**: `compileScalar` builds a register tape over column `Float64Array`s with a per-row `valid` mask; `compileScalarGradient` reuses that tape with one forward lane per fitted parameter for exact ∂f/∂param batch values; no `eval` / `new Function`; does not load WASM.
- **`functions/src/fit-scalar.ts`**: `fitScalarParameters` fits `ScalarNode` parameters to columnar data via `levenbergMarquardt`, `bfgs`, or `nelderMead`, using `compileScalarGradient` for residuals and (for `l2`) standard errors from \((J^\top J)^{-1}\sigma^2\); does not load WASM.
- **`functions/src/scalar-node-bridge.ts`**: `scalarToNode`, `nodeToScalar`, `simplifyScalar`, and `scalarToTex` convert between `ScalarNode` and wired expression nodes via the factory `ConstantNode` / `SymbolNode` / `OperatorNode` / `FunctionNode` classes and `simplify` / `Node.toTex` (no formula string).
- **`functions/src/pareto-front.ts`**: `paretoFront`, `scoreFront`, `selectFrontModel` (not `paretoDist`).
- **`functions/src/numeric-equivalence.ts`**: `numericallyEquivalent` samples with `SeededRng.next`, evaluates both trees via `compileScalar`, compares with core `nearlyEqual`; a `consistent` verdict is evidence, not proof.

### Beyond the mathjs API surface

Native typed exports go well beyond the mathjs API. The `functions` package adds
descriptive statistics, a distribution CDF/PDF/quantile surface,
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

MathTS has JS and WASM matrix backends via `BackendManager`, plus separate opt-in
WebGPU paths in `@danielsimonjr/mathts-functions` / `@danielsimonjr/mathts-gpu`:

| Backend             | Source                             | Status                | Description                                                                                                                                 |
| ------------------- | ---------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript          | `matrix/src/backends/JSBackend.ts` | Always available      | Pure TypeScript fallback                                                                                                                    |
| AssemblyScript WASM | `assembly/`                        | **Sole WASM backend** | counts in [`wasm-pairing.md`](./wasm-pairing.md); SIMD where measured                                                                       |
| WebGPU (opt-in)     | `gpu/src/`, `functions/src/gpu/`   | Per-kernel f32 gates  | Fused ops: `enableGpu()` + `GPU_MIN_ELEMENTS` (65,536); GPU FFT: 262,144; explicit `gpuMatmul` without `enableGpu()` — not `BackendManager` |

The AssemblyScript backend compiles `assembly/src/` (26 `.ts` sources per
[`wasm-pairing.md`](./wasm-pairing.md)) to a single `mathts-as.wasm` binary,
bundled into both `matrix/dist/wasm/` and `functions/dist/wasm/`. There is no
backend-selection step — AssemblyScript is the sole WASM toolchain.

`matrix/src/backends/WASMBackend.ts` is the sole WASM matrix backend and handles
automatic JS-vs-WASM selection based on per-operation size thresholds.
`matrix/src/backends/WasmLoader.ts` loads the AssemblyScript binary
(`mathts-as.wasm`) and manages a memory pool using the AS managed allocator.

## Technology Stack

| Component   | Technology                   |
| ----------- | ---------------------------- |
| Language    | TypeScript (strict, ES2022)  |
| Modules     | ESM-only                     |
| Build       | tsdown + Turborepo           |
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

| Package    | Status      | Notes                                                                                                                                                                                                                                                     |
| ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core       | Stable      | Types with full method sets, factory, typed dispatch                                                                                                                                                                                                      |
| Matrix     | Stable      | Dense/Sparse; `BackendManager` registers JS + WASM only (`register-backends.ts`); GPU via explicit opt-in paths                                                                                                                                           |
| Tensor     | Active      | Rank-N Float64Array-backed dense Tensor with einsum/contraction                                                                                                                                                                                           |
| Autograd   | Active      | Forward + reverse-mode automatic differentiation over Tensor                                                                                                                                                                                              |
| Functions  | Active      | typed dispatch (`typed/`, 40 files) plus the mathjs factory layer, all in one live graph (arithmetic, trig, stats, signal, special, distributions, combinatorics, geometry, algebra, CAS, graph theory, hypothesis tests, numerical/optimizers, and more) |
| Parallel   | Active      | ComputePool, 57 named operations (`OpName`), 7 threshold categories                                                                                                                                                                                       |
| Workbook   | Active      | YAML parsing, dep graphs, executor; `executeCode()` evaluates cells via `evaluate()` from functions                                                                                                                                                       |
| Expression | Active      | Parser (15 node classes), compiler, and evaluator fully functional; sandbox-hardened                                                                                                                                                                      |
| Compat     | Active      | mathjs-compatible shims wired to real implementations                                                                                                                                                                                                     |
| Assembly   | **Primary** | Sole WASM backend — export counts in [`wasm-pairing.md`](./wasm-pairing.md); `matrix` SIMD matmul via `backendManager` (public `DenseMatrix.multiply` / `lu`/`qr`/`cholesky` stay JS); `functions` kernels (AS → JS dispatch)                             |

## Integration Status

The mathjs-derived factory layer is wired into the graph via
`functions/src/factories/index.ts` (reachable from `functions/src/index.ts`). The
codebase is one active graph of 1,189 files (0 unused).

### Bridges in Place

- **Type bridge** (`registerNativeTypes()`): Adds mathjs duck-typing markers to native Complex/Fraction/BigNumber, enabling the activated factory functions to recognize native types
- **Factory bridge** (`initTypeBridge()`): Connects native `mathTyped` dispatch with the activated factory `createTyped` instance

### Known Integration Edges

Some factory subsystems still carry integration seams from the porting era:

- **Matrix interface**: native DenseMatrix (Float64Array) vs. some factory expectations (nested Array with `._data`)
- **Auxiliary subsystems**: Unit, Index, Range, Chain, ResultSet, Help are used by a subset of factories
- **Dispatch instances**: native `mathTyped` and the factory `createTyped` instance are bridged rather than unified

## Verification

`repo-tools map` generates these values.
Regenerate: `repo-tools map . --out=<dir>` · Check: `repo-tools check . --docs=docs/Architecture`

> **No table here claims a reachability count.** The tables give size, structure and cycle counts only.
> `FILE_INVENTORY.md` and `unused-analysis.md` in this directory give the reachability figures. The
> repository generator writes them (`npm run docs:deps:full`), and the gate does not check them.

| Claim                | Value  | Source                                                                                                       |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| totalTypeScriptFiles | 2020   | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| totalLinesOfCode     | 356083 | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| totalExports         | 8108   | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| totalModules         | 5      | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| runtimeCircularDeps  | 0      | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| typeOnlyCircularDeps | 0      | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |

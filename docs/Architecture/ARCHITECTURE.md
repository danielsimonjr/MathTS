# MathTS Architecture

## System Overview

MathTS is an npm workspaces monorepo with **24 packages**, all ESM-only (ES2022).
Turborepo orchestrates builds across the workspace. tsdown bundles each package
(`functions` emits its `.d.ts` tree via `tsc`). AssemblyScript (`assembly/`,
the `@danielsimonjr/mathts-wasm` package) is the **sole WASM backend**.

The figures in this section come from `docs/Architecture/dependency-graph.json` (`statistics`). They cover the `src/` tree of every workspace package. Regenerate them with `npm run docs:deps:full`.

- **1,190 TypeScript files**, all reachable from package entry points (0 unused files)
- **198,637 lines of code**
- **6,145 total exports** (2,592 re-exports) — 58 classes, 530 interfaces, 1,954 functions, 158 type guards, 1,617 constants, 0 enums; 602 type-only imports
- Test-coverage figures are in the generated `TEST_COVERAGE.md`
- **0 runtime circular dependencies** and **0 type-only circular dependencies**
- All 24 packages have a `build` script. 23 packages have a `typecheck` script. Each one runs `tsc --noEmit`, then `tsc -p tsconfig.test.json`. `assembly` has no `typecheck` script.
- The CI workflow (`.github/workflows/ci.yml`) runs `bun run build` and `bun run typecheck`.
- `tsconfig.base.json` sets `strict: true`. Thirteen TypeScript packages use `strict: true`. The ten thin re-export packages set `strict: false` in their own `tsconfig.json`.
- `assembly` is AssemblyScript. Its `asbuild` script runs `asc`.
- `functions` ships TypeScript declarations (emitted via `tsc`).

## Package Dependency Graph

```
typed-function --> core --> matrix --> functions
                    |         ^           |
workerpool --> parallel ------+           |
                    ^                     |
                    +---------------------+
               matrix --> tensor --> autograd
               functions --> workbook
               core, matrix, functions, parallel --> compat

Focused re-export packages (leaf; each depends only on the package it re-exports):
               core       --> numbers, units
               expression --> parser, ast, evaluator
               matrix     --> linalg
               functions  --> arithmetic, trigonometry, statistics, signal
```

### Cross-Package Import Counts

| Package      | Dependencies                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| core         | @danielsimonjr/mathts-core (1)                                                                                                                                              |
| matrix       | @danielsimonjr/mathts-core (5), @danielsimonjr/mathts-parallel (3)                                                                                                          |
| functions    | @danielsimonjr/mathts-core (5), @danielsimonjr/mathts-parallel (4)                                                                                                          |
| parallel     | @danielsimonjr/mathts-workerpool (1), @danielsimonjr/mathts-parallel (1)                                                                                                    |
| compat       | @danielsimonjr/mathts-core (3), @danielsimonjr/mathts-compat (2), @danielsimonjr/mathts-matrix (2), @danielsimonjr/mathts-parallel (1), @danielsimonjr/mathts-functions (1) |
| parser       | @danielsimonjr/mathts-expression (1)                                                                                                                                        |
| ast          | @danielsimonjr/mathts-expression (1)                                                                                                                                        |
| evaluator    | @danielsimonjr/mathts-expression (1)                                                                                                                                        |
| units        | @danielsimonjr/mathts-core (1)                                                                                                                                              |
| numbers      | @danielsimonjr/mathts-core (1)                                                                                                                                              |
| linalg       | @danielsimonjr/mathts-matrix (1)                                                                                                                                            |
| arithmetic   | @danielsimonjr/mathts-functions (1)                                                                                                                                         |
| trigonometry | @danielsimonjr/mathts-functions (1)                                                                                                                                         |
| statistics   | @danielsimonjr/mathts-functions (1)                                                                                                                                         |
| signal       | @danielsimonjr/mathts-functions (1)                                                                                                                                         |

The 10 packages above are thin re-export entry points (one re-export each). The
table omits other workspace packages (`tensor`, `autograd`, `workbook`, …) that
import only their single upstream — see the generated `DEPENDENCY_GRAPH.md` for the
complete per-file breakdown.

### Circular Dependencies

The dependency graph has **0 runtime import cycles** and **0 type-only cycles**.

These seven cycles do not occur. Each row names the change that breaks the cycle:

| Former cycle                                                                        | Fix                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/utils/`: `is ↔ map` and `object → is → map → customs → object`       | `isObjectWrappingMap` moved into `map.ts` (next to the `ObjectWrappingMap` class); `is.ts` no longer imports `map.ts` — that single edge closed both cycles         |
| `expression/src/utils/`: `is ↔ map` and `object → is → map → customs → object`      | same fix as `functions/src/utils/`                                                                                                                                  |
| `functions/src/factories/evaluate.ts → typed/index.ts → typed/cas.ts → evaluate.ts` | the `export * from './cas.js'` re-export moved from `typed/index.ts` to the package entry `functions/src/index.ts`, so the `typed/index.ts → cas.ts` edge is gone   |
| `matrix/src/types/`: `DenseMatrix ↔ SparseMatrix`                                   | `DenseMatrix` dropped its `import type { SparseMatrix }`; `toSparse()` is typed as the `Matrix` base (the `SparseMatrix` subtype is still loaded lazily at runtime) |
| `matrix/src/backends/`: `BackendManager ↔ config`                                   | the `OperationType` type moved from `BackendManager.ts` to `config.ts` (the lower-level module); `config.ts` no longer imports `BackendManager`                     |

## Core Systems

### 1. Type System

Three native numeric types with full method sets:

| Type      | Methods | Capabilities                                                                                      |
| --------- | ------- | ------------------------------------------------------------------------------------------------- |
| Complex   | 83      | Arithmetic, trig, hyperbolic, transcendental, polar/rectangular                                   |
| BigNumber | 96      | Arithmetic, comparison, rounding, **22 math methods** (sin, cos, exp, ln, etc. via Taylor series) |
| Fraction  | 61      | Arithmetic, comparison, rounding, GCD/LCM                                                         |

Type guards: `isNumber`, `isComplex`, `isFraction`, `isBigNumber`, `isMatrix`, etc. (160 total in the `src/` tree of every workspace package, per `dependency-graph.json`).

**Seeded RNG (`core/src/numeric/rng.ts`).** `createSeededRng` wraps Mulberry32 with
`next`, `nextInt`, Box–Muller `normal` (pair cached per instance), and `fork(label)` for
splittable child streams (FNV-1a over parent seed bytes and label). Number seeds use
`| 0` like `mulberry32`; string seeds hash UTF-8. Existing tensor/functions samplers still
call `mulberry32` directly.

### 2. Type Dispatch

The `typed-function` package provides runtime type checking and multiple dispatch.
`TypeRegistry` manages type definitions and conversions. `mathTyped` creates
typed function instances that select implementations based on argument types.

Supported types: number, boolean, string, BigInt, Complex, Fraction, BigNumber,
DenseMatrix, SparseMatrix, Array.

### 3. Factory Pattern

Two function layers coexist in `functions/`. Both are wired into the single
active graph reachable from `functions/src/index.ts`:

| Layer                      | Location                    | Status           |
| -------------------------- | --------------------------- | ---------------- |
| Native typed functions     | `functions/src/typed/`      | Active, exported |
| Activated mathjs factories | `functions/src/<category>/` | Active, exported |

The mathjs-derived factories are wired into the graph via
`functions/src/factories/index.ts`. They are edited like any other source.
Clone-merge batch 4 (Sprint 2R) shares internals across those factories without
changing public names: `mapSlices` calls core `_switch`; `matrixFromColumns` /
`matrixFromRows` share `matrixFromVectorList` and `vectorLength`; factory `max` /
`min` share `reduceExtreme`; factory and typed `print` share `fillPrintTemplate`.
Clone-merge batch 6 shares typed numeric internals without changing public names:
`expfit` / `logfit` / `powerfit` call `linearFit`; `chebyshevFit` / `legendreFit`
and the poly WASM JS fallback call `solveAugmentedNormalEquations`; Struve and
Kelvin series share ratio-sign / term options; integer and 𝔽_p add/sub call
`zipIntPoly`; set intersect/difference call `selectById`; `fibonacci` / `lucas`
call `fibPair`.

`FunctionRegistry` stores factory registrations, `createFactory` resolves
dependencies, and the `math` singleton provides the fully configured instance.

### 4. Matrix Backends

`BackendManager` selects **JS and WASM** from size and operation type (GPU is not
registered in `backendRegistry` — only js + wasm in `register-backends.ts`):

| Backend     | Implementation         | Threshold                                                                                                                                                                             |
| ----------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JSBackend   | Pure TypeScript        | Always (default)                                                                                                                                                                      |
| WASMBackend | AssemblyScript + SIMD  | Manager path: `multiply` ≥256 flop count (`DEFAULT_CONFIG` in `config.ts`). Public `DenseMatrix.multiply` / `lu`/`qr`/`cholesky` are JS; `WASMBackend` decomp methods are opt-in only |
| GPUBackend  | WebGPU compute shaders | Dormant in `BackendManager`; use explicit `gpuMatmul` / `gpuMatrixBackend` or `enableGpu()` fused paths in functions                                                                  |

BackendManager applies per-operation WASM thresholds, backend availability, and
optional adaptive tuning — not automatic GPU selection.

Matrix types: DenseMatrix (Float64Array-backed), SparseMatrix (CSR format).
Decompositions: SVD, LU, QR, Cholesky, eigendecomposition.

### 5. Parallel Execution

ComputePool manages Web Workers for parallel operations.
Chunk strategies determine optimal data partitioning. ThresholdDispatcher
decides whether to parallelize based on data size (7 threshold categories).

Results wrapped in `ParallelResult<T>` with result data, duration, chunk count, and parallelization flag.

`ComputePool` exposes an `OpName` union type covering all recognised kernel
names (element-wise, reduction, linear-algebra, signal, geometry, and special
functions). A `thresholdByOp` map (`Partial<Record<OpName, OpThreshold>>`)
stored in `ComputePoolConfig` lets callers override the global
`thresholdElements` for individual ops. Default thresholds in
`DEFAULT_THRESHOLD_BY_OP` were measured on a CI container and sourced from
`tools/benchmark/parallel/run.ts`. `OpThreshold` accepts a number
or the string aliases `'never'` / `'always'`.

**Which public functions are effectively parallelized** — and each op's
threshold — is a **generated artifact**, not a hand-maintained list: per public
`mathTyped` function, `npm run docs:deps` scans its worker-pool routing and pairs
it against `DEFAULT_THRESHOLD_BY_OP` (parsed straight from
`parallel/src/ComputePool.ts`), emitting
[`parallel-pairing.md` / `parallel-pairing.json`](./parallel-pairing.md) — the
parallel analog of §6a's `wasm-pairing.md`. The `parallel-pairing.md` report
gives the counts of effectively parallelized, threshold-disabled and non-parallel
typed functions. The **effective** set is the compute-bound ops — `matmul` (4,096),
`tensordot` (8,192), `matrixPower` / `characteristicPolynomial` (9,216), the
hypothesis tests (4,096), `erfc` (100,000), `besselJ` (1,000,000), `spectrogram`
(65,536), `sampleChunk` (100,000). The **threshold-disabled** ops (`'never'`) are the
memory-bound element-wise arithmetic / transcendentals (`add`, `multiply`, `exp`,
`sin`, …) and small reductions (`sum`, `mean`, `variance`), where a benchmark found
worker overhead dominates at every tested size; their pool wiring
is kept so a future retune can switch them on without code churn.

### 6. WASM Layer

MathTS has **one WASM backend: AssemblyScript** (`assembly/`). AssemblyScript is
the sole WASM toolchain for both the `matrix` and `functions` packages, and
dispatch is **AS → JS**.

#### 6a. AssemblyScript WASM (`assembly/`)

AssemblyScript compiles to a single WebAssembly binary (`mathts-as.wasm`,
bundled into both `matrix/dist/wasm/` and `functions/dist/wasm/`), compiled from
the AssemblyScript sources under `assembly/src/`. The exact export counts
(functions, numeric globals, linear memory), the AssemblyScript source-file count,
and the per-category function breakdown are **generated, not hand-maintained** —
probed from the built `.wasm` via `WebAssembly.Module.exports()` by
`npm run docs:deps` and emitted to
[`wasm-pairing.md` › _WASM binary exports_](./wasm-pairing.md#wasm-binary-exports)
(rebuild the binary first with `npm run build:wasm`). The function and total export
counts of the binary live in the generated report, so they cannot drift out of this
document.

The binary is SHA-384 integrity-verified before instantiation and numerically
verified to <1e-9 vs mpmath for the special-function kernels (see
`docs/Architecture/WASM_ACCELERATION.md`).

#### 6b. WASM Bridge Layer

- **`matrix/src/backends/WasmLoader.ts`**: Loads and instantiates the
  AssemblyScript WASM binary (`mathts-as.wasm`), manages a shared linear memory
  pool, and handles allocation/deallocation. It uses the AssemblyScript managed
  runtime: buffers are allocated via `__new(byteLength, id)` and typed-array
  exports take a 12-byte header pointer; callers receive an opaque `Allocation`
  handle so they need not do pointer arithmetic. The Int32 runtime type id
  passed to `__new` is 4 here (mirrored from `assembly/build/mathts.js`) and 6
  in `WASMBackend.ts`; Float64 is 5 in both. The two files do not share an alloc
  helper, so those ids are not reconciled.
- **`matrix/src/backends/WASMBackend.ts`**: The sole WASM matrix backend. It
  decides JS vs. WASM per operation (manager multiply uses flop count ≥256 from
  `DEFAULT_CONFIG`; `WASMBackend.multiply` also requires stored-element count ≥100)
  and falls back to `JSBackend` transparently on WASM failure. It hosts the AS
  kernels only where SIMD wins: SIMD multiply/gemm on the manager path; dense
  inverse/determinant/LU/QR/Cholesky exist on `WASMBackend` but are not reached by
  public `lu`/`qr`/`cholesky`.
  Element-wise ops, transpose, reductions, and `eig`/`svd` were
  measured slower on WASM and run on JS; FFT/IFFT is not a matrix-backend op.
- **`functions/src/wasm/`**: The `functions` package's own AS bridges
  (`bridges/`, `elementwise/`, `special/`, `poly/`, `sort/`, `signal/`,
  `interpolation/`, `bitwise/`, …) plus `functions/src/wasm/WasmLoader.ts`,
  which loads the package-local `mathts-as.wasm` copy. Dispatch is AS → JS.
- **`core/src/wasm-loader.ts`** (exported via `@danielsimonjr/mathts-core/internal`):
  the **shared** SHA-384 integrity logic (`sha384OfBuffer` / `loadWasmManifest` /
  `verifyWasmIntegrity`), packaged-artifact resolution
  (`resolvePackagedWasm` / `defaultWasmLocation`), and `WasmModuleLoader`
  (`load` / cached `loadModule` / `getImports`) are single-sourced here; each
  package's `wasm/integrity.ts` + `wasm/resolve.ts` re-export the integrity and
  path helpers and inject their own `import.meta.url`. Node `fs`/`crypto` stay
  behind lazy dynamic `import()`, so this stays off core's browser-safe `.` entry.
  The two `WasmLoader` **classes** above remain per-package — they subclass
  `WasmModuleLoader` and keep their Node/browser load arms (where
  `verifyWasmIntegrity` runs) because they wrap genuinely different AssemblyScript
  allocation models (simple single-pointer vs the managed-runtime header+data
  handle).

(The earlier alternate native-WASM backend, its loader and bridge, and the
WASM backend-selection env var were all removed — there is no longer a backend
to choose between.)

#### 6c. Three-Tier Performance Model

For matrix operations via `BackendManager`:

```
JS fallback (always)
  --> WASM acceleration (SIMD matmul at multiply threshold 256; dense decompositions at WASMBackend minElements 100)
```

`ComputePool` parallelizes only the ops listed in `parallel-pairing.md` (for example
`matmul` at 4,096 elements). It is not an automatic third tier on top of WASM matrix
ops. WebGPU is separate: explicit `gpuMatmul` (no `enableGpu()`), or `enableGpu()` for
fused paths at `GPU_MIN_ELEMENTS` (65,536) and GPU FFT at 262,144 — not `BackendManager`.

For bitwise operations on `Int32Array` inputs, both `ComputePool` (`bitAnd`, …) and
`functions/src/wasm/bitwise/` stay on in-process JavaScript: worker thresholds are
`'never'` and `wasmPolicyAllows` has no bitwise band, so the WASM bridge returns
`null` in production.

### 7. Expression Package

Parser ported from mathjs (15 node classes plus the `Node` base, in
`expression/src/node/`). The package builds successfully and is **fully
functional end-to-end**: the compiler (an AST interpreter) and evaluator (`evaluate()`, `compileExpression()`)
work. The evaluator uses a sandbox (safe-access helpers in
`expression/src/utils/customs.ts`).

**ScalarNode toolkit** (`expression/src/scalar-structure.ts`, barrel
`expression/src/index.ts`): `forEachScalar`, `mapScalar`, `scalarSize`,
`scalarDepth`, `scalarComplexity`, `scalarSymbols`, `scalarCanonical`,
`scalarCanonicalKey`, `scalarEquals`, and `ScalarComplexityWeights`.
Canonical keys flatten `+` and `*`, rewrite `a-b` to `a+(-1)*b` and `a/b` to
`a*b^-1`, and do not constant-fold `^` (for example `2^3` stays a power node).

**Batch scalar compile** (`functions/src/scalar-compile.ts`): `compileScalar`
lowers a `ScalarNode` to a register tape over column `Float64Array`s with a
per-row validity mask; `compileScalarGradient` extends the same interpreter with
one gradient lane per parameter (unaries from `DUAL_UNARY_RULES`, explicit `^`
partials). `fit-scalar.ts` freezes valid rows and fits parameters with
`levenbergMarquardt`, `bfgs`, or `nelderMead` on compiled residuals and gradients.
No `eval` / `new Function` and no WASM load.

**Scalar node bridge** (`functions/src/scalar-node-bridge.ts`): `scalarToNode`,
`nodeToScalar`, `simplifyScalar`, and `scalarToTex` call the wired node
constructors and `simplify` / `Node.toTex`; they do not parse a formula string.

**Pareto front** (`functions/src/pareto-front.ts`): `paretoFront`, `scoreFront`,
`selectFrontModel` — not `paretoDist`.

**Numerical equivalence** (`functions/src/numeric-equivalence.ts`):
`numericallyEquivalent` draws sample points with `SeededRng.next`, batch-evaluates
both `ScalarNode` trees through `compileScalar`, and compares rows with core
`nearlyEqual`. A `consistent` verdict is evidence, not proof of symbolic equality.

### 8. Workbook Runtime

YAML-based reactive notebooks (.mtsw files):

- **Parser**: YAML to Workbook with typed cells
- **Graph**: Dependency resolution via topological sort with cycle detection
- **Executor**: Three modes (reactive, sequential, manual). `executeCode()` is implemented — cells are evaluated through `evaluate()` from the functions package.

## Integration Architecture

### Type Bridge

`registerNativeTypes()` adds mathjs duck-typing markers (`isComplex`, `isFraction`,
`isBigNumber`) to native type prototypes, allowing synced factories to recognize
native type instances.

### Factory Bridge

`initTypeBridge()` connects the native `mathTyped` dispatch system with the synced
mathjs `createTyped` instance, enabling factories from both layers to interoperate.

### Integration Status

| Metric                              | Value                     |
| ----------------------------------- | ------------------------- |
| Reachable files (from entry points) | 1,190                     |
| Unused files                        | 0                         |
| Synced mathjs factories             | Activated into live graph |
| Synced categories                   | 19                        |
| Type bridge                         | In place                  |
| Factory bridge                      | In place                  |

## Build Pipeline

Most packages run `tsdown src/index.ts --format esm`, then `tsc -p tsconfig.dts.json` to emit declarations. Exceptions:

| Package           | Build Variation                                       |
| ----------------- | ----------------------------------------------------- |
| core, plot        | No entry argument for `tsdown`                        |
| functions, matrix | Also runs `scripts/copy-wasm.mjs`                     |
| parallel          | Two entries (`index.ts`, `matrix.worker.ts`)          |
| workerpool        | Two entries, then `scripts/postbuild.mjs`             |
| workbook          | Three entries (`index.ts`, `cli.ts`, `run-worker.ts`) |
| assembly          | AssemblyScript (`asc`) only                           |

Turbo tasks: `test` and `typecheck` depend on `["^build", "build"]` (upstream packages
and each package's own `build` — tests import built `dist/`). `expression#typecheck`
also waits on `matrix` and `functions` builds.

## Module Summary

Source-file counts below are the files under `src/` in each workspace package,
per `dependency-graph.json`. The generated `DEPENDENCY_GRAPH.md` gives the
per-file breakdown. Regenerate with `npm run docs:deps:full`. The report counts
**1,190 TypeScript files** in total, all reachable from package entry points,
with **0 unused** files and **6,145 exports**.

| Package                          | Reachable Files |
| -------------------------------- | --------------- |
| core                             | 48              |
| matrix                           | 45              |
| tensor                           | 21              |
| autograd                         | 6               |
| functions                        | 478             |
| parallel                         | 14              |
| expression                       | 477             |
| workbook                         | 25              |
| compat                           | 3               |
| assembly (wasm)                  | 27              |
| typed-function                   | 1               |
| workerpool                       | 6               |
| gpu                              | 8               |
| plot                             | 21              |
| thin re-export packages (10 × 1) | 10              |
| **Total**                        | **1,190**       |

## Verification

`repo-tools map` generates these values.
Regenerate: `repo-tools map . --out=<dir>` · Check: `repo-tools check . --docs=docs/Architecture`

> **No table here claims a reachability count.** The tables give size, structure and cycle counts only.
> `FILE_INVENTORY.md` and `unused-analysis.md` in this directory give the reachability figures. The
> repository generator writes them (`npm run docs:deps:full`), and the gate does not check them.

| Claim                | Value | Source                                                                                                       |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| totalTypeScriptFiles | 2123  | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| totalModules         | 5     | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| runtimeCircularDeps  | 0     | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| typeOnlyCircularDeps | 0     | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |

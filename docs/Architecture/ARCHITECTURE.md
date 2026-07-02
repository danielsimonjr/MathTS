# MathTS Architecture

**Generated**: 2026-07-01

## System Overview

MathTS is an npm workspaces monorepo with **22 packages**, all ESM-only (ES2022).
Turborepo orchestrates builds across the workspace. tsup bundles each package
(`functions` emits its `.d.ts` tree via `tsc`). AssemblyScript (`assembly/`,
the `@danielsimonjr/mathts-wasm` package) is the **sole WASM backend**.

- **846 TypeScript files**, all reachable from package entry points (0 unused
  files) — the dormant synced-from-mathjs mirror (455 files / ~58.6k LOC) was
  deleted 2026-06-27, so there is now a single active graph, not a
  reachable-vs-dormant split
- **158,032 lines of code**
- **4,088 total exports** (1,204 re-exports) — 50 classes, 358 interfaces, 1,461
  functions, 135 type guards, 1,417 constants, 0 enums; 431 type-only imports
- **320 test files** — 201 of 562 source files have direct (structural) test coverage
  (35.8%); see the generated `TEST_COVERAGE.md`
- **0 runtime circular dependencies** (2 type-only cycles remain, both in `matrix`)
- **All 22 packages build, and all 21 TypeScript packages typecheck with 0
  errors** under `tsc --noEmit`. Every package now compiles under `strict: true`
  (`functions` and `expression` were the last holdouts, flipped 2026-06-27); no
  package overrides `strict` to `false`. The 22nd package, `assembly`, is
  AssemblyScript and is checked by `asc`. `functions` ships TypeScript
  declarations (emitted via `tsc`); the active graph is clean.

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

The dependency-graph report detects **0 runtime import cycles**. Two **type-only**
cycles remain, both inside `matrix` (these are erased at compile time and don't
affect runtime load order):

- `matrix/src/types/DenseMatrix.ts` ↔ `matrix/src/types/dense/arithmetic.ts`
- `matrix/src/types/DenseMatrix.ts` ↔ `matrix/src/types/dense/reduction.ts`

Seven cycles flagged by the 2026-05-22 report were all eliminated:

| Former cycle                                                                        | Fix                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `functions/src/utils/`: `is ↔ map` and `object → is → map → customs → object`       | `isObjectWrappingMap` moved into `map.ts` (next to the `ObjectWrappingMap` class); `is.ts` no longer imports `map.ts` — that single edge closed both cycles         |
| `expression/src/utils/`: `is ↔ map` and `object → is → map → customs → object`      | same fix as `functions/src/utils/`                                                                                                                                  |
| `functions/src/factories/evaluate.ts → typed/index.ts → typed/cas.ts → evaluate.ts` | the `export * from './cas.js'` re-export moved from `typed/index.ts` to the package entry `functions/src/index.ts`, so the `typed/index.ts → cas.ts` edge is gone   |
| `matrix/src/types/`: `DenseMatrix ↔ SparseMatrix`                                   | `DenseMatrix` dropped its `import type { SparseMatrix }`; `toSparse()` is typed as the `Matrix` base (the `SparseMatrix` subtype is still loaded lazily at runtime) |
| `matrix/src/backends/`: `BackendManager ↔ config`                                   | the `OperationType` type moved from `BackendManager.ts` to `config.ts` (the lower-level module); `config.ts` no longer imports `BackendManager`                     |

No package has any remaining **runtime** cycle; the only residual cycles are the
two type-only ones in `matrix` noted above.

## Core Systems

### 1. Type System

Three native numeric types with full method sets:

| Type      | Methods | Capabilities                                                                                      |
| --------- | ------- | ------------------------------------------------------------------------------------------------- |
| Complex   | 83      | Arithmetic, trig, hyperbolic, transcendental, polar/rectangular                                   |
| BigNumber | 96      | Arithmetic, comparison, rounding, **22 math methods** (sin, cos, exp, ln, etc. via Taylor series) |
| Fraction  | 61      | Arithmetic, comparison, rounding, GCD/LCM                                                         |

Type guards: `isNumber`, `isComplex`, `isFraction`, `isBigNumber`, `isMatrix`, etc. (135 total across codebase).

### 2. Type Dispatch

The `typed-function` package provides runtime type checking and multiple dispatch.
`TypeRegistry` manages type definitions and conversions. `mathTyped` creates
typed function instances that select implementations based on argument types.

Supported types: number, boolean, string, BigInt, Complex, Fraction, BigNumber,
DenseMatrix, SparseMatrix, Array.

### 3. Factory Pattern

Two function layers coexist in `functions/`, both now wired into the single
active graph reachable from `functions/src/index.ts`:

| Layer                      | Location                    | Status           |
| -------------------------- | --------------------------- | ---------------- |
| Native typed functions     | `functions/src/typed/`      | Active, exported |
| Activated mathjs factories | `functions/src/<category>/` | Active, exported |

The formerly-synced mathjs factories were **activated** — wired into the live
graph via `functions/src/factories/index.ts` (2026-06-27) — so they are no longer
a dormant, unexported layer; they are edited like any other source. The
`@danielsimonjr/mathts-functions` package (released `functions@0.8.0`) now exports
**828 names (686 callable functions)**.

`FunctionRegistry` stores factory registrations, `createFactory` resolves
dependencies, and the `math` singleton provides the fully configured instance.

### 4. Matrix Backends

Three computation backends with automatic selection via BackendManager:

| Backend     | Implementation         | Threshold          |
| ----------- | ---------------------- | ------------------ |
| JSBackend   | Pure TypeScript        | Always (default)   |
| WASMBackend | AssemblyScript + SIMD  | ≥ 256 elements     |
| GPUBackend  | WebGPU compute shaders | > 100,000 elements |

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

`ComputePool` exposes an `OpName` union type covering all recognised kernel
names (element-wise, reduction, linear-algebra, signal, geometry, and special
functions). A `thresholdByOp` map (`Partial<Record<OpName, OpThreshold>>`)
stored in `ComputePoolConfig` lets callers override the global
`thresholdElements` for individual ops. Default thresholds in
`DEFAULT_THRESHOLD_BY_OP` were measured on a CI container (2026-05-23) and
sourced from `tools/benchmark/parallel/run.ts`. `OpThreshold` accepts a number
or the string aliases `'never'` / `'always'`.

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
(rebuild the binary first with `npm run build:wasm`). As of the last regeneration
the binary carried 314 function exports across 326 total exports; that figure lives
in the generated report so it can no longer silently drift out of this doc.

The binary is SHA-384 integrity-verified before instantiation and numerically
verified to <1e-9 vs mpmath for the special-function kernels (see
`docs/Architecture/WASM_ACCELERATION.md`).

#### 6b. WASM Bridge Layer

- **`matrix/src/backends/WasmLoader.ts`**: Loads and instantiates the
  AssemblyScript WASM binary (`mathts-as.wasm`), manages a shared linear memory
  pool, and handles allocation/deallocation. It uses the AssemblyScript managed
  runtime: buffers are allocated via `__new(byteLength, id)` and typed-array
  exports take a 12-byte header pointer; callers receive an opaque `Allocation`
  handle so they need not do pointer arithmetic.
- **`matrix/src/backends/WASMBackend.ts`**: The sole WASM matrix backend. It
  decides JS vs. WASM per operation by element-count threshold (e.g. matrix
  multiply switches to WASM at ≥256 elements) and falls back to `JSBackend`
  transparently on WASM failure. It hosts the AS kernels only where SIMD wins:
  SIMD multiply/gemm plus the dense inverse, determinant, and LU/QR/Cholesky
  decompositions. Element-wise ops, transpose, reductions, and `eig`/`svd` were
  measured slower on WASM and run on JS; FFT/IFFT is not a matrix-backend op.
- **`functions/src/wasm/`**: The `functions` package's own AS bridges
  (`bridges/`, `elementwise/`, `special/`, `poly/`, `sort/`, `signal/`,
  `interpolation/`, `bitwise/`, …) plus `functions/src/wasm/WasmLoader.ts`,
  which loads the package-local `mathts-as.wasm` copy. Dispatch is AS → JS.

(The earlier alternate native-WASM backend, its loader and bridge, and the
WASM backend-selection env var were all removed — there is no longer a backend
to choose between.)

#### 6c. Three-Tier Performance Model

For matrix operations via `BackendManager`:

```
JS fallback (always)
  --> WASM acceleration (≥256 elements, 2-10x faster)
        --> Parallel/multi-core (>100K elements, additional 2-4x)
```

For bitwise operations on `Int32Array` inputs (`functions/src/typed/bitwise.ts` +
`functions/src/wasm/bitwise/wasm-bridge.ts`), a separate three-tier model applies:

```
in-process JS (small arrays)
  --> ComputePool worker (per-op threshold from thresholdByOp in ComputePool)
        --> WASM kernel (>65,536 elements; SIMD/native path dominates marshal cost)
```

The WASM tier is the outermost check: if `WASM_BITWISE_THRESHOLD` (64 × 1,024
elements) is met and the module is loaded, `runBinaryBitwiseWasm` /
`runUnaryBitwiseWasm` are called directly and bypass the worker pool entirely.
The `ComputePool` path is the fallback when WASM is unavailable or returns
`null`; in-process JS is the innermost fallback.

### 7. Expression Package

Parser ported from mathjs (16 node types, 1,885-line `parse.ts`). The package
builds successfully and is **fully functional end-to-end**: the compiler (a
16-node-type AST interpreter) and evaluator (`evaluate()`, `compileExpression()`)
work. A 2026-05-01 security release hardened the evaluator with a sandbox
(safe-access helpers in `expression/src/utils/customs.ts`).

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

| Metric                              | Value                                  |
| ----------------------------------- | -------------------------------------- |
| Reachable files (from entry points) | 846                                    |
| Unused files                        | 0                                      |
| Synced mathjs factories             | Activated into live graph (2026-06-27) |
| Synced categories                   | 19                                     |
| Type bridge                         | In place                               |
| Factory bridge                      | In place                               |

### Activation Barriers (historical)

The valuable synced factories have since been activated into the single live
graph (2026-06-27), so the barriers below are historical context rather than
open work:

1. **Two typed-function instances** -- native (15 types, instanceof) vs. synced (40+ types, duck-typing). Bridge partially resolves this.
2. **Matrix interface mismatch** -- native DenseMatrix is Float64Array-backed; synced factories expect nested Array with `._data`, `._size`, `.storage()`.
3. **Missing subsystems** -- Unit, Index, Range, Chain, ResultSet, Help required by 100+ factories.

## Build Pipeline

All packages use `tsup src/index.ts --format esm --dts --clean` with exceptions:

| Package   | Build Variation                              |
| --------- | -------------------------------------------- |
| functions | No `--dts` flag                              |
| workbook  | Two entry points (index.ts + cli.ts)         |
| assembly  | AssemblyScript (`asc`) + TypeScript bindings |

Turbo tasks: `test` and `typecheck` depend on `^build` (upstream packages build first).

## Module Summary

Source-file counts below are the reachable files per package. The report counts
**846 TypeScript files total** across all packages — all reachable from package
entry points, **0 unused** — and **4,088 exports**; the dormant
synced-from-mathjs mirror (455 files / ~58.6k LOC) was deleted 2026-06-27. The
authoritative, always-current per-package breakdown is the generated
`dependency-graph.json` / `DEPENDENCY_GRAPH.md` (regenerate with
`tools/create-dependency-graph`); the table below is a point-in-time snapshot.

| Package                          | Reachable Files |
| -------------------------------- | --------------- |
| core                             | 15              |
| matrix                           | 43              |
| tensor                           | 21              |
| autograd                         | 6               |
| functions                        | 391             |
| parallel                         | 11              |
| expression                       | 302             |
| workbook                         | 14              |
| compat                           | 3               |
| assembly (wasm)                  | 27              |
| typed-function                   | 1               |
| workerpool                       | 2               |
| thin re-export packages (10 × 1) | 10              |
| **Total**                        | **846**         |

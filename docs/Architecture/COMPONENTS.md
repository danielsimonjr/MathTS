# MathTS — Component Reference

**Anchor versions**: core 0.13.0 · functions 0.43.2 · matrix 0.6.3 · expression 0.6.7 · workbook 0.3.3 (24 npm-workspace packages; independently versioned via Changesets)
**Last Updated**: 2026-07-18

A TypeScript rewrite of mathjs with WASM / WebGPU / WebWorker acceleration, organized as a Turborepo
monorepo of 24 ESM-only packages. This document is the component-level map: what each package is for, its
key exported types, and how the packages depend on one another. For the always-current dependency data see
the generated [`DEPENDENCY_GRAPH.md`](./DEPENDENCY_GRAPH.md); for the higher-level narrative see
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Table of Contents

1. [Overview](#overview)
2. [Foundation Components](#foundation-components)
3. [Core Component](#core-component)
4. [Numeric & Linear-Algebra Components](#numeric--linear-algebra-components)
5. [Compute Components](#compute-components)
6. [Function Component](#function-component)
7. [Expression & Notebook Components](#expression--notebook-components)
8. [Compatibility & Visualization Components](#compatibility--visualization-components)
9. [Focused Re-export Packages](#focused-re-export-packages)
10. [Component Dependencies](#component-dependencies)

---

## Overview

MathTS is layered: forked foundations at the bottom, a numeric `core`, accelerated numeric/compute packages
in the middle, the large `functions` and `expression` graphs above them, and application-facing packages
(`workbook`, `compat`, `plot`) at the top. Acceleration is a three-tier model — pure JS everywhere, an
AssemblyScript WASM backend where SIMD wins, and an experimental WebGPU tier — selected per operation.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  App / adapters   │  workbook (25) · compat (3) · plot (21)                  │
├────────────────────────────────────────────────────────────────────────────┤
│  Function graph   │  functions (445)          expression (425)              │
├────────────────────────────────────────────────────────────────────────────┤
│  Numeric / accel  │  matrix (46) · tensor (21) · autograd (6) · parallel(14) │
├────────────────────────────────────────────────────────────────────────────┤
│  Core             │  core (44)  — types · typed-function · factory           │
├────────────────────────────────────────────────────────────────────────────┤
│  Shared leaves    │  gpu (8, WebGPU foundation) · assembly (27, AS/WASM)     │
├────────────────────────────────────────────────────────────────────────────┤
│  Forked runtime   │  typed-function (2) · workerpool (5)                     │
└────────────────────────────────────────────────────────────────────────────┘
   (parenthesised numbers are src/*.ts file counts)

   Thin re-export surfaces (1 file each): parser · ast · evaluator · units ·
   numbers · linalg · arithmetic · trigonometry · statistics · signal
```

---

## Foundation Components

The bottom tier: two first-party forks of mathjs's runtime dependencies, plus the shared WebGPU foundation
and the AssemblyScript WASM source. These carry no math-domain logic — they are the machinery the numeric
packages build on.

### @danielsimonjr/mathts-typed-function (`packages/typed-function/`)

**Purpose**: Forked runtime type-dispatch engine — the multiple-dispatch core behind every `mathTyped(...)`
registration.

```typescript
// The dispatch primitive: register a name with per-signature implementations,
// get back a single function that routes by runtime argument types.
typed(name, { 'number': ..., 'Complex': ..., 'BigNumber, number': ... })
```

The only consumer is `core` (which wraps it as `mathTyped` / `createMathTSTyped`). Forked so its type
surface can be tightened for strict-mode dispatch (see `core`'s `MathTSTyped` / `SignatureImpl`).

### @danielsimonjr/mathts-workerpool (`packages/workerpool/`)

**Purpose**: Forked Web-Worker / worker-thread pool management — spawns, schedules, and tears down workers.

```typescript
export function canUseWasm(): boolean;
export function canUseSharedMemory(): boolean;
export async function initializePool(config?: Partial<WorkerPoolConfig>): Promise<MathWorkerPool>;
export async function terminatePool(force?: boolean): Promise<void>;
```

Consumed only by `parallel`. Ships a `workerpool-browser-shim.ts` for the browser build (its `canUse*`
probes are the node/browser split).

### @danielsimonjr/mathts-gpu (`gpu/`)

**Purpose**: Shared WebGPU foundation — device/adapter lifecycle, buffer pooling, capability detection, and a
generic shader compile/cache API. **No domain kernels** (those stay in `matrix`).

```typescript
export class GPUContext        // device/adapter lifecycle; getGpuDevice() caches one in-flight Promise
export class BufferPool        // GPU buffer allocation/reuse
export class ShaderManager     // generic WGSL compile · cache · pipeline

export function detectGPUCapabilities(): GPUCapabilities
export function getGlobalGPUContext(): GPUContext
export function hasWebGPU(): boolean
export function isGPUSuitableForMatrixOps(...): boolean
```

Extracted from `matrix` (Spec 1a of the WebGPU epic) so the foundation is reusable and `matrix` re-exports it
for back-compat. `v0.2.0`.

### @danielsimonjr/mathts-wasm (`assembly/`)

**Purpose**: The AssemblyScript source for the **sole** WASM backend of the repo (`mathts-as.wasm`) — SIMD
`f64x2` matrix multiply plus the dense LU/QR/Cholesky/inverse/determinant kernels, and the `functions`
special/FFT kernels.

```
asc src/index.ts  →  mathts-as.wasm   (built by `npm run build:wasm`)
```

Compiled + type-checked by `asc`, not `tsc` (its `@inline`/`i32`/`f64`/`usize` source is eslint-excluded).
The JS-side loaders live in `functions`/`matrix`; the shared SHA-384 integrity + resolution logic lives in
`core/src/wasm-loader.ts`. Package name `@danielsimonjr/mathts-wasm`.

---

## Core Component

### @danielsimonjr/mathts-core (`core/`)

**Purpose**: The foundation every other package builds on — numeric types, the typed-function integration, and
the factory/registry system. "All libraries build on core."

```typescript
// Numeric types (with type guards + constants)
export class Complex        // bigint-free f64 complex
export class Fraction
export class BigNumber      // bigint-backed (NOT decimal.js: add/sub/lessThanOrEqual/equals/compareTo)
export class Dual           // forward-mode autodiff scalar
// Unit (dimensional analysis) lives here too, deeply integrated (merged 2026-07-04)

// typed-function integration
export const mathTyped
export function createMathTSTyped(): MathTSTyped
export class TypeRegistry           // isNumber / isComplex / isMatrix / … guards

// Factory / registry
export class FunctionRegistry
export function createFactory(...)
export const registry
export const DEFAULT_CONFIG

// Error classes
export class MathjsError, IndexError, DimensionError, DimensionMismatchError, UnitParseError

// Subpath: @danielsimonjr/mathts-core/internal — cold shared utils (is/number/object/array/
// collection/map/string/customs/switch), the WASM loader, and shared types. NOT on the browser-safe `.` entry.
```

Hot-path type guards (`is.ts`) are deliberately kept **local** to each package (V8 won't inline across module
boundaries — a ~40% regression if consolidated); only cold utilities live in `core/internal`. `v0.13.0`.

---

## Numeric & Linear-Algebra Components

### @danielsimonjr/mathts-matrix (`matrix/`)

**Purpose**: Dense & sparse matrices with automatic backend selection across JS / WASM / GPU.

```typescript
export abstract class Matrix
export class DenseMatrix          // Float64Array-backed
export class SparseMatrix         // CSC
export class BackendManager       // per-op JS/WASM/GPU selection
export class JSBackend            // pure TS, always available
export class WASMBackend          // AssemblyScript (SIMD multiply + LU/QR/Cholesky/inverse/det)
export class GPUBackend           // experimental WebGPU compute (re-exports the gpu foundation)
export class WasmLoader           // per-package loader (SHA-384 verify via core/internal)
```

Decompositions (`matrix/src/operations/*`) are the maintained, oracle-pinned primitives that the `functions`
factory layer routes to (the "prefer the accelerated primitive" pattern). Depends on `core`, `parallel`,
`gpu`. `v0.6.3`.

### @danielsimonjr/mathts-tensor (`tensor/`)

**Purpose**: Rank-N dense tensor (Float64Array-backed) with NumPy-style shape/stride semantics.

```typescript
export class Tensor          // rank-N, broadcasting, reshape/transpose/reduce
export class Index           // multi-axis indexing
```

Depends on `core`, `matrix`. Bundled with `tsup` before runtime, so it uses bare relative imports. `v0.2.17`.

### @danielsimonjr/mathts-autograd (`autograd/`)

**Purpose**: Automatic differentiation over `Tensor` — forward-mode (dual numbers) and reverse-mode (tape).

```typescript
export class DualTensor      // forward-mode: value + directional derivative
export class Tape            // reverse-mode recording
export class TapedTensor     // reverse-mode leaf/intermediate
```

Depends on `core`, `tensor`. Forward-mode `Dual` rules are shared from `core` (`DUAL_UNARY_RULES`). `v0.3.12`.

---

## Compute Components

### @danielsimonjr/mathts-parallel (`parallel/`)

**Purpose**: WebWorker-backed parallel compute — chunking, thresholded dispatch, and elementwise/matmul
kernels. The middle tier of the acceleration model.

```typescript
export class ComputePool          // the pool `functions` parallel ops use (matmul/transpose/matvec/outer)
export class ParallelMatrix
export class ThresholdDispatcher  // decides serial vs parallel by size
export class WorkerPool           // execute(task, { timeoutMs }) — terminates + replaces hung workers
export const computePool          // shared instance

// worker kernels: parallelAdd/parallelCos/… + bitwise (bitAnd/bitOr/bitXor/leftShift/…) over Int32Array
export function chunkArray, calculateOptimalChunks, mergeFloat64Chunks, dispatch
```

Depends on `workerpool` and `core` (core only for stable numeric primitives — still **not** `matrix`). The
`WorkerPool` timeout/replacement plumbing is a security invariant — do not remove it. `v0.6.3`.

---

## Function Component

### @danielsimonjr/mathts-functions (`functions/`)

**Purpose**: The math-function library — hundreds of functions via typed dispatch, spanning arithmetic,
trigonometry, statistics, signal processing, linear algebra, calculus, optimization, ML, graph algorithms, and
special functions. The largest package (445 src files).

```typescript
// Single active graph reachable from src/index.ts, in three layers:
//   typed/       parallel-first typed implementations (arithmetic, trigonometry, statistics, signal, cas)
//   factories/   activated mathjs-derived factory functions (algebra, type, utils, plain, …)
//   wasm/        JS-side *Dispatch bridges + WasmLoader (backend is assembly/src)

// Representative domains (each a src subtree under functions/src/):
//   numeric/     fsolve · minimize · quad · bspline · krylov · eigsh · interpn · monte …
//   signal/      fft · fir · iir · spectral · wavelets
//   stats/       fit · inference · mvn · power · timeseries
//   ml/          ols · glm · logistic · kde · dbscan · regularized
//   graph/       traversal · community · optimization
//   special/     hypergeometric · jacobi · polygamma · niche
```

Compiles under `strict: true`; ships its `.d.ts` tree via `tsc -p tsconfig.dts.json` (rollup-dts can't bundle
the graph). Depends on `core`, `matrix`, `parallel`, `expression`. `v0.43.2`.

---

## Expression & Notebook Components

### @danielsimonjr/mathts-expression (`expression/`)

**Purpose**: The MathTS expression parser, AST, compiler, and evaluator — with a hardened access sandbox.

```typescript
// parse(str) → AST node tree → compile(node) → evaluate(scope)
// Node types: Constant / Symbol / Operator / Function / Accessor / Assignment / … Nodes
// Security: ALL property/method access routes through getSafeProperty / setSafeProperty / getSafeMethod
//           (expression/src/utils/customs.ts) — direct obj[name] is a sandbox bypass.
```

Depends on `core`. The 425-file graph includes the full evaluator; `security/sandbox.test.ts` is the
regression guard for safe-access. `v0.6.7`.

### @danielsimonjr/mathts-workbook (`workbook/`)

**Purpose**: Headless runtime for `.mtsw` reactive YAML notebooks — parse, dependency-resolve, and execute
cells (which evaluate **MathTS expressions**, not TypeScript).

```typescript
export class WorkbookExecutor      // runCell / runAll (event stream) · runReport (continue-on-error)
export class Session
export class WorkbookTimeoutError

export function buildDependencyGraph, topologicalSort, detectCycles, toMermaid
export interface Workbook, Cell, CellResult, RunResult, RuntimeConfig
```

Ships an `mtsw` CLI (`run`/`validate`/`graph`) as a second entry point. Depends on `core`, `functions`,
`expression`, `plot`. `v0.3.3`.

---

## Compatibility & Visualization Components

### @danielsimonjr/mathts-compat (`compat/`)

**Purpose**: mathjs-compatible API shim for drop-in migration (`create(all)`), pinning mathjs semantics
independently of `functions`.

```typescript
export function create(all): MathInstance
export const all
export interface MathInstance, MathJSConfig
// math.add(1,2) · math.complex(3,4) · math.matrix([...]) — delegates to core types + operations
```

Intentionally reimplements some homonyms to guarantee mathjs behavior (guarded by
`compat/tests/parity-oracle.test.ts` pinning compat ≡ mathjs/numpy). Single-arg `zeros(n)`/`ones(n)` return a
length-`n` vector (mathjs parity, `v0.4.0`). Depends on `core`, `matrix`, `parallel`, `functions`.

### @danielsimonjr/mathts-plot (`plot/`)

**Purpose**: 2D/3D plotting — SVG/TikZ vector output plus a PNG/PDF render bridge, and the workbook chart
adapter.

```typescript
export class PlotRenderError
// plot() polymorphic API · 2D marks (scatter/bar/area/step/histogram/errorbar/quiver) · curve3d
// backends: SVG · TikZ (./tex) · PNG/PDF (./render bridge)
```

Its `.` entry is browser-safe (node code gated behind subpaths, verified by `npm run check:browser-safety`).
Depends on `core`, `functions`, `expression`. `v0.3.29`.

---

## Focused Re-export Packages

Thin single-file entry points (1 src file each) that re-export a curated slice of a parent package's surface —
no duplicated implementation. They let consumers install a focused domain.

| Package                              | Re-exports from | Surface                              |
| ------------------------------------ | --------------- | ------------------------------------ |
| `@danielsimonjr/mathts-parser`       | `expression`    | expression parser                    |
| `@danielsimonjr/mathts-ast`          | `expression`    | AST node constructors                |
| `@danielsimonjr/mathts-evaluator`    | `expression`    | compile / evaluate                   |
| `@danielsimonjr/mathts-units`        | `core`          | `Unit` / dimensional analysis        |
| `@danielsimonjr/mathts-numbers`      | `core`          | `Complex` / `Fraction` / `BigNumber` |
| `@danielsimonjr/mathts-linalg`       | `matrix`        | matrix decompositions                |
| `@danielsimonjr/mathts-arithmetic`   | `functions`     | arithmetic domain                    |
| `@danielsimonjr/mathts-trigonometry` | `functions`     | trigonometry domain                  |
| `@danielsimonjr/mathts-statistics`   | `functions`     | statistics domain                    |
| `@danielsimonjr/mathts-signal`       | `functions`     | signal-processing domain             |

---

## Component Dependencies

Per-package edges (source of truth: each `package.json`; generated form:
[`DEPENDENCY_GRAPH.md`](./DEPENDENCY_GRAPH.md)). No circular dependencies (0 cycles).

```
typed-function
    └── core

workerpool
    └── parallel ── core

core
    ├── expression ─────────────── (parser · ast · evaluator re-export expression)
    ├── matrix ── parallel · gpu ─ (linalg re-exports matrix)
    │     ├── tensor
    │     │     └── autograd ── (also → core)
    │     └── compat ── parallel · functions ── (also → core)
    ├── functions ── matrix · parallel · expression
    │     ├── workbook ── expression · plot ── (also → core)
    │     └── plot ── expression ── (also → core)
    ├── numbers · units          (re-export core)
    └── arithmetic · trigonometry · statistics · signal   (re-export functions)

gpu          ← matrix                 (shared WebGPU foundation)
assembly     → mathts-as.wasm         (built artifact loaded by functions + matrix)
```

Read the arrows as "depends on / is built on": `core → typed-function`; `functions → core · matrix ·
parallel · expression`; `workbook → core · functions · expression · plot`. Cross-package duplication is held
at zero by the `check:duplicates` pre-commit gate (see [`ARCHITECTURE.md`](./ARCHITECTURE.md) and the
`duplicate-symbols` report).

---

**Document Version**: 1.0
**Last Updated**: 2026-07-18
**Maintained By**: Daniel Simon Jr.

## Verification

Generated 2026-08-07 by `repo_map.py map`.
Regenerate: `python repo_map.py map <repo> --out <dir>` · Check: `python repo_map.py check <repo> --docs docs/Architecture`

> **Reachability metrics are deliberately absent.** `repo_map` treats this repo as a single
> package and finds **0 entry-point roots** for the workspace umbrella, so `reachableFiles`,
> `dormantFiles`, `orphanedFiles` and `testOnlyFiles` would be artifacts of that empty root
> set rather than measurements — it emits a warning saying so. The repo's own CDG runs in
> monorepo mode with per-package roots and IS authoritative for reachability; read
> `FILE_INVENTORY.md` for those figures. The two tools disagree by scope, not correctness.

| Claim                | Value | Source                |
| -------------------- | ----- | --------------------- |
| totalTypeScriptFiles | 1880  | dependency-graph.json |
| totalExports         | 7620  | dependency-graph.json |

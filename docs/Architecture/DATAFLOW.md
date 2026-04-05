# MathTS Data Flow

**Generated**: 2026-04-03

## Overview

This document describes how data flows through the MathTS system — from user input through type dispatch, backend selection, parallel execution, factory activation, and workbook evaluation.

---

## 1. Type Dispatch Flow

```text
User call: add(a, b)
  1. mathTyped (typed-function instance) receives arguments
  2. Inspects runtime types via instanceof checks (15 registered types)
  3. Matches against registered signatures:
       (number, number)       -> number
       (Complex, Complex)     -> Complex
       (Fraction, Fraction)   -> Fraction
       (BigNumber, BigNumber) -> BigNumber
       (Matrix, Matrix)       -> Matrix
       (Array, Array)         -> Array
  4. If no exact match, applies registered type conversions:
       number -> Complex     (automatic promotion)
       number -> BigNumber
       Fraction -> number
  5. Dispatches to matched implementation
  6. Returns typed result
```

The `mathTyped` instance lives in `@danielsimonjr/mathts-core`. It uses `instanceof`-based checks
(not duck-typing). This is incompatible with the synced mathjs `createTyped` instance,
which uses 40+ duck-typed type checks.

---

## 2. Matrix Backend Selection Flow

```text
matrix.multiply(other)   // DenseMatrix or SparseMatrix
  1. BackendManager.selectBackend(size) called with rows * cols
  2. Checks registered backends in preference order:
       size < 1,000         -> JSBackend    (always available)
       1,000 <= size < 100K -> WASMBackend  (if available)
       size >= 100,000      -> GPUBackend   (if available)
  3. executeWithFallback(op, backend):
       - Tries selected backend
       - On failure or unavailability, falls back to next lower backend
       - Final fallback: JSBackend (always succeeds)
  4. Adaptive tuning (if enabled):
       - maybeAdjustThresholds() samples execution time per operation
       - recordSample() updates rolling performance stats
       - getAdaptiveThresholds() returns current dynamic cutoffs
  5. Returns result as DenseMatrix
```

| Backend | Threshold | Key Ops |
|---------|-----------|---------|
| `JSBackend` | Default | All ops, pure TypeScript, Float64Array |
| `WASMBackend` | >1K elements | SIMD multiply, LU/QR/Cholesky, eigenvalues |
| `GPUBackend` | >100K elements | WebGPU matmul, transpose, scale, elementwise |
| `ParallelBackend` | Configurable | WebWorker-backed elementwise + matmul |

---

## 3. Parallel Execution Flow

```text
parallelAdd(a, b)   // Float64Array inputs
  1. shouldParallelize(a.length):
       - Below threshold: execute synchronously, return immediately
       - Above threshold: proceed to chunking
  2. calculateOptimalChunks(data, workerCount):
       - Splits data into N chunks based on pool size and data size
       - 7 threshold categories with adaptive minimums
  3. ComputePool.run(workerFn, chunks):
       - Distributes chunks to Web Workers via postMessage
       - Transfers ownership of TypedArrays (zero-copy)
       - Each worker processes its chunk independently
  4. Collect and merge results:
       - mergeFloat64Chunks(results) reassembles output array
  5. Returns ParallelResult<Float64Array>:
       { result, duration, chunks, parallelized }
```

Statistics and signal functions (`@danielsimonjr/mathts-functions`) follow the same path:
array overloads call `@danielsimonjr/mathts-parallel` internally and return `Promise<ParallelResult<T>>`.
Variadic overloads (2–4 scalars) are synchronous.

---

## 3b. WASM Bridge Interception Flow

When `MatrixWasmBridge` is active (WASM backend loaded, operation size above threshold), the
matrix backend flow is extended:

```text
typed-function dispatch -> MatrixWasmBridge.execute(op, args)
  1. Threshold check:
       element_count < threshold  -> skip to JSBackend immediately
       element_count >= threshold -> proceed to WASM path
  2. Memory allocation (WasmLoader):
       allocate(byteLength) reserves space in the WASM linear memory pool
       Input Float64Arrays written to WASM memory via copyToWasm()
  3. WASM function call:
       Calls exported Rust/AS function with pointer + length args
       WASM executes natively (faer, rustfft, statrs, libm as needed)
  4. Result read-back:
       copyFromWasm(ptr, length) reads result Float64Array from WASM memory
  5. Memory free:
       free(ptr) returns memory to the pool
  6. On any failure (WASM unavailable, OOM, runtime trap):
       Falls back to JSBackend transparently
       Error is logged but not re-thrown
  7. Returns result as DenseMatrix to caller
```

Backend selected by `MATHTS_WASM_BACKEND` environment variable:

| Value | Behavior |
|-------|----------|
| `rust` | Force Rust WASM backend |
| `assemblyscript` | Force AssemblyScript WASM backend |
| `auto` (default) | Prefer Rust; fall back to AS if unavailable |
| `none` | Disable WASM, use JS only |

---

## 4. Factory Activation Flow

```text
import { math } from '@danielsimonjr/mathts-core'
math.add(a, b)
  1. FunctionRegistry.resolve('add')
     - Looks up registered factory by name
  2. createFactory(name, dependencies, factory):
     - Injects resolved dependencies by name
     - Calls factory(deps) to produce implementation
  3. Implementation stored in registry
  4. On call: typed dispatch via mathTyped instance
     - registerNativeTypes() has wired up:
         Complex, Fraction, BigNumber via instanceof
     - Duck-typing is NOT used here (native path only)
  5. Returns typed result

Note: Synced mathjs factories (functions/src/{arithmetic,algebra,...}/) are
dormant — not exported from index.ts and not registered in FunctionRegistry.
They require a separate createTyped instance and a different type hierarchy.
```

---

## 5. Workbook Execution Flow

```text
workbook.mtsw  (YAML file)
  1. parseWorkbook(yaml):
       YAML string -> Workbook object with typed Cell records
  2. buildDependencyGraph(cells):
       Analyzes cell references (e.g. =A1 + B2)
       Builds directed acyclic graph of cell dependencies
  3. detectCycles(graph):
       Validates no circular references exist
  4. topologicalSort(graph):
       Computes execution order respecting all dependencies
  5. WorkbookExecutor.execute(mode):
       reactive:   re-execute all downstream cells on any change
       sequential: execute all cells once in topological order
       manual:     execute only on explicit trigger
  6. Per cell: executeCode(cell.code, context)
       -> STUB: throws "not yet implemented"
       -> Planned: calls expression parser -> evaluator -> result
  7. Results written to cell.output fields
```

**Blocked on**: expression parser evaluator (`compiler/` and `evaluator/` in `@danielsimonjr/mathts-expression` are empty stubs).

---

## 6. Cross-Package Data Flow

```
User Input
    |
    v
typed-function (@danielsimonjr/mathts-core)
    |
    +---> Core Types (Complex / Fraction / BigNumber)
    |
    +---> Matrix (@danielsimonjr/mathts-matrix)
    |         |
    |         +---> MatrixWasmBridge (threshold check)
    |         |         |
    |         |         +---> [>1K elements] WasmLoader --> wasm-rust (Rust/faer/rustfft)
    |         |         |                              or --> assembly (AS, legacy)
    |         |         +---> [<1K or fallback] JSBackend
    |         |
    |         +---> [>100K elements] ComputePool (@danielsimonjr/mathts-parallel)
    |
    +---> Parallel Functions (@danielsimonjr/mathts-functions)
              |
              +---> ComputePool (@danielsimonjr/mathts-parallel)

@danielsimonjr/mathts-compat --> typed-function

@danielsimonjr/mathts-workbook --(executeCode stub)--> @danielsimonjr/mathts-expression
                                               |
                                         (not yet wired)
                                               |
                                         typed-function
```

---

## 7. Configuration Flow

| Config Object | Consumer | Effect |
|---------------|----------|--------|
| `MatrixConfig` | `BackendManager` | Backend selection thresholds |
| `ComputePoolConfig` | `ComputePool` | Worker count, task queue size |
| `WorkbookConfig` | `WorkbookExecutor` | Execution mode, reactivity |
| `BackendPreference` | `BackendManager` | Override automatic backend order |
| `ProfilingConfig` | `BackendManager` | Enable runtime execution timing |
| `AdaptiveTuningConfig` | `BackendManager` | Auto-adjust WASM/GPU thresholds |
| `BigNumber.config()` | `BigNumber` | Decimal precision, rounding mode |

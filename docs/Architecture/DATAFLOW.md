# MathTS Data Flow

**Generated**: 2026-05-22

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

| Backend           | Threshold      | Key Ops                                      |
| ----------------- | -------------- | -------------------------------------------- |
| `JSBackend`       | Default        | All ops, pure TypeScript, Float64Array       |
| `WASMBackend`     | >1K elements   | SIMD multiply, LU/QR/Cholesky, eigenvalues   |
| `GPUBackend`      | >100K elements | WebGPU matmul, transpose, scale, elementwise |
| `ParallelBackend` | Configurable   | WebWorker-backed elementwise + matmul        |

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

| Value            | Behavior                                    |
| ---------------- | ------------------------------------------- |
| `rust`           | Force Rust WASM backend                     |
| `assemblyscript` | Force AssemblyScript WASM backend           |
| `auto` (default) | Prefer Rust; fall back to AS if unavailable |
| `none`           | Disable WASM, use JS only                   |

---

## 3c. New Function Category Data Flows

### Integration Functions

Integration functions (`trapz`, `simpson`, `gaussQuad`, `romberg`) accept a callback and numeric bounds:

```text
gaussQuad(f, a, b, n)   // f: (x: number) => number
  1. Validate bounds [a, b] and sample count n
  2. Compute Gauss-Legendre nodes and weights for n-point rule
  3. Transform [a, b] -> [-1, 1] via linear map
  4. Evaluate callback f at each node (synchronous, no parallelization)
  5. Accumulate weighted sum
  6. Returns number (definite integral approximation)

romberg(f, a, b, tol)  // adaptive, recursive refinement
  1. Build Richardson extrapolation table via trapz calls at increasing resolution
  2. Terminate when successive estimates converge within tol
  3. Returns number
```

Key difference from array functions: **no parallel execution** — callback evaluation is inherently sequential.

### Interpolation Functions

Interpolation functions return **interpolant functions** rather than single values:

```text
cubicSpline(xs, ys)      // xs: number[], ys: number[]
  1. Validate: xs must be sorted, xs.length === ys.length
  2. Build tridiagonal system for natural cubic spline coefficients
  3. Solve for second derivatives (Thomas algorithm)
  4. Returns (x: number) => number  // callable interpolant
```

```text
const interp = cubicSpline([0, 1, 2], [0, 1, 4]);
const y = interp(1.5);  // evaluates spline at x=1.5
```

`lagrangeInterp` and `hermiteInterp` follow the same factory pattern (input points → output function).
`polyFit` returns a polynomial coefficient array, not a function.

### Distribution Functions

Distribution functions take distribution parameters and return a single numeric value:

```text
normalPDF(x, mu, sigma)
  1. Validate sigma > 0
  2. Compute (1 / (sigma * sqrt(2*pi))) * exp(-0.5 * ((x - mu) / sigma)^2)
  3. Returns number

normalCDF(x, mu, sigma)
  1. Normalize: z = (x - mu) / sigma
  2. Compute 0.5 * (1 + erf(z / sqrt(2)))  [uses erfc internally]
  3. Returns number in [0, 1]
```

All distribution functions are **purely synchronous** — no array chunking, no worker dispatch.
They are suitable as building blocks for Monte Carlo sampling loops.

### Special Functions

Special functions (`erfc`, `beta`, `gammainc`, `digamma`, `besselJ0/1/Y0/Y1`,
`airyAi/Bi`, `ellipticK/E/F/Pi`, `carlsonR*`, `lgamma`) have a synchronous
**scalar** path and a **`Float64Array` array** path that routes to WASM above
the element threshold:

```text
besselJ0(x: number)                     // scalar — synchronous, number -> number
  1. |x| <= 13: ascending power series   (J0 = sum (-1)^k (x^2/4)^k/(k!)^2)
  2. |x| > 13:  Hankel asymptotic expansion (coefficients generated in-loop)
  3. Returns number  (validated <1e-9 vs mpmath)

besselJ0(xs: Float64Array)               // array overload
  1. xs.length < 1024 (WASM_SPECIAL_THRESHOLD): map the scalar over the array (JS)
  2. xs.length >= 1024: dispatch to the WASM kernel
       Rust (bessel_j0_f64) -> AssemblyScript (bessel_j0_f64_as) -> JS fallback
     The `functions` package bundles the Rust wasm (dist/wasm/mathts.wasm) and
     resolves it package-relative, so this path is live (not a JS fallback).
```

The scalar path has no side effects, no shared state, no async dispatch. The
array path returns a `Promise`. All WASM and JS paths agree to <1e-9 (the
kernels share the same series + Hankel / generated-asymptotic algorithms; see
`docs/Architecture/WASM_ACCELERATION.md`).

### Combinatorics Functions

Combinatorics functions (`fibonacci`, `lucas`, etc.) operate on non-negative integers:

```text
fibonacci(n)
  1. Validate: n must be a non-negative integer
  2. For n <= 70: lookup table or iterative O(n)
  3. Returns number (or BigInt for large n if configured)

subfactorial(n)
  1. Compute D(n) = (n-1) * (D(n-1) + D(n-2))  with D(0)=1, D(1)=0
  2. Returns number
```

### Geometry Functions

Geometry functions operate on `number[]` tuples (2D or 3D vectors):

```text
convexHull(points)       // points: [number, number][]
  1. Sort points lexicographically
  2. Graham scan to build lower and upper hulls
  3. Returns [number, number][] (hull vertices in CCW order)

pointInPolygon(pt, polygon)
  1. Ray casting algorithm: count crossings of horizontal ray from pt
  2. Returns boolean
```

Vector operations (`angle2D`, `cross3D`, `dot3D`, `rotateVector2D`, etc.) are
**O(1) synchronous scalar/vector functions** with no backend selection or parallelization.

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
       -> calls evaluate() from @danielsimonjr/mathts-functions
       -> expression parser -> compiler -> evaluator -> result
  7. Results written to cell.output fields
```

The expression evaluator (`compiler/` and `evaluator/` in
`@danielsimonjr/mathts-expression`) is fully functional, so workbook cell
execution works end-to-end.

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
    +---> Tensor (@danielsimonjr/mathts-tensor)
    |         |
    |         +---> Autograd (@danielsimonjr/mathts-autograd)
    |                   forward-mode (DualTensor) + reverse-mode (Tape)
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
    |         |
    |         +---> ComputePool (@danielsimonjr/mathts-parallel)
    |
    +---> Scalar Functions (@danielsimonjr/mathts-functions)
              |
              +---> special / distributions / combinatorics: synchronous scalar ops
              +---> integration: callback evaluation (synchronous)
              +---> interpolation: returns interpolant function (lazy evaluation)
              +---> geometry: synchronous vector/polygon ops

@danielsimonjr/mathts-compat --> typed-function

@danielsimonjr/mathts-workbook --(executeCode -> evaluate)--> @danielsimonjr/mathts-functions
                                               |
                                  @danielsimonjr/mathts-expression
                                  (parser -> compiler -> evaluator)
```

---

## 7. Configuration Flow

| Config Object          | Consumer           | Effect                           |
| ---------------------- | ------------------ | -------------------------------- |
| `MatrixConfig`         | `BackendManager`   | Backend selection thresholds     |
| `ComputePoolConfig`    | `ComputePool`      | Worker count, task queue size    |
| `WorkbookConfig`       | `WorkbookExecutor` | Execution mode, reactivity       |
| `BackendPreference`    | `BackendManager`   | Override automatic backend order |
| `ProfilingConfig`      | `BackendManager`   | Enable runtime execution timing  |
| `AdaptiveTuningConfig` | `BackendManager`   | Auto-adjust WASM/GPU thresholds  |
| `BigNumber.config()`   | `BigNumber`        | Decimal precision, rounding mode |

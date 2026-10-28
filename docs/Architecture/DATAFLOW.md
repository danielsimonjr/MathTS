# MathTS Data Flow

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

## 1b. ScalarNode compile and Pareto selection (PySR)

```text
ScalarNode tree (expression scalar-structure toolkit)
  → scalarToNode (functions/scalar-node-bridge.ts) → expression Node → simplify / toTex → nodeToScalar
  → compileScalar / compileScalarGradient (functions/scalar-compile.ts): one register tape,
    column Float64Array bindings; gradient adds one lane per fitted parameter
  → fitScalarParameters (functions/fit-scalar.ts): freeze included rows at the start,
    compileScalarGradient residuals → levenbergMarquardt / bfgs / nelderMead → l2 SE from JᵀJ
  → CompiledScalar.evaluate(rows): per-row valid mask (no typed dispatch per row)
  → optional paretoFront / scoreFront / selectFrontModel on { loss, complexity, item } rows
  → numericallyEquivalent (functions/numeric-equivalence.ts): SeededRng.next samples → compileScalar on both trees → nearlyEqual per valid row (consistent is evidence, not proof)
```

`compileScalar` does not use `eval` / `new Function` and does not load WASM.

---

## 1c. Seeded RNG streams (M5)

```text
createSeededRng(seed) → private Mulberry32 state (mulberry32)
  next / nextInt / normal (boxMuller + per-instance spare)
  fork(label) → child createSeededRng(FNV-1a(parent seed bytes + label)); parent unchanged
```

`randomTensor`, hypothesis bootstrap, `sampleN`, and graph restarts still call `mulberry32`
directly (pinned fixtures). `seedProbabilityRng` / `createRng` remain seedrandom.

---

## 2. Matrix Backend Selection Flow

```text
DenseMatrix.multiply(other) uses arithmetic.multiply (JS ikj). It does not
call BackendManager. Public lu / qr / cholesky are also JS (operations/*).

backendManager.multiply(a, b)   // WASM GEMM path after initialize()
  1. elementCount = a.rows * b.cols * a.cols, then
     selectBackend(elementCount, 'multiply') — not rows * cols alone.
  2. Registered backends are js + wasm only (no 'gpu' in backendRegistry):
       multiply: WASM when elementCount >= 256 (operation threshold), else JS
       transpose: BackendManager still stores transpose: { wasm: 2000 }, but
       WASMBackend.transpose always delegates to JS (WASMBackend.ts)
       default wasm hint 1000 for ops with no per-op entry; WASMBackend
       minElements 100 for decomposition kernels
  3. GPUBackend thresholds in BackendManager are dormant. Explicit exports
     (`gpuMatmul`, `gpuAdd`, `gpuTranspose`, `gpuScale`) call gpuMatrixBackend
     directly (minElements 65,536) and do not require enableGpu(). enableGpu()
     gates implicit fused GPU paths in functions/src/gpu/ (element-wise, FFT).
  4. executeWithFallback(op, backend):
       - Tries selected backend
       - On failure or unavailability, falls back to next lower backend
       - Final fallback: JSBackend (always succeeds)
  5. Adaptive tuning (if enabled):
       - maybeAdjustThresholds() samples execution time per operation
       - recordSample() updates rolling performance stats
       - getAdaptiveThresholds() returns current dynamic cutoffs
  6. Returns result as DenseMatrix
```

| Backend         | Threshold                                                              | Key Ops                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `JSBackend`     | Default                                                                | All ops, pure TypeScript, Float64Array                                                                                                                             |
| `WASMBackend`   | Manager multiply ≥256 flop count (`config.ts`); public decomp stays JS | SIMD matmul via manager; LU/QR/Cholesky/inverse/det on `WASMBackend` only for direct callers                                                                       |
| WebGPU (opt-in) | f32, per kernel                                                        | Explicit `gpuMatmul` et al. (65,536); fused ops after `enableGpu()` at `GPU_MIN_ELEMENTS` 65,536; GPU FFT at 262,144 (`FFT_GPU_MIN_ELEMENTS`) — not BackendManager |
| `ComputePool`   | Per-op map                                                             | `matmul` at 4,096; most element-wise ops `'never'`; global fallback 50,000                                                                                         |

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
  3. ComputePool dispatches via the op-specific method (`elementwise`, `matmul`, …):
       - `shouldParallelize(n, op)` consults `thresholdByOp` (defaults in
         `DEFAULT_THRESHOLD_BY_OP`)
       - Distributes chunks to Web Workers via postMessage when parallel
       - Transfers ownership of TypedArrays (zero-copy) where supported
  4. Collect and merge results:
       - mergeFloat64Chunks(results) reassembles output array
  5. Returns ParallelResult<Float64Array>:
       { result, duration, chunks, parallelized }
```

Statistics and signal functions (`@danielsimonjr/mathts-functions`) follow the same path:
array overloads call `@danielsimonjr/mathts-parallel` internally and return `Promise<ParallelResult<T>>`.
Variadic overloads (2–4 scalars) are synchronous.

The flow above is the general mechanism; **whether a given op actually reaches
step 2** depends on its per-op threshold in `DEFAULT_THRESHOLD_BY_OP`. Memory-bound
element-wise ops (`add`, `multiply`, `exp`, `sin`, …), `dot` / `distance`, and the
bitwise family (`bitAnd`, `bitOr`, `bitXor`, shifts) are set to `'never'`, so step 1
always takes the synchronous branch for them today. Those ComputePool methods pass
the op string into `shouldParallelize(n, op)` — a nameless `shouldParallelize(n)`
would ignore the map and use the global 50,000. The generated
[`parallel-pairing.md`](./parallel-pairing.md) is the authoritative, always-current
map of which functions are effectively parallelized vs threshold-disabled, and each
op's threshold.

Generic `MathWorkerPool.map` / `filter` share one `runChunks` helper. Below the
pool threshold they call `Array#map` / `Array#filter`. Above it they dispatch
`mapChunk` / `filterChunk` with `fn.toString()` and concatenate `Promise.all`
results in chunk order. Typed-array kernels still chunk with `slice()` (not
`subarray()`), so each worker owns its buffer region.

---

## 3b. WASM Bridge Interception Flow

When the WASM backend is active (`mathts-as.wasm` loaded, operation size above
threshold), the matrix backend flow is extended:

```text
typed-function dispatch -> WASMBackend (matrix/src/backends/WASMBackend.ts)
  1. Threshold check:
       element_count < threshold  -> skip to JSBackend immediately
       element_count >= threshold -> proceed to WASM path
  2. Memory allocation (WasmLoader, AssemblyScript managed allocator):
       __new(byteLength) reserves space in the WASM linear memory pool
       Input Float64Arrays written to WASM memory via copyToWasm()
  3. WASM function call:
       Calls the exported AssemblyScript function with header pointer + length args
       WASM executes natively (AssemblyScript-compiled kernels, SIMD where available)
  4. Result read-back:
       copyFromWasm(ptr, length) reads result Float64Array from WASM memory
  5. Memory free:
       the pinned allocation is released back to the pool
  6. On any failure (WASM unavailable, OOM, runtime trap):
       Falls back to JSBackend transparently
       Error is logged but not re-thrown
  7. Returns result as DenseMatrix to caller
```

AssemblyScript is the sole WASM backend, so dispatch is simply **AS → JS
fallback** with no backend choice.

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
`chebyshevFit` and `legendreFit` (JS path, below `WASM_POLY_FIT_THRESHOLD`) build
normal equations in their own basis recurrences, then share
`solveAugmentedNormalEquations` (partial pivot, `|pivot| < 1e-14` throws a
wrapper-specific rank-deficient error). The poly WASM JS fallback uses the same
solver and returns `null` instead of throwing.

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
`airyAi/Bi`, `ellipticK/E/F/Pi`, `carlsonR*`, `lgamma`, plus niche `struveH` /
`struveL` / `kelvinBer` / `kelvinBei`) are synchronous scalars
on the public surface. Struve H/L share one power series (`ratioSign` −1 vs +1)
and keep their own `z < 0` error text. Kelvin ber/bei share one recurrence
(`term0` and `denom(k)`). Nothing in `functions` loads WASM until `loadWasm()`;
`functions/src/wasm/policy.ts` keeps most bridges on JS (no Bessel band — Bessel
stays JS; `lgamma_f64` only for `n >= 1048576`). `normalCDF` still uses `erfc`
(`normalCDFScalar` in `functions/src/wasm/special/scalars.ts`). Canonical
log-gamma is `_lgamma` in that file (reflection uses `abs(sin)`). See
`docs/Architecture/WASM_ACCELERATION.md` for measured dispatch tiers.

### Combinatorics Functions

Combinatorics functions (`fibonacci`, `lucas`, etc.) operate on non-negative integers:

```text
fibonacci(n)
  1. Validate: n must be a non-negative integer
     (error: "fibonacci requires a non-negative integer")
  2. n = 0 → 0; n = 1 → 1
  3. Else fast doubling via fibPair(n) → [F(n), F(n+1)]; return F(n)
  4. Returns a JS number (IEEE-754; not BigInt)

lucas(n)
  1. Validate: n must be a non-negative integer
     (error: "lucas requires a non-negative integer")
  2. n = 0 → 2; n = 1 → 1 (direct; not routed through fibPair)
  3. Else L(n) = 2·F(n+1) − F(n) from fibPair(n)

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

Note: The valuable synced mathjs factories (functions/src/{arithmetic,algebra,
type,utils,...}/) are **activated** — wired into the live graph via
functions/src/factories/index.ts (re-exported from index.ts) and registered
through the factory path. The dormant, unreachable synced remnant is no longer in
the tree (see CLAUDE.md's "Syncing from mathjs" section).
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
    |         +---> WASMBackend (threshold check)
    |         |         |
    |         |         +---> WASM when per-op threshold met --> WasmLoader --> assembly
    |         |               (element-wise add/sub/mul/div/min/max stay JS;
    |         |                AS f64-buffer helpers back unused wasm export wrappers)
    |         |         +---> else JSBackend (fallback always available)
    |         |
    |         +---> (ComputePool is separate — per-op thresholds, not size ≥100K)
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

## Verification

`repo-tools map` generates these values.
Regenerate: `repo-tools map . --out=<dir>` · Check: `repo-tools check . --docs=docs/Architecture`

> **No table here claims a reachability count.** The tables give size, structure and cycle counts only.
> `FILE_INVENTORY.md` and `unused-analysis.md` in this directory give the reachability figures. The
> repository generator writes them (`npm run docs:deps:full`), and the gate does not check them.

| Claim                | Value | Source                                                                                                       |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------ |
| totalTypeScriptFiles | 2058  | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |
| totalModules         | 5     | `repo-tools map . --out=<tmp>`, `statistics` of its dependency-graph.json; `repo-tools check` fails on drift |

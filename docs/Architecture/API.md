# MathTS API Reference

**Last updated**: 2026-07-18

Hand-maintained aggregate API reference for all 24 workspace packages. Signatures
below are verified against the built `dist/*.d.ts` declarations (or, for the
AssemblyScript `assembly/` package, against `src/index.ts` + the loader
bindings). Per-package deep-dives live in `docs/api/<pkg>.md`; this file is the
cross-package overview.

Package versions (from each `package.json`, tracked independently): core 0.13.0,
matrix 0.6.3, tensor 0.2.17, autograd 0.3.12, parallel 0.6.3, gpu 0.2.0,
functions 0.43.2, expression 0.6.7, workbook 0.3.3, compat 0.4.0, plot 0.3.29,
typed-function 0.1.2, workerpool 0.2.1, assembly (wasm) 0.2.2.

---

## @danielsimonjr/mathts-typed-function

Fork of `typed-function`, re-exported and extended with MathTS-specific
type-test/conversion/signature helpers. This is the low-level runtime dispatch
layer everything else builds on; end users normally use `core`'s pre-configured
`mathTyped` instead of this package directly. No matrix/GPU/WASM dependency.

**Re-exports from `typed-function`**: `TypedFunction`, `create`, `typed` (default export).

| Symbol                                                                              | Description                                                                                                                                     |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `TYPED_FUNCTION_TYPE`                                                               | `unique symbol` used to tag classes (`class Foo { [TYPED_FUNCTION_TYPE] = 'Foo' }`) so type identity survives minification/bundling/cross-realm |
| `parseSignature(signature)`                                                         | Splits a signature string (`"number, number"`) into type names                                                                                  |
| `buildSignature(...types)`                                                          | Joins type names into a signature string                                                                                                        |
| `createSymbolTypeTest(typeName)`                                                    | Symbol-based type test (most bundler-resilient)                                                                                                 |
| `createRobustTypeTest(typeName, instanceProp, protoProp?)`                          | 3-tier test: symbol → instance property → prototype chain                                                                                       |
| `createRobustSubtypeTest(typeName, instanceProp, parentProp)`                       | Subtype check (e.g. `DenseMatrix` is-a `Matrix`)                                                                                                |
| `createSafeConversion(TargetClass, transform?)`                                     | Wraps a class constructor so `typed.addConversion` can safely call it under `new` (ES6 classes reject call-without-`new`)                       |
| `createSafeConversionDef(from, to, TargetClass, transform?)`                        | Builds a `ConversionDef` around `createSafeConversion`                                                                                          |
| `createSymbolTypeDef(name)` / `createRobustTypeDef(name, instanceProp, protoProp?)` | Build `TypeDef`s                                                                                                                                |

**Type guards** (all `(x: unknown) => x is T`): `isNumber`, `isBoolean`, `isString`,
`isBigInt`, `isArray`, `isFunction`, `isObject`, `isNull`, `isUndefined`,
`isNullOrUndefined`, `isFiniteNumber`, `isInteger`, `isPositiveInteger`,
`isNonNegativeInteger`, `isNaN`, `isTypedArray`, `isFloat64Array`,
`isFloat32Array`, `isInt32Array`, `isUint32Array`, `isArrayBuffer`.

**Errors**: `NoMatchingSignatureError` (`functionName`, `actualTypes`,
`availableSignatures`), `TypeConversionError` (`fromType`, `toType`, `originalError?`).

**Key types**: `TypeDef {name, test}`, `ExtendedTypeDef extends TypeDef {factory?}`,
`ConversionDef {from, to, convert}`, `SignatureMap<T>`, `TypeTest<T>`, `TypeConverter<From, To>`.

---

## @danielsimonjr/mathts-workerpool

Fork of `workerpool` wrapped with a MathTS-specific `MathWorkerPool` offering
automatic parallelization, zero-copy transfer helpers, and WASM-accelerated
task-queue support. Consumed by `parallel`'s `ComputePool`.

**Re-exports from `workerpool`**: `ExecOptions`, `Pool`, `PoolOptions`, `PoolStats`, `Transfer`.

### `class MathWorkerPool`

| Member                                            | Description                                                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `constructor(config?: Partial<WorkerPoolConfig>)` |                                                                                       |
| `ready: Promise<void>`                            | Resolves once workers are spawned (useful with `eagerInit: true`)                     |
| `initialize()` / `isReady()` / `warmup(count?)`   | Lifecycle; `warmup` pre-executes a trivial task per worker to kill cold-start latency |
| `getConfig()` / `updateConfig(config)`            |                                                                                       |
| `shouldParallelize(elementCount, options?)`       | Threshold check                                                                       |
| `stats()` / `enhancedStats()` / `resetMetrics()`  | `enhancedStats` adds `PoolMetrics`                                                    |
| `exec<T>(method, params, options?)`               | Run a registered worker method                                                        |
| `execFunction<T,R>(fn, arg, options?)`            | Run a serialized function                                                             |
| `terminate(force?)` / `clear()`                   |                                                                                       |

**Numeric kernels** (all `Promise<ParallelResult<...>>`, auto-chunked above
threshold): `sum`, `prod`, `dot(a,b)`, `elementwise(a,b,op)`
(`'add'|'subtract'|'multiply'|'divide'`), `scale(data,scalar)`,
`bitwiseBinary`/`bitwiseScalar`/`bitwiseNot` (Int32Array), `matmul`, `transpose`,
`minMax`, `variance` (Welford), `norm`, `distance`, `unary(data, fn)`
(`'abs'|'sqrt'|'exp'|'log'|'sin'|'cos'|'tan'|'negate'|'square'`),
`applyKernel`/`applyKernel2` (caller-supplied self-contained eval'd expressions),
`fftBatch`, `distanceMatrix`, `histogram`, `matvec`, `outer`, `find`, `sort`,
`map`, `reduce`, `filter`.

**Module-level**: `mathWorkerPool` (global instance), `initializePool(config?)`,
`terminatePool(force?)`, `getPoolStats()`.

**Capability / transfer helpers**: `canUseWasm()`, `canUseSharedMemory()`,
`transferFloat64`, `transferArrayBuffer`, `transferTypedArray`,
`createSharedFloat64Array`, `createSharedBuffer`, `isSharedBuffer`, `getCapabilities()`.

**WASM task-queue**: `initWorkerWasm()`, `isWorkerWasmAvailable()`, `getWasmFeatures()`.

**Key types**: `WorkerPoolConfig`, `ParallelResult<T>` (`result`, `duration`,
`chunks`, `parallelized`, `workersUsed`), `PoolMetrics`, `EnhancedPoolStats`,
`TaskOptions`, `WorkerpoolCapabilities`, `WasmFeatureStatus`. Constant:
`DEFAULT_WORKER_CONFIG`.

---

## @danielsimonjr/mathts-core

Central numeric-type + typed-dispatch + factory foundation every other package
builds on. Depends only on `typed-function`. Note: the `VERSION` constant baked
into `dist` reads `"0.1.0"` and is stale versus `package.json`'s `0.13.0` — do not
treat `VERSION` as authoritative.

### Numeric Types

| Type                    | Backing                                            | Notes                                                                                                                        |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Complex`               | `re`/`im: number`                                  | Full trig/hyperbolic/transcendental; `acosh` uses the factored `√(z-1)·√(z+1)` form for correct branch cuts (C99/DLMF/NumPy) |
| `Fraction`              | `numerator`/`denominator: bigint` (always reduced) | Exact rational arithmetic + comparison + rounding + continued fractions                                                      |
| `BigNumber`             | `sign · coefficient · 10^exponent` (bigint coeff)  | Arbitrary-precision decimal; **private constructor** — use `fromNumber`/`parse`/`fromBigInt`/`fromJSON`                      |
| `Dual`                  | `value`/`deriv: number`                            | Forward-mode dual number for autodiff                                                                                        |
| `Unit` / `UnitInstance` | merged mathjs-lineage Unit                         | The single Unit class post the 2026-07-04 merge                                                                              |
| `Range`                 | `start`/`end`/`step: number`                       | Lazy numeric range                                                                                                           |

**`Complex`** — statics `fromPolar`, `fromNumber`, `fromJSON`, `parse` (`"3+4i"`,
`"-i"`, …), `compare`. Instance: `add`/`subtract`/`multiply`/`divide` (+ `sub`/`mul`/`div`
aliases), `neg`/`negate`, `inverse`, `conjugate`, `abs`, `arg`, `abs2`, `sqrt`,
`nthRoot(n)`, `nthRoots(n): Complex[]`, `exp`, `log`/`log10`/`log2`, `pow(n)`,
full trig/hyperbolic/inverse set (~20 methods, `sin`…`atanh`), `equals(other, epsilon?)`,
`isReal`/`isImaginary`/`isZero`/`isNaN`/`isInfinite`, `round`/`floor`/`ceil`/`sign`,
`toPolar`, `format`, `clone`. Guard `isComplex`. Constants `I`, `COMPLEX_ZERO`/`ONE`/`NEG_ONE`.

**`Fraction`** — statics `fromNumber(n, maxDenominator?)`, `fromDecimalString`,
`parse` (`"3/4"`, `"0.(3)"`), `fromJSON`, `compare`, `fromContinuedFraction`.
Instance: arithmetic (`add`/`subtract`/`multiply`/`divide` + aliases, `pow`, `mod`,
`gcd`), `negate`/`abs`/`inverse`, comparison (`equals`/`lessThan`/`lessThanOrEqual`/
`greaterThan`/`greaterThanOrEqual`/`compareTo`/`compare`), `floor`/`ceil`/`round`/`trunc`/`sign`,
predicates (`isZero`/`isPositive`/`isNegative`/`isInteger`/`isUnit`), `toDecimal(precision?)`,
`toLatex`, `toMixed`, `toContinuedFraction`, `mediant(other)`, `simplify`, `clone`.
Guard `isFraction`. Constants `FRACTION_ZERO`/`ONE`/`NEG_ONE`/`HALF`/`THIRD`/`QUARTER`.

**`BigNumber`** — statics `fromNumber`, `parse`, `fromBigInt`, `fromJSON`,
`config(newConfig?)` (global precision/rounding/exponent bounds), `resetConfig`,
`compare`. Arithmetic (accepts `BigNumber|number|string`): `add`, `subtract`/`sub`,
`multiply`/`mul`/`times`, `divide`/`div`, `negate`, `abs`, `pow`, `sqrt`, `mod`,
`hypot`. Comparison: `equals`, `lessThan`, `lessThanOrEqual`, `greaterThan`,
`greaterThanOrEqual`, `compareTo`, `compare`, `gt`. Rounding: `round(dp?, mode?)`,
`roundToPrecision`, `floor`/`ceil`/`trunc`, `toSignificantDigits`. Transcendental:
`exp`, `ln` (AGM method), `log10`/`log2`, `cbrt`, `expm1`/`log1p`, full trig/hyperbolic/inverse
(Taylor + argument reduction). Conversion: `toNumber`, `toFixed`, `toExponential`,
`toPrecision`, `toBigInt`, `toBinary`/`toOctal`/`toHexadecimal`. Getter `e`
(decimal exponent). Guard `isBigNumber`. Constants `BIGNUMBER_ZERO`/`ONE`/`NEG_ONE`/
`TEN`/`PI`/`E`/`LN2`/`LN10`. Type `RoundingMode`
(`'up'|'down'|'ceil'|'floor'|'halfUp'|'halfDown'|'halfEven'|'halfCeil'|'halfFloor'`).
This is a bigint-backed BigNumber, **not** decimal.js-named — use `add`/`sub`/
`lessThanOrEqual`/`equals`/`compareTo`, not `plus`/`minus`/`lte`/`eq`/`cmp`.

**`Dual`** — statics `constant(v)`, `variable(v)` (seed with deriv 1). Instance:
`add`/`sub`/`mul`/`div`, `neg`, `powConst(k)`, `pow(o)`, elementary set
(`sin`/`cos`/`tan`/`exp`/`log`/`sqrt`/`square`/`abs`/`sinh`/`cosh`/`tanh`). Guard
`isDual`. **`DUAL_UNARY_RULES`** — canonical chain-rule table for 23 functions
(the single source of truth shared by `Dual` and autograd's `DualTensor`, so
neither reimplements derivatives). Types `DualUnaryRule`, `DualUnaryRuleName`.

**`Unit` / `UnitInstance`** — arithmetic is **operator-level, not method-chained**
(`u1/u2` same-dimension → a plain number); use `equalBase` (not `dimensionsEqual`);
`dimensions` is a flat 9-element number array; temperature offsets apply in `.to()`
(`.value` stays raw). Instance methods: `clone`, `hasBase`, `equalBase`, `equals`,
`multiply`, `divide`, `divideInto`, `pow`, `abs`, `to`, `toNumber`/`toNumeric`,
`simplify`, `toSI`, `formatUnits`, `toBest(unitList?, options?)`, `format`,
`splitUnit`, `toString`/`toJSON`/`valueOf`. Static `UnitConstructor`: `new (value?, valuelessUnit?)`,
`parse`, `isValuelessUnit`, `fromJSON`, `createUnit`, `createUnitSingle`. Guards
`isUnit`/`isUnitValue`. Lower-level dimensional layer: `Dimensions` (7 SI base dims),
`DIMENSIONLESS`, `dim(partial)`, `UnitDef`, registries `BASE_UNITS`/`DERIVED_UNITS`/
`ALL_UNITS`, `UNIT_ALIASES`, `getUnitDef`, `SI_PREFIXES`, `BEST_PREFIXES`, `getPrefix`.
Errors `UnitParseError`, `DimensionMismatchError`.

**`Range`** — `new Range(start?, end?, step?)`; `clone`, `size`, `min`/`max`,
`forEach`, `map`, `toArray`/`valueOf`, `format` (`'start:step:end'`), `toString`/`toJSON`.
Statics `parse`, `fromJSON`. Underlying `createRangeClass` factory exported for DI.

### Type Guards

```
isComplex   isFraction   isBigNumber   isNumber   isString   isBoolean
isBigInt    isArray      isFunction    isObject   isNull     isUndefined
isMatrix    isDenseMatrix  isSparseMatrix   isUnit
```

### Typed Function System

| Symbol                                                  | Description                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `mathTyped: MathTSTyped`                                | Default pre-configured typed-function instance; call as `mathTyped('name', { 'number, number': (a,b)=>…, 'Complex, Complex': … })` |
| `createMathTSTyped()`                                   | Fresh isolated typed universe with MathTS types/conversions                                                                        |
| `TypeRegistry`                                          | Builder: `registerType`, `registerConversion`, `hasType`, `hasConversion`, `getTypeNames`, `build()`, `clear()`                    |
| `MATHTS_TYPES` / `MATHTS_CONVERSIONS`                   | Registered type/conversion tables (auto-register WASM type masks when available)                                                   |
| `createTypedFunction(name, signatures, typedInstance?)` | One-off typed function without the registry                                                                                        |
| `registerNativeTypes()`                                 |                                                                                                                                    |
| `initTypedWasm(options?)` / `isTypedWasmAvailable()`    |                                                                                                                                    |

`MathTSTyped` accepts concrete-parameter implementations via the
`SignatureImpl = (...args: never[]) => unknown` top-type — the workaround for
`strictFunctionTypes` contravariance behind the 2026-06-27 `functions` strict flip.

### Factory System

| Symbol                               | Description                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `FunctionRegistry`                   | `register`, `registerAll`, `get(name)`, `has`, `names()`, `updateConfig`, `getConfig`                                                 |
| `createFactory(name, deps, factory)` | Register a named function factory                                                                                                     |
| `registry`                           | Default global registry                                                                                                               |
| `math`                               | Thin convenience wrapper (`get`/`register`/`config`/`configure`) over `registry`                                                      |
| `DEFAULT_CONFIG`                     | `{precision, matrix, number, randomSeed, epsilon, preferredBackend, wasmThreshold, gpuThreshold, parallelEnabled, parallelThreshold}` |

Types: `FactoryFunction<T>`, `FactoryDependencies`, `FactoryImport`, `MathTSConfig`.

### Numerically-stable reduction primitives

Added to fix a measured ~46,000× accuracy gap vs NumPy: `pairwiseSum` (NumPy
`np.sum` cascade), `neumaierSum` (Python `math.fsum` equivalent, opt-in),
`norm2` (BLAS `dnrm2` overflow-safe Euclidean norm), `pairwiseDot`,
`scaledDistance`, `sumSquaredDeviations` (corrected two-pass variance numerator),
`neumaierCumsum(xs, out)` (in-place compensated cumsum).

### Scalar dispatch helpers & constants

`addScalar`, `subtractScalar`, `multiplyScalar`, `divideScalar`, `pow`, `abs`,
`fix`, `round`, `equal(x, y, relTol?, absTol?)`, `isNumeric` (excludes `Complex`),
`number(x)` (throws on non-real Complex). Type `NumericScalar`. Named `number`
constants: `PI`, `E`, `TAU`, `PHI`, `SQRT2`, `SQRT1_2`, `LN2`, `LN10`, `LOG2E`, `LOG10E`.

### `@danielsimonjr/mathts-core/internal` subpath

mathjs-lineage low-level utilities NOT on the main surface but consumed
cross-package (per the "all libraries build on core" rule): factory plumbing
(`factory`, `sortFactories`, `create`, `isFactory`, `assertDependencies`),
extra guards (`isCollection`, `isRange`, `isIndex`, `typeOf`, …), number
formatting (`format`, `toExponential`, `toPrecision`, `splitNumber`, `nearlyEqual`,
…), portability math (`sign`, `log2`, `cbrt`, `expm1`, `acosh`, …), object/array
utilities (`clone`, `memoize`, `deepStrictEqual`, `arraySize`, `resize`, `reshape`,
`broadcastTo`, `deepMap`, `reduce`, …), map wrappers (`ObjectWrappingMap`,
`PartitionedMap`), error classes (`MathjsError`, `DimensionError`, `IndexError`),
and unit factory internals.

**WASM integrity helpers** (JS side of the SHA-384 manifest security invariant),
in `core/src/wasm-loader.ts` and surfaced via `core/internal`:
`sha384OfBuffer(buffer)`, `verifyWasmIntegrity(buffer, wasmPath, options?)`,
`loadWasmManifest(wasmPath)`, `resolvePackagedWasm(metaUrl, wasmFile)`,
`defaultWasmLocation(metaUrl, wasmFile, opts?)`. Types `WasmManifest`, `LoadingMetrics`.

---

## @danielsimonjr/mathts-matrix

DenseMatrix/SparseMatrix implementations with a pluggable JS/WASM/GPU/Parallel
backend system plus the standalone dense-matrix decomposition primitives the rest
of the monorepo routes through. Depends on `core`, `parallel`, and `gpu`.

### Matrix Types

| Type                                  | Description                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Matrix<T>`                           | Abstract base; `type`, `rows`/`cols`, `size`, `isSquare`/`isVector`/…, `get`/`set` (immutable — returns new matrix), `row`/`column`/`slice`/`diagonal`, `add`/`subtract`/`multiplyElementwise`/`multiply`/`scale`/`transpose`, `toArray`/`toFlatArray`, `entries`/`values`, `equals(other, tolerance?)` |
| `DenseMatrix extends Matrix<number>`  | Row-major `Float64Array`-backed; zero-copy row views                                                                                                                                                                                                                                                    |
| `SparseMatrix extends Matrix<number>` | CSR (Compressed Sparse Row) format                                                                                                                                                                                                                                                                      |

`DenseMatrix` statics: `fromArray`, `fromFlat(rows, cols, data)`, `zeros`, `ones`,
`identity(n)`, `diag`, `fill`, `random`. Extras: `sum`/`mean`/`min`/`max`/`norm`/`trace`,
`toFloat64Array`, `toSparse(dropTolerance?)`, `map`/`forEach`, `[Symbol.iterator]`.
`SparseMatrix` statics: `fromDense`, `fromCOO`, `zeros`, `identity`, `diag`; adds
`nnz`/`sparsity`/`density`, `getCSR()`, `allValues`/`mapNonZeros`. Guards
`isMatrix`, `isDenseMatrix`, `isSparseMatrix`.

### Decomposition primitives

Standalone functions (`DenseMatrix → DenseMatrix`), not methods:

| Function                | Result / Notes                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `lu(A)`                 | `LUResult{L,U,P}` — Doolittle w/ partial pivoting                                                                   |
| `qr(A, opts?)`          | `QRResult{Q,R}` — Gram-Schmidt w/ re-orthogonalization; `mode: 'reduced'\|'full'`                                   |
| `cholesky(A)`           | `CholeskyResult{L}` — right-looking, SPD only                                                                       |
| `svd(matrix, options?)` | `SVDResult{U,S,V,rank}` — Golub-Reinsch; plus `singularValues`, `pinv`, `lowRankApprox`, `cond`, `norm2`, `normFro` |
| `eig(matrix, options?)` | `EigResult{values,vectors,vectorsIm,isSymmetric}` — QR w/ implicit shifts; plus `eigvals`, `powerIteration`         |
| `matrixExpm(A)`         | Scaling-and-squaring + Padé-13 (Higham 2005)                                                                        |
| `matrixLogm(A, opts?)`  | Schur-Padé inverse scaling-and-squaring (Higham 2008)                                                               |
| `matrixSqrtm(A, opts?)` | Symmetric-eig (SPD) or Björck-Hammarling / Newton fallback                                                          |
| `matrixSchur(A, opts?)` | `SchurResult{Q,T}` — Householder→Hessenberg + Francis double-shift                                                  |
| `qrPivoted(A, opts?)`   | `QRPivotedResult{Q,R,P,rank}` — Businger-Golub rank-revealing                                                       |
| `lq`/`rq`/`ql(A)`       | Derived from `qr()` via flip/transpose                                                                              |
| `condest(A, p?)`        | Hager/Higham 1-norm condition estimate (O(n²)/iter)                                                                 |
| `pinv(A, opts?)`        | Exported as `matrixPinv` — Moore-Penrose via full SVD + rcond                                                       |

`eigWasm`/`eigvalsWasm`/`spectralRadiusWasm`/`svdWasm` are `Promise`-returning
compat shims that delegate to the sync JS functions — the AS Jacobi/Hessenberg
eig+SVD kernels were **retired** 2026-07-01 (measured 0.2–0.7× of JS).

### Backends

`BackendType = 'js' | 'wasm' | 'gpu' | 'parallel'`.

| Backend                                                                                         | Notes                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JSBackend` (+ `jsBackend`)                                                                     | Pure-TS reference, always available; naive O(n³) multiply                                                                                                                                                                                                      |
| `WASMBackend` (+ `wasmBackend`, `createWASMBackend`)                                            | Loads `dist/wasm/mathts-as.wasm`; `shouldUseWasm` restricts WASM to `opKind: 'matmul'` (other ops measured 4–6× slower → stay on JS). Async `luDecomposition`/`qrDecomposition`/`inverse`/`determinantWasm`/`choleskyDecomposition` each with a `*JS` fallback |
| `GPUBackend` (+ `getGlobalGPUBackend`, `initializeGlobalGPUBackend`, `destroyGlobalGPUBackend`) | Raw WebGPU ops on `Float32Array` (`add`/`matmul`/`transpose`/`scale`); `shouldUseGPU`, `calculateWorkgroups`, `getStats`                                                                                                                                       |
| `GPUMatrixBackend` (+ `gpuMatrixBackend`, `createGPUMatrixBackend`)                             | Adapts `GPUBackend` to `MatrixBackend`/`DenseMatrix`; sync + `*Async` variants, JS fallback; default `minElements: 65536` (256×256)                                                                                                                            |
| `ParallelBackend` (+ `parallelBackend`, `createParallelBackend`)                                | Worker-pool-backed async ops over a `parallel` `ComputePool`                                                                                                                                                                                                   |
| `BackendManager` (+ `backendManager`, `createBackendManager`)                                   | The per-op dispatcher. `selectBackend(elementCount, operation?)` priority: explicit `preferredBackend` → GPU if `> gpuThreshold` → AS WASM if `> wasmThreshold` → JS                                                                                           |

`BackendRegistry` (+ `backendRegistry`): `register`, `get`, `has`, `initialize`,
`available`, `setHints`/`getHints`, `selectBackend`. `BackendManager` adaptive
tuning: `recordSample`, `maybeAdjustThresholds`, `getAdaptiveThresholds`,
`resetAdaptiveState`, `getPerformanceStats`, `forceBackend`, `getActiveBackend`.
`BackendManager.sum`/`dot` return `Promise<number>`; all other ops are synchronous.

### WASM feature detection

`detectWasmFeatures()`, `isWasmAvailable()`, `isSharedMemoryAvailable()`,
`isAtomicsAvailable()`, `clearFeatureCache()`, `getCachedFeatures()`. Interface
`WasmFeatures` (simd, sharedMemory, atomics, threads, bulkMemory, referenceTypes,
exceptions, tailCall).

### Typed & parallel operation surfaces

**Typed-function surface** (`typedMatrixOperations`): `matrix`, `identity`, `zeros`,
`ones`, `diag`, `random`, `add`, `subtract`, `multiply`, `dotMultiply`, `divide`,
`unaryMinus`, `transpose`, `sum`, `mean`, `min`, `max`, `norm`, `trace`, `abs`,
`sqrt`, `square`, `exp`, `log`, `pow`, `size`, `subset`, `row`, `column`, `diagonal`.

**Parallel-first set** (`parallelMatrixOperations`, Float64Array flat row-major
through `ComputePool`): `parallelMatrix`, `parallelIdentity`/`Zeros`/`Ones`/`Diag`/`Random`,
`parallelMatrixAdd`/`Subtract`/`Multiply`/`DotMultiply`/`Divide`, `parallelUnaryMinus`/`Transpose`,
`parallelMatrixSum`/`Mean`/`Min`/`Max`/`Variance`/`Std`/`Norm`/`Dot`/`Trace`/`Distance`,
`parallelMatrixAbs`/`Sqrt`/`Square`/`Exp`/`Log`/`Sin`/`Cos`/`Tan`,
`parallelMatrixSize`/`Subset`/`Row`/`Column`/`Diagonal`/`Matvec`/`Outer`/`Histogram`,
plus `initializeParallelMatrix()`/`terminateParallelMatrix()`.

**GPU internals**: `BUILTIN_SHADERS` (matmul/matrixAdd/matrixSub/matrixMul/scalarMul/
transpose/sumReduce WGSL — the domain kernels registered onto the shared
`ShaderManager` at `GPUBackend` init), `BatchExecutor`, `SyncManager`
(+ `createSyncManager`). Re-exported from `gpu` for back-compat: `BufferPool`,
`GPUCapabilities`, `GPUContext`, `GPUContextOptions`, `ShaderManager`,
`destroyGlobalGPU`, `detectGPUCapabilities`, `getGlobalGPUContext`,
`getRecommendedWorkgroupSize`, `hasWebGPU`.

**Key types**: `MatrixIndex`, `SliceSpec`, `MatrixEntry<T>`, `MatrixType`,
`BackendHints`, `OperationType`, plus one result/options pair per decomposition
(`LUResult`, `QRResult`, `CholeskyResult`, `SVDResult`/`SVDOptions`,
`EigResult`/`EigOptions`, `SchurResult`, `QRPivotedResult`, `PinvOptions`,
`ExpmOptions`, `LogmOptions`, `SqrtmOptions`). Constants `DEFAULT_BACKEND_HINTS`,
`DEFAULT_EXTENDED_HINTS`.

---

## @danielsimonjr/mathts-tensor

Rank-N, row-major `Float64Array`-backed dense `Tensor` with einsum/broadcasting,
decompositions routed through `matrix`, and a named-`Index` labelling system for
tensor-network-style contraction (ITensor-inspired). Depends on `core` and `matrix`.

### `class Index`

Immutable value type: unique `id: symbol`, `dim`, optional `name`, `tags`,
`primeLevel`. `constructor(dim, opts?)`; `prime(by?)`, `noprime()`, `addTag`/`removeTag`/`hasTag`,
`matches(other)` (same `id` AND `primeLevel` — dimension validated at contraction
time, not match time), `toString`. Factory `idx(dim, name?, opts?)`.

### `class Tensor`

`readonly shape`, `readonly data: Float64Array`, `readonly axisLabels?: Index[]`.
`constructor(shape, data, axisLabels?)`.

- **Statics**: `sizeOf(shape)`, `rowMajorStrides(shape)`, `fromNested(data, shape)`,
  `identity(n)`, `fromDenseMatrix(m)`, `broadcastShape(a, b)` (NumPy right-align),
  `einsum(spec, ...operands)`.
- **Element/data ops**: `add`/`sub`/`mul(other: Tensor|number)`, `scale(k)`, `normInf`,
  `reshape`, `transpose(perm?)`, `toNested`, `toDenseMatrix` (throws for rank ≠ 2).
- **Reductions**: `sum`/`mean`/`max`/`min`/`prod(axis?, {keepDims?})` (NaN-propagating
  max/min), `norm(opts?: {p, axis?, keepDims?})` (`p=2`/`'fro'`/`'inf'`/`'-inf'`/numeric).
- **Contraction**: `tensordot(other, axes)` (NumPy semantics, delegates to `einsum`),
  `matMul(other)` (uses `matrix`'s backend-selected multiply for large inputs),
  `contract(other)` (named-index contraction over all shared indices),
  `axisOf(index)`, `replaceIndex(oldIndex, newIndex)`.

**Decompositions** (partition axes → reshape to 2-D → call `matrix` primitive →
reshape back): `tensorSvd` (+ `tensorSvdWasm`), `tensorQr`, `tensorLU`,
`tensorCholesky`, `tensorEig` (+ `tensorEigWasm`), `tensorPinv`, `tensorSolve`.

**Tensor-network**: `contractNetwork(tensors, opts?)` — optimal pairwise order via
bitmask DP (`'exact'`, N≤16) or Hendrickson-Sundaram greedy (`'greedy'`); `'auto'` picks.

**Construction/manipulation**: `randomTensor` (Mulberry32 seeded; uniform/normal/orthogonal
— not cryptographic), `tensorKron`, `slice`, `gather`, `stack`, `concatenate`,
`scatter` (`reduce: 'overwrite'|'add'`), `pad` (`'constant'|'edge'|'reflect'`),
`roll`, `flip`. Types `EinsumSpec`, `IndexOpts`, `NestedArray`, one options/result
pair per decomposition/manipulation function.

---

## @danielsimonjr/mathts-autograd

Forward-mode (dual numbers) and reverse-mode (tape-based) automatic
differentiation over `tensor`'s `Tensor`, plus a JAX-style `grad`/`valueAndGrad`/
`derivative`/`jacobian` convenience layer. Depends on `core` and `tensor`. Both
`DualTensor` and `TapedTensor` draw their elementary primal/derivative pairs from
core's shared `DUAL_UNARY_RULES`, keeping forward/reverse/scalar in lock-step.

### Forward mode

- **`class DualTensor`** — primal + tangent `Float64Array` pair, same `shape`.
  Statics `fromTensor(t)` (zero tangent), `unitAt(t, i)`. `toPrimalTensor`/`toTangentTensor`.
  `add`/`sub`/`mul`/`divide`/`scale` + ~24 elementary functions (each following the
  dual-number chain rule): `exp`, `log`, `sin`, `cos`, `tan`, `sqrt`, `square`,
  `reciprocal`, `abs`, `pow(k)`, `sinh`/`cosh`/`tanh`, `asin`/`acos`/`atan`,
  `asinh`/`acosh`/`atanh`, `log2`/`log10`/`log1p`/`expm1`, `cbrt`, `sign`, `atan2(other)`.
- **`forwardGrad(fn, x)`** → `{value, jacobian}` — full Jacobian via one `DualTensor`
  trace per input flat-index.

### Reverse mode

- **`class Tape`** — `allocate(size)`, `record(inputIds, outputSize, backward)`,
  `backward(outputId, outputGrad)`, `getInputGrad(id)`.
- **`class TapedTensor`** — reverse-mode node wrapping a `Tape`. `add`/`sub`/`mul`/`divide`/`scale`,
  `contract`/`matmul`/`tensordot` (with documented adjoints), reductions
  `sum`/`mean`/`prod`/`max`/`min`/`norm`, ~26 elementary functions, `svd()`
  (Townsend 2016 / PyTorch `svd_backward`-equivalent, degeneracy-masked subgradient),
  `eig({symmetric})` (symmetric: Magnus & Neudecker; non-symmetric: real+diagonalizable only).
- **`reverseGrad(fn, x, cotangent?)`** → `{value, gradient}` (VJP; default cotangent ones-like).

### JAX-style convenience layer

`valueAndGrad(fn, x)` → `{value, grad}`, `grad(fn)` → `(x) => Float64Array`,
`derivative(fn, x0)` → `number`, `jacobian(fn, x)` → `number[][]`. Types
`ScalarFn = (x: TapedTensor) => TapedTensor`, `NumericInput = number | readonly number[] | Float64Array`.
Functions passed to the AD entry points must be written with `Tensor`/`TapedTensor`
methods (not plain `functions/` ops) — only those are AD-instrumented.

---

## @danielsimonjr/mathts-parallel

Worker-pool-backed parallel compute layer (`ComputePool` over workerpool's
`MathWorkerPool`) with per-operation, benchmark-tuned parallel-vs-sequential
threshold dispatch. Depends on `core` (only for stable numeric primitives —
`pairwiseSum`/`norm2`, explicitly NOT matrix) and `workerpool`.

### `class ComputePool` (+ singleton `computePool`)

`constructor(config?)`; `initialize`, `isReady`, `shouldParallelize(elementCount, op?)`
(consults `thresholdByOp[op]`, falls back to global `thresholdElements`),
`exec<T>`, `stats`, `terminate(force?)`, `updateConfig`, `getConfig`, `get workerCount`,
`getWorkerPool(): MathWorkerPool` (escape hatch to the underlying pool).

- **Reductions**: `sum`, `prod`, `dot`, `minMax`, `variance`, `norm`, `distance`,
  `histogram`, `mean`, `std`, `min`, `max` — all `Promise<ParallelResult<...>>`.
- **Elementwise**: `elementwise(a,b,op)`, `scale`, `unary(data, fn)`, `applyKernel`/`applyKernel2`
  (caller-supplied, eval'd in isolated worker — closure must be self-contained),
  `abs`/`sqrt`/`exp`/`log`/`sin`/`cos`/`tan`/`negate`/`square`, `add`/`subtract`/`multiply`/`divide`/`pow`/`sign`.
- **Linear algebra**: `matmul`, `transpose`, `matvec`, `outer`, `tensordot` (parallel
  threshold: contracted-axis volume ≥ 8192).
- **Signal / geometry / fan-out**: `fftBatch`, `distanceMatrix`,
  `integrateFanOut` (Gauss-Legendre), `distributionSampleFanOut` (SplitMix64 per-chunk seeding).
- **Generic / bitwise**: `map`/`reduce`/`filter`/`find`/`sort`; `bitAnd`/`bitOr`/`bitXor`/`bitNot`/
  `leftShift`/`rightArithShift`/`rightLogShift` (Int32Array).

### Standalone functions

Matmul family (each `{pool?, forceParallel?, forceSequential?}`): `parallelMatmul`,
`parallelMatvec`, `parallelTranspose`, `parallelOuter`, `parallelDot`. Elementwise:
`parallelAdd`/`Subtract`/`Multiply`/`Divide`/`Scale`/`Abs`/`Negate`/`Square`/`Sqrt`/`Exp`/`Log`/`Sin`/`Cos`/`Tan`/`Elementwise`/`Unary`.
Reductions: `parallelSum`/`Mean`/`Min`/`Max`/`MinMax`/`Variance` (Welford)/`Std`/`Norm`/`Distance`/`Histogram`/`Reduce`.
Map/filter/sort: `parallelMap`/`Filter`/`Find`/`Sort`/`ForEach`/`Some`/`Every`/`Count`.
Standalone bitwise (in-process chunked, synchronous, `Int32Array`): `bitAnd`, `bitOr`,
`bitXor`, `leftShift`, `rightArithShift`, `rightLogShift`, `bitNot`.

### Chunking / dispatch

`calculateOptimalChunks`, `chunkFloat64Array`, `chunkArray`, `mergeFloat64Chunks`,
`mergeArrayChunks`, `shouldParallelize` (exported as `shouldChunkParallelize`),
`partitionRange`, `partition2D`. `class ThresholdDispatcher` (+ `thresholdDispatcher`)
— coarser category-level dispatch (`OperationCategory`): `getThreshold`/`setThresholds`/`getThresholds`,
`dispatch`, `shouldParallelize`, `calculateChunks`.

**Result type**:

```typescript
interface ParallelResult<T> {
  result: T;
  duration: number; // execution time in ms
  chunks: number; // number of chunks used
  parallelized: boolean;
}
```

**Key types**: `OpName` (union of every dispatchable kernel), `OpThreshold =
number | 'never' | 'always'`, `ComputePoolConfig`, `ChunkOptions`, `DispatchResult`.
Constants `DEFAULT_THRESHOLD_BY_OP` (canonical benchmark-tuned per-`OpName`
thresholds; e.g. `pow`/`sign` default to `'never'`), `DEFAULT_POOL_CONFIG`, `DEFAULT_THRESHOLDS`.

> **Worker timeout is internal.** `parallel/src/WorkerPool.ts` (a distinct
> lower-level class) implements `execute(..., timeoutMs?)` — on timeout it
> terminates the offending worker, spawns a replacement, and rejects the task.
> This `WorkerPool` class is **not exported** from `parallel`'s `.d.ts`; the public
> surface only exposes `MathWorkerPool` (from workerpool) via
> `ComputePool.getWorkerPool()`. Do not document `WorkerPool.execute(timeoutMs)`
> as part of `parallel`'s package surface.

---

## @danielsimonjr/mathts-gpu

Shared WebGPU foundation — device/adapter lifecycle, buffer pooling, generic
shader compile/cache, capability detection. Ships **no domain kernels**; `matrix`
(and future `functions`) register their own WGSL onto the shared `ShaderManager`.
Per project memory, this foundation is experimental scaffolding — AssemblyScript/WASM
is the production-matured accelerator tier, not this one.

### `class GPUContext`

Manages WebGPU device/queue lifecycle. `constructor(options?)`; getters `status`
(`'uninitialized'|'initializing'|'ready'|'error'|'lost'`), `isReady`, `capabilities`,
`lastError`. `initialize(options?): Promise<boolean>` (never throws; concurrent
callers coalesce; unsupported env → `false`). `onDeviceLost(callback)`,
`getDevice`/`getQueue`, `createCommandEncoder`, `createBuffer`/`createStorageBuffer`/
`createStagingBuffer`, `createComputePipeline`, `createShaderModule`, `createBindGroup`,
`submitCommands`, `writeBuffer`/`readBuffer`, `dispatchCompute(pipeline, bindGroups,
[x,y,z])`, `waitForCompletion`, `destroy`.

### `class BufferPool`

GPU buffer allocation/reuse. `constructor(context, options?)`; `acquire`/`release`,
`acquireStorageBuffer`/`acquireStagingBuffer`/`acquireUniformBuffer`,
`evictOldBuffers`/`evictToSize`, `startAutoEviction`/`stopAutoEviction`, `getStats`,
`clear`/`destroy`.

### `class ShaderManager`

Generic WGSL compile/cache + name→code registry (no built-in shaders).
`constructor(context)`; `getShaderModule(name, code)`, `getPipeline(shaderName,
entryPoint, code?, layout?)`, `registerShader(name, code)` (bookkeeping only, no
compile), `hasRegisteredShader`/`getRegisteredShaderSource`,
`getRegisteredShaderModule`/`getRegisteredPipeline`, `precompileRegistered`,
`clearCache` (registrations retained), `getStats`.

### Detection, global context, device singleton, opt-in flag

`hasWebGPU()`, `isBrowser()`, `getGPUAdapter(options?)`,
`detectGPUCapabilities(preferHighPerformance?)`, `isGPUSuitableForMatrixOps`,
`getRecommendedWorkgroupSize`, `getMaxMatrixSize`. Global context:
`getGlobalGPUContext()`, `initializeGlobalGPU(options?)`, `destroyGlobalGPU()`.
Device singleton: `getGpuDevice(options?): Promise<GPUDevice | null>` (coalesces,
caches, never rejects), `resetGpuDevice()`. Opt-in flag: `enableGpu()`/`disableGpu()`/
`isGpuEnabled()` — gates _implicit_ GPU routing (off by default because the GPU
path is f32-only; WGSL has no f64 — a deliberate precision change the caller must
opt into). `serializeGpu(task)` funnels every GPU dispatch through one
serialization queue to prevent `pushErrorScope`/`popErrorScope` LIFO corruption
between concurrent dispatches.

**Key types**: `GPUAdapterInfo`, `GPUCapabilities`, `GPUContextOptions`,
`GPUContextStatus`, `DeviceLostEvent`, `BufferPoolOptions`, `ShaderSource`,
`PipelineConfig`. Constant `GPU_MIN_ELEMENTS = 65536` (measured minimum element
count before a GPU dispatch's upload/readback cost pays off).

---

## @danielsimonjr/mathts-functions

`functions/src/index.ts` (545 lines) re-exports three layers plus ~35 explicit
named-export blocks — roughly 828 exports across 445 source files, all reachable
from the entry point (one active graph). The build is `tsup` for the JS bundle
plus a separate `tsc -p tsconfig.dts.json` declaration tree (`dist/index.d.ts` is
117 lines but re-exports from 340+ sibling `.d.ts` files).

**The three layers** (per `CLAUDE.md`): `typed/` (parallel-first implementations
on core's `mathTyped` dispatch), `factories/` (activated mathjs-derived factory
functions), `wasm/` (JS-side `*Dispatch`/`wasm-bridge.ts` plumbing over the
`assembly/` binary). CAS is re-exported directly from the entry point (not the
`typed/` barrel) to keep the graph acyclic.

> **Factory-layer name collision** (verified quirk): the mathjs-derived factory
> `sum`/`mean`/`variance`/`std` are exported as **`factory_sum`, `factory_mean`,
> `factory_variance`, `factory_std`** — the un-prefixed names would collide with
> the typed-layer parallel stats (`parallelStatSum`/etc., the actual public names
> for basic descriptive stats). Other factory-layer names (`mode`, `prod`,
> `median`, `quantileSeq`, `corr`, `mad`, `qr`, `lup`, `slu`, `invmod`,
> `derivative`) have no collision and keep their plain names.

### Arithmetic

`add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`, `abs`, `sign`,
`pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`,
`log1p`, `expm1`, plus factory-layer `addScalar`/`multiplyScalar`/`subtractScalar`/`invmod`.
Each is a single `mathTyped` function resolving ~20 overloads spanning
`number`/`bigint`, `Complex`/`Fraction`/`BigNumber`/`Unit`/`Dual`, `Float64Array`
(parallel via `computePool`), broadcasting nested arrays, dense/sparse matrix
element-wise ops, and variadic `any, any, ...any` forms.

### Trigonometry

`sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `atan2`, `acsc`,
`asec`, `acot`, `acoth`, `acsch`, `asech`, `asinh`, `acosh`, `atanh`, `toRadians`,
`toDegrees`, `hypot`, `typedTrigonometry`. (Hyperbolic `sinh`/`cosh`/`tanh` live
in `typed/arithmetic.ts`.)

### Statistics — descriptive

Parallel-first primitives (the actual public names): `parallelStatSum`,
`parallelStatMean`, `parallelStatVariance`, `parallelStatStd`, `parallelStatMin`,
`parallelStatMax`, `parallelStatMinMax`, `parallelStatMedian`, `parallelStatMode`,
`parallelStatProd`, `parallelStatNorm`, `parallelStatDistance`, `parallelStatCorr`,
`parallelStatMAD`, `parallelStatCumsum`, `parallelStatQuantile`,
`parallelStatPercentile`, `parallelStatHistogram`. Composites: `gmean`, `hmean`,
`moment`, `skewness`, `kurtosis`, `iqr`, `sem`, `zscore`, `cov`, `corrcoef`,
`rankdata`, `spearman`, `kendallTau`, `linregress`, `pearsonr`, `spearmanr`,
`kendalltau`, `ptp`, `variation`, `trimmedMean`, `describe`, `histogram`.
Factory-layer plain names: `mode`, `prod`, `median`, `quantileSeq`, `corr`, `mad`.

### Statistics — inference / hypothesis tests

`studentTTest`, `studentTTestPaired`, `chiSquareTest`, `anova`, `anova2`,
`kolmogorovSmirnovTest`, `kolmogorovSmirnov2Test`, `mannWhitneyTest`,
`shapiroWilkTest`, `leveneTest`, `bartlettTest`, `proportionZTest`, `binomialTest`,
`andersonDarlingTest`, `dagostinoTest`, `friedmanTest`, `multipleComparison`,
`meanCI`, `proportionCI`, `bootstrapCI`, `permutationTest`, `mahalanobis`,
`hotellingT2`, `principalComponentAnalysis`, `fTest`, `jarqueBera`, `kruskalWallis`,
`wilcoxon`, `fisherExact`, `studentizedRangeCDF`/`studentizedRangeQuantile`,
`tukeyHSD`, `chi2Contingency`, `multipleTest`, `noncentralChi2CDF`/`noncentralFCDF`/`noncentralTCDF`,
`circmean`/`circstd`/`circvar`, `vonMisesPDF`, `mcnemar`, `cochranQ`. Fit/power/timeseries:
`fitDistribution`, `mvnPdf`/`mvnSample`, `tTestPower`, `pacf`, `ljungBox`,
`durbinWatson`, `adfuller`, `movingAverage`, `ewma`, `detrend`, `acf`.

### Distributions

Distribution-object factories (each returns a `Distribution` object with
`pdf`/`cdf`/`ppf`/`sample`): `normalDist`, `betaDist`, `binomialDist`,
`chiSquaredDist`, `exponentialDist`, `fDist`, `gammaDist`, `logNormalDist`,
`poissonDist`, `tDist`, `uniformDist`, `weibullDist`, `hypergeometricDist`,
`negativeBinomialDist`, `paretoDist`, `rayleighDist`, `triangularDist`,
`discreteUniformDist`, `gumbelDist`. Scalar PDF/CDF/PMF via `mathTyped`: `normalPDF`/`normalCDF`,
`exponentialPDF`/`CDF`, `poissonPMF`, `binomialPMF`, `geometricPMF`, `bernoulliPMF`,
`betaPDF`, `gammaPDF`, `studentTPDF`, `noncentralChi2PDF`, `entropy`, `jsDivergence`.
Standalone CDF/quantile: `normalQuantile`, `studentTCDF`/`Quantile`,
`chiSquaredCDF`/`Quantile`, `fCDF`/`Quantile`, `gammaCDF`/`Quantile`,
`betaCDF`/`Quantile`, and the Cauchy/Laplace/logistic families.

### Signal Processing

Parallel-first: `parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`,
`parallelFFTPower`, `parallelConv`, `parallelXCorr`, `parallelAutoCorr`. Plain:
`crossCorrelation`, `autoCorrelation`, `groupDelay`, `unwrapPhase`, `dct`/`idct`,
`dst`/`idst`, `dwt`, `fourier`/`invFourier`, `hilbertTransform`, `periodogram`,
`lowpassFilter`/`highpassFilter`/`bandpassFilter`, `resample`, `medfilt`,
`windowFunction`, `convolve`, `correlate`, `welchPSD`, `bartlettPSD`, `multiTaperPSD`,
`goertzel`, `chirpZTransform`. Signal-domain extras: `rfft`/`irfft`,
`fftshift`/`ifftshift`, `fftfreq`/`rfftfreq`, `fftn`; IIR design `cheby1`/`cheby2`/`ellip`/`sosfilt`/`zpk2sos`/`bilinear`/`buttord`;
FIR/smoothing `firwinBandpass`/`firls`/`remez`/`savgol`/`wiener`/`deconvolve`;
wavelets `idwt`/`wavedec`/`waverec`/`cwt`; peaks/spectral `findPeaks`/`peakWidths`/`csd`/`coherence`/`stft`/`istft`/`decimate`.
Filter design/apply: `firwin`, `butter`, `lfilter`, `lfilterZi`, `filtfilt`.

### Linalg

`rowReduce`, `matrixRank`, `cholesky`, `hessenbergForm`, `pinv`, `cond` (SVD-based
typed-dispatch version), `norm2`, `normFro`, `lowRankApprox`, `singularValues`,
`matrixExpm`/`matrixLogm`/`matrixSqrtm`. Structured constructors/extras: `tril`,
`triu`, `vander`, `toeplitz`, `circulant`, `companion`, `logdet`, `laplacianMatrix`,
`generalizedEig`, `qz`, `orth`, `svd` (re-exported from `matrix`). Factory-layer
decompositions routed to matrix-package primitives: `qr`, `lup`, `slu`.

### Calculus / grad

`hessian`, `gradient` (numeric); `derivativeAt`, `valueAndDerivativeAt`,
`gradientAt` (forward-mode AD, type `DualFn`); `derivative` (symbolic, factory layer).

### Numeric methods

`typed/numeric.ts`: `findRoot`, `linsolve`, `minimize`, `maximize`, `globalMinimize`,
`leastSquares`, `nintegrate`, `simpsons`, `interpolate`, `cspline`, `pchip`,
`bezierCurve`, `bspline`, `loess`, `griddata`, `rbfInterpolate`,
`curvefit`/`expfit`/`logfit`/`powerfit`, `solveODESystem`, `stiffODESolver`,
`solveBVP`, `odeAdaptiveStep`, `eventDetection`, `rank`, `nullspace`, `residue`,
`chebyshevApprox`, `padeApproximant`, `quadprog`, `linprog`, `solvePDE`. The
`numeric/` package modules: `numericJacobian`, `newton`/`secant`/`halley`,
`fsolve`/`root`, Krylov solvers `cg`/`minres`/`gmres`/`bicgstab`, `eigsh` (Lanczos),
`thomasSolve`/`solveBanded`/`toeplitzSolve`/`ldl`, `funm`/`cosm`/`sinm`,
`dlyap`/`care`/`dare`, `minimizeScalar` (Brent), `quad` (Gauss-Kronrod), `interpn`,
`bsplineFit`/`bsplineEval`, `monteCarloIntegrate`, `bfgs`, `nnls`/`lsqBounded`,
`rootsLegendre`, `interval`/`Interval` (outward-rounded interval arithmetic).
Optimization extras: `nelderMead`, `gradientDescent`, `levenbergMarquardt`.

### Regression / ML / clustering

`linearRegression`, `ols`, `ridge`/`lasso`/`elasticNet`, `logisticRegression` (IRLS),
`glm` (IRLS/Fisher-scoring, Poisson/Gamma families), `dbscan`/`knnClassify`/`knnRegress`,
`gaussianKDE`, `kmeans`, `spectralClustering`.

### Graph theory

`adjacencyMatrix`, `shortestPath` (Dijkstra), `minimumSpanningTree`,
`connectedComponents`, `stronglyConnectedComponents`, `topologicalSort`,
`isConnected`, `graphDistance`; traversal/centrality `bfs`/`dfs`/`floydWarshall`/`bellmanFord`/`closenessCentrality`/`harmonicCentrality`;
optimization `maxFlow`/`minCut` (Edmonds-Karp), `astar`, `hungarian`;
community/coloring `graphColoring` (Welsh-Powell), `maxClique` (Bron-Kerbosch),
`louvainCommunities`, `katzCentrality`, `isIsomorphic`.

### Special functions

`erfc`, `erfi`, `lgamma`, `beta`, `gammainc`/`gammaincp`, `betainc`, `digamma`,
`besselJ0`/`J1`/`J`/`Y0`/`Y1`/`Y`/`besselI`/`besselK`, `ellipticK`/`E`/`F`/`ellipticEIncomplete`/`ellipticPi`,
`chebyshevT`, `hermiteH`, `laguerreL`, `legendreP`, `lambertW`,
`cosIntegral`/`sinIntegral`/`logIntegral`/`expIntegralEi`, `fresnelC`/`fresnelS`,
`airyAi`/`airyBi`, Carlson forms `carlsonRC`/`RF`/`RD`/`RJ`; extras `hyp0f1`/`hyp1f1`/`hyp2f1`/`pFq`,
`polygamma`/`trigamma`/`jacobiP`/`gegenbauerC`, `jacobiSN`/`CN`/`DN`, `polylog`,
`struveH`/`struveL`, `kelvinBer`/`kelvinBei`, `barnesG`.

### Number theory & combinatorics

`fibonacci`, `lucas`/`lucasL`, `doubleFactorial`, `risingFactorial`/`fallingFactorial`,
`subfactorial`, `prime`/`nextPrime`/`primePi`/`primeFactors`, `divisors`/`divisorSigma`,
`eulerPhi`, `carmichaelLambda`, `moebiusMu`, `jacobiSymbol`, `chineseRemainder`,
`partitions`, `harmonicNumber`, `integerDigits`, `continuedFraction`, `eulerNumbers`,
`stirlingS1`, `discreteLog` (BSGS), `primitiveRoot`, `multiplicativeOrder`,
`kroneckerSymbol`, `permutationsGen`/`combinationsGen`.

### Geometry

`angle2D`/`angle3D`, `cross3D`/`dot3D`, `triangleArea`/`polygonArea`/`polygonPerimeter`,
`convexHull`, `pointInPolygon`, `rotateVector2D`/`3D`, `reflectVector`/`projectVector`,
`distance2D`/`3D`/`ND`, `distancePointToLine2D`, `intersectLines2D`/`intersectSegments2D`,
`area`/`centroid`, `coordinateTransform`, `manhattanDistance`/`chebyshevDistance`/`minkowskiDistance`,
`delaunayTriangulation`, `voronoiDiagram`, `kdTree`/`kdTreeNearest`/`nearestNeighbor`,
`haversine`, `slerp`, full quaternion set (`quaternionMultiply`/`Conjugate`/`Normalize`/
`FromAxisAngle`/`Rotate`/`ToRotationMatrix`/`Inverse`/`Slerp`/`ToEuler`/`Log`/`Exp`/`Pow`),
`boundingBox`, `procrustes`, `rayTriangleIntersect`/`rayPlaneIntersect`/`segmentSegmentClosest`.

### CAS

`integrate`, `limit`, `partialDerivative`, `directionalDerivative`, `gradientSymbolic`,
`jacobian` (symbolic), `laplacian`, `divergence`, `laplace`/`inverseLaplace`,
`fourierSeries`, `zTransform`, `taylor`/`multivariateTaylor`/`series`/`seriesCoefficient`,
`solve`, `implicitDiff`, `summation`/`symbolicProduct`, `assume`/`getAssumptions`/`clearAssumptions`,
`asymptotic`, `groebnerBasis`, `symbolicIntegral`.

### Typed-dispatch & bridges

Every `typed/` function is built with `mathTyped(name, signatureMap)` where keys are
signature strings (`'number, number'`, `'Complex'`, `'Float64Array, Float64Array'`,
`'any, any, ...any'`). Each WASM-accelerated domain has a `wasm/<domain>/wasm-bridge.ts`
exporting `*Dispatch` functions that try the AS kernel then fall back to a shared
`scalars.ts` JS implementation (so paths can never numerically diverge). Threshold
constants: `WASM_SPECIAL_THRESHOLD = 1024`, `CENTRALITY_WORKER_THRESHOLD = 4`,
`DIST_WORKER_THRESHOLD = 100_000`, `GPU_MIN_ELEMENTS` (re-exported from `gpu`).
GPU opt-in surface (all OFF by default, f32 tier): `enableGpu`/`disableGpu`/`isGpuEnabled`
(re-exported), plus this package's `elementwiseChainGpuDispatch`,
`elementwiseChainReduceGpuDispatch`, `fftGpuDispatch`, `GPU_REDUCE_OPS`/`GpuReduceOp`,
`GPU_ELEMENTWISE_OPS`/`GpuElementwiseOp`, `isGpuChainSupported`, `resetGpuElementwise`/`resetGpuFft`.
Also exported: `config` (runtime config accessor) and `help` (mathjs-canonical `help(search)`).

---

## @danielsimonjr/mathts-expression

Expression parsing, AST, compilation, and evaluation (mathjs-lineage parser + a
standalone tree-walking compiler/evaluator, plus a security-validating high-level
`evaluate`). Depends on `core`. **Two parallel evaluation paths**, both exported
from the root:

1. **Factory-injected mathjs-style path** — `createParse`, `createNode`, the
   `create*Node` AST factories, `createHelpClass`, `createParser`, the `transform/*`
   factories. These are `FactoryFunction<Deps, T>` values; a host (e.g.
   `functions/src/factories/index.ts`) must supply the listed dependencies before
   the real `parse`/Node classes exist. Not directly callable standalone.
2. **Standalone compiler/evaluator path** — `compile`, `createEvaluate`,
   `compileExpression` — plain functions needing only a parsed `MathNode` and a
   flat `mathScope`. This is what `workbook` uses (no DI bootstrapping).

The package exports **no plain top-level `parse`/`evaluate` function** — only the
DI factories and the standalone builders.

### AST Node hierarchy (15 node types)

Every node type is a `create<Name>Node` factory (not a plain class); an instance's
shape is the `MathNode` type. Base `Node` instance methods: `evaluate(scope?)`,
`compile()`, `_compile(math, argNames)`, `forEach`/`map`/`traverse`/`transform`/`filter`,
`clone`/`cloneDeep`, `equals`, `toString`/`toHTML`/`toTex`/`toJSON`,
**`toMarkdown(options?)`** (wraps `toTex` in `$…$`/`$$…$$`), **`toDOT(options?)`**
(Graphviz digraph of the AST — these two belong to expression's Node, _not_ to the
plot package), `toMathML` (degrades to `<merror>`), `getIdentifier`/`getContent`.

Node constructors: `ConstantNode(value)`, `SymbolNode(name)`, `OperatorNode(op, fn,
args, implicit?, isPercentage?)` (+ `isUnary`/`isBinary`), `FunctionNode(fn, args,
optional?)`, `AccessorNode(object, index, optionalChaining?)`, `AssignmentNode(object,
index, value?)`, `ArrayNode`, `BlockNode`, `ConditionalNode`, `FunctionAssignmentNode`,
`IndexNode`, `ObjectNode`, `ParenthesisNode`, `RangeNode`, `RelationalNode`. All
carry a duck-typed `isXxxNode` discriminant; the standalone compiler dispatches on
these flags, not `instanceof`.

### Compilation / evaluation

`compile(node, mathScope): CompiledExpression` where `CompiledExpression =
{evaluate(scope?)}`. `createEvaluate(parseFn, mathScope)` returns an `evaluate`
overloaded for string and string-array input; it **runs a pre-compile AST security
validator (`validateAst`) by default** — rejects `AssignmentNode`,
`FunctionAssignmentNode`, and calls to a forbidden-function blocklist (`import`,
`createUnit`, `evaluate`, `parse`, `compile`, `simplify`, `derivative`, `help`,
`chain`) unless `options.unsafe === true`. `compileExpression(parseFn, mathScope,
expr, options?)` does the same validation but returns a reusable compiled expression.
`Scope` interface: `{has, get, set}` (Map-like; `ObjectWrappingMap` wraps a plain
object). `EvaluateOptions = {unsafe?: boolean}`.

### Security sandbox (invariant)

`getSafeProperty`, `setSafeProperty`, `getSafeMethod` (+ `isSafeProperty`,
`isSafeMethod`, `isPlainObject`) live in `expression/src/utils/customs.ts` and are
imported directly by call sites. **Every** property/method/index access in the
compiler routes through these — direct `obj[name]` access is a sandbox bypass.
`getSafeProperty` only allows plain-object/array/whitelisted-native reads and blocks
`Object.prototype`/`Function.prototype` inheritance; `setSafeProperty` blocks
`__proto__`/`constructor` pollution; `getSafeMethod` additionally rejects "ghosted"
own-property method overrides. This is a **second, independent** defense layer
alongside `validateAst`. Regression-guarded by `expression/tests/security/sandbox.test.ts`.

### Operators, transforms, helpers

`properties: OperatorGroup[]`, `getPrecedence`, `getAssociativity`,
`isAssociativeWith`, `getOperator(fn)`. MathML helpers `mathMLDocument`,
`mathMLError`, `escapeMathML`, `toMathMLSymbol`. `keywords: Set<string>`,
`embeddedDocs`, `createHelpClass`, `createParser` (stateful `math.parser()` wrapper
holding a scope: `.evaluate`/`.get`/`.set`/`.clear`). Transform factories (0-based JS
→ 1-based expression-language index/dim, or added laziness): `createAndTransform`,
`createOrTransform`, `createNullishTransform`, `createMapTransform`, `createFilterTransform`,
`createForEachTransform`, `createSubsetTransform`, `createRangeTransform`,
`createMax`/`Min`/`Mean`/`Sum`/`Std`/`Variance`/`QuantileSeq`/`CumSum`/`Diff`Transform, and more.

---

## @danielsimonjr/mathts-workbook

Headless runtime + CLI for `.mtsw` reactive YAML notebooks whose code/test cells are
evaluated as **MathTS expressions** (via expression's standalone sandboxed
compile/evaluate path), not TypeScript. Depends on `core`, `functions`, `expression`, `plot`.

### Core types

`CellType = 'markdown'|'code'|'tensor'|'equation'|'visualization'|'data'|'test'|'export'`,
`ExecutionMode = 'reactive'|'sequential'|'manual'`, `RuntimeConfig`, `Cell`, `Workbook`,
`WorkbookMetadata`, `ParseResult`, `WorkbookEvent`, `CellResult`, `RunResult`,
`DependencyNode`, `DependencyGraph`.

### Parser

`detectCellType(cell)`, `parseWorkbook(content): ParseResult`,
`serializeWorkbook(workbook): string` (round-trips structural fields;
`output` is best-effort), `stripOutputs(workbook)`. All YAML goes through
`yaml-safe.ts` (core-schema-only, merges disabled, prototype-pollution guard) —
the single hardened parse path shared by the document parser and `data`-cell evaluation.

### Dependency graph

`buildDependencyGraph(cells)`, `topologicalSort(nodes)`, `getDependents(graph, cellId)`,
`getAncestors(graph, id)` (transitive closure + `id`, cycle-safe), `toMermaid(graph)`
(validated identifiers → no injection), `detectCycles(graph)`.

### Executor

`class WorkbookExecutor` — `constructor(workbook)`; `on(handler)` (subscribe, returns
unsubscribe), `runAll()` (**throws on first cell error**), `runCell(cellId)`,
`seedOutputs(entries)`, `runReport(options?)` (**continue-on-error**, never throws on
cell failure, refuses on cycle; `test` cells → `pass`/`fail`), `getOutput(cellId)`.
`createExecutor(workbook)` convenience constructor. `buildScope` injects only
**direct** `dependsOn` outputs; `executeCode` evaluates through the expression
sandbox (no `Function`-constructor exposure).

### Pure cell-mutation ops

Immutable (each returns a new `Workbook`, enforcing runnable-valid invariants):
`addCell`, `editCell`, `removeCell` (→ `RemoveResult`), `moveCell`, `renameCell`,
`setMetadata`. `CellPosition = {before?, after?, at?}`.

### Session, JSON-RPC, timeout worker

`class Session` — in-memory editing/execution (`open`/`save` file I/O; everything
else in-memory): `addCell`/`editCell`/…, `run(only?)` (incremental — only stale
cells + ancestors), `staleIds()`, `save(path?)`. `handleRequest(session, request)`
JSON-RPC router (`JsonRpcRequest`/`Response`/`Event`). `runWorkbookWithTimeout(source,
{timeoutMs})` runs a `.mtsw` to completion inside a `worker_threads` worker,
terminating it on timeout (`WorkbookTimeoutError`); outputs pre-formatted via
`formatResult` before crossing the worker boundary. `formatResult(value)` is
crash-proof (never throws). Constants `SCHEMA_VERSION = {major:1, minor:0}`,
`VERSION = "0.1.0"` (internal, distinct from npm 0.3.3).

### CLI (`mtsw`)

Command handlers are pure functions returning `{stdout, stderr, exitCode}`:
`runCommand`, `validateCommand`, `describeCommand`, `capabilitiesCommand`,
`templatesCommand`, `functionsCommand`, `metaCommand`, `exportCommand`, `graphCommand`
(Mermaid), `stripCommand`, `newCommand`, `importCommand`, `cellCommand`, `serveCommand`,
`runServer(input?, output?)` (JSON-RPC-over-stdio / NDJSON loop), `dispatch(argv)`.
Interface `CommandResult`.

---

## @danielsimonjr/mathts-compat

mathjs-compatible API shim over MathTS (`core`/`functions`/`matrix`/`parallel`) for
gradual migration off mathjs. Intentionally pins mathjs semantics as an oracle target.

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';
const math = create(all);
math.add(1, 2, 3); // variadic left-fold → 6
math.chain(3).add(4).multiply(2).done(); // → 14
```

- **Entry points**: `create(factories?, config?): MathInstance` (`factories`
  defaults to `all`), `all` (full re-exported `functions` factory surface), `shims`
  (a plain bag of every shim by name).
- **Chain API**: `chain(value): Chain` — every math function becomes a chain method;
  `done()`/`valueOf()`/`toString()` terminate.
- **Type creation**: `complex(re?, im?)`, `fraction(n?, d?)`, `bignumber(value?)`,
  `matrix(data?, format?)`, `sparse(data?)`.
- **Arithmetic**: `add`/`subtract`/`multiply` are **custom variadic left-folding,
  matrix-aware wrappers** (2-D array / `DenseMatrix` operands → `matrix` package,
  else → `functions`) — the main reason `compat` exists as its own package. `divide`,
  `pow`, `sqrt`, `abs`, `exp`, `log` are direct `functions` re-exports.
- **Trig**: `sin`/`cos`/`tan` re-exported; `asin`/`acos`/`atan`/`atan2` are local
  `Math.*`-backed shims.
- **Statistics**: `sum`/`mean`/`min`/`max` re-exported; `variance(data, normalization?)`/
  `std(data, normalization?)` are self-contained local implementations
  (`'unbiased'|'uncorrected'|'biased'`, default `'unbiased'` = ÷(N−1)).
- **Complex/matrix-specific**: `conj`/`re`/`im`/`arg`; `transpose` (array-in→array-out,
  Matrix-in→Matrix-out), `det` (closed-form n≤3, else local LU), `identity(n)`, `size`.

> **`zeros`/`ones` vector-vs-matrix split** (mathjs parity, v0.4.0): single-arg
> `zeros(n)`/`ones(n)` return a length-`n` plain `number[]` **vector**
> (`math.zeros(3).toArray()` → `[0,0,0]`); two-arg `zeros(r,c)`/`ones(r,c)` return
> an `r×c` `DenseMatrix`. An easy footgun — do not assume `zeros(n)` returns a matrix.

- **Type checks**: exported from `shims.ts` as `isComplex_`/`isFraction_`/`isBigNumber_`/`isNumber_`/`isMatrix`,
  re-exported under un-underscored names (`isComplex`/…) from the package top level.
- **Constants**: `i`, `pi`, `e`, `phi`, `tau`, `LN2`/`LN10`/`LOG2E`/`LOG10E`/`SQRT2`/`SQRT1_2`,
  and `Infinity_`/`NaN_` (aliased to `Infinity`/`NaN` inside `shims`). Re-exported
  types/values: `Complex`, `Fraction`, `BigNumber`, `I`, the `COMPLEX_*`/`FRACTION_*`/`BIGNUMBER_*`
  constants (core), `DenseMatrix`/`SparseMatrix` (matrix), `computePool` (parallel).
- **Interfaces**: `MathJSConfig`, `MathInstance`, `Chain`.

---

## @danielsimonjr/mathts-plot

Headless, dependency-light SVG 2D/3D plotting — expression-aware (samples MathTS
expressions directly), browser-safe by default. Zero runtime dependencies beyond
`core`/`functions`/`expression`; ships no bundled image/PDF renderer.
(Internal `VERSION` constant reads `"0.2.0"`, stale versus package.json `0.3.29`.)

- **Polymorphic entry points**: `plot(a, b?, c?: PlotOptions): string` — dispatches on
  argument shape (`plot(y)` → line with `x=0..n-1`; `plot(x, y)` → line;
  `plot(layers)` → overlay; `plot(source)` → samples a MathTS expression).
  `toTikZ(a, b?, c?)` — same polymorphism, forced to the TikZ backend.
- **2D marks** (`(x, y, opts?) => string`): `line`, `scatter`, `bar`, `area`, `step`,
  `errorbar(x, y, yerr, opts?)`, `quiver(x, y, u, v, opts?)`.
- **Other 2D**: `histogram(data, opts?)`, `heatmap(z, opts?)` (viridis), `contour(z,
opts?)` (marching squares), `overlay(layers, opts?)`.
- **3D**: `surface(z, opts?)` (painter's algorithm, `azim`/`elev`), `scatter3d`, `curve3d`.
- **Utility**: `viridis(t): string`. **Types**: `Data`, `AxisSpec`, `PlotOptions`,
  `Layer2D`. Exported `VERSION`.

> **No `./tex` subpath.** TikZ ships from the main `.` entry via `toTikZ()` /
> `format: 'tikz'`. `PlotRenderError` and the PNG/PDF renderers are in the
> **Node-only `./render` subpath**. And `.toDOT`/`.toMarkdown` belong to
> expression's AST `Node`, _not_ to plot.

**`./render` subpath** (`plot/dist/render-file.js`) — Node-only file-output bridge,
deliberately isolated so `node:child_process`/`node:fs` never reach the browser
bundle. Exports `PlotRenderError extends Error` (`readonly missingTool?`; plot's one
deliberate exception to its never-throw rule), `RenderOptions`, `runTool`, `hasTool`,
`renderToFile(svg, outPath, opts?)` (SVG→PNG/PDF via `rsvg-convert` or `resvg` on
PATH), `latexArgs`, `latexToPdf(texSource, outPath, opts?)` (TikZ/LaTeX → PDF via
`pdflatex` or `tectonic`).
The `.` entry stays browser-safe — it passes `npm run check:browser-safety`.

Workbook's `svg.ts`/`pdf.ts` are a **chart adapter** in the workbook package (not
plot itself): they coerce workbook value types and delegate rendering to plot's
`line`/`scatter`/`bar` and `latexToPdf`.

---

## Focused re-export packages (10)

Each is a single `src/index.ts` re-exporting from exactly one parent package — no
implementation of its own. Versions track independently.

| Package                        | Re-exports from | Surface                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mathts-parser` (0.1.18)       | expression      | Parser factories (`createParse`/`createParserClass`/`createParser`), all 15 `create*Node` constructors, operator/keyword metadata (`keywords`, `properties`, `getPrecedence`, `getAssociativity`, `isAssociativeWith`, `getOperator`), full type surface. Superset of `ast`                                                                                                                                                          |
| `mathts-ast` (0.1.17)          | expression      | The same 15 `create*Node` constructors + full type surface. No parser/operator metadata — for building/walking/transforming trees                                                                                                                                                                                                                                                                                                    |
| `mathts-evaluator` (0.1.17)    | expression      | `compile`, `createEvaluate`, `compileExpression`; types `CompiledExpression`, `Scope`. The evaluation half only                                                                                                                                                                                                                                                                                                                      |
| `mathts-units` (0.1.14)        | core            | `Unit`, `isUnit`, `isUnitValue`, `DimensionMismatchError`, `UnitParseError`, `DIMENSIONLESS`, `dim`, `BASE_UNITS`/`DERIVED_UNITS`/`ALL_UNITS`, `UNIT_ALIASES`, `getUnitDef`, `SI_PREFIXES`, `BEST_PREFIXES`, `getPrefix`; types `Dimensions`, `UnitDef`                                                                                                                                                                              |
| `mathts-numbers` (0.1.14)      | core            | `Complex`/`Fraction`/`BigNumber` + their guards and constants; types `IComplex`, `IFraction`, `IBigNumber`, `BigNumberConfig`, `RoundingMode`                                                                                                                                                                                                                                                                                        |
| `mathts-linalg` (0.1.18)       | matrix          | `eig`/`eigvals`/`powerIteration`, `svd`/`singularValues`/`pinv`/`lowRankApprox`/`cond`/`norm2`/`normFro`, WASM-shim variants (`eigWasm`/`svdWasm`/…), DenseMatrix primitives (`matrixPinv`/`qr`/`lu`/`cholesky`), matrix functions (`matrixExpm`/`Logm`/`Sqrtm`/`Schur`), + decomposition types. The maintained oracle-pinned layer                                                                                                  |
| `mathts-arithmetic` (0.1.44)   | functions       | `add`/`subtract`/`multiply`/`divide`/`unaryMinus`/`unaryPlus`, `abs`/`sign`/`pow`/`sqrt`/`square`/`cube`/`cbrt`/`nthRoot`, `exp`/`log`/`log10`/`log2`/`log1p`/`expm1`, `round`/`floor`/`ceil`/`fix`, `mod`/`gcd`/`lcm`/`xgcd`, `norm`, `sinh`/`cosh`/`tanh`, comparisons, `min`/`max`/`sum`/`mean`/`variance`/`std`/`dot`, `typedArithmetic`                                                                                         |
| `mathts-trigonometry` (0.1.44) | functions       | `sin`/`cos`/`tan`/`csc`/`sec`/`cot`, `asin`/`acos`/`atan`/`atan2`/`acsc`/`asec`/`acot`, `asinh`/`acosh`/`atanh`, `toRadians`/`toDegrees`, `hypot`, `typedTrigonometry`                                                                                                                                                                                                                                                               |
| `mathts-statistics` (0.3.27)   | functions       | The largest re-export package: descriptive stats, parallel-first stats + selection (`quickSelect`/`medianSelect`/…), distribution objects + PDF/CDF/quantile surface, hypothesis tests, probability/combinatorics, regression/time-series/clustering, plus result types. Every function is externally-oracle-pinned in the `functions` test suite                                                                                    |
| `mathts-signal` (0.1.44)       | functions       | `parallelFFT`/`IFFT`/`FFTMagnitude`/`FFTPower`/`Conv`/`XCorr`/`AutoCorr`, `crossCorrelation`/`autoCorrelation`, `groupDelay`/`unwrapPhase`, `dct`/`idct`/`dst`/`idst`/`dwt`, `fourier`/`invFourier`, `hilbertTransform`, `periodogram`, `lowpass`/`highpass`/`bandpassFilter`, `resample`/`medfilt`/`windowFunction`, `convolve`/`correlate`, `welchPSD`/`bartlettPSD`/`multiTaperPSD`, `goertzel`, `chirpZTransform`, `typedSignal` |

---

## WASM Modules

### AssemblyScript WASM (`assembly/`, `@danielsimonjr/mathts-wasm`) — the sole WASM backend

AssemblyScript compiles `src/index.ts` directly to the single binary `mathts-as.wasm`
consumed by both `matrix` (LU/QR/Cholesky/inverse/determinant + SIMD matmul) and
`functions` (FFT/signal, special functions, elementwise transcendentals). There is
**no `dist/index.d.ts`** — AS ships a `.wasm`, not a TS declaration — so this surface
is sourced from `src/index.ts` + `src/bindings/wasm-loader.ts`. AS exports functions
only, never classes (AS231 constraint). Per project memory this is the production-matured
"real WASM" tier; the WebGPU/`gpu` tier is experimental scaffolding.

The built binary exports **314 functions** (326 total exports, incl. 11 numeric
globals such as `PI`/`E` plus the linear memory), compiled from 28 source files:

| Category                       | Function exports | Examples                                                                                 |
| ------------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| Scalar f64                     | 79               | `add_f64`, `sin_f64`, `exp_f64`, `log_f64`, `cbrt_f64`, `nthRoot_f64`                    |
| Array ops                      | 54               | `array_add`, `array_dot`, `array_norm`, `array_sum`, `array_mean`                        |
| Matrix ops                     | 50               | `matrix_multiply`, `matrix_transpose`, `matrix_gemm`, `matrix_lu*`                       |
| Complex scalar                 | 46               | `complex_add`, `complex_sin`, `complex_exp`, `complex_sqrt`                              |
| Complex array                  | 33               | `complex_array_add`, `complex_array_dot`, `complex_array_norm`                           |
| FFT                            | 2+               | `fft`, `ifft`, `rfft`, `powerSpectrum` (radix-2 Cooley-Tukey)                            |
| Special/poly/sort/signal/other | 54               | bessel/airy/elliptic/carlson, `poly_mul_f64`, `sort_f64`/`argsort_f64`, window functions |

Additional grouped surface: dense decompositions (LU/QR/Cholesky/inverse/determinant
— the kernels `matrix`'s `WASMBackend` calls), special functions
(`bessel_j0_f64`/…/`airy_ai_f64`/`elliptic_k_f64`/`lgamma_f64`/`carlson_r*_f64`),
number theory + polynomial algebra (`poly_div_mod_f64`, `poly_fit_f64`,
`poly_resultant_f64`, `poly_discriminant_f64`), signal windowing/spectral
(`resample`, `medfilt`, `windowFunction`, Welch/Bartlett PSD, Goertzel, CZT),
extra linalg (`rowReduce`, `characteristicPolynomial`), curve fitting
(`expfit`/`logfit`/`powerfit`), optimization (`quadprog`/`linprog`/`nullspace`),
rational approximation (`residue`/`padeApproximant`), `tensorTranspose`, bitwise
Int32Array elementwise ops, 18-op elementwise transcendental array kernels
(`array_<op>_ptr`), `tridiag_solve_f64`, `divided_difference_f64`, and complex array
creation/arithmetic. Note the AS eig/SVD kernels were **retired** 2026-07-01 (measured
0.2–0.7× of JS); only matmul + the dense factored decompositions remain WASM-accelerated
for `matrix`.

**JS bindings** (`src/bindings/wasm-loader.ts`, TypeScript — this file _is_
type-checked/linted, unlike the AS `.ts` source): `interface MathTSWasmExports`
(typed surface of `.exports`, with optional `?` decomposition + bitwise exports and
AS memory management `__new`/`__pin`/`__unpin`/`__collect`), `interface
MathTSWasmInstance`, `loadWasm(source): Promise<MathTSWasmInstance>` (URL/path/buffer
— **verifies SHA-384 integrity against the sibling manifest before compiling when
loading from a path**; buffer-only callers verify themselves), `loadWasmSync(source)`,
`class MathTSWasm` (default export, higher-level wrapper).

> **Security invariant — WASM SHA-384 manifest verification.** Both
> `functions/src/wasm/WasmLoader.ts` (Node + browser) and
> `assembly/src/bindings/wasm-loader.ts` hash the `.wasm` buffer and compare to
> `wasm-manifest.json` (generated by `tools/generate-wasm-manifest.mjs`) before
> compile/instantiate. Do not bypass, weaken to a non-cryptographic check, or skip
> on streaming-compile paths. Regression-guarded by
> `functions/tests/security/wasm-integrity.test.ts`.

---

## npm Scripts (WASM-related)

| Script                  | Command                                             | Description                                                                            |
| ----------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `build:wasm`            | `npm run asbuild -w @danielsimonjr/mathts-wasm`     | Build the AssemblyScript WASM backend                                                  |
| `test:wasm`             | `npm run test -w @danielsimonjr/mathts-wasm`        | AssemblyScript WASM tests (`assembly/tests/run.js`, Node + `--experimental-wasm-simd`) |
| `test:wasm:integration` | `vitest run tests/wasm/`                            | Cross-package WASM integration tests                                                   |
| `bench:wasm`            | `npx tsx tools/benchmark/wasm/run.ts`               | Full AssemblyScript-vs-JS benchmark suite                                              |
| `bench:elementwise`     | `npx tsx tools/benchmark/wasm/elementwise.bench.ts` | Elementwise `array_<op>_ptr` kernels vs `Math.*`                                       |
| `bench:special`         | `npx tsx tools/benchmark/wasm/special.bench.ts`     | Special-function kernels (bessel/lgamma/elliptic)                                      |
| `bench:sort`            | `npx tsx tools/benchmark/wasm/sort.bench.ts`        | `sort_f64` introsort vs JS comparator sort                                             |
| `bench:matrix`          | `npx tsx tools/benchmark/wasm/matrix.bench.ts`      | multiply / svd / eig / Welch-PSD (FFT) vs JS                                           |

The `tools/benchmark/wasm/` suite measures each AssemblyScript-accelerated path
against its pure-JS fallback over a realistic full JS↔wasm round-trip (median of
several reps, plus a correctness `maxdiff` column). It is AS-vs-JS only — the former
native-WASM build was removed when AssemblyScript became the sole WASM toolchain. See
`docs/BENCHMARK_RESULTS.md` for a dated snapshot of measured numbers.

---

## Environment Variables

There is no WASM backend-selection environment variable. AssemblyScript is the sole
WASM backend. WASM is loaded automatically when the binary is present and the
operation is above the size threshold, with transparent fallback to JS. Likewise the
GPU tier is off by default (`enableGpu()` opt-in) because it is f32-only.

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
| totalExports         | 7564  | dependency-graph.json |
| totalTypeScriptFiles | 1824  | dependency-graph.json |

# MathTS API Reference

**Generated**: 2026-04-03

---

## @mathts/core

### Numeric Types

| Type | Methods | Description |
|------|---------|-------------|
| `Complex` | 83 | Complex number (real + imaginary), full trig/hyperbolic/transcendental |
| `Fraction` | 61 | Exact rational number, arithmetic + comparison + rounding |
| `BigNumber` | 96 | Arbitrary-precision decimal, arithmetic + comparison (no trig/transcendental yet) |

**Complex key groups**: `add`, `subtract`, `multiply`, `divide`, `pow`, `sqrt`, `nthRoot`, `exp`, `ln`, `log`, `log10`, `log2`, `abs`, `arg`, `conjugate`, `inverse`, `negate`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`, `equals`, `isReal`, `isImaginary`, `isFinite`, `isNaN`, `isZero`, `fromPolar`, `toPolar`, `toJSON`, `toString`, `format`

**Fraction key groups**: `add`, `subtract`, `multiply`, `divide`, `pow`, `mod`, `gcd`, `abs`, `negate`, `inverse`, `ceil`, `floor`, `round`, `trunc`, `compare`, `equals`, `lessThan`, `greaterThan`, `isInteger`, `isZero`, `isNegative`, `isPositive`, `isUnit`, `toDecimal`, `toLatex`, `toMixed`, `toContinuedFraction`, `toJSON`, `toString`

**BigNumber key groups**: `add`, `subtract`, `multiply`, `divide`, `pow`, `mod`, `sqrt`, `cbrt`, `abs`, `negate`, `ceil`, `floor`, `round`, `trunc`, `sign`, `compare`, `equals`, `lessThan`, `greaterThan`, `isFinite`, `isInfinite`, `isNaN`, `isInteger`, `isZero`, `isNegative`, `isPositive`, `exp`, `ln`, `log10`, `log1p`, `log2`, `hypot`, `atan2`, `fromBigInt`, `toBigInt`, `toJSON`, `toString`, `config`, `resetConfig`

**Static methods** (all three types): `parse`, `fromJSON`, `fromNumber`, `compare`

### Type Guards

```typescript
isComplex(x)    isFraction(x)    isBigNumber(x)    isNumber(x)
isString(x)     isBoolean(x)     isArray(x)        isFunction(x)
isObject(x)     isNull(x)        isUndefined(x)    isMatrix(x)
```

### Constants

| Namespace | Constants |
|-----------|-----------|
| Complex | `COMPLEX_ZERO`, `COMPLEX_ONE`, `COMPLEX_NEG_ONE`, `COMPLEX_I` |
| Fraction | `FRACTION_ZERO`, `FRACTION_ONE`, `FRACTION_NEG_ONE`, `FRACTION_HALF`, `FRACTION_THIRD`, `FRACTION_QUARTER` |
| BigNumber | `BIGNUMBER_ZERO`, `BIGNUMBER_ONE`, `BIGNUMBER_NEG_ONE`, `BIGNUMBER_TEN`, `BIGNUMBER_PI`, `BIGNUMBER_E`, `BIGNUMBER_LN2`, `BIGNUMBER_LN10` |

### Factory System

| Symbol | Description |
|--------|-------------|
| `createFactory(name, deps, factory)` | Register a named function factory |
| `FunctionRegistry` | Global registry for function factories |
| `registry` | Default registry instance |
| `math` | Fully configured math singleton |
| `DEFAULT_CONFIG` | Default MathTS configuration |

### Typed Function System

| Symbol | Description |
|--------|-------------|
| `mathTyped` | Default typed-function instance (15 types, `instanceof`-based) |
| `createMathTSTyped()` | Create a new typed-function instance |
| `TypeRegistry` | Registry for type definitions and conversions |
| `MATHTS_TYPES` | Built-in type definitions |
| `MATHTS_CONVERSIONS` | Built-in type conversions |

---

## @mathts/functions

All exports come from `functions/src/typed/`. 95 total exports across 4 modules.

### Arithmetic (48 exports)

| Group | Functions |
|-------|-----------|
| Basic | `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus` |
| Exponent/root | `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1` |
| Rounding | `round`, `floor`, `ceil`, `fix` |
| Integer math | `mod`, `gcd`, `lcm`, `xgcd` |
| Aggregation | `abs`, `sign`, `norm`, `min`, `max`, `sum`, `mean`, `variance`, `std`, `dot` |
| Hyperbolic | `sinh`, `cosh`, `tanh` |
| Comparison | `equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare` |
| Parallel utils | `shouldParallelize`, `getComputePool` |
| Module | `typedArithmetic` |

### Trigonometry (20 exports)

`sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `atan2`,
`acsc`, `asec`, `acot`, `asinh`, `acosh`, `atanh`, `toRadians`, `toDegrees`, `hypot`, `typedTrigonometry`

### Statistics (19 exports)

All stat functions are parallel-first and return `Promise<ParallelResult<T>>` for array inputs.
Variadic overloads (2–4 numbers) are synchronous.

`parallelStatSum`, `parallelStatMean`, `parallelStatVariance`, `parallelStatStd`,
`parallelStatMin`, `parallelStatMax`, `parallelStatMinMax`, `parallelStatMedian`,
`parallelStatMode`, `parallelStatProd`, `parallelStatNorm`, `parallelStatDistance`,
`parallelStatCorr`, `parallelStatMAD`, `parallelStatCumsum`, `parallelStatQuantile`,
`parallelStatHistogram`, `NormalizationType`, `typedStatistics`

### Signal Processing (8 exports)

`parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`, `parallelFFTPower`,
`parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `typedSignal`

---

## @mathts/matrix

### Matrix Types

| Type | Description |
|------|-------------|
| `DenseMatrix` | Float64Array-backed dense matrix, numbers only |
| `SparseMatrix` | Compressed Sparse Column (CSC) format |
| `Matrix` | Abstract base class |

Type guards: `isDenseMatrix(x)`, `isSparseMatrix(x)`, `isMatrix(x)`

### Decompositions

SVD, LU, QR, Cholesky, eigendecomposition (symmetric matrices)

### Configuration

- `getConfig()` / `setConfig(config)` / `resetConfig()`
- `setBackendPreference(pref)` — set backend preference order
- `forceBackend(name)` — force a specific backend
- `getRecommendedBackend()` — get optimal backend for environment

### Backends

| Backend | Methods | Threshold | Notes |
|---------|---------|-----------|-------|
| `JSBackend` | 28 | Default | Always available, pure TypeScript |
| `WASMBackend` | 63 | >1K elements | AssemblyScript + SIMD; LU, QR, Cholesky, eigenvalues |
| `GPUBackend` | 40 | >100K elements | WebGPU compute shaders; matmul, transpose, scale |
| `ParallelBackend` | 35 | Configurable | WebWorker-backed elementwise and matmul |
| `BackendManager` | 51 | Adaptive | Auto-selects and falls back; adaptive threshold tuning |

**BackendManager key methods**: `selectBackend`, `executeWithFallback`, `fallback`, `getActiveBackend`, `getAdaptiveThresholds`, `getPerformanceStats`, `forceBackend`, `maybeAdjustThresholds`, `onConfigChange`, `destroy`

- `enableProfiling()` / `disableProfiling()`
- `enableAdaptiveTuning()` / `disableAdaptiveTuning()`

---

## @mathts/parallel

### Pool Management

| Symbol | Description |
|--------|-------------|
| `ComputePool` | Worker pool manager class |
| `computePool` | Default ComputePool instance (singleton) |
| `Transfer` | Wrapper for zero-copy transferable objects |

### Operations (40+ parallel functions)

| Group | Functions |
|-------|-----------|
| Elementwise | `parallelAdd`, `parallelSubtract`, `parallelMultiply`, `parallelDivide`, `parallelScale`, `parallelAbs`, `parallelNegate`, `parallelSquare`, `parallelSqrt`, `parallelExp`, `parallelLog` |
| Matrix | `parallelMatmul`, `parallelMatvec`, `parallelTranspose`, `parallelOuter`, `parallelDot` |

### Strategies

- `calculateOptimalChunks(data, workers)` — compute chunk sizes
- `shouldParallelize(size)` — size threshold check (7 threshold categories)
- `ThresholdDispatcher` — adaptive parallelization dispatch

### Result Type

```typescript
interface ParallelResult<T> {
  result: T;
  duration: number;      // execution time in ms
  chunks: number;        // number of chunks used
  parallelized: boolean; // true if workers were used
}
```

---

## @mathts/compat

Provides a mathjs-compatible API surface. 54 shim functions, all wired to real implementations.

```typescript
import { create, all } from '@mathts/compat';

const math = create(all);
math.add(1, 2);
math.multiply(2, 3);
math.matrix([[1, 2], [3, 4]]);
```

| Symbol | Description |
|--------|-------------|
| `create(factories)` | Create a configured math instance |
| `all` | All available factories for full API |
| `MathInstance` | Type for the created math object |

Re-exports all core types: `Complex`, `Fraction`, `BigNumber`, `DenseMatrix`, `SparseMatrix`, `ComputePool`, and all typed functions.

---

## @mathts/expression

> **Status**: Parser is ported and builds. Compiler and evaluator are empty stubs. Zero tests. Not connected to `@mathts/core`.

| Symbol | Description |
|--------|-------------|
| `parse(expr)` | Parse expression string to AST |
| Node types | 16 node types (AssignmentNode, BlockNode, ConstantNode, FunctionNode, OperatorNode, SymbolNode, etc.) |

---

## @mathts/workbook

> **Status**: Infrastructure works (dep graph, topological sort, reactive engine). `executeCode()` throws "not yet implemented". No integration with expression parser.

### Parsing

| Symbol | Description |
|--------|-------------|
| `parseWorkbook(yaml)` | Parse `.mtsw` YAML string to `Workbook` |
| `serializeWorkbook(wb)` | Serialize `Workbook` back to YAML |
| `stripOutputs(wb)` | Remove computed outputs |
| `detectCellType(value)` | Detect cell content type |

### Dependency Graph

| Symbol | Description |
|--------|-------------|
| `buildDependencyGraph(cells)` | Build cell dependency graph |
| `topologicalSort(graph)` | Compute execution order |
| `getDependents(graph, cellId)` | Get downstream dependents |
| `detectCycles(graph)` | Check for circular references |

### Execution

| Symbol | Description |
|--------|-------------|
| `WorkbookExecutor` | Executes workbook cells |
| `createExecutor(workbook, config)` | Create executor instance |

Execution modes: `reactive` (re-run downstream on change), `sequential` (all cells in order), `manual` (explicit trigger only).

---

## @mathts/typed-function (package)

Forked type dispatch system. Provides the `typed()` function used by `@mathts/core`.

## @mathts/workerpool (package)

Forked worker pool management. Used internally by `@mathts/parallel`.

---

## WASM Module (assembly/)

209 exported operations from AssemblyScript source.

| Category | Count | Examples |
|----------|-------|---------|
| Scalar f64 | 52 | `add_f64`, `sin_f64`, `exp_f64`, `log_f64`, `PI`, `E` |
| Array ops | 36 | `array_add`, `array_dot`, `array_norm`, `array_sum`, `array_mean` |
| Matrix ops | 41 | `matrix_multiply`, `matrix_transpose`, `matrix_gemm`, `matrix_lu*` |
| Complex scalar | 44 | `complex_add`, `complex_sin`, `complex_exp`, `complex_sqrt` |
| Complex array | 33 | `complex_array_add`, `complex_array_dot`, `complex_array_norm` |

WASM bindings: `loadWasm()`, `loadWasmSync()`, `MathTSWasm` (instance type)

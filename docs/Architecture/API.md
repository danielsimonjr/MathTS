# MathTS API Reference

**Generated**: 2026-02-06

## @mathts/core

### Numeric Types

| Type | Description |
|------|-------------|
| `Complex` | Complex number (real + imaginary) |
| `Fraction` | Exact rational number |
| `BigNumber` | Arbitrary-precision decimal |

### Type Guards

`isComplex(x)`, `isFraction(x)`, `isBigNumber(x)`, `isNumber(x)`,
`isString(x)`, `isBoolean(x)`, `isArray(x)`, `isFunction(x)`,
`isObject(x)`, `isNull(x)`, `isUndefined(x)`, `isMatrix(x)`

### Constants

**Complex**:
`I`, `COMPLEX_ZERO`, `COMPLEX_ONE`, `COMPLEX_NEG_ONE`

**Fraction**:
`FRACTION_ZERO`, `FRACTION_ONE`, `FRACTION_NEG_ONE`,
`FRACTION_HALF`, `FRACTION_THIRD`, `FRACTION_QUARTER`

**BigNumber**:
`BIGNUMBER_ZERO`, `BIGNUMBER_ONE`, `BIGNUMBER_NEG_ONE`,
`BIGNUMBER_TEN`, `BIGNUMBER_PI`, `BIGNUMBER_E`,
`BIGNUMBER_LN2`, `BIGNUMBER_LN10`

### Factory System

- `createFactory(name, dependencies, factory)` - Register a function factory
- `FunctionRegistry` - Global registry for function factories
- `registry` - Default registry instance
- `math` - Fully configured math singleton
- `DEFAULT_CONFIG` - Default MathTS configuration

### Typed Function System

- `mathTyped` - Default typed-function instance
- `createMathTSTyped()` - Create a new typed-function instance
- `TypeRegistry` - Registry for type definitions and conversions
- `MATHTS_TYPES` - Built-in type definitions
- `MATHTS_CONVERSIONS` - Built-in type conversions
---

## @mathts/matrix

### Matrix Types

- `DenseMatrix` - Dense matrix backed by typed arrays
- `SparseMatrix` - Compressed Sparse Column (CSC) format
- `Matrix` - Abstract base class
- `isDenseMatrix(x)`, `isSparseMatrix(x)`, `isMatrix(x)`

### Configuration

- `getConfig()` / `setConfig(config)` / `resetConfig()`
- `setBackendPreference(pref)` - Set backend preference order
- `forceBackend(name)` - Force a specific backend
- `getRecommendedBackend()` - Get optimal backend for environment

### Backends

- `BackendRegistry` - Registry of available backends
- `BackendManager` - Automatic backend selection
- `JSBackend`, `WASMBackend`, `GPUBackend`
- `enableProfiling()` / `disableProfiling()`
- `enableAdaptiveTuning()` / `disableAdaptiveTuning()`

---

## @mathts/functions

### Arithmetic

`add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`,
`abs`, `sign`, `pow`, `sqrt`, `square`, `cube`, `cbrt`,
`nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`

### Trigonometry

`sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`,
`sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh`

### Statistics

`mean`, `median`, `variance`, `std`, `min`, `max`,
`sum`, `prod`, `mode`, `quantile`

Variadic overloads (2-4 numbers) are synchronous. Array overloads return Promise.

### Signal Processing

`fft`, `ifft`, `convolve`, `correlate`, `filter`, `magnitude`, `phase`

---

## @mathts/parallel

### Pool Management

- `computePool` - Default ComputePool instance
- `ComputePool` - Worker pool manager class
- `Transfer` - Wrapper for zero-copy transferable objects

### Elementwise Operations

`parallelAdd`, `parallelSubtract`, `parallelMultiply`, `parallelDivide`,
`parallelScale`, `parallelAbs`, `parallelNegate`, `parallelSquare`,
`parallelSqrt`, `parallelExp`, `parallelLog`

### Matrix Operations

`parallelMatmul`, `parallelMatvec`, `parallelTranspose`,
`parallelOuter`, `parallelDot`

### Strategies

- `calculateOptimalChunks(data, workers)` - Compute chunk sizes
- `shouldParallelize(size)` - Size threshold check
- `ThresholdDispatcher` - Adaptive parallelization dispatch
### Result Type

```typescript
interface ParallelResult<T> {
  result: T;
  duration: number;    // execution time in ms
  chunks: number;      // number of chunks used
  parallelized: boolean; // true if workers were used
}
```

---

## @mathts/workbook

### Parsing

- `parseWorkbook(yaml)` - Parse .mtsw YAML string to Workbook
- `serializeWorkbook(wb)` - Serialize Workbook back to YAML
- `stripOutputs(wb)` - Remove computed outputs
- `detectCellType(value)` - Detect cell content type

### Dependency Graph

- `buildDependencyGraph(cells)` - Build cell dependency graph
- `topologicalSort(graph)` - Compute execution order
- `getDependents(graph, cellId)` - Get downstream dependents
- `detectCycles(graph)` - Check for circular references

### Execution

- `WorkbookExecutor` - Executes workbook cells
- `createExecutor(workbook, config)` - Create executor instance

Execution modes: reactive, sequential, manual.

---

## @mathts/compat

Provides a mathjs-compatible API surface.

```typescript
import { create, all } from "@mathts/compat";

const math = create(all);
math.add(1, 2);
math.multiply(2, 3);
math.matrix([[1, 2], [3, 4]]);
```

- `create(factories)` - Create a configured math instance
- `all` - All available factories for full API

Re-exports all core types: Complex, Fraction, BigNumber, DenseMatrix,
SparseMatrix, ComputePool, and all typed functions.

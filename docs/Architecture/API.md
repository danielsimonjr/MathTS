# MathTS API Reference

**Generated**: 2026-07-01

---

## @danielsimonjr/mathts-core

### Numeric Types

| Type        | Methods | Description                                                                       |
| ----------- | ------- | --------------------------------------------------------------------------------- |
| `Complex`   | 83      | Complex number (real + imaginary), full trig/hyperbolic/transcendental            |
| `Fraction`  | 61      | Exact rational number, arithmetic + comparison + rounding                         |
| `BigNumber` | 96      | Arbitrary-precision decimal, arithmetic + comparison (no trig/transcendental yet) |

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

| Namespace | Constants                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Complex   | `COMPLEX_ZERO`, `COMPLEX_ONE`, `COMPLEX_NEG_ONE`, `COMPLEX_I`                                                                             |
| Fraction  | `FRACTION_ZERO`, `FRACTION_ONE`, `FRACTION_NEG_ONE`, `FRACTION_HALF`, `FRACTION_THIRD`, `FRACTION_QUARTER`                                |
| BigNumber | `BIGNUMBER_ZERO`, `BIGNUMBER_ONE`, `BIGNUMBER_NEG_ONE`, `BIGNUMBER_TEN`, `BIGNUMBER_PI`, `BIGNUMBER_E`, `BIGNUMBER_LN2`, `BIGNUMBER_LN10` |

### Factory System

| Symbol                               | Description                            |
| ------------------------------------ | -------------------------------------- |
| `createFactory(name, deps, factory)` | Register a named function factory      |
| `FunctionRegistry`                   | Global registry for function factories |
| `registry`                           | Default registry instance              |
| `math`                               | Fully configured math singleton        |
| `DEFAULT_CONFIG`                     | Default MathTS configuration           |

### Typed Function System

| Symbol                | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| `mathTyped`           | Default typed-function instance (15 types, `instanceof`-based) |
| `createMathTSTyped()` | Create a new typed-function instance                           |
| `TypeRegistry`        | Registry for type definitions and conversions                  |
| `MATHTS_TYPES`        | Built-in type definitions                                      |
| `MATHTS_CONVERSIONS`  | Built-in type conversions                                      |

---

## @danielsimonjr/mathts-functions

`functions/src/index.ts` exports the typed layer (`functions/src/typed/`, 374+
exports across 20 modules), the factory layer (`functions/src/factories/`), and
the expression evaluator — roughly 828 exports total.

### Arithmetic (56 exports)

| Group          | Functions                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Basic          | `add`, `subtract`, `multiply`, `divide`, `unaryMinus`, `unaryPlus`                                             |
| Exponent/root  | `pow`, `sqrt`, `square`, `cube`, `cbrt`, `nthRoot`, `exp`, `log`, `log10`, `log2`, `log1p`, `expm1`, `sigmoid` |
| Rounding       | `round`, `floor`, `ceil`, `fix`, `clamp`                                                                       |
| Integer math   | `mod`, `gcd`, `lcm`, `xgcd`                                                                                    |
| Aggregation    | `abs`, `sign`, `norm`, `min`, `max`, `sum`, `mean`, `variance`, `std`, `dot`                                   |
| Hyperbolic     | `sinh`, `cosh`, `tanh`                                                                                         |
| Comparison     | `equal`, `smaller`, `larger`, `smallerEq`, `largerEq`, `compare`                                               |
| Parallel utils | `shouldParallelize`, `getComputePool`                                                                          |
| Module         | `typedArithmetic`                                                                                              |

### Trigonometry (29 exports)

`sin`, `cos`, `tan`, `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `atan2`,
`acsc`, `asec`, `acot`, `asinh`, `acosh`, `atanh`, `toRadians`, `toDegrees`, `hypot`, `typedTrigonometry`

### Statistics (59 exports)

All stat functions are parallel-first and return `Promise<ParallelResult<T>>` for array inputs.
Variadic overloads (2–4 numbers) are synchronous.

`parallelStatSum`, `parallelStatMean`, `parallelStatVariance`, `parallelStatStd`,
`parallelStatMin`, `parallelStatMax`, `parallelStatMinMax`, `parallelStatMedian`,
`parallelStatMode`, `parallelStatProd`, `parallelStatNorm`, `parallelStatDistance`,
`parallelStatCorr`, `parallelStatMAD`, `parallelStatCumsum`, `parallelStatQuantile`,
`parallelStatHistogram`, `parallelStatPercentile`, `NormalizationType`, `typedStatistics`

Descriptive & time-series (gap-closure): `mean`, `median`, `mode`, `variance`,
`std`, `sum`, `prod`, `min`, `max`, `quantileSeq`, `mad`, `corr`, `skewness`,
`kurtosis`, `moment`, `cov`, `corrcoef`, `gmean`, `hmean`, `iqr`, `sem`, `zscore`,
`rankdata`, `logsumexp`, `softmax`, `cumsum`, `cumprod`, `cummax`, `cummin`,
`cumtrapz`, `movingAverage`, `ewma`, `detrend`, `acf`, `linearRegression`,
`kmeans`, `spectralClustering`

### Signal Processing (44 exports)

`parallelFFT`, `parallelIFFT`, `parallelFFTMagnitude`, `parallelFFTPower`,
`parallelConv`, `parallelXCorr`, `parallelAutoCorr`, `crossCorrelation`,
`autoCorrelation`, `groupDelay`, `unwrapPhase`, `stft`, window functions,
FIR/IIR filtering: `firwin`, `butter`, `lfilter`, `lfilterZi`, `filtfilt`;
spectral estimation: `welchPSD`, `bartlettPSD`, `multiTaperPSD`, `goertzel`,
`chirpZTransform`; and 20+ additional signal processing utilities. `typedSignal`

### Special Functions (42 exports)

Higher-order mathematical functions not in standard mathjs.

`erfc`, `beta`, `gammainc`, `digamma`, `besselJ0`, `besselJ1`, `besselY0`, `besselY1`,
Legendre polynomials, Chebyshev polynomials, Laguerre polynomials, Riemann zeta,
hypergeometric functions, Carlson elliptic integrals (`carlsonRC`, `carlsonRD`,
`carlsonRF`, `carlsonRJ`), incomplete elliptic `ellipticEIncomplete`,
`erfcScalar`, and more. `typedSpecial`

### Distributions (42 exports)

Probability distribution PDF/CDF/PMF/quantile and sampling functions.

`normalPDF`, `normalCDF`, `normalQuantile`, `exponentialPDF`, `exponentialCDF`,
`poissonPMF`, `binomialPMF`, `geometricPMF`, `bernoulliPMF`, `entropy`,
`jsDivergence`, `kldivergence`, `random`, `randomInt`, `pickRandom`, plus the
full CDF/PDF/quantile surface for beta, gamma, chi-squared, F and Student-t
(`betaCDF`/`betaPDF`/`betaQuantile`, `gammaCDF`/`gammaPDF`/`gammaQuantile`,
`chiSquaredCDF`/`chiSquaredQuantile`, `fCDF`/`fQuantile`,
`studentTCDF`/`studentTPDF`/`studentTQuantile`), the Cauchy/Laplace/logistic
family (`cauchyCDF`/`cauchyPDF`/`cauchyQuantile`,
`laplaceCDF`/`laplacePDF`/`laplaceQuantile`,
`logisticCDF`/`logisticPDF`/`logisticQuantile`), `noncentralChi2PDF`, and the
studentized range (`studentizedRangeCDF`, `studentizedRangeQuantile`).

### Integration (4 exports)

Numerical integration methods. All accept a callback `f: (x: number) => number`.

`trapz`, `simpson`, `gaussQuad`, `romberg`

### Interpolation (9 exports)

Curve fitting and interpolation. Functions that return interpolant functions or fitted values.

`linearInterp`, `lagrangeInterp`, `cubicSpline`, `hermiteInterp`, `pchipInterp`, `polyFit`,
`newtonInterp`, `chebyshevFit`, `legendreFit`

### Combinatorics (31 exports)

Integer sequence and combinatorial functions.

`fibonacci`, `lucas`, `doubleFactorial`, `risingFactorial`, `fallingFactorial`, `subfactorial`,
`partition`, Stirling numbers (first/second kind), Bell numbers, Catalan numbers,
derangements, and more.

### Geometry (42 exports)

2D and 3D geometric operations on number arrays.

`angle2D`, `angle3D`, `cross3D`, `dot3D`, `triangleArea`, `polygonArea`, `convexHull`,
`pointInPolygon`, `rotateVector2D`, `rotateVector3D`, `reflectVector`, `projectVector`,
`distance2D`, `distance3D`, `distanceND`, `distancePointToLine2D`,
`intersectLines2D`, `intersectSegments2D`, `convexHull3D`, `haversine`, `slerp`,
quaternion ops (`quaternionMultiply`, `quaternionRotate`, `quaternionNormalize`,
`quaternionConjugate`, `quaternionFromAxisAngle`, `quaternionToRotationMatrix`),
Bezier curves, B-splines, Voronoi diagrams, and more.

### Algebra (46 exports)

Polynomial and algebraic manipulation.

`polyval`, `polyadd`, `polymul`, `polyder`, `polynomialGCD`, `polynomialLCM`,
`polynomialQuotient`, `polynomialRemainder`, `degree`, `coefficientList`,
`discriminant`, `differences`, `variables`, `substitute`, `expand`, `factor`,
`collect`, `cancel`, `together`, `apart`, `trigExpand`, `trigReduce`,
`trigToExp`, `expToTrig`, `reduce`, `combine`, `complexExpand`, `normalForm`,
`powerExpand`, `fullSimplify`, `eliminate`, `functionExpand`, `resultant`, `typedAlgebra`

### CAS — Computer Algebra System (36 exports)

Symbolic calculus and computer algebra operations.

`integrate`, `limit`, `partialDerivative`, `directionalDerivative`, `gradientSymbolic`,
`jacobian`, `laplacian`, `divergence`, `curl`, `laplace`, `inverseLaplace`,
`fourierSeries`, `zTransform`, `taylor`, `multivariateTaylor`, `series`,
`seriesCoefficient`, `solve`, `implicitDiff`, `summation`, `symbolicProduct`,
`assume`, `getAssumptions`, `clearAssumptions`, `asymptotic`, `groebnerBasis`,
`minimalPolynomial`, `toRadicals`, `piecewise`, `odeGeneral`, `symbolicIntegral`,
`inverseLaplaceTransform`, `casDerivative`, `casExpand`, `casFactor`, `casSimplify`

### Graph Theory (11 exports)

Graph algorithms on adjacency matrix representations.

`adjacencyMatrix`, `shortestPath`, `minimumSpanningTree`, `connectedComponents`,
`stronglyConnectedComponents`, `topologicalSort`, `isConnected`, `graphDistance`,
`pageRank`, `betweennessCentrality`, `eigenvectorCentrality`

### Distribution Objects (13 exports)

Statistical distribution factory functions returning objects with `pdf`, `cdf`, `ppf`, and `sample` methods.

`normalDist`, `betaDist`, `binomialDist`, `chiSquaredDist`, `exponentialDist`,
`fDist`, `gammaDist`, `logNormalDist`, `poissonDist`, `tDist`, `uniformDist`,
`weibullDist`, `Distribution` (interface)

### Hypothesis Tests (20 exports)

Statistical hypothesis tests and multivariate analysis.

`studentTTest`, `chiSquareTest`, `anova`, `kolmogorovSmirnovTest`, `mannWhitneyTest`,
`shapiroWilkTest`, `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`,
`tukeyHSD`, `principalComponentAnalysis`, plus result interfaces:
`TTestResult`, `ChiSquareResult`, `AnovaResult`, `KSTestResult`, `MannWhitneyResult`,
`ShapiroWilkResult`, `PCAResult`

### Numerical Methods (45 exports)

Root-finding, optimization, linear systems, advanced interpolation, and curve fitting.

`findRoot`, `linsolve`, `minimize`, `maximize`, `globalMinimize`, `nelderMead`,
`gradientDescent`, `levenbergMarquardt`, `leastSquares`, `nintegrate`, `simpsons`,
`interpolate`, `cspline`, `pchip`, `bezierCurve`, `bspline`, `loess`, `griddata`,
`rbfInterpolate`, `curvefit`, `expfit`, numerical differentiation `gradient`,
`hessian`, `derivativeAt`, `gradientAt`, `valueAndDerivativeAt`, plus option
interfaces: `FindRootOptions`, `MinimizeOptions`

---

## @danielsimonjr/mathts-matrix

### Matrix Types

| Type           | Description                                    |
| -------------- | ---------------------------------------------- |
| `DenseMatrix`  | Float64Array-backed dense matrix, numbers only |
| `SparseMatrix` | Compressed Sparse Column (CSC) format          |
| `Matrix`       | Abstract base class                            |

Type guards: `isDenseMatrix(x)`, `isSparseMatrix(x)`, `isMatrix(x)`

### Decompositions

SVD, LU, QR, Cholesky, eigendecomposition (symmetric matrices)

### Configuration

- `getConfig()` / `setConfig(config)` / `resetConfig()`
- `setBackendPreference(pref)` — set backend preference order
- `forceBackend(name)` — force a specific backend
- `getRecommendedBackend()` — get optimal backend for environment

### Backends

| Backend           | Methods | Threshold      | Notes                                                  |
| ----------------- | ------- | -------------- | ------------------------------------------------------ |
| `JSBackend`       | 28      | Default        | Always available, pure TypeScript                      |
| `WASMBackend`     | 63      | ≥256 elements  | AssemblyScript + SIMD; matmul, LU, QR, Cholesky        |
| `GPUBackend`      | 40      | >100K elements | WebGPU compute shaders; matmul, transpose, scale       |
| `ParallelBackend` | 35      | Configurable   | WebWorker-backed elementwise and matmul                |
| `BackendManager`  | 51      | Adaptive       | Auto-selects and falls back; adaptive threshold tuning |

**BackendManager key methods**: `selectBackend`, `executeWithFallback`, `fallback`, `getActiveBackend`, `getAdaptiveThresholds`, `getPerformanceStats`, `forceBackend`, `maybeAdjustThresholds`, `onConfigChange`, `destroy`

- `enableProfiling()` / `disableProfiling()`
- `enableAdaptiveTuning()` / `disableAdaptiveTuning()`

---

## @danielsimonjr/mathts-parallel

### Pool Management

| Symbol        | Description                                |
| ------------- | ------------------------------------------ |
| `ComputePool` | Worker pool manager class                  |
| `computePool` | Default ComputePool instance (singleton)   |
| `Transfer`    | Wrapper for zero-copy transferable objects |

### Operations (40+ parallel functions)

| Group       | Functions                                                                                                                                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elementwise | `parallelAdd`, `parallelSubtract`, `parallelMultiply`, `parallelDivide`, `parallelScale`, `parallelAbs`, `parallelNegate`, `parallelSquare`, `parallelSqrt`, `parallelExp`, `parallelLog` |
| Matrix      | `parallelMatmul`, `parallelMatvec`, `parallelTranspose`, `parallelOuter`, `parallelDot`                                                                                                   |

### Strategies

- `calculateOptimalChunks(data, workers)` — compute chunk sizes
- `shouldParallelize(size)` — size threshold check (7 threshold categories)
- `ThresholdDispatcher` — adaptive parallelization dispatch

### Result Type

```typescript
interface ParallelResult<T> {
  result: T;
  duration: number; // execution time in ms
  chunks: number; // number of chunks used
  parallelized: boolean; // true if workers were used
}
```

---

## @danielsimonjr/mathts-compat

Provides a mathjs-compatible API surface. 54 shim functions, all wired to real implementations.

```typescript
import { create, all } from '@danielsimonjr/mathts-compat';

const math = create(all);
math.add(1, 2);
math.multiply(2, 3);
math.matrix([
  [1, 2],
  [3, 4],
]);
```

| Symbol              | Description                          |
| ------------------- | ------------------------------------ |
| `create(factories)` | Create a configured math instance    |
| `all`               | All available factories for full API |
| `MathInstance`      | Type for the created math object     |

Re-exports all core types: `Complex`, `Fraction`, `BigNumber`, `DenseMatrix`, `SparseMatrix`, `ComputePool`, and all typed functions.

---

## @danielsimonjr/mathts-expression

> **Status**: Fully functional (v0.2.0). Parser, compiler (16-node-type AST interpreter), and evaluator all work end-to-end. The evaluator is sandbox-hardened (2026-05-01 security release).

| Symbol                    | Description                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| `parse(expr)`             | Parse expression string to AST                                                                        |
| `compileExpression(expr)` | Compile an expression to a reusable evaluable form                                                    |
| `evaluate(expr, scope?)`  | Evaluate an expression string and return the result                                                   |
| Node types                | 16 node types (AssignmentNode, BlockNode, ConstantNode, FunctionNode, OperatorNode, SymbolNode, etc.) |

---

## @danielsimonjr/mathts-workbook

> **Status**: Fully functional. Infrastructure works (dep graph, topological sort, reactive engine), and `executeCode()` is implemented — cells are evaluated through `evaluate()` from the functions package.

### Parsing

| Symbol                  | Description                             |
| ----------------------- | --------------------------------------- |
| `parseWorkbook(yaml)`   | Parse `.mtsw` YAML string to `Workbook` |
| `serializeWorkbook(wb)` | Serialize `Workbook` back to YAML       |
| `stripOutputs(wb)`      | Remove computed outputs                 |
| `detectCellType(value)` | Detect cell content type                |

### Dependency Graph

| Symbol                         | Description                   |
| ------------------------------ | ----------------------------- |
| `buildDependencyGraph(cells)`  | Build cell dependency graph   |
| `topologicalSort(graph)`       | Compute execution order       |
| `getDependents(graph, cellId)` | Get downstream dependents     |
| `detectCycles(graph)`          | Check for circular references |

### Execution

| Symbol                             | Description              |
| ---------------------------------- | ------------------------ |
| `WorkbookExecutor`                 | Executes workbook cells  |
| `createExecutor(workbook, config)` | Create executor instance |

Execution modes: `reactive` (re-run downstream on change), `sequential` (all cells in order), `manual` (explicit trigger only).

---

## @danielsimonjr/mathts-tensor (package)

Rank-N, Float64Array-backed, row-major dense `Tensor` (v0.1.0). Supports einsum
and tensor contraction. Built on `@danielsimonjr/mathts-core`.

## @danielsimonjr/mathts-autograd (package)

Automatic differentiation over `Tensor` (v0.1.0). Provides forward-mode AD
(`DualTensor`, `forwardGrad`) and reverse-mode AD (`Tape`, `reverseGrad`).
Built on `@danielsimonjr/mathts-tensor`.

## @danielsimonjr/mathts-typed-function (package)

Forked type dispatch system. Provides the `typed()` function used by `@danielsimonjr/mathts-core`.

## @danielsimonjr/mathts-workerpool (package)

Forked worker pool management. Used internally by `@danielsimonjr/mathts-parallel`.

---

## WASM Modules

### AssemblyScript WASM (`assembly/`) — Sole WASM backend

The built `mathts-as.wasm` binary exports **314 functions** (326 total exports,
including 11 numeric globals such as `PI`/`E` plus the linear memory), compiled
from 28 AssemblyScript source files under `assembly/src/`. The same binary is
bundled into both `matrix/dist/wasm/` and `functions/dist/wasm/`. AssemblyScript
is the only WASM toolchain. Counts verified via `WebAssembly.Module.exports()` on
the built `.wasm`.

| Category                       | Function exports | Examples                                                           |
| ------------------------------ | ---------------- | ------------------------------------------------------------------ |
| Scalar f64                     | 79               | `add_f64`, `sin_f64`, `exp_f64`, `log_f64`                         |
| Array ops                      | 54               | `array_add`, `array_dot`, `array_norm`, `array_sum`, `array_mean`  |
| Matrix ops                     | 50               | `matrix_multiply`, `matrix_transpose`, `matrix_gemm`, `matrix_lu*` |
| Complex scalar                 | 46               | `complex_add`, `complex_sin`, `complex_exp`, `complex_sqrt`        |
| Complex array                  | 33               | `complex_array_add`, `complex_array_dot`, `complex_array_norm`     |
| FFT                            | 2                | `fft`, `ifft`                                                      |
| Special/poly/sort/signal/other | 54               | bessel/elliptic/carlson, `poly_mul`, `sort_f64`, window functions  |

WASM bindings: `loadWasm()`, `loadWasmSync()`, `MathTSWasm` (instance type)

---

## npm Scripts (WASM-related)

| Script                  | Command                                             | Description                                       |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------- |
| `build:wasm`            | `npm run asbuild -w @danielsimonjr/mathts-wasm`     | Build the AssemblyScript WASM backend             |
| `test:wasm`             | `npm run test -w @danielsimonjr/mathts-wasm`        | AssemblyScript WASM tests                         |
| `test:wasm:integration` | `vitest run tests/wasm/`                            | Cross-package WASM integration tests              |
| `bench:wasm`            | `npx tsx tools/benchmark/wasm/run.ts`               | Full AssemblyScript-vs-JS benchmark suite         |
| `bench:elementwise`     | `npx tsx tools/benchmark/wasm/elementwise.bench.ts` | Elementwise `array_<op>_ptr` kernels vs `Math.*`  |
| `bench:special`         | `npx tsx tools/benchmark/wasm/special.bench.ts`     | Special-function kernels (bessel/lgamma/elliptic) |
| `bench:sort`            | `npx tsx tools/benchmark/wasm/sort.bench.ts`        | `sort_f64` introsort vs JS comparator sort        |
| `bench:matrix`          | `npx tsx tools/benchmark/wasm/matrix.bench.ts`      | multiply / svd / eig / Welch-PSD (FFT) vs JS      |

The `tools/benchmark/wasm/` suite measures each AssemblyScript-accelerated path
against its pure-JS fallback over a realistic full JS↔wasm round-trip (median of
several reps, plus a correctness `maxdiff` column). It is AS-vs-JS only — the
former native-WASM build was removed when AssemblyScript became the sole WASM
toolchain. See `docs/BENCHMARK_RESULTS.md` for a dated snapshot of measured
numbers.

---

## Environment Variables

There is no WASM backend-selection environment variable. AssemblyScript is the
sole WASM backend. WASM is loaded automatically when the binary is present and the
operation is above the size threshold, with transparent fallback to JS.

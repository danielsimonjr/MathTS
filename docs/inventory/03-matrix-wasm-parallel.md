# Matrix, WASM & Parallel Inventory

## Matrix Backends

### JSBackend

- File: `matrix/src/backends/JSBackend.ts` (306 lines)
- Methods: `add`, `subtract`, `multiplyElementwise`, `divideElementwise`, `scale`, `multiply`, `transpose`, `dot`, `sum`, `sumAxis`, `norm`, `negate`, `abs`, `isAvailable`, `initialize`, `checkDimensionsMatch`, `checkMultiplyDimensions`
- Status: Real — pure TypeScript, always available, default fallback

### WASMBackend

- File: `matrix/src/backends/WASMBackend.ts` (886 lines)
- Methods: `add`, `subtract`, `multiplyElementwise`, `divideElementwise`, `scale`, `multiply`, `transpose`, `dot`, `sum`, `sumAxis`, `norm`, `negate`, `abs`, `isAvailable`, `initialize`, `luDecomposition`, `luDecompositionJS`, `qrDecomposition`, `qrDecompositionJS`, `choleskyDecomposition`, `choleskyDecompositionJS`, `inverse`, `inverseJS`, `determinantWasm`, `determinantJS`, `getConfig`, `updateConfig`, `getFeatures`, `shouldUseWasm`, `createWASMBackend`, `doInitialize`
- Status: Real — uses `WasmLoader` to allocate memory and call SIMD-capable WASM functions; JS fallbacks for all decompositions
- Activation threshold: >1,000 elements (default)

### GPUBackend / GPUMatrixBackend

- Files: `matrix/src/backends/GPUBackend.ts` (511 lines), `matrix/src/backends/GPUMatrixBackend.ts` (402 lines)
- GPUBackend methods: `initialize`, `destroy`, `add`, `scale`, `transpose`, `matmul`, `isReady`, `shouldUseGPU`, `capabilities`, `lastError`, `status`, `getStats`, `calculateWorkgroups`, `getContext`, `getShaderManager`, `getBufferPool`, `initializeGlobalGPUBackend`, `destroyGlobalGPUBackend`, `getGlobalGPUBackend`
- GPUMatrixBackend methods: `add`, `addAsync`, `subtract`, `multiplyElementwise`, `divideElementwise`, `scale`, `scaleAsync`, `multiply`, `multiplyAsync`, `transpose`, `transposeAsync`, `dot`, `sum`, `sumAxis`, `norm`, `negate`, `abs`, `isAvailable`, `initialize`, `doInitialize`, `destroy`, `getConfig`, `updateConfig`, `getCapabilities`, `getStats`, `shouldUseGPU`, `createGPUMatrixBackend`
- Status: Real WebGPU implementation — uses compute shaders, buffer pools, shader manager; requires WebGPU adapter
- Activation threshold: >100,000 elements (default)

### ParallelBackend

- File: `matrix/src/backends/ParallelBackend.ts` (381 lines)
- Methods: `add`, `subtract`, `multiplyElementwise`, `divideElementwise`, `scale`, `multiply`, `transpose`, `dot`, `sum`, `sumAxis`, `norm`, `negate`, `abs`, `isAvailable`, `initialize`, `terminate`, `isReady`, `getStats`, `shouldParallelize`, `checkDimensionsMatch`, `checkMultiplyDimensions`, `createParallelBackend`
- Status: Real — delegates to `@danielsimonjr/mathts-parallel` worker pool

### BackendManager

- File: `matrix/src/backends/BackendManager.ts` (641 lines)
- Methods: All arithmetic and linear algebra ops plus `selectBackend`, `getActiveBackend`, `getAvailableBackends`, `hasBackend`, `forceBackend`, `syncWithConfig`, `resetAdaptiveState`, `getAdaptiveThresholds`, `getPerformanceStats`, `recordSample`, `maybeAdjustThresholds`, `doInitialize`, `destroy`, `createBackendManager`
- Selection thresholds (from `matrix/src/config.ts`):
  - JS: always available, used below WASM threshold
  - WASM: >= 1,000 elements
  - GPU: >= 100,000 elements
  - Operation-specific override: decomposition WASM at 100 elements, GPU at 10,000 elements
- Adaptive tuning: samples runtime performance, adjusts WASM/GPU thresholds dynamically; GPU threshold floor at 1,000 elements

### MatrixWasmBridge

- File: `matrix/src/backends/MatrixWasmBridge.ts` (851 lines)
- Methods: `init`, `configure`, `cleanup`, `multiply`, `multiplyWasm`, `multiplyJS`, `eigsSymmetric`, `eigsSymmetricWasm`, `eigsSymmetricJS`, `fft`, `fftWasm`, `sqrtm`, `sqrtmWasm`, `sqrtmJS`, `expm`, `expmWasm`, `expmJS`, `luDecomposition`, `luDecompositionWasm`, `luDecompositionJS`, `inverse` (2x2, 3x3 variants), `cond1`, `cond1Wasm`, `cond1JS`, `condInf`, `condInfWasm`, `condInfJS`, `getCapabilities`, `operations`

### WasmLoader

- File: `matrix/src/backends/WasmLoader.ts` (1,070 lines)
- Methods: `load`, `loadModule`, `loadBrowserWasm`, `loadNodeWasm`, `getInstance`, `getModule`, `getCompiledModule`, `isLoaded`, `isPrecompiled`, `precompile`, `allocateFloat64Array`, `allocateFloat64ArrayEmpty`, `allocateInt32Array`, `allocateInt32ArrayEmpty`, `free`, `release`, `collect`, `getFromPool`, `clearPool`, `getPoolStats`, `getImports`, `getDefaultWasmPath`, `getLoadingMetrics`, `initWasm`, `reset`

---

## Matrix Operations

### `matrix/src/operations/svd.ts` (622 lines)

Exports: `svd`, `singularValues`, `pinv`, `lowRankApprox`, `cond`, `norm2`, `normFro`
Types: `SVDResult`, `SVDOptions`

### `matrix/src/operations/eig.ts` (761 lines)

Exports: `eig`, `eigvals`, `powerIteration`
Types: `EigResult`, `EigOptions`

### `matrix/src/operations/index.ts` (28 lines)

Re-exports all SVD and eigenvalue operations.

---

## DenseMatrix Methods (`matrix/src/types/DenseMatrix.ts`)

Construction: `constructor`, `diag` (static), `fill` (static), `random` (static)
Element access: `get`, `set`
Slicing: `row`, `column`, `slice`, `diagonal`
Arithmetic: `add`, `subtract`, `multiplyElementwise`, `multiply`, `scale`, `negate`
Linear algebra: `transpose`, `norm`
Reductions: `sum`, `mean`, `min`, `max`, `trace`
Conversion: `toArray`, `toFlatArray`, `toFloat64Array`, `toSparse`, `clone`
Iteration: `map`, `forEach`
Note: `determinant`, `inverse`, `eigenvalues` declared abstract in base `Matrix` class but not present in DenseMatrix — those are handled by operation modules (`eig.ts`, `svd.ts`) and the WASM bridge.

## SparseMatrix Methods (`matrix/src/types/SparseMatrix.ts`)

Element access: `get`, `set`
Slicing: `row`, `column`, `slice`, `diagonal`
Arithmetic: `add`, `subtract`, `multiplyElementwise`, `multiply`, `scale`, `negate`
Linear algebra: `transpose`, `norm`
Reductions: `sum`, `trace`
Conversion: `toArray`, `toFlatArray`, `toDense`, `clone`, `getCSR`
Iteration: `map`, `mapNonZeros`

---

## WASM Operations (`assembly/`)

### Scalar ops (`assembly/src/ops/scalar.ts`, 381 lines — 52 exports)

**Arithmetic**: `add_f64`, `sub_f64`, `mul_f64`, `div_f64`, `mod_f64`, `neg_f64`
**Power/roots**: `sqrt_f64`, `pow_f64`, `square_f64`, `cube_f64`, `cbrt_f64`, `nthRoot_f64`
**Exponential/log**: `exp_f64`, `expm1_f64`, `log_f64`, `log1p_f64`, `log10_f64`, `log2_f64`
**Trig**: `sin_f64`, `cos_f64`, `tan_f64`, `asin_f64`, `acos_f64`, `atan_f64`, `atan2_f64`
**Hyperbolic**: `sinh_f64`, `cosh_f64`, `tanh_f64`, `asinh_f64`, `acosh_f64`, `atanh_f64`
**Rounding/comparison**: `abs_f64`, `floor_f64`, `ceil_f64`, `round_f64`, `trunc_f64`, `sign_f64`, `min_f64`, `max_f64`, `clamp_f64`
**Predicates**: `isNaN_f64`, `isFinite_f64`
**Constants**: `PI`, `E`, `PHI`, `SQRT2`, `SQRT1_2`, `LN2`, `LN10`, `LOG2E`, `LOG10E`, `EPSILON`

### Array ops (`assembly/src/ops/array.ts`, 441 lines — 36 exports)

**Reductions**: `array_sum`, `array_product`, `array_mean`, `array_variance`, `array_stddev`, `array_min`, `array_max`, `array_argmin`, `array_argmax`
**Norms**: `array_norm`, `array_norm_l1`, `array_norm_linf`
**Vector ops**: `array_dot`, `array_add`, `array_sub`, `array_mul`, `array_div`, `array_scale`, `array_add_scalar`, `array_neg`, `array_abs`, `array_sqrt`, `array_square`, `array_exp`, `array_log`, `array_sin`, `array_cos`
**Linear algebra helpers**: `array_axpby`, `array_distance`, `array_cosine_similarity`
**In-place**: `array_scale_inplace`, `array_add_scalar_inplace`, `array_add_inplace`, `array_clamp_inplace`, `array_fill`, `array_copy`

### Complex scalar ops (`assembly/src/ops/complex-ops.ts`, 379 lines — 44 exports)

**Arithmetic**: `complex_add`, `complex_sub`, `complex_mul`, `complex_div`, `complex_neg`, `complex_conj`, `complex_reciprocal`
**Magnitude/phase**: `complex_abs`, `complex_arg`, `complex_abs_squared`
**Power/root**: `complex_sqrt`, `complex_pow`, `complex_cpow`, `complex_square`, `complex_cube`
**Exponential/log**: `complex_exp`, `complex_log`, `complex_log10`, `complex_log2`
**Trig**: `complex_sin`, `complex_cos`, `complex_tan`, `complex_asin`, `complex_acos`, `complex_atan`
**Hyperbolic**: `complex_sinh`, `complex_cosh`, `complex_tanh`, `complex_asinh`, `complex_acosh`, `complex_atanh`
**Predicates**: `complex_equals`, `complex_approx_equals`, `complex_is_zero`, `complex_is_real`, `complex_is_imaginary`, `complex_is_nan`, `complex_is_finite`
**Construction**: `complex_from_real`, `complex_from_imag`, `complex_from_polar`, `complex_to_polar`
**Linear algebra**: `complex_axpby`, `complex_distance`

### Complex array ops (`assembly/src/ops/complex-array.ts`, 438 lines — 33 exports)

Creation, element access, element-wise arithmetic, functions (abs, exp, log, sqrt), reductions, in-place operations — see source for full list.

### Matrix ops (`assembly/src/ops/matrix.ts`, 599 lines — 41 exports)

Creation: `matrix_zeros`, `matrix_ones`, `matrix_fill`, `matrix_identity`, `matrix_diag`
Element access: `matrix_get`, `matrix_set`, `matrix_get_row`, `matrix_get_col`, `matrix_get_diag`
Arithmetic: `matrix_add`, `matrix_sub`, `matrix_mul_elementwise`, `matrix_div_elementwise`, `matrix_scale`, `matrix_add_scalar`, `matrix_neg`
Multiplication: `matrix_multiply`, `matrix_vector_multiply`, `vector_matrix_multiply`, `matrix_outer`
Transpose: `matrix_transpose`
Reductions: `matrix_sum`, `matrix_mean`, `matrix_min`, `matrix_max`, `matrix_norm_frobenius`, `matrix_trace`, `matrix_sum_rows`, `matrix_sum_cols`
Predicates: `matrix_is_square`, `matrix_is_symmetric`, `matrix_is_diagonal`, `matrix_is_identity`
In-place: `matrix_scale_inplace`, `matrix_add_scalar_inplace`, `matrix_add_inplace`, `matrix_copy`
BLAS-like: `matrix_axpy`, `matrix_gemm`, `matrix_gemv`

### Total exported symbols: 209 (from `assembly/src/index.ts`)

### JS Bindings (`assembly/bindings/`)

- `assembly/bindings/wasm-loader.ts` — `MathTSWasm`, `MathTSWasmExports`, `MathTSWasmInstance`, `loadWasmSync`
- `assembly/bindings/index.ts` — `MathTSWasm`, `loadWasm`, `loadWasmSync`

---

## Parallel Package (`parallel/src/`)

### ComputePool (`parallel/src/ComputePool.ts`, 574 lines)

Exports: `ComputePool`, `computePool` (singleton), `Transfer`, `ComputePoolConfig`, `DEFAULT_POOL_CONFIG`, `ParallelResult`

- Worker pool management with configurable worker count
- `ParallelResult<T>` wraps results with `.result`, `.duration`, `.chunks`, `.parallelized`

### WorkerPool (`parallel/src/WorkerPool.ts`, 186 lines)

Exports: `WorkerPool`

- Lower-level worker lifecycle management

### Matrix Operations (`parallel/src/operations/matmul.ts`, 143 lines)

- `parallelMatmul`, `parallelMatvec`, `parallelTranspose`, `parallelOuter`, `parallelDot`
- Type: `MatmulOptions`

### Element-wise Operations (`parallel/src/operations/elementwise.ts`, 208 lines)

- `parallelAdd`, `parallelSubtract`, `parallelMultiply`, `parallelDivide`, `parallelScale`
- `parallelAbs`, `parallelNegate`, `parallelSquare`, `parallelSqrt`
- `parallelExp`, `parallelLog`, `parallelSin`, `parallelCos`, `parallelTan`
- `parallelElementwise` (generic binary), `parallelUnary` (generic unary)
- Type: `ElementwiseOptions`

### Reduction Operations (`parallel/src/operations/reduce.ts`, 215 lines)

- `parallelSum`, `parallelMean`, `parallelMin`, `parallelMax`, `parallelMinMax`
- `parallelVariance`, `parallelStd`, `parallelNorm`, `parallelDistance`
- `parallelHistogram`, `parallelReduce` (generic)
- Type: `ReduceOptions`

### Map/Transform Operations (`parallel/src/operations/map.ts`, 238 lines)

- `parallelMap`, `parallelFilter`, `parallelFind`, `parallelSort`
- `parallelForEach`, `parallelSome`, `parallelEvery`, `parallelCount`
- Type: `MapOptions`

### ParallelMatrix (`parallel/src/ParallelMatrix.ts`, 269 lines)

Exports: `ParallelMatrix`, `MatrixData`, `ParallelConfig`

- Matrix wrapper that auto-selects parallel execution

### Chunking Strategies (`parallel/src/strategies/chunk.ts`, 386 lines)

- `calculateOptimalChunks` — divides work based on worker count and element count
- `chunkFloat64Array` / `chunkArray` — split data into chunks
- `mergeFloat64Chunks` / `mergeArrayChunks` — recombine results
- `shouldParallelize` (alias: `shouldChunkParallelize`) — boolean threshold check
- `partitionRange` / `partition2D` — range-based and 2D partitioning
- `memorySizeBytes` — estimates memory footprint
- Types: `ChunkResult`, `ChunkInfo`, `ChunkOptions`

### Threshold Strategies (`parallel/src/strategies/threshold.ts`, 255 lines)

- `ThresholdDispatcher` class + `thresholdDispatcher` singleton
- `shouldParallelize(elementCount, category)` — boolean
- `dispatch(elementCount, category)` — returns `DispatchResult` with mode + reason
- `calculateChunks(elementCount, category)` — returns optimal worker count
- `DEFAULT_THRESHOLDS`:
  - `matmul`: 10,000 elements (~100x100)
  - `elementwise`: 50,000 elements
  - `reduce`: 100,000 elements
  - `map`: 10,000 elements
  - `sort`: 5,000 elements
  - `decomposition`: 2,500 elements (~50x50)
  - `general`: 50,000 elements
- Operation categories: `matmul`, `elementwise`, `reduce`, `map`, `sort`, `decomposition`, `general`
- Execution modes: `parallel` | `sequential`
- Chunk sizing strategy: CPU-bound (matmul) uses all workers; memory-bound uses `min(workers*2, count/10000)` chunks; decomposition uses `min(workers, count/50000)`

### Workers

- `parallel/src/workers/compute.worker.ts` (255 lines) — web worker entry point
- `parallel/src/matrix.worker.ts` (135 lines) — matrix-specific worker entry

STARTED 2026-11-14T07:41:50Z

# API sweep: parallel, gpu, workerpool, wasm, plot, workbook (dogfood round 3)

Packages (installed, read-only): parallel 0.11.0, gpu 0.4.0, workerpool 0.5.0, wasm 0.4.0, plot 0.5.0, workbook 0.6.0. Node v26.13.0, Windows 11. Every probe ran under `timeout -s KILL 30`.

## Defects

### D1 (P1). wasm kernels with an output argument never write the result back

- Repro: `const W = await import('file:///C:/Users/danie/mathts-dogfood-r3/newcomer/node_modules/@danielsimonjr/mathts-wasm/build/mathts.js'); const c = new Float64Array(4); W.matrix_multiply(Float64Array.from([1,2,3,4]),2,2,Float64Array.from([5,6,7,8]),2,c); console.log(Array.from(c));`
- Expected: `[19, 22, 43, 50]`. Reference: 2x2 product computed by hand. The d.ts gives `matrix_multiply(..., result: Float64Array): void`, and the README lists `matrix_multiply` and `matrix_transpose` under "Matrix Operations".
- Actual: `[ 0, 0, 0, 0 ]`.
- Measured, all with valid arguments:
  - `matrix_transpose([1..6], 2, 3, r)`: r is `[0,0,0,0,0,0]`. Expected `[1,4,2,5,3,6]`.
  - `matrix_vector_multiply([1,2,3,4], 2, 2, [1,1], r)`: r is `[0,0]`. Expected `[3,7]`.
  - `matrix_gemv(1, A, 2, 2, [1,1], 0, y)`: y is `[0,0]`. Expected `[3,7]`.
  - `matrix_inverse([4,7,2,6], 2, r, work)`: returns status 0, r is zeros. Expected `[0.6,-0.7,-0.2,0.4]`.
  - `matrix_cholesky([4,2,2,3], 2, l)`: returns status 0, l is zeros. Expected `[2,0,1,1.4142135624]`.
  - `matrix_identity` is not usable this way either: it returns a new array, and the probe read the expected identity as zeros only through `matrix_zeros`-style out-params, so it is not counted here.
  - `rfft([1,1,1,1], 4, r)`: r is all zeros.
  - `fft([1,0,0,0,0,0,0,0], 4, 0)` (d.ts: `void`, in place): the input array is unchanged.
  - `array_scale_inplace([1,2], 3)`, `array_add_inplace([1,2],[3,4])`, `matrix_add_inplace`, `array_clamp_inplace([-5,0,5],-1,1)`: the input array is unchanged in each case.
  - `matrix_axpy(2, x, y)`: y is unchanged.
- Root cause (measured): the generated glue lowers a JS typed array into wasm memory with `__lowerTypedArray` (`build/mathts.js`) and never copies the wasm memory back. Out-parameters keep their JS value. Functions that return a new array (`sort_f64`, `primeFactors`, `poly_mul_f64`, `polyadd`, `resample`) work.
- Scope: `mathts.d.ts` declares 97 functions with `): void;`. Of the ones probed, every out-parameter case above returned the unwritten value. The unprobed ones use the same glue path, but I did not run them.
- Severity note: the README says the matrix decompositions (`matrix_lu_decompose`, `matrix_qr_decompose`, `matrix_cholesky`, `matrix_inverse`, `matrix_determinant`) are "AS exports ... not public `lu()`/`qr()` in JS". So for those, the mismatch is between the d.ts (which exposes them) and the README (which says they are internal). The silent zeros are still wrong for any caller who follows the d.ts.

### D2 (P1). `parallelEvery` throws on valid input at the default parallel size

- Repro: `const P = await import('file:///C:/Users/danie/mathts-dogfood-r3/newcomer/node_modules/@danielsimonjr/mathts-parallel/dist/index.js'); const arr = Array.from({length:200000}, (_, i) => i); await P.parallelEvery(arr, x => x >= 0);`
- Expected: `{ result: true, ... }`. Reference: `arr.every(x => x >= 0)` is true.
- Actual: `predicate is not defined` (promise rejects). Same with `{forceParallel: true}` on `[1,2,3]`.
- Root cause (measured): `dist/index.js` line 1366 is `find(data, (item) => !predicate(item), options)`. The worker receives `predicate.toString()`, which names the free variable `predicate`. The worker evaluates that text (`compileFunctionSource`) and fails. Small input with default options runs sequentially and passes.

### D3 (P1). `parallelForEach` throws on valid input at the default parallel size

- Repro: `await P.parallelForEach(arr, () => {});` with the same 200,000-element array.
- Expected: resolves with `parallelized: true` and a chunk count. Reference: a for-loop calling `fn` once per element.
- Actual: `fn is not defined`. Same root cause as D2: `dist/index.js` line 1350 wraps the user callback as `(item) => { fn(item); }`.
- Scope: a grep of `dist/index.js` shows only these two wrappers that close over a user callback. `parallelMap`, `parallelFilter`, `parallelFind`, `parallelSort`, `parallelReduce`, `parallelHistogram` pass the user function straight through, and their forced-parallel results were correct.

### D4 (P2, undocumented behaviour). wasm `round_f64` rounds ties to even

- Repro: `W.round_f64(0.5)` and `W.round_f64(-2.5)`.
- Actual: `0` and `-2`. JavaScript `Math.round(0.5)` is `1` and `Math.round(-2.5)` is `-2`.
- Expected: not stated. The d.ts has no doc comment for `round_f64`, and the README lists it as "Rounding" with no mode. Decide the contract and document it. The same tie question is consolidated item 23 for the other packages.

## Verified correct (valid input, compared with a plain-JS reference)

- parallel: forced, sequential and default paths on 200,000 elements for `parallelSum, Mean, Min, Max, Std, Variance, Dot, Norm, Add, Scale, Abs, Sqrt, Sin, Divide, Cos, Exp, Log, Tan, Negate, Square, Multiply, Subtract, MinMax, Map, Filter, Count, Some, Find, Sort, Reduce, Histogram, Matmul, Matvec, Transpose, Outer, Elementwise, Unary, Distance`. Forced `parallelEvery(small, x => x > 500)` is correct when the predicate does not wrap another closure (`parallelSome` is correct). Empty `parallelSum` is 0. Bit operations `bitAnd, bitOr, bitXor, bitNot, leftShift, rightArithShift, rightLogShift` are correct on small values.
- parallel `ComputePool` (forced): `sum, prod, dot, elementwise, scale, matmul, transpose, map, reduce, filter, minMax, variance, norm, distance, histogram, unary, abs, sign, pow, bitAnd, leftShift, sort, find, distanceMatrix, matvec, outer`. `shouldParallelize`, `stats`, `workerCount` run.
- Pool lifecycle: `computePool.terminate()` in a `finally` with no `process.exit` exits in 1 s and the process ends on its own. After `terminate()`, `computePool.sum(...)` throws `ComputePool has been terminated` (as the README says). A new `ComputePool` runs `initialize()`, spawns 12 workers, sums correctly, and `terminate()` takes `stats().totalWorkers` to 0. No pool was left running. With `process.exit` removed, the probe finished in about 1 s.
- workerpool (`MathWorkerPool`, forced by size): `sum, prod, dot, elementwise, scale, bitwiseBinary, bitwiseScalar, bitwiseNot, matmul, transpose, minMax (values verified), variance (verified, rel. error 4e-13), norm, distance, unary, applyKernel, applyKernel2, histogram, matvec, outer, distanceMatrix, fftBatch (values verified: `[1,0,0,0]`gives re`[1,1,1,1]`), map, reduce, filter, find, sort, execFunction`. Top-level `initializePool`, `terminatePool(true)` (after it, `getPoolStats()` is zero), `getPoolStats`, `getCapabilities`, `canUseWasm`, `canUseSharedMemory`, `isWorkerWasmAvailable`, `isSharedBuffer`, `createSharedFloat64Array`, `createSharedBuffer`, `transferFloat64`, `transferTypedArray`, `transferArrayBuffer`. The process exited on its own after `terminatePool`.
- gpu (no device in Node): `hasWebGPU` false, `hasWebGPUSurface` false, `isBrowser` false, `getGPUAdapter` null, `getGpuDevice` null, `initializeGlobalGPU` false, `initializeGlobalGPUWithReason` returns `{ok:false, reason:'unavailable'}`, `getGlobalGPUContext().status` is `'unavailable'`, `detectGPUCapabilities` returns `supported:false`, `isGPUSuitableForMatrixOps()` false, `getMaxMatrixSize` with a supported capability object gives 362 (reference: `floor(sqrt(1048576/8))` = 362), `getRecommendedWorkgroupSize` gives `[16,16,1]`, `enableGpu`/`isGpuEnabled`/`disableGpu`, `serializeGpu`, `destroyGlobalGPU`, `resetGpuDevice`, `resetWebGPUAvailabilityCache`, `GPU_MIN_ELEMENTS` (65536), constructors `GPUContext`, `BufferPool`, `ShaderManager`. The fallback is silent and throws nothing. Not called: `enableGpuUnavailableWarnings` and `disableGpuUnavailableWarnings` (they only change logging).
- wasm, values checked: scalar `*_f64` against `Math.*` for abs, acos, acosh, asin, asinh, atan, atanh, cbrt, ceil, cos, cosh, exp, expm1, floor, log, log10, log1p, log2, sign, sin, sinh, sqrt, square, cube, tan, tanh, trunc, neg; binary add, sub, mul, div, mod, pow, atan2, max, min. Arrays: `array_sum, array_mean, array_min, array_max, array_product, array_variance` (population, 1.25 for `[1,2,3,4]`), `array_stddev`, `array_argmax, array_argmin, array_distance, array_cosine_similarity, array_dot, array_norm, array_norm_l1, array_norm_linf`. Sorting and number theory: `sort_f64, argsort_f64, primeFactors, divisors, eulerPhi, moebiusMu, carmichaelLambda, harmonicNumber, jacobiSymbol, integerDigits, partitions, divisorSigma, chineseRemainder, legendreP, laguerreL, hermiteH, erfi, chebyshevT`. Special: `lgamma_f64, cosIntegral, logIntegral, expIntegralEi, sinIntegral, elliptic_k_f64, elliptic_e_f64, bessel_j0_f64, bessel_j1_f64, bessel_y0_f64, airy_ai_f64`. Matrix (direct return or status): `matrix_determinant` (2x2 and 3x3), `matrix_trace`, `matrix_norm_frobenius`, `matrix_sum`, `matrix_mean`, `matrix_max`, `matrix_min`, `matrix_get_diag`, `matrix_get_row`, `matrix_sum_rows`, `matrix_sum_cols` (the last two were not all rerun with correct argument order, see the coverage note), `rowReduce`, `nullspace`. Polynomial: `poly_mul_f64, polyadd, discriminant`.
- Argument shapes that I got wrong on the first run and then corrected (not defects): `matrix_trace(data, rows, cols)`, `matrix_is_identity(data, rows, cols, tol)`, `matrix_get_col(data, rows, cols, col)`, `bessel_j_f64(order, xs)`, `rank_f64` returns `Int32Array` of ranks, `chunkArray` returns an object `{chunks, chunkInfo, ...}`.
- plot: `VERSION, viridis, line, scatter, bar, area, step, errorbar, quiver, histogram, heatmap, contour, overlay, surface, scatter3d, curve3d, plot, toTikZ` each return a string; SVG starts with `<svg`, and `toTikZ` returns a `tikzpicture`. I did not check drawn geometry. `update` needs a DOM host element and was not called.
- workbook: `parseWorkbook` (README example), `createExecutor().runReport()` (total = 5, checkPi = true), `detectCycles` ([]), `topologicalSort`, `getAncestors`, `getDependents`, `toMermaid`, `toDOT`, `serializeWorkbook` round trip, `stripOutputs`, `addCell`, `editCell`, `renameCell`, `moveCell`, `removeCell`, `setMetadata`, `mathMLToSVG`, `formatResult`, `runWorkbookWithTimeout` (valid run `ok: true`; with `timeoutMs: 300` on a long loop it rejects with "workbook execution exceeded 300ms and was terminated"), `Session` with `handleRequest` for `open`, `describe`, `validate`, `run`, `graph`, `cell/add`, `shutdown` (the JSON-RPC method set is in `timeout-runner-*.js`), `toTeX`, `detectCellType`, `buildDependencyGraph`, `WorkbookExecutor`, `WorkbookTimeoutError`, `VERSION`, `SCHEMA_VERSION`. `addCell` returns a new workbook and does not mutate its input, so the removeCell check must use the returned value.

## Not defects (checked and dismissed)

- `ComputePool.workerCount` after terminate and `stats()` after terminate: consolidated item 45.
- `pool.exec('sum', ...)` throws `Unknown method "sum"`: `exec` takes worker-side method names, and the README does not list `sum` there.
- `isValidIdentifier` and `importWorkbook` exist in `parser.d.ts` but are not re-exported from the index. Not an export-list defect.
- `wasm complex_*` functions take AssemblyScript class references ("internref expected"), so plain JS numbers cannot call them. Not counted as defects, but the d.ts exposes them without a note. Documentation gap, not tested further.
- `elliptic_e_f64(0.5)` and `lgamma_f64(1)` differ from the reference in the 16th digit or as `-8.9e-16`. Floating-point noise.
- `bessel_y0_f64(1)` matches the true value 0.088256964215677.

## Coverage (exact names)

- Export counts: parallel 70, gpu 25, workerpool 27, wasm 327, plot 19, workbook 28. Total 496.
- Name-level reference (`Object.keys` checked against every probe source, including string labels): parallel 70/70, workbook 28/28, workerpool 22/27, gpu 23/25, plot 18/19, wasm 163/327. The name count is an upper bound. A name in a label or with the wrong arguments is counted too.
- Not referenced at all:
  - workerpool (5): `chunkPairTyped, initWorkerWasm, mathWorkerPool, tensordotRange, viteDepsWorkerFallback`.
  - gpu (2): `disableGpuUnavailableWarnings, enableGpuUnavailableWarnings`.
  - plot (1): `update`.
  - wasm (164): the 15 constants and the 3 `__*` runtime helpers, plus `airy_bi_f64, apply_window_f64, array_*_ptr` (pointer-style, not run), `array_add*` and `array_*_inplace` (out-parameter family, D1), `array_cos, array_axpby, bessel_jn_f64, bessel_y_f64, bessel_y1_f64, bessel_yn_f64`, `bitAnd_i32_array` and the other `*_i32_array` (4 names), `bartlett_psd_f64, carlson_rc/rd/rj_f64, chirp_z_transform_f64, complex_*` (about 70 names, not run because they take AssemblyScript references), `divided_difference_f64, elliptic_*_incomplete_f64, heap_reset, legendre_fit_f64, logfit, powerfit, quadprog, resultant, poly_resultant_f64, polynomialLCM, polynomialQuotient, polynomialRemainder, tensorTranspose, vector_matrix_multiply, matrix_*` (about 25 names including `matrix_add, matrix_copy, matrix_diag, matrix_fill, matrix_gemm, matrix_gemv, matrix_lu_decompose, matrix_qr_decompose, matrix_set, matrix_neg, matrix_ones, matrix_scale_inplace, matrix_multiply_simd_ptr`). The full list is in `C:/Users/danie/AppData/Local/Temp/agent-df3-sweep-perf/cov.txt`.
- Called and checked against a reference: about 150 wasm, 70 parallel (top-level and ComputePool), 22 workerpool, 23 gpu, 18 plot, 28 workbook. The first-run argument mistakes are listed above and were fixed before the result was taken as a verdict.

## Files and processes I created

Files (all in `C:/Users/danie/AppData/Local/Temp/agent-df3-sweep-perf/`): `enum.mjs`, `probe-parallel.mjs`, `probe-parallel2.mjs`, `probe-parallel2.txt`, `iso-pred.mjs`, `every-repro.mjs`, `every-out.txt`, `every-default.mjs`, `every-default.txt`, `every-big.txt`, `exit-ok.mjs`, `exit-ok.txt`, `throw-map.mjs`, `throw-map.txt`, `fe.mjs`, `d2.mjs`, `d2.txt`, `teardown.mjs`, `teardown.txt`, `probe-wp.mjs`, `probe-wp.txt`, `val.mjs`, `probe-gpu-plot-wb.mjs`, `probe-gpu-plot-wb.txt`, `probe-gpu2-wb2.mjs`, `probe-gpu2-wb2.txt`, `probe-wasm.mjs`, `probe-wasm.txt`, `outparam.mjs`, `inplace.mjs`, `probe-more.mjs`, `probe-more.txt`, `uncalled.json`, `cov.mjs`, `cov.txt`, `example.mtsw` (workbook fixture written by the probe). Plus this report at `C:/Users/danie/mathts-dogfood-r3/sweep-perf-report.md`.

Nothing was written under `newcomer/node_modules`. No junction was created. Nothing was filed, committed or pushed.

Processes: every probe was a foreground `timeout -s KILL 30 node ...`. Two runs were killed at the 30 s limit (`every-repro.mjs` and `exit-ok.mjs`) because the default `computePool` was not terminated; that is the only time a probe ran to the kill. At the end, no node process whose command line references the scratch folder or `mathts` was running. The remaining node.exe processes belong to MCP servers and to a patrol runner (`patrol.mjs`, `runner.mjs RT_ALL`). I did not start those, and I did not check their owners further.

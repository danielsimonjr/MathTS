# WASM / workpool / WebGPU optimization sprint

**Date:** 2026-11-26. **Status:** execution plan. **Source of truth:** `docs/superpowers/optimization/inventory.json` (generated 2026-11-25 by `docs/superpowers/optimization/build-inventory.mjs`) and the code anchors named below. Do not edit `inventory.json` by hand.

This plan turns that inventory into dependency-ordered implementation waves. It does not authorize a kernel because a tier exists. A kernel joins WASM or WebGPU only after the measurement rule in [Dispatch and equivalence](#dispatch-and-equivalence).

## Inventory snapshot (verified)

1619 entries: `functions` 1433, `matrix` 163, `tensor` 23. `linalg`, `signal`, and `statistics` are thin re-exports contained in functions ∪ matrix (`summary.mirrorCheck`).

| Backend  | paired | candidate | not-worth-it | unsure |
| -------- | -----: | --------: | -----------: | -----: |
| wasm     |     47 |       161 |         1064 |    347 |
| workpool |     67 |       211 |         1082 |    259 |
| webgpu   |      8 |        41 |         1126 |    444 |

`asStandalone`: existing 86, candidate 825, blocked 708, unsure 0. Dual setup: wasm existing 47 / recommended 161; gpu existing 8 / recommended 41.

`paired` is “an implementation exists,” not “it runs by default.” Of the 47 wasm pairings, the policy in `functions/src/wasm/policy.ts` engages only the bands in the table below. Of the 67 workpool pairings, 49 report a `workers` default and 18 stay on JS because `DEFAULT_THRESHOLD_BY_OP` is `'never'` (the `parallelStat*` family and `parallelFFT` / magnitude / power). The 39 `matrix.parallel*` exports are a direct `ComputePool` surface whose ops mostly resolve to `'never'`; they are not a new work queue.

The 825 `asStandalone: candidate` rows and the 161 wasm / 211 workpool / 41 webgpu candidates are a search space. Only the ranked rows in [Benchmark rank](#benchmark-rank) are in scope. Everything classified `not-worth-it` stays on the TypeScript path.

### Policy bands that already engage (`WASM_DISPATCH_POLICY`)

Half-open: `min <= n` and, when set, `n < max`. Missing key means never. `DETERMINISTIC_WASM` is exactly `array_abs_ptr`.

| Kernel                                               | Band                | Public names (inventory)                                   |
| ---------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `array_abs_ptr`                                      | n ≥ 1024            | `abs`                                                      |
| `array_log10_ptr`                                    | n ≥ 1024            | `log10`                                                    |
| `array_log1p_ptr`                                    | 1024 ≤ n < 16384    | `log1p`                                                    |
| `array_sin_ptr`                                      | 16384 ≤ n < 65536   | `sin`                                                      |
| `array_cos_ptr`                                      | n ≥ 16384           | `cos`                                                      |
| `array_atanh_ptr`                                    | n ≥ 16384           | `atanh`                                                    |
| `array_log_ptr`                                      | n ≥ 16384           | `log`                                                      |
| `array_sec_ptr`                                      | 16384 ≤ n < 1048576 | `sec`                                                      |
| `fused_chain`                                        | n ≥ 1024            | `fuseUnaryChain`, `fuseUnaryChainAsync` (when GPU is off)  |
| `poly_fit_f64` / `cheb_fit_f64` / `legendre_fit_f64` | n ≥ 1024            | `polyFit`, `chebyshevFit`, `legendreFit`                   |
| `lgamma_f64` / `sort_f64`                            | n ≥ 1048576         | `lgamma`; `parallelStatMedian` / `Quantile` / `Percentile` |

Measured 2026-09-26, two Node 22 runs of `tools/benchmark/wasm/opt-in.bench.ts`. Kernels the same file keeps on JS (do not “just wire”): welch/bartlett PSD 4.0–4.6×, resultant/discriminant and Newton/Lagrange ~4×, chirp-Z 3.2–3.3×, polymul 2.6–2.8×, bitwise 2.4–3.3×, goertzel 1.6–1.8×, polynomial quotient 1.2–1.6×, cubic-spline tridiagonal 1.3–1.6×, tan/atan/cot/exp/log2/expm1/sinh/tanh up to 1.57×, Bessel/Airy/elliptic/Carlson up to 1.30×, erfc ~1.00×, argsort 0.92–1.13×.

### Thresholds that are live in code

| Gate                                                                      | Value                                        | Where                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WASM GEMM flop count                                                      | **13_824 = 24³** (`rows(A)×cols(A)×cols(B)`) | `matrix/src/config.ts` `backends.wasm.operationThresholds.multiply`. Two Node 24 runs of `tools/benchmarks/matmul-threshold.mjs` (2026-11-23): JS/WASM 0.65×/0.62× at 12², 1.07×/1.08× at 16², 1.52×/1.34× at 24². **256 is the pre-#1420 value. Do not restore it.** |
| Pool matmul (multiply-adds)                                               | **7_077_888 = 192³**                         | `parallel/src/ComputePool.ts` `DEFAULT_THRESHOLD_BY_OP.matmul` (lines 381). `docs/benchmarks/ws-r-matmul-decision.json`. The legend “matmul at 4,096” is stale (inventory M1; prose in `docs/reference/functions.md` was corrected in the inventory PR).              |
| Pool `matrixPower` / `characteristicPolynomial`                           | 9_216                                        | same table                                                                                                                                                                                                                                                            |
| Hypothesis tests                                                          | n ≥ 4096                                     | `chiSquareTest`, `kolmogorovSmirnovTest`, `mannWhitneyTest`, `shapiroWilkTest`                                                                                                                                                                                        |
| `erfc` / `besselJ` / `spectrogram` / `sampleChunk`                        | 100_000 / 1_000_000 / 65_536 / 100_000       | same table                                                                                                                                                                                                                                                            |
| Nameless pool gate                                                        | 50_000 elements                              | `DEFAULT_POOL_CONFIG.thresholdElements`. `parallelConv` uses `2·nextPow2(n+m−1) ≥ 50000`.                                                                                                                                                                             |
| Bitwise, `parallelFFT`, `parallelConv` (named), `fft2d`, `distanceMatrix` | `'never'`                                    | same table. A method that forgets to pass its op name ignores this and falls through to 50_000.                                                                                                                                                                       |
| `GPU_MIN_ELEMENTS`                                                        | 65_536                                       | `gpu/src/flag.ts`                                                                                                                                                                                                                                                     |
| FFT GPU                                                                   | power-of-two n ≥ **262_144**                 | `functions/src/gpu/fft-gpu.ts` `FFT_GPU_MIN_ELEMENTS`. At 65_536 the GPU win is ~1.17×, inside noise, and not enough to trade f64 for f32.                                                                                                                            |
| `BackendManager` GPU table                                                | dormant                                      | `register-backends.ts` registers js + wasm only. GPU matrix work is `gpuMatmul` / `GPUMatrixBackend`.                                                                                                                                                                 |

`decomposition: 100` and `transpose: 2000` in `matrix/src/config.ts` are advisory. No public matrix call passes `'decomposition'` to `BackendManager.selectBackend`.

## Benchmark rank

Order is the inventory README’s expected-gain list. Payoff is quoted only where a measurement exists; “plausible” rows are bench-first and must not ship a threshold before two agreeing Node runs.

| Rank | Work                                                                                          | Tier                                                                     | Evidence already in tree                                                                                                                                                                                                                                                                                                                                                                                                                                            | Expected only after a new A/B                                                                                                                                                                       |
| ---: | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|    1 | Public `DenseMatrix.multiply` / `matrix.multiply` / flat `matmul` → `backendManager.multiply` | wasm at flop ≥ 13_824; pool at ≥ 7_077_888 multiply-adds                 | SIMD GEMM already wins on `backendManager.multiply` (2–4× vs `gemmF64` in the inventory note). Public paths stay on `arithmetic.multiply → gemmF64` (`functions/src/typed/arithmetic.ts`, `matrix/src/types/dense/arithmetic.ts`). `functions.multiply`, `functions.pow` (square matrix power), and `Tensor.matmul` (`tensor/src/Tensor.ts`) already call the manager. Inventory M17: 0 `wasmBackend.multiply` calls from the public matrix product at 24³ and 64³. | Delegation, not a new kernel. Re-measure the public symbol, not `gemmF64` alone.                                                                                                                    |
|    2 | `Tensor.einsum` / contractions decomposed to that GEMM                                        | wasm, then pool for very large contractions                              | `Tensor.matmul` is already routed. Einsum is not.                                                                                                                                                                                                                                                                                                                                                                                                                   | 2–4× only if the contraction actually becomes the measured GEMM.                                                                                                                                    |
|    3 | Public `lu` / `qr` / `cholesky`                                                               | pool once matmul ≥ 7_077_888 multiply-adds; AS dense kernels stay opt-in | Public paths are JS. AS LU/QR/Cholesky exist for direct callers; they are not on `DenseMatrix`.                                                                                                                                                                                                                                                                                                                                                                     | ≈ 1.1–1.5× at n ≥ 192 is a hypothesis. A decomposition-level A/B is the exit gate. Do not move them onto WASM because the kernels exist (eig/svd AS kernels were removed after measuring 0.2–0.7×). |
|    4 | `kmeans` / `dbscan` / `knn` pairwise distance                                                 | new import-free AS distance kernel                                       | `distanceMatrix` already has a pool path (`functions/src/typed/geometry.ts`) but `DEFAULT_THRESHOLD_BY_OP.distanceMatrix` is `'never'` — confirm the call passes the op name before treating the pool as the winner.                                                                                                                                                                                                                                                | ≥ 2× only for n ≳ 10⁴. Bench before any default.                                                                                                                                                    |
|    5 | Batch distribution/quantile tails (`gammainc` / `betainc` class)                              | array drivers over `assembly/src/ops/scalar.ts` and `special.ts`         | 42 scalar kernels are compiled into `mathts-as.wasm` and called by nobody (`summary.unwiredAsKernels`). `erfc`’s array kernel is paired and policy-off (ratio ~1).                                                                                                                                                                                                                                                                                                  | 5–7× is the continued-fraction precedent, not a license to enable `erfc`. Per-kernel decision gate.                                                                                                 |
|    6 | `pageRank` / `eigenvectorCentrality`                                                          | import-free CSR SpMV; optional pool row fan-out                          | Unmeasured.                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Wins only at large nnz (≳ 10⁶).                                                                                                                                                                     |
|    7 | Sync `convolve` / `correlate` at large n                                                      | WebGPU stencil or FFT convolution                                        | WASM conv is `not-worth-it` (measured).                                                                                                                                                                                                                                                                                                                                                                                                                             | GPU only at n ≥ 1e6, f32, `enableGpu()`.                                                                                                                                                            |
|    8 | `fft2d` / batched FFT                                                                         | extend `fftGpuDispatch`                                                  | `STOCKHAM_WGSL` and `parallelFFT` already GPU at n ≥ 262_144. `fft2d` has no GPU dispatch; pool op `fft2d` is `'never'`.                                                                                                                                                                                                                                                                                                                                            | Carry the single-FFT 2.2–3.4× only if the batch stays on device.                                                                                                                                    |
|    9 | `theilSen` / `kendallTau`                                                                     | pool over pairs                                                          | Unmeasured.                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Useful only once O(n²) beats the 50_000-element copy, around n ≥ 5×10³.                                                                                                                             |
|   10 | Tensor elementwise                                                                            | reuse `array_*_ptr` inside the bands above                               | Kernels and the elementwise bridge exist. Tensor stores `Float64Array`.                                                                                                                                                                                                                                                                                                                                                                                             | 1.35–5× inside the measured bands; no new policy keys.                                                                                                                                              |
|   11 | `SparseMatrix` SpMV / CSR solve                                                               | import-free AS                                                           | Unmeasured. Same kernel family as rank 6; one kernel, two callers.                                                                                                                                                                                                                                                                                                                                                                                                  |
|   12 | `interpn`                                                                                     | import-free gather                                                       | Memory-bound. Default stays JS unless a bench shows a win at large grids.                                                                                                                                                                                                                                                                                                                                                                                           |
|   13 | OLS / ridge normal equations (wide X)                                                         | `XᵀX` via `backendManager` after rank 1                                  | Inherits the 13_824-flop GEMM. No hand-rolled WASM.                                                                                                                                                                                                                                                                                                                                                                                                                 |
|   14 | Multi-start global optimizers                                                                 | pool across starts                                                       | Only when each start is ~ms and the objective is serializable (quad fan-out already validates closure source).                                                                                                                                                                                                                                                                                                                                                      |
|   15 | Welch / Bartlett PSD                                                                          | fused on-device GPU pipeline                                             | WASM lost 4.0–4.6×. Last. Do not retune `policy.ts` to turn the WASM PSD on.                                                                                                                                                                                                                                                                                                                                                                                        |

## Dispatch and equivalence

Every dual pair (TS reference + accelerator) ships with both of the following. This is the inventory’s dual-setup contract.

**Equivalence**

- WASM f64: bit-identical only for kernels in `DETERMINISTIC_WASM` (today `array_abs_ptr`). Everything else is elementwise: **1e-9 absolute** for the elementwise suite (`functions/tests/elementwise-wasm.browser.test.ts`), **1e-12 relative** for special / interpolation / signal (`special-as-wasm.test.ts`, `interpolation-as-wasm.test.ts`, `signal-as-wasm.test.ts`; Airy asserts 1e-9). Golden `target_rel` precedent is 1e-9 (`functions/tests/diff-special.test.mjs`).
- Cover scalars, flat arrays, matrices where the public signature accepts them, and `NaN`, `±Inf`, `+0`/`-0`, empty, and the size on each side of the band (below `min` must take JS; at `min` the accelerator; at `max` JS again when the band is closed).
- WebGPU f32: tolerance from the WGSL spec. `sin`/`cos` are promised 2⁻¹¹ absolute. Use adapter-gated `F32_REL_TOL` / `PEAK_REL_TOL` and gate perf assertions on `REAL_GPU` (`functions/tests/helpers/gpu-hardware.ts`, `functions/tests/gpu-fft.browser.test.ts`). Guard `log(x<=0)`, `atanh(|x|>=1)`, and division by zero. A validation error does not throw: check `pushErrorScope('validation')` and funnel every entry through `serializeGpu` (`gpu/src/`).
- `sort_f64` may order `-0` and `+0` differently from JS sort. Do not add it to `DETERMINISTIC_WASM`.

**Dispatch**

- WASM: nothing loads `mathts-as.wasm` until `loadWasm()`. Then `wasmPolicyAllows(kernel, n)`. A missing policy key stays JS. `isDeterministic()` keeps only `array_abs_ptr`.
- Workpool: named `shouldParallelize(n, op)` against `DEFAULT_THRESHOLD_BY_OP`. `'never'` means inline JS. If workers are unavailable, disabled, or terminated, the same function returns the TS result (no throw). Ordering of reductions is the existing deterministic reduction in the pool, not arrival order.
- WebGPU: `enableGpu()` is consent to f32. Below threshold, no adapter, unsupported op, or a validation failure returns `null` and the caller uses the TS path. Never time a `null` as a win.
- Change a band only by re-running the owning bench twice on Node (`node tools/benchmark/wasm/run-node.mjs` for functions WASM; `tools/benchmarks/matmul-threshold.mjs` for GEMM; the A/B harness in `tools/benchmark/ab/` for a public-symbol claim) and citing both runs in the policy comment. A row that flips is noise.

**`as_standalone` file layout** (for ranks 4–6, 11, and any later candidate that survives a bench)

- One import-free AssemblyScript file per kernel family: `assembly/src/ops/<family>.ts` with no `import` and no `export … from`. The 21 files already in `summary.assemblyFiles.standalone` are the pattern (`assembly/src/ops/scalar.ts`, `elementwise.ts`, `sort.ts`, …).
- The 8 dependent files (`algebra/decomposition.ts`, `index.ts`, `ops/array.ts`, `ops/complex-array.ts`, `ops/complex-ops.ts`, `ops/matrix.ts`, `ops/polynomial.ts`, `poly.ts`) import `ops/f64-buffer.ts` or `algebra/diagonal-product.ts`. A new kernel does not add an import. Inlining those helpers is a separate cleanup, single-writer on `assembly/src/index.ts`.
- JS side: a bridge under `functions/src/wasm/<area>/` that copies in, calls the export, copies out, and calls `heap_reset` after the managed call (the stub runtime never frees). No heap-allocated AS global.
- `assembly/src/index.ts` re-exports the new function. That file is a shared collision point (see waves).
- TS reference stays the public function. The bridge is a branch, not a second public name, except where the package already uses an explicit `gpu*` opt-in (`gpuAdd`, `gpuMatmul`, `gpuScale`, `gpuTranspose`).
- Build: `bun run build:wasm` then the package `copy-wasm.mjs`. Do not hand-run `tsdown` (it drops the wasm copy). SHA-384 manifest verification in `core/src/wasm-loader.ts` stays on the load path.

Do not wire the 42 scalar kernels in `assembly/src/ops/scalar.ts` onto public scalar math. Scalar calls are JS; an array driver is rank 5 and still needs its own bench. Do not clear the bitwise `'never'` / missing policy entries: `bit*_i32_array` is wired-but-idle at 2.4–3.3× slower.

## Super-Team execution

`grok-4.7` writes the plan. `gemini-4-neon` reviews and fixes the plan. `composer-2.5` builds the implementation PR. `grok-4.6` challenges it. `gemini-4-neon` reviews and fixes the PR directly. Squash-merge on green. Keep the branch. Docs-only PRs skip heavy CI wait.

## Rules for every implementation PR

- One wave row, one PR, unless the collision table says two rows share a file and must be sequential.
- No new runtime dependency. No `: any`, `as any`, `as never`, or `@ts-ignore`.
- Root-cause (`rfl`): the regression must fail on the pre-fix public path (spy on `wasmBackend.multiply` / `DenseMatrix.prototype`, or an operation counter). Oracles are the TS reference or an external table, not a round-trip through the accelerator alone.
- Changelog fragment: `changelog-fragments/YYYY-MM-DD-<slug>.md`. Do not hand-edit `CHANGELOG.md`.
- Expression sandbox helpers, WASM SHA-384, and `WorkerPool` `timeoutMs` stay as in `AGENTS.md`.
- Before/after microbenchmark is committed or pasted in the PR with both runs. A single-run 1.03 on untouched code is noise (`AGENTS.md` acceleration rules).
- Re-export packages get no implementation edits.

## Waves

Phases are ordered. Rows inside a wave with no shared file may run as parallel PRs.

### Wave 0 — Foundation (wiring and mismatches)

Fix the paths the inventory already proved are wrong. No new kernels.

| ID  | Change                                                                                                                                                                                                                                              | Touchpoints                                                                                                                                                      | Exit                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | Route public dense product through `backendManager.multiply` so flop ≥ 13_824 uses the existing SIMD GEMM and below 13_824 stays `gemmF64`. `matrix.multiply` and `DenseMatrix.multiply` are the symbols under test.                                | `matrix/src/types/dense/arithmetic.ts`, `matrix/src/backends/BackendManager.ts` (call only; do not change the 13_824 constant unless a new pair of runs says so) | At 12³, zero `wasmBackend.multiply` calls. At 24³ and 64³, the public multiply calls it. Results match `gemmF64` within 0 ulp for finite f64 inputs on the sizes the existing GEMM tests cover. |
| 0.2 | Flat `matmul` helper: same delegation, and the pool only at ≥ 7_077_888 multiply-adds via the named op `'matmul'`.                                                                                                                                  | `functions/src/typed/arithmetic.ts` (the `matmulSequential` site the inventory cites near the multiply path)                                                     | A spy shows sequential JS under the cut and the named pool op above it. `forceSequential` still wins.                                                                                           |
| 0.3 | `pow` matrix-power path already uses `backendManager.multiply` (`matrix_multiply_simd_ptr`). Document that in `docs/reference/functions.md` if the Accel cell still says the whole matrix product is accelerated. Do not invent a second kernel id. | `docs/reference/functions.md` pow row; read `functions/src/typed/arithmetic.ts` `matrixPowNumber` before editing the cell                                        | Cell names `backendManager` + flop ≥ 13_824, and says public `DenseMatrix.multiply` follows 0.1.                                                                                                |
| 0.4 | Audit named vs nameless pool gates: `distanceMatrix: 'never'` must actually govern `computePool.distanceMatrix` (pass the op name). Same check for any rank-4/9 caller.                                                                             | `parallel/src/ComputePool.ts`, `functions/src/typed/geometry.ts`                                                                                                 | A test with the threshold `'never'` does not spawn workers; flipping the test-only threshold does.                                                                                              |
| 0.5 | JSDoc on `tensorEigWasm` / `tensorSvdWasm`: bodies are synchronous JS. AS eig/svd were removed 2026-07-01 (`matrix/src/operations/eig-wasm.ts`). Inventory M10.                                                                                     | `tensor/src/operations/eig.ts`, `tensor/src/operations/svd.ts`                                                                                                   | Comments describe the JS shim. No new WASM call.                                                                                                                                                |

**Leave closed.** Inventory M1–M5, M9, M11–M15, M17 were corrected in the inventory PR’s prose or in `policy.ts` / `config.ts`. Do not reopen 256, the sin band `[1024, 131072)`, or “matmul at 4,096”.

**Generator mismatches (not Wave 0).** M6, M7, M8, M16 live in `tools/create-dependency-graph/` (brace-match stops at the first `{` in `runChainLifecycle`, so `elementwiseChainGpuDispatch` / `elementwiseChainReduceGpuDispatch` are missing; wasm “21 execute” counts `fftGpuDispatch` as AS; `parallel*(` recursion is read as `applyKernel`). One tools PR after the numeric waves, or never, if the inventory remains the authority. `statistics.ts` has no `applyKernel` call; do not add one to make the generator true.

**Collision:** 0.1 and 0.2 both conceptually touch GEMM dispatch but in different files. They may run in parallel. 0.2 and later arithmetic.ts rows are single-writer. 0.3 is docs and waits until 0.1 has landed so the cell matches code.

### Wave 1 — Reuse measured WASM (rank 10, then rank 5 only where a bench wins)

| ID  | Change                                                                                                                                                                                                                                                                               | Touchpoints                                                                                                                                                                | Exit                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Tensor elementwise delegates to the existing elementwise bridge inside current bands only. No new `WASM_DISPATCH_POLICY` keys.                                                                                                                                                       | `tensor/src/` elementwise ops, `functions/src/wasm/elementwise/wasm-bridge.ts` (call, do not retune)                                                                       | Below each band: JS. Inside the band: the named `array_*_ptr`. Equivalence at 1e-9 absolute including NaN/Inf/−0. `abs` bit-identical. |
| 1.2 | Array drivers for expensive tails whose **own** two-run bench beats JS by the policy’s 0.9 rule. Start from kernels already import-free in `assembly/src/ops/special.ts` / `scalar.ts`. Skip `erfc`, Bessel, Airy, elliptic, Carlson: those ratios are already recorded as non-wins. | New bridge file under `functions/src/wasm/special/`, `functions/src/wasm/policy.ts` (one key per winning kernel), `assembly/src/index.ts` only if a new export is required | Policy comment cites both runs. Default for a non-winning kernel stays absent.                                                         |

**Collision:** `policy.ts` and `assembly/src/index.ts` are single-writer across 1.2, Wave 2, and Wave 3. 1.1 does not touch them and can run beside 0.1.

### Wave 2 — Contractions that become GEMM (ranks 2, 13)

Depends on Wave 0.1.

| ID  | Change                                                                     | Touchpoints                                                                                                                | Exit                                                                                                                          |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `Tensor.einsum` lowers eligible contractions to `backendManager.multiply`. | `tensor/src/Tensor.ts`                                                                                                     | Flop count uses the same 13_824 cut. Non-GEMM index patterns stay on the current TS einsum.                                   |
| 2.2 | OLS/ridge `XᵀX` / `Xᵀy` call that GEMM for wide X.                         | the regression implementation under `functions/src/` (inventory family `statistics.regression-models`, 14 wasm candidates) | Narrow X (under 13_824 flops) is unchanged JS. Coefficients match the TS accumulation within 1e-9 relative on a fixed design. |

**Collision:** `tensor/src/Tensor.ts` is single-writer (2.1 only). Regression files do not overlap Wave 1.

### Wave 3 — New import-free AS kernels (ranks 4, 6, 11, 12)

Bench-first. A PR that adds a kernel without two Node runs does not merge.

| ID  | Kernel file (new, import-free) | Callers                                                    | Pool?                                                                                                                         |
| --- | ------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | `assembly/src/ops/distance.ts` | `kmeans`, `dbscan`, `knn`                                  | Only if 0.4 shows the named `distanceMatrix` gate can win; otherwise WASM-or-JS only.                                         |
| 3.2 | `assembly/src/ops/spmv.ts`     | `pageRank`, `eigenvectorCentrality`, `SparseMatrix` matvec | Row fan-out only after a pool A/B at nnz ≳ 10⁶. One kernel, both callers.                                                     |
| 3.3 | `interpn` gather               | `functions` interpolation                                  | Ship the kernel behind `overrideWasmPolicy` until the public ratio is below 0.9 twice. Default remains JS if the bench loses. |

**Collision:** each new `assembly/src/ops/*.ts` is independent. The re-export in `assembly/src/index.ts` and the manifest regen are sequential: stack 3.1 → 3.2 → 3.3 or land them in one PR. Do not edit `ops/matrix.ts` (dependent, holds `matrix_multiply_simd_ptr`).

### Wave 4 — Workpool where copy cost is paid back (ranks 3, 9, 14)

Depends on Wave 0.2 for anything that is matmul-shaped.

| ID  | Change                                                                                                                                  | Threshold to write down only after A/B                                                      | Fallback                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 4.1 | Public `lu` / `qr` / `cholesky` may call the pool matmul above 7_077_888 multiply-adds. Do not switch the factorization itself to WASM. | Decomposition-level gate. Hypothesis ≈ 1.1–1.5× at n ≥ 192 is not a default until measured. | JS factorization.                                  |
| 4.2 | `theilSen`, `kendallTau` pair loops.                                                                                                    | Named ops. Starting hypothesis n ≥ ~5×10³.                                                  | Inline JS under the cut and when the pool is down. |
| 4.3 | Multi-start optimizers.                                                                                                                 | Caller opt-in, same pattern as `parallelGaussQuad` / `parallelRomberg` (`workerCount > 1`). | Serial starts. Objective must be serializable.     |

The 18 workpool pairings whose default is JS (`parallelStatSum`, `Std`, `Norm`, …, `parallelFFT`) stay `'never'`. Memory-bound reductions lose to inline JS; that is the measured posture.

**Collision:** `parallel/src/ComputePool.ts` `DEFAULT_THRESHOLD_BY_OP` is single-writer for 0.4, 4.1, 4.2. One PR should own the table for this wave.

### Wave 5 — WebGPU where transfer amortizes (ranks 7, 8, 15)

Existing paired GPU surface (do not rebuild): `fuseUnaryChainAsync`, `fuseUnaryChainReduceAsync` at n ≥ 65_536 with `enableGpu()`; `gpuAdd`, `gpuMatmul`, `gpuScale`, `gpuTranspose` (explicit f32); `parallelFFT` / `parallelIFFT` at power-of-two n ≥ 262_144.

| ID  | Change                                                                                                                                                | Touchpoints                                                                   | Exit                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | `fft2d` / batched FFT reuses `fftGpuDispatch` per row/column, upload once.                                                                            | `functions/src/matrix/fft.ts`, `functions/src/gpu/fft-gpu.ts`                 | `enableGpu()` off → current JS. On, below 262_144 → JS. On, at/above → GPU, `null` falls back. `F32_REL_TOL`, `REAL_GPU` for perf. |
| 5.2 | Large `convolve` / `correlate` (and the inventory GPU candidates `autoCorrelation`, `crossCorrelation`, `deconvolve` only if they share this kernel). | `functions/src/gpu/` new shader, registered beside existing chain/FFT shaders | n ≥ 1e6 proposal, confirmed by two runs. WASM stays off.                                                                           |
| 5.3 | Welch/Bartlett fused GPU                                                                                                                              | last, separate PR                                                             | Ships only if the fused pipeline beats JS. Otherwise close the row as not-worth-it.                                                |

**Collision:** `functions/src/gpu/fft-gpu.ts` is single-writer (5.1). A new shader file for 5.2 does not edit the FFT file. `gpu/src/` foundation (`GPUContext`, `BufferPool`, `serializeGpu`) is not a place for domain kernels; matrix/functions already own those. `BackendManager` does not gain a `'gpu'` registration in this plan.

Tensor GPU candidates (`tensorCholesky`, `tensorEig`, `tensorLu`, `tensorQr`, `tensorSvd`, …) are **out of this sprint**. `tensorEigWasm` / `tensorSvdWasm` are JS shims (Wave 0.5). A GPU eig/svd needs its own bench and is not implied by the 41-candidate count.

### Wave 6 — Docs and generator (after the code waves they describe)

| ID  | Change                                             | Touchpoints                                                                           |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 6.1 | Accel cells for whatever 0.x–5.x actually shipped. | `docs/reference/functions.md` only, one PR at the end so it does not collide with 0.3 |
| 6.2 | Optional generator fixes for M6/M7/M8/M16.         | `tools/create-dependency-graph/create-dependency-graph.ts`                            |

## Shared-file collision matrix

| File                                    | Waves that write it                       | Rule                                                       |
| --------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `matrix/src/backends/BackendManager.ts` | 0.1                                       | One PR. No GPU registration.                               |
| `matrix/src/config.ts`                  | none unless a new GEMM bench moves 13_824 | Do not touch for docs.                                     |
| `functions/src/typed/arithmetic.ts`     | 0.2                                       | Single-writer.                                             |
| `functions/src/wasm/policy.ts`          | 1.2, and only 1.2                         | Keys added only with two cited runs.                       |
| `assembly/src/index.ts`                 | 1.2, 3.1–3.3                              | Sequential.                                                |
| `parallel/src/ComputePool.ts`           | 0.4, 4.1, 4.2                             | One PR owns new named thresholds.                          |
| `functions/src/gpu/*`                   | 5.1 FFT file; 5.2 a new shader file       | Split by file.                                             |
| `docs/reference/functions.md`           | 0.3 then 6.1                              | Not edited inside kernel PRs.                              |
| `core/src/wasm-loader.ts`               | none                                      | Integrity path is frozen.                                  |
| `gpu/src/flag.ts`                       | none                                      | 65_536 stays the elementwise chain cut. FFT keeps 262_144. |

## Exit criteria for the sprint

- Public dense multiply and flat matmul follow 13_824 / 7_077_888 with tests that fail if the spy counts regress.
- No policy key added without two Node runs cited in `policy.ts`.
- New AS files are import-free and covered by TS-vs-WASM equivalence tests.
- GPU entries return `null` and hit TS when `enableGpu()` is off, the device is missing, or n is under the kernel’s own threshold.
- `not-worth-it` kernels (bitwise, WASM FFT, WASM PSD, public eig/svd WASM) are still unreachable from the default path.
- `bun run typecheck` stays at 0 errors. Affected package tests pass. Changelog fragment present. `git diff` for each implementation PR is not required to be docs-only; **this** plan PR is.

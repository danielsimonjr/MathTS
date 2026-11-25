# Optimization inventory — functions × backends

**Generated** by `docs/superpowers/optimization/build-inventory.mjs` (run `bun run build` + `bun run docs:deps` first). Do not edit `inventory.json` by hand — edit the script's curated tables and re-run. Generated: 2026-11-25.

## What this is

One entry per exported function of `@danielsimonjr/mathts-functions` (1433 exports), plus the numeric surface of `matrix` (163) and `tensor` (23) — **1619 entries**. `linalg`, `signal` and `statistics` are thin re-export packages whose export sets are contained in functions ∪ matrix (verified at generation time), so their hot paths are these entries.

Each entry records:

- **family** — the controlled vocabulary of `docs/superpowers/classification/families.md`;
- **pairings** — what is ACTUALLY implemented in code, per backend (`wasm` / `workpool` / `webgpu`), with `file:line` evidence and the default engagement (e.g. `wasm (n ≥ 1024)` vs `js (bridge present; policy keeps JS)`);
- **tsImpl / asImpl / gpuImpl** — the TypeScript reference path and the AssemblyScript / WebGPU implementation paths where they exist;
- **dualSetup** — whether the dual (TS reference + accelerator) setup exists, is recommended, or does not apply;
- **classification** — `paired` / `candidate` / `not-worth-it` / `unsure` per backend, with the measured evidence or the threshold reasoning;
- **asStandalone** — `existing` (path to an import-free assembly/src file), `candidate` (import-free-writable), or `blocked` (reason);
- **accelClaim + docMismatch** — what `docs/reference/functions.md` claims today and where that disagrees with the code.

## Counts

Backend × classification (of 1619 entries):

| Backend  | paired | candidate | not-worth-it | unsure |
| -------- | -----: | --------: | -----------: | -----: |
| wasm     |     47 |       161 |         1064 |    347 |
| workpool |     67 |       211 |         1082 |    259 |
| webgpu   |      8 |        41 |         1126 |    444 |

"paired" = an implementation for that backend exists in code. Some paired rows engage **never by default** (threshold `'never'` or a missing `wasmPolicyAllows` entry) — the entry's `pairings.<backend>.default` states which; those are wired-but-idle, kept so a threshold retune or `overrideWasmPolicy` can switch them on without code churn.

## Dual-setup contract (TS reference + accelerator)

47 entries have an existing wasm dual (TS + AS), 161 are recommended to get one, 8 have an existing WebGPU dual, 41 are recommended for one.

Every dual pair carries two obligations:

1. **Equivalence test.** The accelerator and the TS reference must be proven to agree — same results within the stated tolerance — before the pair ships:
   - WASM (f64): bit-identical is the bar for deterministic mode (`DETERMINISTIC_WASM` in `functions/src/wasm/policy.ts` pins exactly which kernels qualify — today only `array_abs_ptr`); everything else is validated element by element — **1e-9 absolute** for the elementwise suite (`functions/tests/elementwise-wasm.browser.test.ts:115`), **1e-12 relative** for the special/interpolation/signal suites (`special-as-wasm.test.ts:116`, `interpolation-as-wasm.test.ts:66`, `signal-as-wasm.test.ts:71`; the Airy kernels assert 1e-9) against the JS path or mpmath (precedent: `functions/tests/diff-special.test.mjs`, whose golden `target_rel` is 1e-9).
   - WebGPU (f32): tolerance comes from the WGSL spec, not from a dev card — `sin`/`cos` are only promised 2⁻¹¹ absolute; use the adapter-gated `F32_REL_TOL` / `PEAK_REL_TOL` helpers and gate perf assertions on `REAL_GPU` (`F32_REL_TOL`/`REAL_GPU` in `functions/tests/helpers/gpu-hardware.ts`; `PEAK_REL_TOL` in `functions/tests/gpu-fft.browser.test.ts`). WGSL leaves `log(x<=0)`, `atanh(|x|>=1)` and division by zero indeterminate — guard them or the GPU disagrees with JS.
   - A validation error does NOT throw on the GPU: it invalidates the command buffer and the zero-initialized staging buffer reads back as zeros. Every GPU entry point must check error scopes and funnel through the shared `serializeGpu`.
2. **Dispatch rules.** The doc must state when the accelerated path is used: the `loadWasm()` gate + `wasmPolicyAllows(kernel, n)` band for WASM; `enableGpu()` opt-in + size threshold (`GPU_MIN_ELEMENTS` 65 536; FFT 262 144) + device/adapter availability for WebGPU; and the never-throw `null` → TS-fallback contract in every case.

## as_standalone — import-free AssemblyScript files

21 of the 29 files under `assembly/src/` are import-free (no `import`, no `export … from`) and compile directly to WASM: `assembly/src/abort.ts`, `assembly/src/algebra/diagonal-product.ts`, `assembly/src/elementwise.ts`, `assembly/src/heap.ts`, `assembly/src/ops/approx.ts`, `assembly/src/ops/bitwise.ts`, `assembly/src/ops/curvefit.ts`, `assembly/src/ops/f64-buffer.ts`, `assembly/src/ops/fft.ts`, `assembly/src/ops/linalg.ts`, `assembly/src/ops/number-theory.ts`, `assembly/src/ops/optimization.ts`, `assembly/src/ops/scalar.ts`, `assembly/src/ops/signal.ts`, `assembly/src/ops/special.ts`, `assembly/src/ops/tensor.ts`, `assembly/src/signal.ts`, `assembly/src/sort.ts`, `assembly/src/special.ts`, `assembly/src/tridiag.ts`, `assembly/src/types/complex.ts`.

The 8 dependent files (and what blocks them): `assembly/src/algebra/decomposition.ts`, `assembly/src/index.ts`, `assembly/src/ops/array.ts`, `assembly/src/ops/complex-array.ts`, `assembly/src/ops/complex-ops.ts`, `assembly/src/ops/matrix.ts`, `assembly/src/ops/polynomial.ts`, `assembly/src/poly.ts` — each imports small f64 helpers (`ops/f64-buffer.ts`) or `algebra/diagonal-product.ts`; inlining those helpers makes them standalone.

Counts across entries: 86 existing (an import-free kernel already covers the function), 825 candidate (import-free-writable), 708 blocked, 0 unsure.

`existing` is a per-function claim: the cited file must DECLARE that function's kernel (its `array_<op>_ptr` pointer kernel, its `<op>_i32_array` kernel, or its `<op>_f64` / export-named kernel). A family whose file has kernels does not make its other members `existing` — they are `candidate` with a note saying the family file exists but does not define them. This replaces the earlier family-level assignment, which claimed 284 `existing` where only 86 of the cited files actually define the function (all 77 `arithmetic.elementwise` rows pointed at `elementwise.ts`, which has no `add`/`multiply`/`sqrt` kernel).

**Unwired AS kernels (wiring backlog):**

- `assembly/src/ops/scalar.ts` (42 kernels): 42 import-free f64 scalar kernels (add/sub/mul/div/mod/neg/sqrt/pow/square/cube/cbrt/nthRoot/exp/expm1/log/log1p/log10/log2/sin/cos/tan/asin/acos/atan/atan2/sinh/cosh/tanh/asinh/acosh/atanh/abs/floor/ceil/round/trunc/sign/min/max/clamp/isNaN/isFinite) are exported from the AS entry (assembly/src/index.ts:34+) and compiled into mathts-as.wasm, but no JS bridge calls any of them — the public scalar paths are plain JS. Wiring backlog, not a pairing.
- `assembly/src/ops/bitwise.ts` (7 kernels): bit*_i32_array kernels exist and the bridges reference them, but the policy keeps bitwise on JS (measured 2.4–3.3× slower) — wired-but-idle.

## Ranked candidate list (highest expected gain first)

1. **matmul (functions flat helper)** — wasm (route through backendManager GEMM) + workpool (≥ 7M multiply-adds) · Expected gain: SIMD GEMM ≈ 2–4× vs the plain JS triple loop at flop count ≥ 13824 = 24³ (the matrix package ships and measures this path); pool fan-out ≤ 0.90× sequential at ≥ 192³ multiply-adds · Why: the public `matmul(a, aRows, aCols, b, bCols)` helper runs `matmulSequential` (functions/src/typed/arithmetic.ts:3668) while the SAME operation is wasm-accelerated one layer down (DenseMatrix.multiply → backendManager). Wiring is a delegation, not a kernel.

2. **Tensor.einsum / large tensor contractions** — wasm (decompose to GEMM via backendManager) · workpool for very large contractions · Expected gain: O(n^k) contractions become GEMM calls: the ≥ 13824-flop SIMD threshold engages almost immediately; expect 2–4× per contraction pair · Why: Tensor.matmul already routes through backendManager (tensor/src/Tensor.ts:1156); einsum does not — it is the highest-arithmetic-intensity export with no acceleration

3. **lu / qr / cholesky (public DenseMatrix paths)** — workpool at n ≳ 192 (matmul ≥ 7,077,888 multiply-adds, measured 0.90×); AS dense kernels exist but are opt-in only · Expected gain: matmul-dominated factorizations inherit the measured pool matmul win; expected ≈ 1.1–1.5× at n ≥ 192, growing with n · Why: public paths are pure JS (2026-07 audit); a decomposition-level A/B gate is the missing measurement

4. **kmeans / dbscan / knn pairwise-distance phase** — wasm standalone distance kernels (import-free-writable) · Expected gain: O(n²) distance work vs O(n) copy: wins grow with n; plausible ≥ 2× for n ≥ ~10⁴ points · Why: distance loops are pure f64 (FAMILY candidate); distanceMatrix already proves the pool route; the wasm kernel is a ~40-line standalone

5. **expensive-tail distribution/quantile batch overloads** — wasm array drivers over the existing import-free scalar kernels (assembly/src/ops/scalar.ts, special.ts) · Expected gain: erfc precedent 5–7× at n ≥ 1024 for continued-fraction scalars; applies to gammainc/betainc-class tails only · Why: the scalar kernels already exist import-free; only an array driver + per-kernel decision-gate bench is missing

6. **pageRank / eigenvectorCentrality (sparse matvec iterations)** — wasm CSR SpMV standalone kernel · workpool row fan-out · Expected gain: O(iter·nnz) compute vs O(nnz) copy — wins at large nnz (≥ ~10⁶) · Why: pointer-chasing in JS; SpMV is the classic sparse kernel; unmeasured — needs the A/B gate

7. **large-n convolution (sync convolve / correlate)** — webgpu stencil/FFT kernel (candidate) · wasm not-worth-it (measured) · Expected gain: GPU conv at n ≥ 1M samples; f32 acceptable for most filtering · Why: same amortization economics as the FFT GPU win (2.2–3.4× measured); unmeasured for conv

8. **fft2d / batched FFT on GPU** — webgpu (new kernel — extend fftGpuDispatch to row/column batches) · Expected gain: log₂(n) passes amortize the upload per frame — the single-FFT GPU precedent (2.2–3.4×) carries to batches · Why: STOCKHAM_WGSL exists but `fft2d` (`functions/src/matrix/fft.ts`) has no GPU dispatch today; frame-batching is new shader work, so this is a candidate, not a pairing

9. **theilSen / kendallTau O(n²) statistics** — workpool fan-out over pairs · Expected gain: embarrassingly parallel pairwise loop; useful at n ≥ ~5×10³ (O(n²) work beats 50k-element copy overhead) · Why: pure f64 pairwise math; unmeasured — A/B gate first

10. **Tensor elementwise ops** — wasm (reuse array_*_ptr kernels behind the measured bands) · Expected gain: 1.35–5× in the measured bands (elementwise.bench), for free — the kernels and bridge already exist · Why: Tensor stores Float64Array data; the elementwise bridge is one delegation away

11. **CSR sparse solve / SpMV (SparseMatrix)** — wasm standalone · Expected gain: large-nnz SpMV ≥ 2× plausible; index math is i32/f64 only · Why: import-free-writable; unmeasured

12. **interpn / regular-grid interpolation** — wasm standalone gather kernel · Expected gain: gather is memory-bound — modest win, only at very large grids; unsure · Why: pure f64 math but memory-bound class (measure first)

13. **OLS/ridge normal equations for wide X** — wasm GEMM via backendManager · workpool fan-out · Expected gain: XᵀX is a matmul — inherits the measured ≥ 13824-flop SIMD win for wide design matrices · Why: today the regression paths hand-roll the accumulations in JS

14. **global optimizers (multi-start fan-out)** — workpool · Expected gain: embarrassingly parallel across starts; useful when each start costs ≥ ~ms · Why: the objective must be serializable (closure source validation already exists for quad fan-out)

15. **welch/bartlett PSD fused GPU pipeline** — webgpu (fuse windowing+FFT+accumulate on-device) · Expected gain: unclear — the WASM version lost 4.0–4.6× on copy; only a fully-fused GPU pipeline could flip it · Why: listed LAST because the measured evidence points against easy wins; requires f32-PSD accuracy validation

## Doc-vs-code mismatches found

- **M1 (high)** docs/reference/functions.md — Accel legend paragraph
  - Docs claim: `matmul` at 4,096 via `poolOptions(..., 'matmul')`
  - Code says: DEFAULT_THRESHOLD_BY_OP.matmul = 7_077_888 (192³ multiply-adds) — parallel/src/ComputePool.ts:379-381
  - Fix: curated prose (docs-only)
- **M2 (medium)** docs/reference/functions.md — WebGPU coverage paragraph
  - Docs claim: "2 of 219" typed functions + "9 standalone functions" route to WebGPU
  - Code says: 215 unique mathTyped names exist in functions/src/typed/ (the generator counts 206: it misses add/multiply wrapped in withBinaryScalarGuards and gcd/min/max/std/rightLogShift/permutations/format defined through helper-driven signatures); the generated webgpu-pairing says "2 of 206" and lists 7 standalone — elementwiseChainGpuDispatch/elementwiseChainReduceGpuDispatch are missing (M6)
  - Fix: curated prose update; generator gap documented in M3/M6
- **M3 (high)** docs/reference/functions.md — Trigonometry table, sin row
  - Docs claim: WASM ([1024, 131072))
  - Code says: policy band array_sin_ptr = { min: 16384, max: 65536 } — functions/src/wasm/policy.ts:41-42
  - Fix: curated table cell
- **M4 (high)** docs/reference/functions.md — Arithmetic table Accel cells
  - Docs claim: add/subtract/multiply/divide/unaryMinus/sqrt/square/exp/norm/dot/outer/matvec = parallel†; sign/cube/cbrt/expm1/log2/log10/log1p/round/floor/ceil/fix = parallel; matmul = parallel
  - Code says: none of these Float64Array paths reference the worker pool — f64Unary/f64Binary (functions/src/typed/f64-kernels.ts:41-64), matmulSequential (functions/src/typed/arithmetic.ts:~3668), pairwise* JS kernels; the typed module doc itself says "no worker pool" (arithmetic.ts:9-11). The cells predate the synchronous-Float64Array cutover.
  - Fix: curated table cells → "—" (keep the real WASM cells: abs/log/log10/log1p)
- **M5 (medium)** docs/reference/functions.md — Hypothesis Tests table
  - Docs claim: no Accel column (implicit "—")
  - Code says: chiSquareTest/kolmogorovSmirnovTest/mannWhitneyTest/shapiroWilkTest dispatch to workers at n ≥ 4096 via named ops (functions/src/typed/hypothesis.ts:586,843,1080,1280) — under-claim
  - Fix: add the Accel column (parallel)
- **M6 (medium)** generated webgpu-pairing.md — standalone GPU list (7)
  - Docs claim: elementwiseChainGpuDispatch / elementwiseChainReduceGpuDispatch missing
  - Code says: generator defect: analyzeWebGPUPairing pass 1 extracts each function body by brace-matching from the FIRST "{" after the name (tools/create-dependency-graph/create-dependency-graph.ts ~line 3321); runChainLifecycle's signature contains an object-type literal `(sizes: { bytes: number; workgroups: number })` (functions/src/gpu/elementwise-gpu.ts:314), so its extracted "body" is the type literal and the real body (getResources → getGpuDevice, :254/:255) is never scanned — the transitive-marker propagation never reaches the two dispatchers (:471/:560).
  - Fix: generator source (out of scope for a docs-only PR); this inventory uses the code-verified count (9 standalone, 8 of them public exports)
- **M7 (medium)** generated wasm-pairing.md — runtime-effectiveness line + trailing note
  - Docs claim: "21 actually execute wasm, 0 fall back to JS" of 23 wasm-routed; note says poly-fit/Airy/argsort+rank are "deliberately kept on JS pending AS kernel-stabilization fixes"
  - Code says: internally inconsistent (21+0 ≠ 23 — parallelFFT/parallelIFFT are counted wasm via fftGpuDispatch, which is a WebGPU bridge, not AS); the note contradicts the Phase-6 sentence in the same report; and "actually execute wasm" ignores the dispatch policy — the bessel/airy/carlson/elliptic/erfc dispatches have AS exec paths but wasmPolicyAllows keeps them on JS by default (functions/src/wasm/policy.ts)
  - Fix: generator source (out of scope); this inventory records default=js per policy.ts
- **M8 (medium)** generated parallel-pairing.md — "Effectively parallelized" table
  - Docs claim: parallelStatCorr/MAD/Norm/Std/Variance/Histogram, parallelFFTMagnitude/Power, parallelXCorr/AutoCorr effective via the applyKernel pseudo-op at the 50 000 global threshold
  - Code says: detector artifact: the `parallel*(` regex matches a function's own/sibling recursion in its Array overload (e.g. parallelStatCorr → parallelStatCorr(toFloat64Array…)), misread as a generic pool path. The real paths are named ops with 'never' (inline JS). parallelConv/XCorr/AutoCorr ARE effective — through the NAMELESS 50k gate + fftBatch, not applyKernel.
  - Fix: generator source (out of scope); this inventory uses the code-verified routing
- **M9 (low)** docs/reference/functions.md — Arithmetic table, pow row
  - Docs claim: Accel cell "—"
  - Code says: the matrix-power path routes through backendManager.multiply → WASMBackend SIMD GEMM at flop count ≥ 13824 = 24³ (functions/src/typed/arithmetic.ts matrixPowNumber) — under-claim
  - Fix: curated table cell
- **M10 (medium)** JSDoc of tensorEigWasm / tensorSvdWasm (tensor/src/operations/eig.ts:169-170, svd.ts) + matrix/src/operations/eig-wasm.ts API surface
  - Docs claim: "accelerated for large matricisations. Async (WASM instantiation)"
  - Code says: the bodies delegate to the synchronous JS eig/svd — the AS eig/svd kernels were RETIRED and REMOVED 2026-07-01 (measured 0.2–0.7× of JS, ~5× slower at 128²; matrix/src/operations/eig-wasm.ts header). The async Wasm-named API is a JS shim kept for compatibility.
  - Fix: code docstrings (out of scope for a docs-only PR — recorded here so the challenger sees the name-vs-reality trap; the Accel/classification data in inventory.json reflects the JS reality)
- **M11 (high)** this inventory — every `wasm (flop count ≥ 256 …)` claim (functions.md `pow` row, the ranked list, the matrix/tensor pairings)
  - Docs claim: the matrix package engages WASM GEMM at flop count ≥ 256
  - Code says: matrix/src/config.ts sets `backends.wasm.operationThresholds.multiply = 13_824` (24³) since commit 25ce9aa5 (#1420, measured crossover); `256` is the pre-#1420 value. Verified at runtime: a 12³ `backendManager.multiply` (1728 flops) stays on JS and 24³ (13 824) takes the WASM kernel.
  - Fix: corrected the generator’s prose and evidence anchors
- **M12 (high)** this inventory — `asStandalone: existing`
  - Docs claim: 284 entries are "an import-free kernel already covers the function"
  - Code says: the state was assigned from the FUNCTION’S FAMILY, not from the function: all 77 `arithmetic.elementwise` rows cited `assembly/src/elementwise.ts`, which declares 18 `array_<op>_ptr` kernels and no `add`/`multiply`/`sqrt`/`acos`/`cumsum`; `functions.special` did the same for 76 rows against `special.ts`’s 20 exports. Only 86 of the 284 cited files actually declare the named function’s kernel. The count is now 86 and the rest are `candidate` with the family-file note.
  - Fix: per-function kernel audit in build-inventory.mjs
- **M13 (medium)** this inventory — `pairings.wasm.kernel` for `pow`
  - Docs claim: kernel `matrix_multiply_simd_ptr (matrix backend, not the typed dispatch)` — a kernel id with a parenthetical inside it
  - Code says: the parenthetical made the id unresolvable (`KERNEL_HOME` had no such key), so `asImpl` was null for a `paired` row and `dualSetup.wasm` said `none` while `classification.wasm` said `paired`. The id is now `matrix_multiply_simd_ptr` with a separate `kernelNote`, and the row carries the AS file:line.
  - Fix: split the kernel id from its note; map it to assembly/src/ops/matrix.ts
- **M14 (low)** this inventory — `pairings.workpool` for parallelStatMedian/Quantile/Percentile and `asStandalone` for `sort`
  - Docs claim: `sort` and the `parallelStat*` sort users are backed by `sort_f64`
  - Code says: true only above the policy band (n ≥ 1 048 576) and only on the typed statistics path; the public `sort` factory (functions/src/matrix/sort.ts) never calls `sortF64Dispatch`, so its row is `existing` for the kernel file but unpaired for dispatch — the notes now say so.
  - Fix: asImpl.note on unpaired standalone entries
- **M15 (medium)** this inventory — `dualSetup.wasm` for `pow` and `matrix.multiply`
  - Docs claim: none
  - Code says: both are classified `paired` and both have a TS reference + an AS kernel, so `dualSetup.wasm` is `existing` (it read `none` only because `asImpl` was null — see M13).
  - Fix: dualSetup keys off "asImpl came from a pairing kernel", not off asImpl being non-null
- **M16 (medium)** generated parallel-pairing.md — the nameless-50k "effectively parallelized" rows
  - Docs claim: parallelStatCorr / MAD / Norm / Std / Variance / Histogram are effective via `applyKernel`
  - Code says: functions/src/typed/statistics.ts contains no `applyKernel` call (grep: 0); those helpers call the named `computePool.<op>` methods, whose op thresholds are `'never'` — the detector matched a recursion on the helper’s own name. This inventory records the code-verified routing (default `js`), which the generated report’s `Effectively parallelized` table contradicts.
  - Fix: fix the `parallel*(` recursion match in the detector, or drop the column
- **M17 (high)** docs/reference/functions.md — the `pow` row; and this inventory’s `matrix.multiply` pairing default
  - Docs claim: the matrix product is WASM-accelerated at flop count ≥ threshold
  - Code says: measured at runtime: the PUBLIC `DenseMatrix.multiply` and the public `matrix.multiply` export both run `arithmetic.multiply → gemmF64` (JS) and never call `backendManager`, at 24³ and 64³ (0 `wasmBackend.multiply` calls). Only `backendManager.multiply` — reached by `functions.multiply`/`functions.pow` — takes the WASM kernel (1 and 3 calls at 24³/64³; none at 12³). `CLAUDE.md` says the same ("Public `DenseMatrix.multiply` … stay on JS"), but the `pow` cell and the pairing prose implied the whole matrix path was accelerated.
  - Fix: pairing distinguishes the public DenseMatrix path (JS) from backendManager (WASM)

Entry-level mismatches (per-function Accel-cell errors) are recorded on the entries themselves (`docMismatch`); 0 entries carry at least one.

## Relationship to the generated pairing reports

The `docs/Architecture/{wasm,parallel,webgpu}-pairing.{md,json}` reports (generated by `bun run docs:deps`, not committed) are the starting point but were NOT trusted: this inventory re-verifies routing against source anchors and records where the generator under/over-reports (mismatches M2, M6, M7, M8, M16). The generated reports are regenerated on every `docs:deps` run, so they always match the code AS THE DETECTOR SEES IT — the mismatches above are detector limitations, not stale output.

### What the challenger changed (review of this inventory)

- **`asStandalone` is now audited per function** (M12). The first draft assigned `existing` from the entry's FAMILY, so 284 rows claimed an import-free kernel; only 86 cited a file that actually declares that function's kernel. The rest are now `candidate` with a note naming the family file.
- **The matrix WASM threshold is read from `matrix/src/config.ts`** (M11). Every `256` became the measured `13 824 = 24³` of #1420, and the two `paired` matrix rows cite `multiply: 13_824` instead of the bare `256`.
- **`pow` and `matrix.multiply` now carry a real `asImpl` and `dualSetup.wasm: existing`** (M13, M15). `pow`'s `kernel` was `matrix_multiply_simd_ptr (matrix backend, …)`, a string no `KERNEL_HOME` key matched.
- **`atanh`'s evidence path is `trigonometry.ts`**, not `arithmetic.ts` (the dispatch anchor did not resolve).
- **A new mismatch (M16)** records that the generated `parallel-pairing.md` lists `parallelStat*` helpers as pool-effective although `statistics.ts` has no `applyKernel` call.
- **Verified, not changed:** the generator is reproducible byte-for-byte; the class counts (wasm 47/161/1064/347, workpool 67/211/1082/259, webgpu 8/41/1126/444) and `dualSetup` (wasm 47 existing after M13/M15, wasm 161 recommended, gpu 8 existing, gpu 41 recommended) match the code; every `paired` row's evidence anchors resolve to a real `file:line`; all 8 WebGPU pairings dispatch through the named `*GpuDispatch`; the `policy.ts` bands in the generator equal `WASM_DISPATCH_POLICY`; and `docs:functions:check` passes.

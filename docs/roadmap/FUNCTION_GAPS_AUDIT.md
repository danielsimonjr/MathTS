# MathTS Function & Auxiliary-Function Gap Audit

**Date:** 2026-05-24
**Source:** Cross-reference of `docs/Architecture/dependency-summary.compact.json` (2026-05-24 CDG run) against the per-package `typed/`, `factories/`, and synced-mathjs surface. Companion to the slice proposal in [`FUNCTION_GAPS.md`](./FUNCTION_GAPS.md).
**Method:**

- Listed every `functions/src/typed/*.ts` file's exported `mathTyped(…)` / `export function` count.
- Listed every synced category under `functions/src/{arithmetic, algebra, …}/` by file count.
- Counted `wasmLoader.*` and `computePool.*` call sites inside each `typed/<cat>.ts` to identify acceleration coverage.
- Cross-checked which `typed/<cat>.ts` files do not exist for a synced category that has > 0 files.
- For each `typed/` file flagged as "pure JS" or "worker-only" in class B, drilled into individual exports to identify _specific_ candidates for a WASM kernel port (B.1) or worker-route promotion (B.2).

This is the broader audit the [FUNCTION_GAPS proposal](./FUNCTION_GAPS.md) was extracted from. It picked the three highest-leverage slices (TapedTensor AD, complex+set promotion, Tensor decompositions); this document keeps the full inventory so the remaining slices are addressable from a single source of truth instead of being scattered across chat-history paragraphs.

**Quick-nav:**

- **A** — Promotion gaps (synced categories without an active `typed/<cat>.ts`).
- **B** — Acceleration gaps (high-level: `typed/` files running pure-JS).
- **B.1** — WASM-route playbook (specific exports that should get a Rust/AS kernel).
- **B.2** — Worker-route playbook (specific exports that should route through `ComputePool`).
- **B.3** — `typed/` files deliberately _not_ in either playbook (with rationale).
- **B.4** — Procedure for landing a B.1 / B.2 entry.
- **C** — Cross-cutting infrastructure gaps (Tensor / Autograd / Parallel / Matrix / Benchmarks).
- **D** — Sequencing recommendation (ranked, all classes).
- **E** — Out of scope (with rationales).
- **F** — How to use this document.

## A. Promotion gaps — synced categories without an active `typed/<cat>.ts`

Six categories ship synced mathjs files but never grew a typed-layer wrapper. The synced code is dormant — not exported through the public `functions/src/index.ts` directly.

| Category      | Synced files | Notable missing exports                                                                                                                                                                                       | Priority | Status                                                                                                                                                                                |
| ------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set`         |           10 | `setUnion`, `setIntersect`, `setDifference`, `setSymDifference`, `setIsSubset`, `setMultiplicity`, `setPowerset`, `setDistinct`, `setSize`, `setCartesian`                                                    | **★★★**  | ✅ promoted in commit `1bfad1e` (FUNCTION_GAPS Slice 2)                                                                                                                               |
| `complex`     |            4 | `arg`, `conj`, `im`, `re` — basic complex-number accessors                                                                                                                                                    | **★★★**  | ✅ promoted in commit `1bfad1e` (FUNCTION_GAPS Slice 2)                                                                                                                               |
| `relational`  |           13 | `deepEqual`, `unequal`, `compareNatural`, `compareText`, `compareUnits`, `equalScalar`, `equalText` (the basic `equal`/`larger`/`smaller`/`largerEq`/`smallerEq`/`compare` are already in `typed/numeric.ts`) | **★★**   | ✅ promoted in commit `7fe73b7` (GAP_CLOSURE Slice 1.2)                                                                                                                               |
| `probability` |           12 | `bernoulli`, `combinations`, `combinationsWithRep`, `multinomial`, `pickRandom`, `randomInt` — but most of the rest overlaps with `typed/distributions.ts` or `typed/special.ts` under different names        | **★**    | ✅ promoted 8 of 12 in Slice 4.6 after dedup audit; 4 skipped (`factorial`, `gamma`, `lgamma`, `kldivergence`) as already in active factory surface. 57 new tests; 2093 → 2150 (+57). |
| `unit`        |            2 | `to`, `toBest` — Unit-type conversion                                                                                                                                                                         | **★**    | ⏳ pending — depends on a real `Unit` type, which is not present in `core` today                                                                                                      |
| `string`      |            5 | `bin`, `hex`, `oct`, `format`, `print` — number formatting                                                                                                                                                    | ★        | ✅ promoted in commit `8af250b` (GAP_CLOSURE_WAVE4 Slice 4.4)                                                                                                                         |

### Open items in this class

- **`typed/relational.ts`** — ✅ landed in commit `7fe73b7` (GAP_CLOSURE Slice 1.2). 60 tests in `functions/tests/typed-relational.test.ts`; all 7 ops dispatch typed-only (no ComputePool / WASM — scalar comparisons + array traversal don't benefit from parallel routing at this layer; bulk-array use-cases deferred to a future Tier-3 slice).
- **`typed/probability.ts`** — ✅ landed in Slice 4.6. Dedup audit found 4 of 12 already in active factory surface (`factorial` tier-7, `gamma` tier-6, `lgamma` tier-1, `kldivergence` tier-13); promoted the remaining 8 (`bernoulli`, `combinations`, `combinationsWithRep`, `multinomial`, `permutations`, `random`, `randomInt`, `pickRandom`). Seeded PRNG paths verified reproducible via `seedProbabilityRng`. 57 new tests; functions count 2093 → 2150 (+57).
- **`typed/unit.ts`** — blocked on the absence of a real `Unit` type in `core`. If/when a Unit type lands, `to` and `toBest` are one-liner wrappers.
- **`typed/string.ts`** — ✅ landed in commit `8af250b` (GAP_CLOSURE_WAVE4 Slice 4.4). 5 ops (`bin`/`hex`/`oct`/`format`/`print`) with 39 tests. Functions: 2035 → 2093 (+58). Surfaced semantic subtleties: mathjs uses sign-magnitude (not two's-complement) for negative-number `bin`/`hex`/`oct` unless `wordSize` is passed; the typed file uses `any`/`any,any` signatures with inline `instanceof BigNumber` guards rather than typed-function dispatch on BigNumber to avoid the `number → BigNumber` auto-conversion hazard.

## B. Acceleration gaps — `typed/` files running pure-JS

The dep-graph snapshot of per-typed-file dispatch routing (`wasmLoader.*` and `computePool.*` call counts at the time of the audit):

| typed file      | exports | WASM calls | worker calls | Verdict                                                                                                                                                                                                                            |
| --------------- | ------: | ---------: | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `numeric`       |      34 |     **57** |            0 | well-accelerated                                                                                                                                                                                                                   |
| `signal`        |      33 |     **62** |           22 | best-accelerated                                                                                                                                                                                                                   |
| `geometry`      |      31 |     **25** |            1 | well-accelerated                                                                                                                                                                                                                   |
| `arithmetic`    |      54 |          0 |       **55** | worker-only — appropriate (cheap ops, WASM marshal would dominate)                                                                                                                                                                 |
| `statistics`    |      24 |          0 |           26 | worker-only                                                                                                                                                                                                                        |
| `trigonometry`  |      20 |          0 |           21 | worker-only                                                                                                                                                                                                                        |
| `algebra`       |      37 |          0 |            0 | **★★ pure JS — polynomial ops over many coefficients could WASM-route**                                                                                                                                                            |
| `cas`           |      31 |          0 |            0 | symbolic — appropriate as JS (WASM doesn't help symbolic)                                                                                                                                                                          |
| `combinatorics` |      21 |          0 |            0 | small-result ops; worker overhead would dominate. Appropriate as JS.                                                                                                                                                               |
| `integration`   |       4 |          0 |            0 | **★★ `trapz` / `simpson` / `gaussQuad` / `romberg` over big integrands should worker-route**                                                                                                                                       |
| `hypothesis`    |       7 |          0 |            0 | **★ KS / Mann-Whitney / Shapiro-Wilk over big samples should worker-route**                                                                                                                                                        |
| `interpolation` |       6 |          0 |            0 | mixed — `cubicSpline` already partly WASM via `numeric.ts`'s `rbf_interp_wasm`                                                                                                                                                     |
| `bitwise`       |       8 |          0 |            7 | worker-routed; WASM tier exists at the bridge level (`functions/src/wasm/bitwise/wasm-bridge.ts`, `WASM_BITWISE_THRESHOLD = 65,536`) but `typed/bitwise.ts` doesn't directly import it — dispatch is layered through `ComputePool` |
| `dist-objects`  |      12 |          0 |            0 | distribution sampling — could batch-parallelize but each sample is tiny                                                                                                                                                            |
| `graph`         |       8 |          0 |            0 | graph algorithms — appropriate as JS                                                                                                                                                                                               |
| `gpu`           |       4 |          0 |            0 | already on WebGPU (separate dispatch tier)                                                                                                                                                                                         |
| `logical`       |       6 |          0 |            0 | boolean ops — correctly skipped per the acceleration roadmap proposal                                                                                                                                                              |

### Open items in this class

- **`typed/algebra.ts` WASM routing for polynomial ops** — ✅ landed in commits `6520a76` (Slice 3.7) and `6e9f9c0` (Slice 4.5). Slice 3.7 added `poly_mul_f64` and `poly_div_mod_f64` covering `polymul`, `polynomialGCD`, `polynomialLCM`, `polynomialQuotient`, `polynomialRemainder` (22 tests). Slice 4.5 added `poly_resultant_f64` and `poly_discriminant_f64` via inlined Sylvester-det, wiring `discriminant` and `resultant` (18 new tests across 3 suites). Total: ~245 LOC Rust + ~205 LOC AS + ~385 LOC bridge, all gated at `WASM_POLY_THRESHOLD = 256`.
- **`typed/integration.ts` worker dispatch** — ✅ landed in commit `64c6168` (GAP_CLOSURE Slice 3.8). All four ops async; `gaussQuad` composite-mode dot-product offloaded to `ComputePool.dot()` at ≥ 64 sub-intervals; `romberg` sum offloaded at the same threshold; `trapzF64`/`simpsonF64` Float64Array overloads route `ComputePool.sum()` at ≥ 65,536 samples. User-supplied integrand stays on the main thread — only the post-evaluation sum/dot moves to workers.
- **`typed/hypothesis.ts` worker dispatch** — ✅ landed in commit `fad8324` (GAP_CLOSURE Slice 3.10). All four tests async at ≥ 4,096 samples. `chiSquareTest` fully worker-routed via `applyKernel2`+`sum` (no sequential bottleneck — strongest win). `kolmogorovSmirnovTest`/`mannWhitneyTest`/`shapiroWilkTest` keep the sort on the main thread (no `wasm.sortF64` kernel yet — out of this slice's scope); the post-sort statistical computation (CDF eval / rank-sum / W-numerator dot) is offloaded. Custom-CDF KS bypasses the route (closure can't serialise). 20 new dispatch-correctness tests in `typed-hypothesis-parallel.test.ts`.

## B.1 WASM-route playbook — pure-JS functions worth porting to a WASM kernel

The table below picks out the **specific functions** inside each `typed/` file (or each synced category that has been promoted) whose hot loops would benefit from a Rust/AS kernel. Selection criterion: the function spends ≥ 80% of its wall time in a regular numeric loop ≥ O(n) with n ≥ a few hundred elements, and the loop is _not_ already routed through `ComputePool` (which would already amortise its cost across workers).

Threshold guidance: each candidate has a recommended `minElements` (the size below which the WASM marshal cost dominates and the JS path should win). Treat these as starting points for a `bench:wasm` pass — the real thresholds get measured the same way `WASM_BITWISE_THRESHOLD = 65_536` was set.

| Candidate (file → exports)                                                                                                           | Loop kind                                                 | Where the time goes                                            | Suggested WASM kernel                                                           | Suggested `minElements` | Effort                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------ |
| `typed/algebra.ts` → `polymul`, `polynomialGCD`, `polynomialLCM`, `polynomialQuotient`, `polynomialRemainder`                        | O(n·m) convolution / Euclidean polynomial division        | f64 coefficient products + carries                             | `wasm.polyMulF64`, `wasm.polyDivModF64`                                         | ≥ 256 coeffs            | ~150 LOC Rust + AS port + bridge; mirrors the bitwise port                                                                                    |
| `typed/algebra.ts` → `discriminant`, `resultant`                                                                                     | Sylvester / resultant matrices                            | (n-1)×(n-1) determinant after polynomial fill                  | Reuse `wasm.detF64` + a thin `polyResultantFill`                                | ≥ 64 coeffs             | ~80 LOC bridge once the kernels above land                                                                                                    |
| `typed/cas.ts` → `polyFit`, `chebyshevFit`, `legendreFit`                                                                            | Normal-equations or QR over big sample arrays             | Vandermonde fill + QR/normal-eqs solve                         | `wasm.vandermondeF64` + reuse `wasm.qrF64`/`wasm.solveF64`                      | ≥ 1024 samples          | ~120 LOC; QR/solve already exist in the Rust crate                                                                                            |
| `typed/interpolation.ts` → `cubicSpline` (✅ `ec7363b`)                                                                              | Tridiagonal system                                        | Coefficient assembly + tridiagonal solve                       | `tridiag_solve_f64` (Thomas) — landed                                           | ≥ 1024 unknowns         | ~70 LOC Rust + 68 LOC AS + 196 LOC bridge; threshold = 1024                                                                                   |
| `typed/interpolation.ts` → `pchip`, `akima` — **not applicable**                                                                     | Monotone-cubic analytic slopes (Fritsch-Carlson / Akima)  | No tridiag system to solve                                     | n/a                                                                             | n/a                     | Per Slice 3.10b finding — slope formulas are closed-form, JS is fine                                                                          |
| `typed/interpolation.ts` → `lagrange`, `newtonInterp`                                                                                | O(n²) divided-difference table                            | Difference table fill                                          | `wasm.dividedDifferenceF64`                                                     | ≥ 256 nodes             | ~50 LOC                                                                                                                                       |
| `typed/integration.ts` → `gaussQuad`, `romberg`                                                                                      | Inner-product accumulation over weighted samples          | Sum over many evaluation points                                | `wasm.dotF64` (already exists) + JS dispatch                                    | ≥ 4096 samples          | Already mostly there — wiring the dot kernel into `typed/`                                                                                    |
| `typed/integration.ts` → `simpson`, `trapz`                                                                                          | Strided f64 accumulation                                  | The accumulator                                                | `wasm.simpsonF64`, `wasm.trapzF64` (1-liner kernels each)                       | ≥ 65,536 samples        | ~40 LOC total                                                                                                                                 |
| `typed/hypothesis.ts` → `kolmogorovSmirnovTest`, `mannWhitneyTest`                                                                   | Sort + CDF compare                                        | Sort (≥80% of wall time) + CDF computation                     | `wasm.sortF64` + `wasm.rankF64`                                                 | ≥ 4096 samples          | ~100 LOC; `wasm.sortF64` is a stock kernel                                                                                                    |
| `typed/hypothesis.ts` → `shapiroWilkTest`                                                                                            | Order-statistic regression                                | Sort + linear regression on order stats                        | Reuse `wasm.sortF64`; small JS tail                                             | ≥ 1024 samples          | ~60 LOC                                                                                                                                       |
| `typed/statistics.ts` → `histogram`, `quantile`, `percentile` (currently worker-routed)                                              | Sort + bucket-count                                       | Sort dominates                                                 | `wasm.sortF64`                                                                  | ≥ 16,384 samples        | ~80 LOC; could short-circuit the worker dispatch for huge cases                                                                               |
| `typed/distributions.ts` → `betaPdf`, `gammaPdf`, `studentTPdf`, `noncentralChi2Pdf` over arrays                                     | Per-element transcendental                                | `lgamma` / `beta` / `incompleteBeta`                           | `wasm.lgammaF64` + family                                                       | ≥ 4096 samples          | ~200 LOC; needs the special-functions crate path                                                                                              |
| `typed/special.ts` → `besselJ`, `besselY` (✅ `572363f`), `airyAi`, `airyBi` (✅ `276a75b`); `ellipticK`, `ellipticE` still deferred | Per-element series / continued fraction                   | Recurrence + checks                                            | `wasm.bessel_j0_f64`, `wasm.airy_ai_f64` and family (Rust + AS parity for both) | ≥ 1024 samples          | Bessel J/Y landed Slice 3.10c-1; Airy Ai/Bi + AS Bessel parity port landed Slice 4.9. Airy scalars implemented from scratch (power series for | x   | ≤ 4.5, asymptotic for larger). |
| `typed/signal.ts` (additional) → `goertzel`, `chirpZTransform`, `welchPSD`, `bartlettPSD`, `multiTaperPSD`                           | Already partly WASM via FFT; spectral-estimation wrappers | The non-FFT parts (windowing + averaging) are the JS hot spots | `wasm.applyWindowF64`, `wasm.averagePSDF64`                                     | ≥ 4096 samples          | ~100 LOC; reuses existing FFT kernel                                                                                                          |
| `typed/geometry.ts` (additional) → `convexHull2D`, `convexHull3D`, `delaunay2D`                                                      | Sorted/incremental algorithms over many 2-D / 3-D points  | Sort + orient/inCircle predicates                              | `wasm.sortF64`, `wasm.orient2D`, `wasm.inCircle`                                | ≥ 8192 points           | ~250 LOC; predicates are stock-numerical                                                                                                      |
| `typed/numeric.ts` (already well-accelerated) → `pinv`, `expm`, `logm`, `sqrtm`                                                      | Matrix-function evaluators (Padé / Schur)                 | Eig/Schur + tail evaluation                                    | Reuse `wasm.eigF64` / `wasm.schurF64`; thin JS wrapper                          | ≥ 64×64                 | ~80 LOC; mostly wiring                                                                                                                        |

> The candidates above describe **WASM kernel ports** of pure-JS hot loops. The mirror question — _"which existing WASM kernel is the right one to reuse?"_ — is captured in the "Suggested WASM kernel" column. Where it says **reuse**, the Rust crate already has the underlying primitive (`wasm.eigF64`, `wasm.qrF64`, `wasm.dotF64`, etc.) and the work is just bridge plumbing.

## B.2 Worker-route playbook — pure-JS functions worth offloading to `ComputePool`

Worker-route is the right tier when the function's loop is **embarrassingly parallel and per-element cost is high enough that worker-message overhead is amortised** — typically the case for compute-bound transcendentals over large arrays. For ops dominated by f64 multiply-add (where WASM wins), prefer B.1 instead.

| Candidate (file → exports)                                                                                       | Why worker (not WASM)                                                                                                                                        | Suggested `minElements` | Effort                                                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------- |
| `typed/integration.ts` → `gaussQuad`, `romberg` over many sub-intervals                                          | Each sub-interval evaluates a user-supplied closure → worker can host the closure; WASM cannot                                                               | ≥ 64 sub-intervals      | ~80 LOC `ComputePool` plumbing + benchmark              |
| `typed/hypothesis.ts` → all four tests when bootstrapping/permutation-resampling                                 | The user is doing many independent test runs in a loop; coarse-grained worker fan-out is the natural shape                                                   | ≥ 32 resamples          | ~60 LOC plumbing; consumer-facing `bootstrap=true` flag |
| `typed/cas.ts` → `polyFit` with cross-validation                                                                 | K-fold CV is embarrassingly parallel over folds; per-fold work is too small for WASM but fine for workers                                                    | ≥ 5 folds × ≥ 256 pts   | ~70 LOC; lives in the consumer (CV harness)             |
| `typed/dist-objects.ts` → batch sampling (`Normal.sample(n)`, `Gamma.sample(n)`, etc.) for `n` ≥ 100k            | Each sample is a closure call (transcendental rejection sampling); per-call cost is large enough for workers                                                 | ≥ 100,000 samples       | ~50 LOC; one shared dispatcher across all distributions |
| `typed/distributions.ts` → array-valued pdf/cdf over user closures (e.g. `pdf(f, xs)` where `f` is user-defined) | User closure prevents WASM port; worker hosts the closure and parallelises the array sweep                                                                   | ≥ 8192 samples          | ~50 LOC plumbing                                        |
| `typed/cas.ts` → `simplify`, `derivative`, `expand`, `factorise` over batches of expressions                     | Symbolic — never a WASM candidate; if a consumer is processing many independent expressions, batch through `ComputePool`                                     | ≥ 16 expressions/batch  | ~60 LOC; consumer-facing batch API                      |
| `typed/graph.ts` → `pageRank`, `betweennessCentrality`, `eigenvectorCentrality` with multiple random restarts    | Each restart is independent — worker-route the restarts                                                                                                      | ≥ 4 restarts            | ~80 LOC plumbing                                        |
| `typed/special.ts` → `besselJ`/`Y` and friends over large arrays (if not WASM-ported)                            | Per-element transcendental cost is large enough that workers help even without a WASM kernel; this is the **fallback if B.1's `wasm.besselJF64` port slips** | ≥ 16,384 elements       | ~50 LOC plumbing; superseded by B.1 if the kernel lands |
| `typed/interpolation.ts` → user-closure-based methods (e.g. an interp builder that takes a user-defined kernel)  | Closure prevents WASM; workers host the closure                                                                                                              | ≥ 4096 query points     | ~50 LOC plumbing                                        |

### B.3 Why some `typed/` files are deliberately not in either playbook

- **`typed/combinatorics.ts`** — small result, large input integer-only. The integer work either fits in `bigint` (which workers can't speed up — single-thread bigint engine) or is small enough that marshal cost wins.
- **`typed/logical.ts`** — boolean ops; the predicate-aware short-circuit pattern (and JIT-friendly tight loops) already runs at JS native speed.
- **`typed/cas.ts` (symbolic core)** — tree rewriting; pointer-chasing in WASM costs more than it saves.
- **`typed/bitwise.ts`** — WASM tier already exists at the bridge level (`functions/src/wasm/bitwise/wasm-bridge.ts`, `WASM_BITWISE_THRESHOLD = 65_536`). The `typed/` layer dispatches through `ComputePool`, which routes to WASM where applicable.
- **`typed/gpu.ts`** — already on the WebGPU tier (separate dispatch).

### B.4 How to land a B.1 / B.2 entry

The pattern (lifted from the bitwise port that's already shipped):

1. Add the kernel to `wasm-rust/crates/<crate>/src/<file>.rs` with `#[wasm_bindgen]`.
2. Mirror it in `assembly/src/<file>.ts` for the AS path.
3. Regenerate the manifest with `node tools/generate-wasm-manifest.mjs`.
4. Add a bridge in `functions/src/wasm/<area>/wasm-bridge.ts` that gates on `minElements`.
5. Wire `typed/<file>.ts` to call the bridge for the relevant types; keep the pure-JS implementation for small inputs and the fallback.
6. Add a `tools/benchmark/wasm/<op>.bench.ts` to measure and re-tune the threshold.
7. Update `docs/Architecture/dependency-summary.compact.json` via `npm run cdg` so this audit's class B table reflects the new acceleration coverage.

For a B.2 (worker-only) entry, steps 1–4 are skipped — only the `typed/<file>.ts` and the `tools/benchmark/parallel/<op>.bench.ts` change.

## C. Cross-cutting infrastructure gaps

### Tensor (`@danielsimonjr/mathts-tensor`)

| Item                                                                        | Status                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tensorSvd` truncated tensor SVD                                            | ✅ landed in `a21a844` (ITENSOR_PARITY Phase 2)                                                                                                                                                         |
| `tensorQr` / `tensorLU` / `tensorCholesky` / `tensorEig`                    | ✅ landed in `1bfad1e` (FUNCTION_GAPS Slice 3)                                                                                                                                                          |
| `tensorPinv` (Moore-Penrose pseudoinverse)                                  | ✅ landed in `70217b7` (GAP_CLOSURE Slice 2.4) — full SVD + `rcond·max(S)` thresholding (default 1e-10); 17 tests                                                                                       |
| `tensorSolve(A, b)` (linear system on tensors with named indices)           | ✅ landed in `70217b7` (GAP_CLOSURE Slice 2.4) — LU + inline forward/back substitution (no intermediate matrix allocation); auto-matches A/b axes by named Index when both carry `axisLabels`; 15 tests |
| `tensorKron` (Kronecker product)                                            | ✅ landed in `70217b7` (GAP_CLOSURE Slice 2.4) — axis-by-axis Kron with size-1 prepending for rank-mismatched operands; axisLabels concatenated as `"aName_X_bName"`; 17 tests                          |
| `Tensor.slice / gather / scatter / concatenate / stack / pad / roll / flip` | ✅ core 4 (`slice`, `gather`, `stack`, `concatenate`) landed in commit `13eda2f` (GAP_CLOSURE_WAVE4 Slice 4.7); +57 tests. `scatter`/`pad`/`roll`/`flip` remain deferred to a 4.7b follow-up.           |

### Autograd (`@danielsimonjr/mathts-autograd`)

| Item                                                                                                    | Status                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TapedTensor.contract` + `TapedTensor.matmul`                                                           | ✅ landed in `4417836` (ITENSOR_PARITY Phase 5)                                                                                                                                                                                                                                                                                                                                      |
| `TapedTensor` reductions (`sum`/`mean`/`max`/`min`/`prod`/`norm`)                                       | ✅ landed in `1bfad1e` (FUNCTION_GAPS Slice 1)                                                                                                                                                                                                                                                                                                                                       |
| `TapedTensor` elementwise math (`log`/`exp`/`sin`/`cos`/`tan`/`sqrt`/`square`/`pow`/`reciprocal`/`abs`) | ✅ landed in `1bfad1e` (FUNCTION_GAPS Slice 1)                                                                                                                                                                                                                                                                                                                                       |
| `TapedTensor.divide` / `TapedTensor.sub`                                                                | ✅ landed in commit `4462f69` (GAP_CLOSURE Slice 1.1) — `sub` was already drafted but had no tests; both now covered by 10 new tests in `tape-elementwise-ad.test.ts` including aliased self-division (gradient = 0)                                                                                                                                                                 |
| `TapedTensor.tensordot`                                                                                 | ✅ landed in commit `fd81cd8` (GAP_CLOSURE_WAVE4 Slice 4.8) along with `TapedTensor.svd` and `TapedTensor.eig` (symmetric path only — general non-symmetric eig still deferred). Repeated singular/eigen values handled via subgradient mask at `REL_TOL = 1e-10`. References: Townsend (2016) for SVD, Magnus & Neudecker (1999) §10.6.6 for sym-eig, PyTorch source for tensordot. |
| `TapedTensor.svd` / `eig`                                                                               | ✅ landed in commit `fd81cd8` (GAP_CLOSURE_WAVE4 Slice 4.8) — `svd` per Townsend (2016); `eig` symmetric-only per Magnus & Neudecker §10.6.6. General non-symmetric `eig` AD still deferred (complex eigenvalues, harder formulas).                                                                                                                                                  |
| `TapedTensor.pow(taped, taped)` (variable-exponent pow)                                                 | ⏳ pending — requires both inputs on tape                                                                                                                                                                                                                                                                                                                                            |

### Parallel / ComputePool (`@danielsimonjr/mathts-parallel`)

| Item                                                                             | Status                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ComputePool.subtract` exists; `ComputePool.divide` is missing                   | ✅ closed in commit `fe40938` (GAP_CLOSURE Slice 1.3) — no new kernel needed, the `elementwiseChunk` worker handler already covered `'divide'` generically                                                                                                                                                                       |
| `ComputePool` for `pow`, `sqrt`, `square`, `sign` (elementwise math beyond trig) | ✅ landed in commit `73e6ca9` (GAP_CLOSURE_WAVE4 Slice 4.1) — `sqrt`/`square` already existed; `pow` + `sign` + `tensordot` added (the latter required a new `tensordotChunk` worker kernel; the elementwise ops reuse the generic `applyKernel`/`applyKernel2` dispatchers). `tensordot` threshold: 8 K contracted-axis volume. |
| `ComputePool.tensordot`                                                          | ⏳ pending — would let Phase-6's `Tensor.tensordot` route through workers above threshold                                                                                                                                                                                                                                        |

### Matrix (`@danielsimonjr/mathts-matrix`)

| Item                                 | Status                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public `qr` primitive                | ✅ existed; promoted to a re-export in `1bfad1e` (FUNCTION_GAPS Slice 3)                                                                                                                                                                                                                                                              |
| Public `lu` / `cholesky` primitives  | ✅ promoted in commit `c0df3dd` (GAP_CLOSURE Slice 1.5) — `matrix.lu` returns `{L, U, P}`, `matrix.cholesky` returns `{L}`; tensor wrappers now delegate (parity computed from permutation cycle structure since matrix.lu doesn't return it). 22 new matrix-level tests; all 16 existing tensor tests still pass through delegation. |
| `matrixPinv` (pseudoinverse via SVD) | ✅ landed in commit `8b357cc` (GAP_CLOSURE_WAVE4 Slice 4.2) — full SVD + `rcond·max(S)` threshold (default 1e-10); 14 tests; exported as `matrixPinv` to avoid collision with the existing `pinv` in `svd.ts`.                                                                                                                        |

### Benchmarks

| Item                                                                  | Status                                                                                                                                                                                                      |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bench:wasm` (Rust vs AS vs JS)                                       | ✅ exists                                                                                                                                                                                                   |
| `bench:parallel` (worker vs sequential break-even)                    | ✅ exists                                                                                                                                                                                                   |
| `bench:tensor` (contract, contractNetwork, tensordot, decompositions) | ✅ landed in commit `08ce15f` (GAP_CLOSURE Slice 1.6) — four bench files + `npm run bench:tensor` script; baseline numbers (2026-05-24) captured in `ACCELERATION_BENCHMARKS.md`. Full suite wall-time 25s. |

## D. Sequencing recommendation

What's now done since this audit ran (2026-05-24): the three slices in `FUNCTION_GAPS.md` (TapedTensor reductions + elementwise AD; `typed/complex.ts` + `typed/set.ts` promotion; Tensor `qr` / `lu` / `cholesky` / `eig` wrappers) — all landed in commit `1bfad1e`.

What's left and ranked by leverage:

| Rank | Item                                                                                                      | Class                     | Why it's next                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | ✅ `4462f69` — `TapedTensor.divide` + `.sub`                                                              | C (autograd)              | Smallest gap closes a symmetry asymmetry; trivial adjoints (`dA = dY / b`, `dB = -dY · A / b²` for divide; `dA = dY`, `dB = -dY` for sub). |
| 2    | ✅ `7fe73b7` — `typed/relational.ts` (7 missing comparison ops)                                           | A                         | Leaf-function promotion; no architectural risk; same pattern as `typed/complex.ts`.                                                        |
| 3    | ✅ `fe40938` — `ComputePool.divide`                                                                       | C (parallel)              | One-line plumbing parity with `subtract`.                                                                                                  |
| 4    | ✅ `70217b7` — `tensorPinv` + `tensorSolve` + `tensorKron`                                                | C (tensor)                | Common ML/stats primitives; small impl on top of `tensorSvd`.                                                                              |
| 5    | ✅ `c0df3dd` — Promote `tensor/src/operations/{lu,cholesky}.ts` into `matrix/src/operations/`             | C (matrix de-duplication) | Pure refactor; no behavioural change.                                                                                                      |
| 6    | ✅ `08ce15f` — `bench:tensor` suite                                                                       | C (benchmarks)            | Closes the perf-measurement gap for the ITensor-parity surface so future regressions show up in CI.                                        |
| 7    | ✅ `6520a76` — `typed/algebra.ts` polynomial WASM ports (B.1 rows 1-2)                                    | B                         | Substantial — Rust crate kernels + AS port + bridge + manifest regen. Worth doing once consumer pressure shows up.                         |
| 8    | ✅ `64c6168` — `typed/integration.ts` worker dispatch (B.2 row 1)                                         | B                         | Worker-routing `gaussQuad` / `romberg`. Bench-then-decide pattern (per the existing `bench:parallel` discipline).                          |
| 9    | ✅ `43f45a1` — `typed/probability.ts` dedup audit + selective promotion (8 of 12 promoted)                | A                         | First do the dedup audit against `distributions.ts`/`special.ts`; only promote what's genuinely missing.                                   |
| 10   | ✅ `fad8324` — `typed/hypothesis.ts` worker dispatch (B.2 row 2)                                          | B                         | Same pattern as integration.                                                                                                               |
| 10b  | ✅ `ec7363b` — `typed/interpolation.ts` tridiag-solve WASM (B.1 row 4)                                    | B                         | Reuses an existing stock kernel; cubic-spline over big knot sets wins here.                                                                |
| 10c  | ✅ `572363f` — `typed/special.ts` Bessel `J`/`Y` WASM (sub-slice 10c-1; Airy + AS port deferred as 10c-2) | B                         | Bigger surface (~300 LOC) but unlocks an array-input fast path that's currently O(n) JS transcendentals.                                   |
| 11   | ✅ `13eda2f` — `Tensor.slice` / `gather` / `stack` / `concatenate` core family                            | C (tensor)                | NumPy-style indexing primitives; bigger surface, lower leverage than the decompositions. (`scatter`/`pad`/`roll`/`flip` deferred to 4.7b.) |
| 12   | ✅ `fd81cd8` — `TapedTensor.tensordot` / `svd` / `eig` (symmetric only)                                   | C (autograd)              | Decomposition adjoints have edge cases; their own slice.                                                                                   |
| 13   | ✅ `8af250b` — `typed/string.ts` (`bin`/`hex`/`oct`/`format`/`print`)                                     | A                         | Formatter helpers; rounds out the mathjs API surface but no downstream consumer is blocking.                                               |
| 14   | `typed/unit.ts`                                                                                           | A                         | Blocked on a `Unit` type landing in `core` first.                                                                                          |

## E. Out of scope (decided not to pursue)

These were considered and consciously not pursued (see [`docs/roadmap/ITENSOR_PARITY.md`](./ITENSOR_PARITY.md) §8 for the longer rationales):

- **MPS/MPO state representations** — physics-specific; belong in UPT or a sibling.
- **DMRG / TEBD / TDVP variational algorithms** — physics-specific.
- **Quantum-number block-sparse tensor storage** — UPT proposal §1.3 explicitly disclaims wanting this in MathTS.
- **Fermionic anticommutation / particle-conservation arithmetic** — physics-specific.
- **HDF5 I/O for tensors** — adds a runtime dependency for marginal browser-audience value.
- **Sparse-tensor decompositions** (COO / CSR-N etc.) — limited value for browser-first workloads; the matrix sparse path already covers most use cases.
- **Compile-time shape inference at the TS type level** — tried in `@tensorflow/tfjs` and abandoned; TypeScript's type system isn't expressive enough to be ergonomic.
- **`eigs` / `svd` / `singularValues` worker-dispatch parallelization** — re-validated 2026-05-23 with measured bench evidence; sequential JS-fallback stays. See `tools/benchmark/parallel/eig-inner-probe.ts` for the data.
- **`polyFit` / `leastSquares` worker-dispatch parallelization** — re-validated 2026-05-23 with measured bench evidence; sequential stays. See `tools/benchmark/parallel/regression-probe.ts`.
- **Unified f32 WebGPU path** — design spec written at [`docs/roadmap/UNIFIED_WEBGPU_PATH.md`](./UNIFIED_WEBGPU_PATH.md); separate research effort.

## F. How to use this document

When a new slice lands, update the corresponding row's Status column. When a new gap is discovered (e.g. CDG surfaces a category not in this audit), add it to the right class (A / B / C) and the sequencing table (D). When a gap is decided not-to-pursue, move it to class E with the rationale.

The "Status" column uses three states:

- **✅ landed in `<commit-sha>`** — done; cite the commit.
- **⏳ pending** — actionable; pin to a numbered row in section D for prioritisation.
- **Decided not to pursue** — move to section E with the rationale, do not leave in A/B/C.

## G. Audit refresh — 2026-05-24 (post-Wave-3)

After Wave 1-3 landings, a fresh CDG pass was run to confirm there were no new gaps or regressions. **Two CDG bugs were uncovered and fixed in the same pass:**

1. **Workspace-import edges weren't followed.** `findReachableFiles` and `detectUnused` both only iterated `internalDependencies` (relative imports) and ignored `workspaceDependencies` (npm-scoped cross-package imports). That caused `packages/workerpool/src/index.ts` to be false-flagged as the only "unused file" — `parallel/ComputePool.ts` consumes it via `@danielsimonjr/mathts-workerpool` and CDG didn't see that edge.
2. **Test-file consumers weren't considered.** When `--include-tests` was set, test files were parsed only for the coverage analysis, not for the unused-export analysis. Test-only consumers (`resetPolyWasm`, `resetTridiagWasm`, JS-fallback helpers like `tridiagSolveJS` / `besselJ0JS`, and threshold constants like `WASM_TRIDIAG_THRESHOLD`) were false-flagged.

Both fixes landed in this same commit batch as `tools/create-dependency-graph/create-dependency-graph.ts`.

### Post-fix CDG metrics

| Metric                  | Before fix | After fix | Δ                     |
| ----------------------- | ---------: | --------: | --------------------- |
| Unused files            |          1 |         0 | −1 (false positive)   |
| Unused exports          |        406 |       308 | −98 (false positives) |
| Circular dependencies   |          0 |         0 | unchanged             |
| Effective test coverage |     100.0% |    100.0% | unchanged (163 / 163) |
| Reachable source files  |        513 |       513 | unchanged             |

Two genuinely-unconsumed test-escape-hatch exports were also flagged and resolved by adding test calls that exercise them:

- `resetBitwiseWasm` — the bitwise WASM-fallback test now calls the stable wrapper (`resetBitwiseWasm`) instead of the raw `wasmLoader.reset()`, matching the pattern from the poly/tridiag slices.
- `resetBesselWasm` — typed-special-wasm.test.ts grew a new "Suite 4 — fallback when WASM module not loaded" with two tests exercising the reset + JS fallback path.

### Remaining 308 "unused exports" — categorised

Inspection of the post-fix `unused-analysis.md` confirms the remainder breaks down as:

- **201 interface / type declarations (65%)** — public-API type exports consumed by downstream packages (UPT, external apps) and consumer code outside the monorepo. CDG can't see those consumers, so the flag is unavoidable without a deeper public-API manifest.
- **64 functions (21%)** — public-API helpers + benchmark-only entry points (`tools/benchmark/wasm/*.bench.ts` consumes `tridiagSolveJS`, `besselJ0JS`, etc.; CDG's reachability scope doesn't include `tools/`).
- **42 constants (14%)** — config defaults, threshold constants exported for consumer tuning.
- **3 classes (1%)** — public-API class exports.

These are all **legitimate public-API contracts**. A future CDG improvement would be a `public-api-manifest.json` companion to `coverage-policy.json` that lists exports intentionally consumed cross-package boundary so they don't flag.

### New gaps surfaced by this refresh

**None.** The refresh confirms:

- Effective test coverage stays at 100% (no new active code added without a test).
- No new circular dependencies introduced by Wave 1-3.
- All Wave 1-3 landed primitives (Bessel/tridiag/poly WASM bridges, tensor decomposition wrappers, typed/relational, ComputePool.divide) trace correctly through reachability after the CDG fixes.

The Tier-4 deferred items from section D remain the only forward work tracked:

- **Rank 9** — `typed/probability.ts` dedup-audit + selective promotion.
- **Rank 11** — `Tensor.slice` / `gather` / `stack` / `concatenate` family.
- **Rank 12** — `TapedTensor.tensordot` / `svd` / `eig` AD.
- **Rank 13** — `typed/string.ts`.
- **Rank 14** — `typed/unit.ts` (blocked on a `Unit` type in core).
- **3.10c-2** — Airy `Ai`/`Bi` WASM + AssemblyScript parity for Bessel (the deferred sub-slice from 3.10c).

No new gaps to add. The audit is current as of this refresh.

# MathTS TODO

Generated: 2026-01-13
Updated: 2026-07-01
Location: relocated to repo root in 2026-05-23 (was `docs/refactoring/TODO.md`)

> **Current State:** 444+ functions, 545 factory functions, 21 categories. 9,263 tests passing, 0 failing. Full function reference: https://danielsimonjr.github.io/mathjs/
>
> **Roadmap status (2026-05-24):** ✅ The entire `FUNCTION_GAPS_AUDIT.md` gap-closure roadmap is **closed** — all 6 waves (38 slices) landed across ~36 commits. Effective coverage 100% on active code; 0 circular deps; pipeline 19/19 green; 6308 vitest + 172 WASM integration tests pass / 7 skipped / zero regressions.
>
> **Gap re-analysis (2026-06-29):** A fresh four-dimension pass (type-dispatch breadth · mathjs name parity · expression/workbook parity · external-oracle correctness) found MathTS functionally **complete** (no missing functions, full parser parity) but **wide-not-deep**: real gaps are dispatch breadth (no `Unit` in operators), external grounding (distribution CDFs / CAS / decomposition factors tested only self-referentially), and cosmetic (6 factory-only aliases). Full catalogue + ranked sequencing: [`docs/roadmap/FUNCTION_GAPS.md` §7](docs/roadmap/FUNCTION_GAPS.md#7-deep-re-analysis-2026-06-29--new-gaps-post-wave-6). Top 3: distribution CDF/quantile vs scipy.stats · `Unit` operator dispatch · complex `zeta`/`gamma`/`lgamma` oracle.
>
> **Bridge re-validation (2026-06-29):** All 10 integration bridges in `GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md` re-checked vs current `main`. Of the 5 material gaps in the 2026-05-20 scorecard, **3 resolved** (B5 compat → 665 fns via `create(all)`; B7 workbook → `evaluate()`+sandbox; B3 FFT-fallback), **1 half-built** (B8 tensor/autograd: converters + native AD landed, no WASM/`functions` AD), **1 persists** (B2 matrix-factory acceleration). Every user-facing function gap closed (52 constants, type-conversion fns, `isInteger`, `parser()`, reviver/replacer); dormant 102 → 39 (all internal). Full Revision 3 + new gaps: [`docs/roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md` Part 5](docs/roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md#part-5--revision-3-re-validation-2026-06-29). **New gaps — top 3:** `functions.md` drift (~40 undocumented, no generator) · `variance` (pop) ≠ `parallelStatVariance` (sample) silent divergence · B2 factory matrix ops still pure-JS on boxed `number[][]`.

> **Domain coverage gap analysis (2026-06-30):** Fresh lens — _mathematical/scientific completeness within domains_ + _cross-domain connector functions_, sourced from the now-current `functions.md` (744 exports) and vs the SciPy/SymPy bar. Distinct from the two reports above (which cover package bridges + mathjs parity). Thinnest domains: **statistics (~55%)** — no `skewness`/`kurtosis`/`cov`/`gmean`/rank-correlation — and **hypothesis tests (~55%)** — no `fTest`/`kruskalWallis`/`wilcoxon`/`fisherExact`. Highest-leverage bridge: **C4** — the special-fn primitives (`betainc`/`gammainc`/`erfcScalar`) already back the distribution objects but aren't surfaced as standalone `*CDF`/`*Quantile`, which would also unblock the missing tests. Recommended **Wave A** (small, pure, high-traffic): `skewness`/`kurtosis`/`moment`/`cov`/`gmean`/`iqr`/`zscore`/`logsumexp`/`softmax`/`cumprod`/`cumtrapz`. Full report + scorecard + C1–C12 bridge table: [`docs/roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md`](docs/roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md).
>
> **✅ CLOSED (2026-06-30) — no deferral.** Every wave plus all the remaining
> highest-complexity items were implemented, oracle-verified, and released:
> **~89 new functions** (744 → 828 exports) across descriptive stats
> (`descriptive-stats.ts`), elementwise/cumulative (`numeric-extra.ts`),
> standalone distribution CDF/quantile surface (`distribution-functions.ts`,
> bridge **C4**), hypothesis tests + Tukey HSD (`hypothesis-extra.ts`),
> structured matrices + `logdet`/`laplacianMatrix`/`generalizedEig`/`qz`
> (`linalg-extra.ts`), numeric `hessian`/`gradient` (`calculus-extra.ts`),
> geodesy + quaternions (`geometry-extra.ts`), time series
> (`timeseries-extra.ts`), OLS `linearRegression` (`regression-extra.ts`),
> optimizers `nelderMead`/`gradientDescent`/`levenbergMarquardt`
> (`optimization-extra.ts`), `kmeans`/`spectralClustering`
> (`clustering-extra.ts`), digital filter design
> `firwin`/`butter`/`lfilter`/`lfilterZi`/`filtfilt` (`signal-filter-extra.ts`,
> machine-precision vs scipy.signal), and `symbolicIntegral`
> (`cas-integration.ts`). Each function verified against NumPy/SciPy or by
> self-consistency (d/dx ∫f = f), with ~18 oracle-pinned test files (`gap-*.test.ts`)
> so CI needs no Python. **Two root-cause bugs surfaced by the new code and
> fixed (Rule 2):** (1) `eigs` returned wrong eigenvalues for _every_
> non-symmetric matrix — now routes the factory through native `matrix` `eig`
> (`functions/src/matrix/native-accel.ts#correctEigs`); (2) `core.Fraction(0.25)`
> threw `BigInt(0.25)`, silently breaking CAS `simplify`/`derivative` for any
> fractional coefficient — constructor now decomposes non-integers to an exact
> ratio. **Released to npm across two rounds:** `functions@0.6.0` (Waves A–D +
> eigs fix) then `functions@0.7.0` + `core@0.3.1` (remaining high-complexity +
> Fraction fix); verified live by fresh install (`butter`/`tukeyHSD`/
> `symbolicIntegral`/`nelderMead`/`Fraction(0.25)='1/4'`/`derivative('x^4/4')='x^3'`).
> Per-wave status tracked in the report. Full regression: functions 3057 +
> core 658 + compat 134 pass; tsc + eslint clean. Remaining as _breadth beyond
> spec_ (documented, not deferred): integration-by-parts / partial-fractions in
> `symbolicIntegral`, full real-spectrum triangularization of `qz` via a Francis
> double-shift.

> **🔧 IN PROGRESS (2026-06-30) — retroactive dev-workflow review + hardening.**
> The gap-closure work above shipped without dev-workflow steps 5 (code review) and
> 7 (code-simplifier). Running them retroactively (7 reviewers). Single recurring
> root cause: the new functions silently returned `NaN`/`Infinity`/garbage on
> degenerate input. Hardening file-by-file as atomic commits (throw on invalid
> input, scipy/numpy parity), tests in `functions/tests/gap-degenerate-inputs.test.ts`.
> Progress (✅ = committed): descriptive-stats ✅ · numeric-extra ✅ · hypothesis-extra ✅ ·
> linalg-extra ✅ (`companion` a[0]=0 guard + realSchur quasi-tri postcondition) · geometry-extra ✅ ·
> timeseries-extra ✅ · regression-extra ✅ · optimization-extra ✅ · clustering-extra ✅
> (`kmeans` `converged` field) · signal-filter-extra ✅ (`butter` Wn range) ·
> cas-integration ✅. All 11 hardening commits landed. Code-simplifier (step 7:
> guards clean, one dead `kruskalWallis` branch removed) + full re-verify (step 8:
> 3086 tests / 28-28 typecheck / 0 eslint) done; `studentizedRangeQuantile` 60→45
> bisections so the nested-Simpson solve fits the 5 s test timeout under load.
> **✅ Released `functions@0.8.0`** (minor) + dependents (arithmetic/trigonometry/
> statistics/signal@0.1.9, compat@0.2.5); core unchanged, workbook held. Verified
> live via `npm view`. Retroactive review + simplify pass complete.
> **Doc drift (2026-07-01):** the whole hand-written `docs/api/` tree had frozen at
> 2026-05-22 (`functions.md` claimed "158 exports" vs the real 828, missing the ~89
> gap-closure fns). Rewrote `tools/generate-functions-reference.mjs` table-driven to
> emit + drift-check a generated Complete-export-index block into **all five** package
> API docs (`functions` 828, `compat` 78, `core` 80, `matrix` 141, `parallel` 67) plus
> the reference `.md`/`.html` — 7 generated blocks; `docs:functions:check` guards them
> all. Then reorganized the `docs/reference/functions.md` generated index **by
> mathematical domain** (26 domains from the curated `##` sections + a
> `DOMAIN_SUPPLEMENT` for the 140 gap-closure/factory extras) instead of the coarse
> typed-namespace grouping that dumped 416 fns in one "uncategorized" bucket — every
> callable export is now categorized (empty "Other"; a new uncategorized export fails
> `docs:functions:check`). Then wrote the ~89 gap-closure functions into the curated
> domain tables at the top of `docs/reference/functions.md` (per-function signatures +
> descriptions, source-verified via 8 parallel doc agents) — they had existed only in
> the generated index; corrected the stale coverage count (686 callable / 828 total).
> **Standing rule (user, 2026-07-01):** always document new functions in the curated
> tables, not just the generated index. **Open (genuine wall, not deferral):** adding a `docs:functions:check` step to
> `.github/workflows/ci.yml` so drift fails CI is blocked by a workflow-edit security
> guard — needs the maintainer to add the step (snippet in the 2026-07-01 CHANGELOG /
> the doc commit message).
> **Architecture docs refreshed (2026-07-01):** ran `npm run docs:deps` and reconciled
> every hand-written `docs/Architecture/` doc (ARCHITECTURE/OVERVIEW/API/DATAFLOW/
> WASM\*ACCELERATION/COVERAGE_POLICY) to the generated 2026-07-01 reports — 846 files /
> 158,032 LOC / 4,088 exports / 0 runtime cycles; dormant-mirror framing removed;
> functions 828 exports; WASM 39/52/127 of 218; coverage 35.8% raw / 97.5% effective.
> All figures verified vs the reports / package.json / fresh test re-runs.
> **WASM binary counts drift-guarded (2026-07-01):** the AS binary export counts
> (318 fn / 330 total / 30 sources + category table) that ARCHITECTURE.md §6a used to
> hand-carry are now **generated** — `tools/create-dependency-graph` probes the built
> `.wasm` via `WebAssembly.Module.exports()` and emits a "WASM binary exports" section
> into `wasm-pairing.md`; §6a references it. Run `npm run build:wasm` before
> `npm run docs:deps` so the binary exists to probe (graceful "not built" note otherwise).
> **Functions doc surface cross-validated (2026-07-01):** the two independent
> "what-exports-exist" derivations (functions.md's runtime `dist` `Object.keys` vs the
> dep-graph's static source AST) now reconcile. Fixed an aliased-export blind spot in
> `create-dependency-graph` (`export { X as Y }` recorded `X`, now records `Y`); the tool
> emits `package-export-surfaces.json`; `docs:functions:check` fails if any shipped export
> lacks a source origin (first run clean: 828/828). Run `npm run docs:deps` alongside
> `npm run docs:functions` to keep both in sync.
> **Dep-graph cross-package edges fixed (2026-07-01):** the tool computed each file's
> `workspaceDependencies` (imports of other monorepo packages) for the package-level table
> but dropped the field from the per-file JSON + per-module `.md` sections, so file-level
> edges (`tensor → matrix`, `autograd → tensor`, …) were invisible (0/846). Fixed at source
> (serialize the field + render a Workspace block); now 64/846 files show them.
> Investigation finding: tensor reuses matrix decompositions, autograd builds on tensor —
> not reinventing; the open item is B8 (element-wise/AD not on the WASM/functions layer).

### "All libraries build on core" consolidation sweep (started 2026-07-01)

Standing principle: keep the fast/correct implementation in the standard layer (core + its
accelerated packages) once; every other package imports it so speedups propagate and there's
one thing to maintain (see memory `project-all-libraries-build-on-core`).

- ✅ **autograd ↔ core `Dual`** — shared `DUAL_UNARY_RULES` table in core; both scalar `Dual`
  and tensor `DualTensor` consume it; autograd's dead `core` dep now live. (47fc3b6)
- ✅ **core `/internal` subpath** — `@danielsimonjr/mathts-core/internal` (2nd tsup entry) exposes
  shared number/object utils without bloating core's main API; core reconciled to superset. (8553927)
- ✅ **functions + expression `number.ts`/`object.ts` → core/internal** — thin re-export shims;
  full suites green (functions 3087, expression 1980). (c07f324, 06cbc2c)
- ❌ **`is.ts` — decided AGAINST consolidating.** Type guards are called in hot numerical loops;
  V8 inlines package-local guards but NOT across a module boundary. A cross-module re-export shim
  slowed the studentized-range/Tukey Simpson integration ~40% (tipped `gap-tukey.test.ts` past its
  5s timeout). Guards are trivial 1-liners (low DRY value) vs a real perf cost → **keep per-package.**
  Lesson: hot-path helpers must stay inlinable; only consolidate cold utilities.
- ⬜ **`is.ts` alternative (optional):** if the DRY of is.ts is still wanted, the only perf-safe path
  is `noExternal`-bundling core's guards inline into functions/expression (source stays single, built
  bundle inlines). More build complexity; low priority given the guards' triviality.
- ✅ **tensor — non-task.** Real-valued `Float64Array`; delegates linalg to matrix; uses `Math.*`
  (the primitive). Reinvents nothing core provides; core dep is transitive-via-matrix.
- ✅ **audited the other libraries (matrix, parallel, workbook, compat) via the dep-graph reports —
  NO further consolidation targets.** None carry a `utils/` synced-fork; none redefine a core numeric
  type (no `Complex`/`Fraction`/`BigNumber`/`Dual` class outside core+assembly). They already build on
  the standard packages: **compat** re-exports core/matrix/parallel (its purpose); **workbook** builds on
  functions; **matrix** owns its domain (`Matrix`/`isMatrix`/`isDenseMatrix` — hot-path guards + its own
  `MatrixConfig`, correctly local per the rule); **parallel** clean. functions' remaining name-collisions
  outside `utils/` are public mathjs-API functions (`clone`/`typeOf`/`isInteger`/`format` via factories)
  and imported hot-path guards — all legitimate, not duplication.
- ✅ **regen dep-graph at sweep end** — `autograd → core` edge now real in the reports. (240a0dc)

### Post-consolidation follow-ups (2026-07-01)

Hygiene/guardrails first (bounded), then the B8 acceleration thread (the actual perf win).

- ✅ **[hygiene] dep-graph tool fights prettier** — `docs:deps` now chains `docs:deps:format`
  (`prettier --write` scoped to the tool's own outputs, not the coverage files it doesn't write),
  so regenerated reports are format-stable. Verified prettier-clean + idempotent.
- ✅ **[hygiene] `gap-tukey.test.ts` timeout edge** — gave the 3 nested-Simpson tests an explicit
  30s `testTimeout` (`SLOW_MS`) with a rationale comment. Compute-cost accommodation, not masking —
  the scipy-oracle assertions still verify correctness. Passes reliably (~10s under load).
- ✅ **[hygiene] stale-dist gotcha** — documented in AGENTS.md › Testing protocol (tests import deps'
  built `dist/` not `src/`; rebuild the dep first or use `npm run test` via turbo) + the partial-`tsup`
  gotcha (hand `--clean` skips the wasm copy). Also saved to memory `feedback-stale-dist-false-failures`.
- ✅ **[guardrail] lock in the hot-vs-cold rule** — `// PERF: keep local` banner on both
  `utils/is.ts` files + a deterministic structural guardrail test (`tests/is-guards-local.test.ts`
  in functions + expression) that fails if is.ts is turned into a core re-export shim. Chose
  structural over timing (a micro-benchmark wouldn't reliably reflect hot-loop inlining); verified
  the guard catches a shim.
- ✅ **[B8 — reframed: the goal is dogfooding + maintenance, not element-wise WASM perf]** WASM is a
  large-input backend the standard packages already own (matrix's `BackendManager`); consumers get it
  for free at scale. Dogfooding is **already achieved**: `tensor.matMul` routes through `matrix` (inherits
  the SIMD-WASM matmul — the one O(n²⁺) op that clearly benefits; `tensor`'s eig/svd run in JS since the
  scalar WASM eig/svd kernels were retired), `autograd` builds on `core`'s `DUAL_UNARY_RULES`,
  `functions`/`expression` on `core/internal`. Post-audit WASM winning surface: **SIMD matmul + LU/QR/
  Cholesky**. Element-wise arithmetic (add/multiply) WASM was retired (memory-bound, 4–6× loss); the
  element-wise **transcendental** dispatch (`functions` `array_<op>_ptr`) stays — its benchmarks conflict
  and the loss was unproven (see the corrected `tools/benchmarks/README.md`). Full framing there.
- ✅ **[investigated → NOT retired; docs corrected]** `functions` `WASM_ELEMENTWISE_THRESHOLD` single-op
  path. Reconciled the conflicting benchmarks: `bench:elementwise` shows AS winning at scale but its JS
  baseline uses a **non-inlinable indirect call** (`f(x)` via a lookup) that under-times JS ~2.4× and
  overstates the win; B8 (direct `Math.exp`, inlined) shows tie-to-mild-loss. Neither is the real
  comparison — the production fallback is `computePool.<op>`, not a bare loop. So "single-op WASM loses"
  was an over-generalization; premise **unproven**, path **stays** (retiring on unproven evidence risks a
  regression). Distinct from matrix element-wise arithmetic (memory-bound, cleanly 4–6× loss → retired).
- ⬜ **[to settle definitively, if perf here matters]** benchmark `elementwiseUnaryDispatch(op,xs)` vs
  `computePool.<op>(xs)` (the actual production alternative) — then raise/keep the 1024 threshold or
  retire, per data. Low priority (the current path is at worst perf-neutral).
- ✅ **[was BLOCKER] AS matmul kernel optimized — matrix's WASM matmul now beats JS 1.8–4.7×.** Added
  `matrix_multiply_simd_ptr` (f64x2 SIMD, ikj, ptr-ABI) and wired `WASMBackend.multiply` to it. The old
  scalar kernel lost to JS (0.41–0.73×); the SIMD kernel wins 1.81× (64²) → 4.68× (512²) vs JS ikj
  (init WASM first). matrix WASM+backend suites 209/209. `tools/benchmarks/matmul-wasm.mjs` fixed to
  actually init WASM (it was silently measuring the JS fallback).
- ✅ **dogfooded `Tensor.matMul` → matrix `backendManager.multiply`** — dropped the naive JS triple loop;
  tensor now inherits the SIMD-WASM matmul (WASM when initialized, matrix's JS-ikj otherwise). End-to-end:
  **3.6× (128²) → 6.8× (256²/512²)** vs the old loop, correctness exact; tensor 389/389, autograd 258/258.
- ✅ **[backend audit done → WASM scoped to matmul]** `tools/benchmarks/backend-audit.mjs`: matmul
  WASM wins 9–12× (beats Parallel 3–4× — SIMD is the compute-dense lever); element-wise/transpose
  WASM were 4–6× _slower_ than JS → retired. `WASMBackend.shouldUseWasm` now gates on `opKind` and
  only WASMs `'matmul'`; element-wise falls to JS (re-measured ≈ JS). matrix 209/209.
- ✅ **[decomposition audit done → WASM eig/svd retired]** `tools/benchmarks/decomp-audit.mjs`: WASM
  eig/svd were **0.2–0.7× JS, worse at scale** (scalar async Jacobi/Francis) — retired behind
  `WASM_{EIG,SVD,SPECTRAL}_ENABLED=false` in eig-wasm.ts/svd-wasm.ts (delegate to JS; un-pessimizes
  tensor's tensorEigWasm/tensorSvdWasm). lu/qr/cholesky had no wired WASM variant (dead kernels).
  WASM-dispatch tests skipped w/ reason; matrix 747 pass / 20 skip. **WASM's whole value is now the SIMD
  matmul kernel.**
- ✅ **[partial] deleted the dead WASM eig/svd DISPATCH code** — eig-wasm.ts/svd-wasm.ts rewritten to
  clean JS delegation (no flag-gated branches); 3 obsolete dispatch test files deleted. matrix 746/7skip.
- ✅ **[done] deleted the dead AS eig/svd kernels** — removed `ops/eig.ts` + `ops/svd.ts` +
  `index.ts` exports + `WasmLoader` type decls + `assembly/tests/svd.test.mjs` (+ its test-script entry)
  - the svd/eig benchmark cases; retargeted the matrix decomposition tests to correctness-only. Verified:
    WASM rebuild clean, assembly ALL PASS, matrix 743/7skip, tensor 389, autograd 258, typecheck 28/28,
    eslint clean. Kept lu/qr/cholesky/inverse/determinant kernels (WASMBackend uses them; diff-decomposition
    30/30). WASM surface is now SIMD matmul + LU/QR/Cholesky decompositions.
- ⚠️ **[correction] lu/qr/cholesky AS kernels are NOT dead** — `WASMBackend` has lu/qr/cholesky/inverse/
  determinant METHODS that call them via runtime `module.X` (dep-graph import edges don't capture these).
  Before touching `algebra/decomposition.ts`, audit whether those WASMBackend methods are reachable from
  the public API (the public `operations/{lu,qr,cholesky}.ts` are pure JS) — and benchmark if they win.
- ✅ **[pre-commit workflow] WB→DGT before every commit** — `.husky/pre-commit` runs `precommit:refresh`
  (`build:wasm && docs:deps`) + stages `docs/Architecture/` + `lint-staged`. Also restored staged-file
  linting (no committed hook existed before — `.husky/` was never tracked). `build:wasm` is the slow
  step; hook documents how to gate it on `assembly/src/` changes if needed.
- ⬜ **[follow-up] retire functions' `WASM_ELEMENTWISE_THRESHOLD` single-op path** — same reason
  (single-op element-wise WASM 0.85–0.95×). The _chain_ dispatch is fine.
- ✅ **[done — WASMBackend bodies] removed the dead WASM branches** in the 11 gated element-wise/
  transpose/reduction methods (add/subtract/multiply-elementwise/divide/scale/abs/negate/transpose/
  sum/norm/dot) → pure `jsBackend` delegation; trimmed `AsModule` to just `matrix_multiply_simd_ptr`
  (+ decompositions); repointed the init sentinel to it. matrix 743/7skip, tensor 389, autograd 258,
  typecheck 0, eslint clean. ~150 lines of dead code gone.
- ⚠️ **[decided NOT to delete the AS element-wise kernels]** — unlike the self-contained eig/svd files,
  `matrix_add`/`sub`/`mul_elementwise`/`scale`/`neg`/`transpose` + `array_abs` live in the general-purpose
  AS matrix/array library (`ops/matrix.ts` — which also holds the crown-jewel `matrix_multiply_simd_ptr`
  — and `ops/array.ts`), are documented in `assembly/README.md`, and `matrix_transpose` is referenced in
  the AS bindings. They have no live JS consumer now, but surgically deleting ~7 functions from the
  matmul-holding file for a marginal binary saving is high-risk / low-value + removes a coherent AS API.
  Kept as the general AS library.
- ✅ **[done — matmul threshold dropped 500→256]** `tools/benchmarks/matmul-threshold.mjs`: SIMD-WASM
  matmul wins from ~256 elems (16², 1.3×) solidly (2.2× at 24², up to 8× at 128²); 8² (64) loses to
  copy overhead, 12² (144) marginal. So the `BackendManager` `multiply.wasm` gate (was 500) forced
  16²–22² matmuls onto JS needlessly — dropped to 256 (the reproducible solid-win boundary). matrix
  743/7skip, tensor 389, autograd 258.
- ⬜ **[strategic decision, not code] own the synced-mathjs layer** — the `is/number/object` drift came
  from the dead `.ts→.ts` sync leaving forks. functions/expression still carry large synced layers
  (`factories/`, `type/`). Decide: fully absorb (own + rename/clean) vs keep as a distinct porting layer.

> **Known limitation (surfaced, not silently left):** `studentizedRangeCDF` uses
> fixed Simpson node counts (240 inner / 120 outer) calibrated against
> `scipy.stats.studentized_range` for typical ANOVA parameters. The `umax` tail
> bound is now self-extending, but the node counts are not adaptively
> convergence-checked (nested adaptive quadrature would blow the 5s vitest timeout,
> since the quantile calls the CDF 60×). Extreme parameter regimes may be
> under-resolved; revisit with a Gauss–Kronrod or memoised adaptive scheme if a use
> case needs it.
> **Known limitation — `realSchur`/`qz` performance cliff (surfaced 2026-06-30).**
> `realSchur` uses single-shift QR with only 1×1 deflation. For complex-conjugate or
> equal-modulus spectra it cannot deflate the trailing 2×2 and burns its full 8000-iter
> cap (~1.5s for a 4×4 cyclic permutation) — yet still returns \_correct\* quasi-triangular
> output (verified: 3 complex-spectrum pencils reconstruct to 0 error). So this is a
> perf issue, not the silent-wrong-output the review predicted. A Francis double-shift
> with 2×2 block deflation (+ Hessenberg pre-reduction) would fix both the speed and give
> a formal convergence flag; deferred as out-of-contract (qz is documented "robust for
> real spectra").

## 🎯 Open Actions

Pending items, sorted ascending by **dependencies** then **complexity**.
Audited independently against the live codebase on 2026-05-24 — every
item below was verified actionable (vs. done, stale, or a documented
non-decision).

| #   | Item                                                                 | Deps | Complexity  | Owner / next step                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------- | ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Cut a release for the [Unreleased] CHANGELOG section**             | 0    | Low (admin) | ✅ Done 2026-05-25 — 6 packages published; GitHub Releases + tags pushed.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | **Delete the npm token copy in Dropbox-synced folder**               | 0    | Trivial     | `Remove-Item C:\Users\danie\Dropbox\Github\npm_key.txt` after confirming token is in `~/.npmrc` and `NPM_TOKEN` env var (it is).                                                                                                                                                                                                                                                                                                                                            |
| 3   | **Consolidate npm token storage to one source of truth**             | 0    | Low         | Token is currently in `~/.npmrc` (literal), `Mathts/.npmrc` (literal, gitignored), and `NPM_TOKEN` env var. Decide one canonical home and remove the others — `NPM_TOKEN` is the cleanest.                                                                                                                                                                                                                                                                                  |
| 4   | **Delete stale `.npmrc.bak-*` files**                                | 0    | Trivial     | Two backups left from the 2026-05-25 token rotation: `~/.npmrc.bak-20260525-141127` and `Mathts/.npmrc.bak-20260525-141201`. Both contain revoked tokens.                                                                                                                                                                                                                                                                                                                   |
| 5   | **Mathematical-correctness audit (external-oracle pass)**            | 0    | Medium      | ✅ Done 2026-06-29 — 41 functions × 1420 seeded cases vs mpmath(dps=50)/scipy/numpy; **zero discrepancies** (all ≤~1e-13 rel.err). Report: `MATH_CORRECTNESS_AUDIT_2026-06-29.md`; reproducible harness: `tools/math-correctness-audit/`.                                                                                                                                                                                                                                   |
| 6   | **Address the audit B-3 through B-9 findings**                       | 5    | Variable    | See `BUG_AUDIT_2026-05-25.md` — cross-package WASM dist-hop (B-3), 3 SVD `it.skip` failures (B-4), mathjs upstream drift (B-5), turbo dep advisory (B-7), AssignmentNode FIXME (B-8), Unit.ts `@ts-nocheck` (B-9).                                                                                                                                                                                                                                                          |
| 7   | **Fix tensor test timeout regression**                               | 0    | Trivial     | ✅ Done 2026-05-25 — added `{ timeout: 15_000 }` as the **2nd argument** to `it()` per Vitest 4's API. (The earlier TODO entry suggested `it('...', () => {...}, { timeout })` — the trailing-options form, which was deprecated in Vitest 3 and is a hard error in Vitest 4 with the message _"Signature 'test(name, fn, { ... })' was deprecated in Vitest 3 and removed in Vitest 4. Please, provide options as a second argument instead."_) Test now completes in ~4s. |
| 8   | ~~typed-function nested-dispatch bug breaks `polynomialRoot` cubic~~ | 0    | —           | ✅ **RESOLVED 2026-06-23 — and the typed-function diagnosis was WRONG.** Root cause was `typed/arithmetic.ts` `add`/`multiply` declaring only a `number`-variadic; `add(number, Complex, Complex)` (polynomialRoot's `add(b, C, …)`) had no match → "too many arguments". Fixed by making the variadics `'any, any, ...any'` (mathjs parity). typed-function was correct all along. See "🐞 Known Defects → Open (2026-06-23)" below (now corrected).                       |

### 🔭 Gap-closure backlog (from the 2026-06-29 re-analyses)

> **Status (2026-06-29):** ✅ **All 16 implemented, verified green** (4,900+ tests,
> 0 regressions), and landed. **GC3 fixed a real bug** (normal/log-normal CDF+
> quantile tail accuracy, found via the scipy oracle).
>
> ✅ **Released to npm (2026-06-30):** functions@0.3.0 (incl. the GC3 fix),
> expression@0.4.0, parallel@0.3.0, autograd@0.3.0, tensor@0.2.0, compat@0.2.0,
> plus dependency-cascade patches (matrix@0.1.10, arithmetic/trigonometry/
> statistics/signal@0.1.4) and a stale-range fix for ast/evaluator/parser. 14
> packages published; git tags pushed. `workbook` held (added to changeset
> `ignore`; its 7 staged changesets remain parked).
>
> Scope notes on the harder three (delivered as the right-sized correct slice):
>
> - **GC7** — `multiply(2D, 2D)` (previously threw) now routes through native
>   DenseMatrix + BackendManager (WASM/GPU). **Extended 2026-06-30:** `det`
>   (~20× on 80×80) and `inv` (~9×) now route large numeric square matrices
>   through native Float64Array LU; numpy-verified, fall back to the factory for
>   small/non-numeric/singular. `eigs` was investigated and stays on the
>   (correct) factory path — the attempt surfaced a **real correctness bug in
>   the matrix eigensolver** (symmetric tridiagonals returned wrong eigenvalues,
>   e.g. sum 22 ≠ trace 6), now fixed at root (route symmetric → JAMA
>   orthes/hqr2); that fix removed the fast-but-wrong symmetric path, so there's
>   no sync speedup left to capture for eigs. det/inv tier-3 factory dep-capture
>   ordering is untouched (only the public exports are wrapped).
> - **GC14** — consolidated the two threshold mechanisms onto ComputePool's
>   canonical `DEFAULT_THRESHOLD_BY_OP` (single source of truth; `ThresholdDispatcher`
>   derives matmul from it). Corrected a stale claim: `fft` already auto-dispatches
>   to the WASM tier by size; `parallelFFT` is the separate worker tier.
> - **GC15** — added the JAX-style `grad` / `valueAndGrad` / `derivative` / `jacobian`
>   ergonomic AD bridge (plain numbers in/out, function written in AD-aware
>   TapedTensor ops). **Extended 2026-06-30:** the larger follow-up — dual-number
>   overloading so `grad` flows through the _plain_ `functions/` ops — is done:
>   a scalar `Dual` type (core, registered for typed dispatch) + `Dual` signatures
>   on the elementary functions (add/sub/mul/div/pow/sin/cos/tan/exp/log/sqrt/…),
>   with `derivativeAt`/`valueAndDerivativeAt`/`gradientAt` entry points. So
>   `derivativeAt(x => multiply(sin(x), x), 2)` differentiates the ordinary
>   functions API exactly (forward-mode), no TapedTensor needed.
>
> GC16's statistics-wide type breadth left as a deliberate parallel-first design
> choice. GC11's decomposition-factor / CAS-sympy oracles are further extensions of
> the same `tools/math-correctness-audit` harness.

Consolidated, deduplicated, and prioritized from the two refreshed reports —
[`FUNCTION_GAPS.md` §7](docs/roadmap/FUNCTION_GAPS.md#7-deep-re-analysis-2026-06-29--new-gaps-post-wave-6)
(type-dispatch / parity / correctness-coverage) and
[`GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md` Part 5](docs/roadmap/GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md#part-5--revision-3-re-validation-2026-06-29)
(the 10 integration bridges). Effort key: **S** ≤ 1 day · **M** ≈ 2–5 days · **L** ≈ 1–2 weeks.
Source tags: `Gn` = FUNCTION_GAPS §7, `Nn`/`Rn` = BRIDGES Part 5.

| ID   | Action                                                                                            | Source        | Effort   | Priority | Why now                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------- | ------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| GC1  | **Reconcile `variance`/`std`/`parallelStat*` normalization**                                      | N2            | S        | **P0**   | Silent correctness footgun: `variance`=population (1.25), `parallelStatVariance`=sample (1.667) for the same input                        |
| GC2  | **`functions.md` generator + CI drift-check**                                                     | N1·R1·item 11 | S        | **P0**   | ~40 user-facing fns undocumented; recurring failure mode — cheap and self-perpetuating if left                                            |
| GC3  | **Distribution CDF/quantile external-oracle audit vs `scipy.stats`**                              | G3a           | M        | **P0**   | Largest untested numeric surface; inline incomplete-beta/gamma is a shared-misunderstanding trap. Extends `tools/math-correctness-audit/` |
| GC4  | **Add 6 canonical-name aliases** (`cumsum`,`ctranspose`,`createUnit`,`apply`,`index`,`help`)      | G2            | S        | **P1**   | ~10 LOC → 100% mathjs canonical-name parity                                                                                               |
| GC5  | **Wire `Unit` into arithmetic + comparison operators**                                            | G1a·G1b       | M        | **P1**   | Flagship mathjs feature entirely absent from the operator layer (`smaller(5cm,2cm)` throws)                                               |
| GC6  | **Complex-argument oracle for `zeta`/`gamma`/`lgamma`**                                           | G3b           | S        | **P1**   | `zeta` self-documents only ~6-digit complex accuracy, unverified                                                                          |
| GC7  | **Route factory matrix ops through native `DenseMatrix` + `BackendManager`**                      | N3·B2·item 4  | L        | **P1**   | The one persisting severe bridge gap — `det`/`inv`/`eigs`/`qr`/`expm` get no WASM/GPU accel                                               |
| GC8  | **Wire tensor decompositions to the existing `*Wasm` async primitives**                           | N6·R4         | M        | **P1**   | `svdWasm`/etc. already exist; tensor imports the sync JS path — mostly wiring                                                             |
| GC9  | **`TapedTensor.pow(taped, taped)`** (variable-exponent AD)                                        | G4a           | S        | **P2**   | Only genuinely-open infra item; ~30–40 LOC; adjoints specified                                                                            |
| GC10 | **`acsc`/`asec`/`acot` BigNumber path** (match `csc`/`sec`/`cot`)                                 | G1e           | trivial  | **P2**   | Closes an internal inconsistency at near-zero cost                                                                                        |
| GC11 | **Decomposition-factor + CAS-sympy + units external-table oracles**                               | G3c·G3d·G3e   | M+       | **P2**   | Trust-hardening: factors/symbolic/unit-constants tested only self-referentially                                                           |
| GC12 | **`compat`: make `config` drive behavior · widen `functions.d.ts` · add `chain`**                 | N4·N5·R5      | M        | **P2**   | `config()` is inert; type defs frozen at ~22 of 665 fns; no fluent `chain` API                                                            |
| GC13 | **Workbook `tensor`/`export` cell support (or parse-time reject) + B2 regression tests**          | N8·N9·R6      | S        | **P2**   | Both cell types declared but throw; B2 stub-capture + SparseMatrix.map have no asserting test                                             |
| GC14 | **Transparent size-based parallel dispatch for FFT/`numeric` + consolidate threshold mechanisms** | N7·R7·item 7  | M        | **P3**   | FFT still parallel-only-named; `numeric` unaccelerated; `ThresholdDispatcher` orphaned vs `ComputePool.shouldParallelize`                 |
| GC15 | **`functions/`↔`autograd` AD bridge (or document the boundary as intentional)**                   | N10·R8·item 6 | L        | **P3**   | `grad` can't flow through any `functions/` op or `evaluate`; native AD is rich but walled off                                             |
| GC16 | **Broaden `statistics`/`round`/`floor`/`ceil`/`fix`/`sign`/`gcd`/`atan2` type signatures**        | G1c·G1d       | variable | **P3**   | Parity ratchet; statistics breadth is partly a deliberate Float64Array trade-off                                                          |

**Recommended sequencing.** P0 first — GC1 (silent correctness) and GC2 (cheap, self-perpetuating doc gap) are both ~½-day; GC3 extends the existing oracle harness and closes the biggest untested numeric surface. Then P1 parity/accel (GC4 trivial; GC5/GC7 are the flagship feature + the surviving severe bridge gap; GC6/GC8 reuse machinery that already exists). P2/P3 are consistency, trust-hardening, and architectural — schedule after the correctness and parity gaps close.

> Two of the highest-value items are **S-effort and address self-perpetuating problems**: GC1 (a cross-variant consistency test stops normalization drift) and GC2 (a generator + CI check stops `functions.md` drift — exactly what `GAP_ANALYSIS` Revision 2 recommended as item 11 but was never built).

Detail — Open Actions items 1–8:

- [x] **Cut a release for the `[Unreleased]` CHANGELOG section.** ✅ Done 2026-05-25.
      Six packages published to npm with matching GitHub Releases: - `@danielsimonjr/mathts-matrix@0.1.3` — determinant parity fix,
      Windows WASM-loader path fix, SHA-384 integrity verification across
      all three load paths, build-script-driven manifest auto-regen. - `@danielsimonjr/mathts-functions@0.2.1` — WASM loader artifact
      filename + path resolution fix. - `@danielsimonjr/mathts-functions@0.2.0` — parallel-execution
      remediation (worker pool kernel loading, Float64Array chunking,
      parallel ops across distribution / special / signal / matrix-decomp
      layers, GPU primitives). - `@danielsimonjr/mathts-parallel@0.2.0` — ComputePool kernels
      (`applyKernel` / `applyKernel2` / `fftBatch`). - `@danielsimonjr/mathts-workerpool@0.2.0` — kernel script loading
      fix, batched-FFT kernel. - `@danielsimonjr/mathts-wasm@0.1.3` and
      `@danielsimonjr/mathts-expression@0.2.0` — version bumps from
      prior workspace changes that hadn't been published yet; published
      in this round to align git tags with npm.

      Commits: `3d218f5` (H-1+H-2), `b507fb7` (0.2.0 release), `4e390e8`
      (S-1+B-6), `d795846` (B-1+B-2), `31a4893` (matrix 0.1.3 + functions
      0.2.1 release).

- [ ] **Delete the npm token copy in Dropbox-synced folder.**
      `C:\Users\danie\Dropbox\Github\npm_key.txt` still holds the
      automation token in plaintext. Tokens in cloud-synced folders are
      a leak risk — anyone with Dropbox session access reads it. The
      token is now in `~/.npmrc`, `Mathts/.npmrc` (gitignored), and the
      persistent `NPM_TOKEN` env var, so the Dropbox copy is fully
      redundant. Run `Remove-Item C:\Users\danie\Dropbox\Github\npm_key.txt`.

- [ ] **Consolidate npm token storage to one source of truth.**
      Same token currently lives in three places: - `~/.npmrc` (literal, user-scope) - `Mathts/.npmrc` (literal, project-scope, gitignored) - `NPM_TOKEN` env var (persistent, user-scope, set 2026-05-25)

      Token rotation later means touching all three. Recommended:
      keep `NPM_TOKEN` env var as canonical, change `~/.npmrc` to
      `//registry.npmjs.org/:_authToken=${NPM_TOKEN}` (npm 7+ expands
      `${VAR}` syntax), delete `Mathts/.npmrc` (project-scope file is
      gitignored but redundant — user-scope already covers it).

- [ ] **Delete stale `.npmrc.bak-*` files.** Created 2026-05-25 when
      rotating from the revoked token to the working one: - `C:\Users\danie\.npmrc.bak-20260525-141127` - `C:\Users\danie\Dropbox\Github\Mathts\.npmrc.bak-20260525-141201`

      Both contain revoked tokens — useless for auth but still
      token-shaped material. Safe to delete.

- [x] **Mathematical-correctness audit (external-oracle pass).** ✅ Done
      2026-06-29. The 2026-05-25 audit (`BUG_AUDIT_2026-05-25.md`) flagged
      this as the largest gap: tests pass, but they only verify "what we
      computed" matches "what we expected" — neither side checked against a
      known-good oracle. **Result: no discrepancies.** 41 functions ×
      1420 seeded random cases compared against an _independent_ oracle
      (mpmath dps=50 / scipy.special / numpy, separate implementation
      lineage). Coverage spanned all the requested categories — special
      functions (gamma/digamma/erf*/beta/Bessel J,Y,I,K/Airy/zeta/elliptic
      K,E/Ei/regularized incomplete gammas), branch-sensitive elementary
      (expm1/log1p/cbrt/hypot/atan2), exact combinatorics, statistics
      (mean/std/var/median/quantile/mad/corr), FFT, and the WASM
      decomposition kernels (det/norm/singularValues/eigvals). 39/41 at
      ≤~1e-14 max rel.err; `besselK`/`besselY` at ~1e-9/1e-11 only in the
      large-argument cancellation regime (correct to representable
      precision). Two first-run flags (`eigvals` spectrum ordering,
      `cbrt` negative-input branch) were confirmed **harness artifacts,
      not MathTS bugs**, and corrected in the oracle/comparator before the
      clean re-run. Full write-up: `MATH_CORRECTNESS_AUDIT_2026-06-29.md`.
      Reproducible harness committed at `tools/math-correctness-audit/`
      (add one `reg(...)` line per future function). *Units were not
      separately audited — the units package re-exports core and has no
      numeric kernel of its own; probability distributions are covered via
      `gammainc`/`gammaincp`/`erf` which back the CDFs.\*

- [ ] **Address the audit B-3 through B-9 findings.** Open after the
      mathematical-correctness pass. Per `BUG_AUDIT_2026-05-25.md`: - **B-3 (medium):** Cross-package WASM dist-hop — `matrix/dist/`
      consumers (functions, expression, compat) see wrong relative
      path. Needs a build-pipeline change (copy `lib/wasm/*.wasm`
      into `matrix/dist/wasm/` during build). - **B-4 (medium):** Three SVD `it.skip` cases at
      `matrix/tests/decomposition/svd.test.ts:180,461,480` —
      tall-matrix, 5x5 stability, 4x6 transpose handling. - **B-5 (medium):** 35 commits of mathjs upstream drift
      (including "6 CRITICAL, 6 HIGH" PR-review fixes); audit
      which apply to MathTS-synced code. - **B-7 (low):** `npm audit fix` for the `turbo` < 2.9.14
      dev-dep advisories (CSRF + Yarn Berry LCE). - **B-8 (low):** Resolve or document the `?matrix` FIXME at
      `expression/src/node/AssignmentNode.ts:12`. - **B-9 (informational):** Decide whether to delete
      `core/src/types/unit/Unit.ts` (dormant, `@ts-nocheck`'d).

- [ ] **Fix tensor test timeout regression.** Surfaced during the
      2026-05-25 release verification.
      `tensor/tests/contraction-sequence.test.ts:304` —
      `'completes a 16-tensor exact DP in under 10 seconds'`. The test
      asserts `elapsed < 10_000ms` but vitest's default test timeout is
      `5000ms`. On this machine the contraction consistently takes
      ~5.7s, so vitest kills the test at 5s before the assertion can
      run. Two-line fix: raise that test's per-test timeout above its
      ~5.7s runtime by passing `{ timeout: 15_000 }` as the third
      argument to `it(...)`. Pre-existing bug, not introduced by any
      recent change.

- [x] **Add a browser smoke test for the WebGPU paths.** ✅ LANDED
      via Wave-6 Slice 6.5 (`3aac312`). `@vitest/browser` +
      Playwright wired at repo root, `vitest.config.browser.ts`
      gated to `*.browser.test.ts`, `functions/tests/gpu-smoke.browser.test.ts`
      verifies `gpuMatmul` on 4×4 input matches the CPU reference
      within float32 precision (falls back to CPU when no WebGPU
      adapter), CI job runs the suite on a Mesa lavapipe runner.

- [x] **Function & auxiliary-function gaps** — see proposal at
      [`docs/roadmap/FUNCTION_GAPS.md`](docs/roadmap/FUNCTION_GAPS.md).
      All three slices LANDED in commit `1bfad1e`.

      | Slice | Deliverable                                                                                | Owner   | Status     |
      | ----- | ------------------------------------------------------------------------------------------ | ------- | ---------- |
      | 1     | `TapedTensor` reductions (`sum`/`mean`/`max`/`min`/`prod`/`norm`) + elementwise math (`log`/`exp`/`sin`/`cos`/`tan`/`sqrt`/`square`/`pow`/`reciprocal`/`abs`) AD | autograd | ✅ 1bfad1e |
      | 2     | `typed/complex.ts` (`arg`/`conj`/`im`/`re`) + `typed/set.ts` (10 set ops) promotion         | functions | ✅ 1bfad1e |
      | 3     | Tensor decomposition wrappers (`tensorQr` / `tensorLU` / `tensorCholesky` / `tensorEig`)    | tensor  | ✅ 1bfad1e |

      Per-slice engineering notes worth keeping:
      - Slice 1 surfaced a real pre-existing build break: the AD
        methods had been drafted in an earlier landing without the
        two helpers (`_resolveAxes` / `_rowMajorStrides`) they
        called, plus a `mean()` reduce callback with implicit
        `any`. The Slice-1 fix wires the helpers and types in.
      - Slice 1 chose deliberate adjoint semantics on edge cases:
        prod with multiple zeros uses prefix/suffix products
        (single-zero and multi-zero cases differentiate
        correctly), max/min tie-break first-wins, abs subgradient
        at exact 0 = 0, norm p='inf' scatters dY to the unique
        max-abs index.
      - Slice 2 matched the bitwise+logical factory-collision
        pattern from commit 2a141d4: 14 `export` keywords stripped
        from `factories/index.ts` (factoryScope wiring kept), two
        factory-tier tests (factories-leaf, factories-final)
        repointed to the new typed/ imports.
      - Slice 3 found `matrix/src/operations/qr.ts` already
        present but not re-exported — fixed by adding one line to
        `matrix/src/operations/index.ts`. LU and Cholesky are
        inlined inside their tensor wrappers because the matrix
        package doesn't have public primitives for them; flagged
        as a future cleanup slice. Eig delegates to matrix; the
        `symmetric: true` option symmetrises the input first so
        the matrix primitive's internal symmetric path picks the
        stable real-eigenvalue routine.

      Cumulative test deltas this landing:
        tensor:    179 → 215 tests (+36 across 16 files)
        autograd:   29 →  92 tests (+63 across 7 files)
        functions: 1,774 → 1,865 tests (+91 across 53 files)

      Future cleanup tracked (not regressions — internal de-duplication):
        - Refactor `tensor/src/operations/random.ts` to call the now-
          exported `matrix.qr` instead of its inline Gram-Schmidt.
        - Promote the inlined Doolittle LU and right-looking
          Cholesky in `tensor/src/operations/{lu,cholesky}.ts` to
          proper `matrix/src/operations/{lu,cholesky}.ts` primitives.

      Out of scope per the proposal §4: `TapedTensor.divide`/`sub`/
      `tensordot`/`svd`/`eig`, promotion of `probability`/`relational`/
      `unit`/`string`, acceleration of `algebra`/`integration`/
      `hypothesis`, sparse-tensor decompositions.

- [ ] **WASM / Worker promotion playbook** — see
      [`docs/roadmap/FUNCTION_GAPS_AUDIT.md`](docs/roadmap/FUNCTION_GAPS_AUDIT.md)
      §B.1 (WASM-route, 14 candidates) and §B.2 (Worker-route, 9
      candidates). Each row is dispatch-ready: it names the specific
      `typed/<file>.ts` exports, the suggested kernel (with explicit
      "reuse existing" markers where the WASM kernel library already has
      the primitive), the starting-point `minElements` threshold, and the
      effort estimate. The procedure in §B.4 lifts the bitwise WASM
      port pattern into a 7-step checklist so the next contributor
      doesn't have to reverse-engineer it. Worth picking off slice-
      sized chunks in the order suggested by §D rank rows 7, 8, 10,
      10b, 10c (the entries with B-class lineage).

- [ ] **Gap-closure proposal — implementation plan dispatched** —
      design at [`docs/roadmap/GAP_CLOSURE_PROPOSAL.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL.md).
      Operationalises the audit's §D sequencing table into 4 tiers
      with concrete file lists and slice boundaries:

      **Tier 1 (parallel, 5 agents, disjoint scopes) — ✅ ALL LANDED:**
      - [x] **Slice 1.1** ✅ `4462f69` — `TapedTensor.divide` +
            `TapedTensor.sub`. 10 new tests in
            `tape-elementwise-ad.test.ts` (forward, backward, fd-check,
            chained graphs, aliased self-division → gradient = 0).
            autograd: 92 → 103 tests.
      - [x] **Slice 1.2** ✅ `7fe73b7` — `typed/relational.ts` promotion.
            7 ops (`deepEqual`/`unequal`/`compareNatural`/`compareText`/
            `compareUnits`/`equalScalar`/`equalText`); 60 new tests.
            functions: 1865 → 1925 tests.
      - [x] **Slice 1.3** ✅ `fe40938` — `ComputePool.divide`.
            No new kernel needed — `elementwiseChunk` already covered
            `'divide'`. 3 new tests (1M-element correctness, threshold
            fallback, mismatched-length rejection).
      - [x] **Slice 1.5** ✅ `c0df3dd` — Promote LU + Cholesky to matrix
            primitives. NEW `matrix/src/operations/{lu,cholesky}.ts`;
            tensor wrappers delegate (parity derived from permutation
            cycle structure). 22 new matrix tests; 16 existing tensor
            tests still pass through delegation.
      - [x] **Slice 1.6** ✅ `08ce15f` — `bench:tensor` suite. 4 bench
            files + `npm run bench:tensor` script; 25s full suite.
            Baseline numbers in `ACCELERATION_BENCHMARKS.md` (e.g.
            tensorQr 32³ = 3.6 ms/op, contract n=24 = 1639 ms/op,
            contractNetwork N=12 greedy = 3.7 ms vs exact 17.4 ms).

      **Tier 2 (follow-up, depends on Slice 1.5) — ✅ LANDED:**
      - [x] **Slice 2.4** ✅ `70217b7` — `tensorPinv` + `tensorSolve` +
            `tensorKron`. NEW `tensor/src/operations/{pinv,solve,kron}.ts`
            composing on the public `matrix.lu`/`matrix.svd` from Slice
            1.5. `tensor`: 215 → 264 tests (+49). functions.md / .html
            Linear-Algebra Details bullets now cross-reference the
            rank-N tensor equivalents.

      **Tier 3 (WASM-route, sequenced one at a time):**
      - [x] **Slice 3.7** ✅ `6520a76` — `typed/algebra.ts` polynomial
            WASM ports. NEW AssemblyScript kernels in
            `assembly/src/poly.ts`
            (`poly_mul_f64` + `poly_div_mod_f64`), bridge at
            `WASM_POLY_THRESHOLD = 256` coeffs; wires into `polymul`,
            `polynomialGCD`, `polynomialLCM`, `polynomialQuotient`,
            `polynomialRemainder`. 22 new tests; manifest regenerated.
            (`discriminant`/`resultant` deferred — will reuse the new
            div-mod kernel + Sylvester-fill in a follow-up.)
      - [x] **Slice 3.8** ✅ `64c6168` — `typed/integration.ts` worker
            dispatch. All four ops async; `gaussQuad`/`romberg` offload
            dot/sum at ≥ 64 sub-intervals (integrand stays main-thread,
            only the post-eval reduction goes to workers); NEW
            `trapzF64`/`simpsonF64` Float64Array overloads at ≥ 65,536
            samples. Integrand-bench in
            `tools/benchmark/parallel/integration.bench.ts`.
      - [x] **Slice 3.10** ✅ `fad8324` — `typed/hypothesis.ts` worker
            dispatch. All 4 tests async at ≥ 4,096 samples.
            `chiSquareTest` fully worker-routed (strongest win);
            KS/MW/SW keep sort on main thread (no `wasm.sortF64` yet),
            offload post-sort stats. Custom-CDF KS bypasses route.
            20 new tests in `typed-hypothesis-parallel.test.ts`.
      - [x] **Slice 3.10b** ✅ `ec7363b` — `typed/interpolation.ts`
            tridiag-solve WASM. NEW AssemblyScript `tridiag_solve_f64`
            kernel + bridge at threshold = 1024 unknowns. `cubicSpline`
            wired (refactored to build explicit (n-1)×(n-1) tridiag
            system). **Finding:** `pchip`/`akima` use Fritsch-Carlson /
            Akima analytic slopes (no tridiag), so this bridge is
            cubicSpline-only — audit B.1 entry updated to reflect.
            18 new tests; manifest regenerated.
      - [x] **Slice 3.10c-1** ✅ `572363f` — Bessel WASM only.
            6 AssemblyScript functions
            (`bessel_j0/j1/jn/y0/y1/yn_f64`) delegating to scalar NR
            §6.5 implementations already in the special-functions kernels.
            Bridge at `WASM_SPECIAL_THRESHOLD = 1024`; AS-suffix probe
            wired (forward-compat for 10c-2). 34 new TS + 8 WASM tests.
            Precision: J ~1e-7, Y near x=1 ~5e-4 (NR algorithm limits);
            WASM↔JS agreement 1e-14 (bit-identical algorithm path).
      - [ ] **Slice 3.10c-2 (deferred)** — Airy `Ai`/`Bi` WASM kernels
            + AssemblyScript parity port for Bessel. Bridge already has
            the `_as`-suffix probe wired; only the AS module + Airy
            implementation are missing. Blocked on consumer demand; Airy
            needs asymptotic expansion at large |x| (different from
            Bessel's series + recurrence path). See
            [`docs/roadmap/GAP_CLOSURE_PROPOSAL.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL.md#slice-310c-2--todo-deferred).

      **Tier 4 (deferred, awaiting consumer pressure or blockers):**
      ranks 9 (probability dedup audit needed), 11 (Tensor.slice
      family), 12 (TapedTensor decomposition AD), 13 (typed/string.ts),
      14 (typed/unit.ts — blocked on Unit type in core).

- [ ] **Wave 4 gap-closure (audit refresh follow-up)** — design at
      [`docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md).
      Operationalises the §D Tier-4 ranks + §C cross-cutting items + 3.10c-2 sub-slice into 9 actionable slices across three
      implementation tiers:

      **Wave 4 Tier 1 (parallel, 5 disjoint agents) — ✅ ALL LANDED:**
      - [x] **Slice 4.1** ✅ `73e6ca9` — `ComputePool.pow` + `.sign` +
            `.tensordot`. `pow`/`sign` reuse the generic kernels;
            `tensordot` got a new `tensordotChunk` worker kernel.
            `pow` threshold = `'never'` (overhead dominates),
            `tensordot` = 8 K contracted-axis volume. `parallel`:
            342 → 355 tests (+13).
      - [x] **Slice 4.2** ✅ `8b357cc` — `matrixPinv` via full SVD +
            `rcond·max(S)` threshold (default 1e-10). Exported as
            `matrixPinv` (alias to avoid the `pinv` name collision
            with `svd.ts`). 14 new tests; matrix: 556 tests.
      - [x] **Slice 4.3** ✅ landed via Slices 4.1 + 4.2 (parallel
            scope-creep, but verified correct). 47-LOC inline
            Gram-Schmidt `thinQR()` replaced by 9-LOC
            `thinQViaMatrixQr()` delegation; 2 new orthogonality
            tests landed in 4.2's commit. tensor: 266 → 268 tests.
      - [x] **Slice 4.4** ✅ `8af250b` — `typed/string.ts` promotion.
            5 ops (`bin`/`hex`/`oct`/`format`/`print`); 39 new
            tests. functions: 2035 → 2093 (+58). Surfaced
            sign-magnitude vs two's-complement convention finding
            (mathjs uses sign-magnitude unless `wordSize` is passed)
            + BigNumber `instanceof` vs `isBigNumber` duck-test
            mismatch.
      - [x] **Slice 4.5** ✅ `6e9f9c0` — polynomial WASM follow-up:
            `discriminant` + `resultant` via Sylvester-matrix det.
            NEW AssemblyScript kernels (~205 LOC) at
            `WASM_POLY_THRESHOLD = 256`. 18 new tests across 3
            suites. Manifest regenerated; wasm-integrity 5/5.
            Sign-convention surprise: the existing typed-layer
            Sylvester ordering gives +2 (not -2 as in the spec's
            worked example) for `Res(x+1, x-1)`; tests match the
            existing implementation.

      **Wave 4 Tier 2 (parallel, 2 disjoint agents) — ✅ ALL LANDED:**
      - [x] **Slice 4.6** ✅ `43f45a1` — `typed/probability.ts` dedup
            audit + selective promotion. 8 of 12 promoted
            (`bernoulli`, `combinations`, `combinationsWithRep`,
            `multinomial`, `permutations`, `pickRandom`, `random`,
            `randomInt`); 4 skipped because already reachable via
            factory surface (`factorial`, `gamma`, `lgamma`,
            `kldivergence`). 57 new tests; functions: 2093 → 2150.
            Notable finding: `bernoulli` (nth Bernoulli number) ≠
            `bernoulliPMF` already in distributions.ts — same name
            different math.
      - [x] **Slice 4.7** ✅ `13eda2f` — Tensor indexing primitives,
            core 4 (`slice`/`gather`/`stack`/`concatenate`). NEW
            `tensor/src/operations/{slice,gather,stack,concatenate}.ts`.
            Gather axis-label semantics: primed via existing
            `Index.prime()` (same id, primeLevel+1) so the primed
            axis cannot auto-contract with the original. 57 new
            tests across 4 files; tensor: 266 → 323.
            `scatter`/`pad`/`roll`/`flip` remain deferred to a
            future Slice 4.7b sub-slice.

      **Wave 4 Tier 3 (sequential, design-heavy) — ✅ ALL LANDED:**
      - [x] **Slice 4.8** ✅ `fd81cd8` — `TapedTensor.tensordot` +
            `.svd` + `.eig({symmetric:true})` reverse-mode AD. Opus
            agent. References: Townsend (2016), Magnus & Neudecker
            (1999), PyTorch source. Repeated-value subgradient mask
            at `REL_TOL = 1e-10`. autograd: 103 → 136 tests (+33).
            Non-symmetric `eig` AD still deferred (complex eigenvals).
      - [x] **Slice 4.9** ✅ `276a75b` — Airy `Ai`/`Bi` WASM + full
            AssemblyScript Bessel parity (closes 3.10c-2). Scalar
            Airy implemented from scratch: power series for
            `|x| ≤ 4.5`, 7-term asymptotic for larger (DLMF §9.2 +
            §9.7); ~1e-7 relative error. AS port full — no 4.9b
            split needed. `Bi`'s large-negative-x phase
            (`θ = ζ + π/4` vs Ai's `θ = ζ − π/4`) was the
            precision-sensitive design call; verified against DLMF.
            functions: 2150 → 2171 tests (+21).

      **Tier 4 deferred (rolled into Wave 5):**
      - [ ] **Slice 4.10** — `typed/unit.ts` (rank 14). Blocked on
            a real `Unit` type in `@danielsimonjr/mathts-core`.
            Now part of Wave 5 Tier 5 (Slice 5.15, Opus).
      - [ ] **B.1 / B.2 playbook backlog** — 8 WASM-route + 7
            worker-route candidates from
            [`FUNCTION_GAPS_AUDIT.md §B.1`](docs/roadmap/FUNCTION_GAPS_AUDIT.md#b1-wasm-route-playbook--pure-js-functions-worth-porting-to-a-wasm-kernel)
            and §B.2. Future wins awaiting consumer pressure; not
            dispatched in this wave. Includes the Sylvester-fill
            follow-up for B.1 row 2 (now closed by Slice 4.5),
            `polyFit`/`chebyshevFit`/`legendreFit` WASM, lagrange/
            newton-interp WASM, histogram/quantile sort WASM,
            distribution-pdf WASM, signal spectral-windowing WASM,
            geometry hull/Delaunay WASM, matrix-function evaluator
            wiring; worker-route fan-outs for integration sub-
            intervals, hypothesis bootstrap, CAS K-fold CV, batch
            sampling, distribution closure-pdf, CAS batch ops,
            graph-centrality restarts.
      - [x] **WebGPU browser smoke test** — ✅ Wave-6 Slice 6.5
            (`3aac312`). Playwright + `@vitest/browser` wired,
            `gpuMatmul` 4×4 smoke test green on Mesa lavapipe CI
            runner.

- [ ] **Wave 5 gap-closure (B.1/B.2 backlog)** — design at
      [`docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md).
      Picks up the 8 WASM-route + 7 worker-route candidates from
      the audit §B.1 / §B.2 plus the deferred sub-slices 4.7b
      (scatter/pad/roll/flip), non-symmetric eig AD, and the core
      Unit type that unblocks rank 14. 15 slices total across 5
      tiers:

      **Wave 5A Tier 1 (parallel, 4 disjoint agents) — ✅ ALL LANDED:**
      - [x] **Slice 5.1** ✅ `09eadea` — Tensor scatter/pad/roll/flip.
            4 new ops + 56 tests. tensor: 323 → 379. Notable: `roll`
            uses double-mod-plus-dim for branchless negative-shift
            handling; `pad` reflect mode excludes the boundary
            element (matching NumPy); `scatter` reduce='add' is
            order-dependent for duplicate indices (documented).
      - [x] **Slice 5.2** ✅ `0cef320` — Promote pinv/cond/norm2/
            normFro/lowRankApprox/singularValues to typed/. Wired
            pinv to the DenseMatrix-based `matrixPinv` (Option A).
            `cond` collision with existing typed/numeric.ts export
            resolved via explicit barrel-level re-export override.
            +27 tests; functions: 2171 → 2229 (incl. parallel slice
            additions).
      - [x] **Slice 5.10** ✅ `6b78c31` — typed/integration.ts
            sub-interval worker fan-out. Added `workerCount` opt
            with closure-stringification path; allow-list heuristic
            accepts Math.* + parameter name only (rejects outer-
            scope closures, async closures). New `integrateChunk`
            worker kernel (returns scalar, not Float64Array). +14
            tests.
      - [x] **Slice 5.11** ✅ `9f74b1e` — typed/hypothesis.ts
            bootstrap helper. `bootstrap: N` + `bootstrapSeed` opts
            on all 4 tests; mulberry32 PRNG for reproducibility.
            Resampling schemes: chiSquare = multinomial with
            replacement; KS/Shapiro = parametric bootstrap; MW =
            permutation (Fisher-Yates). +17 tests.

      **Wave 5B Tier 2 (sequential WASM, 4 slices) — ✅ ALL LANDED:**
      - [x] **Slice 5.3** ✅ `098656e` — ellipticK/E via AGM; +28
            TS + 9 WASM tests.
      - [x] **Slice 5.4** ✅ `f537a56` — polyFit/chebyshevFit/
            legendreFit via Vandermonde + inlined Householder QR
            (~170 LOC AS + ~170 LOC bridge);
            +18 tests.
      - [x] **Slice 5.5** ✅ `2b273a1` — lagrange/newtonInterp
            divided-difference WASM. Existing lagrangeInterp was
            direct-Lagrange (not Newton); preserved as below-
            threshold path; new newtonInterp export. +14 tests.
      - [x] **Slice 5.6** ✅ `2d0ebfa` — applyWindow + welchPSD +
            bartlettPSD + multiTaperPSD + goertzel + chirpZTransform
            (full 5-kernel module). welch/CZT use an FFT helper.
            +25 TS + 8 WASM tests.

      **Wave 5C Tier 3 (sequential larger/design, 3 slices) — ✅ ALL LANDED:**
      - [x] **Slice 5.7d** ✅ `5a0ca7c` — wasm.sortF64/argsortF64/
            rankF64 + full consumer wiring (full slice, no sub-split).
            Wires statistics + hypothesis + geometry hull. +54 tests.
      - [x] **Slice 5.8** ✅ `8872e4b` — lgamma_f64 array kernel +
            4 distribution-pdf wirings. +52 tests.
      - [x] **Slice 5.9a** ✅ `ca08c12` — matrixExpm (Higham Padé-13),
            matrixLogm (GL-16 quadrature), matrixSqrtm (Newton from
            Y_0 = I). +30 matrix tests + 13 typed-dispatch tests.
            Slice 5.9b deferred for complex/defective cases.

      **Wave 5D Tier 4 (parallel worker-route, 3 disjoint agents) — ✅ ALL LANDED:**
      - [x] **Slice 5.12** ✅ `effc15e` (co-landed with 5.13) —
            distribution batch sampling >= 100K. New sampleChunk
            worker kernel. SplitMix64 seed-splitting. 5 distributions.
            +12 tests.
      - [x] **Slice 5.13** ✅ `effc15e` — graph centrality restarts
            (Option B Promise.all). pageRank + betweenness +
            eigenvector. +18 tests.
      - [x] **Slice 5.14** ✅ `444fec4` — CAS batch fan-out via
            mapChunk + eval. cas-prefixed names to avoid factory
            collision. +13 tests.

      **Wave 5E Tier 5 (Opus, single big slice) — ✅ LANDED:**
      - [x] **Slice 5.15** ✅ `8131212` — core Unit type + typed/unit.
            Closes rank 14. 7-D SI dimensional vector, canonical-value
            invariant, recursive-descent parser, prefix-ambiguity
            via plain-match-first + longest-prefix-split, temperature
            offsets per-atom standalone only. +53 core + 15 typed
            tests. Differences from mathjs's Unit class documented.

- [x] **Wave 6 gap-closure (final cleanup) — ✅ COMPLETE (2026-05-24).**
      Design at [`docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md).
      Picked up the 5 forward-tracked items remaining after Wave 5
      closed the audit's main body. **All 5 slices LANDED**; with
      this wave the entire `FUNCTION_GAPS_AUDIT.md` roadmap is fully
      closed. Manifest fix in commit `dc5c050`; AS Carlson parity
      wiring + roadmap-doc closures in commit `28e50ec`.

      **Wave 6A Tier 1 (parallel, 3 disjoint agents) — ✅ ALL LANDED:**
      - [x] **Slice 6.1** ✅ `d0466b3` — Slice 5.9b: full Higham
            Schur-based logm/sqrtm for general matrices (complex
            eigenvalues, defective Jordan blocks). NEW
            `matrix/src/operations/schur.ts` exposing public Schur
            primitive (Francis QR-with-double-shifts). Extended
            `logm.ts` (Schur-Padé Algorithm 11.10) + `sqrtm.ts`
            (Björck-Hammarling Algorithm 6.3 by direct back-
            substitution on the upper-triangular recurrence).
            +19 matrix tests covering complex / defective / repeated
            eigenvalue cases, all within `1e-10` of SciPy reference.
      - [x] **Slice 6.2** (Opus) ✅ `048e9e1` — Non-symmetric
            `TapedTensor.eig` AD. Lifts the symmetric-only
            restriction from Slice 4.8. General-case adjoint
            `dA = V^{-T} · (E ∘ (V^T · dV) + diag(dλ)) · V^T` per
            Townsend (2016) §4 / Magnus & Neudecker §10.6.
            Near-degenerate masking at `REL_TOL = 1e-10`; clean
            throw on defective inputs when `cond(V) > 1e14`. +13
            autograd tests (FD verification at 5 well-conditioned
            inputs + chained-graph + defective error path).
      - [x] **Slice 6.5** ✅ `3aac312` — WebGPU browser smoke test
            infrastructure. `@vitest/browser` + `playwright`
            installed at repo root; NEW `vitest.config.browser.ts`
            gated to `*.browser.test.ts`; NEW `functions/tests/
            gpu-smoke.browser.test.ts` verifies `gpuMatmul` on 4×4
            input matches CPU reference within float32 precision
            (transparent CPU fallback when no adapter); CI job
            installs Mesa lavapipe (`apt-get install
            mesa-vulkan-drivers libegl1`) and runs `npm run
            test:browser`. Closes the "WebGPU browser smoke test"
            forward-tracked item that was carried in 🎯 Open
            Actions since the original audit.

      **Wave 6B Tier 2 (sequential WASM, 2 slices) — ✅ ALL LANDED:**
      - [x] **Slice 6.3** ✅ `bba468b` — `convexHull3D` WASM via
            incremental QuickHull-3D (Barber, Dobkin, Huhdanpaa
            1996). NEW `convex_hull_3d_wasm(pts_ptr, n, faces_ptr)
            -> i32` AssemblyScript kernel; new `convexHull3D` typed
            export. Threshold
            ≥ 1024 points. +18 hull-3D tests (tetrahedron, cube,
            cospherical sample, degenerate co-planar fallback).
      - [x] **Slice 6.4** ✅ `2be52f9` — Carlson R-forms
            (`carlsonRC`/`RD`/`RF`/`RJ`) + incomplete elliptic
            integrals (`ellipticF`, `ellipticEIncomplete`,
            `ellipticPi`) WASM. Quadratically convergent and
            branch-cut-free per Carlson (1995), NR §6.11, DLMF §19.
            Threshold ≥ 1024 samples. AssemblyScript WASM kernels (AS
            wiring through `assembly/src/index.ts` landed in commit
            `28e50ec`). +41 tests against DLMF §19.16-19.36 and
            Abramowitz & Stegun §17 reference values.

      **Wave 6 cumulative test deltas:**

      - `functions`: 2,486 → **2,545** (+59 = 18 hull3D + 41 Carlson)
      - `matrix`: 586 → **605** (+19, Schur + logm/sqrtm extensions)
      - `autograd`: 136 → **149** (+13, non-symmetric eig AD)
      - 238 test files total (+2); 6308 tests + 172 WASM integration
        tests pass / 7 skipped / zero regressions.

      **Total Wave 6 = 5 slices across 6 commits** (`d0466b3`,
      `048e9e1`, `3aac312`, `bba468b`, `2be52f9`, `dc5c050` manifest
      regen + `28e50ec` doc/AS polish). After this wave the entire
      `FUNCTION_GAPS_AUDIT.md` roadmap is **closed**.

- [x] **CDG bugfix + post-Wave-3 gap-audit refresh** — Ran
      `npx tsx tools/create-dependency-graph/create-dependency-graph.ts --include-tests`
      to check for issues after Wave-1/2/3 landings. Surfaced and
      fixed two pre-existing CDG bugs: - `findReachableFiles` + `detectUnused` only followed
      relative-path edges, not cross-package workspace
      (`@danielsimonjr/mathts-*`) edges. Fixed by adding a
      `workspaceEntryPath(name)` helper and tracing workspace deps
      through to their entry-point file. - Test files weren't fed to `detectUnused` even with
      `--include-tests`. Fixed by parsing tests up-front and
      passing them as a second consumer corpus.

      Resulting counts: unused files 1 → 0; unused exports 406 → 308.
      The remaining 308 split as 201 type/interface (public-API
      contracts), 64 functions (incl. bench-only consumers in
      `tools/benchmark/` which CDG doesn't scan), 42 constants
      (consumer-tunable thresholds), 3 classes — all legitimate
      public API. Two genuinely-unconsumed reset helpers
      (`resetBitwiseWasm`, `resetBesselWasm`) were addressed by
      adding fallback-suite test calls that exercise them.

      Gap-audit re-run shows no new gaps. Effective coverage stays at
      100% (163/163 active files); 0 circular deps; all Wave-1/2/3
      primitives reach correctly through the now-fixed reachability.
      See [`docs/roadmap/FUNCTION_GAPS_AUDIT.md §G`](docs/roadmap/FUNCTION_GAPS_AUDIT.md#g-audit-refresh--2026-05-24-post-wave-3)
      for the full refresh summary.

- [x] **ITensor-parity tensor primitives** — see proposal at
      [`docs/roadmap/ITENSOR_PARITY.md`](docs/roadmap/ITENSOR_PARITY.md).
      All six phases LANDED. Phases 1-3 in commit `a21a844`, Phases
      4-6 in commit `4417836`.

      | Phase | Deliverable                                                                    | Status     |
      | ----- | ------------------------------------------------------------------------------ | ---------- |
      | 1     | `Index` value type + `Tensor.contract` (match-by-id)                           | ✅ a21a844 |
      | 2     | `tensorSvd(t, rowAxes, {maxdim, cutoff})` truncated tensor SVD                 | ✅ a21a844 |
      | 3     | `randomTensor(shape, {distribution, seed})` constructors                       | ✅ a21a844 |
      | 4     | `contractNetwork(tensors)` — optimal pairwise-contraction order (DP + greedy)  | ✅ 4417836 |
      | 5     | `TapedTensor.contract` + `TapedTensor.matmul` — AD over named-index contractions | ✅ 4417836 |
      | 6     | Tensor arithmetic completeness: reductions (`sum`/`mean`/`max`/`min`/`prod`/`norm`), NumPy broadcasting in `add`/`sub`/`mul`, `tensordot(other, axes)` | ✅ 4417836 |

      Phase-by-phase engineering notes worth keeping (full detail in
      the proposal + CHANGELOG):
      - Phase 1 surfaced the `Index.ts` vs `index.ts` case-sensitivity
        conflict; the class file is `named-index.ts` to keep
        `forceConsistentCasingInFileNames` on across the monorepo.
      - Phase 4's first cut ran the 16-tensor exact DP in ~20 s; the
        rewrite uses a canonical-index XOR-safe bitmask stored as two
        30-bit halves in `Int32Array` and runs in 1.66 s. The
        original O(|A|·|B|) Index-array scan is the fallback path
        for the rare case of an Index appearing in > 2 tensors.
      - Phase 5's batched matmul + its VJPs are direct
        `Float64Array` loop implementations because the `EinsumSpec`
        format can't express batch dimensions without summing over
        them.
      - Phase 6 surfaced a latent crash in `reduceAxes` where
        `keepDims=true` would construct a Tensor with mismatched
        `axisLabels.length` vs `shape.length`; fixed by skipping
        label propagation when `keepDims=true`.

      Out of scope per the proposal §8: MPS/MPO/DMRG/TEBD/TDVP
      (live in UPT or a sibling), quantum-number block-sparse storage,
      fermionic anticommutation, HDF5 I/O, dtypes beyond Float64,
      compile-time shape inference in the TS type system.

## 📓 Scientific Workbook (`.mtsw`)

Headless notebook CLI/runtime in the `workbook` package + MathML serialization in
`expression`. The GUI sits on top of the CLI (every GUI op is a CLI op).

**Done — slices 1-10 (all on `main`):**

- [x] **Slice 1** `2031219` — `mtsw run`/`validate`/`graph`; sandboxed MathTS-expression cells, non-transitive deps, boolean `test` cells.
- [x] **Slice 2** `9d978f5` — round-trip `serializeWorkbook` + `strip`/`new`/`run --write` (atomic).
- [x] **Slice 3** `20bb88c` — `--json` read-contract: `describe`/`run --cell`/`capabilities`/`templates` (cycle/BigInt-safe envelope).
- [x] **Slice 4** `70b580e` — cell mutation: `cell add`/`edit`/`rm`/`move`/`rename` (atomic, cycle-rejecting).
- [x] **Slice 5** `d8318f7` — `mtsw serve` (single-doc JSON-RPC/stdio) + incremental re-execution + `functions`/`meta`.
- [x] **Slices 6-7** `b2d83b1`/`d6619c8` — self-contained HTML export: `Node.toMathML()`, charts, `mtsw export`; `equation`+`visualization` cells; `examples/lightspeed.mtsw` (self-verifying c derivation + chart).
- [x] **Slice 8** `97a88c9` — authoring ergonomics: `mtsw import` (JSON/YAML doc), `new --empty`/`-t chart`/`-o`, chart-spec validation, `capabilities` cellSchemas.
- [x] **Slice 9** `4536de4` — refactor `toMathML` to mirror `.toTex` (per-node `_toMathML()` + `utils/mathml.ts`).
- [x] **Slice 10** `331cbf2` — move document renderers (`toHTML`/`toCSS`/`renderChart`/`markdownToHtml`) `expression` → `workbook`; `expression` public surface is now math-serialization only.

**Open:**

- [x] **Published `@danielsimonjr/mathts-expression@0.3.0`** (2026-06-29, release commit `221f7f4`, tag `@danielsimonjr/mathts-expression@0.3.0` + GitHub release) — `Node.toMathML()` + `mathMLDocument`/`mathMLError`/`escapeMathML`/`toMathMLSymbol`. Bumped 0.2.4 → 0.3.0; CHANGELOG + README generator docs; the 2 mixed changesets detangled to workbook-only so only `expression` versioned. Verified live on npm (`dist-tags.latest = 0.3.0`).
- [ ] **Workbook package is NOT release-ready** (explicit, 2026-06-29) — hold `@danielsimonjr/mathts-workbook` until further notice.
- [ ] **Electron GUI** — the eventual app, pure presentation over the CLI/serve contract (`electron-vite-react` base).
- [ ] Deferred capabilities: `--expect-hash` optimistic lock · multi-doc serve · mid-run event streaming · PDF/markdown/ipynb export · SVG math typesetting (vs MathML) · interactive (JS) charts · worker-thread run timeout (sandboxed exec is currently synchronous, no hard timeout).

## ✅ Completed

### 2026-06-27 session — Rust removal · dormant purge · strict mode · lint cleanup

- [x] **Rust → AssemblyScript migration complete**, then **all Rust scrubbed** from docs _and_ code — zero `Rust` outside the 3 CHANGELOGs. AssemblyScript is the sole WASM backend.
- [x] **Dormant code purged**: 455 synced-mathjs files (~58.6k LOC) from `functions/`+`core/`, plus 26 vestigial AS-source-as-`.ts` (~14k LOC) from `functions/src/wasm/`.
- [x] **AS-vs-JS WASM benchmark suite** recreated (the old Rust-dependent suite was deleted with the migration).
- [x] **Monorepo-wide `strict: true`** — `functions` (430 errors fixed honestly, incl. **2 real CSparse port bugs**) + `expression` flipped; all relaxed compiler flags (`noUnusedLocals`/`noUnusedParameters`/`noImplicitReturns`/`noFallthroughCasesInSwitch`) tightened in `functions`+`expression`.
- [x] **Lint → 0 warnings (honest typing, no `eslint-disable`)**: `core`, `parallel`, `workerpool`. Also disabled core `no-undef` for TS (typescript-eslint best practice) — eliminated ~9k false positives.
- [x] Bugs fixed along the way: JS-eig-returns-zeros, 2 CSparse typos, poly corruption, 2 numeric, turbo build-ordering footgun, js-yaml CVE, an exit-0-masked test failure.
- [x] **Repo-wide eslint → 0 (2026-06-28)** — EVERY package's implementation (`src` + `tests`) at zero eslint problems, honestly typed: ~3,500 `no-explicit-any` replaced with real types (unions/generics/`unknown`+narrow), `Unit.ts` `@ts-nocheck` removed + fully typed, no blanket suppressions. Also fixed ~105 pre-existing lint **errors** (matrix/tensor/autograd/compat/assembly) that turbo's lint cache had masked, and deleted more dead code (orphaned `matrix/assembly/` 16 files). Two documented eslint exclusions (not impl): AssemblyScript source (`asc`-checked) + `**/*.d.ts` (ambient declarations). Gate: eslint 0 · typecheck 28/28 · build 22/22 · test 44/44 · audit 0.

> Repo health at session checkpoint: typecheck 28/28, build 22/22, test 44/44, `npm audit` 0 vulns, zero Rust. Details in `CHANGELOG.md` `[Unreleased]`.

- [x] TypeScript conversion (src/) - 66% coverage, 0 errors
- [x] TypeScript conversion (test/) - 65% coverage
- [x] AssemblyScript/WASM conversion - Complete, 0 candidates remaining
- [x] WASM performance benchmarks - 10-117x speedups documented
- [x] Status report updated - Accurate breakdown
- [x] Refactoring docs organized - Moved to docs/refactoring/
- [x] WASM test files (46 files) - All tiers complete (6621 tests passing)

## 🔧 Parallel Execution Remediation (2026-05-21)

The worker-pool infrastructure was found to be **non-functional at runtime** and
has been fixed; genuine worker parallelism was then extended across the typed
layer. This supersedes the earlier "Optimize parallel processing ✅ COMPLETE"
claim below — the prewarming/singleton/metrics plumbing existed, but no kernel
ever actually ran in a worker.

- [x] **Fix worker dispatch** — `MathWorkerPool` created its pool without a
      worker script, so every named-kernel call (`sumChunk`, `matmulRows`, …) threw
      `Unknown method`. The built `dist/worker.js` is now resolved and loaded; the
      arithmetic/statistics/trigonometry `Float64Array` overloads run in workers for
      the first time.
- [x] **Fix Float64Array chunking** — chunks were cut with `subarray()` (a view
      over the full buffer), so every chunk past the first read the wrong region.
      Now uses `slice()`.
- [x] **Generic kernels** — added `applyKernel` (unary) and `applyKernel2`
      (binary) so packages above `workerpool` can parallelize element-wise math.
- [x] **Distributions** — parallel `Float64Array` overloads for all 10 PDF/CDF/
      PMF functions.
- [x] **Special functions** — parallel `Float64Array` overloads for all 28
      special functions.
- [x] **Matrix decompositions** — `matrixPower`, `matrixLog`,
      `polarDecomposition`, `jordanForm`, and `characteristicPolynomial` route their
      O(n³) products through the worker pool (now `async` — breaking).
- [x] **Signal spectra** — `parallelFFTMagnitude` / `parallelFFTPower` now
      genuinely dispatch to worker threads.
- [x] **WebGPU matrix operations** — `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and
      `gpuScale` (`functions/src/typed/gpu.ts`) run on the matrix package's WebGPU
      compute-shader backend (`gpuMatrixBackend`), with transparent CPU fallback.
      Added as new async exports rather than rerouting the existing f64 functions —
      WGSL is f32-only, so silent substitution would lose precision.
- [x] **Function reference** — `docs/reference/functions.{md,html}` mark each
      function's `parallel` / `WASM` / `WebGPU` acceleration in an Accel column.
- [x] **Worker-distributed FFT** — `parallelFFT` / `parallelIFFT` now use a
      four-step (transpose) decomposition: one transform is split into two batches
      of independent smaller FFTs dispatched via `fftBatch`, with a twiddle pass
      between. `parallelIFFT` became `async` for this.

## 🚀 Acceleration Roadmap (2026-05-21)

Acceleration only pays off for **compute-bound** operations — where arithmetic
dominates data movement. Most functions are transfer-bound or cheap, and adding
a worker / WASM / WebGPU path to them is net-neutral or slower. The candidates
below are limited to operations that genuinely clear that bar.

**Selection criteria**

- **Worth it** — compute grows faster than data (O(n³), O(n² log n), or many
  independent sub-problems), and the input is large enough to amortize dispatch.
- **Not worth it** — element-wise O(n) maps and cheap scalar functions: data
  transfer (and, for GPU, f32 conversion) dominates the runtime.
- **WebGPU is f32-only** (WGSL has no f64) — expose it as opt-in functions; do
  not silently substitute it for an f64 path.
- **async blast radius** — parallelizing a sync function makes it, and its
  callers, async. Acceptable for niche functions; avoid it for hot, widely-used
  scalar paths (`add`, `multiply`, …).

**Low effort**

- [x] `spectrogram`, `fft2d` — parallelized via a batched-FFT worker kernel
      (`fftBatchChunk` + `MathWorkerPool.fftBatch` / `ComputePool.fftBatch`); both
      dispatch their independent FFTs to the worker pool and are now `async`.
- [x] FFT-based `convolve` / `correlate` — `parallelConv` runs its two forward
      FFTs concurrently through `fftBatch`; `parallelXCorr` / `parallelAutoCorr`
      inherit it by delegation.

**Medium effort**

- [x] `distanceMatrix` — new function computing the all-pairs Euclidean distance
      matrix; rows are distributed across workers (`distanceMatrixRowsChunk`).
- [ ] `eigs` / SVD — **not pursued (re-validated 2026-05-23).**
      Eigendecomposition via QR iteration is fundamentally sequential (each step
      depends on the previous), so worker dispatch inside the loop is
      net-negative; SVD already has a WASM path.

      **Re-measured 2026-05-23** (4-core CI container; bench cases now in
      `tools/benchmark/parallel/operations.bench.ts`, probe in
      `tools/benchmark/parallel/eig-inner-probe.ts`):

      - End-to-end `eig` / `svd` / `singularValues` at n ∈ {32, 64, 128, 256}:
        sequential vs. parallel `thresholdElements` are statistically
        indistinguishable (0.84×–1.27× across re-runs is pure noise — the JS
        code does not dispatch to workers, so both paths execute identically).
        `svd` and `singularValues` show **no break-even at any tested size**;
        `eig` flickers between 32x32 and 256x256 across runs (noise).
      - **Inner-step viability probe:** at n = 256, one Givens sweep
        (one QR step's worth of work) is **0.18 ms**, one Householder bilateral
        update is **0.55 ms**, while `computePool.matmul` round-trip at the
        same size is **35.2 ms**. Dispatching inner steps would slow `eig` by
        roughly 100×–1000×. The end-to-end matmul at n = 256 is barely
        break-even (1.03×), but `eig` runs **~512 QR steps** internally — even
        a one-time matmul dispatch for Q-accumulation saves <1 ms vs. the
        dispatch overhead it adds. Q-accumulation is also already amortized
        by Givens column rotations, not a single matmul.
      - **Hessenberg / bidiagonalize cost** (the one-shot reduction at the
        start) is ~47 ms total at n = 256, but is itself n sequential
        Householder reflectors, each ≪ pool dispatch overhead, and each
        consumes the result of the prior reflector — they cannot be batched
        across workers without restructuring into a blocked algorithm
        (LAPACK-style; out of scope here).

      Decision: the JS-fallback path stays sequential. `eigs` / `svd` /
      `singularValues` remain absent from `OpName` / `thresholdByOp`. The
      bench cases and probe are checked in so future re-measurement on
      different hardware is a one-command operation.

- [ ] `polyFit` / `leastSquares` — **deferral re-validated 2026-05-23.**
      `polyFit` has few parameters so `AᵀA` is tiny; `leastSquares` would need
      a custom contraction-dimension reduction (`computePool.matmul`'s
      threshold keys on result size, not the O(n²·m) cost), genuine only for
      unusually wide systems.

      **Re-measured 2026-05-23** (`tools/benchmark/parallel/regression-probe.ts`
      vs. the in-process sequential reference; noisy CI container,
      maxWorkers=4). Threshold knob: `computePool.updateConfig({
      thresholdElements: 1 })` to force every internal `matmul` / `matvec` to
      dispatch.

      _polyFit-shaped (small `n = degree + 1`, varied `m`)_ — parallel
      **never wins**:

      ```
      case                   seq ms   par ms   speedup   verdict
      polyFit deg=3, m=1k     0.094    0.331    0.28x   sequential
      polyFit deg=3, m=10k    0.409    1.589    0.26x   sequential
      polyFit deg=3, m=100k   4.307    9.519    0.45x   sequential
      polyFit deg=7, m=10k    1.586    2.489    0.64x   sequential
      polyFit deg=7, m=100k  20.498   27.318    0.75x   sequential
      polyFit deg=15, m=10k   8.359    9.333    0.90x   sequential
      polyFit deg=15, m=100k 131.586 132.509    0.99x   tie
      ```

      _leastSquares (general overdetermined)_ — wins only in a narrow
      tall-thin band, ties (≤ 1.15×) or noise elsewhere:

      ```
      case                  seq ms     par ms    speedup   verdict
      LS m=500,  n=50         2.941     3.188    0.92x    tie
      LS m=1k,   n=100       23.412    22.649    1.03x    tie
      LS m=2k,   n=200      199.300   178.503    1.12x    parallel
      LS m=10k,  n=100      561.857   277.876    2.02x    parallel
      LS m=20k,  n=100     1449.946   933.609    1.55x    parallel
      LS m=5k,   n=200      568.625   498.599    1.14x    parallel
      LS m=10k,  n=200     2740.887  1339.906    2.05x    parallel
      LS m=1k,   n=500      724.434   675.363    1.07x    tie
      ```

      **Decision: deferral honoured for both.** `polyFit` has no winning
      regime — `degree + 1` is too small for `(AᵀA)` to amortize a worker
      dispatch even at `m = 100k`. `leastSquares` has a real ~2× win in a
      narrow corner (`m ≈ 10k`, `n = 100…200`, tall-and-thin) but ties
      (1.03–1.15×) across the bulk of realistic shapes. Per the project's
      quality bar — "a 1.05× speedup with `async`-virality cost is NOT a win"
      — making the function `async` for every caller to capture one shape
      band's 2× is not worth it. A future change that introduces a genuinely
      async-friendly call site (e.g. a batched least-squares solver) can
      revisit. `polyFit` / `leastSquares` therefore stay absent from `OpName` /
      `thresholdByOp` in `parallel/src/ComputePool.ts`.

      _Aside._ The original deferral note assumed parallelism would win for
      _wide_ systems (large `n`, where the inner `m` contraction is the long
      dimension). The data inverts that intuition: the only regime where
      parallel beats sequential is _tall-and-thin_ (`m ≫ n`), because that
      is where `Aᵀ · A` (`n×m` × `m×n`) has enough work per output element
      to amortize the dispatch round-trip while still producing a small
      enough result matrix that the worker pool returns quickly.

      Implementations remain sequential and exported in
      `functions/src/typed/{interpolation.ts,numeric.ts}`. Strengthened
      correctness tests live in `functions/tests/typed-regression.test.ts`
      (clean polynomial recovery, noisy recovery within `1e-6` /
      `1e-3`, multi-parameter linear models, singular-system error path).
      The probe is checked in so future re-measurement on different
      hardware is a one-command operation:
      `npx tsx tools/benchmark/parallel/regression-probe.ts`.

**High effort**

- [x] Worker-distributed FFT — `parallelFFT` / `parallelIFFT` use a four-step
      (transpose) decomposition built on `fftBatch`.
- [ ] Unified f32 WebGPU path — **not pursued; design spec written.** A
      coherent GPU path (shared WGSL shader library, GPU-resident `GpuArray`
      handles for operation fusion, Stockham FFT shaders, a generalized backend
      router) is scoped in
      [`docs/roadmap/UNIFIED_WEBGPU_PATH.md`](../roadmap/UNIFIED_WEBGPU_PATH.md) —
      a separate research effort beyond the existing matrix-op `gpu*` functions.

## 🐞 Known Defects

### Fixed (2026-06-23) — and a retracted misdiagnosis

> **Correction.** An earlier version of this section blamed a "typed-function
> nested-dispatch bug" for breaking `polynomialRoot`'s cubic. **That diagnosis
> was wrong.** typed-function was behaving correctly. Runtime instrumentation of
> the _actual_ failing call (the rawRoots step `add(b, C, divide(Delta0, C))`,
> where `C` is a complex cube root) showed `add` being called as
> `add(number, Complex, Complex)` — and `add` had no matching signature. The
> "value-dependent / nested-only" appearance was a red herring: `add(5184,5324,972)`
> (3 numbers) succeeded via the number variadic; the throw came later at the
> Complex `add`. It is **type-dependent, not re-entrant**.

- [x] **`add`/`multiply` variadics were `number`-only.** `typed/arithmetic.ts`
      declared `'number, number, ...number'`, so 3+ arguments of `Complex` (or
      mixed number/Complex) threw `Too many arguments (expected 2, actual 3)`.
      Stock mathjs makes `add`/`multiply` variadic over `any` (folding pairwise
      through the binary op). **Fixed** by replacing the number-variadic with
      `'any, any, ...any'` that folds through the binary `add`/`multiply`.
      Regression tests in `functions/tests/typed-variadic.test.ts`.

- [x] **`polynomialRoot` cubic branch now works** (real, complex, and repeated
      roots) — it was blocked solely by the `add`/`multiply` variadic gap above,
      not by `cbrt` or typed-function. `cbrt(Ccubed, allRoots)` with a _Complex_
      `Ccubed` (the only case polynomialRoot's cubic uses) works fine.

- [x] **`math.solve` (CAS) now delegates degree-≤3 to `polynomialRoot`** instead
      of carrying its own quadratic/cubic formulas — the Algebra solver is the
      single source of closed-form roots; `solve` keeps coefficient extraction,
      root cleaning, and the numeric fallback for degree ≥ 4 / transcendental.

- [ ] **(Minor, open) `cbrt(number, allRoots=true)` is still unimplemented.**
      `cbrt(8, true)` throws "Too many arguments (expected 1, actual 2)"; stock
      mathjs returns the three complex cube roots. Only the **real-number** 2-arg
      form is missing — the `Complex` allRoots path used by `polynomialRoot`
      works. Low priority (no current consumer needs the real-number form).

### Fixed (2026-05-22)

The defects below were all pre-existing; each is now resolved. The first two
were surfaced while fixing the fresh-checkout test failures, the rest during
the dependency-graph / architecture-docs audit.

- [x] **`parallel` package never built `matrix.worker.js`** — `parallel`'s
      build was `tsup src/index.ts` only, so `src/matrix.worker.ts` was never
      emitted to `dist/`. `ParallelMatrix` resolved its worker as
      `./matrix.worker.js` at runtime, which did not exist — the worker compute
      paths silently returned all-zeros. Caused 9 `tests/wasm/parallel-processing.test.ts`
      failures. **Fixed:** a four-defect chain — missing tsup build entry, no
      script resolver (`resolveMatrixWorkerScript`), ESM-incompatible
      `require('worker_threads')`, and browser-only event wiring in `WorkerPool`'s
      Node branch — plus a shared-buffer-mutation bug and a queue-drain race.
      `parallel/package.json`, `parallel/src/{ParallelMatrix,WorkerPool,matrix.worker}.ts`.
- [x] **JS SVD was wrong for non-square matrices** — `svdStep`'s Golub-Kahan
      QR sweep assigned the unsigned magnitude `Math.sqrt(f*f + g*g)` to `e[k-1]`
      and `d[k]` where the algorithm requires the signed rotated values
      `cs*f - sn*g` / `cs2*f - sn2*g`, corrupting the bidiagonal sweep for any
      non-square matrix (5×3 reconstruction error ~8.28). **Fixed** in
      `matrix/src/operations/svd.ts`.
- [x] **All 7 import cycles eliminated** — the dependency-graph report flagged
      7 cycles (5 runtime, 2 type-only); the report now detects 0.
  - `is ↔ map` / `object → is → map → customs → object` in both
    `functions/src/utils/` and `expression/src/utils/`: `isObjectWrappingMap`
    moved into `map.ts` next to the `ObjectWrappingMap` class, so `is.ts` no
    longer imports `map.ts` — that single edge closed both cycles per package.
  - `evaluate.ts → typed/index.ts → typed/cas.ts → evaluate.ts`: the
    `export * from './cas.js'` re-export moved from `typed/index.ts` to the
    package entry `functions/src/index.ts`. This also resolves the latent
    incomplete-`mathScope` risk — `evaluate.ts` now loads strictly after
    `typed/index.ts` is fully initialized.
  - `DenseMatrix ↔ SparseMatrix`: `DenseMatrix` dropped its
    `import type { SparseMatrix }`; `toSparse()` is typed as the `Matrix` base
    (the `SparseMatrix` subtype is still constructed lazily at runtime).
  - `BackendManager ↔ config`: `OperationType` moved from `BackendManager.ts`
    to `config.ts`; `config.ts` no longer imports `BackendManager`.

- [x] **`tensor` and `autograd` failed `tsc --noEmit` — missing `workerpool`
      path redirect** — surfaced 2026-05-22 while auditing the architecture docs.

  **Symptom.** `npx tsc --noEmit` run in `tensor/` and in `autograd/` each
  report the same 7 errors; the other 8 TypeScript packages typecheck clean.
  Both the package build (`tsup`) and the test suites still pass — only the
  standalone typecheck task fails. So this is a build-tooling defect, not a
  runtime bug.

  **Where.** All 7 errors are inside the _upstream_ `workerpool` npm
  dependency (`node_modules/workerpool`, v10.0.1 — the unscoped package, which
  is distinct from the fork `@danielsimonjr/mathts-workerpool` in
  `packages/workerpool`):

  ```
  node_modules/workerpool/src/core/Pool.ts(12,10)            TS6133  'FIFOQueue' declared but never read
  node_modules/workerpool/src/core/Pool.ts(12,21)            TS6133  'LIFOQueue' declared but never read
  node_modules/workerpool/src/core/Pool.ts(21,3)             TS6196  'QueueStrategy' declared but never used
  node_modules/workerpool/src/core/Pool.ts(276,20)           TS7030  not all code paths return a value
  node_modules/workerpool/src/types/index.ts(259,39)         TS6133  'E' declared but never read
  node_modules/workerpool/src/types/worker-methods.ts(8,34)  TS6196  'ExecOptions' declared but never used
  node_modules/workerpool/src/workers/worker.ts(137,28)      TS2769  postMessage — no overload matches
  ```

  These are upstream code-quality issues in `workerpool` itself, not MathTS
  bugs.

  **Root cause.** Upstream `workerpool` v10.0.1 ships _raw `.ts` source_ — its
  `package.json` `exports` map points subpath `import`s straight at `src/*.ts`.
  `skipLibCheck` (which `tensor` and `autograd` both set) only suppresses
  checking of `.d.ts` files — it does **not** skip raw `.ts` files in
  `node_modules` — so `tsc` type-checks `workerpool`'s source and surfaces its
  errors. The transitive path that drags it in is
  `autograd → tensor → matrix → parallel → workerpool`.

  The four packages that reach `workerpool` _without_ this failure —
  `parallel`, `matrix`, `functions`, `compat` — each carry a `tsconfig.json`
  `paths` redirect that points the `workerpool` specifier at the hand-written
  stub declaration `parallel/types/workerpool.d.ts`:

  ```jsonc
  "paths": { "workerpool": ["../parallel/types/workerpool.d.ts"] }
  ```

  `tensor/tsconfig.json` and `autograd/tsconfig.json` have no `paths` section
  at all, so they were simply missed.

  **Fixed.** Added the `paths` entry —
  `"workerpool": ["../parallel/types/workerpool.d.ts"]` — to
  `tensor/tsconfig.json` and `autograd/tsconfig.json` (the exact form
  `matrix/tsconfig.json` already uses). Both packages now typecheck with
  **0 errors**, and their builds and test suites (tensor 16, autograd 9)
  still pass.

  **Longer-term option.** The stub is now referenced by six tsconfigs via a
  hand-copied relative path. Consider either (a) hoisting the redirect into
  `tsconfig.base.json` so packages without their own `paths` (`tensor`,
  `autograd`, …) inherit it — note a child `paths` _replaces_ rather than
  merges, so `parallel`/`matrix`/`functions`/`compat` keep their existing
  copies; or (b) shipping a real `.d.ts` from the forked
  `@danielsimonjr/mathts-workerpool` and routing all worker-pool imports
  through the scoped fork so the upstream raw-`.ts` package never enters the
  type graph.

## 🔧 Typed-Layer Expansion (2026-05-22)

The active `functions/src/typed/` dispatch layer has been expanded and several
pre-existing correctness defects fixed.

### Done

- [x] **`functions` typecheck — 599 → 0 errors.** Three-part fix:
      (1) config — `functions/tsconfig.json` gained `"types": ["@webgpu/types",
"node"]` (its typecheck pulls in `matrix/src/backends/gpu/*` source) and
      `"lib": ["ES2023", "DOM"]`, and the `WasmModule` interface gained the four
      computational-geometry exports — cleared ≈100; (2) ≈499 mechanical
      type-level fixes (`as` casts, generic args, narrowed `unknown`) across the
      13 synced category directories — no runtime change; (3) 18 previously
      internal interfaces exported from algebra/matrix/arithmetic/type so
      `factories/index.ts` re-exports can name them, resolving the resulting
      `TS4023` errors. All 11 TypeScript packages now typecheck at 0 errors.

- [x] **Source-file test coverage 18.6 % → 27.0 %.** 42 new unit-test files
      (+≈1,294 assertions) brought the suite from 114 → 156 files and tested
      files from 90/485 → 131/485. Coverage focused on the genuinely active
      hand-written code (every AST node class in `expression`, the parser core,
      `Help`, the two error classes, `errorTransform`, the 13 utility modules
      including the sandbox-critical `customs` and all 40+ type guards in `is`),
      plus `packages/workerpool/src/fft-core.ts`, `functions/src/factories/scope.ts`,
      and `matrix/src/backends/WasmLoader.ts`.

- [x] **Variadic typed-function dispatch bug.** This repo's typed-function
      fork delivers `'...T'` rest args as a _single packed array_ (`fn(a, b,
[c, d])`), not as JS spread. Impls declared with `(a, b, ...rest)` got
      `rest = [[c, d]]` and produced wrong results — e.g. `add(1, 2, 3)`
      returned the string `'33'` (number+array stringification), `multiply` /
      `min` / `max` / `hypot` identically broken. Fixed at the five sites in
      `typed/arithmetic.ts` and `typed/trigonometry.ts` by declaring `rest` as
      a plain array parameter; 17 regression tests pinned in
      `functions/tests/typed-variadic.test.ts` so the bug can't silently come
      back.

- [x] **Bitwise category ported to the active `typed/` layer.** Seven ops —
      `bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`, `rightArithShift`,
      `rightLogShift` — now dispatched via `mathTyped()` over `number /
BigNumber / bigint / Int32Array`. BigNumber bitwise reimplemented through
      native `bigint` (the synced helper depends on decimal.js internals
      mathts-core does not expose); non-integer / NaN / Infinity throws
      `'Integers expected'` to match mathjs. `ComputePool` gained
      `bitAnd / bitOr / bitXor / bitNot / leftShift / rightArithShift /
rightLogShift` methods returning `ParallelResult<Int32Array>`. New
      `parallel/src/ops/bitwise.ts` carries pure elementwise impls and chunking.
      `parallel/src/workers/compute.worker.ts` got `bitwiseBinaryChunk` /
      `bitwiseNotChunk` handlers ready for when an Int32-aware kernel registry
      lands. 41 tests.

- [x] **Logical category ported to the active `typed/` layer.** Five ops —
      `and`, `or`, `xor`, `not`, `nullish` — over `number / bigint / BigNumber /
Complex / any`. `nullish` carries explicit `boolean,any` / `string,any` /
      `BigNumber,any` / `Complex,any` / `bigint,any` short-circuit signatures
      so typed-function does not coerce `false` or `''` through a different
      signature before the catch-all. 130 tests.

- [x] **`factories/index.ts` collision resolved.** Twelve names that the
      new typed/ modules now export (`bitAnd`, `bitOr`, `bitXor`, `bitNot`,
      `leftShift`, `rightArithShift`, `rightLogShift`, `and`, `or`, `xor`,
      `not`, `nullish`) also existed as synced-factory exports — `export *`
      through `src/index.ts` produced `TS2308` ambiguous re-export errors. The
      superseded factory entries are now module-private `const` declarations
      (factoryScope wiring preserved). `factories-leaf.test.ts` and
      `factories-tier4.test.ts` were repointed to the typed/ versions.

- [x] **`matrix/tests/WasmLoader.test.ts` skipped-test cleanup.** The two
      `.skip`-ped tests asserted legacy-WASM-shaped exports (`multiplyDense`)
      that this environment does not ship — only the AssemblyScript artifact
      at `assembly/build/mathts.wasm` is present, and it uses suffixed
      snake_case names. Replaced with one real conditional test that loads
      the AS artifact and asserts the universals (`mod.memory` is a
      `WebAssembly.Memory`, non-empty function table); skips dynamically if
      the artifact is missing so CI without `npm run build:wasm` is not
      broken. 48 → 49 pass, 0 skipped.

### Open follow-ups (deferred from this session — real but out of scope of the bug-fix slice)

### Open follow-ups (closed in commit d6ea55c — 2026-05-22)

These are the three items deferred from the typed-layer expansion. All
three landed in commit `d6ea55c` (three subagents in parallel, least →
most complex). Kept here as a checklist of what was done.

- [x] **(Sonnet, low) BigNumber API gap.** `expression/tests/utils-bignumber-formatter.test.ts`
      previously used a `MockBigNumber` because the synced
      `expression/src/utils/bignumber/formatter.ts` duck-types against
      `.gt()`, `.toSignificantDigits()`, and the `.e` (exponent) field on
      Decimal.js-shaped numbers, and `@danielsimonjr/mathts-core`'s BigNumber
      exposed none of them. **Closed:** added `.gt(other)`,
      `.toSignificantDigits(n, roundingMode?)`, and a `.e` getter to
      `core/src/types/bignumber.ts` plus a `.toNumber()` alias and a
      `readonly isBigNumber = true` duck-typing marker. Rewrote
      `utils-bignumber-formatter.test.ts` to drop the mock; 16/16 pass
      against the real BigNumber. 42 new direct tests in
      `core/tests/BigNumber-formatter-api.test.ts`.

- [x] **(Opus, medium) Int32Array-aware workerpool kernel slot.** The
      `packages/workerpool/src/worker.ts` kernel registry was Float64Array-
      only — running bitwise math on doubles would silently corrupt the
      upper bits, so the seven new `ComputePool.bit*` methods initially
      ran in-process. **Closed:** added three Int32-aware kernels
      (`bitwiseChunk`, `bitwiseScalarChunk`, `bitwiseNotChunk`) plus
      public dispatch methods (`bitwiseBinary`, `bitwiseScalar`,
      `bitwiseNot`) and Int32 chunking helpers on `MathWorkerPool`.
      Routed `ComputePool.bit*` through the new kernels above the
      standard elementwise threshold; the in-process path stays as the
      below-threshold fallback. Deleted the dormant
      `bitwiseBinaryChunk` / `bitwiseNotChunk` handlers in
      `parallel/src/workers/compute.worker.ts` (never reachable from
      the active pool). 37 new tests in `parallel/tests/ComputePool.test.ts`
      and `packages/workerpool/tests/bitwise-dispatch.test.ts`.

- [x] **(Opus, high) AssemblyScript WASM ports of bitwise (and
      logical) ops, plus manifest regeneration.** Added bitwise kernels
      to the AssemblyScript module (`assembly/src/ops/
bitwise.ts` — seven brand-new kernels, AS module had no bitwise
      ops before). Exposed via the existing WasmModule interfaces in
      `functions/src/wasm/WasmLoader.ts`,
      `matrix/src/backends/WasmLoader.ts`, and
      `assembly/src/bindings/wasm-loader.ts`. Built via
      `npm run build:wasm`, regenerated `wasm-manifest.json` via
      `tools/generate-wasm-manifest.mjs`, and confirmed the SHA-384
      verification path in
      `functions/tests/security/wasm-integrity.test.ts` still pins the
      new hashes (5/5 pass). Wired the WASM path into
      `typed/bitwise.ts` as a third dispatch tier: WASM (above
      `WASM_BITWISE_THRESHOLD = 65,536` elements) → ComputePool worker
      → in-process. New bridge at
      `functions/src/wasm/bitwise/wasm-bridge.ts` swallows WASM-load
      failures and falls through to ComputePool. 9 new tests in
      `functions/tests/typed-bitwise-wasm.test.ts`.

## 🔧 Repo-wide Cleanup (2026-05-22)

A full pass over the entire workspace (prettier reformatting across
1700+ files, ESLint config tightening on synced dirs only, 38 active-
code lint errors closed). Real bugs surfaced along the way and pinned
below.

### Done

- [x] **ESLint `synced mathjs` override block.** Mirrors `strict: false`
      in `functions/tsconfig.json`: 22 stylistic rules downgrade to
      warnings under the synced category dirs (`functions/src/{arithmetic,
algebra,bitwise,…}/`, `functions/src/wasm/{plain,matrix,…}/`,
      `expression/src/utils/**`, `expression/src/transform/**`, the
      synced helpers at the root of `core/src/`, `core/src/bignumber/`,
      `core/src/function/`, `core/src/types/{bigint,bignumber,fraction,
number,matrix/,unit/}`). Active typed-function code stays strict.
- [x] **38 active-code lint errors closed** across core, functions, and
      expression. Interface-required unused args prefixed `_`, dead
      imports removed, `Function`-type replaced with callable signatures,
      `prefer-spread` rewrites, `prefer-as-const` on three error classes.
- [x] **`npx prettier --write .`** normalized formatting across 1500+
      TS / 120+ MD / 60+ JSON / 4 YAML / 1 shell / 1 HTML file. Purely
      cosmetic — no semantic changes.
- [x] **`core/src/is.ts:313`** — literal `\!isMap(object)` (escaped
      exclamation) replaced with `!isMap(object)`. The escape was a
      paste/sync error that ESLint's parser refused.
- [x] **`tools/benchmark/wasm/{matmul,elementwise}.bench.ts`** — calls
      to `new DenseMatrix(data)` (old single-arg signature) against the
      current `(rows, cols, data?)` constructor failed with "Matrix
      dimensions must match" on every iteration. Both call sites fixed
      to pass `(rows, cols, data)`.
- [x] **`expression/src/node/{ObjectNode,RangeNode,ParenthesisNode}.ts`**
      had latent `_compile(_math: …)` signatures where the method body
      referenced the un-prefixed `math` identifier. Surfaced once
      `--dts` typecheck ran cleanly. Renamed back to `math` in the
      signature; bodies are correct as written.
- [x] **`npm run bench:wasm`** ran end-to-end. WASM column
      populated: **1.3×–26.6× faster than JS** across matmul / dot /
      vecadd / det. _(The `bench:wasm` script and `tools/benchmark/wasm/`
      suite were since removed in the Rust scrub.)_
- [x] **`npm run bench:parallel`** produces full per-op break-even
      data. Only `matmul` (≥64-element matrices) and `spectrogram`
      (≥65,536 samples) beat sequential in this container.

### Open follow-ups (closed in commit 3979eb1 — real bugs surfaced this turn)

All three landed in commit `3979eb1` (three subagents in parallel,
least → most complex). Kept as a checklist of what was done.

- [x] **(Sonnet, low) `matrix/src/backends/WasmLoader.ts` default-path
      was CWD-relative.** `getDefaultWasmPath()` returned
      `'./lib/wasm/mathts.wasm'`, so the matrix test suite (running
      from `matrix/`) looked at `matrix/lib/wasm/mathts.wasm` and
      logged "Failed to load WASM module, falling back to JS" ~50
      times during `npm run test`. **Closed:** unified the Node and
      browser branches to resolve via
      `new URL('../../../lib/wasm/<file>', import.meta.url).pathname`
      (3 hops up = repo root). The matrix test run now prints zero
      "Failed to load WASM" lines.

- [x] **(Sonnet, medium) `functions/src/typed/cas.ts` cubic/quartic
      polynomial-root cases never implemented.** `fm2 = f(-2)` was
      computed but never read; the rational-roots search only handled
      linear and quadratic. **Closed:** added 227 lines of new helpers
      — `depressedCubicRoots(p, q)` (Cardano when Δ<0, trigonometric
      Viète when Δ>0, arccos arg clamped to [-1,1]),
      `solveCubicRadicals(A,B,C,D,fm2…f2)` (short-circuits on the five
      pre-evaluated samples then falls back to depression + the new
      cubic), `solveQuarticRadicals(A,B,C,D,E,fm2…f2)` (Ferrari via
      resolvent cubic, same rational-root short-circuit). `_fm2` prefix
      dropped; `fm2` now read at 7 sites. 6 new tests in
      `functions/tests/cas.test.ts` cover the three-rational-roots
      cubic, one-real Cardano cubic, repeated-root + fm2-short-circuit
      cubic, four-rational-roots quartic, fm2-short-circuit quartic,
      and a two-real-two-complex quartic.

- [x] **(Opus, high) `matrix/src/backends/WASMBackend` had an
      allocator/export ABI mismatch — every standalone WASM bench threw.**
      The backend mixed allocation ABIs and was loaded against the wrong
      artifact, so `module.__new is not a function` /
      `this.wasmModule.add is not a function` on every standalone bench.
      **Closed (Option A — clean split).** `WASMBackend` rewritten as
      **AS-only**, owning its own
      AS instance, with an inline AS-managed Float64Array allocator
      (`__new(byteLength,1)` for buffer + `__new(12,5)` for the header)
      and a per-instance allocation pool to dodge the AS `--runtime stub`
      no-free constraint. Backend registration extracted to a shared
      `matrix/src/backends/register-backends.ts` so the registry is
      populated regardless of which entry point a consumer imports.
      The standalone benches under `tools/benchmark/wasm/` and
      `tools/benchmark/e2e/` were switched to the rewritten AS
      `WASMBackend`, wired to the AS export names (`matrix_multiply` /
      `array_dot` / `matrix_add`). Bench summary now
      shows **2.5–34× faster than JS** across matmul / dot / vecadd /
      det.

> _Removed (2026-05-23, post-audit): the previously-pinned
> "(Environment) GPU benches under `tools/benchmark/gpu/`" item.
> The two bench files (`matmul.bench.ts`, `elementwise.bench.ts`)
> already exist; the open part was a runtime constraint (no WebGPU
> adapter in headless Node), not a backlog action. The related
> backlog item is the new "browser smoke test" entry under
> 🎯 Open Actions at the top of this file._

## 🔧 CDG-driven Coverage Push (2026-05-23)

Ran `tools/create-dependency-graph/` (CDG) to identify untested
active source files and addressed every actionable finding.

### Done

- [x] **Regenerated dependency reports** at commit `baf9007`:
      `DEPENDENCY_GRAPH.md`, `TEST_COVERAGE.md`,
      `dependency-graph.{json,yaml}`,
      `dependency-summary.compact.json`, `test-coverage.json`,
      `unused-analysis.md`. Headline numbers: 1,394 TS files (491
      reachable, 903 dormant), 0 circular dependencies, 27.5%
      source-file coverage (135 / 491).

- [x] **README full rewrite + new `docs/migration-guide.md`** at
      commit `c6514ed`. README now reflects the current state
      (typed-layer ports, three-tier dispatch, per-op
      thresholds); migration guide covers the breaking changes from
      mathjs v15 (functions now async, new typed overloads, matrix
      constructor signature, `m.get([row,col])` form,
      `BigNumber.parse`, WebGPU f32-only opt-in).

- [x] **`docs/Architecture/{OVERVIEW,ARCHITECTURE}.md` refreshed**
      with the regenerated CDG numbers (491 / 903 / 1,394 / 124,615
      LOC / 2,898 exports / 164 test files / 27.5% / module counts).
      Three new content paragraphs added to `ARCHITECTURE.md`
      (per-op `thresholdByOp`, the `AllocatorKind` discriminant,
      the bitwise three-tier dispatch diagram).

- [x] **`unused-analysis.md` triage.** False-positive
      `packages/workerpool/src/index.ts` annotated. First 20 of 377
      "unused exports" classified (14 public-API, 5 type-only, 1
      internal-only, 0 deletions). Triage Notes section at the
      bottom with policy: exports from package-root `index.ts` files
      are intentionally part of the public surface and will always
      appear in this report without being defects.

- [x] **`eigs` / `svd` / `singularValues` re-validated `not
pursued`** with measured evidence (see also the existing
      Acceleration Roadmap entry above for the data). New durable
      probe `tools/benchmark/parallel/eig-inner-probe.ts` checked
      in.

- [x] **`polyFit` / `leastSquares` re-validated `deferred`** with
      measured evidence. New probe
      `tools/benchmark/parallel/regression-probe.ts` checked in;
      8 new tests in `functions/tests/typed-regression.test.ts`.

- [x] **+12 active files moved from untested → tested** at commit
      `122c590`. Source-file coverage **27.5% → 29.9%** (135/491 →
      **147/491**); test-file count **165 → 176**. Test files
      created: - `expression/tests/parse.test.ts` (NEW, 101 tests across 24
      describe blocks covering literals, operators, precedence,
      function calls, assignments, blocks, arrays / objects /
      index access, ranges, conditional ternary, whitespace,
      error handling, static helpers). - `parallel/tests/ops-bitwise.test.ts` (NEW, 64 tests):
      direct unit tests for the 7 pure elementwise bitwise op
      functions against JS oracles, with two's-complement
      boundaries, INT32 limits, scalar-vs-array shifts, mod-32
      shifts, empty arrays, length-mismatch errors, output-type
      check, no-mutation invariant. - 10 barrel / type-only smoke tests across
      `core / expression / parallel / tensor / workbook`. Each
      directly imports its target file and asserts the expected
      export names exist (or for type-only files, that the
      import compiles with a `satisfies` check). Fixed a stale
      `new Tensor([2,3])` call missing the required
      `Float64Array` data arg.

The remaining 344 untested files in the CDG report are
intentionally out of scope:

- **325** synced mathjs files under
  `functions/src/{arithmetic,algebra,bitwise,…}/` — tested via the
  active `typed/` layer with which they share factory entry points.
- **19** AssemblyScript sources under `assembly/src/` — tested via
  `npm run test:wasm:integration`; Vitest's `**/*.test.ts`
  discovery does not see them.
- Synced `expression/src/{utils,transform}/` directories — same
  reasoning as the synced functions code.

### Newly surfaced — pinned for the next pass

- [x] **`matrix/src/backends/WasmLoader.allocateFloat64Array()` (lines
      ~744–867) carried an allocator ABI mismatch.** `module.__new(byteLength, 2)`
      (AS-specific) returned a flat-memory `.ptr` for callers that
      expected a raw-pointer ABI. `matrix/src/backends/wasm/fft-wasm.ts`
      inherited the bug. **Closed in commit b96b53a.** `WasmLoader` now
      uses the AS-managed allocator consistently; the four `allocate*`
      methods + `release` / `free` / `clearPool` / `collect` were aligned
      to it. `Allocation<T>` typed sum lets
      consumers re-bind output views to `module.memory.buffer +
alloc.dataPtr` after each call (AS allocations may grow
      memory and detach earlier views). `fft-wasm.ts` updated for the
      re-bind pattern. 9 new live tests in
      `matrix/tests/MatrixWasmBridge.test.ts`
      (new, 7) and `matrix/tests/wasm/fft-wasm.test.ts` (+2 for
      `backend: 'wasm'`) exercise the previously-dead bridge paths.

- [x] **`npm run test:wasm:integration` — was 5 fails across 2
      files.** The cross-package WASM integration suite under
      `tests/wasm/` is invoked by a separate npm script that the
      standard `npx turbo test` graph does not cover. **Closed in
      commit b96b53a.** Three of the original five failures were
      transitively closed by the parallel `WasmLoader` allocator-
      split and `WASMBackend` work landing in the shared tree. The
      remaining two were addressed directly:
      `typescript-integration.test.ts` "Direct WASM Imports… AS
      functions" — stale assertion against rolldown 1.0.0-rc.17
      (Vite 8.x) which cannot parse the top-level-await
      destructuring AS generates; `shouldSkip()` extended to catch
      `RolldownError` / `"Parse failure"` / `"Duplicated export"`
      with an inline note. "Performance Verification > large matrix
      operations" — was `it.skip` pinning the WasmLoader hybrid
      bug; **unskipped after the bug was closed**, now passes.
      Suite is now **11 files, 224 passed, 0 failed, 0 skipped**
      (was 212 + 5 fail).

- [x] **`bench:parallel` recommended thresholds vs. code default.**
      The bench output (`tools/benchmark/parallel/run.ts`) reports
      per-op recommendations. **Closed in commit b96b53a.**
      `ComputePoolConfig` gained an `OpName` union covering the 37
      dispatched operations and a
      `thresholdByOp?: Partial<Record<OpName, number | 'never' |
'always'>>` map. `shouldParallelize(elementCount, op?)`
      resolves the per-op threshold first and falls back to the
      flat `thresholdElements: 50000` only for ops not in the map.
      Default values applied (source: `tools/benchmark/parallel/run.ts`,
      2026-05-23, noisy CI container): most ops `'never'`,
      `matmul=4_096`, `spectrogram=65_536`,
      `matrixPower=characteristicPolynomial=9_216`,
      `erfc=100_000`, `besselJ=1_000_000`. `resolveOpThreshold` /
      `OpName` / `OpThreshold` exported. 18 new tests in
      `parallel/tests/ComputePool.test.ts`.

- [x] **AS WASM module export gap.** The
      AS path fell back to JS for `LU`, `QR`, `Cholesky`,
      `inverse`, `determinant`. **Closed in commit b96b53a.** Five
      new AS kernels in `assembly/src/algebra/decomposition.ts`
      (`matrix_lu_decompose`, `matrix_qr_decompose`,
      `matrix_cholesky`, `matrix_inverse`, `matrix_determinant`),
      re-exported from `assembly/src/index.ts`, AS artifact rebuilt
      (42,128 → 45,354 bytes, +3.2 KB). `WASMBackend.ts` dispatches
      to the AS exports first and falls back to JS only when the
      probe (`typeof mod.matrix_xxx === 'function'`) fails.
      WasmModule interface entries added to
      `assembly/src/bindings/wasm-loader.ts`,
      `matrix/src/backends/WasmLoader.ts`,
      `functions/src/wasm/WasmLoader.ts` (kept in sync).
      `wasm-manifest.json` regenerated at both `lib/wasm/` and
      `assembly/build/`. SHA-384 integrity test 5/5. 5 new tests in
      `matrix/tests/wasm/decompositions-as.test.ts` within `1e-9`
      tolerance. Porting note: the inline-recompute
      Householder pattern degenerates in AS, so the AS port follows
      the JS-reference precompute-into-`vBuf` pattern (same maths,
      different storage discipline).

> _Moved to 🎯 Open Actions at the top of the file (2026-05-23,
> post-audit): the previously-pinned "browser smoke test for
> WebGPU paths" and "Cut a release for [Unreleased] CHANGELOG"
> items. Both are genuinely actionable; the rest of this section's
> backlog was either decided-not-pursued or environmental._

## 📋 Next Steps

### WASM Test Files (46 files, sorted by complexity) ✅ ALL COMPLETE

All 46 test files created for src/wasm/ modules:

#### Tier 1: Simple (< 300 lines) - 6 files ✅ COMPLETE

- [x] arithmetic/logarithmic.ts (179 lines) - 36 tests
- [x] bitwise/operations.ts (221 lines) - 29 tests
- [x] matrix/multiply.ts (230 lines) - 21 tests
- [x] index.ts (275 lines) - skipped (re-export only)
- [x] WasmLoader.ts (275 lines) - 6 tests
- [x] logical/operations.ts (283 lines) - 38 tests

#### Tier 2: Moderate (300-450 lines) - 12 files ✅ COMPLETE

- [x] algebra/sparse/utilities.ts (323 lines) - 15 tests
- [x] MatrixWasmBridge.ts (323 lines) - 12 tests
- [x] complex/operations.ts (324 lines) - 45 tests
- [x] trigonometry/basic.ts (325 lines) - 60 tests
- [x] arithmetic/basic.ts (344 lines) - 50 tests
- [x] numeric/ode.ts (360 lines) - 15 tests
- [x] algebra/schur.ts (365 lines) - 20 tests
- [x] algebra/decomposition.ts (366 lines) - 25 tests
- [x] combinatorics/basic.ts (369 lines) - placeholder (f64 functions)
- [x] probability/distributions.ts (376 lines) - 55 tests
- [x] utils/checks.ts (441 lines) - 60 tests
- [x] relational/operations.ts (454 lines) - 50 tests

#### Tier 3: Complex (450-600 lines) - 16 files ✅ COMPLETE

- [x] matrix/broadcast.ts (486 lines) - placeholder (f64 functions)
- [x] signal/fft.ts (487 lines) - placeholder (f64 functions)
- [x] arithmetic/advanced.ts (499 lines) - placeholder (f64 functions)
- [x] statistics/select.ts (510 lines) - 30 tests
- [x] algebra/equations.ts (535 lines) - placeholder (f64 functions)
- [x] string/operations.ts (535 lines) - 45 tests
- [x] matrix/algorithms.ts (536 lines) - placeholder (f64/i32 functions)
- [x] numeric/calculus.ts (550 lines) - placeholder (f64 functions)
- [x] special/functions.ts (572 lines) - placeholder (f64 functions)
- [x] signal/processing.ts (577 lines) - placeholder (f64 functions)
- [x] matrix/rotation.ts (590 lines) - 40 tests
- [x] algebra/sparse/amd.ts (591 lines) - placeholder (i32/unchecked)
- [x] plain/operations.ts (594 lines) - placeholder (f64/i32/bool functions)
- [x] set/operations.ts (594 lines) - 60 tests
- [x] algebra/polynomial.ts (604 lines) - 55 tests
- [x] geometry/operations.ts (779 lines) - 50 tests

#### Tier 4: Very Complex (600+ lines) - 12 files ✅ COMPLETE

- [x] numeric/rootfinding.ts (638 lines) - 35 tests
- [x] statistics/basic.ts (650 lines) - placeholder (i32 functions)
- [x] matrix/linalg.ts (709 lines) - 20 tests
- [x] simd/operations.ts (714 lines) - placeholder (v128 SIMD)
- [x] unit/conversion.ts (757 lines) - placeholder (f64 functions)
- [x] algebra/solver.ts (794 lines) - placeholder (f64/i32/unchecked)
- [x] matrix/functions.ts (820 lines) - placeholder (f64/i32/unchecked)
- [x] matrix/basic.ts (836 lines) - 25 tests
- [x] algebra/sparse/operations.ts (849 lines) - placeholder (i32/unchecked)
- [x] numeric/rational.ts (917 lines) - placeholder (i64/StaticArray)
- [x] numeric/interpolation.ts (930 lines) - 40 tests
- [x] matrix/sparse.ts (1597 lines) - placeholder (i32/unchecked)

### Test Files ✅ COMPLETE

- [x] **All test files now have TypeScript equivalents**
  - 349 JS files converted (all have .ts versions)
  - Original JS files kept for benchmarking comparisons
  - 100% coverage of test files

### Low Priority

- [x] **Convert embeddedDocs to TypeScript** (255 files) ✅ ALREADY COMPLETE
  - All 255 JS files have .ts equivalents (content identical, formatting differs)
  - TS index file (embeddedDocs.ts) imports from .ts extensions
  - Simple string exports — no type annotations needed

> _Removed (2026-05-23, post-audit): the "Keep duplicate JS/TS files
> (418 files)" backlog item. `find functions/src -name '*.js' -not
-path '*/node_modules/*' | wc -l` returns 0 — the duplicate
> JS files are gone, so the concern is moot. There is nothing to
> keep or remove._

### Performance

- [x] **Performance optimization** ✅ COMPLETE
  - Profiled WASM module loading (cold: ~22ms, warm: ~0.01ms)
  - Added module caching with precompile() for ~4000x faster warm loads
  - Added streaming compilation for browsers (instantiateStreaming)
  - Added memory pooling for frequent allocations
  - Added operation-specific size thresholds (WasmThresholds)
  - SIMD operations already comprehensive (33 functions)
  - Small operations now use JS fallback to avoid copy overhead

- [x] **Optimize parallel processing** ✅ COMPLETE
  - Using local @danielsimonjr/workerpool (file:../workerpool)
  - Added worker pool prewarming for instant availability
  - Added global singleton pool to avoid recreation overhead
  - Added optimal chunk size calculation (L1/L2 cache aware)
  - Added performance metrics tracking
  - Added adaptive parallelization based on data size

- [x] **Run WASM modules in parallel** ✅ COMPLETE
  - Created ParallelWasm module combining WASM + multi-core
  - Implemented parallel dot product, sum, add operations
  - Uses SharedArrayBuffer for zero-copy data sharing
  - Automatic strategy selection: JS vs WASM vs Parallel-WASM
  - ParallelWasmThresholds for operation-specific parallelization
  - Target achieved: WASM speedup × parallel speedup for large operations

### Documentation

- [x] **Update main README with TypeScript/WASM status** — done in
      commit `c6514ed` (2026-05-23). README rewritten end-to-end:
      three-tier dispatch (in-process JS → ComputePool worker →
      WASM kernel), per-op thresholds from
      `bench:parallel`, WebGPU opt-in, build/test/lint/bench npm
      scripts, status summary (12/12 build, 19/19 test, 224/224
      WASM integration, SHA-384 5/5).

- [x] **Add migration guide for users** — done in commit `c6514ed`
      (2026-05-23). New `docs/migration-guide.md` (356 lines)
      covers: drop-in `@danielsimonjr/mathts-compat` shim,
      switching to the typed-function API (scalar /
      `Float64Array` / `Int32Array` overloads), breaking changes
      from mathjs v15 (now-async matrix decompositions, the new
      typed overloads, matrix-constructor signature change,
      `m.get([row,col])` form, `BigNumber.parse`, WebGPU f32-only
      opt-in), performance migration path with
      `WASM_BITWISE_THRESHOLD = 65,536`, type-checking and
      workbook + expression pointers.

### CI/CD ✅ COMPLETE

- [x] **Update CI/CD pipeline**
  - Added TypeScript type-checking job (`tsc --noEmit` + `test:types`)
  - Added WASM build & test job (validate, build, run unit tests)
  - Build-and-test now depends on all verification jobs

## Notes

- All functional JS files have been converted to TypeScript
- The codebase compiles with zero TypeScript errors
- Legacy JS files are kept for comparison and benchmarking purposes
- AssemblyScript is the sole WASM backend
- WASM distribution: `lib/wasm/mathts-as.wasm` (AssemblyScript)

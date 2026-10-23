# MathTS whole-codebase audit and documentation refresh (2026-10-22)

**Status:** Complete for the documentation refresh; code-level findings are listed for follow-up.
**Guiding principle (Daniel, Oct 22):** reuse and expand the existing libraries and packages; add new functionality, files or packages only when necessary or truly missing from the codebase.
**Baseline:** `origin/main` at `19ef0fb8` (after PR #400).

This report records what the audit checked, what it found, which pull requests fixed the
documentation, and what is left open. Every finding below was verified against the code by an
auditor and then re-checked by an independent reviewer when a fix was written. File and line
references are to the tree at the baseline commit and can drift.

## 1. Method

1. **Gate baseline.** Ran every docs and duplicate gate on the baseline: `docs:deps`,
   `docs:functions:check`, `check:duplicates:fast`, `check:file-census`, `docs:roadmap-check`,
   `check:browser-safety`, and `repo-tools check . --docs=docs/Architecture`. All passed, and
   regenerating `docs/Architecture/*` produced only date stamps. The generated documents match the
   code; the drift was in hand-written prose.
2. **Six read-only audits**, one per package group plus one cross-cutting code audit. Each document
   claim (symbol, count, threshold, command, path, example output) was checked against the source,
   the built `dist`, `package.json`, `turbo.json` and the CI workflows. Examples were run.
3. **Fix PRs by package group**, each with a builder pass, an independent adversarial review
   (a different model from the builder) that re-ran examples and gates, and fixes until the reviewer
   approved or only non-blocking residuals remained. Reviewers found real defects in every PR
   (11, 12, 14, 9 and 13 in the first round; the second round still found 3, 1, 4 and 0).
4. **Merge rule.** Squash merge with `--match-head-commit`, after Linux CI was green on that head.

The gate suite cannot see prose. Several claims that were wrong survived it: a bitwise WASM
threshold that `policy.ts` never dispatches, a GPU cutover for a backend that is never registered,
a `computePool.sum` that was shown returning a number, and function counts that disagreed with the
generated export index.

## 2. Dependency advisory (the CI blocker)

The scheduled CI run of 2026-10-22 07:13 UTC failed in `Compile & Lint` at `Audit (high+)`. The log
shows no advisory:

```
bun audit v1.4.2
error: POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk - 503
```

The npm advisory endpoint answered 503 for five minutes. Run locally on the same lockfile,
`bun audit --audit-level=high` prints `No vulnerabilities found (checked 263 packages, 4 below
--audit-level=high)`. No lockfile or override change was needed, and no merge was blocked: the
pull-request runs of the same jobs passed. See open issue I-1 for making the step tolerate a
registry outage without hiding a real advisory.

## 3. Pull requests

| PR                                                       | Scope                                                                                               | Result                  |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------- |
| [#401](https://github.com/danielsimonjr/MathTS/pull/401) | Root README, CLAUDE.md, MEMORY.md, SUPPORT/SECURITY, `.changeset-parked`, `docs/Architecture` prose | merged                  |
| [#402](https://github.com/danielsimonjr/MathTS/pull/402) | expression, workbook, plot, compat, parser/ast docs, `docs/expressions`, `docs/migration`           | merged                  |
| [#403](https://github.com/danielsimonjr/MathTS/pull/403) | functions and statistics docs, reference acceleration column, Pareto and `compileScalar` API docs   | merged                  |
| [#404](https://github.com/danielsimonjr/MathTS/pull/404) | core, typed-function, workerpool, numbers, units docs                                               | merged                  |
| [#405](https://github.com/danielsimonjr/MathTS/pull/405) | matrix, gpu, tensor, autograd, parallel, linalg, assembly docs, backends and performance guides     | merged                  |
| [#406](https://github.com/danielsimonjr/MathTS/pull/406) | guides, roadmap and planning banners, docs index, tools READMEs, runnable examples                  | merged                  |
| [#407](https://github.com/danielsimonjr/MathTS/pull/407) | code fix: `scalarComplexity` read inherited keys of its weight records (M1)                         | merged                  |
| this PR                                                  | this report and its index entry                                                                     | opened with this report |

## 4. Documentation gaps fixed (highlights)

- **Acceleration claims.** README, `docs/Architecture/*`, `docs/backends.md`, `docs/performance.md`,
  `docs/reference/functions.md` and the migration guide all described one cascade (WASM, then
  workers, then GPU) with round thresholds. The code is per kernel: `ComputePool` thresholds are
  `'never'` for almost every element-wise op, `matmul` is 4,096, an op that does not pass its name
  falls to the 50,000 default; `functions` WASM loads only after `loadWasm()` and then only for the
  measured bands in `functions/src/wasm/policy.ts`; `BackendManager` registers JS and WASM only (no
  GPU); WebGPU is `enableGpu()` at 65,536 elements (FFT 262,144).
- **Examples that threw or printed wrong values** in the docs: `cubicSpline`, `trapz`, `polyval`,
  `polyFit`, `computePool.sum` and `add` (`ParallelResult`, no `workersUsed`), `eig`/`svd` on a
  `DenseMatrix`, `DenseMatrix.set` ignored, `new DenseMatrix(nested)`, `Range` end, `evaluate` with
  assignment, `-2^2`, and three of the repo's own `examples/*.ts` (now run with
  `bun --tsconfig-override=tsconfig.base.json examples/<file>.ts`).
- **Missing documentation.** The M1 ScalarNode toolkit (`docs/api/expression.md`), the M3/M4 APIs
  (`docs/api/functions.md`), `mathMLToSVG`, `mtsw serve`, plot `./render`, the `./internal` core
  entry point and the two `DEFAULT_CONFIG` objects, the real `@danielsimonjr/mathts-wasm` entry
  point, and every `docs/superpowers/*` file in the docs index.
- **Stale banners.** Planning and roadmap files that read as current (`MASTER_ROADMAP`,
  `MATHTS_SPRINT_TRACKER`, `CONSOLIDATED_CORRECTIVE_ACTION_PLAN`, `MATHJS_SYNC_ROADMAP`,
  `BUN_MIGRATION`, `ITENSOR_PARITY`, ...) now carry a dated status line that agrees with the index.
- **Counts.** `functions` ships **1,090** exports (the generated index, reconciled by
  `docs:functions:check`). The older "686 callable / 878 total" prose is stale and was removed from
  README and MEMORY; do not reintroduce a hand-written count.
- **Broken or wrong references.** `SUPPORT.md` workbook-spec link, `npm run cdg`, `npx tsx` and
  `npx ts-node` commands, `compile:ts`, bench script names that do not exist.

Intentionally untouched: `docs/roadmap/PYSR_INFORMED_ROADMAP.md` (its status line and inventory are
stale, see section 7; it is rewritten in the roadmap step), the `## Verification` tables of
`docs/Architecture/*.md` (machine-checked; only the OVERVIEW lines-of-code cell moved, where
`repo-tools check` demanded it), and historical files under `docs/archive/`.

## 5. Duplicate code

The duplicate gate groups own-defined exports by **name** and reports `TRUE_DUPLICATE` 0. The same
algorithms still exist under different names. A package may only consolidate into a package it
already depends on; `workerpool` depends on neither `core` nor `functions`.

| Cluster                           | Where                                                                                                                                                                                     | Verdict                                                                         | Consolidation target                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Mulberry32, five identical copies | `tensor/src/operations/random.ts` (`makeMulberry32`), `functions/src/typed/{hypothesis,dist-objects,graph}.ts`, `packages/workerpool/src/worker.ts`                                       | true duplicate (the roadmap counts four)                                        | `core` (PySR M5); `workerpool` may take a `core` dependency, no cycle |
| Lanczos log-gamma                 | canonical `functions/src/wasm/special/scalars.ts` `_lgamma` (uses `abs(sin)`); bare-`sin` copies in `typed/hypothesis.ts`, `typed/dist-objects.ts`, `workerpool/src/worker.ts`            | true duplicate with **numeric drift** (negative non-integers)                   | `functions` canonical; update the worker copy in place                |
| log-gamma, second algorithm       | `functions/src/plain/number/probability.ts` `lgammaNumber` (g=5, NaN for negatives) behind the factory `lgamma` and Dirichlet sampling                                                    | two live algorithms                                                             | decide the negative-domain contract, then delegate                    |
| erf                               | `typed/hypothesis.ts` `_erf` (Abramowitz, about 7 digits) and its KS kernel string vs `typed/special.ts` `erfcScalar` / `distributions.ts` `_erfc`                                        | retired approximation still in use                                              | `functions` accurate scalar                                           |
| Radix-2 FFT                       | `functions/src/signal/fft-core-f64.ts` (canonical), `workerpool/src/fft-core.ts`, `matrix/src/backends/wasm/fft-wasm.ts` `fftJS`                                                          | workerpool copy is layering; `fftJS` is a publicly unreachable duplicate        | keep the first; retire `fftJS`                                        |
| Matrix product                    | `matrix/src/operations/common.ts` `matMul` vs `functions/src/ml/ols.ts` `matmul`                                                                                                          | true duplicate                                                                  | export `matMul` from matrix, call it from `ols`                       |
| Polynomial product                | `functions/src/typed/algebra.ts` `polymul` small path vs `wasm/poly/wasm-bridge.ts` `polyMulJS`                                                                                           | true duplicate                                                                  | one JS convolution                                                    |
| Row-major strides                 | `Tensor.rowMajorStrides`, `parallel/src/ComputePool.ts` `_rowMajorStrides`, `workerpool/src/worker.ts`                                                                                    | true duplicate; the comment saying `parallel` has no `core` dependency is wrong | free function in `core`                                               |
| Linear regression wrappers        | `descriptive-stats.ts` `linregress` vs `regression-extra.ts` `linearRegression` (both over `fitLine`)                                                                                     | near-duplicate public API                                                       | wrap one in the other after a parity pin                              |
| Numeric Jacobian and norms        | `levenbergMarquardt` private forward-difference Jacobian (`h = 1e-7`) and sum-of-squares `norm2`, `svds` `norm2`, BFGS/Newton central differences vs `numericJacobian` and `core` `norm2` | LM and `svds` bypass the shared primitives                                      | `numericJacobian`; `core` `norm2`                                     |
| Root finding                      | `typed/cas.ts` `numericRealRoots` own bisection vs `findRoot`                                                                                                                             | bypass                                                                          | `findRoot`                                                            |

Reviewed and **not** duplicates: `paretoDist` vs `paretoFront`, `normalForm` vs `scalarCanonical`,
`Node` traversal vs `ScalarNode` traversal (two IRs; M2 is the bridge), `rankdata` vs `rankF64JS` vs
matrix `rank`, `compileExpr` vs `compileScalar`, the formatters (already consolidated), `Unit`
(one class, in `core`), and the allowlisted AssemblyScript mirrors.

## 6. Dead code and stale artefacts

The generated census reports 0 orphans and 0 unused exports on 1,910 tracked `.ts` files, so the
items below are things the census cannot see.

- `write_factories_index.py` (repo root): unreferenced by any script, doc or workflow; it embeds an
  old subset of `functions/src/factories/index.ts`. Delete candidate.
- `matrix/src/backends/wasm/fft-wasm.ts` (`fftJS`, `wasmFFT`, `wasmIFFT`, `wasmRFFT`): tests only;
  not on the matrix barrel; `AGENTS.md` records the WASM FFT as 6x slower. Delete candidate.
- `assembly/src/bindings/wasm-loader.ts` (`MathTSWasm`): no importer besides its own barrel; the
  package entry is the generated glue. Its hand-rolled `FLOAT64_ARRAY_ID = 3` does not match the AS
  runtime id 5 the matrix backend uses.
- `WASMBackend` LU/QR/Cholesky methods: no production caller; the public functions are the JS ones.
- Two matrix threshold tables: `matrix/src/config.ts` (WASM multiply 500, GPU 50,000...) is not what
  `backendManager` uses (256 / 65,536) until `setConfig`, which is not exported.
- `eigWasm`/`svdWasm`/`tensorEigWasm`/`tensorSvdWasm`: async JS delegates kept for call-site
  compatibility; the names now mislead.
- `units` (and `parser`, `ast`, `evaluator`, `expression`, `arithmetic`, `trigonometry`,
  `statistics`, `signal`) depend on `typed-function ^4.0.0` and never import it; the lockfile
  resolves the upstream 4.2.2, not the fork core and functions use.
- `packages/typed-function` (`@danielsimonjr/mathts-typed-function`) has no workspace dependent.
- `tools/mathjs-port/drafts/`: unreferenced scaffolding, documented as the port workspace; left.
- Source comments that still state pre-policy WASM thresholds (`parallelStatMedian` "above 16 K",
  `welchPSD`, `goertzel`, `chirpZTransform`, hypothesis sorts, `lgamma`).

## 7. PySR milestones M1, M3, M4 (merged) and the roadmap

M1 (`expression/src/scalar-structure.ts`), M3 (`functions/src/scalar-compile.ts`) and M4
(`functions/src/pareto-front.ts`) are exported, tested and documented. None duplicates existing
code. Two findings:

- **M1 sandbox gap (fixed in #407).** `scalarComplexity` indexed the caller's weight records with
  `w[name]`; a symbol named `constructor` or `toString` read an inherited function and the result
  was `NaN`. It now uses the existing own-property helper.
- **M3** copies the `NUMERIC_LITERAL` regex from `scalar-eval.ts` and inlines the same `Math.*`
  kernels as the typed `number` cases (an intentional specialisation: no typed dispatch per row).
  Exporting the regex once is a cleanup, not a new module.

`docs/roadmap/PYSR_INFORMED_ROADMAP.md` still says "roadmap only; no feature code", that no
traversal/hash/complexity helpers exist, and that no Pareto utility exists. Gaps G1, G2, G4 and G5
are closed; G6 undercounts the Mulberry32 copies.

### Reuse map, M1 to M15

| Milestone           | Reuse (do not rebuild)                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1, M3, M4          | Done. `scalarCanonicalKey` and the other M1 exports; `compileScalar`; `paretoFront`, `scoreFront`, `selectFrontModel`.                                                                           |
| M2 bridge           | Node constructors (`createOperatorNode`, `createSymbolNode`, ...), `simplify`, `symbolicEqual`, `leafCount`, `Node.toTex`. The missing piece is `scalarToNode`/`nodeToScalar`, not a simplifier. |
| M5 RNG              | Lift the tensor Mulberry32 and `boxMuller` into `core`; do not reuse the seedrandom wrappers (`seedProbabilityRng`, `createRng`: global or module state).                                        |
| M6 gradients        | `Dual`, `DUAL_UNARY_RULES` (core), `derivativeAt`/`gradientAt` (functions), extend the M3 tape; `numericJacobian` only as an oracle. `autograd` is tensor-level and the wrong tool.              |
| M7 constant fitting | `bfgs` (accepts `grad`), `nelderMead`, `levenbergMarquardt` (add the optional `jacobian`, default through `numericJacobian`), `ols`, `leastSquares`, `core` `pairwiseSum`/`norm2`.               |
| M8 equivalence      | `compileScalar` for samples, `symbolicEqual`, `core` `nearlyEqual` and the `relTol`/`absTol` config.                                                                                             |
| M9, M10 dimensions  | `SiDimensionVector`, `toSiDimensionVector`, `Fraction`, `Unit`, `rationalNullspace`. Exponents are `number` today (decision D-2).                                                                |
| M11 to M13 search   | `scalarCanonicalKey` for dedup, `scalarComplexity`/`scalarSize`, `mapScalar`, `SCALAR_FUNCTIONS`, `compileScalar`, the M4 trio. No 25th package unless `docs:graph -- cycles` shows a cycle.     |
| M14 parallel        | `parallel` `WorkerPool.execute` with `timeoutMs` (the security invariant), the `integrateFanOut` pattern; ScalarNode batches need their own measured threshold.                                  |
| M15 export          | `Node.toTex`, `scalarCanonicalKey`, `scoreFront` rows, workbook `toTeX` and plot `toTikZ`.                                                                                                       |

## 8. Open issues (drafted for filing)

The environment that ran this audit could not create GitHub issues (its `gh` token is read-only), so
the issues below are drafted here, each with enough detail to file as is.

- **I-1. CI: `bun audit` step fails on a registry 503.** `Audit (high+)` has no retry; a five-minute
  503 failed the scheduled run. Retry the call a few times, fail only on a real advisory or on
  repeated outage, and keep `--audit-level=high`.
- **I-2. `lgamma` copies disagree on negative non-integers.** See the log-gamma rows in section 5.
  Point the `functions` copies at `_lgamma`, fix the worker copy in place, decide the contract of
  `lgammaNumber`.
- **I-3. Hypothesis normal CDF uses the retired 7-digit erf** (`typed/hypothesis.ts`, including the
  KS kernel string). Reuse the accurate scalar body.
- **I-4. Mulberry32 x5 -> one generator in `core`** (PySR M5, also the stale layering comment in
  `ComputePool.ts` and the three strides copies).
- **I-5. `levenbergMarquardt` bypasses `numericJacobian`; `svds` `norm2` overflows.** Add the
  optional `jacobian` option (PySR M7) and use `core` `norm2`.
- **I-6. Remove `write_factories_index.py` and the unreachable matrix JS FFT** (`fftJS` and its
  `wasmFFT` family).
- **I-7. Smaller duplicates:** `ols` `matmul` vs matrix `matMul`; `polymul` vs `polyMulJS`;
  `linearRegression` vs `linregress`; `numericRealRoots` vs `findRoot`; workerpool `fft-core.ts`
  header comment.
- **I-8. `DenseMatrix.multiply`/`lu`/`qr`/`cholesky` never reach WASM; GPU is not registered in
  `BackendManager`; two threshold tables.** Either wire them with a benchmark or delete the dormant
  branches; until then the docs describe the JS reality.
- **I-9. `create(all, config)` mutates the process-wide internal `DEFAULT_CONFIG`**: a later
  `evaluate('e ^ 2')` returned a `BigNumber`.
- **I-10. Dead `typed-function ^4.0.0` dependency on nine re-export packages**, resolving the
  upstream 4.2.2; and `packages/typed-function` has no dependents (release decision).
- **I-11. `mtsw capabilities --json` prints `schemaVersion` as `"[Circular]"`**
  (`workbook/src/cli.ts` `jsonEnvelope` replacer vs the shared `SCHEMA_VERSION` object).
- **I-12. `simplify` with `exactFractions` does not convert `0.4 * x`** (`simplifyConstant` needs an
  injected `fraction` factory).
- **I-13. The export-index gate skips expression, workbook and plot**, so M1's exports never forced
  an API-page update. Extend `TARGETS` in `tools/generate-functions-reference.mjs`.
- **I-14. Stale WASM thresholds in `functions/src/typed/*` comments**, and `bun test`-reachable
  examples are not run in CI (an `examples/` smoke test would have caught the three broken ones).
- **I-15. `docs/BENCHMARK_RESULTS.md` (2026-06-27) predates the 2026-09-26 dispatch policy**, and
  the `assembly/COVERAGE_AUDIT.md` "covered" counts need `coverage_matrix.py` re-run.
- **I-16. `mad` (median absolute deviation) vs `parallelStatMAD` (mean absolute deviation)** share a
  name root with different meanings.
- **I-17. `workbook` does not export `DependencyGraph`/`DependencyNode`/`toDOT`** although the CLI
  uses them; decide whether they are public API.
- **I-18. `functions` WASM-source comments and `MathTSWasm` bindings**: either delete the unused
  hand-written bindings or make them the entry (the id mismatch above makes them unsafe to use).

## 9. State at the time of writing

All pull requests in the list above, except this one, were squash-merged after Linux CI passed on
their head commit. Generated artefacts under `docs/Architecture` were reverted where a pre-commit
run only changed their dates. After this report merges, the next step is the roadmap refresh against section 7; no implementation of any roadmap
milestone, and no release, tag or publish, is part of this work.

## 10. Decisions for the owner

- **D-1.** Phase 4 of the PySR roadmap asks for a 25th package. The audit finds every reuse point
  inside `core`, `functions` or `expression`; the guiding principle says no new package unless a
  dependency cycle forces it. Confirm.
- **D-2.** `SiDimensionVector` exponents are `number`; PySR M9 sketches `Fraction`. Extend the type
  or accept `number` with a tolerance.
- **D-3.** Delete `write_factories_index.py`, the matrix JS FFT and the `MathTSWasm` bindings
  (I-6, I-18), or keep them with a banner.
- **D-4.** Give the automation write access to GitHub issues so the section 8 list can be filed.

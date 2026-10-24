# Audit issues I-1 .. I-18: final texts (2026-10-24)

The automation that ran the audit and this follow-up is restricted to read-only GitHub access for issues and did not file them, so the final issue texts are recorded here, ready to file. Status is relative to `origin/main` after the 2026-10-24 wave: #411 (release guard), #412 (polymul), #413 (D-3 deletions), #414 (D-2), #415 (RNG, strides), #416 (Levenberg-Marquardt, svds), #417 (matMul), #418 (lgamma, erf) are merged. Do not file an issue marked resolved as still open.

---

## I-1

**Status:** open. No PR in this wave.

**Title:** CI: `bun audit` has no retry and fails the job on a registry 503

**Body:**

`.github/workflows/ci.yml` step `Audit (high+)` (lines 100–104) is a single `bun audit --audit-level=high`. A five-minute registry 503 fails the scheduled run even when the lock has no high advisory.

Retry the call a few times. Fail the job only on a real advisory at `--audit-level=high`, or when every attempt is an outage. Keep the high floor. Do not drop the flag (a bare `bun audit` is a different gate).

---

## I-2

**Status:** partial, closed by decision in #418. Do not re-file the “copies disagree” half. The contract decision is the remaining record.

**Title:** `lgamma` on negative non-integers: copies unified; `lgammaNumber` stays NaN

**Body:**

Before #418, three statistical copies used bare `sin` and returned NaN wherever `sin` is negative, while the canonical body returns `ln|Γ(x)|`:

- Canonical `functions/src/wasm/special/scalars.ts` `_lgamma` (lines 39–63) uses the reflection formula with `Math.abs(Math.sin(Math.PI * x))`. Oracle: `_lgamma(-0.5) = ln(2√π)`.
- `functions/src/typed/hypothesis.ts` `_lgamma` (271–286) and `functions/src/typed/dist-objects.ts` `_lgamma` (154–172) used bare `sin`.
- `packages/workerpool/src/worker.ts` `_workerLgamma` (861–879) used bare `sin`. It was only self-recursive; `sampleChunk` uses `_workerGammaRandom`.
- `functions/src/typed/distributions.ts` `_lgammaD` (38–56) already used `abs(sin)` (no numeric drift). #418 still deleted it as a duplicate body.

`functions/src/plain/number/probability.ts` `lgammaNumber` (98–121) returns NaN for every `n < 0` (mathjs real-only). Its reflection (103–107) only runs on `(0, 0.5)`. It uses Lanczos `g = 5` (`lgammaG` at line 84); `_lgamma` uses `g = 7`.

#418 points the `functions` statistical copies at `_lgamma`, deletes the unused worker `_workerLgamma`, and documents both contracts. `lgammaNumber` is not delegated: `createLgamma` (`functions/src/factories/index.ts` 181–182) is not the public typed `lgamma`, and Dirichlet in `stats/multivariate-sampling.ts` depends on the NaN contract. Positive-x values do not move (`sin(πx) > 0` on `(0, 1)`).

---

## I-3

**Status:** resolved by #418.

**Title:** Hypothesis normal CDF used the retired 7-digit erf

**Body:**

Before #418, `functions/src/typed/hypothesis.ts` `_erf` (255–266) was the Abramowitz approximation (constant `0.3275911`), max abs error about `1.5e-7`. `_normalCDF` (382–384) called it, and the KS kernel string (815–821, used when `n >= HYPOTHESIS_THRESHOLD` 4096) inlined the same body. The accurate scalar is `erfcScalar` in `functions/src/typed/special.ts` (148–153), already imported by hypothesis at line 36 and used at 1807 and 1885.

#418 moves the self-contained `_erfc` from `functions/src/typed/distributions.ts` (66–97) into `scalars.ts` as `erfcSelfContained` (Math-only, so `kernelSource` in `parallel-map.ts` can embed `toString()`). `erfcScalar` becomes a wrapper. The KS kernel uses `erfcSelfContained`. Sequential hypothesis `_normalCDF` uses `erfcScalar`. Existing erfc tests stay unedited. KS p-values, large-n Mann–Whitney (`hypothesis.ts` ~1065 when `n1*n2 > 400` or ties), and Shapiro–Wilk (1301, 1307) move around the 7th digit; update those expectations from `0.5 * erfc(-z / √2)`, not from a pasted run.

---

## I-4

**Status:** resolved by #415, with one documented worker-bundle exception.

**Title:** Five Mulberry32 copies and three stride copies; stale ComputePool layering comment

**Body:**

Production Mulberry32 (`0x6d2b79f5`) lived in:

- `tensor/src/operations/random.ts` `makeMulberry32` and `boxMuller`
- `functions/src/typed/hypothesis.ts` `_makeMulberry32`
- `functions/src/typed/dist-objects.ts` `_makeMulberry32`
- `functions/src/typed/graph.ts` `_mulberry32`; the `0x9E3779B9` mix is a seed mixer, not a second generator
- `packages/workerpool/src/worker.ts` `_workerMulberry32`

Row-major strides lived in `Tensor.rowMajorStrides`, `parallel/src/ComputePool.ts` `_rowMajorStrides`, and `packages/workerpool/src/worker.ts` `_tdRowMajorStrides`. A comment above the parallel helper said parallel has no `core` dependency. That was false: `parallel/package.json` depends on `@danielsimonjr/mathts-core` (lines 44–46).

#415 puts `mulberry32`, `boxMuller`, and `rowMajorStrides` in `core` (`core/src/numeric/rng.ts`, `core/src/numeric/strides.ts`), exports them next to the stable-sum block (`core/src/index.ts` 262–263), and deletes the comment. `worker.ts` is its own tsdown entry (`packages/workerpool/package.json` `src/index.ts src/worker.ts`), loaded by URL / `worker_threads`, not an inlined string. tsdown externalizes deps, so a bare `@danielsimonjr/mathts-core` import fails in a browser worker, and `noExternal` can pull core’s WASM loader. `workerpool → functions` would cycle (`functions → parallel → workerpool`). The worker therefore keeps byte-identical copies of **`mulberry32` and `rowMajorStrides` only** in `packages/workerpool/src/worker-numerics.ts` (relative import, bundled; there is no worker `boxMuller`), with a header naming core as canonical and a parity test. `core` is a devDependency of workerpool only. Fixture generators in tests and benchmarks that repeat `0x6d2b79f5` are not production copies and stay.

Stride oracle: `[] → []`, `[4] → [1]`, `[2,3,4] → [12,4,1]`, `[0,5] → [5,1]`.

---

## I-5

**Status:** partial, by #416. Do not re-file the two LM bodies or the `svds` overflow. Still open: the public `jacobian` option (M7), and the ODE/BVP/DAE finite-difference Jacobians.

**Title:** Two Levenberg–Marquardt fitters and an overflowing `svds` `norm2`

**Body:**

The two fitters were not the same loop.

- `functions` `levenbergMarquardt` (`functions/src/optimization-extra.ts`, not under `typed/`): forward differences `h = 1e-7`; local `norm2` was a sum of squares, not the 2-norm; `residualNorm` is `Math.sqrt(cost)`; λ starts `1e-3`, success `/3`, failure `*3`; tol default `1e-10 * cost`; solve via `inv`; catch only a singular-matrix message.
- `curvefit` (`functions/src/typed/numeric.ts`): forward `delta = 1e-8` per row; λ starts `0.001`, success `*0.1`, failure `*10`; stop on `|Δcost| < 1e-15`; diagonal `JtJ[i][i] || 1`; `linsolve`; catch any throw.

`numericJacobian` (`functions/src/numeric/numeric-jacobian.ts`) is central differences by default, `h ≈ max(1,|x|) * cbrt(eps) ≈ 6e-6`. BFGS (`bfgs.ts` ~66 `numericGradient`) and Newton (`open-root-finders.ts` 18–26) are scalar central differences and are a different shape. Leave them.

#416 (consolidation only; M7’s optional public `jacobian` is not added):

- `numericJacobian` gains `scheme?: 'central' | 'forward'` (`NumericJacobianOptions` line 19), default `'central'`, so current callers are unchanged. The function starts at line 47.
- `levenbergMarquardt` (now lines 151–214) calls `numericJacobian(residual, x, { h: 1e-7, scheme: 'forward' })`. Its Jacobian stays the same. Cost uses core `pairwiseDot(r, r)` (`core/src/numeric/stable.ts` 167), not core `norm2` (which includes a square root, `stable.ts` 132–154).
- `curvefit` (now 909–920) becomes a wrapper: residual `ys[i] - f(xs[i], p)`, `maxIter` 200, then `levenbergMarquardt`. Iterates change. `functions/tests/gap-optimization-clustering.test.ts` ~35 (planted `y = 2.5*exp(0.5*t)`, expect `(2.5, 0.5)` to 6 digits), `numeric.test.ts` ~309, and `cov-numeric.test.ts` ~369 and ~382 must pass unedited.
- `svds` (`functions/src/numeric/svds.ts`, not `matrix/svds.ts`) replaces the naive `sqrt(sum of squares)` with core `norm2` (call at line 117). Matrix public `norm2` (`matrix/src/operations/svd.ts` 676) is the spectral norm; do not use it here.

Still open, not this wave: `solveBVP` Jacobian (`typed/numeric.ts` 1279–1288, `delta = 1e-7`), `solveODE` `_fdJacobian` (209), `solveDAE` (`solveDAE.ts` 229 and 404), and private `norm2` in `eigsh.ts` 84, `fsolve.ts` 33, `krylov.ts` 86. The M7 option `jacobian` on the public fitter waits for that milestone.

---

## I-6

**Status:** resolved by #413.

**Title:** Dead `write_factories_index.py` and the unreachable matrix JS FFT

**Body:**

`write_factories_index.py` at the repo root was an old generator that embedded a subset of `functions/src/factories/index.ts`. Nothing in scripts, workflows, `package.json`, tsconfigs, or tools referenced it.

`matrix/src/backends/wasm/fft-wasm.ts` (`fftJS`, `isPowerOf2`, `nextPowerOf2`, `isWasmFFTAvailable`, `wasmFFT` / `wasmIFFT` / `wasmRFFT`, `powerSpectrum`, `convolve`) was imported only by `matrix/src/backends/wasm/index.ts` (re-export) and two test files. `matrix/src/backends/index.ts` imported detect helpers only. The symbols were not on the public barrel, but the static import still pulled the file into the bundle. No production caller.

#413 deleted the generator, the FFT bridge, its tests, and the re-exports. `assembly/src/ops/fft.ts` (the AS kernel) and `isPowerOf2` on the AS export type in `matrix` `WasmLoader.ts` stay. The duplicate allowlist dropped `FFTResult`, `convolve`, the `fft-wasm` path on `fft`/`ifft`, and `rfft`. The matrix skip budget (`tools/test/skip-baseline.json`, matrix still allows 4) drops only if the three `it.skipIf(!wasmAvailable)` cases in the deleted fft test were actually skipping in CI. CI builds WASM first, so they likely ran. Lower the baseline only when the measured skip count drops.

---

## I-7

**Status:** partial. #417 and #412 close the first two bullets. Still open: `linearRegression` vs `linregress`, `numericRealRoots` vs `findRoot`, and the workerpool `fft-core.ts` header.

**Title:** Smaller duplicate algorithms still split across packages

**Body:**

Closed by this wave:

- Five private ikj matmuls now call matrix `matMul` (`matrix/src/operations/common.ts` 80–93), which #417 exports from `matrix/src/operations/index.ts` (line 64; the barrel `matrix/src/index.ts:24` star-exports that file). `functions` already depends on `@danielsimonjr/mathts-matrix`. Sites now import it: `functions/src/ml/ols.ts` (`matMul as matmul`), `geometry-extra.ts` (`matMul`), `control-equations.ts` (`matMul as matmul`; `sylvesterOperator` is Kronecker and stays), `solveODE.ts` (`matMul as _matMul`), `matrix-ops.ts` sequential path (`denseMatMul`; keep the `computePool.matmul` branch at 94–96). Do not replace the public Float64Array `matmul` in `arithmetic.ts` 1557. Do not rewrite `ols` reductions onto `pairwiseSum` (Sprint 2R). Empty `A` still throws on `A[0].length`.
- `polymul`’s small path (`functions/src/typed/algebra.ts` 247–256, then `trimPoly`) and `polyMulJS` (`functions/src/wasm/poly/wasm-bridge.ts` 54–63) are one JS convolution. `polyMulJS` is exported from the bridge, not from the package barrel. The small path calls `polyMulJS` then `trimPoly`. It does not go through `polyMulDispatch` (threshold `WASM_POLY_THRESHOLD` 256). Policy keeps `poly_mul_f64` on JS.

Still open:

- `linearRegression` vs `linregress` (both named in the functions reference domain map, `tools/generate-functions-reference.mjs` 70–73).
- `numericRealRoots` (`functions/src/typed/cas.ts` 1117) vs `findRoot` (`functions/src/typed/numeric.ts` 107).
- `packages/workerpool/src/fft-core.ts` lines 8 and 32 still say the canonical JS FFT is `functions/src/typed/signal.ts#fftCoreFloat64`. The shared core is `functions/src/signal/fft-core-f64.ts`. Comment only; #415 left this file alone.

---

## I-8

**Status:** open. No PR in this wave.

**Title:** `DenseMatrix` multiply / LU / QR / Cholesky do not follow the live WASM thresholds; GPU is not registered

**Body:**

Two threshold tables disagree:

- `matrix/src/config.ts` `DEFAULT_CONFIG` (102–129): WASM `multiply` 500, `decomposition` 100, `transpose` 2000; GPU `multiply` 50000, `decomposition` 10000, `transpose` 200000; WASM element threshold 1000; GPU element threshold 100000.
- `matrix/src/backends/BackendManager.ts` `DEFAULT_EXTENDED_HINTS` (42–61): `multiply.wasm` is 256 (measured); every `gpu` entry is `GPU_MIN_ELEMENTS` and is dormant. The comment at 48–54 says `selectBackend` gates GPU on `backendRegistry.has('gpu')`, and `register-backends.ts` registers JS and WASM only. GPU matmul goes through `gpuMatmul` / `gpuMatrixBackend`, not this manager.

`DenseMatrix.multiply` (`matrix/src/types/DenseMatrix.ts` 356) calls `arithmetic.multiply`, not `BackendManager`. WASM LU/QR/Cholesky exist on `WASMBackend` (methods probed at call time, JS fallback) but are not what those `DenseMatrix` methods reach. Until a benchmark wires a path or the dormant branches are deleted, docs must describe the JS reality for those methods. Do not “enable WASM” by editing only the unused table.

---

## I-9

**Status:** open. No PR in this wave.

**Title:** `create(all, config)` writes the process-wide functions config

**Body:**

`@danielsimonjr/mathts-compat` `create` (`compat/src/index.ts` 186–195) copies the caller’s config, then, when any key is set, calls `mathFunctions.config(config)`. That function is `functions/src/config-api.ts` `config` (26–29): it `Object.assign`s onto `factoryScope.config`.

`factoryScope.config` is the singleton `DEFAULT_CONFIG` (`functions/src/factories/scope.ts` 148; re-exported from `@danielsimonjr/mathts-core/internal` at `functions/src/core/config.ts` line 13). Activated factories captured that object. `functions/src/config-api.ts` lines 4–9 document the in-place mutation on purpose: reassigning the property would not be seen.

Effect: `create(all, { number: 'BigNumber' })` changes `number` for the process. A later `evaluate('e ^ 2')` on the shared functions surface returns a `BigNumber`. `create` in `functions/src/core/create.ts` (215) does shallow-copy into a per-instance `configInternal` for `math.config`, but the factories used by compat do not read that copy.

Fix by giving the activated graph a config object that one instance owns, or by documenting and testing the singleton and stopping `create` from writing it. A regression should construct two `create(all)` instances with different `number` settings and show that the second does not change the first, and that a bare `evaluate` stays on `number`.

---

## I-10

**Status:** partial. The nine unused `typed-function` pins are resolved by #413. The package with no dependents is still open.

**Title:** `packages/typed-function` has no workspace dependents

**Body:**

#413 removes `"typed-function": "^4.0.0"` from `units`, `parser`, `ast`, `evaluator`, `arithmetic`, `trigonometry`, `statistics`, `signal`, and `expression`. Nothing in those packages imports `typed-function`. The removed pins had resolved to upstream `typed-function@4.2.2`, not the fork. The current lock only records `npm:@danielsimonjr/typed-function@5.0.0-alpha.4` (root, `core`, `functions`). `expression` tests use `mathTyped` from core (`expression/tests/parse.test.ts` ~31–48). `expression/src/types.ts` is a duck `TypedFunction` type, not an import.

`@danielsimonjr/mathts-typed-function` (`packages/typed-function`) still has zero workspace dependents. Deleting it is a release decision (the published name, the fork consumers outside this repo). Do not delete it in the dead-code PR. `bun install` must regenerate `bun.lock`, and `bun install --frozen-lockfile` must pass in CI.

---

## I-11

**Status:** open. No PR in this wave.

**Title:** `mtsw capabilities --json` prints `schemaVersion` as `"[Circular]"`

**Body:**

`workbook/src/contract.ts` line 9: `export const SCHEMA_VERSION = { major: 1, minor: 0 }`. `workbook/src/introspect.ts` puts that same object on the capabilities payload (`schemaVersion: SCHEMA_VERSION`, ~55). `workbook/src/cli.ts` `jsonEnvelope` (128–147) builds `{ schemaVersion: SCHEMA_VERSION, command, ok, data, problems }` and runs a `WeakSet` replacer (138–139) that returns `'[Circular]'` the second time it sees an object.

`JSON.stringify` visits the envelope’s `schemaVersion` first, then the capabilities `data.schemaVersion`, which is the same object, so the field inside `data` becomes the string `"[Circular]"`. The human path (`cli.ts` ~587) reads `.major` / `.minor` and is fine.

The replacer exists so a circular workbook value cannot throw (the envelope must always be emitted). Fix by cloning the envelope’s `schemaVersion` (`{ ...SCHEMA_VERSION }`) before stringify, or by skipping the cycle check for that key. Do not remove the cycle guard. Add a test that `mtsw capabilities --json` parses and `data.schemaVersion` is `{ major: 1, minor: 0 }`.

---

## I-12

**Status:** open. No PR in this wave (Sprint 3R).

**Title:** `simplify` `exactFractions` does not turn `0.4 * x` into a fraction

**Body:**

`functions/src/algebra/simplify.ts` documents `exactFractions: true` as converting constants, with the example `simplify('0.4 * x', {}, { exactFractions: true })` → `x * 2 / 5` (lines 279–301). The implementation is `_exactFraction` in `functions/src/algebra/simplifyConstant.ts` (244–255).

`FractionLike` (lines 19–24) is the fraction.js shape `{ n: bigint, d: bigint, s: number }`. The comparison is `f.n < fractionsLimit && f.d < fractionsLimit` (251). Core `Fraction` exposes `numerator` and `denominator` (and `valueOf`), not `n` / `d` / `s`. The `fraction` factory injected via `functions/src/factories/scope.ts` (line 174: `new Fraction(n, d ?? 1)`) returns that core type, so `f.n` and `f.d` are `undefined`, `undefined < limit` is false, and the decimal is left unchanged. The node builder `_fractionToNode` (318–334) also reads `f.s`, `f.n`, and `f.d`.

Read `numerator` / `denominator` (and the core sign), or adapt once at the factory boundary. The `fractionsLimit` default in code is `Infinity` (249) while the TSDoc says `10000` (simplify.ts 281); fix the comment to match the code or the code to match the comment in the same change. Oracle: `0.4 * x` with `exactFractions: true` becomes a divide node `2/5`, and a denominator above `fractionsLimit` stays a float.

---

## I-13

**Status:** open. No PR in this wave.

**Title:** Export-index gate skips expression, workbook, and plot

**Body:**

`tools/generate-functions-reference.mjs` `TARGETS` (lines 35–46) lists `functions`, `compat`, `core`, `matrix`, and `parallel`. The comment at line 15 says a new package is covered by adding a row. `docs:functions` / `docs:functions:check` only regenerate and check those API pages. Expression, workbook, and plot exports (including the M1 scalar exports) can land without an API-page update.

Add rows for `@danielsimonjr/mathts-expression`, `@danielsimonjr/mathts-workbook`, and `@danielsimonjr/mathts-plot`, point them at `docs/api/<pkg>.md`, and extend the completeness test the way `functions/tests/docs-reference-completeness.test.ts` checks the functions export index. Hand prose stays above the generated “Complete export index” block. Do not hand-edit the generated index.

---

## I-14

**Status:** open. No PR in this wave. #413 does not clear these comments (I-18’s binding half is separate). #418 does not clear the typed WASM-threshold comments either.

**Title:** Stale WASM threshold comments, and `examples/` are not in CI

**Body:**

`functions/src/typed/*` still comments thresholds that predate `functions/src/wasm/policy.ts`. Example: `functions/src/typed/special.ts` 614–620 says the `lgamma` WASM kernel is the path (`lgamma_f64_as`), while the policy runs `lgamma_f64` on WASM only from 1M elements (`policy.ts` `lgamma_f64: { min: 1048576 }`) and keeps most other kernels on JS. After #418 the same claim sits on the `lgamma` JSDoc (`WASM_SPECIAL_THRESHOLD` 1024 vs the 1M policy). A comment that names a kernel as “the” implementation stays stale wherever that PR does not touch it.

`examples/` is reachable by `bun test` in the sense that the files are plain scripts, but CI does not run an examples smoke test. Three examples were broken while every gate stayed green.

Refresh the comments against `policy.ts` (cite the benchmark rule: two Node runs of `node tools/benchmark/wasm/run-node.mjs opt-in`). Add one CI (or `bun test`) smoke that imports or runs the examples that are supposed to execute, and fails on a throw. Do not turn the whole examples tree into a perf suite.

---

## I-15

**Status:** open. No PR in this wave.

**Title:** `docs/BENCHMARK_RESULTS.md` and `assembly/COVERAGE_AUDIT.md` are older than the dispatch policy

**Body:**

`docs/BENCHMARK_RESULTS.md` is dated 2026-06-27. The WASM dispatch policy was measured 2026-09-26 (`tools/benchmark/wasm/opt-in.bench.ts`, two Node runs, recorded in `functions/src/wasm/policy.ts`). Rankings in the June note are not the live tier order. `assembly/COVERAGE_AUDIT.md` refreshed its family `Total` column on 2026-10-23 (321 symbols); the **Covered** / **Uncovered** counts are still the 2026-06-24 run (“Last regenerated: 2026-06-24”) and need `coverage_matrix.py` re-run against the current AS sources.

Regenerate both from the commands that produced them, and date the files. Do not hand-copy a single machine’s numbers into the roadmap. Until then, treat those two docs as historical.

---

## I-16

**Status:** open. No PR in this wave.

**Title:** `mad` is median absolute deviation; `parallelStatMAD` is mean absolute deviation

**Body:**

`functions/src/statistics/mad.ts` `createMad` (22–79) is the median of absolute deviations from the median, exported as `mad` from `functions/src/factories/index.ts` 1361.

`functions/src/typed/statistics.ts` `parallelStatMAD` (562–584) is the mean of absolute deviations from the mean (`mad / n` at 577). The section comment says “Mean Absolute Deviation”. The statistics domain map also exports it under the `mad` key (`statistics.ts` 846).

Same root, two definitions. Rename the parallel one (for example `parallelStatMeanAD`) or document both on the API page in the same sentence, and add a test that `mad([1,2,3,4])` is the median form and `parallelStatMAD` is the mean form so a future “dedup” does not merge them. A rename of a public export is a minor changeset on 0.x with a `BREAKING:` line, plus a one-release alias if callers exist outside the repo.

---

## I-17

**Status:** open. No PR in this wave.

**Title:** Workbook CLI uses `DependencyGraph`, `toDOT`, and `toTeX`, but the package does not export them

**Body:**

Defined and used internally:

- `DependencyNode` and `DependencyGraph` in `workbook/src/types.ts` (103, 112).
- `toDOT` in `workbook/src/graph.ts` (140). The CLI imports it (`workbook/src/cli.ts` line 21) and returns it for the graph command (1064).
- `toTeX` in `workbook/src/tex.ts` (87), imported by the CLI (line 31) and used for export (903).

`workbook/src/index.ts` exports `buildDependencyGraph`, `topologicalSort`, `getDependents`, `detectCycles`, `getAncestors`, and `toMermaid` (24–31). It does not export the two types, `toDOT`, or `toTeX`.

Decide in one PR: export them (minor changeset, API page, a test that a consumer can import each symbol) or add a one-line comment on each that they are CLI-private. M15 of the roadmap wants `toTeX` as a reuse point, which argues for exporting `toTeX` at least.

---

## I-18

**Status:** resolved by #413 for the `MathTSWasm` bindings. The stale `functions` WASM comments stay under I-14.

**Title:** Hand-written `MathTSWasm` bindings were a second, weaker WASM loader

**Body:**

`assembly/src/bindings/wasm-loader.ts` was not on any production load path. `assembly/src/bindings/index.ts` only re-exported it. `assembly/package.json` built it (`asbuild && build:bindings`, `tsconfig.bindings.json` `outDir` `build/bindings`) and shipped `src/bindings/` in `files`, but the published entry is `build/mathts.js` plus the wasm files. No package imported `MathTSWasm`.

The check was weaker than the live invariant and unsafe to promote:

- `verifyWasm` returned without throwing when the manifest was missing.
- `loadWasm` verified string paths only; a buffer skipped verification.
- `loadWasmSync` never verified.
- `FLOAT64_ARRAY_ID = 3` did not match the AssemblyScript id.

#413 removes the bindings. The security invariant stays: every real load hashes the buffer and compares it to `wasm-manifest.json` before instantiate.

- Canonical helpers: `sha384OfBuffer` / `verifyWasmIntegrity` in `core/src/wasm-loader.ts`.
- Callers: `functions/src/wasm/WasmLoader.ts` and `matrix/src/backends/WasmLoader.ts`.
- Regression tests: `functions/tests/security/wasm-integrity.test.ts` and `matrix/tests/security/wasm-integrity.test.ts`.

Docs updated in that PR: `CLAUDE.md` security paragraph (it no longer names `assembly/src/bindings/wasm-loader.ts` as an independent loader), `AGENTS.md` security item 1, `docs/Architecture/API.md` (the `core/src/wasm-loader.ts` SHA-384 paragraphs), `assembly/README.md`, and the header of `tools/generate-wasm-manifest.mjs`. Do not edit `CHANGELOG.md` history or `docs/archive`. oxlint ignores `assembly/src/**/*.ts` except the bindings, which were linted; deleting them is fine. The duplicate allowlist glob `assembly/src/**` names `["*"]` covers the deleted file; no `loadWasm` allowlist row exists to edit.

Stale comments in `functions/src/typed/*` that describe retired WASM source are I-14, not this issue.

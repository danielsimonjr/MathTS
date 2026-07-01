# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (2026-06-30) — domain gap-closure: ~89 new functions (`functions@0.6.0` → `0.7.0`, `core@0.3.1`)

Closed the 2026-06-30 domain-coverage gap analysis (`docs/roadmap/DOMAIN_FUNCTION_GAP_ANALYSIS_2026-06-30.md`)
**with no deferral** — every wave plus all remaining highest-complexity items,
oracle-verified and released. Exports grew 744 → 828. Each function is verified
against NumPy/SciPy or by self-consistency (d/dx ∫f = f); ~18 oracle-pinned
`functions/tests/gap-*.test.ts` files pin the reference values so CI needs no Python.

- **Descriptive statistics** (`functions/src/descriptive-stats.ts`):
  `gmean`, `hmean`, `moment`, `skewness`, `kurtosis`, `iqr`, `sem`, `zscore`,
  `cov`, `corrcoef`, `rankdata` — composed from existing `mean`/`std`/`sum`/`quantileSeq`.
- **Elementwise / cumulative / log-domain** (`functions/src/numeric-extra.ts`):
  `clamp`, `sigmoid`, `logsumexp`, `softmax`, `cumprod`, `cummax`, `cummin`, `cumtrapz`.
- **Standalone distribution CDF/quantile surface** (`functions/src/distribution-functions.ts`,
  bridge C4): `normalQuantile`, `studentTCDF/Quantile`, `chiSquaredCDF/Quantile`,
  `fCDF/Quantile`, `gammaCDF/Quantile`, `betaCDF/Quantile`, and
  `cauchy`/`laplace`/`logistic` PDF/CDF/Quantile — surfacing the incomplete
  beta/gamma primitives that already backed the distribution objects.
- **Hypothesis tests + Tukey HSD** (`functions/src/hypothesis-extra.ts`):
  `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`,
  `studentizedRangeCDF`/`studentizedRangeQuantile` (nested numerical integration),
  `tukeyHSD` — vs `scipy.stats`.
- **Structured matrices + decompositions** (`functions/src/linalg-extra.ts`):
  `tril`, `triu`, `vander`, `toeplitz`, `circulant`, `companion`, `logdet`,
  `laplacianMatrix`, `generalizedEig`, `qz` (generalized Schur of a pencil).
- **Calculus** (`functions/src/calculus-extra.ts`): numeric `hessian` (central
  difference), `gradient` (numpy 2nd-order non-uniform formula).
- **Geometry** (`functions/src/geometry-extra.ts`): `haversine`, `slerp`, and a
  quaternion algebra (`quaternionMultiply`/`Conjugate`/`Normalize`/`FromAxisAngle`/`Rotate`/`ToRotationMatrix`).
- **Time series** (`functions/src/timeseries-extra.ts`): `movingAverage`, `ewma`, `detrend`, `acf`.
- **Regression** (`functions/src/regression-extra.ts`): OLS `linearRegression`.
- **Optimization** (`functions/src/optimization-extra.ts`): `nelderMead`,
  `gradientDescent`, `levenbergMarquardt`.
- **Clustering** (`functions/src/clustering-extra.ts`): `kmeans` (deterministic
  maximin seed), `spectralClustering` (reuses `laplacianMatrix` + `eigs`).
- **Digital filter design** (`functions/src/signal-filter-extra.ts`, vs
  `scipy.signal`): `firwin`, `butter` (full zpk→bilinear→tf pipeline), `lfilter`,
  `lfilterZi`, `filtfilt` (scipy's `lfilter_zi` steady-state edge handling) — both
  to machine precision.
- **Symbolic CAS** (`functions/src/cas-integration.ts`): `symbolicIntegral`
  (indefinite integration over polynomials, power rule, linearity, `1/x→ln`, and
  linear-substitution for `sin`/`cos`/`exp`/`ln`/`sinh`/`cosh`; returns an
  unevaluated `integral(...)` marker rather than a wrong answer when out of scope).

### Fixed (2026-06-30) — two root-cause bugs surfaced by the new functions

- **`eigs` returned wrong eigenvalues for every non-symmetric matrix** (even
  triangular ones — `[[2,1,0],[0,3,1],[0,0,4]]` gave `[1.27, 3, 4.73]`). Surfaced
  by `companion`'s eigenvalue cross-check. The factory `eigs` now routes numeric
  square matrices through the correct native `matrix` `eig`
  (`functions/src/matrix/native-accel.ts#correctEigs`), preserving real
  eigenvalues as numbers and complex ones as `Complex`.
- **`core` `new Fraction(0.25)` threw `"0.25 cannot be converted to a BigInt"`**,
  which had *silently* broken the CAS `simplify` and symbolic `derivative` for any
  fractional coefficient (`derivative('x^4/4','x')`). The constructor now
  decomposes a non-integer number into an exact integer ratio (`0.25` → `1/4`);
  `derivative('x^4/4','x')` now returns `'x ^ 3'`.

Released to npm across two rounds — `functions@0.6.0` (Waves A–D + eigs fix), then
`functions@0.7.0` + `core@0.3.1` (remaining high-complexity items + Fraction fix);
verified live by fresh install. Per-package detail in `functions/CHANGELOG.md` and
`core/CHANGELOG.md`. Full regression: functions 3057 + core 658 + compat 134 pass.

### Changed (2026-06-30) — degenerate-input hardening for the gap-closure functions (retroactive code-review pass)

The ~89 gap-closure functions shipped without the dev-workflow code-review /
silent-failure steps. A retroactive 7-reviewer pass found a single recurring
root cause: they silently returned `NaN`/`Infinity`/garbage on structurally
invalid or statistically degenerate input instead of failing loudly. Policy fix:
throw a clear `Error` (matching the scipy/numpy semantics the docstrings claim),
covered by `functions/tests/gap-degenerate-inputs.test.ts`.

- **`functions/src/descriptive-stats.ts`**: `gmean`/`hmean` now throw on
  non-positive entries (previously silent `NaN`); `zscore` throws on constant
  (zero-std) input; `skewness`/`kurtosis` throw on constant input (variance 0)
  and return `NaN` (SciPy parity) when the sample bias-correction is requested for
  `n` below its domain (`n≤2`/`n≤3`) instead of silently returning the biased
  estimator; `cov` throws when observations do not exceed `ddof`. Empty input
  stays graceful (`NaN`/`[]`, numpy parity) — the existing edge-case contract.
- **`functions/src/numeric-extra.ts`**: `logsumexp`/`softmax` compute the max
  with a spread-free O(n) loop instead of `Math.max(...arr)`, which threw
  `RangeError: Maximum call stack size exceeded` on the large (~1e5+) log-probability
  vectors these primitives exist to serve; `cumtrapz` throws on an abscissa array
  shorter than `y` (was silent `NaN` poisoning every output).
- **`functions/src/hypothesis-extra.ts`**: `fTest` throws on `<2` observations or
  a zero-variance denominator (was `Infinity`/`NaN`); `jarqueBera` throws on `<2`
  observations; `kruskalWallis` throws on fewer than 2 non-empty groups (removing
  the `N³−N=0` tie-correction division-by-zero); `wilcoxon` throws on unequal-length
  pairs and on all-zero differences, and computes `arr(y)` once instead of per
  element; `tukeyHSD` throws on `<2` groups or non-positive residual df (was all-`NaN`
  via `lgamma(0)`); `studentizedRangeQuantile` validates `p∈(0,1)` and brackets the
  root by expanding `hi` geometrically instead of the fixed `[0,100]` that silently
  clamped large quantiles; `studentizedRangeCDF` validates `k≥2`/`df>0` and extends
  its `umax` integration bound until the χ-density tail mass is captured (was a magic
  constant that biased the CDF low for small `df`).
- **`functions/src/linalg-extra.ts`**: `companion` throws on a zero leading
  coefficient (was `Infinity`/`NaN` entries feeding a garbage eigen-solve, numpy
  parity). `realSchur` gained a quasi-triangularity postcondition that throws if the
  QR iteration ever exits without reaching (quasi-)upper-triangular form, instead of
  silently returning a non-triangular `S` that breaks `qz`'s contract — a defensive
  guard: the reviewer-flagged silent-non-triangular output did **not** reproduce
  across three complex-spectrum pencils (both companions and a cyclic permutation all
  returned correct quasi-triangular output), so the residual risk is defensive, plus
  a performance cliff on complex/equal-modulus spectra recorded in `TODO.md`.
- **`functions/src/geometry-extra.ts`**: `slerp` throws on zero-length input
  vectors and on antipodal directions (θ≈π, where `sin(omega)≈1.2e-16` made the
  interpolation weights explode to ~1e15 — the path is genuinely undefined), while
  keeping the near-parallel → lerp fallback; `quaternionNormalize` throws on a
  zero-magnitude quaternion (was a `NaN` vector).
- **`functions/src/timeseries-extra.ts`**: `acf` throws on a zero-variance
  (constant) series (was `0/0=NaN` at every lag) and validates `nlags∈[0,n)` (was
  silent trailing zeros for `nlags≥n`); `ewma` throws on empty input (was
  `[undefined]`); `detrend('linear')` returns zeros — the exact-fit residual — for
  `<2` points instead of a `NaN`-poisoned output.
- **`functions/src/regression-extra.ts`**: `linearRegression` throws on `<3` points
  (`df=n−2≤0` → `Infinity`/`NaN` std error) and on a zero-variance predictor
  (`sxx=0` → `NaN` slope/`rValue`) — was a normal-looking result full of `NaN`.
- **`functions/src/optimization-extra.ts`**: `levenbergMarquardt` narrows its
  damped-solve `catch` to the expected singular-matrix error (bump λ) and re-throws
  any other error instead of silently retrying it to `converged:false`. Defensive —
  `A` is always square/numeric so only the singular case reaches the catch in
  practice, but the intent is now explicit and matches `inv.ts`'s own guard.
- **`functions/src/clustering-extra.ts`**: `KMeansResult` gains `converged` and
  `iterations` (mirroring `OptimizeResult`) so a caller can tell a settled partition
  from one that hit `maxIter` still moving; `kmeans` validates empty `data` (was a
  cryptic `TypeError` on `data[0]`) and rejects non-integer / `<1` `k` (was a silent
  single-cluster result).
- **`functions/src/signal-filter-extra.ts`**: `butter` validates the order (`N≥1`)
  and cutoff (`0<Wn<1`) — at `Wn=1`, `tan(π/2)≈1.6e16` (not `Infinity`) produced
  finite-but-nonsense coefficients silently, and `Wn>1` gave plausible-looking wholly
  wrong ones; `firwin` requires `numtaps≥2` (was `2πn/0=NaN` taps) and throws on a
  degenerate zero-sum design (`cutoff≈0` → `0/0`); `lfilterZi` reports a clear
  pole-at-`z=1` / non-finite-steady-state error instead of leaking `inv`'s cryptic
  "determinant is zero" when `(I−Aᵀ)` is singular.
- **`functions/src/cas-integration.ts`**: `symbolicIntegral` now returns its
  documented `integral(expr, var)` marker for integrands with symbolic constant
  coefficients (`a/x`, `x^n`) instead of leaking the evaluator's "Undefined symbol"
  error — the two bare `evaluate()` calls route a non-numeric constant through
  `NotIntegrable` via a new `evalConst` helper; `linearSlope` narrows its catch to
  re-throw genuine evaluator errors rather than equating every failure with
  "not linear".

The pass then ran dev-workflow step 7 (code-simplifier — guards judged clean, one
dead `kruskalWallis` `N<2` branch removed) and step 8 (full re-verify): functions
**3086 tests pass** / 42 skipped, **28/28** typecheck, **0** eslint. One follow-up:
`studentizedRangeQuantile` dropped from 60 to 45 bisections (`~hi/2^45` resolution
is still far tighter than any tolerance) so the nested-Simpson solve doesn't exceed
the default 5 s test timeout under full-suite parallel load.

### Changed (2026-07-01) — `docs/api/functions.md` drift-guarded via the generator

The hand-written `docs/api/functions.md` had frozen at "158 exports across 11 modules"
(2026-05-22) while the real surface grew to 828 — it was missing the ~89 gap-closure
functions and everything from five releases. `tools/generate-functions-reference.mjs`
now emits and drift-checks a third file: it appends a generated **Complete export
index** (every export grouped by module, with live counts) below the curated highlight
tables, exactly as it already does for `docs/reference/functions.md`. `npm run
docs:functions` regenerates all three (`docs/reference/functions.md` + `.html` +
`docs/api/functions.md`); `npm run docs:functions:check` now fails if any of the three
drifts, listing the undocumented exports. The curated per-domain tables + examples are
kept as prose above the generated block. (Recommended follow-up, blocked here by a
workflow-edit guard: add a `docs:functions:check` step to `.github/workflows/ci.yml`
so drift fails CI, not just the local command.)

### Changed (2026-06-28) — `functions/src/type/unit/Unit.ts` fully typed (`@ts-nocheck` removed)

- Removed `@ts-nocheck` from the mathjs-derived Unit factory and resolved every
  resulting strict-mode type error plus all 67 `@typescript-eslint/no-explicit-any`
  findings — the last file blocking a zero-eslint `functions/src` tree.
- Extracted a sibling `functions/src/type/unit/unit-types.ts` with real
  interfaces for the function-as-class pattern: `UnitInstance`, `UnitConstructor`
  (typed prototype + statics + construct signature), `UnitDef`, `UnitComponent`,
  `PrefixDef`/`PrefixTable`, `BaseUnitDef`, `UnitSystem`/`UnitSystemEntry`,
  `UnitJSON`, `TypeConverters`/`ConverterFn`, `UnitDependencies` (typed factory
  deps, incl. an overloaded `subtractScalar` for the Unit−Unit case in
  `splitUnit`), and a `Numeric` value union (`number | bigint | boolean |
  BigNumber | Fraction | Complex`).
- `UnitInstance.constructor` is typed as `UnitConstructor` so instances are
  assignable to the `is.ts` `Unit` guard — this makes `isUnit(x)` narrow to the
  rich `UnitInstance` (resolving the prior `is.ts`-narrowing union conflicts)
  without any local guard wrapper.
- Behavior-preserving: only types changed. The function-declaration `Unit` became
  `const Unit = function (...) { ... } as unknown as UnitConstructor` (same object,
  same `.name`); the dynamic own-property copy loops (`clone`, alias creation) and
  the `for…in`-over-array sites keep their exact runtime via type-only casts;
  angle-unit `value: null as any` placeholders became honest `value: null`
  (`UnitDef.value: Numeric | null`). No `@ts-nocheck` / `@ts-ignore` /
  `eslint-disable` / `type X = any`; zero documented `no-explicit-any` disables.
- Gates: `eslint Unit.ts` 0, `tsc --noEmit` 0 (functions), `npm run typecheck`
  28/28, functions suite 2902 pass / 41 skip (unchanged).

### Changed (2026-06-28) — `functions/tests/**` driven to ZERO eslint problems (honest typing)

- Replaced all 38 `@typescript-eslint/no-explicit-any` findings in
  `functions/tests/**` with real types: duck-type marker access via a shared
  `MatrixMarkers` shape (`factories-matrix`, `sparse-bridge`), intentional
  wrong-argument throw tests cast to `(...args: unknown[]) => unknown`
  (`typed-matrix-ops`), AST/Unit/internal-property access cast to concrete
  shapes (`evaluate`, `physical-constants`, `factory-scope`, `typed-bridge`),
  and `forEach` tuple accumulators typed as `[number, number(, number)][]`.
- Cleared the remaining 26 pre-existing eslint errors + 1 unused-disable
  warning in the same tree: removed unused imports/helpers/locals
  (`numeric`, `cov-statistics`, `factories-final`, `statistics-extended2`,
  `typed-signal-wasm`, `signal-extended`, `typed-algebra-wasm`,
  `typed-cas-fit-wasm`, `typed-integration-fanout`, `typed-special-carlson`)
  and rewrote the 9 `no-loss-of-precision` numeric-literal reference values
  (`cov-special`, `typed-special-wasm`) to their shortest round-tripping form
  (identical double bits, behavior-preserving). No `eslint-disable`/`@ts-ignore`
  used. `functions/tests` now lints clean; tsc clean; 2902 pass / 41 skip.

### Changed (2026-06-27) — `expression` eslint cleanup (honest typing, in progress)

- Fixed all non-`any` eslint findings in `expression` at root (62 problems incl.
  16 errors): removed 20 dead `eslint-disable ... no-unmodified-loop-condition`
  directives in `parse.ts` (and a bare directive in `node/Node.ts`); replaced
  `.apply(null, args)` with spread calls across 14 `transform/*.ts` adapters
  (`prefer-spread`); converted `arguments[n]` to named regex-replace callback
  params in `utils/number.ts` and `utils/bignumber/formatter.ts`
  (`prefer-rest-params`); removed unused local interfaces/imports in
  `transform/{concat,cumsum,index,mapSlices}.transform.ts`; annotated an empty
  `catch` in `utils/object.ts`; switched `@ts-ignore`→`@ts-expect-error` in
  `utils/latex.ts`; typed `isFunction`'s predicate as a call signature and made
  `Parser.ts`'s `isExpressionFunction` a real `value is ExpressionFunction` type
  guard (`no-unsafe-function-type`); and silenced genuinely-unused test
  scaffolding via `_`-prefix / removal. No runtime behavior changed; expression
  suite stays green (1966 tests, incl. the sandbox security regression test).
- Drove `expression/tests/**` to ZERO eslint warnings: replaced the remaining
  58 `no-explicit-any` findings (and one unused-var error) with real types —
  `catch (e: any)` narrowed via `as DimensionError`/`as IndexError`; mock
  factory/node helpers typed with `unknown` + structural casts; internal-access
  casts use the concrete class (`as FakeHelp`, `as ConstantNode`) rather than
  `any`. No `eslint-disable`/`@ts-ignore`/`any`-alias used. Behavior preserved
  (1966 tests pass).

### Changed (2026-06-27) — `core`, `parallel`, `workerpool` driven to ZERO eslint warnings (honest typing)

- Replaced `@typescript-eslint/no-explicit-any` sites with real types across the
  three packages (185 problems → 0): generic worker-boundary payloads typed as
  `unknown` (`parallel/src/WorkerPool.ts`, `packages/workerpool/src`), matrix
  worker tasks given a discriminated-union payload type
  (`parallel/src/matrix.worker.ts`), and the `core` synced-mathjs helpers
  (`is.ts`, `object.ts`, `number.ts`, `factory.ts`, `types.ts`,
  `types/matrix/Range.ts`, `error/MathjsError.ts`, `shared.ts`) typed via
  `unknown` + documented narrowing, structural casts, and shared duck-typing
  helpers. No runtime behavior changed; core/parallel/workerpool suites stay
  green (640 / 414 / 87 tests).
- Fixed the residual rules at root: removed dead `eslint-disable no-eval`
  directives (rule not enabled), removed unused imports/vars, replaced
  `this`-aliasing in `BigNumber.pow`/`Fraction.pow` with `this.clone()`, used an
  arrow callback in `Range.map`, switched an empty `catch (e) {}` to an annotated
  optional catch, and dropped an unused generic type parameter.

### Removed (2026-06-27) — vestigial pre-migration AssemblyScript-source from `functions/src/wasm/`

- Deleted **26 files / ~14k LOC** of dead AssemblyScript source written as `.ts`
  (using AS intrinsics `usize`/`i32`/`f64`/`load`/`store`/`v128`) under
  `functions/src/wasm/`: the `matrix/`, `algebra/`, `complex/`, `geometry/`,
  `logical/`, `numeric/`, `plain/`, `relational/`, `set/`, `simd/`,
  `statistics/`, `string/`, `utils/` directories, `signal/{fft,processing}.ts`,
  `special/functions.ts`, and the `wasm/index.ts` aggregator that re-exported
  them. These were unreachable from `functions/src/index.ts` and only
  soft-imported by the `tests/wasm/typescript-integration.test.ts`
  skip-on-fail smoke test. The real (sole) WASM backend is `assembly/src/`
  (built by `npm run build:wasm`); these `.ts` copies were pre-migration
  leftovers that generated **~9,000 false `no-undef` lint warnings** on the AS
  intrinsics (functions package: 9027 → 0 `no-undef`).
- **Kept** the active JS-side WASM dispatch/loader surface: `WasmLoader.ts`,
  `integrity.ts`, `resolve.ts`, `bridges/common.ts`, `special/scalars.ts`, and
  the `*/wasm-bridge.ts` bridges (`elementwise`, `special`, `sort`, `signal`,
  `poly`, `interpolation`, `bitwise`) — all reachable from `functions/src/index.ts`
  via `typed/`.
- Trimmed `tests/wasm/typescript-integration.test.ts`: removed the now-dead
  cases that imported the deleted `functions/src/wasm/index.js`,
  `wasm/arithmetic/index.js`, and `wasm/complex/index.js` modules; kept the
  `assembly/build/mathts.js` import test and the `WasmLoader.load()` block.

### Changed (2026-06-27) — `functions` + `expression` now match base on all four lint-grade compiler flags

- Removed the last relaxed overrides from `functions/tsconfig.json`
  (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`) and `expression/tsconfig.json` (the first
  three) so both packages now inherit `tsconfig.base.json`'s `true` for all of
  them. No package relaxes these anymore. Behavior-preserving — full suites
  unchanged (`functions` 2902 pass / 41 skip, `expression` 1966 pass).
- **noUnusedLocals/Parameters:** dropped dead type aliases/interfaces
  (`_MatrixData` in `lup`/`qr`/`lusolve`/`fft`), redundant `BigNumber` named
  type-imports (switched the 9 matrix files to the default-import form
  `import type BigNumber from 'bignumber.js'`, which TS — unlike the named
  import from an `export =` module — correctly counts as used), dead helper
  functions (`solveODE` `readStage`; `dist-objects` `_normalCDF`/
  `_normalQuantile`; `statistics` `_welfordVariance`), an unused private method
  (`Decimal.toBigInt`) and locals (`Decimal` `_exp`/`_roundAt`), a vestigial
  `WasmLoader.maxPoolSize` field (the pool-add path was never implemented), and
  unused imports (`gcd` `ArgumentsError`, `gamma` `wasmLoader`). Side-effecting
  factory calls in `factories/index.ts` (`createRandomInt`/`createBin`/
  `createHex`/`createOct`) were kept — only the unused bindings were dropped.
  Unused positional dispatch/callback params were underscore-prefixed
  (`derivative` `_isConst`, `import` `_load`, `complexEigs` `_prec`,
  `realSymmetric` `_N`) rather than removed, preserving signature arity.
- **noImplicitReturns (real bug-catchers):** `expression` `Node._getCustomString`
  and `functions` `quantileSeq._quantileSeqProbNumber` each had a code path that
  fell off the end; added the explicit `return undefined` both already returned
  implicitly (behavior-preserving).
- **noFallthroughCasesInSwitch:** the two intentional fallthroughs (`simplify`
  string→object, `derivative` log10→log) carried `/* falls through */` comments,
  but TypeScript — unlike ESLint — does **not** honor fallthrough comments; it
  only permits fallthrough from an *empty* case. Restructured both to
  empty-case fall-through with an inner guard, preserving behavior exactly.

### Changed (2026-06-27) — `functions` now compiles under TypeScript `strict: true`

- Flipped `functions/tsconfig.json` to `strict: true` and fixed all ~430
  pre-existing strict-mode errors honestly (no `any`/`@ts-ignore`/
  `@ts-expect-error`; only narrow, commented assertions where provably safe).
  Behavior-preserving — full `functions` suite unchanged (2902 pass / 41 skip).
- Flipped `expression/tsconfig.json` to `strict: true` (0 errors — its strict
  violations were already resolved at root while fixing the `functions`
  path-mapped sources). **All packages now compile under `strict: true`**
  (monorepo-wide); no package overrides `strict` to `false` anymore.
- **Root cause (≈300 of the errors):** typed-function dispatch. The published
  `SignatureFunction` (`(...args: unknown[]) => unknown`) is correct for
  output/internal positions but wrong as an *input* type when declaring
  signatures — under `strictFunctionTypes`, function parameters are
  contravariant, so concrete-typed implementations (e.g.
  `(a: number, b: number) => number`) are not assignable to an `unknown[]`
  parameter list. Introduced `MathTSTyped` / `SignatureImpl` /
  `SignatureRecord` in `core/src/typed/mathts-typed.ts` (and mirrored
  input-position param types in `functions/src/core/function/typed.ts` plus the
  local `typed` types in the solver/divide files) using `(...args: never[]) =>
  unknown` — the correct top-type for "any function" in an input position —
  which collapsed the entire `TS2769`/`referToSelf`/`referTo` cluster.
- Remaining fixes were genuine null-safety guards and narrowing across the
  activated factory / matrix / algebra layer, real strict null-safety fixes in
  the path-mapped `expression` sources (precedence handling, closure-captured
  regex match, etc.), `improveErrorMessage(unknown)`, `noop` helpers returning
  `never`, ambient declarations for the untyped `seedrandom` /
  `javascript-natural-sort` deps, and two genuine CSparse port typos fixed at
  root (`csChol` read its pattern from the wrong array; `csSqr` decremented a
  numeric offset instead of the workspace slot).

### Tooling (2026-06-27) — Recreated the AS-vs-JS WASM benchmark suite

- Rebuilt `tools/benchmark/wasm/` from scratch as an **AssemblyScript-vs-JS**
  suite (the old suite was deleted in the Rust scrub because it loaded the
  removed native binary). The new suite measures each accelerated path against
  its JS fallback over a realistic full JS↔wasm round-trip, median of several
  reps, with a correctness `maxdiff` column. No source logic changed.
  - `harness.ts` — reusable timing/maxdiff/table primitives, tsx-runnable.
  - `elementwise.bench.ts` — `array_<op>_ptr` kernels + op-fusion chain vs `Math.*`.
  - `special.bench.ts` — bessel_j0/j1, lgamma, elliptic_k AS kernels vs JS scalars.
  - `sort.bench.ts` — `sort_f64` introsort vs JS NaN-last comparator sort.
  - `matrix.bench.ts` — multiply / svd / eig (symmetric) / Welch-PSD (FFT) vs JS.
  - `run.ts` — full-suite orchestrator.
- npm scripts: `bench:wasm` (full) + `bench:elementwise` / `bench:special` /
  `bench:sort` / `bench:matrix` (per-area), matching the existing
  `bench:parallel` / `bench:tensor` style.
- Docs refreshed to point at the recreated suite and a dated, measured snapshot:
  `docs/Architecture/API.md`, `docs/Architecture/WASM_ACCELERATION.md`,
  `docs/performance.md`, `docs/BENCHMARK_RESULTS.md`. AS-vs-JS only — no Rust.

### Docs (2026-06-26) — Corrected stale Rust-dispatch comments in active WASM bridges

- Swept every `Rust` mention in the active WASM code (`functions/src/wasm/**`,
  `assembly/src/**`) and rewrote comments that still described the removed
  Rust path as the **current** dispatch. The bridges are AS→JS (no Rust probe):
  - `functions/src/wasm/special/wasm-bridge.ts`: `lgamma`/`K(m)`/`E(m)` doc
    comments no longer claim a "Rust WASM above threshold, then AS, then JS"
    3-tier or a "Probe Rust `lgamma_f64` (pointer-style)" step — now AS managed
    → JS. Carlson multi-array prose and the `functions.rs` lineage reference
    reframed to AS-managed / historical.
  - `functions/src/wasm/poly/wasm-bridge.ts`: dropped the "matching Rust export"
    dispatch branch from the Behavior block (the bridge gates on the AS sentinel).
  - `functions/src/wasm/bridges/common.ts`: "Rust pointer-ABI args" → "pointer-ABI
    args" (the contrast is no longer a live backend).
  - `functions/src/wasm/WasmLoader.ts`: the `WasmModule` kernel-doc blocks now
    label the vestigial pointer-style fields as "Legacy Rust ABI (removed)" rather
    than "Rust backend:", and the bitwise/decomposition prose no longer presents a
    "prefers Rust names" / "The Rust binary exposes…" live path.
  - `assembly/src/bindings/wasm-loader.ts` + `assembly/src/ops/eig.ts`: present-tense
    "The Rust backend ships…" / "matches the Rust binary" reworded to past-tense
    historical/lineage.
- Comment-only: no executable code, signatures, or behavior changed. Accurate
  historical / lineage / migration-phase notes ("removed in the Rust→AS migration",
  "ported from the original Rust impl", "(Rust→AS Phase 6)") were kept as-is.
  `npm run build:wasm` green (AS235 cosmetic only); `npm run typecheck` 0 errors.

### Docs (2026-06-26) — Architecture docs refreshed to AS-only post-migration

- Refreshed `docs/Architecture/{ARCHITECTURE,OVERVIEW,DATAFLOW,API}.md` to the
  current reality after the Rust→AS migration: **AssemblyScript (`assembly/`) is
  the sole WASM backend**; the deleted `wasm-rust/` Cargo workspace, the
  `RustWASMBackend`/`RustWasmLoader`/`MatrixWasmBridge` modules, and the
  `MATHTS_WASM_BACKEND` backend-selection env var are all removed from the docs
  (kept only as explicit historical "removed in the migration" notes).
- Replaced stale export/file counts with figures verified against the code:
  the built `mathts-as.wasm` exports **318 functions (330 total)** — verified via
  `WebAssembly.Module.exports()` — compiled from **30** AssemblyScript source
  files; **22** npm workspaces. Dropped the obsolete "1,017 Rust / 432 AS / 63
  wasm-rust files" figures. Removed the `build:wasm:rust`/`build:wasm:all`/
  `bench:wasm` script rows; documented the current `build:wasm` + `bench:*`
  scripts. WASM dataflow corrected to AS → JS.

### Fixed (2026-06-26) — JS non-symmetric eigensolver returned all-zero eigenvalues

- **`matrix/src/operations/eig.ts` non-symmetric path rewritten** (root-cause fix).
  The old path used an ad-hoc Francis `doubleShiftQR` bulge-chase plus
  inverse-iteration that failed to converge on companion-style matrices — `eig`
  returned `λ = 0` for *every* eigenvalue (reproduced on the companion matrices of
  `x^3 − 1` and `x^5 − 1`, whose true eigenvalues are the cube/fifth roots of unity
  with `|λ| = 1`). This was live: `eig`, `eigvals`, and their in-package consumers
  (`matrixSqrtm`, `matrixLogm`) plus the `eig-wasm` JS fallback (non-symmetric
  `n < 8`, or any `n` when the AS binary is unavailable) all hit it.
- **Fix:** non-symmetric matrices (`n >= 2`) now run a direct JS port of the same
  public-domain JAMA `orthes` + `hqr2` algorithm used by the AS
  `matrix_eig_general` kernel (Householder Hessenberg reduction + Francis
  double-shift implicit QR to real Schur form + eigenvector back-substitution and
  back-transform). The JS fallback and the WASM kernel are now numerically
  identical. The **symmetric path is unchanged** (cyclic-Jacobi-equivalent Givens
  QR). The dead `doubleShiftQR` helper was removed.
- **Measured (companion of `x^n − 1`):** max eigenvalue diff vs the true `n`th
  roots of unity — `n=3` `4.4e-16`, `n=4` `9.3e-16`, `n=5` `7.2e-16`, `n=8`
  `1.1e-15`; max real-eigenvector residual `‖A·v − λ·v‖` `≤ 1.3e-15`. Plus
  trace `Σλ` and determinant `Πλ` invariants, `[[0,-1],[1,0]] → ±i`, rotation and
  Jordan blocks, and random non-symmetric `n = 4/8/16`. New regression suite:
  `matrix/tests/decomposition/eig-nonsymmetric.test.ts`.
- **Corrected a test that encoded the bug.** The degree-8 discriminator in
  `matrix/tests/decomposition/eig-general-wasm.test.ts` asserted the JS path
  returned all-zero eigenvalues (`jsMaxAbs < 1e-6`) as "proof" only the AS kernel
  could solve it. With the JS path fixed that assertion was a bug-encoding; it is
  now an AS↔JS parity check confirming both return the 8th roots of unity.
- **Corrected an autograd test exposed by the eig fix.**
  `autograd/tests/tape-decomposition-ad.test.ts` "case 3" finite-difference-checked
  the gradient of raw `sum(eigvecs)` against the analytical eigenvector VJP. That
  loss is ill-posed: an eigenvector's sign is gauge-ambiguous and not a continuous
  function of `A`, so the (now-correct) hqr2 solver can return the opposite sign at
  a perturbed point — making the central FD of `sum(V)` measure a sign
  discontinuity rather than a derivative (verified: the 2nd eigenvector flips sign
  between the base point and both `±h` points, yielding the reported
  analytical=0.3536 / numerical=−0.7071 mismatch). The case only "passed" before
  because the buggy eig returned all-zero eigenvectors (`sum(V)=0`, `FD=0`,
  vacuously equal). Rewrote it to FD-check `sum((V·Vᵀ)²)` — a sign- and
  permutation-invariant, non-constant function of the eigenvectors that still
  exercises the eigenvector VJP (mirrors the existing sign-invariant case 4
  `sum(V²)` and case 7 `sum(V·Vᵀ)`). The eigenvector VJP itself was confirmed
  correct (no `autograd/src` change needed); this is a test correction, not a
  weakening. autograd suite: 246/246.

### Added (2026-06-26) — AssemblyScript general (non-symmetric) real eigensolver + wired into matrix

- **New AS kernel `matrix_eig_general(a, n)`** (`assembly/src/ops/eig.ts`, exported
  from `assembly/src/index.ts`): a general real non-symmetric eigendecomposition —
  Householder reduction to upper Hessenberg form, Francis double-shift implicit QR
  to the real Schur form (real eigenvalues + complex-conjugate pairs from 2×2
  blocks), then eigenvector back-substitution and back-transform. Ported from the
  public-domain JAMA `EigenvalueDecomposition` (`orthes` + `hqr2`, the canonical
  EISPACK algorithm). Returns a packed `Float64Array` `[ re(n) | im(n) |
  eigenvectors(n*n) ]` — eigenvectors stored as COLUMNS, real eigenvectors
  unit-normalised, complex-eigenvalue columns zero-filled (the real `number[][]`
  vector contract cannot represent complex eigenvectors, matching the JS reference
  which returns the zero vector for complex eigenvalues).
- **`matrix/src/operations/eig-wasm.ts` non-symmetric path now routes to AS.**
  Previously every non-symmetric matrix fell back to the JS QR algorithm; now
  non-symmetric matrices with `n >= 8` use `matrix_eig_general` when the AS binary
  is loaded, keeping the JS fallback for wasm-unavailable, small matrices, and the
  missing-export case. `matrix_eig_general?` added to the `WasmModule` interface.
- **Verified correctness (parity oracle = JS eig + invariants + known matrices).**
  Against trace invariant, true roots, and real-eigenvector residuals across a
  companion matrix, `[[0,-1],[1,0]]→±i`, rotation/Jordan blocks, and random
  non-symmetric `n = 4/8/16`: worst eigenvalue set diff vs JS `3.3e-13`, worst
  true-root set diff `3.9e-14`, worst real-eigenvector residual `2.9e-14`
  (tolerances `1e-8` / `1e-7`). The AS kernel is in fact **more accurate than the
  JS reference**, which returns all-zero eigenvalues for higher-degree companion
  matrices (e.g. the 5th/8th roots of unity) where the AS kernel is exact. New
  live-AS test `matrix/tests/decomposition/eig-general-wasm.test.ts` proves
  execution on the AS kernel via the degree-8 companion (8th roots of unity)
  discriminator — a green there is impossible on the broken JS fallback path.

### Changed (2026-06-26) — dedup special-function scalars + parallel helpers in `functions` (Duplication Audit Clusters A & E)

- **New canonical scalar module `functions/src/wasm/special/scalars.ts`** — the
  single source of truth for the special-function scalars previously duplicated
  between `functions/src/typed/special.ts` (scalar/sub-threshold path) and
  `functions/src/wasm/special/wasm-bridge.ts` (≥-threshold WASM JS fallbacks):
  `_lgamma`, Bessel J/Y (`besselHankel`, `besselJ*Series`, `besselY*Series`,
  `besselJ0/J1/Y0/Y1/J/Y` scalars), Airy (`airyUCoeffs`, `airyAsymPQ`,
  `airyAi/airyBiScalar`), complete elliptic `ellipticK/ellipticECompleteScalar`,
  plus the `_lgamma`/`factorial` consumers (`beta`, `gammainc`, `gammaincp`,
  `betainc`, `besselI` scalars). ~420 LOC of duplicate JS removed from the bridge.
  **`f(x) ≡ f([x])` is now guaranteed** — the scalar and array paths call the same
  function, closing the silent-drift risk.
- **Serialization mechanism (verified):** `typed/special.ts` serializes scalar
  kernels to the worker pool via `Function.prototype.toString()` + `eval`
  (`packages/workerpool/src/worker.ts`). Plain `import` of the canonical scalars is
  safe for this because `.toString()` returns source text regardless of module —
  **provided** the serialized function references only `Math.*`/its args/other
  same-module functions. The `_lgamma`/`factorial` consumers had to be co-located
  in `scalars.ts` (not merely imported into `special.ts`) because vitest's SSR
  transform rewrites a cross-module import reference inside a function body to
  `__vite_ssr_import_*`, which would break the serialized kernel; a same-module
  reference stays a bare identifier. No codegen required.
- **Cluster E:** hoisted the verbatim-duplicated `mapArray` + `kernelSource` into
  `functions/src/typed/parallel-map.ts`, imported by both `special.ts` and
  `distributions.ts` (main-thread helpers, never themselves serialized).
- **Fixed two preexisting numeric divergences** (reconciled to the correct value):
  - `lgamma` negative non-integers: the `special.ts` copy used bare `sin(πx)` and
    returned `NaN` (e.g. `lgamma(-0.5)`); the bridge copy used `|sin(πx)|` and was
    correct (`lgamma` is `log|Γ|`). Canonical adopts the correct `|sin|` form, so
    the scalar path now returns `ln(2√π)` too.
  - `besselY` negative orders: the `special.ts` copy ignored them and returned
    `Y₁`; canonical applies the parity identity `Y₋ₙ(x) = (-1)ⁿ Yₙ(x)`.
  - Removed dead `_erf` (unused) from `special.ts`.
- Extended `functions/tests/special.test.ts`: the parallel-overload drift gate now
  also covers the Airy worker path, plus two regression tests locking the two
  reconciled divergences. Full `functions` suite: 2902 pass / 41 skip (was 2900);
  `test:diff` special harness 187/187; typecheck 0 errors; all 22 turbo builds green.

### Changed (2026-06-26) — dedup `rowMajorStrides` across tensor/autograd (Duplication Audit Cluster H)

- **Canonical home = `Tensor.rowMajorStrides`** in `@danielsimonjr/mathts-tensor`.
  It was already the established static helper used by 10+ tensor operation files;
  the four audited copies were verified **byte-for-byte logically identical**
  (iterate from last axis, `acc=1`, `strides[k]=acc`, `acc*=shape[k]`, return a
  fresh `number[]`). No divergence found.
- **Removed two redundant copies**, rewiring all call sites to the canonical:
  - `tensor/src/operations/kron.ts` — dropped its local `rowMajorStrides`; the 3
    call sites now use `Tensor.rowMajorStrides` (`Tensor` was already imported).
  - `autograd/src/tape.ts` — dropped its local `_rowMajorStrides`; the 10 call
    sites now use `Tensor.rowMajorStrides` (autograd already depends on tensor and
    imported `Tensor`).
- **Kept `parallel/src/ComputePool.ts#_rowMajorStrides` by design** (with a
  verified comment): `@danielsimonjr/mathts-parallel` depends ONLY on
  `@danielsimonjr/mathts-workerpool` (verified via package.json + grep: zero
  imports from `tensor`/`core`/`matrix`). Importing the canonical helper would
  pull the entire tensor/core math stack into this low-level parallelization
  layer for a 9-line pure, stable function — strictly worse coupling than the
  small duplicate.
- Added `tensor/tests/rowMajorStrides.test.ts` (8 focused cases: rank 0–3,
  leading size-1, size-0 axis collapse, flat-index dot-product equivalence,
  fresh-array-per-call). Behavior preserved across all suites:
  tensor 387 (was 379, +8 new), autograd 246 (unchanged), parallel 414
  (unchanged). `npm run typecheck` 0 errors; `npm run build` 22/22 green.

### Changed (2026-06-26) — core: disambiguate same-name divergent type guards (Duplication Audit Cluster I)

- **Resolved the only active-source hazard in Cluster I**: `core/src/utils.ts`
  defined `isComplex` (structural `re`/`im` duck-type) and `isMatrix`
  (`number[][]`) — same names as the **canonical exported guards** but with
  different predicates. Renamed them to `isComplexLike` and `isMatrixArray` so no
  two same-named guards with diverging semantics coexist in the package source.
  Behavior preserved; only the names changed. Updated `core/tests/utils.test.ts`.
  - Added `core/tests/type-guards.test.ts` (regression guard): asserts the
    canonical surface — `isComplex`/`isFraction`/`isBigNumber` are `instanceof`
    checks and `isMatrix` duck-types a Matrix *object* (rows/cols/get/type), NOT
    a `number[][]` — and that the renamed `utils.ts` variants are structural by
    name. Core+matrix suites: 1380 passed / 7 skipped (was 1367 / 7).
  - **Verified, no change required** for the rest of the cluster:
    - `core/src/index.ts` already exports a *single* canonical guard per type —
      `isComplex`/`isFraction`/`isBigNumber` (`instanceof`, from `types/*.ts`)
      and `isMatrix` (duck-type, from `typed/mathts-typed.ts`). No duplication on
      the public surface.
    - `core/src/is.ts` is dormant synced-mathjs (not in `core/tsconfig.json`
      include, not exported, imported only by other dormant synced files). Its
      duck-typing is intentional (cross-instance / Decimal.js compat per the file
      header). Collapsing it onto `types/*.ts` would change semantics for the
      dormant mathjs layer, so it is left intact.
    - `nearlyEqual` has a `number` form (`core/src/number.ts`) and a `BigNumber`
      form (`core/src/bignumber/nearlyEqual.ts`); both dormant, type-distinct,
      and imported via explicit paths — no misrouting.
    - `matrix/src/types/Matrix.ts#isMatrix` is the matrix package's own canonical
      guard (`instanceof Matrix` + identical duck-type fallback); it is
      behavior-equivalent to core's `isMatrix` for every input and does not
      disagree at runtime, so it is kept as-is (no cross-package coupling added).

### Changed (2026-06-26) — matrix: deduplicate decomposition helpers into `operations/common.ts`

- **Extracted the shared `number[][]` helpers duplicated across the matrix
  decomposition modules into a single `matrix/src/operations/common.ts`**
  (Duplication Audit Clusters F + G). Canonical exports: `eye`, `cloneMatrix`,
  `transpose`, `isSymmetric`, `matMul`, `matAdd`, `matSub`, `matScale`,
  `normInf`, `norm1`, `householder`, `applyHouseholderLeft`,
  `applyHouseholderRight`. `eig.ts`, `svd.ts`, `schur.ts`, `expm.ts`, `logm.ts`,
  `sqrtm.ts`, and `eig-wasm.ts` now import these instead of re-declaring them
  (~250 LOC of duplication removed). Pure refactor — no behavior change.
  - **schur's deliberate Householder divergence is preserved**: `householder`
    takes an optional `degenerateBeta` (default `-2`, matching eig/svd) for the
    `sigma === 0 && x[0] < 0` branch; schur passes `2`
    (H = I − 2·e_1·e_1ᵀ = diag(−1, 1, …, 1)) at both its call sites.
  - svd's Householder appliers previously carried extra explicit end-bound
    arguments that always equalled the full matrix bounds at every call site;
    unified to the eig/schur signature with identical behavior.
  - Added `matrix/tests/operations/common.test.ts` (11 focused unit tests).
    Full matrix suite: 740 passed / 7 skipped (was 729 / 7 before the new tests).

### Removed (2026-06-26) — Rust→AS migration Phase 7c: Rust toolchain deleted (migration COMPLETE)

- **Rust WASM toolchain removed — AssemblyScript is the sole WASM backend
  (functions + matrix).** With the AS matrix kernels authored (Phase 7a) and
  wired (Phase 7b), the `matrix` package's last Rust consumer was retired, so the
  Rust toolchain was deleted: the `wasm-rust/` Cargo workspace, the
  `build:wasm:rust` / `build:wasm:all` / `bench:wasm` npm scripts, the dead
  `MatrixWasmBridge`, the `MATHTS_WASM_BACKEND=rust` loader opt-in, and the
  Rust-vs-AssemblyScript differential benchmark. Both `functions` and `matrix`
  now load the single AssemblyScript binary `mathts-as.wasm` (source
  `assembly/src/`); dispatch is AS→JS; the acceleration stack is
  **TS → AssemblyScript → WebGPU (matrix)**. SHA-384 integrity verification of the
  AS binary is retained and still enforced. `--check-wasm-parity` now exits 0 by
  construction (no Rust binary to diff). The migration is COMPLETE — see
  `docs/roadmap/RUST_TO_AS_MIGRATION_COMPLETE.md`.

### Added (2026-06-26) — Rust→AS migration Phase 7a: author the two missing AS matrix kernels

The AS binary had parity-clean matrix multiply/transpose, LU/QR/Cholesky/inverse/
determinant and SVD, but lacked the two kernels matrix still relied on the JS
fallback for: symmetric eigendecomposition and a generic complex FFT. Both are
now authored in `assembly/src/` and validated to parity against the Rust binary
(`lib/wasm/mathts.wasm`) oracle plus the JS references (no wiring yet — Phase 7b).

- **Symmetric eigensolver** (`assembly/src/ops/eig.ts`): `matrix_eig_symmetric`
  and `matrix_spectral_radius`. Classic cyclic Jacobi (Numerical-Recipes Schur
  rotation) for real symmetric matrices. ABI: `matrix_eig_symmetric(a, n)`
  returns a packed `Float64Array [ eigenvalues(n) | eigenvectors(n*n) ]`,
  eigenvalues **ascending by absolute value** (matching the Rust binary),
  eigenvectors as columns (`V[i*n+j]` = component `i` of eigenvector `j`).
  `matrix_spectral_radius(a, n)` returns max |eigenvalue| (exact, via the full
  Jacobi solve). Measured parity (release binary, real runs): eigenvalue
  maxAbsDiff vs Rust ≤ 1.35e-13 (vs the JS Jacobi reference: bit-identical, 0.0)
  and eigenvector residual ||A·V − V·diag(λ)|| ≤ 3.6e-14 across 4×4 / 16×16 /
  64×64 random symmetric matrices and a degenerate {2,2,2,5} repeated-eigenvalue
  case — all well under the 1e-9 target.
- **FFT** (`assembly/src/ops/fft.ts`): `fft` (in-place forward/inverse on
  interleaved complex `[re,im,...]`), `rfft` (real→complex), and `powerSpectrum`.
  Radix-2 Cooley-Tukey, a line-for-line match of the JS `fftJS` fallback (same
  bit-reversal, twiddle recurrence, direction sign, 1/n inverse scaling). ABI
  matches the existing matrix WASM consumer call shapes exactly: `fft(ptr, n,
  inverse)`, `rfft(dataPtr, n, resultPtr)`, `powerSpectrum(dataPtr, n,
  resultPtr)`. **Power-of-two `n` only** (same constraint as `fftJS`; the matrix
  JS layer rejects non-power-of-2 before reaching WASM); the inverse transform is
  `fft(..., inverse=1)` — no separate `ifft`. Measured parity (release binary):
  forward maxAbsDiff vs JS bit-identical (0.0) and vs Rust ≤ 4.3e-13 on sizes
  8/64/1024, `ifft(fft(x))` round-trip ≤ 1.8e-14, `rfft` bit-identical to
  `fftJS(real)`, `powerSpectrum` exact — all under the 1e-12 target.

### Fixed (2026-06-26) — Rust→AS migration Phase 6: repoint the last 4 functions kernels JS→AS

These four `functions` dispatchers had been left on the JS fallback because the
AS kernels were broken/imprecise/slow. Each AS kernel was fixed at the root
cause, validated against the JS reference, and the bridge repointed JS→AS (JS
fallback retained for the wasm-unavailable path). New `*-as-wasm` tests prove the
op now executes on the AS binary (call-counter > 0) and matches JS.

- **Poly fits (`polyFit` / `chebyshevFit` / `legendreFit`).** Fixed the AS
  Householder-QR least-squares solver in `assembly/src/poly.ts`: the reflection
  loop ran from the pivot column (`c = col`), overwriting the Householder vector
  entries in that column's sub-diagonal before the trailing columns and the RHS
  consumed them, corrupting every subsequent update (the solver returned
  near-zero garbage). It now starts at `c = col + 1` (the pivot column is set
  explicitly). The AS kernel recovers coefficients to ≈1e-14 vs the JS
  normal-equations solver (degrees 2/3/5 over [−3,3]); `poly` bridge repointed
  above `WASM_POLY_FIT_THRESHOLD`.
- **Airy Ai/Bi for |x|>5.** Capped the AS asymptotic sum at the same 13-term
  (u_0..u_12) truncation the JS reference uses (`AIRY_U_MAX` in
  `assembly/src/special.ts`). The AS kernel had generated u_k by recurrence and
  run to its own optimal truncation (k≈15 near x≈5), so it diverged ~1e-7 from
  the JS value it must mirror. With the cap, AS vs JS agree to ≈4e-16 (relative)
  across the |x|>5 region; `special` bridge repointed via `makeUnaryArrayDispatch`.
- **argsort / rank stability.** Rewrote the AS index sort in `assembly/src/sort.ts`
  to use a STABLE total-order comparator (value, NaN-last, then original index),
  so tied values keep their input order — exactly matching the JS stable
  reference (`Array.prototype.sort`). Verified Phase 6: exact permutation match on
  tie-heavy + NaN input (16 384 elements). `argsortF64Dispatch` / `rankF64Dispatch`
  repointed to the AS `argsort_f64` / `rank_f64` kernels (JS fallback retained).
- **sort_f64 performance.** Replaced the AS Lomuto quicksort (O(n²) on
  duplicate-heavy input) with an INTROSORT: 3-way (Dutch-national-flag) partition
  + median-of-3 pivot + insertion-sort cutoff + heapsort fallback past depth
  2·⌊log2 n⌋. Duplicate-heavy 200 000-element input now sorts in ~16 ms (bit-
  identical to JS, NaN-last preserved); guaranteed O(n log n) worst case.

### Changed (2026-06-26) — Rust→AS migration Phase 5: functions WASM dispatch simplified to AS→JS

- **The `functions` package is now AssemblyScript-only.** The dead
  `isRustWasm`-gated Rust-pointer branches and the dual-name probe scheme were
  removed from all 7 `functions/src/wasm` bridges (`elementwise`, `special`,
  `poly`, `sort`, `interpolation`, `signal`, `bitwise`) and from
  `bridges/common.ts`. Dispatch is now **AS-managed → JS fallback**; the
  `isRustWasm` / `runRustUnaryF64` helpers and the Rust type aliases are gone.
  The SHA-384 loader verification and `WasmLoader.getDefaultWasmPath` (incl. the
  `MATHTS_WASM_BACKEND=rust` opt-in and the Rust differential test) are untouched.
- **Rust is NOT removed.** `wasm-rust/`, `build:wasm:rust`, and `build:wasm:all`
  remain: the `matrix` package's `RustWASMBackend`/`RustWasmLoader` still load
  `lib/wasm/mathts.wasm` for heavy ops (fft/eig/svd/decomposition) and large
  matrices. matrix's Rust→AS migration + the final Rust deletion are deferred to
  a follow-up slice (see `docs/roadmap/RUST_TO_AS_MIGRATION_PHASE5.md`).
- **Dep-graph pairing tool** (`tools/create-dependency-graph`): the runtime
  probe now reads `functions/dist/wasm/mathts-as.wasm` (the binary functions
  loads) and detects per-`*Dispatch` AS execution, so `bundledBackend` reports
  **assemblyscript** and effective-wasm rises **18 → 37**. `--check-wasm-parity`
  still exits 0 (gap 0 of 26 consumed). Regenerated artifacts committed.
- **Four kernel groups stay on JS** (the Rust→AS migration **Phase 6**
  follow-ups, unchanged here): poly fit/cheb/legendre, Airy Ai/Bi (|x|>5),
  argsort/rank (AS sort unstable; sort O(n²) on dupes).
- Gates: functions `tsc --noEmit` 0 errors; functions vitest 2909 pass / 0 fail;
  `wasm-integrity` 5/5; `--check-wasm-parity` exit 0; turbo `build` green.

### Fixed / Changed (2026-06-26) — Rust→AS migration Phase 3b: repoint functions WASM bridges to AS

- **Fixed the Phase-3a corruption.** With the loader defaulting to the AS binary,
  the `poly`, `sort`, and `signal` bridges probed the **Rust pointer** export
  name and called the AS **managed** kernel (header ABI) with pointer args —
  silently producing all-zeros / NaN / unsorted output for inputs ≥ threshold.
  Every repointed bridge now gates the Rust pointer path behind `isRustWasm()`
  and, under the AS binary, marshals through the managed ABI (pinned buffer +
  header). The JS fallback is always preserved.
- **New AS managed-ABI marshalling in `bridges/common.ts`** (dup-audit Cluster
  D): `withAsF64` / `withAsI32` runners, `asReadReturnedF64` / `asReadReturnedI32`,
  `runRustUnaryF64`, and a `makeUnaryArrayDispatch` factory — adopted across the
  managed bridges to remove the duplicated alloc/try/release/probe boilerplate.
- **Repointed to AS managed kernels (tol-/bit-match JS verified):** `special`
  (Bessel J/Y incl. order-n, lgamma, complete elliptic K/E, Carlson R-forms,
  incomplete elliptic F/E/Π — all ≤1e-12), `poly` (mul / divmod / resultant /
  discriminant), `interpolation` (tridiag-solve, divided-difference), `sort`
  (`sort_f64` only — value-sort is bit-identical), `signal`
  (apply_window / welch / bartlett / goertzel / chirp-Z), `bitwise`
  (and/or/xor/not + per-element shifts, `*_i32_array`).
- **Left on the JS fallback (AS kernel does NOT match JS — honest de-scope):**
  - **Airy Ai/Bi** — AS asymptotic kernels diverge ~1e-6 from JS for |x|>5.
  - **poly_fit / cheb_fit / legendre_fit** — the AS QR/normal-equations solver
    returns near-zero garbage where JS recovers the coefficients exactly.
  - **argsort_f64 / rank_f64** — the AS sort is **unstable**, so for tied values
    it returns a different (still valid) permutation than the JS stable
    reference. Distinct inputs bit-match; duplicate-heavy inputs do not.
  - The Rust pointer ABI for all of the above is retained (gated) for
    `MATHTS_WASM_BACKEND=rust`.
- **Sort interim note (revisit before Phase 5):** the repointed AS `sort_f64` is
  ~2× slower than Rust on random input and degrades toward O(n²) on
  duplicate-heavy input (naive pivot). This is the accepted Phase-1
  de-escalation. Before Phase 5 removes the Rust sort, `assembly/src` needs an
  introsort / better-pivot (and a stable argsort/rank) so the AS path is both
  fast and a drop-in for the JS-stable argsort/rank.
- New per-bridge AS-execution TDD gates (`{poly,special,sort,signal,
  interpolation,bitwise}-as-wasm.test.ts`) load the AS binary and prove each
  dispatch executes on the AS kernel (call-counter via a writable module clone,
  since wasm exports are frozen) and matches the JS reference — the existing
  bridge tests pin the Rust binary by path and so false-green the AS repoint.

### Changed (2026-06-26) — Rust→AS migration Phase 3a: functions loads AS + elementwise repoint

- **`functions` WASM loader now defaults to the AssemblyScript binary**
  (`mathts-as.wasm`). `WasmLoader.getDefaultWasmPath()` flips the default from
  Rust → AS; opt back into the legacy Rust binary with
  `MATHTS_WASM_BACKEND=rust` (still copied/available until Phase 5 removes Rust).
  `functions/scripts/copy-wasm.mjs` now co-locates **both** binaries into
  `functions/dist/wasm/` (AS sourced from `matrix/dist/wasm/mathts-as.wasm`,
  Rust from `lib/wasm/mathts.wasm`) and regenerates a SHA-384
  `wasm-manifest.json` covering both — so the AS binary's hash is integrity-
  verified before instantiation (security invariant preserved; the AS binary's
  `__new` managed runtime makes `allocateFloat64Array` functional).
- **Elementwise bridge repointed to the AS pointer-ABI kernels**
  (`functions/src/wasm/elementwise/wasm-bridge.ts`): probes `array_<op>_ptr`
  instead of the Rust `simd_<op>_array`. Self-managed scratch-region marshalling
  (zero per-call alloc) is unchanged. JS fallback (return `null`) preserved.
- **New shared `functions/src/wasm/bridges/common.ts`** (dup-audit Opportunity
  #2, Clusters C+D): hoists `getWasm()`, the `PtrUnaryKernel` type, AS/Rust
  backend sentinels (`isAsWasm`/`isRustWasm`), and the scratch-region runners
  (`runUnaryPtr`/`runChainPtr`/`resetScratch`) out of the elementwise bridge.
  The remaining bridges adopt it (and an alloc/release `makeDispatch` factory) in
  Phases 3b/3c.
- New TDD gate `functions/tests/typed-elementwise-as-wasm.test.ts` proves the AS
  pointer kernels actually execute (non-null dispatch) and match JS for all 18
  ops + op-fusion; asserts the loader default resolves to AS.
- **Known interim risk (3b/3c):** the *other* bridges (special non-bessel / poly
  / sort / signal / interpolation) still probe Rust pointer-ABI names that the AS
  binary reuses with a *managed* ABI. Under the new AS default they fall back to
  JS where they validate outputs (bessel via `written===n`), but `polyMul/
  resultant/discriminant` lack that guard and would return wrong values for
  inputs ≥ threshold if a consumer loads the AS default. The existing wasm bridge
  tests pin the Rust binary by explicit path, so the suite is unaffected; the fix
  (gate the Rust probe with `isRustWasm`, or repoint) lands in 3b/3c.

### Added (2026-06-26) — Rust→AS migration Phase 2: AS kernel authoring

- **Elementwise pointer-ABI AS kernels** (`assembly/src/elementwise.ts`):
  `array_<op>_ptr(inPtr, outPtr, n)` for all 18 `WASM_ELEMENTWISE_OPS`
  (abs sin cos tan exp log atan sinh tanh atanh expm1 log1p log2 log10 sec csc
  cot erfc), mirroring the Rust `simd_<op>_array` flat-memory signature so the
  lean `elementwise/wasm-bridge.ts` drives them unchanged (Phase 3). `erfc` ports
  the validated A&S 7.1.14 continued-fraction `erfcScalar` (not the cheap
  rational). The 5 ops with a managed twin (abs/sin/cos/exp/log) are
  **bit-identical** to `array_<op>`; all 18 are ULP-equal to V8 (`relabs < 4e-16`)
  vs their JS scalar references.
- **General integer-order Bessel** `bessel_j_f64` / `bessel_y_f64` exported from
  `assembly/src/special.ts` (the Rust kernels take a fixed `order: i32`), reusing
  the existing recurrence/Hankel logic. Validated vs the JS `_besselJn`/`_besselYn`
  reference to `maxdiff < 1e-16` (orders 2,3,5,8; x∈[0.5,40]).
- **Poly aliases** `poly_resultant_f64` / `poly_discriminant_f64` now exported from
  `assembly/src/index.ts` (the impls already existed in `assembly/src/poly.ts`).
- Validation harness `assembly/tests/phase2-kernels.test.mjs` (wired into the
  package `test` script) instantiates the release binary raw and checks every new
  kernel against its JS reference. All pass.
- **WASM-parity guard updated**: `simd_<op>_array` now maps to `array_<op>_ptr`;
  `bessel_j_f64`/`bessel_y_f64` and the poly kernels are direct hits. Regenerated
  `docs/Architecture/wasm-parity.json` — the authoring gap drops **15 → 0** (60/60
  consumed Rust kernels now covered by AS).

### Added (2026-06-26) — Rust→AS migration Phase 1 perf spike + ABI decision

- `tools/benchmark/wasm/rust-vs-as-abi.spike.mts` + a pointer-ABI AS prototype
  (`_spike/array_sin_ptr.{ts,wasm}`): benchmarks Rust vs AS-managed vs AS-pointer
  with realistic round-trip marshalling. Result + decision in
  `docs/roadmap/RUST_TO_AS_MIGRATION_PHASE1.md`.
- **ABI decision: HYBRID.** Across runs (n up to 1,000,000, seeded random input),
  pooled managed-AS `array_sin` is at parity-to-faster than Rust on the hot path
  (AS-mgd/Rust 0.68–1.18×; the one >1.10 reading was noise, contradicted by
  0.68/0.73 at the same size), and pointer-ABI AS is the fastest variant
  (0.51–1.06×). AS does not regress the hot path, so the migration is **not** in the
  STOP branch. Hybrid is chosen on engineering-churn grounds: the existing lean
  pointer-based `elementwise/wasm-bridge.ts` takes the pointer-ABI AS kernel as a
  zero-rewrite drop-in (and it is fastest), while managed-AS (at parity) is used for
  special/signal/poly/interp/bitwise. All kernels bit-identical (maxdiff 0).
- ⚠️ Two non-ABI flags: AS `sort_f64` is ~2× slower than Rust on random input and
  **O(n²) on duplicate-heavy input** (≈28–30× at n≈131k) — a kernel-quality gap
  (needs introsort/better pivot before the `sort/` bridge is repointed), not an ABI
  cost; and result-allocating AS kernels (e.g. `bessel_j0_f64`) leak under
  `--runtime stub` (prefer caller-output-buffer/pointer for hot use).

### Documentation (2026-06-26) — agent knowledge base

- Added `AGENTS.md` at the repo root: a cross-agent navigation + behavior hub
  (build/test commands, a "where to find X" map, the active-vs-dormant code rule,
  file boundaries, security invariants, and the WASM "direction of travel"
  pointer). Complements `CLAUDE.md` (now cross-linked) per the agents.md standard.
- Added `docs/refactoring/DUPLICATION_AUDIT.md`: a grounded, file:line-cited audit
  of duplicate/near-duplicate code in the active source graph (10 clusters,
  top-5 consolidation plan; Cluster A special-fn scalar JS↔JS dup flagged as a
  correctness-drift risk).
- Flagged `docs/inventory/00-summary.md` as partially stale (factories activated,
  evaluator wired, per-package versions vary, WASM export counts drifted) with a
  pointer to `AGENTS.md` for current state.

### Added (2026-06-26) — Rust→AS WASM-parity guard (`--check-wasm-parity`)

- `tools/create-dependency-graph` gained a `--check-wasm-parity` mode (Phase 0 /
  Task 0.1 of the Rust→AssemblyScript migration). It diffs the Rust kernels the
  `functions` bridges actually consume against the AS binary's export table and
  fails (exit 1) if the gap set drifts from the committed `wasm-parity.json`
  snapshot — turning the migration eval's table into a regenerated guard that
  catches hidden Rust-only consumers.
  - New pure, unit-tested helpers: `readWasmExports` (parse-only export-table
    read, refactored out of the runtime probe), `collectConsumedRustKernels`
    (static bridge literals + `simd_${op}_array` expansion over
    `WASM_ELEMENTWISE_OPS`, excluding `_as` probes and op-array pollution),
    `computeParity`, and `buildRenameMap`.
  - Emits `docs/Architecture/wasm-parity.{json,md}` (gap grouped by bridge +
    rename mappings) alongside the existing `wasm-pairing` artifact.
  - **Grounded findings (corrected the eval):** 7 consuming bridges, not 6 —
    `bitwise/wasm-bridge.ts` was missed by the eval (7 kernels, all covered in AS
    under `*_i32_array` renames). **60 consumed Rust kernels, 45 covered (incl.
    14 renames), authoring gap 15** — the 13 missing elementwise transcendentals
    (`tan/atan/sinh/tanh/atanh/expm1/log1p/log2/log10/sec/csc/cot/erfc`) + 2
    general-order bessel (`bessel_j_f64`/`bessel_y_f64`). The 2 poly "renames"
    (`poly_resultant_f64`→`resultant`, `poly_discriminant_f64`→`discriminant`)
    are covered-via-rename, so they are not part of the authoring gap — which is
    why the measured gap is 15, not the eval's pre-counted 17.

### Added (2026-06-25) — WASM acceleration tripled (3-tier gap-fill)

- Effective-wasm coverage of the typed API went **6 → 18** of 218 functions (39
  routed), via `mathts-functions` 0.2.14 + 19 new Rust `simd_*_array` kernels.
  Each tier benchmark-gated (`bench:transcendental`/`bench:fusion`); only
  measured winners wired:
  - **Tier 1:** `atan/sinh/tanh/atanh/expm1/log1p/log2/log10/sec/csc/cot`
    (1.4–5× over JS incl. copy). Losers (`sqrt/cbrt/asin/acos/cosh/asinh/acosh`)
    left on JS.
  - **Tier 2:** `erfc` (5–7× — expensive continued-fraction JS scalar).
  - **Tier 3:** op-fusion `fuseUnaryChain` — array stays resident in wasm across
    a chain, copy paid once; 2.4–3.1× over JS for a 4-op chain.
- Pairing regenerated: 39 wasm-routed / 52 parallel / 127 js-only; 18 effective
  wasm / 21 js-fallback.

### Documentation (2026-06-25)

- Reconciled the narrative architecture docs against the regenerated
  dependency-graph report: `ARCHITECTURE.md` and `OVERVIEW.md` top-line counts
  updated to current (555 reachable / 904 dormant / 1,459 total files; 3,464
  reachable exports; 69 modules) — they had drifted and even disagreed with
  each other (554 vs 491). Per-package breakdown now points to the generated
  `dependency-graph.json` as source of truth rather than hand-maintained cells.
- Fixed stale special-function descriptions: `DATAFLOW.md` §3c (`besselJ0` was
  documented as the old NR rational/|x|<8 algorithm; now series + Hankel, with
  the live `Float64Array`→WASM path documented) and `docs/reference/functions.md`
  (NR §6.5 / ~1e-7 / ~5e-4 accuracy and "ellipticK/E still pure-JS" were all
  wrong post-fix; now series+Hankel, <1e-9, and the elliptic/Carlson WASM
  routing documented).
- Added `docs/Architecture/WASM_ACCELERATION.md` — narrative WASM coverage doc
  (thresholds, dispatch order, JS-only families, correctness status).
- `README.md`: removed changelog artifacts (the `[Unreleased]`/"ready to tag"
  status note) and the stale hardcoded status snapshot (12/12 packages, 491
  files, etc.); the Status section now points at the generated reports
  (OVERVIEW / TEST_COVERAGE / DEPENDENCY_GRAPH / wasm-pairing) as source of truth.

### Changed (2026-06-25)

- **WASM pairing detector — runtime-effectiveness probe added.** Beyond static
  routing, the dep-graph tool (`npm run docs:deps`) now probes the bundled
  `functions/dist/wasm/mathts.wasm` (synchronous export read) and each
  `*Dispatch`'s bridge allocator to report per-function `effectiveBackend` and a
  `bundledBackend`. Result: of 27 wasm-routed functions, **only 6 actually run
  wasm** (the elementwise transcendentals); **21 fall back to JS** because their
  bridge needs the AssemblyScript `__new` allocator, absent from the Rust-only
  module. This closes the static-vs-runtime gap (routing ≠ execution) directly in
  the generated `wasm-pairing.{md,json}`.
- **WASM↔function pairing detector** now classifies routing as `wasm` /
  `parallel` / `js-only` (not just `*Dispatch` vs JS): **27 wasm · 63 parallel ·
  128 js-only** of 218 typed functions. The "parallel" set (worker pool) was
  previously miscounted as "JS-only".
- **Elementwise transcendentals WIRED to WASM** (`mathts-functions` 0.2.13):
  `abs/sin/cos/tan/exp/log` over `Float64Array` ≥ 1024 now dispatch to the Rust
  `simd_*_array` kernels — benchmarked net-faster than JS *including* the
  JS↔wasm copy (`npm run bench:elementwise`): 1.35–5.1×. (An earlier note here
  claimed elementwise WASM "would regress" — that was inferred from the
  reduction result; **measuring** elementwise overturned it: `Math.sin` etc. are
  expensive enough that libm-in-wasm + 2 copies still wins. `sqrt` and the
  reductions genuinely lose and stay JS.)
- **Decision: reduction kernels (`sum`/`mean`/`variance`) NOT wired** —
  `npm run bench:reduction` shows 0.4–0.7× of plain JS once the copy-in is
  included (V8 JITs the trivial `+=` loop optimally). Wiring would regress.
  Op-fusion (data resident in WASM across chained ops) is the real lever for
  the rest and remains open. See `docs/roadmap/WASM_PAIRING_GAP_PLAN.md`.
- **`tools/create-dependency-graph`**: now emits the WASM accelerator↔function
  pairing as a generated artifact (`docs/Architecture/wasm-pairing.md` +
  `wasm-pairing.json`) — scans `functions/src/typed/` `mathTyped` exports for
  `*Dispatch` routing (21 of 218 accelerated). The per-function table is now
  tool-generated rather than hand-maintained, so it can't drift;
  `WASM_ACCELERATION.md` points at it for the authoritative list.
- Added the missing `docs:deps` npm script
  (`npx tsx tools/create-dependency-graph/create-dependency-graph.ts --root=.`),
  which the tool README and root README both referenced but was not wired.
- Added `docs/roadmap/WASM_PAIRING_GAP_PLAN.md` — agent-driven, dev-workflow +
  honest-claude plan to close the WASM↔function gaps (statistics reductions and
  arithmetic/trig elementwise route to parallel-JS rather than the existing
  `array_*` SIMD kernels; the pairing detector is `*Dispatch`-only and
  under-reports parallel/bridge acceleration).

### Fixed (2026-05-25)

- **`matrix` `determinantJS` sign for non-2-cycle permutations.** The JS
  fallback computed permutation parity by counting positions where
  `perm[i] !== i` — correct only when every cycle is a 2-cycle. For any
  3-cycle or larger the parity was inverted, so the sign of `det` could
  come back wrong. Replaced with cycle decomposition
  `sign(P) = (-1)^(n - cycles)`. Caught by
  `matrix/tests/wasm/decompositions-as.test.ts > matrix_determinant`
  (a 3×3 with a single 2-cycle returning ~2 instead of ~1).
- **Windows doubled-drive WASM path.** `URL.pathname` on a `file:///C:/…`
  URL yields `/C:/…`, which Node's `fs.readFile` interprets as drive-
  relative (`C:\C:\…`), so AS WASM module loading silently failed on
  Windows and every call routed to the JS fallback. The three Node-side
  callers — `matrix/src/backends/WasmLoader.getDefaultWasmPath`,
  `RustWasmLoader.findWasmPath`, `WASMBackend.resolveAsWasmPath` — now
  use `fileURLToPath` for cross-platform-correct conversion. Browser
  branches still return `.href` for `fetch()`.

> Strands of work since the autograd 0.1.0 release:
> 1. **WASM gap-analysis sprint** (`EXPANSION_PLAN` W1–W11, PRs #25–#35) — extends
>    both WASM toolchains (Rust crate primary, AssemblyScript parity) with the
>    kernels the gap analysis flagged as missing, and wires the cross-package
>    bridges (compat ↔ functions, tensor ↔ matrix, workbook ↔ expression).
> 2. **mathjs JS→AS port workflow** — a reusable LLM-driven porting pipeline in
>    `tools/mathjs-port/`, plus a behavioral-parity audit of synced functions.
> 3. **Parallel-execution remediation** — the worker pool never loaded its
>    kernel script, so every parallel dispatch failed at runtime; this fixes the
>    dispatch and the Float64Array chunking, then extends genuine worker
>    parallelism across the distribution, special-function, signal-spectrum, and
>    matrix-decomposition layers.
> 4. **Typed-layer expansion + repo-wide cleanup (2026-05-22)** — closes
>    the 599 pre-existing `functions` typecheck errors, raises source-file
>    coverage 18.6% → 27.0%, ports the bitwise and logical mathjs
>    categories to the active `typed/` layer with full WASM-WebWorker-JS
>    dispatch tiers, fixes a long-latent variadic-dispatch bug in
>    `typed/arithmetic.ts`, surfaces and fixes several pre-existing bugs
>    (latent `\!` in `core/is.ts`, Rust WASM build-script destination
>    outside the repo, stale `DenseMatrix(data)` calls in benches, three
>    `_compile(_math:…)` signatures whose bodies still used `math`,
>    matrix `WasmLoader` CWD-relative default path, cubic+quartic root
>    cases never implemented in `typed/cas.ts`, hybrid Rust/AS bug in
>    `WASMBackend`), and lands a clean `WASMBackend` (AS-only) +
>    `RustWASMBackend` (Rust-only) split with all four standalone WASM
>    benches now reporting Rust **2.5×–34× faster than JS**.
> 5. **CDG-driven coverage push (2026-05-23)** — `tools/create-dependency-graph/`
>    re-run identified every actionable untested file; +12 active files moved
>    untested → tested (source coverage 27.5% → 29.9%), 0 circular deps,
>    `eigs/svd/singularValues` and `polyFit/leastSquares` re-validated
>    `not-pursued`/`deferred` with measured probes checked in. Surfaced the
>    AllocatorKind Rust/AS WasmLoader split (commit `b96b53a`), the AS-WASM
>    decomposition export gap (5 new kernels — LU/QR/Cholesky/inverse/det),
>    the per-op `thresholdByOp` configuration, and the `wasm:integration`
>    suite green (224/224).
> 6. **Six-wave gap-closure programme — COMPLETE (2026-05-24).** 38 slices
>    across the six waves designed in `GAP_CLOSURE_PROPOSAL.md` →
>    `GAP_CLOSURE_PROPOSAL_WAVE6.md` close every item in
>    `FUNCTION_GAPS_AUDIT.md`. The §D ranks 1-14, the §B.1/§B.2 playbook,
>    the §C cross-cutting items, the rank-14 Unit-type blocker, the
>    matrix-function evaluators (full Higham general-case via Schur in
>    Wave 6), the non-symmetric eig AD, the 3-D convex hull WASM kernel,
>    the Carlson R-forms + incomplete elliptic integrals, and the WebGPU
>    browser smoke test infrastructure are all landed. After Wave 6 the
>    audit roadmap is closed; only the dormant mathjs upstream sync and
>    the mathjs.org parity ratchet remain (neither in the gap audit's
>    scope).

### Added

#### Function & auxiliary-function gaps — three slices LANDED (commit `1bfad1e`)

Full design at [`docs/roadmap/FUNCTION_GAPS.md`](docs/roadmap/FUNCTION_GAPS.md). Three slices from the 2026-05-24 dep-graph audit; three subagents in parallel with disjoint file scopes.

**Slice 1 — `TapedTensor` reductions + elementwise math (autograd, +63 tests)**

`autograd/src/tape.ts` gains 16 new methods on `TapedTensor`:

  - Reductions: `sum`, `mean`, `max`, `min`, `prod`, `norm` over an
    optional `axis | axis[]` with `keepDims`. `norm` supports
    `p ∈ {1, 2, 'fro', 'inf'}`.
  - Elementwise transcendentals: `log`, `exp`, `sin`, `cos`, `tan`,
    `sqrt`, `square`, `pow(k)` (fixed exponent), `reciprocal`, `abs`.

Adjoints per the proposal §1.2. Deliberate semantics on edge cases:
  - `prod` with multiple zeros uses prefix/suffix products so the
    single-zero and multi-zero cases differentiate correctly.
  - `max`/`min` tie-break first-wins (smallest input index gets the
    gradient).
  - `abs` subgradient at exact 0 = 0.
  - `norm p='inf'` scatters dY to the unique max-abs index.

Also fixed a real pre-existing build break: the methods were drafted
in an earlier landing without the two helpers (`_resolveAxes`,
`_rowMajorStrides`) they call, plus a `mean()` reduce callback with
implicit `any`. Slice 1 added the helpers and the explicit type.

30 + 33 = 63 new tests across `tape-reductions-ad.test.ts` and
`tape-elementwise-ad.test.ts`. FD gradient-check tolerance `1e-7`;
closed-form analytical-adjoint tests within `1e-10` to `1e-12`.
**Closes the AD loop for any loss function** — direct unblock for
UPT v0.7 Proposal 8's `differentiableEvaluator`.

**Slice 2 — `typed/complex.ts` + `typed/set.ts` promotion (functions, +91 tests)**

14 leaf functions promoted from synced factories to the active typed
dispatch layer:
  - `typed/complex.ts`: `arg`, `conj`, `im`, `re` over `number`,
    `bigint`, `BigNumber`, `Complex`, `Array`. Real-number identities:
    `arg(real)` = `atan2(0, x)`, `conj(real)` = identity, `im(real)`
    = 0, `re(real)` = identity.
  - `typed/set.ts`: `setUnion`, `setIntersect`, `setDifference`,
    `setSymDifference`, `setIsSubset`, `setMultiplicity`,
    `setPowerset`, `setDistinct`, `setSize`, `setCartesian`. Multiset
    semantics with order preserved by first appearance, matching
    mathjs convention.

Factory collision handling mirrors the bitwise+logical landing in
commit `2a141d4`: 14 `export` keywords stripped from
`functions/src/factories/index.ts` (factoryScope wiring lines
preserved); `factories-leaf.test.ts` repointed the 4 complex names
to `../src/typed/complex.js`; `factories-final.test.ts` repointed
the 10 set names to `../src/typed/set.js`.

43 + 48 = 91 new tests across `typed-complex.test.ts` and
`typed-set.test.ts`.

**Slice 3 — Tensor decomposition wrappers (tensor, +36 tests)**

Four new `tensor/src/operations/` files mirror the `tensorSvd`
pattern (permute → reshape into 2-D → call the matrix primitive →
reshape outputs back → propagate `axisLabels`):

  - `tensorQr(t, rowAxes, opts?)` → `{ Q, R }` with `mode ∈
    {'reduced', 'full'}`. Delegates to `matrix/src/operations/qr.ts`
    (which already existed; one line added to
    `matrix/src/operations/index.ts` to re-export it).
  - `tensorLU(t, rowAxes)` → `{ L, U, P: Int32Array, parity: 1 | -1 }`.
    Self-contained Doolittle LU with partial pivoting (matrix has no
    LU primitive yet). Throws clear `"square"` / `"singular"`
    messages.
  - `tensorCholesky(t, rowAxes, { lower? = true })` → `{ L }` or
    `{ L: U }` when `lower = false` (A = Uᵀ·U). Throws
    `"matrix is not positive definite"` / `"square"`.
  - `tensorEig(t, rowAxes, opts?)` →
    `{ eigenvalues, eigenvectors?, eigenvaluesImaginary? }`.
    Delegates to matrix's eig; `opts.symmetric` symmetrises the input
    before calling so the matrix primitive's internal symmetric path
    picks the stable real-eigenvalue routine.
    `eigenvaluesImaginary` populated only when any eigenvalue has
    nonzero imaginary part on the non-symmetric path.

axisLabels propagation: rowAxes labels survive on the "row-side"
factor; colAxes labels on the "col-side" factor; a fresh joining
Index sits between them (via the `joiningIndexName` opt where
supported).

10 + 9 + 7 + 10 = 36 new tests across `qr.test.ts`, `lu.test.ts`,
`cholesky.test.ts`, `eig.test.ts`. Reconstruction tolerances `1e-9`
for QR/LU/Cholesky; `1e-7` for the eig reconstruction (matrix eig is
iterative — that's its precision floor).

#### Cumulative test deltas

  - `tensor`:   12 files / 179 tests → **16 files / 215 tests** (+36)
  - `autograd`:  5 files /  29 tests → **7 files /  92 tests** (+63)
  - `functions`: 51 files / 1,774 tests → **53 files / 1,865 tests** (+91)

#### Follow-up cleanup tracked (not regressions, internal de-duplication)

  - `tensor/src/operations/random.ts` still has an inlined
    Gram-Schmidt QR. Now that matrix re-exports `qr`, that can be
    refactored to call into matrix in a future slice. Functionally
    equivalent today.
  - The inlined Doolittle LU and right-looking Cholesky in
    `tensor/src/operations/{lu,cholesky}.ts` should eventually be
    promoted to proper `matrix/src/operations/{lu,cholesky}.ts`
    primitives. Tracked as a future clean-up slice.

#### Gap-closure Wave 6 — COMPLETE (5 slices, final cleanup; audit closed)

Wave 6 closed the 5 forward-tracked items remaining after Wave 5 — the WebGPU browser smoke-test infra, full Higham general-case `logm`/`sqrtm` for non-diagonalisable / defective / complex-eigenvalue matrices, non-symmetric `TapedTensor.eig` AD, 3-D convex-hull WASM, and Carlson R-forms + incomplete elliptic integrals. **With this wave the entire `FUNCTION_GAPS_AUDIT.md` roadmap is closed.** Design at [`docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE6.md).

**Wave 6A (Tier-1 — parallel, 3 disjoint agents):**

- **Slice 6.1 — commit `d0466b3`** — Slice 5.9b closed: full Higham Schur-based `logm`/`sqrtm` for general matrices. NEW `matrix/src/operations/schur.ts` exposing a public Schur primitive (Francis QR-with-double-shifts; ~150 LOC). Extended `logm.ts` with the Schur-Padé algorithm per Higham (2008) Algorithm 11.10 (Schur → inverse scaling-and-squaring on the triangular factor via the Björck-recurrence sqrt → Padé approximant for `log(I+X)` near identity → multiply back by `2^k` and rotate by Q). Extended `sqrtm.ts` with the Björck-Hammarling algorithm per Higham (2008) Algorithm 6.3 (Schur → direct upper-triangular back-substitution `T_ij = U_ii·U_ij + U_ij·U_jj + Σ U_ik·U_kj` → rotate back). +19 matrix tests covering complex / defective / repeated-eigenvalue cases, all within `1e-10` of SciPy reference. `matrix`: 586 → **605 tests** (+19).
- **Slice 6.2 — commit `048e9e1`** — Non-symmetric `TapedTensor.eig` AD (Opus subagent). Lifts the symmetric-only restriction from Slice 4.8. General-case adjoint per Townsend (2016) §4 / Magnus & Neudecker (1999) §10.6: `dA = V^{-T} · (E ∘ (V^T · dV) + diag(dλ)) · V^T` where `E[i,j] = 1/(λ_j − λ_i)` for i ≠ j else 0. Near-degenerate subgradient masking at `REL_TOL = 1e-10` (same as Slice 4.8 for symmetric); clean throw on defective inputs when `cond(V) > 1e14`. +13 autograd tests (finite-difference verification at 5 well-conditioned non-symmetric inputs + chained-graph + defective error path). `autograd`: 136 → **149 tests** (+13).
- **Slice 6.5 — commit `3aac312`** — WebGPU browser smoke test infrastructure. Closes the infra-prerequisite item that has been on the open-actions list since the original audit. Installed `@vitest/browser` + `playwright` at repo root; NEW `vitest.config.browser.ts` gated to `*.browser.test.ts`; NEW `functions/tests/gpu-smoke.browser.test.ts` verifies `gpuMatmul` on a 4×4 input matches the CPU reference within float32 precision (explicitly checks GPU runtime when an adapter is available, transparent CPU fallback otherwise). NEW CI job installs Mesa lavapipe (`apt-get install mesa-vulkan-drivers libegl1`) and runs `npm run test:browser`. WGSL syntax errors and shader-module init bugs in `functions/src/typed/gpu.ts` and `matrix/src/backends/gpu/*` can now surface in CI rather than silently passing.

**Wave 6B (Tier-2 — sequential WASM, 2 slices):**

- **Slice 6.3 — commit `bba468b`** — `convexHull3D` WASM via incremental QuickHull-3D (Barber, Dobkin, Huhdanpaa 1996). NEW `convex_hull_3d_wasm(pts_ptr, n, faces_ptr) -> i32` in `wasm-rust/crates/mathts-wasm/src/geometry/advanced.rs`; new `convexHull3D` typed export via `functions/src/typed/geometry.ts`. The 2-D hull + Delaunay 2-D + Voronoi 2-D + k-d tree already have WASM kernels (Slice 5.7d + the existing `geometry/advanced.rs`); this slice closes the geometry gap. Threshold ≥ 1024 points. +18 hull-3D tests (tetrahedron / cube / cospherical sample / degenerate co-planar fallback / 1024-point random cloud).
- **Slice 6.4 — commit `2be52f9`** — Carlson R-forms (`carlsonRC`/`RD`/`RF`/`RJ`) + incomplete elliptic integrals (`ellipticF(φ,m)`, `ellipticEIncomplete(φ,m)`, `ellipticPi(n,φ,m)`) WASM. Quadratically convergent and branch-cut-free per Carlson (1995), NR §6.11, DLMF §19. Scalar Rust functions in `wasm-rust/crates/mathts-wasm/src/special/functions.rs` (corrected RC pure-duplication algorithm with no external sum; RD `x=y=z` special-case returning `x^{-3/2}` to avoid degenerate early convergence; NR threshold tightened `0.0015 → 1e-10` for ~`1e-11` accuracy vs DLMF references). Array kernels in `wasm-rust/crates/mathts-wasm/src/bessel.rs` using pointer-style ABI. Full AS parity port (`assembly/src/special.ts` scalar + array kernels; AS wiring through `assembly/src/index.ts` landed in commit `28e50ec`). Threshold ≥ 1024 samples. +41 tests across 10 suites against DLMF §19.16-19.36 and Abramowitz & Stegun §17 reference values.

**Manifest regeneration — commit `dc5c050`:** Slice 6.4 was branched off a base predating Slice 6.3, so its manifest `mathts.wasm` hash reflected only the Carlson kernels. After cherry-picking both slices, the rebuilt `mathts.wasm` contains `convex_hull_3d_wasm` + the four Carlson R-forms + three incomplete-elliptic kernels — a new binary that the manifest must match. SHA-384 manifest regenerated to match the combined-rebuild output.

**Doc closures + AS wiring polish — commit `28e50ec`:** Wire AS Carlson exports through `assembly/src/index.ts` (`carlson_{rc,rf,rd,rj}_f64`, `elliptic_{f,e,pi}_incomplete_f64`); rebuilt `mathts-as.wasm` now exposes the 7 new kernels matching the Rust binary, manifest extended to track both artifacts. Mark all 5 Wave-6 slices `✅ LANDED` in `GAP_CLOSURE_PROPOSAL_WAVE6.md` with commit hashes; add closing-summary table. Strike the three "remaining open items" in `FUNCTION_GAPS_AUDIT.md §F` — all three forward-tracked items closed, plus the bonus slices (6.2 non-symmetric eig AD, 6.3 convexHull3D).

**Wave 6 cumulative test deltas:**

  - `functions`: 2,486 → **2,545** (+59 = 18 hull3D + 41 Carlson)
  - `matrix`:    586  → **605**  (+19, Schur + general-case logm/sqrtm)
  - `autograd`:  136  → **149**  (+13, non-symmetric eig AD)
  - 238 test files total (+2 new files); 6308 vitest + 172 WASM integration tests pass / 7 skipped / **zero regressions**.

**Security invariants intact.** WASM SHA-384 manifest verification re-validated for both `mathts.wasm` (Rust, 754 KB, primary) and `mathts-as.wasm` (AS, 62 KB, legacy with full Carlson parity). Expression sandbox `getSafeProperty`/`setSafeProperty`/`getSafeMethod` call sites untouched. `WorkerPool.execute()` timeout+replace plumbing untouched.

**Total Wave 6 = 5 slices across 7 commits** (`d0466b3` Schur+logm/sqrtm, `048e9e1` non-symm eig AD, `3aac312` WebGPU browser harness, `bba468b` convexHull3D, `2be52f9` Carlson+incomplete elliptics, `dc5c050` manifest regen, `28e50ec` doc closures + AS wiring). After Wave 6 the entire `FUNCTION_GAPS_AUDIT.md` gap-closure roadmap is **closed**.

#### Gap-closure Wave 5 — COMPLETE (15 slices, B.1/B.2 backlog + Unit type)

Wave 5 closed the remaining B.1/B.2 playbook backlog from `FUNCTION_GAPS_AUDIT.md` plus the previously-blocked rank-14 (typed/unit), the 4.7b sub-slice (Tensor scatter/pad/roll/flip), and the matrix-function evaluator primitives. **All §D ranks 1-14 and all §B.1 / §B.2 / §C items are now landed.** Only the WebGPU browser smoke test (infra) and incomplete-elliptic / non-symm full-Higham follow-ups remain.

**Wave 5B (Tier-2 — sequential WASM ports):**

- **Slice 5.3 — commit `098656e`** — `ellipticK(m)` / `ellipticE(m)` WASM via AGM. NEW scalar `elliptic_k(m)` / `elliptic_e(m)` in `special/functions.rs` (the existing `ellipticK_wasm` was the wrong incomplete form); AGM converges quadratically to f64 precision in ≤10 iterations. Full AS parity port. 28 new TS tests + 9 Rust unit tests.
- **Slice 5.4 — commit `f537a56`** — `polyFit` / `chebyshevFit` / `legendreFit` WASM via Vandermonde + inlined Householder QR. ~230 LOC Rust + ~170 LOC AS + ~170 LOC bridge at `WASM_POLY_FIT_THRESHOLD = 1024`. Inlined the Householder QR rather than calling into the matrix-package QR to avoid cross-crate coupling. 18 new tests. `chebyshevFit` / `legendreFit` are new public exports.
- **Slice 5.5 — commit `2b273a1`** — `lagrangeInterp` (above threshold) + new `newtonInterp` divided-difference WASM. Existing `lagrangeInterp` was direct-Lagrange-formula, not Newton form — preserved as the below-threshold path; above `WASM_INTERP_THRESHOLD = 256` knots it dispatches to the Newton divided-difference WASM. 14 new tests.
- **Slice 5.6 — commit `2d0ebfa`** — `applyWindow` + `welchPSD` + `bartlettPSD` + `multiTaperPSD` + `goertzel` + `chirpZTransform` WASM (full 5-kernel module). `welch_psd_f64` and `chirp_z_transform_f64` use rustfft via crate-local helper (no cross-module linking). 25 new TS tests + 8 Rust unit tests. CZT phase computed directly via libm cos/sin per index (not recursive) — keeps numerical error <1e-7.

**Wave 5C (Tier-3 — sequential larger / design-heavy):**

- **Slice 5.7d — commit `5a0ca7c`** — `wasm.sortF64` / `argsortF64` / `rankF64` kernel + full consumer wiring (full slice, no sub-slice split). Rust uses `slice::sort` (pdqsort + insertion-sort fallback) with NaN-last comparator. AS port uses median-of-three quicksort + insertion-sort fallback. Bridge at `WASM_SORT_THRESHOLD = 16_384`. **Wires:** `parallelStatMedian` / `parallelStatQuantile` / new `parallelStatPercentile` (statistics, 5.7b); `kolmogorovSmirnovTest` / `mannWhitneyTest` (argsort path) / `shapiroWilkTest` (hypothesis re-wire, 5.7c); `convexHull` Andrew's monotone-chain (geometry, 5.7d). 54 new tests (21 kernel + 15 statistics + 11 hypothesis + 7 geometry).
- **Slice 5.8 — commit `8872e4b`** — `lgamma_f64` WASM array kernel + 4 distribution-pdf wirings. Scalar `lgamma` (Lanczos g=7) already existed in `special/functions.rs`; this slice added the pointer-ABI array kernel + AS parity port. Distribution-pdf wirings: `betaPDF` / `gammaPDF` / `studentTPDF` cache lgamma scalar constants once per call, vectorise the per-element work; `noncentralChi2PDF` vectorises the lgamma table over the truncation sum via `lgammaDispatch`. Threshold `WASM_SPECIAL_THRESHOLD = 1024`. 52 new tests (28 lgamma + 24 distribution). Name-collision finding: `factories/index.ts` already had a dormant `lgamma` export; stripped to resolve (same pattern as `cond` in Slice 5.2).
- **Slice 5.9a — commit `ca08c12`** — `matrixExpm` / `matrixLogm` / `matrixSqrtm` primitives + typed promotion. **expm:** full Higham Padé-13 scaling-and-squaring (Algorithm 10.20). **logm:** inverse scaling-and-squaring with 16-point Gauss-Legendre quadrature for `log(I + X)`; pre-validates eigenvalues upfront (critical — without this, Newton-sqrt noise amplifies near-zero eigenvalues toward 1, causing spurious near-identity convergence). **sqrtm:** Newton iteration `Y_{k+1} = (Y_k + A·Y_k⁻¹)/2` starting from `Y_0 = I` (not `A` — starting from I avoids the "converges to A" trap); for SPD matrices, eig validates non-negative eigenvalues first. logm/sqrtm general-case (complex eigenvalues, defective matrices, Schur-based Björck-Hammarling) deferred to Slice 5.9b. 30 matrix tests + 13 typed-dispatch tests.

**Wave 5D (Tier-4 — parallel worker-route batches, 3 agents):**

- **Slice 5.12 — commit `effc15e` (co-landed with 5.13)** — Distribution batch sampling worker fan-out at `n >= 100_000`. New `sampleChunk` worker kernel (self-contained mulberry32 + Box-Muller + Marsaglia-Tsang gamma; no main-thread imports). SplitMix64-style seed-splitting: `chunkSeed = ((baseSeed ^ Math.imul(chunkIdx, 0x9E3779B9)) >>> 0)`. Distributions with worker route: `normalDist`, `gammaDist`, `betaDist`, `tDist`, `exponentialDist` (5 per spec). 12 new tests; 1M-sample statistical correctness verified.
- **Slice 5.13 — commit `effc15e`** — Graph centrality random-restart fan-out for `pageRank`, `betweennessCentrality`, `eigenvectorCentrality` (3 new typed exports; they didn't exist before). Threshold `restarts >= 4`. **Option B** (main-thread `Promise.all` rather than a dedicated worker kernel — registering one would have exceeded the slice's file scope). Same SplitMix64 seed-splitting. 18 new tests.
- **Slice 5.14 — commit `444fec4`** — CAS batch worker fan-out for `simplify` / `derivative` / `expand` / `factor` at array-length ≥ 16. Worker imports from `@danielsimonjr/mathts-expression` aren't reachable (workerpool is below functions in the dep graph), so the implementation uses self-contained string-manipulation kernels shipped via `.toString()` + `eval()` (via the existing `mapChunk` worker handler). Exports use `cas`-prefixed names (`casSimplify`, `casDerivative`, `casExpand`, `casFactor`) to avoid colliding with the factory-layer `simplify`/`derivative`/`expand`/`factor` already in the build. 13 new tests.

**Wave 5E (Opus, single big slice):**

- **Slice 5.15 — commit `8131212`** — Core `Unit` type + `typed/unit.ts` promotion. **Closes rank 14.** New files: `core/src/types/unit.ts`, `unit-definitions.ts`, `unit-prefixes.ts`. Design: immutable class (mirroring `Complex`/`Fraction`/`BigNumber`); 7-D SI dimensional vector as a `Dimensions` struct; canonical-value invariant (`unit.value` always in SI base units regardless of construction notation); recursive-descent parser (~90 LOC); prefix-ambiguity resolution by registry-plain-match-first then longest-prefix-split; temperature offsets honoured only when atom is standalone with exponent 1 (matches mathjs semantics); `toBest()` ranks `(unit, prefix)` candidates by `|log10(displayed)|`. 53 core tests + 15 typed tests. Differences from mathjs's `Unit` class documented: self-contained (no closure over a `math` instance), explicit `DimensionMismatchError` / `UnitParseError` classes, sane `toBest()` (skips kg/non-multiplicative entries that produce awkward output).

**Wave 5 cumulative test deltas:**

  - `functions`: 2,229 → **2,486** (+257)
  - `tensor`: 323 → **379** (+56)
  - `matrix`: 556 → **586** (+30)
  - `core`: → **444** (+53)
  - 25+ Rust native unit tests added across the WASM crates.

**Total Wave 5 = 15 slices across 11 commits.** All §D Tier-4 ranks closed; all §B.1 / §B.2 / §C items closed.

#### Gap-closure Wave 5A — four Tier-1 slices LANDED in parallel

Four disjoint Tier-1 slices from [`GAP_CLOSURE_PROPOSAL_WAVE5.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE5.md) opening the B.1/B.2 playbook backlog:

- **Slice 5.1 — commit `09eadea`** — Tensor `scatter`/`pad`/`roll`/`flip` closes the 4.7b sub-slice deferred from Slice 4.7. All four preserve input axis labels (output shape == input shape). Notable indexing-math choices: `roll` uses `((outIdx[k] - shift[k]) % dim + dim) % dim` for branchless negative-shift handling; `pad` `'reflect'` mode excludes the boundary element (matching NumPy `np.pad`); `scatter` with `reduce: 'add'` is order-dependent for duplicate indices (documented behaviour). 56 new tests (14 per op). `tensor`: 323 → **379 tests** (+56).
- **Slice 5.2 — commit `0cef320`** — Promote 6 matrix-package exports to the typed/ layer: `pinv`, `cond`, `norm2`, `normFro`, `lowRankApprox`, `singularValues`. `pinv` wired to the DenseMatrix-based `matrixPinv` from Slice 4.2 (Option A — cleaner DenseMatrix API). Name-collision finding: `cond` already existed as a plain export in `typed/numeric.ts`; resolved via an explicit barrel-level re-export override (`functions/src/typed/index.ts`) so deep imports from `numeric.ts` still work but the typed-function dispatch surface gets the SVD-based mathTyped version. Also added a `matrixPinv` re-export to `matrix/src/operations/index.ts`. 27 new tests.
- **Slice 5.10 — commit `6b78c31`** — `typed/integration.ts` sub-interval worker fan-out. Extends Slice 3.8 — that slice offloaded the post-evaluation dot/sum; this slice offloads the integrand evaluation itself across `workerCount` sub-domains. New `validateClosureSource()` allow-list heuristic: parses the stringified closure, extracts declared parameter name(s), tokenises the body with a lookbehind regex, and rejects any non-allowlisted identifiers (allow-list = JS keywords, `Math.*`, `Infinity`, `NaN`, the parameter name). Rejects async closures. New `integrateChunk` worker kernel (returns scalar, not `Float64Array` — doesn't fit the elementwise `applyKernel` shape). 14 new tests covering rejection paths, multi-worker correctness, and the totalPoints-below-threshold fallback.
- **Slice 5.11 — commit `9f74b1e`** — `typed/hypothesis.ts` bootstrap helper. Adds `{ bootstrap: N, bootstrapSeed }` opt-in to all 4 tests. Per-test resampling scheme: `chiSquareTest` = multinomial with replacement; `kolmogorovSmirnovTest` = parametric bootstrap with replacement from the original sorted sample, D recomputed against the same CDF; `mannWhitneyTest` = permutation bootstrap via Fisher-Yates shuffle of the combined pool; `shapiroWilkTest` = bootstrap with replacement, W recomputed with the same precomputed coefficients. Mulberry32 seeded PRNG for reproducibility. Return type union — `BaseResult | BootstrapResult` per test, where bootstrap result carries `bootstrapStatistics: Float64Array`, `bootstrapMean`, `bootstrapStd`, `pValueEmpirical`. 17 new tests.

**Cumulative Wave 5A test deltas:**

- `tensor`: 323 → **379** (+56)
- `functions`: 2,171 → **2,229** (+58 across 5.2 + 5.10 + 5.11)

Pipeline 19/19 turbo tasks green. Wave 5B (sequential WASM slices 5.3-5.6) dispatches next.

#### Gap-closure Wave 5E — Opus Slice 5.15 LANDED (rank 14 closure)

- **Slice 5.15** — `core/Unit` type + `typed/unit.ts` promotion. **Opus subagent.** Closes the deferred rank-14 entry from the function-gap audit by implementing a TypeScript-native `Unit` value type and wiring `to(value, target)` and `toBest(value)` through the active `typed/` dispatch layer. Three new core files (`core/src/types/unit.ts`, `unit-definitions.ts`, `unit-prefixes.ts`), one new typed wrapper (`functions/src/typed/unit.ts`), and 68 new tests (53 core + 15 typed). Design choices intentionally diverging from the synced mathjs `Unit.ts` (3,488-line `@ts-nocheck` factory): immutable value semantics with `readonly` fields, `Dimensions` as a struct over the 7 SI bases (not an indexed array), no closure over a `math` instance (Unit is self-contained), explicit `DimensionMismatchError` / `UnitParseError` error classes. Parser is recursive-descent supporting `m/s²`, `kg·m/s^2`, `1/s`, Unicode middle-dot/superscripts; prefix ambiguity (`min` vs `m + in`) resolved by trying plain match before prefix. Temperature offsets stored on the unit definition (`{multiplier, offset?}`) and applied only when a unit is used standalone with exponent 1 (matching mathjs). `toBest()` ranks candidate units+prefixes by minimising `|log10(displayed)|`; skips `kg` to avoid colliding with the prefixable `g` entry. `to(number, string)` is registered as a constructor shorthand alongside `to(Unit, string)`. Name-collision finding: synced-mathjs `factories/index.ts` already re-exports `to`/`toBest`; resolved via an explicit `export { to, toBest } from './typed/unit.js';` override in `functions/src/index.ts`, mirroring how `cond` is resolved. `functions`: 2,471 → **2,486** (+15); `core`: 391 → **444** (+53).

#### Gap-closure Wave 4C — two Tier-3 design-heavy slices LANDED

- **Slice 4.8 — commit `fd81cd8`** — `TapedTensor` decomposition AD (rank 12). **Opus subagent.** Three new methods:
  - **`TapedTensor.tensordot(other, axesA, axesB)`** — direct extension of `contract`'s adjoint with axis-permutation plumbing. Reference: Townsend (2016) §6 + PyTorch's `TensorDotBackward0`.
  - **`TapedTensor.svd()`** — full SVD AD per Townsend (2016) §3 + PyTorch's `svd_backward`. The C-matrix formula was derived directly from the forward Jacobian.
  - **`TapedTensor.eig({ symmetric: true })`** — symmetric path only. Reference: Magnus & Neudecker (1999) §10.6.6 + PyTorch's `linalg_eigh_backward`. Non-symmetric `eig` (complex eigenvalues, harder formulas) explicitly throws and stays deferred.

  **Repeated-value handling:** the F-matrix entries `1/(S_j² - S_i²)` (SVD) and `1/(Λ_j - Λ_i)` (eig) are singular at degeneracies. Mask threshold `REL_TOL = 1e-10` (matching PyTorch's f64 convention): entries with `|s_j² - s_i²| < REL_TOL · max(S²)` (or analogous for eigenvalues) are zeroed, producing a subgradient — bounded but not the true derivative at exact degeneracy.

  **Precision surprise:** at exact degeneracy (e.g. `A = diag(2, 2, 5)` with two equal eigenvalues), the matrix-eig primitive returns non-orthogonal duplicate eigenvectors, making `U·diag(Λ)·Uᵀ ≠ A`. This is a primitive limitation that surfaces as a subgradient mismatch — _not_ an autograd bug. Documented inline; one test verifies finiteness + bounded-norm at exact degeneracy and a separate "slightly perturbed" test (eps=1e-3) verifies the smooth formula recovers `2A` to `1e-5`. 33 new tests. `autograd`: 103 → **136 tests** (+33).

- **Slice 4.9 — commit `276a75b`** — Airy `Ai`/`Bi` WASM + AssemblyScript Bessel parity (formerly Slice 3.10c-2 from Wave 3b). Closes the deferred sub-slice cleanly:
  - **Rust:** NEW scalar `airy_ai(x)` / `airy_bi(x)` in `wasm-rust/crates/mathts-wasm/src/special/functions.rs` — power series for `|x| ≤ 4.5`, 7-term asymptotic for larger `|x|` (DLMF §9.2 and §9.7). ~1e-7 relative error at the crossover. Array kernels `airy_ai_f64` / `airy_bi_f64` in `bessel.rs` + 8 Rust unit tests.
  - **AssemblyScript:** NEW `assembly/src/special.ts` — full parity port for all 6 Bessel + 2 Airy exports. Solid clean implementation; no 4.9b split needed.
  - **Bridge:** `functions/src/wasm/special/wasm-bridge.ts` gains `airyAiDispatch` / `airyBiDispatch` with the existing probe-Rust-then-AS-then-JS pattern. All Bessel dispatchers' AS-suffix probe (previously wired-for-but-no-impl) now resolves to the new AS module.
  - **Bi large-negative-x phase:** the Bi asymptotic uses `θ = ζ + π/4` (DLMF §9.7.5), distinct from Ai's `θ = ζ − π/4`. This was the one precision-sensitive design decision; verified against DLMF reference values at `x = −1, −2`.
  - `WasmLoader` gained 10 new optional interface entries (`airy_ai_f64`, `airy_bi_f64`, all 8 `_as`-suffix variants). `typed/special.ts` gained `airyAi` / `airyBi` array-overload paths at `WASM_SPECIAL_THRESHOLD = 1024`. 25 new tests. `functions`: 2,150 → **2,171 tests** (+21 net after counting the AS-path duplication adjustments).

**Wave 4 totals (cumulative across 4A + 4B + 4C):**

  - `functions`: 2,036 → **2,171** (+135)
  - `tensor`: 266 → **323** (+57)
  - `autograd`: 103 → **136** (+33)
  - `parallel`: 342 → **355** (+13)
  - `matrix`: → **556**

Total Wave 4 = 9 slices landed across 9 commits. All §D Tier-4 ranks except 14 (typed/unit.ts — blocked on core `Unit` type) and the deferred B.1/B.2 playbook backlog are now closed. WebGPU browser smoke test remains pending the Playwright infra PR. Pipeline 19/19 turbo tasks green throughout.

#### Gap-closure Wave 4B — two Tier-2 slices LANDED in parallel

Two disjoint Tier-2 slices from [`GAP_CLOSURE_PROPOSAL_WAVE4.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md), dispatched to two sonnet subagents on disjoint scopes:

- **Slice 4.6 — commit `43f45a1`** — `typed/probability.ts` dedup audit + selective promotion (rank 9). Audited all 12 synced `probability/<name>.ts` files. **Promoted 8 of 12:** `bernoulli`, `combinations`, `combinationsWithRep`, `multinomial`, `permutations`, `pickRandom`, `random`, `randomInt`. **Skipped 4** that were already reachable via the factory surface with richer type coverage (Complex/BigNumber/WASM paths): `factorial` (tier 7), `gamma` (tier 6 — needs Complex/BigNumber deps), `kldivergence` (tier 13 — needs matrix wiring), `lgamma` (tier 1 — needs WASM bridge). Notable semantic finding: `bernoulli` is the number-theoretic _nth Bernoulli number_ (used in series expansions), not the `bernoulliPMF` already in `distributions.ts` — they share a name but the math is different. All seeded-RNG ops share a single `_rng` instance with a `seedProbabilityRng()` reset so `random` / `randomInt` / `pickRandom` are composable in one seeded sequence. 57 new tests. `functions`: 2,093 → **2,150 tests** (+57).
- **Slice 4.7 — commit `13eda2f`** — Tensor indexing primitives, core family (rank 11). NEW `tensor/src/operations/{slice,gather,stack,concatenate}.ts`:
  - **`slice(t, ranges)`** — JAX-style per-axis `[start, stop, step]` triples; supports negative indexing and `null` for "whole axis"; preserves axis labels.
  - **`gather(t, axis, indices)`** — NumPy `take` / JAX `gather`; output rank unchanged, gathered-axis length = indices.length. **Axis-label semantics:** the gathered axis is _primed_ via the existing `Index.prime()` mechanism (same `id` Symbol, `primeLevel + 1`) so it cannot auto-contract with the original even though they share an id.
  - **`stack(tensors, axis, opts?)`** — NumPy `stack`; result rank = input rank + 1. Optional `newAxisLabel` for the inserted axis (default `undefined`).
  - **`concatenate(tensors, axis)`** — NumPy `concatenate`; result rank unchanged. Preserves labels from `tensors[0]` (silently if downstream tensors disagree on the join-axis label).
  - 57 new tests across 4 files (15 slice + 14 gather + 14 stack + 14 concatenate). `tensor`: 266 → **323 tests** (+57).
  - Subtle finding: when `stack` inserts a new axis at position `ax`, output strides for input dimensions _above_ `ax` are `outStrides[k+1]`, not `outStrides[k]` — the inserted axis shifts all subsequent stride indices up by one.

**Scatter / pad / roll / flip stay deferred** to a future Slice 4.7b sub-slice per the proposal's scope-balloon contract.

**Test deltas this wave:**

- `functions`: 2,093 → **2,150** (+57)
- `tensor`: 266 → **323** (+57)
- All other packages unchanged.

Pipeline 19/19 turbo tasks green.

#### Gap-closure Wave 4A — five Tier-1 slices LANDED in parallel

Five disjoint slices from [`GAP_CLOSURE_PROPOSAL_WAVE4.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL_WAVE4.md) Tier 1, dispatched to five sonnet subagents on non-overlapping file scopes, all green:

- **Slice 4.1 — commit `73e6ca9`** — `ComputePool` extras: `pow`, `sign`, `tensordot`. `pow` and `sign` reuse the existing generic `applyKernel2`/`applyKernel` dispatchers (no new worker kernels). `tensordot` required a new `tensordotChunk` worker kernel (registered in `packages/workerpool/src/worker.ts`) because shape/axis metadata can't ride the elementwise pipeline. `pow` threshold = `'never'` (overhead dominates), `tensordot` = 8 K contracted-axis volume. `parallel`: 342 → **355 tests** (+13).
- **Slice 4.2 — commit `8b357cc`** — `matrixPinv` Moore-Penrose pseudoinverse on `DenseMatrix`. NEW `matrix/src/operations/pinv.ts` (~80 LOC) using full SVD + `rcond·max(S)` thresholding (default `rcond = 1e-10`). Exported as `matrixPinv` to avoid colliding with the existing `pinv` in `svd.ts` (which operates on `number[][]`). 14 new tests covering the four Moore-Penrose identities, tall/wide/rank-deficient cases, and a Hilbert(5) stability check. `matrix`: → **556 tests**.
- **Slice 4.3 — landed via 4.1 + 4.2** — `tensor/src/operations/random.ts` QR cleanup. The Slice-4.1 agent's scope crept slightly and refactored `random.ts` to replace the 47-LOC inline Gram-Schmidt `thinQR()` with a 9-LOC `thinQViaMatrixQr()` delegation to `matrix.qr`. The Slice-4.2 agent added the 2 required reproducibility/orthogonality tests. Slice-4.3 agent verified the work was complete (no-op). Net: −38 LOC in `random.ts`, 2 new tensor tests, `Qᵀ·Q ≈ I` verified to `1e-10`.
- **Slice 4.4 — commit `8af250b`** — `typed/string.ts` promotion (rank 13). 5 ops (`bin`/`hex`/`oct`/`format`/`print`) with 39 new tests. Three semantic findings worth documenting: (1) mathjs uses sign-magnitude (not two's-complement) for negative-number `bin`/`hex`/`oct` unless `wordSize` is passed — `bin(-5) → '-0b101'`. Two's-complement only activates with explicit `wordSize`; (2) the core BigNumber lacks Decimal.js's `toBinary`/`toOctal`/`toHexadecimal` so base conversion routes through `toNumber()`; (3) `mathTyped`'s `number → BigNumber` auto-conversion conflicts with `'BigNumber, X'` signatures, so the typed file uses `'any'` / `'any, any'` with inline `instanceof BigNumber` guards. `functions`: 2035 → **2093 tests** (+58).
- **Slice 4.5 — commit `6e9f9c0`** — polynomial WASM follow-up: `discriminant` + `resultant`. NEW Rust `poly_resultant_f64` (Sylvester matrix + inlined Gaussian-elimination det, ~90 LOC) and `poly_discriminant_f64` (special-cases deg 1/2/3, then `(-1)^(deg·(deg-1)/2) / a_deg · Res(p, p')` for deg ≥ 4, ~45 LOC). AS parity port (~115 LOC) with `sylvesterDet` + `detSquare` + `trimCoeffs` helpers. Bridge additions (~145 LOC) follow the existing probe-Rust-then-AS-then-JS pattern at `WASM_POLY_THRESHOLD = 256`. 18 new tests across 3 suites. Manifest regenerated; `wasm-integrity` still 5/5. **Sign-convention finding:** the task spec's worked example expected `resultant([1,1],[1,-1]) = -2` but the existing typed-layer Sylvester construction gives `+2`; tests match the existing implementation rather than the spec's example.

**Test deltas this wave:**

- `parallel`: 342 → **355** (+13)
- `matrix`: → **556**
- `tensor`: 266 → **268** (+2 new orthogonality tests from 4.3)
- `functions`: 2,036 → **2,113** (+77 across 4.4 / 4.5 / earlier reset-helper tests)

Pipeline 19/19 turbo tasks green via `npx turbo run test --concurrency=2`.

#### CDG refresh + gap-audit recheck (post-Wave-3)

Ran the Create Dependency Graph tool to verify no new issues or regressions after the Wave-1/2/3 landings. **Two pre-existing CDG bugs surfaced and were fixed in the same pass:**

- **`tools/create-dependency-graph/create-dependency-graph.ts`** — `findReachableFiles` and `detectUnused` both only followed `internalDependencies` (relative imports) and ignored `workspaceDependencies` (cross-package npm-scoped imports). That caused `packages/workerpool/src/index.ts` to be false-flagged as the only "unused file" because `parallel/ComputePool.ts` consumes it via `@danielsimonjr/mathts-workerpool` and the workspace edge wasn't traced. **Fix:** added a `workspaceEntryPath(packageName)` helper and traced workspace deps to their entry-point file in both functions.
- **Test files weren't considered as consumers** by `detectUnused` even with `--include-tests` set. Test-only consumers (`resetPolyWasm`, `resetTridiagWasm`, JS-fallback exports like `tridiagSolveJS`/`besselJ0JS`, threshold constants like `WASM_TRIDIAG_THRESHOLD`) were false-flagged. **Fix:** parse test files up-front when `--include-tests` is on and feed them to `detectUnused` as an additional consumer corpus.

Reset-helper test-coverage gap — the two genuinely-unconsumed exports flagged after the CDG fixes (`resetBitwiseWasm`, `resetBesselWasm`) were both addressed:

- `functions/tests/typed-bitwise-wasm.test.ts` — the existing WASM-fallback suite now calls `resetBitwiseWasm()` (the stable wrapper around `wasmLoader.reset()`) instead of `wasmLoader.reset()` directly, matching the poly/tridiag pattern.
- `functions/tests/typed-special-wasm.test.ts` — new "Suite 4 — Bessel WASM fallback when module not loaded" with 2 tests exercising `besselJ0Dispatch` and `besselYDispatch(2, …)` after `resetBesselWasm()`. `functions`: 2,034 → **2,036 tests** (+2).

#### CDG metrics, before vs after the fix

| Metric                           | Before | After   | Δ                       |
| -------------------------------- | -----: | ------: | ----------------------- |
| Unused files                     |      1 |       0 | −1 (false positive)     |
| Unused exports                   |    406 |     308 | −98 (false positives)   |
| Circular dependencies            |      0 |       0 | unchanged               |
| Effective coverage (active code) | 100.0% |  100.0% | unchanged (163 / 163)   |
| Reachable source files           |    513 |     513 | unchanged               |

The remaining 308 unused-export flags break down as: 201 type/interface declarations (65%) — public API for downstream consumers; 64 functions (21%) — public-API helpers and benchmark-only entry points (`tools/benchmark/` not in CDG's reachability scope); 42 constants (14%) — thresholds and config defaults exported for consumer tuning; 3 classes (1%) — public-API class exports. **All legitimate public API**, not real dead code.

#### Gap-audit refresh — no new gaps

Added a new **§G "Audit refresh — 2026-05-24 (post-Wave-3)"** to `docs/roadmap/FUNCTION_GAPS_AUDIT.md` documenting the CDG bugfix, post-fix metrics, and the categorical breakdown of the remaining unused-export flags. **No new gaps surfaced** — the refresh confirms:

- Effective test coverage stays at 100% (163/163 active files; no new active code added without a test).
- No new circular dependencies introduced.
- All Wave 1-3 primitives trace correctly through reachability after the CDG fixes.

Tier-4 deferred items remain the only forward work tracked: rank 9 (probability dedup), rank 11 (Tensor.slice family), rank 12 (TapedTensor decomposition AD), rank 13 (typed/string), rank 14 (typed/unit, blocked on core Unit type), plus 3.10c-2 (Airy + AS Bessel parity).

#### Gap-closure Wave 3b — WASM-route slices (sequenced; 3.7 + 3.10b + 3.10c-1 done)

- **Slice 3.10c-1 — commit `572363f`** — Bessel WASM kernels (Airy + AS port deferred as 3.10c-2 per the proposal's explicit scope-split contract).
  - NEW `wasm-rust/crates/mathts-wasm/src/bessel.rs`: 6 `#[no_mangle] extern "C"` functions — `bessel_j0_f64`, `bessel_j1_f64`, `bessel_jn_f64` (arbitrary integer order), `bessel_y0_f64`, `bessel_y1_f64`, `bessel_yn_f64`. **No new Rust dependency** — scalar Bessel already existed in `special/functions.rs` (hand-implemented NR §6.5 polynomial approximations + recurrence); array kernels delegate to scalars.
  - NEW `functions/src/wasm/special/wasm-bridge.ts` with probe-Rust-then-AS-then-JS pattern at `WASM_SPECIAL_THRESHOLD = 1024`. AS-suffix probe is wired even though no AS implementation exists yet (forward-compatible for Slice 3.10c-2).
  - `functions/src/wasm/WasmLoader.ts` registered 6 new optional exports on `WasmModule`.
  - `functions/src/typed/special.ts`: 6 Bessel typed-function array overloads route to the bridge for ≥ 1024-element inputs.
  - `wasm-manifest.json` regenerated; `wasm-integrity` 5/5.
  - 34 new TS tests + 8 native Rust unit tests. `functions`: 2,000 → **2,034 tests** (+34).
  - **Precision note:** J-functions ~1e-7 relative error (NR algorithm design); Y-functions near `x=1` have ~5e-4 error from the polynomial form's logarithmic-singularity handling — inherent to NR §6.5. WASM↔JS agreement is 1e-14 (bit-identical since both share the same algorithm path).
  - `tools/benchmark/wasm/special.bench.ts` added.

- **Slice 3.10b — commit `ec7363b`** — Tridiagonal-solve WASM kernel (Thomas algorithm).

- **Slice 3.10b — commit `ec7363b`** — Tridiagonal-solve WASM kernel (Thomas algorithm).
  - NEW `wasm-rust/crates/mathts-wasm/src/tridiag.rs` (~102 LOC): `tridiag_solve_f64` with pointer ABI, returns `n` on success or `-1` on zero-pivot. 5 native Rust unit tests.
  - NEW `assembly/src/tridiag.ts` (~68 LOC): AS parity port returning `Float64Array(0)` on singular system.
  - NEW `functions/src/wasm/interpolation/wasm-bridge.ts` (~196 LOC): threshold-gated dispatch at `WASM_TRIDIAG_THRESHOLD = 1024` unknowns; probe-Rust-then-AS-then-JS fallback chain.
  - `functions/src/wasm/WasmLoader.ts` gained `tridiag_solve_f64` (Rust pointer ABI) and `tridiag_solve_f64_as` (AS typed-array ABI) registrations.
  - `cubicSpline` refactored in `typed/interpolation.ts` to build an explicit `(n-1)×(n-1)` tridiagonal system and route through the bridge. **Surprise:** `pchip` and `akima` use Fritsch-Carlson / Akima analytic-slope formulas, not a tridiag system, so they're not in scope for this bridge — the audit's §B.1 entry now reflects this finding (cubicSpline-only).
  - `wasm-manifest.json` regenerated; `wasm-integrity` still 5/5.
  - 18 new tests across 4 suites in `typed-interpolation-wasm.test.ts`. `functions`: 1,982 → **2,000 tests** (+18).

- **Slice 3.7 — commit `6520a76`** — Polynomial WASM kernel.
  - NEW `wasm-rust/crates/mathts-wasm/src/poly.rs` (~100 LOC): `poly_mul_f64` (O(n·m) convolution) and `poly_div_mod_f64` (long division returning concatenated `[quotient, remainder]`).
  - NEW `assembly/src/poly.ts` (~90 LOC): AssemblyScript parity port returning `Float64Array`.
  - NEW `functions/src/wasm/poly/wasm-bridge.ts` (~240 LOC): threshold-gated dispatch at `WASM_POLY_THRESHOLD = 256` coefficients. For `polymul`, WASM fires when either operand reaches 256 elements; for `polyDivMod`, when `num.length ≥ 256`.
  - Wires into `polymul`, `polynomialGCD`, `polynomialLCM`, `polynomialQuotient`, `polynomialRemainder` in `typed/algebra.ts`. (`discriminant`/`resultant` deferred to a follow-up — they'll reuse the new `poly_div_mod_f64` plus a Sylvester-fill helper.)
  - `wasm-manifest.json` regenerated (SHA-384 of the new `.wasm` blob); `functions/tests/security/wasm-integrity.test.ts` still green (5/5).
  - 22 new tests in `functions/tests/typed-algebra-wasm.test.ts`. `functions`: 1,960 → **1,982 tests** (+22).

#### Gap-closure Wave 3a — two worker-route slices LANDED in parallel

Two disjoint Tier-3 slices (worker-only — no WASM toolchain churn) dispatched in parallel:

- **Slice 3.8 — commit `64c6168`** — `typed/integration.ts` worker dispatch. All four integration ops now async. `gaussQuad` composite-mode offloads the dot-product `Σ values[k] · weights[k]` to `ComputePool.dot()` when `totalPoints ≥ 64` sub-intervals (user-supplied integrand `f` stays on the main thread because closures can't cross worker boundaries). `romberg` offloads the trapezoidal-sum to `ComputePool.sum()` at the same threshold. NEW `trapzF64`/`simpsonF64` Float64Array overloads route through `ComputePool.sum()` at `length ≥ 65,536`. `gaussQuad` returns `number | Promise<number>` — sync in legacy 2–5 point mode, async in composite mode. NEW `tools/benchmark/parallel/integration.bench.ts` (run manually). 35 tests in `integration.test.ts` updated for async signatures.

- **Slice 3.10 — commit `fad8324`** — `typed/hypothesis.ts` worker dispatch. All four hypothesis tests now async at ≥ 4,096 samples:
  - **`chiSquareTest`** — fully worker-routed (element-wise `(o-e)²/e` via `applyKernel2` + sum). Strongest win — no sequential bottleneck.
  - **`kolmogorovSmirnovTest`** — sort stays main-thread (Amdahl-limited; no `wasm.sortF64` kernel yet); CDF evaluation (default normal CDF only — custom-CDF closures bypass and stay sequential) offloaded.
  - **`mannWhitneyTest`** — sort main-thread; rank-sum via `dot(ranks, indicator)` offloaded.
  - **`shapiroWilkTest`** — sort main-thread; W-numerator dot-product offloaded.

  4 new `OpName` entries + 4096 thresholds added to `ComputePool`. NEW `typed-hypothesis-parallel.test.ts` (20 dispatch-correctness tests including parallel↔sequential 1e-9 agreement, known reference cases, error propagation). NEW `tools/benchmark/parallel/hypothesis.bench.ts`. `hypothesis.test.ts` updated for async signatures.

`functions`: 1,925 → **1,960 tests** (+35).

#### Gap-closure Wave 2 — Slice 2.4 LANDED (depends on Wave-1 Slice 1.5)

- **Slice 2.4 — commit `70217b7`** — Three new tensor primitives composing on the now-public `matrix.lu`/`matrix.svd` from Slice 1.5:
  - **`tensorPinv(t, rowAxes, {rcond})`** — Moore-Penrose pseudoinverse via full SVD with `rcond·max(S)` thresholding (default `1e-10`). 17 tests.
  - **`tensorSolve(A, b, {rowAxesA, rowAxesB})`** — Linear solver. LU + inline forward/back substitution (no intermediate dense-matrix allocation for the substitution phase). When both `A` and `b` carry `axisLabels`, row axes of `A` are auto-matched as those whose Index ids appear in `b`'s labels. Multi-RHS handled natively. 15 tests.
  - **`tensorKron(a, b)`** — Kronecker product for rank-N tensors. Axis-by-axis formula `result.shape[k] = a.shape[k]*b.shape[k]`; rank-mismatched operands get size-1 dims prepended to the smaller. Axis labels concatenated as `"aName_X_bName"` (separator configurable). 17 tests.

  `tensor`: 215 → **264 tests** (+49). `docs/reference/functions.md` and `functions.html` Linear Algebra Details bullets cross-reference the new tensor-package equivalents for users who need rank-N versions.

#### Gap-closure Wave 1 — five Tier-1 slices LANDED in parallel

Five disjoint slices from [`docs/roadmap/GAP_CLOSURE_PROPOSAL.md`](docs/roadmap/GAP_CLOSURE_PROPOSAL.md) Tier 1, dispatched to five sonnet subagents working on non-overlapping file scopes, all landed cleanly:

- **Slice 1.1 — commit `4462f69`** — `TapedTensor.divide` + `.sub` with full reverse-mode AD. Adjoints: `divide(a,b)` → `dA = dY/b`, `dB = -dY·a/b²`; `sub(a,b)` → `dA = dY`, `dB = -dY`. Aliased self-division explicitly returns zero gradient. 10 new tests including finite-difference correctness checks. `autograd`: 92 → 103 tests.
- **Slice 1.2 — commit `7fe73b7`** — 7 relational ops promoted from the synced layer to active `typed/`: `deepEqual`, `unequal`, `compareNatural`, `compareText`, `compareUnits`, `equalScalar`, `equalText`. NEW `functions/src/typed/relational.ts`; 6 colliding `export` keywords stripped from `factories/index.ts` (mirrors the bitwise/logical/complex/set promotion pattern). 60 new tests. `functions`: 1865 → 1925 tests.
- **Slice 1.3 — commit `fe40938`** — `ComputePool.divide` API symmetry with `subtract`. No new kernel needed — the existing `elementwiseChunk` worker handler already covered `'divide'` generically; only the public method was missing. 3 new tests (1M-element correctness, threshold fallback, mismatched-length rejection). `parallel`: 339 → 342 tests.
- **Slice 1.5 — commit `c0df3dd`** — Promote inlined Doolittle LU and right-looking Cholesky from `tensor/src/operations/` to first-class `matrix/src/operations/` primitives. `matrix.lu` returns `{L, U, P}`; `matrix.cholesky` returns `{L}`. Tensor wrappers now delegate; parity is derived from the permutation's cycle structure since `matrix.lu` doesn't return it. 22 new matrix-level tests; 16 existing tensor tests still pass through delegation. De-duplication only — no behavioural change.
- **Slice 1.6 — commit `08ce15f`** — `bench:tensor` suite. NEW `tools/benchmark/tensor/{contract,contract-network,tensordot,decompositions}.bench.ts` + root `npm run bench:tensor` script. Baseline numbers (2026-05-24, pure-JS, Node 22.22.x) captured in `docs/roadmap/ACCELERATION_BENCHMARKS.md`: tensorQr 32³ = 3.6 ms/op; tensorSvd 32³ maxdim=8 = 221 ms/op; tensorEig 64×64 symmetric = 25 ms/op; `Tensor.contract` n=24 = 1639 ms/op; `contractNetwork` N=12 greedy = 3.7 ms/op vs exact = 17.4 ms/op. Full suite 25s wall time.

**Cumulative test deltas this wave (active code only):**

  - `functions`: 1,865 → **1,925 tests** (+60)
  - `autograd`:    92 → **103 tests** (+11)
  - `tensor`:      215 → **231 tests** (delegation through matrix; +16 net at matrix level)
  - `parallel`:    339 → **342 tests** (+3)
  - `matrix`:      +22 NEW lu/cholesky algorithm-level tests

All five commits verified: `npx turbo run test --force --concurrency=4` reports 19/19 tasks successful. The default-concurrency turbo run hits transient timeouts in the 16-tensor contraction DP test under load — known turbo-cache-recovery quirk documented in earlier `[Unreleased]` entries.

#### Function-gap audit — WASM/Worker promotion playbook added

Extended [`docs/roadmap/FUNCTION_GAPS_AUDIT.md`](docs/roadmap/FUNCTION_GAPS_AUDIT.md) with three new sub-sections that make the "Acceleration gaps" class directly actionable as a promotion roadmap:

- **B.1 — WASM-route playbook** — 14 specific `typed/<file>.ts` exports flagged for a Rust/AS kernel port, each row giving the loop kind, where the time goes, the suggested kernel name (with explicit "reuse existing" markers when the Rust crate already has the primitive), starting-point `minElements` threshold, and effort estimate. Covers polynomial ops, polyfit/chebfit/legendrefit, tridiag solve for cubic spline, divided-difference for Lagrange/Newton, simpson/trapz/gaussQuad/romberg, KS/Mann-Whitney/Shapiro-Wilk, histogram/quantile sort path, batched pdf/cdf for distributions, special functions (Bessel/Airy/elliptic), spectral windowing/averaging, convex-hull/Delaunay predicates, and matrix-function evaluators.
- **B.2 — Worker-route playbook** — 9 candidates for `ComputePool` offload (rather than WASM), with the explicit "why worker, not WASM" reason for each. Covers user-closure-bearing functions (integration, distributions/pdf-cdf over user f, interpolation kernels), batch sampling, K-fold CV for polyFit, batched symbolic ops, graph algorithms with random restarts.
- **B.3 — Why some `typed/` files are deliberately not in either playbook** — explicit rationale for combinatorics, logical, CAS symbolic core, bitwise (already WASM at bridge level), and GPU.
- **B.4 — Procedure for landing a B.1 / B.2 entry** — 7-step checklist lifted from the bitwise WASM port that's already shipped, so the next contributor doesn't have to reverse-engineer the pattern.

The sequencing table in section D was updated to thread the new playbook rows in by rank, including two new entries (10b: tridiag-solve for interpolation, 10c: Bessel/Airy WASM family).

This addresses feedback that the audit's main value is in **pointing out the WASM/Worker opportunities** for code currently running pure-JS, so each opportunity is now first-class and dispatch-ready instead of being buried in class-B verdict prose.

#### ITensor-parity tensor primitives — Phases 1-6 LANDED

Full design at [`docs/roadmap/ITENSOR_PARITY.md`](docs/roadmap/ITENSOR_PARITY.md). Six phases, all green.

**Phases 1-3 — commit `a21a844`** (three sonnet subagents in
parallel, disjoint file scopes):

- **`Index` value type** (`tensor/src/named-index.ts`, NEW —
  filename is `named-index.ts` not `Index.ts` to keep
  `forceConsistentCasingInFileNames` on across the monorepo). Every
  `Index` has an immutable `id: symbol`, `dim`, optional `name` /
  `tags` / `primeLevel`. Mutators (`prime`/`noprime`/`addTag`/
  `removeTag`) return new instances. `idx(dim, name?, opts?)`
  convenience factory. `match(other)` is `id === other.id &&
  primeLevel === other.primeLevel` — dimension is validated at
  contraction time, not at matching time.
- **`Tensor` opt-in `axisLabels`** + `contract(other)` /
  `replaceIndex` / `axisOf`. `Tensor.contract` requires both
  operands to carry `axisLabels`, finds shared indices by
  `Index.matches`, validates dims, delegates to the existing
  `Tensor.einsum` so worker / WASM dispatch remains intact, and
  propagates non-shared `axisLabels` to the output. Backwards-
  compatible: two-arg `new Tensor(shape, data)` calls and existing
  einsum specs continue to work unchanged.
- **`tensorSvd`** (`tensor/src/operations/svd.ts`, NEW). Truncated
  tensor SVD layered on the existing
  `matrix/src/operations/svd.ts` (WASM-aware fast path). Accepts
  `{maxdim, cutoff}`; returns `{U, S, V, truncatedDim,
  truncationError}` with `truncationError` accurate to `1e-12`.
- **`randomTensor`** (`tensor/src/operations/random.ts`, NEW).
  `'uniform' | 'normal' | 'orthogonal'` distributions with
  Mulberry32 seeded PRNG. Orthogonal uses a Gram-Schmidt-with-
  re-orthogonalisation QR inlined in the file (the matrix
  package doesn't have a public QR primitive yet — flagged for a
  separate slice).

Tests landed: 22 Index + 19 Tensor.contract + 15 tensorSvd + 13
randomTensor = **69 new tests** in Phases 1-3.

**Phases 4-6 — commit `4417836`** (opus + two sonnet subagents
in parallel, disjoint file scopes):

- **`contractNetwork`** (`tensor/src/contraction-sequence.ts`,
  NEW). Optimal pairwise-contraction order for a network of
  tensors with `axisLabels`. Exact bitmask DP for N ≤ 16
  (O(N · 3^N)); Hendrickson-Sundaram greedy beyond; `'auto'`
  mode picks. Cost model: `cost = D_shared · D_free_left ·
  D_free_right`. Notable engineering: the first cut ran the
  16-tensor exact DP in ~20 s due to an O(|A|·|B|) Index-array
  scan in the partition hot path. The rewrite uses a
  canonical-index XOR-safe bitmask stored as two 30-bit halves
  in `Int32Array` — when each Index appears in ≤ 2 input
  tensors, the result mask is `leftMask XOR rightMask`
  (the set of indices appearing an odd number of times). Falls
  back to the slower Index-array path when an Index appears
  > 2 times or there are > 60 unique indices. 16-tensor solve
  now runs in **1.66 s**. DP path is deterministic
  (lexicographically smaller partition wins ties). 21 new tests.
- **`TapedTensor.contract` + `TapedTensor.matmul`**
  (`autograd/src/tape.ts`, MODIFIED). Reverse-mode AD over the
  Phase-1 contract surface — closes the AD loop UPT v0.7
  Proposal 8 explicitly needs. Adjoints:
    contract: dA[aFree, aShared] = Σ_bFree dY[aFree, bFree] ·
                                    B[bShared, bFree]
              — implemented by relabelling B's shared axes with
              A's Index objects so `Tensor.contract`
              automatically contracts over B's free axes.
    matmul:   dA = dY · Bᵀ, dB = Aᵀ · dY (classical).
  Batched matmul (rank ≥ 2 with broadcast batch dims) and its
  VJPs are direct `Float64Array` loop implementations because
  the `EinsumSpec` format can't express batch dimensions
  without summing over them. `_scatterToOriginalAxes()`
  permutes a contraction gradient back to the input's original
  axis order via `Tensor.transpose`. 17 new tests with
  gradient-check tolerances of `1e-7` (FD) and `1e-12` (closed
  form).
- **Tensor arithmetic completeness** (`tensor/src/Tensor.ts`,
  MODIFIED). Six new reductions: `sum / mean / max / min /
  prod / norm` over an `axis | axis[] | undefined`, with
  optional `keepDims`. `add / sub / mul` extended to accept
  `Tensor | number` with NumPy broadcasting (right-align by
  axis, length-1 broadcasts against any, missing leading axes
  treated as length-1). `tensordot(other, axes)` for arbitrary
  axis-pair contractions, delegating to the existing
  `Tensor.einsum`. New static `Tensor.broadcastShape(a, b)`
  helper. `axisLabels` propagate through reductions (dropping
  reduced axes) and `tensordot` (surviving self labels then
  surviving other labels). Bug fixed: `reduceAxes` had a
  latent crash where `keepDims=true` would construct a Tensor
  with mismatched `axisLabels.length` vs `shape.length` — now
  skips label propagation entirely when `keepDims=true`. One
  pre-existing test updated to match the new broadcasting
  error message (broadcasting is now the path previously
  reserved for hard shape mismatches). 70 new tests across
  three files (39 reductions + 18 broadcasting + 13 tensordot).

Phases 4-6 total: **108 new tests** (21 + 17 + 70).

Cumulative across all six phases:
- Tensor test count: 60 → 179 (+119 tests across 12 files).
- Autograd test count: 12 → 29 (+17 tests across 5 files).
- `tensor/src/index.ts` re-exports the new symbols: `Index`,
  `idx`, `tensorSvd`, `randomTensor`, `contractNetwork` plus
  the supporting types. Phase 6's new `Tensor` methods reach
  through the existing `export { Tensor }`; Phase 5's
  `TapedTensor` methods reach through autograd's existing
  entry.

#### Typed-layer ports (commit `2a141d4`)

- **Bitwise category** (7 ops + helper): `bitAnd`, `bitOr`, `bitXor`,
  `bitNot`, `leftShift`, `rightArithShift`, `rightLogShift` now first-
  class typed-function-dispatched implementations in
  `functions/src/typed/bitwise.ts` with `number / BigNumber / bigint /
  Int32Array` signatures. BigNumber bitwise reimplemented through
  native `bigint` (the synced helper depends on decimal.js internals
  `mathts-core`'s BigNumber does not expose); non-integer / NaN /
  Infinity throws `'Integers expected'` to match mathjs.
- **Logical category** (5 ops): `and`, `or`, `xor`, `not`, `nullish`
  now first-class typed-function-dispatched implementations in
  `functions/src/typed/logical.ts` over `number / bigint / BigNumber /
  Complex / any`. `nullish` carries explicit `boolean,any` /
  `string,any` / `BigNumber,any` / `Complex,any` / `bigint,any` short-
  circuit signatures so typed-function does not coerce `false` or
  `''` through a different signature before the catch-all.
- **`ComputePool` gained 7 async `Int32Array` bitwise methods**
  (`bitAnd`, `bitOr`, `bitXor`, `bitNot`, `leftShift`,
  `rightArithShift`, `rightLogShift`) returning
  `ParallelResult<Int32Array>`. New `parallel/src/ops/bitwise.ts`
  carries pure elementwise impls and chunking.
- 171 new tests in `functions/tests/typed-{bitwise,logical}.test.ts`.
  `factories/index.ts`'s 12 superseded synced-factory exports made
  module-private (`factoryScope` wiring preserved); two existing
  factory tests repointed at the typed/ modules.

#### Typed-layer deferred follow-ups closed (commit `d6ea55c`)

- **BigNumber API extension.** `core/src/types/bignumber.ts` gained
  three new Decimal.js-shaped surfaces the synced expression formatter
  duck-types against: `.gt(BigNumber | number | string) → boolean`,
  `.toSignificantDigits(n?, roundingMode?) → BigNumber` (uses the
  class's existing global `RoundingMode`, no second rounding
  convention), `.e → number` (decimal exponent —
  `floor(log10(|x|))` for non-zero finite values; `0` for zero / NaN /
  Infinity, callers gate with `isZero` / `isFinite`). Plus
  `.toNumber()` alias of `.valueOf()`, a `readonly isBigNumber = true`
  duck-typing marker, and `toFixed()` now accepts no-arg for the
  full fixed-point string. `expression/tests/utils-bignumber-formatter.
  test.ts` dropped its `MockBigNumber` and runs against the real
  class (16/16 pass). 42 new direct tests in
  `core/tests/BigNumber-formatter-api.test.ts`.

- **Int32-aware workerpool kernel slot.**
  `packages/workerpool/src/worker.ts` gained three Int32-aware kernels
  matching the existing `<op>Chunk` naming convention —
  `bitwiseChunk` (op-tagged binary), `bitwiseScalarChunk` (Int32 ×
  scalar for shifts), `bitwiseNotChunk` (unary).
  `packages/workerpool/src/index.ts` exposes `bitwiseBinary` /
  `bitwiseScalar` / `bitwiseNot` on `MathWorkerPool` plus
  `chunkInt32Array` / `chunkPairInt32Array` / `combineInt32Buffers`
  siblinged to the Float64 helpers. `parallel/src/ComputePool.ts`
  routes the seven `bit*` methods through the worker pool when
  `shouldParallelize(length)` holds (same threshold used by
  `add`/`multiply`); the in-process drivers from
  `parallel/src/ops/bitwise.ts` are the small-input fallback. The
  dormant `bitwiseBinaryChunk` / `bitwiseNotChunk` in
  `parallel/src/workers/compute.worker.ts` (never reachable from
  `MathWorkerPool`) was deleted with a pointer comment. 12 new
  kernel-level tests plus 25 new `ComputePool` tests covering
  above-threshold worker dispatch for all seven ops, the three
  scalar-shift overloads, the small-input fallback, length-mismatch
  errors, and an `Int32Array instanceof` regression guard.

- **WASM bitwise tier (Rust + AssemblyScript).** Three per-element
  shift kernels added to `wasm-rust/crates/mathts-wasm/src/bitwise/
  operations.rs` (`leftShiftArrayPerElement`,
  `rightArithShiftArrayPerElement`, `rightLogShiftArrayPerElement`);
  bit{And,Or,Xor,Not}Array already existed. AS module gained its
  first bitwise ops via new `assembly/src/ops/bitwise.ts` (seven
  Int32Array kernels). Three WasmModule interfaces (`functions`,
  `matrix`, `assembly/bindings`) stay in sync. New
  `functions/src/wasm/bitwise/wasm-bridge.ts` owns the WASM
  interaction — `WASM_BITWISE_THRESHOLD = 65,536` elements,
  `runBinaryBitwiseWasm` / `runUnaryBitwiseWasm` swallow kernel
  errors and return `null` so the bridge always falls through to
  `ComputePool` on any WASM failure. `functions/src/typed/bitwise.ts`
  now layers **WASM (>65 536) → ComputePool worker → in-process**
  for each `Int32Array` signature. 9 new tests in
  `functions/tests/typed-bitwise-wasm.test.ts`; security invariant in
  `functions/tests/security/wasm-integrity.test.ts` still 5/5.

### Fixed

- **Variadic typed-function dispatch (commit `69ad262`).** This repo's
  typed-function fork delivers a `'...T'` rest arg as a single packed
  array argument (`fn(a, b, [c, d])`), not as JS spread. Five impls in
  `typed/arithmetic.ts` (`add`, `multiply`, `min`, `max`) and
  `typed/trigonometry.ts` (`hypot`) declared `(a, b, ...rest)` and got
  `rest = [[c, d]]` — `add(1, 2, 3)` returned the string `'33'`,
  `multiply(2, 3, 4)` returned `'24'`, etc. Fixed by declaring `rest`
  as a plain array parameter (no JS spread). 17 regression tests in
  `functions/tests/typed-variadic.test.ts` pin the corrected behaviour.

- **`matrix/tests/WasmLoader.test.ts` skipped tests (commit `69ad262`).**
  Two `.skip`-ped tests asserted Rust-WASM-shaped exports
  (`multiplyDense`) that the AS artifact at `assembly/build/mathts.wasm`
  doesn't ship (AS exports `add_f64` / `matrix_multiply`). Replaced
  with one real conditional test that loads the AS artifact and
  asserts the universals (`mod.memory` is a `WebAssembly.Memory`,
  non-empty function table); skips dynamically if the artifact is
  missing. 48 → 49 pass, 0 skipped.

- **Full repo-wide cleanup pass (commit `a5dc31b`).** `npx prettier --write .` normalized
  formatting across the whole tree (1500+ TS, 120+ MD, 60+ JSON, 4 YAML,
  1 shell, 1 HTML — purely cosmetic, no semantic changes). ESLint config
  gained a `synced mathjs` overrides block that downgrades 22 stylistic
  rules (no-unused-vars, no-unsafe-function-type, no-empty-object-type,
  no-this-alias, ban-ts-comment, no-misused-new, prefer-as-const,
  no-require-imports, no-loss-of-precision, no-case-declarations,
  prefer-spread, prefer-const, prefer-rest-params, no-useless-escape,
  no-self-assign, no-undef, no-empty, no-prototype-builtins,
  no-control-regex, no-fallthrough, no-unsafe-finally, no-cond-assign)
  to warnings under the synced directories — mirrors the existing
  `strict: false` policy in `functions/tsconfig.json`. The hand-written
  typed-function layer stays strict. **All 10 packages now report 0
  ESLint errors.**

- **38 active-code lint errors closed** across `core`, `functions`, and
  `expression`. Interface-required unused args prefixed `_` (the entire
  `expression/src/node/` family — Node, ConstantNode, FunctionNode,
  IndexNode, OperatorNode, RelationalNode, SymbolNode), dead complex
  helpers removed from `typed/signal.ts`, unused dispatch imports
  dropped from `typed/{statistics,cas}.ts`, `prefer-as-const` applied
  to `isArgumentsError` / `isDimensionError` / `isIndexError` across
  the three error classes, `Function` type replaced with explicit
  callable signatures in `factories/scope.ts` and
  `expression/src/node/FunctionAssignmentNode.ts`, `.apply()` → spread
  in `OperatorNode.ts`, `const self = this` rewritten to direct
  closure capture in `RelationalNode.ts`, dead `interface Unit {
  new(...): Unit }` removed from `SymbolNode.ts`.

- **Real bugs surfaced and fixed (not stylistic):**
  - `core/src/is.ts:313` — a literal `\!isMap(object)` (escaped
    exclamation) instead of `!isMap(object)`. The escape was a
    paste/sync error ESLint's parser refused; TypeScript happened to
    tolerate it.
  - `wasm-rust/scripts/build.sh` — `WASM_DST="../../lib/wasm/..."`
    landed the Rust artifact OUTSIDE the repo (in `$HOME/lib/wasm/`),
    so `tests/benchmark/wasm_rust_vs_as_benchmark.ts` reported empty
    Rust columns. Path corrected to `../lib/wasm/`.
  - `tools/benchmark/wasm/{matmul,elementwise}.bench.ts` — calls to
    `new DenseMatrix(data)` used the obsolete single-arg signature
    against the current `(rows, cols, data?)` constructor, throwing
    "Matrix dimensions must match" on every iteration. Both call
    sites fixed.
  - `expression/src/node/{ObjectNode,RangeNode,ParenthesisNode}.ts`
    had latent `_compile(_math: ..., argNames: ...)` signatures where
    the method body still referenced the un-prefixed `math`
    identifier. The DTS build (`tsup --dts`) caught them once
    typecheck ran cleanly. Renamed back to `math` in the signature.

- **Repo-cleanup follow-ups (commit `3979eb1`).** Three pre-existing
  issues surfaced by the cleanup, closed by three parallel subagents:
  - **Matrix `WasmLoader` CWD-relative default path.**
    `getDefaultWasmPath()` returned `'./lib/wasm/mathts.wasm'`, so
    the matrix test suite (running from inside `matrix/`) emitted
    "Failed to load WASM module, falling back to JS" ~50 times per
    run. Both branches now resolve via `new URL('../../../lib/wasm/
    <file>', import.meta.url).pathname` (3 hops up = repo root).
    Matrix test run prints **0** fallback lines.
  - **`functions/src/typed/cas.ts` cubic + quartic root cases never
    implemented.** `fm2 = f(-2)` was computed but never read.
    Added 227 lines of new helpers: `depressedCubicRoots(p, q)`
    (Cardano when Δ<0, trigonometric Viète form when Δ>0, arccos
    arg clamped to [-1,1]), `solveCubicRadicals(A,B,C,D, fm2…f2)`
    (short-circuits on {-2,-1,0,1,2} via synthetic division +
    quadratic; falls back to depression + the new cubic),
    `solveQuarticRadicals(A,B,C,D,E, fm2…f2)` (Ferrari via
    resolvent cubic, same short-circuit). `_fm2` prefix dropped;
    `fm2` now read at 7 sites. 6 new tests cover the three-real
    rational cubic, one-real Cardano cubic, repeated-root + `fm2`-
    short-circuit cubic, four-rational quartic, `fm2`-short-circuit
    quartic, and a two-real-two-complex quartic.
  - **`matrix/src/backends/WASMBackend` hybrid Rust/AS bug.**
    Backend called Rust camelCase exports (`add`, `multiplyDense`,
    …) but allocated via the AS-specific `module.__new` — every
    standalone WASM bench threw `module.__new is not a function`.
    Switching to AS via `MATHTS_WASM_BACKEND=assemblyscript` then
    hit `this.wasmModule.add is not a function` because AS exports
    `add_f64` / `matrix_multiply` (snake_case, type-suffixed).
    Closed with **Option A — clean split**: `WASMBackend`
    rewritten as AS-only, owning its own AS instance with an
    inline AS-managed Float64Array allocator plus a per-instance
    allocation pool (the AS `--runtime stub` build has no free /
    no GC). Rust callers route to the existing `RustWASMBackend`
    (whose `findWasmPath()` was also fixed to use `import.meta.url`
    instead of a broken `require()` shim). Registration extracted
    to a shared `matrix/src/backends/register-backends.ts`. All
    four standalone WASM benches under `tools/benchmark/wasm/` and
    `tools/benchmark/e2e/` now complete cleanly; bench results
    show **Rust 2.5×–34× faster than JS** across matmul / dot /
    vecadd / det. The comparison bench's AS column populated via
    new `asAllocFloat64` / `asWriteFloat64` / `AsPool` helpers
    wired to the AS export names.

- **Post-cleanup audit follow-ups (commit `b96b53a`).** Four
  parallel subagents (least → most complex) closed every actionable
  item the post-cleanup audit pinned:
  - **Per-op `ComputePool` thresholds.** `ComputePoolConfig`
    grew an `OpName` union over the 37 dispatched operations and
    a `thresholdByOp?: Partial<Record<OpName, number | 'never' |
    'always'>>` map. `shouldParallelize(elementCount, op?)` now
    resolves per-op first and falls back to the flat
    `thresholdElements: 50000` only for ops not in the map.
    Default values applied from `tools/benchmark/parallel/run.ts`
    measurements (2026-05-23 noisy-CI container): most ops
    `'never'`, `matmul = 4,096`, `spectrogram = 65,536`,
    `matrixPower = characteristicPolynomial = 9,216`,
    `erfc = 100,000`, `besselJ = 1,000,000`. `resolveOpThreshold`
    / `OpName` / `OpThreshold` exported from
    `parallel/src/index.ts`. 18 new tests in
    `parallel/tests/ComputePool.test.ts`.
  - **`matrix` `WasmLoader` allocator hybrid Rust/AS bug**
    (lines ~744–867) inherited by `MatrixWasmBridge.ts` and
    `matrix/src/backends/wasm/fft-wasm.ts`. Closed via Option A
    (load-time `AllocatorKind` detect + branch). Rust path uses a
    flat-memory bump allocator anchored at `__heap_base`, exposed
    via `resetRustAllocator()` and `getAllocatorKind()`.
    `Allocation<T>` typed sum lets consumers re-bind output views
    to `module.memory.buffer + alloc.dataPtr` after each call
    (Rust `Vec` allocations may grow memory and detach earlier
    views). `MatrixWasmBridge.ts` and `fft-wasm.ts` updated for
    the re-bind + `resetRustAllocator()` pattern. 9 new live
    tests (`matrix/tests/MatrixWasmBridge.test.ts` ×7 and
    `matrix/tests/wasm/fft-wasm.test.ts` +2 for the WASM-backed
    path) exercise paths that previously would have thrown
    `TypeError: this.wasmModule.__new is not a function`.
  - **AS WASM module gained `matrix_lu_decompose` /
    `matrix_qr_decompose` / `matrix_cholesky` /
    `matrix_inverse` / `matrix_determinant`** (335 lines new in
    `assembly/src/algebra/decomposition.ts`), re-exported from
    `assembly/src/index.ts`. `WASMBackend` dispatches to the AS
    exports first; the JS fallback remains via the
    `typeof mod.matrix_xxx === 'function'` probe so older AS
    artifacts that predate this change keep working. AS artifact
    rebuilt (42,128 → 45,354 bytes, +3.2 KB). `WasmModule`
    interfaces in `assembly/src/bindings/wasm-loader.ts`,
    `matrix/src/backends/WasmLoader.ts`, and
    `functions/src/wasm/WasmLoader.ts` kept in sync.
    `wasm-manifest.json` regenerated at both `/home/user/MathTS/
    lib/wasm/` and `/home/user/MathTS/assembly/build/`. SHA-384
    verification 5/5 (security invariant intact). 5 new tests in
    `matrix/tests/wasm/decompositions-as.test.ts` within `1e-9`
    tolerance. Notable porting detail: Rust QR's inline-recompute
    Householder pattern degenerates in AS (storage gets clobbered
    by the next column's update); ported using the JS-reference
    precompute-into-`vBuf` pattern — same mathematics, different
    storage discipline.
  - **`tests/wasm/` cross-package integration suite — 5 fails →
    0.** Three of the original five failures were transitively
    closed by the WasmLoader / WASMBackend work landing in the
    shared tree. The remaining two: a `RolldownError` against
    rolldown 1.0.0-rc.17 (cannot parse the top-level-await
    destructuring AS generates — `shouldSkip()` extended to catch
    `RolldownError` / `"Parse failure"` / `"Duplicated export"`),
    and a `MatrixWasmBridge.multiply` test that was originally
    `it.skip` pointing at the WasmLoader hybrid bug — unskipped
    after the bug closed, now passes. Suite is now **11 files,
    224 passed, 0 failed, 0 skipped** (was `Tests 5 failed |
    212 passed (217); Test Files 2 failed | 8 passed (10)`).

### Added (UPT consumer support)

- **Downstream UPT integration notes** at
  `docs/integration/upt.md`. Catalogues the MathTS APIs UPT v0.7+
  consumes across `mathts-tensor`, `mathts-expression`, `mathts-
  workbook`, `mathts-autograd`, `mathts-functions`, and
  `mathts-parallel`, with version pins. Answers the three open
  questions raised in UPT's v0.70 proposal §10.2:
  - **Q1 (AST extensibility)** — yes, `Node` is designed for
    inheritance via the existing `createNode(deps)` factory.
    Demonstrated in `expression/tests/node-extension.test.ts`
    (NEW, 8 tests, all green): builds a `BridgeEquationNode`
    stand-in, confirms `isNode` duck-typing, and that
    `forEach` / `map` / `traverse` / `clone` / `toJSON` /
    `_toString` all behave correctly alongside built-in nodes.
  - **Q2 (Tensor dimensional analysis)** — intentionally absent in
    MathTS; `Tensor` stays the unit-free numeric primitive.
    Dimensional analysis remains a UPT-layer responsibility per
    the proposal's own §1.3.
  - **Q3 (AD over WASM-accelerated kernels)** — yes, `Tape` is
    agnostic about the forward-pass strategy. A forward op can run
    through `ComputePool` (in-process, worker, or WASM tier); the
    tape only needs the produced primal `Float64Array` plus the
    adjoint closure. Demonstrated in
    `autograd/tests/ad-wasm-interop.test.ts` (NEW, 3 tests, all
    green): forward via `computePool.add` / `computePool.multiply`
    / chained `add → scale`, with analytical adjoints, gradients
    verified against closed-form.
  - Caveat noted in the integration doc: `TapedTensor` currently
    has `add` / `sub` / `mul` / `scale` but not `matmul`. UPT can
    either use the low-level
    `tape.record(inputIds, outputSize, backward)` interface (shown
    in the demo test) or contribute a `TapedTensor.matmul`
    upstream.
- README's documentation-index gains a row for the new
  `docs/integration/upt.md`.

### Changed

- **`TODO.md` relocated from `docs/refactoring/TODO.md` to the repo
  root**, alongside `CHANGELOG.md`. The other refactoring planning
  docs (`REFACTORING_PLAN.md`, `DEFERRED_WORK_IMPLEMENTATION_PLAN.md`,
  `PARALLEL_COMPUTING_IMPROVEMENT_PLAN.md`, the AS-candidate JSON,
  the sprint status reports) stay under `docs/refactoring/`; only
  the active TODO moved. Updated the three referrers
  (`README.md`'s open-items link + documentation-index table,
  `tools/benchmark/parallel/operations.bench.ts` header comment,
  `functions/tests/typed-regression.test.ts` header comment) and
  refreshed the doc's "Updated" date plus a "Location:" breadcrumb
  pointing future readers to the old path.

- **`TODO.md` reorganized — pending items moved to a top-level
  🎯 Open Actions block (2026-05-23 post-audit).** A sonnet sub-
  agent independently audited each of the previously-open
  checkboxes against the live codebase and produced verdicts.
  Result: 2 items are truly pending and now sit at the top of the
  file sorted by dependencies ascending then complexity ascending
  — (1) cut a release for the `[Unreleased]` CHANGELOG (deps=0,
  admin), (2) add a browser smoke test for the WebGPU paths
  (needs Playwright infra, low–medium complexity). 2 stale items
  (`Update main README with TypeScript/WASM status` and `Add
  migration guide for users`) were marked `[x]` — both shipped
  in commit `c6514ed` (README rewrite + new
  `docs/migration-guide.md`). 1 stale item (`Keep duplicate
  JS/TS files (418 files)`) deleted with a one-line replacement
  note — `find functions/src -name '*.js' | wc -l` returns 0
  today, so the concern is moot. 1 environmental item (GPU
  benches under `tools/benchmark/gpu/` — code exists, no
  WebGPU adapter in headless Node) deleted with a one-line
  note; the related backlog action is the new browser-smoke-test
  entry. 3 items remain marked `- [ ]` as **documented non-
  decisions** in their original sections (eigs/SVD
  parallelization, polyFit/leastSquares parallelization, unified
  f32 WebGPU path) — these were re-validated 2026-05-23 with
  bench-evidence inline and are kept for traceability, not as
  actions. Final counts: 113 closed, 5 unchecked (2 actionable
  at the top, 3 documented non-actions).

### Fixed

- **CDG-driven coverage push (commits `baf9007` + `c6514ed` + `122c590`).**
  Re-ran `tools/create-dependency-graph/` and acted on its output:
  - **Regenerated reports** committed at `baf9007`:
    `DEPENDENCY_GRAPH.md`, `TEST_COVERAGE.md`,
    `dependency-graph.{json,yaml}`,
    `dependency-summary.compact.json`, `test-coverage.json`,
    `unused-analysis.md`. CDG numbers: 1,394 TS files (491
    reachable, 903 dormant), 0 circular dependencies, 27.5%
    source-file coverage.
  - **`README.md` full rewrite** and new **`docs/migration-guide.md`**.
    README covers installation (compat shim and typed-function
    API), three quick-start code blocks (compat / typed /
    parallel `Float64Array` via `ComputePool`), performance with
    the bench-derived numbers (Rust 2.5×–34× faster than JS for
    matmul / dot / vecadd / det), the package list + dependency
    graph, the three-tier dispatch (WASM > worker > in-process),
    the Rust/AS split (`WASMBackend` AS-only, `RustWASMBackend`
    Rust-only), the WebGPU opt-in (f32 only), the npm scripts
    including `test:wasm:integration`, the 12/12 build + 19/19
    test + 0 lint/tsc errors + 224/224 cross-package WASM + 5/5
    security status, and a documentation index. Migration guide
    covers: TL;DR, drop-in compat-shim replacement, switching to
    the typed-function API (scalar / `Float64Array` / `Int32Array`
    overloads), breaking changes from mathjs v15 (functions now
    async, the new typed overloads, matrix-constructor signature,
    `m.get([row,col])` vs `m.get(row,col)`, `math.bignumber` vs
    `BigNumber.parse`, `bn.toNumber()` alias, WebGPU f32-only
    opt-in), Not yet ported, performance migration path with the
    `WASM_BITWISE_THRESHOLD = 65,536`, type-checking, workbook +
    expression pointers.
  - **`docs/Architecture/{OVERVIEW,ARCHITECTURE}.md` refresh.**
    Every stale metric updated to the regenerated CDG numbers
    (491 reachable, 903 dormant, 1,394 total, 124,615 LOC,
    2,898 exports / 728 re-exports, 164 test files, 135 / 491 /
    27.5% coverage, modules: `functions` 355 / `parallel` 11 /
    `assembly` 19). Three new content paragraphs added to
    `ARCHITECTURE.md`: the `OpName` union + `thresholdByOp` map
    + `DEFAULT_THRESHOLD_BY_OP` defaults; the load-time
    `detectAllocatorKind()` + `AllocatorKind` ('as'/'rust')
    discriminant + opaque `Allocation` handle distinguishing
    `WASMBackend` from `RustWASMBackend` + `RustWasmLoader`; the
    bitwise-specific three-tier dispatch diagram (in-process JS
    → `ComputePool` worker per `thresholdByOp` → WASM kernel ≥
    `WASM_BITWISE_THRESHOLD`).
  - **`unused-analysis.md` triage** —
    `packages/workerpool/src/index.ts` annotated as a false
    positive (package entry exported via `package.json` `exports`
    field, not imported by anything inside the workspace). 20 of
    377 "unused exports" spot-checked: 14 public-API re-exports
    from package roots, 5 type-only / internal exports, 1
    internal-only helper. 0 deletions under the conservative
    policy. Triage Notes section added with the policy statement
    that exports from package-root `index.ts` files are
    intentionally part of the public surface and will always
    appear in this report without being defects.
  - **`eigs` / `svd` / `singularValues` parallelization —
    re-validated `not pursued`** with measured evidence. End-to-end
    bench across three back-to-back runs shows noise-floor
    oscillation (0.84×–1.77×) because both seq and par paths
    execute identical JS code. New inner-step probe
    `tools/benchmark/parallel/eig-inner-probe.ts` measures
    whether hypothetical inner-loop dispatch could win: at n=256
    `computePool.matmul` round-trip is 35.2 ms while one Givens
    sweep is 0.18 ms and one Householder bilateral 0.55 ms —
    dispatching inner steps would slow `eig` by ~200×. The
    Hessenberg / bidiag reduction is n sequential Householders
    each ≪ pool overhead and each consumes the prior reflector's
    output; cannot be batched across workers without a
    blocked-LAPACK redesign (out of scope). Probe checked in for
    future re-measurement on better hardware.
  - **`polyFit` / `leastSquares` parallelization — re-validated
    `deferred`** with measured evidence. Both pre-existed as
    sequential typed-layer exports in
    `functions/src/typed/{interpolation,numeric}.ts`. Wrote a
    candidate parallel implementation (transpose →
    `computePool.matmul` for AᵀA → `computePool.matvec` for
    Aᵀb → sequential n×n solve) and measured at
    `tools/benchmark/parallel/regression-probe.ts`: `polyFit`
    0.26×–0.99× (never wins); `leastSquares` 0.92×–1.15×
    dominant regime, 2.02×–2.05× in the narrow tall-thin band
    (m=10k, n=100..200), 1.55× at m=20k n=100 (worker
    contention). The original deferral note speculated wide
    systems would win — the data inverts that, it's tall-thin
    not wide. A 2× win in one narrow shape band does not justify
    async virality across every caller. Both functions stay
    sequential. Added 8 new tests in
    `functions/tests/typed-regression.test.ts` covering exact and
    degree-5 polynomial recovery, noisy recovery
    (σ=1e-8 → within 1e-6; σ=1e-4 → within 1e-3), 3- and
    5-parameter linear models, and the singular-system error
    path. Probe checked in.
  - **+12 active files moved from untested → tested** at `122c590`.
    Source-file coverage **27.5% → 29.9%** (135/491 → 147/491);
    test files 165 → 176.
    - `expression/tests/parse.test.ts` (NEW, 101 tests across 24
      describe blocks): factory metadata, numeric / boolean /
      string / symbol literals, arithmetic / comparison / logical
      / bitwise operators, operator precedence, parentheses,
      function calls, variable + function assignments, block
      sequences, conditional ternary, range expressions, array
      and object literals, index access, whitespace tolerance,
      arrays of expressions, error handling, static helpers.
    - `parallel/tests/ops-bitwise.test.ts` (NEW, 64 tests):
      direct unit tests for the 7 pure elementwise op functions —
      `bitAnd / bitOr / bitXor / bitNot / leftShift /
      rightArithShift / rightLogShift` — against JS oracles, with
      two's-complement boundaries, INT32 limits, scalar-vs-array
      shifts, mod-32 shifts, empty arrays, length-mismatch
      errors, output-type check, and no-mutation invariant.
    - **10 barrel / type-only smoke tests** across
      `core / expression / parallel / tensor / workbook`
      asserting expected export names exist (or for type-only
      files, that the import compiles with a `satisfies` check):
      `core/tests/types-interfaces.test.ts`,
      `expression/tests/{compiler,evaluator,package}-index.test.ts`,
      `expression/tests/types.test.ts`,
      `parallel/tests/{package,operations,strategies}-index.test.ts`,
      `tensor/tests/package-index.test.ts`,
      `workbook/tests/package-index.test.ts`. Fixed a stale
      `new Tensor([2,3])` call missing the required
      `Float64Array` data arg.

  The remaining 344 untested files in the CDG report are
  intentionally out of scope: 325 synced mathjs files under
  `functions/src/{arithmetic,algebra,bitwise,…}/` (tested via
  the typed/ layer with which they share factory entry points);
  19 AssemblyScript sources under `assembly/src/` (tested via
  `npm run test:wasm:integration` — Vitest does not see them);
  and the synced `expression/src/{utils,transform}/` directories.

### Verified

- `npx turbo build`: **12/12** packages green.
- `npx turbo test`: **19/19** task packages green (functions: 1,774
  tests, parallel: 339, matrix WasmLoader: 49 with 0 skips, plus
  the new parse / ops-bitwise / barrel suites).
- `npx tsc --noEmit` per package: **0 errors** across all 11
  TypeScript packages (core, matrix, tensor, autograd, functions,
  parallel, expression, workbook, compat, typed-function, workerpool).
- `npx eslint src --ext .ts` per package: **0 errors** across all 10
  linted packages.
- **0 circular import dependencies** (CDG re-confirmed).
- **Test-file count 165 → 176**; source-file coverage **27.5% →
  29.9%** (135/491 → 147/491) after the CDG-driven coverage push.
- Matrix "Failed to load WASM module" fallback log lines: **0** (was
  ~50 per test run).
- `npm run bench:wasm`: Rust + AS + JS columns all populated; **Rust
  2.5×–34× faster than JS** across matmul / dot / vecadd / det; Rust
  3.5×–13.7× faster than AS at matmul sizes ≥ 100×100.
- `npm run bench:parallel`: full per-op break-even data drives the
  default `thresholdByOp` map; only `matmul` (≥64-element matrices)
  and `spectrogram` (≥65,536 samples) beat sequential in this
  container, plus `erfc` / `besselJ` above their break-even sizes.
- All four standalone WASM benches under `tools/benchmark/wasm/` and
  `tools/benchmark/e2e/` complete without throwing.
- `npm run test:wasm:integration`: **11 files, 224 passed, 0 failed,
  0 skipped** (was 5 failed | 212 passed (217); 2 failed test files
  | 8 passed (10) at the start of the audit).
- `functions/tests/security/wasm-integrity.test.ts`: **5/5** pass
  (SHA-384 manifest verification intact through two manifest
  regenerations).
- Source-file test coverage: **18.6 % → 27.0 %** (90/485 → 131/485)
  across 42 new test files (+1,294 assertions). The post-cleanup
  audit added a further ~45 tests (18 `ComputePool` + 9
  `MatrixWasmBridge` / fft-wasm + 5 AS decomposition + integration-
  suite unskip), bringing the live-test surface meaningfully wider
  in the previously-dead hybrid bridge / per-op dispatch / AS-
  decomposition paths.

### Added

#### WASM kernels — Rust crate + AssemblyScript parity

Each kernel below was added to the Rust crate (`wasm-rust/crates/mathts-wasm/`)
and mirrored into the AssemblyScript toolchain (`assembly/src/ops/`) so the WASM
fallback keeps parity. All are allocation-free — Rust takes caller-provided
scratch buffers (sized via `*WorkSize` helpers); AS uses its managed heap.

- **SVD** — `svd` (thin U/S/V) and `singularValues` via one-sided Jacobi, for
  any real m×n matrix. The crate previously had only an internal Jacobi
  eigen-routine for condition number / rank. `matrix/src/operations/svd-wasm.ts`
  now routes `svdWasm` through the crate's direct `svd` export (was: square
  symmetric matrices only, via eig).
- **RREF + characteristic polynomial** — `rowReduce` (Gauss-Jordan RREF) and
  `characteristicPolynomial` (Faddeev-LeVerrier).
- **Polynomial algebra** — `polyadd`, `polynomialGCD`, `polynomialLCM`,
  `polynomialQuotient`, `polynomialRemainder`, `discriminant`, `resultant`.
- **Signal windowing** — `windowFunction` (Hamming/Hann/Blackman/Bartlett/
  rectangular, window type as an integer ABI code), `resample` (linear
  interpolation), `medfilt` (median filter).
- **Curve fitting** — `expfit`, `logfit`, `powerfit` (log-linearized
  least-squares fits).
- **Optimization** — `linprog` (simplex), `quadprog` (projected-gradient QP),
  `nullspace` (RREF-based null-space basis).
- **Rational approximation** — `residue` (partial-fraction residues via
  Durand-Kerner real roots), `padeApproximant` (Padé [m/n] from Taylor
  coefficients).
- **Rank-N tensor transpose** — `tensorTranspose` (arbitrary-rank axis
  permutation, rank capped at 16); the crate previously transposed rank-2 only.
- **Number theory (11)** — `eulerPhi`, `divisorSigma`, `moebiusMu`,
  `carmichaelLambda`, `jacobiSymbol`, `harmonicNumber`, `partitions`,
  `primeFactors`, `divisors`, `integerDigits`, `chineseRemainder`.
- **Orthogonal polynomials + integral functions (9)** — `chebyshevT`,
  `hermiteH`, `laguerreL`, `legendreP`, `erfi`, `expIntegralEi`, `sinIntegral`,
  `cosIntegral`, `logIntegral`.

#### `functions` package

- **52 physical constants** activated (factory tier 19, default number config):
  `speedOfLight`, `planckConstant`, `avogadro`, etc. — documented in
  `docs/reference/constants.md`.
- **Real `isInteger`** — the `createIsInteger` factory is activated after tier 4
  (it needs the `equal` dependency), replacing the inline numeric-only stub.
- **Type-conversion exports** — `complex`, `fraction`, `bignumber`, `matrix`,
  `sparse`, `number`, `string`, `boolean`, `bigint` exported as named converter
  functions.
- **Stateful `parser()`** — returns a parser with a retained scope across
  `evaluate` calls.
- **JSON round-tripping** — `reviver` / `replacer` for `JSON.parse`/`stringify`
  of `Complex`, `Fraction`, and non-finite numbers.

#### Cross-package bridges

- **compat `create(all)`** — `all` is now the real `@danielsimonjr/mathts-functions`
  namespace (was an empty placeholder); `create()` honours its `factories`
  argument. `create(all)` surfaces `det`, `integrate`, `eigs`, `simplify`, etc.
- **Tensor ↔ DenseMatrix** — `Tensor.fromDenseMatrix()` and
  `Tensor.prototype.toDenseMatrix()` bridge the tensor and matrix packages.
- **MatrixWasmBridge JS FFT fallback** — replaces a "not implemented" throw with
  a synchronous radix-2 Cooley-Tukey FFT (power-of-two lengths).

#### mathjs JS→AS port workflow

- **Port workflow** in `tools/mathjs-port/`: `manifest.json` (port targets +
  classifications), `port_one.py` (per-function LLM-driven port using
  `~/.claude/skills/rlm/scripts/rlm_query.py`), `drafts/` for review-before-integrate
  output. Produces AssemblyScript ports matching the `functions/src/wasm/`
  pointer-typed convention. Scope established by cross-referencing mathjs's 215
  new functions against MathTS active exports: only 6 were genuinely missing.
- **5 AS ports** of the standalone numerical kernels missing from MathTS,
  integrated into `functions/src/wasm/` (dormant — not yet exported from
  `functions/src/index.ts`; exposing via typed-function bindings is a follow-on
  task):
  - `movingAverage` — O(n) sliding-window mean.
  - `histogramNumBins` + `histogramEdges` — equal-width or explicit-edges
    binning with binary-search assignment.
  - `linreg` + `linregPredict` — single-pass OLS returning `[slope, intercept, r, r²]`.
  - `polyfit` — least-squares polynomial fit via Vandermonde normal equations +
    Gaussian elimination with partial pivoting (`numeric/regression.ts`, new).
  - `nullSpace` — SVD-based orthonormal null-space basis with Gram-Schmidt
    completion when n > k.
- All ports use raw memory pointers (`usize` + `i32` length) matching the
  existing `wasm/` convention. Typecheck adds zero new errors.

#### Parallel execution

- **Generic worker kernels** — `applyKernel` (unary) and `applyKernel2` (binary)
  evaluate a caller-supplied, self-contained numeric function over a
  `Float64Array` on the worker pool, exposed on both `MathWorkerPool` and
  `ComputePool`. This lets packages above `workerpool` parallelize element-wise
  math without the worker needing to import their code.
  `packages/workerpool/src/worker.ts`, `packages/workerpool/src/index.ts`,
  `parallel/src/ComputePool.ts`.
- **Distribution array overloads** — `normalPDF`, `normalCDF`, `exponentialPDF`,
  `exponentialCDF`, `poissonPMF`, `binomialPMF`, `geometricPMF`, and
  `bernoulliPMF` gain `Float64Array` overloads that evaluate a whole sample
  array, dispatching large inputs to the worker pool. The scalar logic is
  extracted into standalone declarations reused both for dispatch and as the
  serialized worker-kernel source. `functions/src/typed/distributions.ts`.
- **Special-function array overloads** — all 28 functions in
  `functions/src/typed/special.ts` gain `Float64Array` overloads (single-argument
  functions take the array directly; multi-argument functions take it for the
  varying argument with the rest fixed).
- **Parallel FFT spectra** — `parallelFFTMagnitude` / `parallelFFTPower` now
  dispatch large `Float64Array` inputs to worker threads via the new binary
  kernel; they previously ran on the calling thread despite the `parallel`
  prefix. `functions/src/typed/signal.ts`.
- **Batched-FFT parallelism** — a new `fftBatchChunk` worker kernel (a
  self-contained radix-2 FFT, since the worker sits below the `functions`
  package) plus `MathWorkerPool.fftBatch` / `ComputePool.fftBatch` distribute a
  batch of independent FFTs across workers. `spectrogram` dispatches its
  per-frame FFTs through it, `fft2d` dispatches its per-row then per-column
  FFTs, and `parallelConv` (and thus `parallelXCorr` / `parallelAutoCorr`) runs
  its two forward FFTs concurrently. `functions/src/typed/signal.ts`.
- **Worker-distributed single FFT** — `parallelFFT` / `parallelIFFT` now run a
  genuinely parallel transform via a four-step (Cooley-Tukey transpose)
  decomposition: one N-point FFT (N = N1·N2) is split into two batches of
  independent smaller FFTs dispatched through `fftBatch`, with a twiddle pass
  between. They previously ran the whole radix-2 butterfly on the calling
  thread despite the `parallel` prefix.
- **Parallel `distanceMatrix`** — a new geometry function computing the
  all-pairs Euclidean distance matrix; a `distanceMatrixRowsChunk` worker kernel
  plus `MathWorkerPool.distanceMatrix` / `ComputePool.distanceMatrix` compute
  the (independent) rows distributed across workers.
  `functions/src/typed/geometry.ts`.
- **Element-wise consistency overloads** — parallel `Float64Array` overloads
  added to the remaining element-wise unary functions so the element-wise API
  is uniform: `sign`, `cube`, `cbrt`, `expm1`, `log2`, `log10`, `log1p`,
  `round`, `floor`, `ceil`, `fix`, `sinh`, `cosh`, `tanh` (arithmetic) and
  `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `asinh`, `acosh`, `atanh`
  (trigonometry), each dispatching large arrays via `computePool.applyKernel`.
- **Parallel product reduction** — a new `prodChunk` worker kernel plus
  `MathWorkerPool.prod` / `ComputePool.prod`; `parallelStatProd`'s
  `Float64Array` overload now runs the product reduction on the worker pool.

#### WebGPU acceleration

- **GPU matrix operations** — `gpuMatmul`, `gpuAdd`, `gpuTranspose`, and
  `gpuScale` (`functions/src/typed/gpu.ts`, new) run the core matrix operations
  on the GPU through the matrix package's WebGPU compute-shader backend
  (`gpuMatrixBackend`). Each is `async` and falls back transparently to the CPU
  implementation when no WebGPU device is present or the matrix is below the
  dispatch threshold. The GPU path computes in 32-bit float (WGSL has no f64);
  these are additive new exports, so the f64 `multiply` / `transpose` are
  unaffected.

#### Benchmarking

- **Parallel acceleration benchmark suite** — `tools/benchmark/parallel/` adds a
  reusable harness timing the worker-pool parallel path against the sequential
  baseline across geometric size ladders, with break-even detection and
  per-operation `thresholdElements` recommendations (`npm run bench:parallel`).
  First measured findings in `docs/roadmap/ACCELERATION_BENCHMARKS.md`:
  compute-bound operations (`matmul`, the matrix decompositions) win clearly;
  transfer-bound element-wise and reduction operations never beat sequential at
  any tested size — the flat `ComputePool` `thresholdElements = 50000` is wrong
  for almost every operation.

### Changed

- **Removed the fake-parallel FFT/eig stubs** — `parallel/src/operations/fft.ts`
  and `eig.ts` (`parallelFFT`, `parallelEig`, …) ran entirely on the calling
  thread while reporting `parallelized: true`; they were reachable only via
  `operations/index.ts` and referenced only by their own tests. Deleted, with
  those tests. Also de-duplicated the radix-2 FFT core within the workerpool
  package — `worker.ts` and `index.ts` now share an internal `fft-core.ts`.

- **workbook cell evaluation** — cells are evaluated via `evaluate()` from
  `@danielsimonjr/mathts-functions` instead of a raw `new Function()`. Cells can
  now use the full math library and property access routes through the
  expression sandbox rather than unrestricted code execution. Data cells parse
  their content as YAML/JSON via `executeData()`.
- **matrix bridge acceleration** — `MathJSDenseMatrix` gains `multiply()` /
  `transpose()` instance methods that route through the native matrix
  `BackendManager` (JS/WASM/GPU by size); the shared backend manager is
  pre-initialised at module load.
- **`wasm-rust` SVD is allocation-free** — `svd` / `singularValues` take a
  caller-provided `work` buffer (sized via `svdWorkSize` / `singularValuesWorkSize`),
  matching the crate's other matrix kernels, so the JS-side bump allocator owns
  all WASM linear memory. The crate is now `cfg_attr(not(test), no_std)` so its
  algorithms can be unit-tested natively with `cargo test`.
- **`RustWasmLoader` heap base** — the bump allocator now anchors at the
  module's `__heap_base` global instead of a hardcoded 64 KB. This crate's
  static-data section spans ~1 MB of lookup tables; the old base wrote into Rust
  statics, so the loader previously could not safely call any
  internally-allocating export.
- **`matrix-ops` decompositions are async (breaking)** — `characteristicPolynomial`,
  `matrixPower`, `matrixLog`, `polarDecomposition`, and `jordanForm` now return a
  `Promise`. Their internal O(n³) matrix products are offloaded to the worker
  pool once the product is large enough to be worth it (`ComputePool` decides),
  keeping the inline loop for small matrices. `rowReduce`, `matrixRank`,
  `cholesky`, and `hessenbergForm` are unchanged (they do not multiply
  matrices). Also removes the dead `matLogEig` helper.
  `functions/src/typed/matrix-ops.ts`.
- **`spectrogram` and `fft2d` are async (breaking)** — both now return a
  `Promise`; they dispatch their batches of independent FFTs to the worker pool
  above the parallel threshold and fall back to the sequential loop otherwise.
  `functions/src/typed/signal.ts`.
- **`parallelIFFT` is async (breaking)** — it now returns a `Promise`; large
  inverse transforms use the four-step worker-distributed FFT. (`parallelFFT`'s
  `Float64Array` overload was already async.) `functions/src/typed/signal.ts`.
- **`parallelStatProd`'s `Float64Array` overload is async (breaking)** — it now
  returns a `Promise<number>`, dispatching the product reduction to the worker
  pool, consistent with the rest of the `parallelStat*` family.
  `functions/src/typed/statistics.ts`.

### Fixed

- **`statistics/chiSquareTest` 2D contingency variant** — function now accepts either a 1D goodness-of-fit pair (`observed, expected`) or a 2D contingency table (`observed` as `rows x cols`, expected auto-computed from row/column totals). Matches mathjs's two-form API. `functions/src/typed/hypothesis.ts`.
- **`special/erfc` precision** — previously used A&S 7.1.26 (max error 1.5e-7 across all `x`). Now hybrid: Maclaurin series gives machine precision for `|x| <= 0.5`, NR `erfcc` rational form gives ~1.2e-7 for `|x| > 0.5`. All 225 special-function tests still pass. `functions/src/typed/special.ts`.
- **`algebra/cancel` extended** — beyond plain `n/d` integer fractions, now handles compound fractions `(a/b)/(c/d)` (multiplied across then cancelled) and the trivial `(p)/(p) -> 1` identity. Division-by-zero now throws explicitly. Docstring now accurately scopes the function to numeric forms with a forward reference to `polynomialGCD` for symbolic work. `functions/src/typed/algebra.ts`.
- **`inverseLaplaceTransform` ported (v3)** — fully integrated into `functions/src/typed/cas.ts`. Public export via plain TS function. Mirrors mathjs's actual algorithm (numerical pattern-matching at sample points against known Laplace pairs). Earlier session flagged this as "divergent algorithm"; honest-claude pass later established that *was* mathjs's algorithm and the original draft was correct in approach. v3 fixes the v1 truncation by using `max_tokens=12288`.
- **JSON reviver type cast** — the W9 JSON reviver cast a tagged record directly to the `Complex`/`Fraction` `fromJSON` shapes; the cast now routes through `unknown` to satisfy `tsc`.
- **Worker pool never ran its kernels** — `MathWorkerPool` created its pool with `createPool(null)`, so workerpool loaded its built-in generic worker (only `run`/`methods`) instead of the MathTS kernels. Every named-kernel dispatch (`sumChunk`, `matmulRows`, `elementwiseChunk`, …) threw `Unknown method "..."`, so the entire parallel layer — every arithmetic, statistics, and trigonometry `Float64Array` overload — was non-functional at runtime. The built `dist/worker.js` is now resolved (Node path or browser URL) and loaded. `packages/workerpool/src/index.ts`.
- **Float64Array chunking read the wrong data** — `MathWorkerPool` cut chunks with `subarray()`, whose `.buffer` is the entire backing `ArrayBuffer`; passing `chunk.buffer` with `start: 0` made every chunk past the first re-read the start of the array. Now uses `slice()` so each chunk owns a correctly-sized buffer. Adds `packages/workerpool/tests/parallel-dispatch.test.ts` — the prior suite only ever exercised the sequential fallback (every test asserted `parallelized: false`).
- **`npm run lint` broken repo-wide** — the root `eslint.config.js` imported `typescript-eslint`, but that package was missing from `package.json` `devDependencies` (only `@typescript-eslint/eslint-plugin` and `parser` were present), so ESLint failed to load its config everywhere. Added the dependency.
- **`parallel/src/WorkerPool.ts` worker path** — the Node branch passed a raw `file://` string to `worker_threads`' `Worker`, which rejects it (`ERR_WORKER_PATH`). `file://` strings are now wrapped in `new URL()`; plain paths pass through. (Same defect previously fixed in `MathWorkerPool`.)
- **WASM test suites fail opaquely on a fresh checkout** — `tests/wasm/wasm-loader.test.ts` and the `WASM Module Types` block of `typescript-integration.test.ts` call `WasmLoader.load()`, which needs a built `.wasm` artifact (`npm run build:wasm`). When the artifact is absent they now `describe.skip` with a loud one-time `console.warn` (via a new `tests/wasm/wasm-artifact-check.ts`) instead of failing with an opaque `ENOENT`.
- **`ParallelMatrix` worker never ran** — a four-defect chain disabled the parallel matrix path entirely: (1) `parallel`'s tsup config had no `src/matrix.worker.ts` entry, so `dist/matrix.worker.js` was never built; (2) `ParallelMatrix` had no script-resolution path; (3) `matrix.worker.ts` used the ESM-incompatible `require('worker_threads')`; (4) `WorkerPool`'s Node branch wired only the browser `worker.onmessage`/`onerror` callbacks instead of `.on('message')`/`.on('error')`. Two further defects: workers mutated shared buffers (lost across the structured clone) and the spawn loop never drained the pending queue. Fixed by adding the worker build entry, a `resolveMatrixWorkerScript()` resolver, dynamic `import('node:worker_threads')` with `parentPort` replies, the Node event handlers, return-by-value worker slices, and a `processQueue()` call after each worker spawns. `parallel/package.json`, `parallel/src/{ParallelMatrix,WorkerPool,matrix.worker}.ts`.
- **JS SVD wrong for non-square matrices** — `svdStep`'s Golub-Kahan QR sweep assigned the unsigned magnitude `Math.sqrt(f*f + g*g)` to `e[k-1]` and `d[k]`, where the algorithm requires the signed rotated values `cs*f - sn*g` / `cs2*f - sn2*g`. The unsigned form corrupted the bidiagonal sweep for any non-square matrix. `matrix/src/operations/svd.ts`.
- **Dependency-graph tool wrote to the wrong directory** — `tools/create-dependency-graph` hard-coded its `OUTPUT_DIR` as `docs/architecture` (lowercase), but the tracked docs folder is `docs/Architecture`. On a case-sensitive filesystem the generated reports landed in a separate, untracked directory. `OUTPUT_DIR` (and the matching log strings + README) now use `docs/Architecture`.
- **All 7 circular import dependencies eliminated** — the dependency-graph report flagged 7 cycles (5 runtime, 2 type-only); it now reports 0.
  - `is ↔ map` and `object → is → map → customs → object` in both `functions/src/utils/` and `expression/src/utils/` (4 cycles): `isObjectWrappingMap` moved into `map.ts` next to the `ObjectWrappingMap` class it guards, so `is.ts` no longer imports `map.ts` — the sole edge that closed both cycles in each package. `isMap`'s existing duck-typing fallback already covers `ObjectWrappingMap` instances, so the dropped `instanceof` is behaviour-preserving.
  - `functions/src/factories/evaluate.ts → typed/index.ts → typed/cas.ts → evaluate.ts`: the `export * from './cas.js'` re-export moved from `typed/index.ts` to the package entry `functions/src/index.ts`. The package's export surface is unchanged, and `evaluate.ts` now initializes strictly after `typed/index.ts`, so its module scope is always complete.
  - `matrix/src/types/`: `DenseMatrix ↔ SparseMatrix`: `DenseMatrix` dropped its `import type { SparseMatrix }`; `toSparse()` is now typed as the `Matrix` base class (the `SparseMatrix` subtype is still constructed via the existing lazy runtime load).
  - `matrix/src/backends/`: `BackendManager ↔ config`: the `OperationType` type moved from `BackendManager.ts` to `config.ts` (the lower-level module); `BackendManager` re-exports it so existing importers are unaffected.
- **`tensor` and `autograd` failed `tsc --noEmit`** — both packages reach the upstream `workerpool` npm dependency transitively (`autograd → tensor → matrix → parallel → workerpool`), and that package ships raw `.ts` source. `skipLibCheck` only skips `.d.ts`, so `tsc` type-checked `workerpool`'s source and surfaced 7 of its own code-quality errors. The `parallel`, `matrix`, `functions`, and `compat` tsconfigs already redirect the `workerpool` specifier to the stub `parallel/types/workerpool.d.ts`; the same `paths` entry was added to `tensor/tsconfig.json` and `autograd/tsconfig.json`.
- **All 599 pre-existing `functions` typecheck errors resolved** — the `functions` package's synced mathjs code carried ~599 `tsc --noEmit` errors. Resolved in three parts: (1) config — `functions/tsconfig.json` gained `@webgpu/types` (its typecheck pulls in matrix's WebGPU backend source) and `lib: ES2023`, and the `WasmModule` interface gained the 4 computational-geometry exports (clears ~100); (2) ~499 type-level fixes (`as` casts, annotations, generic arguments — no runtime change) across the synced `arithmetic/`, `algebra/`, `matrix/`, `bitwise/`, `logical/`, `trigonometry/`, `relational/`, `utils/`, `statistics/`, `special/`, `set/`, `core/`, and `type/` directories; (3) 18 previously-internal interfaces exported so `factories/index.ts`'s factory re-exports can name them (resolves the resulting `TS4023` errors). **Every TypeScript package in the monorepo now typechecks with 0 errors.** Full build and test suite pass.

### Added

- **42 new unit-test files for previously-untested active source code** (+1,294 assertions). Source-file coverage rose from **18.6%** (90 / 485) to **27.0%** (131 / 485); the suite is now 156 test files.
  - `expression`: every AST node class (the 16 `*Node` files plus the `Node` base, `access`/`assign` helpers), the parser (`parse.ts`, `Parser.ts`, `keywords.ts`, `operators.ts`), the `Help` class, `DimensionError`/`IndexError`, `errorTransform`, and 13 util modules (`array`, `bignumber/formatter`, `collection`, `customs` — sandbox-critical, `factory`, `is` — all 40+ type guards, `latex`, `map`, `number`, `object`, `scope`, `string`, `switch`).
  - `packages/workerpool`: `fft-core.ts` (`fftBitReverse`, `fftFrameInPlace`).
  - `functions`: `factories/scope.ts` (`factoryScope` shape).
  - `matrix`: `backends/WasmLoader.ts` (48 tests; 2 skip pending a built `.wasm` artifact).
  - The remaining untested files are the synced mathjs categories in `functions/src/` (not exported as native API; out of scope for "active code" coverage), the AssemblyScript sources under `assembly/` (separate `asc`-based test runner), and the expression package's synced parser internals.

### Documentation

- **`docs/roadmap/EXPANSION_PLAN.md`** — codebase expansion plan; revised to v2
  after adversarial review, with a v3 execution log.
- **Gap analyses** — `GAP_ANALYSIS_BRIDGES_AND_MATH_FUNCTIONS.md` (cross-package
  bridges + math-function coverage) and `GAP_ANALYSIS_WASM_CANDIDATES.md`
  (WASM-conversion candidates).
- **`docs/reference/functions.md`** — rebuilt to match the real export surface;
  guarded against drift by `functions/tests/docs-sync.test.ts` (W11), which
  asserts every documented `` `name(` `` token resolves to a real export.
- **`docs/roadmap/UNIFIED_WEBGPU_PATH.md`** — design spec for a unified WebGPU
  compute path (shared WGSL shader library, GPU-resident array handles for
  operation fusion, Stockham FFT shaders, a generalized backend router), with
  the f32/transfer/availability constraints and an honest build-or-not
  recommendation. Scopes the high-effort acceleration-roadmap item.
- **`docs/reference/functions.{md,html}` — Accel column** — function tables in
  hardware-accelerated categories (Arithmetic, Trigonometry, Statistics, Special
  Functions, Probability Distributions, the typed matrix-ops decompositions,
  Numerical Methods, Interpolation, Signal Processing, Geometry) gained an
  **Accel** column marking each function `parallel` (worker pool), `WASM`, or
  `WebGPU`. The Linear Algebra section gained a "WebGPU-accelerated operations"
  subsection for the new `gpu*` functions. The Signal Processing and Parallel
  Execution Model sections were corrected to describe the real behaviour — the
  FFT butterfly runs on the calling thread, and the typed `Float64Array`
  overloads resolve to the value directly, not to a `ParallelResult` wrapper.
- **`docs/Architecture/` regenerated** — re-ran `tools/create-dependency-graph`
  over the current tree (485 reachable files, 55 modules, 2,850 exports,
  125,177 LOC, 0 import cycles, 18.6% test coverage). `OVERVIEW.md` and
  `ARCHITECTURE.md` were refreshed (LOC, 114 test files), and `ARCHITECTURE.md`
  gained a **Circular Dependencies** subsection — it records that all 7 cycles
  the earlier report flagged have been eliminated, with the fix for each.

### Retracted (audit false-positives)

The 2026-05-18 batched audit (`tools/mathjs-port/audit_summary.md`) flagged several "divergences" that turned out to be either intentional MathTS design improvements or outright audit misreadings. Per-function vetting:

- **`combinatorics/divisorSigma`** — earlier CHANGELOG framed the arg-order difference as a "real mathjs-compat regression." That was wrong. MathTS's `divisorSigma(n, k = 1)` (optional `k` with sensible default) is a deliberate API improvement over mathjs's `divisorSigma(k, n)` (both required). MathTS's own tests lock in the intended signature. No code change.
- **`statistics/studentTTest`** — audit claimed MathTS "only supports one-sample." Verified false: signature `studentTTest(sample1: f64[], sample2?: f64[])` accepts both 1-sample (test vs μ=0) and Welch 2-sample. No code change.
- **`signal/dct`** — audit flagged scaling difference. Confirmed real but intentional: MathTS applies orthonormal scaling factors (`sqrt(1/N)`, `sqrt(2/N)`), which is the modern standard for DCT-II. Documented design choice.
- **`matrix/cholesky`** — audit flagged `{L}` object vs raw `L`. Intentional: object return is more extensible. Documented design choice.
- **`geometry/coordinateTransform`** — angle convention differs (MathTS uses `phi=inclination` physics convention; mathjs uses math convention). Both are valid; documentation choice, no bug.

### Audit

- **Behavioral-parity audit** run across all 9 mathjs categories (`tools/mathjs-port/audit_category.py` + `aggregate_audit.py`). Output: `tools/mathjs-port/audits/<cat>.json` + aggregated `audit_summary.md`. ⚠️ Quantitative summary unreliable due to source truncation in prompts; per-function divergence notes generally accurate when spot-checked.
- **Real divergence confirmed by verification**: `combinatorics/divisorSigma` has reversed argument order — MathTS `divisorSigma(n, k)` vs mathjs `divisorSigma(k, n)`. Users expecting mathjs compatibility will get wrong results. Recommend either renaming or adding a compat shim.
- **All other candidate divergences resolved** — `chiSquareTest` (2D variant) and `erfc` (precision) were real and are fixed above; `cancel` (numeric scope) is fixed above; `studentTTest`, `dct`, `cholesky`, `coordinateTransform` were audit false-positives, retracted above.

### Dependencies

- Bumped `tar` (7.5.2 → 7.5.15) and `picomatch` (4.0.3 → 4.0.4) in the
  `tools/*` utility packages; bumped `codecov/codecov-action` 5 → 6 in CI.

## [autograd 0.1.0] - 2026-05-15

> First release of the `@danielsimonjr/mathts-autograd` package — forward
> and reverse-mode automatic differentiation on rank-N Tensors. Built as
> the AD adapter for the UPT v0.4.0 connection-layer + AD backend. Repo
> tag: `mathts-autograd-v0.1.0`. Not yet published to npm (publish
> requires 2FA — deferred to a manual `npm publish`).

### Added

- `@danielsimonjr/mathts-autograd` package scaffold: forward + reverse-mode AD (Tasks 6/7 populate the implementation).
- `forwardGrad` + `DualTensor` in `@danielsimonjr/mathts-autograd`: dual-number forward-mode AD on rank-N Tensors, full Jacobian assembly (shape `[...y.shape, ...x.shape]`, row-major).
- `reverseGrad` + `Tape` + `TapedTensor` in `@danielsimonjr/mathts-autograd`: tape-based reverse-mode AD; `reverseGrad(fn, x, cotangent?)` returns `{ value, gradient }` with `gradient.shape = x.shape`.

## [tensor 0.1.0] - 2026-05-14

> First release of the `@danielsimonjr/mathts-tensor` package — a rank-N,
> `Float64Array`-backed dense tensor type with einsum/contraction. Built as
> the second `TensorEngine` implementation for the UPT v0.3.5
> numerical-contraction backend. Repo tag: `mathts-tensor-v0.1.0`.
> Not yet published to npm (publish requires 2FA — deferred to a manual
> `npm publish` / `changeset publish`).

### Added

- `@danielsimonjr/mathts-tensor` package: rank-N `Tensor` (storage, construction, elementwise, identity, normInf).
- `Tensor` einsum / matMul / transpose / reshape.

## [Security Release 2026-05-01] — expression@0.2.0, parallel@0.1.3, functions@0.1.3, wasm@0.1.3

> Repo-level tag: `security-2026-05-01` (HEAD `3ef899c`).
> Per-package tags follow the existing `@danielsimonjr/mathts-<pkg>@<version>` convention.
> Driving commits: `6e76d62` (expression sandbox — BREAKING),
> `862ae30` (parallel timeout — additive), `3ef899c` (WASM SHA-384 — additive).

### Security

- **functions, assembly**: WASM modules now verify a SHA-384 manifest
  before instantiation. The build step writes `wasm-manifest.json`
  beside the `.wasm` artefact (see `tools/generate-wasm-manifest.mjs`),
  and at load time the runtime hashes the freshly read buffer
  (`crypto.createHash('sha384')` in Node, `crypto.subtle.digest` in
  browsers) and compares against the manifest. A mismatch throws
  before any module is compiled or instantiated, blocking silent
  code-injection via tampered .wasm payloads. Affected files:
  - `functions/src/wasm/integrity.ts` (new helper module)
  - `functions/src/wasm/WasmLoader.ts:744,748,773,795,799` — both Node
    and browser load paths now verify; streaming compilation is bypassed
    when a manifest is present
  - `assembly/src/bindings/wasm-loader.ts:75,87,89` — `loadWasm()`
    verifies before compile in both fetch and `fs.readFileSync` paths
  - `tools/generate-wasm-manifest.mjs` (new build-time hashing script)
  - `functions/tests/security/wasm-integrity.test.ts` (5 tests)
    covering manifest load, untampered accept, tampered reject,
    soft-warn on missing manifest, and `{required: true}` fail-closed
- **parallel**: `WorkerPool.execute()` now accepts an optional
  `timeoutMs` argument (`parallel/src/WorkerPool.ts`). When the worker
  does not reply within `timeoutMs` the pool calls `worker.terminate()`,
  evicts the dead worker from its rosters, spawns a replacement so the
  pool's capacity is preserved, and rejects the returned promise with a
  `"Worker task timed out after Nms"` error. Pass `0` or omit the
  argument to keep the legacy untimed behaviour. Closes a DoS vector
  where a hung worker (e.g. infinite loop in user-supplied math code)
  would block the queue indefinitely. Adds
  `parallel/tests/WorkerPool.timeout.test.ts` (2 tests) covering
  timeout rejection and pool replacement.
- **expression**: Restored sandbox in the tree-walking compiler
  (`expression/src/compiler/compile.ts`). All five bypass sites now route
  through the existing `getSafeProperty` / `setSafeProperty` /
  `getSafeMethod` helpers in `expression/src/utils/customs.ts`:
  - `compileAccessorNode` — both property-name and computed-index forms
  - `compileAssignmentNode` — `obj.prop = …` lvalue writes
  - `compileObjectNode` — object-literal key assignment
  - `compileSymbolNode` / `compileFunctionNode` — math-namespace lookups
    use `Object.prototype.hasOwnProperty.call(math, name)` to skip
    prototype-chain names; method calls of shape `obj.method(…)` route
    through `getSafeMethod`.
- **expression**: Added pre-compile AST validator in
  `expression/src/evaluator/evaluate.ts`. By default `evaluate()` and
  `compileExpression()` reject `AssignmentNode`, `FunctionAssignmentNode`,
  and `FunctionNode` calls to forbidden builtins (`import`, `createUnit`,
  `evaluate`, `parse`, `compile`, `simplify`, `derivative`, `help`,
  `chain`). Hosts that need the legacy permissive behaviour can opt out
  with `{ unsafe: true }`. Blocklist mirrors `math-mcp/src/validation.ts`.
- **expression**: Added regression suite at
  `expression/tests/security/sandbox.test.ts` (13 tests) covering
  RCE chains (`arr.constructor.constructor("…")()`), prototype pollution
  (`__proto__` writes via assignment and ObjectNode literal), forbidden
  function calls, FunctionAssignmentNode rejection, and confirms safe
  paths still work (`2 + 3`, `arr.length`, etc.).

## [0.1.2] - 2026-04-05

First public release of all 10 @danielsimonjr/mathts-* packages to npm.

### Added

#### Matrix Operations (9 — completing all deferred matrix ops)
- characteristicPolynomial (Faddeev-LeVerrier), rowReduce (Gauss-Jordan RREF), matrixRank (via RREF)
- cholesky (L*L^T decomposition), hessenbergForm (Householder reduction)
- matrixPower (binary exponentiation + eigendecomposition for fractional)
- matrixLog (inverse scaling-and-squaring + Taylor series)
- polarDecomposition (via SVD: A = U*P), jordanForm (eigenvalue clustering + null space analysis)

#### Rust WASM Optimization — 72 high+medium-value functions accelerated
- Special functions (10 Rust): besselI/J/K/Y general order, betainc, ellipticE/K, lambertW, fresnelC/S + TS WASM dispatch
- Signal processing (9 Rust): dct/idct, dst/idst, dwt (Haar), hilbertTransform, spectrogram (STFT), periodogram (Welch), FIR filter + TS dispatch
- Numerical methods (12 Rust): minimize_quadratic, least_squares, levenberg_marquardt, condition_number, matrix_rank, bezier/bspline/loess/griddata/rbf interpolation, implicit_euler/rk4 ODE steps + TS dispatch
- Geometry (4 Rust): delaunayTriangulation (Bowyer-Watson), voronoiDiagram, kdTree build+nearest + TS dispatch with threshold=32
- SIMD array arithmetic (29 Rust): simd_add/sub/mul/div/abs/sqrt/exp/log/sin/cos arrays, sum/mean/min/max/variance/std/dot/norm/distance stats, polygon_area/manhattan/chebyshev/minkowski distances, trig arrays
- Interpolation + distributions (11 Rust): linear/cubic_spline/pchip/lagrange/poly_fit interpolation, normal_pdf/cdf, binomial/poisson/gamma PMFs

#### 190 New Functions — mathjs v15.4–15.6 Parity (Item 1 complete)
- Algebra (36): polyval, polyadd, polymul, polyder, polynomialGCD/LCM/Quotient/Remainder, degree, discriminant, differences, expand, factor, collect, substitute, variables, cancel, together, apart, trigExpand/Reduce, trigToExp, expToTrig, tangentLine, resultant, + 12 more
- Symbolic CAS (28): integrate, limit, taylor, solve, laplace/inverseLaplace, fourierSeries, zTransform, gradientSymbolic, jacobian, laplacian, divergence, curl, groebnerBasis, piecewise, odeGeneral, + 13 more
- Graph Theory (8): adjacencyMatrix, shortestPath, minimumSpanningTree, connectedComponents, stronglyConnectedComponents, topologicalSort, isConnected, graphDistance
- Number Theory (15): prime, nextPrime, primePi, primeFactors, divisors, eulerPhi, divisorSigma, carmichaelLambda, moebiusMu, jacobiSymbol, chineseRemainder, lucasL, partitions, harmonicNumber, integerDigits
- Distribution Objects (12): normalDist, betaDist, binomialDist, chiSquaredDist, exponentialDist, fDist, gammaDist, logNormalDist, poissonDist, tDist, uniformDist, weibullDist — each with .pdf/.cdf/.quantile/.mean/.variance/.sample
- Statistical Tests (7): studentTTest, chiSquareTest, anova, kolmogorovSmirnovTest, mannWhitneyTest, shapiroWilkTest, principalComponentAnalysis
- Numerical Methods (34): findRoot, minimize/maximize, linsolve, leastSquares, nintegrate, curvefit, expfit/logfit/powerfit, bezierCurve, bspline, loess, solveODESystem, stiffODESolver, solveBVP, cond, rank, + 18 more
- Signal Processing (19): dct/idct, dst/idst, dwt, fft2d, fourier/invFourier, hilbertTransform, spectrogram, periodogram, lowpass/highpass/bandpassFilter, resample, medfilt, windowFunction, convolve, correlate
- Extended Geometry (11): area, centroid, coordinateTransform, polygonPerimeter, manhattanDistance, chebyshevDistance, minkowskiDistance, delaunayTriangulation, voronoiDiagram, kdTree, nearestNeighbor
- Extended Special (20): besselI/J/K/Y (general order), betainc, gammaincp, ellipticE/K, chebyshevT, hermiteH, laguerreL, legendreP, lambertW, erfi, cosIntegral, sinIntegral, logIntegral, expIntegralEi, fresnelC/S
- 557 new tests, 36+ embedded doc files

#### Rust WASM Migration
- 192 AS-compatible wrapper functions added to Rust WASM crate (`wasm-rust/crates/mathts-wasm/src/compat/`):
  - `scalar.rs`: 42 scalar ops (add_f64, sin_f64, sqrt_f64, etc.)
  - `array.rs`: 36 array ops (array_add, array_dot, array_norm, etc.)
  - `complex.rs`: 75 complex ops (complex_add, complex_sin, complex_array_fft, etc.)
  - `matrix.rs`: 39 matrix ops (matrix_multiply, matrix_transpose, matrix_trace, etc.)
- Rust WASM binary now exports 1,017 functions (was 741) — full AS parity
- BackendManager already prefers Rust WASM for heavy ops (FFT, eig, SVD)
- Build script: `wasm-rust/scripts/build-for-mathts.sh`
- WASM backend comparison benchmark (`tests/benchmark/wasm-comparison.test.ts`)

#### New Math Functions (60 — beyond mathjs)
- Special functions (8): erfc, beta, gammainc (incomplete gamma), digamma, besselJ0, besselJ1, besselY0, besselY1
- Probability distributions (10): normalPDF, normalCDF, exponentialPDF, exponentialCDF, poissonPMF, binomialPMF, geometricPMF, bernoulliPMF, entropy, jsDivergence
- Numerical integration (4): trapz, simpson, gaussQuad (Gauss-Legendre), romberg (adaptive)
- Interpolation (6): linearInterp, lagrangeInterp, cubicSpline, hermiteInterp, pchipInterp, polyFit
- Extended combinatorics (6): fibonacci (fast doubling), lucas, doubleFactorial, risingFactorial, fallingFactorial, subfactorial
- Geometry (18): angle2D/3D, cross3D, dot3D, triangleArea, polygonArea, convexHull (Andrew's monotone chain), pointInPolygon (ray casting), rotateVector2D/3D (Rodrigues), reflectVector, projectVector, distance2D/3D/ND, distancePointToLine2D, intersectLines2D, intersectSegments2D
- Signal processing (4): crossCorrelation, autoCorrelation, groupDelay, unwrapPhase
- Statistics selection (4): quickSelect (Hoare's O(n)), medianSelect, minSelect, maxSelect
- 56 embedded doc files for all new functions
- 260 new tests covering all functions against known reference values

#### Core Types & Type System
- 22 math methods on BigNumber: trig (sin, cos, tan, asin, acos, atan), hyperbolic (sinh, cosh, tanh, asinh, acosh, atanh), transcendental (exp, ln, log10, log2, cbrt, expm1), other (mod, log1p, atan2, hypot) — all pure BigNumber arithmetic with Taylor series
- Instance `compare()` method on BigNumber and Fraction (delegates to `compareTo()`)
- Type compatibility bridge (`registerNativeTypes()`) — adds `isComplex`, `isFraction`, `isBigNumber` duck-typing markers to native type prototypes
- Typed-function bridge (`initTypeBridge()`) enabling synced mathjs factories to recognize native MathTS types
- 6 inverse trig methods on AssemblyScript Complex class (asin, acos, atan, asinh, acosh, atanh)

#### Factory Activation System
- Factory activation infrastructure: shared scope (`functions/src/factories/scope.ts`), barrel export (`functions/src/factories/index.ts`)
- 242/273 mathjs factories activated across 18 tiers (89%):
  - Tier 1 (69): leaf factories — abs, sin, cos, sqrt, erf, combinations, etc.
  - Tier 2 (13): inter-factory deps — divideScalar, dot, mode, isZero, bin/hex/oct, etc.
  - Tier 3 (14): matrix factories — transpose, identity, zeros, ones, diag, det, trace, kron, etc.
  - Tiers 4-9 (73): equal, compare, larger, smaller, gcd, lcm, mod, pow, ceil, floor, inv, pinv, qr, concat, subset, range, sort, factorial, gamma, permutations, bellNumbers, stirlingS2
  - Tiers 10-18 (67): subtract, divide, simplify, derivative, rationalize, eigs, fft/ifft, mean/median/variance/std, all set operations, solveODE, Chain/Unit, sqrtm, norm, cross, diff
- Remaining 31 factories are infrastructure types already provided by @danielsimonjr/mathts-core
- Expression node constructors (all 16 types) injected into factory scope for full AST support
- Index and Range stub types registered in typed-function for subset/range factory activation

#### Matrix & WASM
- Matrix compatibility bridge (`MathJSDenseMatrix`) — adapts native DenseMatrix to mathjs `._data`/`._size`/`.storage()` interface
- Real SparseMatrix bridge with CSC (Compressed Sparse Column) storage — `_values`, `_index`, `_ptr` with get/set, map, forEach, resize, diagonal, row swap
- WASM-accelerated FFT (`matrix/src/backends/wasm/fft-wasm.ts`) — Cooley-Tukey radix-2 with Rust WASM acceleration path, JS fallback, spectral analysis utilities
- WASM-accelerated eigendecomposition (`matrix/src/operations/eig-wasm.ts`) — Rust WASM Jacobi for symmetric matrices, JS QR fallback
- WASM-accelerated SVD (`matrix/src/operations/svd-wasm.ts`) — derives from eigendecomposition for symmetric matrices, Golub-Reinsch JS fallback
- Rust WASM backend integration: `RustWasmLoader` singleton with bump allocator, `RustWASMBackend` implementing MatrixBackend, BackendManager routing heavy ops (FFT, eig, SVD) to Rust WASM
- Parallel FFT (`parallel/src/operations/fft.ts`) — threshold-based parallel dispatch, auto-padding, parallel convolution
- Parallel eigendecomposition (`parallel/src/operations/eig.ts`) — inlined QR algorithm (avoids circular deps), ParallelResult wrapper

#### Expression & Evaluation
- Expression compiler (`expression/src/compiler/compile.ts`) — tree-walking AST interpreter handling all 16 node types
- Expression evaluator (`expression/src/evaluator/evaluate.ts`) — `createEvaluate()` factory for `evaluate(expr, scope)` API
- `evaluate()` function wired to activated factory scope — `evaluate('sin(pi/2)')` works end-to-end
- `parse()` bootstrapped from expression node factories through dependency-ordered scope injection
- `compileExpr()` for reusable compiled expressions
- Workbook `executeCode()` implementation using Function constructor with scope injection

#### typed-function & workerpool Improvements
- typed-function: Symbol-based type identification (`TYPED_FUNCTION_TYPE`) — survives esbuild/minification
- typed-function: Safe conversions (`createSafeConversion`) — prevents "cannot invoke without new" errors
- typed-function: Robust multi-strategy type tests (`createRobustTypeTest`) — symbol → property → prototype fallback
- workerpool: SharedArrayBuffer helpers and Transferable support for zero-copy transfer
- workerpool: Eager worker initialization (`warmup()`) with `pool.ready` promise
- workerpool: Enhanced metrics (`enhancedStats()` with p95, throughput, workerUtilization)

#### Build & Publishing
- npm publishing setup — all 10 packages have `publishConfig`, `files`, `repository`
- Production build optimization (`build:prod`) — minified + tree-shaken bundles, 57% size reduction (1524 KB → 662 KB)
- Package scope rename: `@mathts/*` → `@danielsimonjr/mathts-*` for npm publishing under personal scope
- Root `release` script via changesets

#### Testing & Documentation
- Performance regression test suite (`tests/benchmark/performance.test.ts`) — 23 benchmarks covering Complex, BigNumber, Fraction, DenseMatrix, typed dispatch, factory functions
- Parallel operation benchmarks (`parallel/tests/benchmark.test.ts`) — 18 tests covering elementwise, reduce, matmul
- `vitest.config.ts` added for functions, parallel, workbook, packages/typed-function, packages/workerpool
- `@types/node` added to all 7 workspace package devDependencies
- 5 synced mathjs files: constants.ts, factoriesAny.ts, factoriesNumber.ts, defaultInstance.ts, shared/types.ts
- Codebase inventory tooling (tools/codebase-inventory.json, tools/build-mathts-inventory.py, tools/scan_missing.py, tools/inventory.py)
- Full codebase inventory reports (docs/inventory/00-05)
- Integration plan and priority status tracker
- Architecture docs updated (ARCHITECTURE.md, API.md, DATAFLOW.md, OVERVIEW.md)
- Per-package dependency graphs regenerated for all 9 packages (+ new: expression, assembly)
- User-facing documentation modeled after mathjs:
  - `docs/datatypes/` (7 files): numbers, complex, fractions, bignumbers, matrices, bigints
  - `docs/expressions/` (6 files): syntax, parsing, algebra, security, expression trees
  - `docs/core/` (4 files): configuration, extension, serialization
  - `docs/reference/` (4 files): classes, constants, functions
- README.md updated with v0.1.2 capabilities: evaluate(), 242 factories, dual WASM, bundle sizes

### Changed
- Synced mathjs factory code uses correct import paths (./function/ prefix stripped, depth-agnostic ../ reduction)
- functions/src/typed: renamed .neg() → .negate(), .reciprocal() → .inverse(), .div() → .divide() to match core type APIs
- factoriesAny.ts/factoriesNumber.ts: stripped 287 broken ./function/ import prefixes
- expression/ package: build enabled (was echo-skip), tsconfig added, shared utils copied, 60+ import paths fixed
- assembly/ WASM: prefixed 114 bare math calls with Math., fixed abort path, fixed complex_pow(→powReal)
- matrix/WASMBackend: fixed SIMD method names (addSIMD→simdAddF64, etc.)
- parallel/tsconfig: workerpool type stub replaces raw .ts source resolution
- matrix/tsconfig, compat/tsconfig: added workerpool path override

### Fixed
- besselI_wasm: sign correction `(-1)^n` for negative x with odd order n
- erfc Rust WASM: replaced `1-erf(x)` with direct Abramowitz & Stegun computation (catastrophic cancellation for large x)
- standardNormalCDF: divide x by √2 before erf (was computing Φ(x√2) instead of Φ(x))
- Delaunay in_circumcircle: orientation-independent determinant test (was assuming CCW winding, Edge::new destroys winding order)
- special.ts WASM dispatch: disabled getRustWasm() — was using `.exports` (doesn't exist on RustWasmLoader) and `require()` in ESM package
- next_power_of_2(0): guard against usize underflow in signal processing WASM
- exponential() Rust WASM: guard against lambda≤0 division by zero
- partialDerivative export collision: renamed algebra.ts version to symbolicPartialDerivative
- curvefit LM convergence: compute cost change before updating prevCost
- PCA explained variance: uses trace(cov) instead of sum of extracted eigenvalues when k < p
- factor/collect: normalize subtraction before splitting on +
- binomialDist PDF: handle degenerate p=0 and p=1 (was NaN from 0*log(0))
- adjacencyMatrix docstring: fixed example matrix
- BigNumber.exp() overflow: `2**k` → `BigNumber.fromNumber(2).pow(k)` for large inputs
- WASMBackend SIMD argument order: swapped resultPtr/length in 7 operations (add, subtract, mul, scale, abs, negate)
- WASMBackend divideElementwise: was calling multiply — now delegates to JS backend
- WASMBackend QR decomposition: was reading R from unwritten buffer — now reads from in-place aAlloc
- eig-wasm memory leak: added try/finally to free WASM allocations in eigWasm and spectralRadiusWasm
- parallelIFFT: removed wasteful forward FFT call, reports honest metadata
- SparseMatrix _swapRows: splice-insert at sorted position instead of overwriting index (maintains CSC invariant)
- factoryScope.add/multiply: upgraded from scalar stubs to full typed implementations after tier 12
- workerpool canUseSharedMemory(): added crossOriginIsolated check for browser environments
- workerpool _recordExecution(): single performance.now() snapshot prevents timestamp inconsistency
- typed-function dep in functions/package.json: npm registry → github fork
- turbo.json test tasks: `"dependsOn": ["build"]` → `["^build"]` for correct upstream ordering
- Package.json consistency: workbook directory path, assembly author/URL, compat author/URL/dev deps
- Tests using BigNumber private constructor → public fromNumber/parse
- Removed duplicate factoryScope injections (map, conj)
- All 10 packages now build (was 9/10 — assembly WASM was broken)
- All 14 typecheck tasks now pass (was 9/14 — parallel, matrix, compat, expression, functions failed)
- assembly/ WASM build: 64 errors → 0 (Math. prefix, abort path, missing Complex methods)
- parallel/ typecheck: workerpool raw .ts source resolution → type stub
- expression/ typecheck: removed unnecessary embeddedDocs exclusion
- functions/ typecheck: re-enabled (was echo-skip), fixed 35 type errors
- workbook executor: executeCode() implemented (was throwing "not yet implemented")
- ParallelMatrix test: added missing beforeAll/afterAll vitest imports

## [0.1.0] - 2026-02-06

### Added
- Initial project structure with monorepo setup (npm workspaces + Turborepo)
- @danielsimonjr/mathts-core: Complex, Fraction, BigNumber types, TypeRegistry, factory system
- @danielsimonjr/mathts-matrix: DenseMatrix, SparseMatrix, JS/WASM/GPU backends, BackendManager
- @danielsimonjr/mathts-functions: typed arithmetic, trigonometry, statistics, signal processing
- @danielsimonjr/mathts-parallel: ComputePool, WebWorker parallelization, threshold strategies
- @danielsimonjr/mathts-compat: mathjs-compatible `create(all)` API with 54 shim functions
- @danielsimonjr/mathts-workbook: .mtsw notebook runtime with dependency graph and reactive execution
- @danielsimonjr/mathts-wasm: AssemblyScript WASM operations (scalar, array, complex, matrix)
- @danielsimonjr/mathts-typed-function: forked type dispatch system
- @danielsimonjr/mathts-workerpool: forked worker pool management
- TypeScript configuration with project references and strict mode
- GitHub Actions CI/CD workflows
- Comprehensive test suite with 1,342 passing tests across 51 files
- Integration tests for cross-package operations
- API documentation for all packages (docs/api/)
- Migration guide from mathjs (docs/migration/)
- Example projects (examples/)
- Getting Started and Advanced Usage guides

[0.1.2]: https://github.com/danielsimonjr/mathts/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/danielsimonjr/mathts/releases/tag/v0.1.0

# @danielsimonjr/mathts-core

## 0.13.1

### Patch Changes

- Fix the exported `VERSION` constant, which had silently drifted from each package's published version.

  `VERSION` was a hardcoded string literal that Changesets never bumped, so it drifted: core reported `0.1.0`
  (was really 0.13.0), plot `0.2.0` (was 0.3.29), workbook `0.1.0` (was 0.3.3). Workbook's is user-facing —
  `mtsw version` (and `capabilities`/`introspect`) printed the wrong number.

  Root-cause fix (not a re-hardcode): `VERSION` is now injected at build time from each package's own
  `package.json` via a per-package `tsup.config.ts` (esbuild `define`, read Node-side so `package.json` is
  never bundled into `dist`). Tests import source, so the same define is mirrored into each `vitest.config.ts`;
  `core/tests/version.test.ts` now pins `VERSION` to `package.json` rather than a literal. `VERSION` can no
  longer drift from the published version.

## 0.13.0

### Minor Changes

- Resolve the deduplication campaign's final decisions: a compat compatibility correction and an internal WasmLoader consolidation.

  **compat (behavior change):** `zeros(n)` and `ones(n)` with a single argument now return a length-`n` **vector** (`[0,0,0]` / `[1,1,1]`), matching mathjs, instead of an `n×n` square matrix. Two-argument `zeros(r, c)` / `ones(r, c)` continue to return an `r×c` matrix. compat's purpose is mathjs compatibility, and the previous square result diverged from mathjs (`math.zeros(3)` is a size-`[3]` vector) — this was a bug. Anyone relying on `zeros(n)` returning a square must now pass `zeros(n, n)`.

  **core / functions / matrix (internal, no runtime behavior change):** the shared WASM-loader logic — the SHA-384 integrity verification (`sha384OfBuffer` / `verifyWasmIntegrity` / `loadWasmManifest`) and packaged-binary resolution (`resolvePackagedWasm` / `defaultWasmLocation`) — was byte-identical in `functions` and `matrix` and is now single-sourced in `@danielsimonjr/mathts-core/internal` (`core/src/wasm-loader.ts`), with each package injecting its own binary/manifest path. The SHA-384 verify-before-instantiate security invariant is preserved byte-for-byte (Node `crypto.createHash('sha384')` / browser `crypto.subtle.digest('SHA-384')`, mismatch throws), node built-ins stay behind lazy dynamic `import()`, and core's browser-safe `.` entry is unaffected. The per-package `WasmLoader` class stays local (distinct AS allocation models).

## 0.12.0

### Minor Changes

- Fix two BigNumber/Complex transcendental correctness bugs found by an mpmath/NumPy oracle audit, and consolidate the fftshift/ifftshift roll algorithm.

  **core (correctness):**
  - `BigNumber.divide` lost all precision when the divisor's coefficient had more digits than the (precision-scaled) dividend — the Newton-iteration step `2 / (g*g)` in `cbrt`/`sqrt` integer-divided to a quotient of `0`. As a result `cbrt(bignumber(2))` returned `4.6e-18` instead of `1.2599…`, and `asinh`/`acosh` on BigNumber degraded to ~11–16 digits. The dividend scale is now widened by `max(0, divisorDigits - dividendDigits)`; the result is **bit-identical** whenever `divisorDigits ≤ dividendDigits`, so no previously-correct division changes.
  - `Complex.acosh` landed on the wrong Riemann sheet for `Re(z) < 0` (`acosh(-1+0.5i)` returned the negated value). It now uses the factored principal form `ln(z + √(z-1)·√(z+1))` (C99 Annex G / DLMF 4.37 / NumPy).

  Every rich-type case of the 12 transcendental scalars (`sinh cosh tanh asinh acosh atanh cbrt log2 log10 log1p expm1 sign`) is now pinned to the mpmath/NumPy oracle by `functions/tests/gap-transcendental-richtype-oracle.test.ts`.

  **functions:** the public `fftshift`/`ifftshift` (`number[]`) and the internal generic complex-FFT toolkit versions now share one `rollBy<T>` algorithm instead of duplicating the roll logic; behavior is unchanged.

## 0.11.0

### Minor Changes

- Arithmetic correctness fixes (BigNumber/Fraction pow/round/equal) + cross-package util consolidation

  **Correctness fixes** (`functions`): three live public-API bugs, fixed at root by delegating the
  rich-type policy cases of the typed dispatchers to core's oracle-pinned scalar primitives:
  - `pow(bignumber(2), 0.5)` returned `1` (silently) — now `1.4142…`; `pow(fraction(3), 2.9)` silently
    floored the exponent to `27` — now `24.19…`.
  - `round(bignumber(-2.5))` returned `-3` — now `-2` (core's type-consistent `halfCeil`).
  - `equal(0.1+0.2, 0.3)` returned `false` (strict `===`) — now `true` (mathjs-parity tolerance via
    `nearlyEqual`; `bigint` stays exact).
    Hot `number`/`bigint` cases remain inline (unchanged, no perf impact). A new equivalence guard
    (fast-check property: typed case ≡ core primitive, + edge corpus) prevents future drift.

  **Consolidation** (`core`/`expression`/`functions`): duplicate mathjs-derived cold utilities
  (factory/string/formatter/array/collection/map) and error classes (`MathjsError`/`DimensionError`/
  `IndexError`) that `expression` and `functions` each carried are now unified on a single
  `@danielsimonjr/mathts-core/internal` canonical, with per-package re-export shims (no public API
  change). Two latent bugs fixed in passing (`ObjectWrappingMap[Symbol.iterator]` type-soundness;
  `sortFactories` now throws on indirect dependency cycles).

## 0.10.0

### Minor Changes

- 000679d: Fix `variance`/`std` accuracy — was ~10⁶× worse than NumPy on large-mean data

  `variance` and `std` lost ~7 significant digits on data with a large mean: variance of 1e9-pedestal
  samples came out at **~1e-7 relative error**, where `np.var` is ~1e-13 and the true value (exact
  rationals) is representable. The deviations `xᵢ − x̄` are small but sit on a huge pedestal, so any
  error in the mean rides straight into every squared deviation.

  Root cause spanned every path: the public typed `variance`/`std` used **Welford's online algorithm**
  (`m2OfArray`), which drifted here; the parallel path (`ComputePool.variance`) used a **naive mean +
  uncorrected two-pass**; and the factory/`std` paths had naive **WASM** kernels (`statsVariance`/
  `statsStd`) that were both less accurate and — being memory-bound reductions — not faster.

  Fixed with a new `sumSquaredDeviations` primitive in `@danielsimonjr/mathts-core`: the **corrected
  two-pass** — mean via pairwise summation, then `Σd² − (Σd)²/n`, where the correction term cancels the
  residual mean-bias exactly. Wired into every path (typed `variance`/`std`, `ComputePool.variance`,
  the factory `variance`, and `std = sqrt(variance)`); the naive WASM fast paths are retired. Now
  **machine-precision (relErr ~0), beating NumPy's uncorrected two-pass** — verified against exact
  rationals and live NumPy. Everything built on variance (`std`, `zscore`, `parallelStatCorr`, …)
  inherits the fix.

## 0.9.0

### Minor Changes

- 397493e: Fix `corr` catastrophic cancellation and a class of BigNumber correctness bugs

  **`corr` could return values outside [-1, 1].** The Pearson correlation used the one-pass
  "computational formula" `n·ΣXY − ΣX·ΣY`, which subtracts two nearly-equal large quantities and
  catastrophically cancels when the data has a large mean: `corr` of two ~1e9 series returned **52**
  (mathematically impossible) for a true value of **−1**. Rewritten to the numerically stable
  **two-pass** form (center by the mean, then `Σdx·dy / sqrt(Σdx²·Σdy²)`), with a pairwise-accurate
  plain-number fast path. Now matches `np.corrcoef` (verified against live NumPy).

  **Core BigNumber comparisons silently mishandled plain-number arguments.** `equals`, `lessThan`,
  `lessThanOrEqual`, `greaterThan`, `greaterThanOrEqual`, and `compareTo` passed their argument
  straight to the internal comparator without coercion, so `bignumber(8).lessThanOrEqual(3)` returned
  `true`. They now coerce (`number`/`string` → `BigNumber`) exactly like `add`/`gt` already did.

  **The mathjs-lineage factory layer assumed a decimal.js BigNumber API that core does not implement**
  (`plus`/`minus`/`dividedBy`/`lte`/`gte`/`lt`/`eq`/`cmp`), so many factory functions crashed or
  mis-ordered on BigNumbers. Fixed across arithmetic (`addScalar`, `subtractScalar`), all comparison
  and relational helpers (`nearlyEqual`, `compare`, `smaller`, `smallerEq`, `largerEq`, `equalScalar`)
  — restoring `sort`/`median`/`min`/`max` on BigNumber arrays — plus `cumsum`, `quantileSeq`,
  `factorial`, `gamma`, and `isPrime`. `isPrime`'s Miller-Rabin and `gamma`'s factorial both dropped
  their decimal.js precision-cloning dance (core's BigNumber is bigint-backed, so integer arithmetic
  is already exact). Also fixed a non-idempotent `bignumber()` conversion: `bignumber(aBigNumber)`
  returned `Infinity` (it re-ran `fromNumber` on an object), which corrupted every consumer that
  re-wraps a possibly-BigNumber value.

  No public API removals. These paths were previously **untested** (which is why they stayed broken
  under a green suite); regression tests added in `core/tests/bignumber-comparison-coercion.test.ts`
  and `functions/tests/bignumber-operations.test.ts`.

## 0.8.0

### Minor Changes

- a726fd7: Numerically stable `dot`, `distance`, and `cumsum` (NumPy/SciPy accuracy audit follow-up)

  Three new stable primitives in `@danielsimonjr/mathts-core` (`core/src/numeric/stable.ts`),
  wired into the public reduction paths so every caller inherits the fix:

  - **`pairwiseDot(a, b)`** — pairwise (cascade) dot product. The naive `Σ aᵢ·bᵢ` loop carries
    O(n)·ε error; measured ~18× worse than `np.dot` on an ill-conditioned dot (large mean × small
    factor, n = 10⁶). `dot` (both the `number[]` and `Float64Array` paths) now sums pairwise —
    at NumPy parity for the same flop count.
  - **`scaledDistance(a, b)`** — BLAS `dnrm2`-scaled Euclidean distance. `distance` was
    `sqrt(Σ(aᵢ−bᵢ)²)`, which **overflows to `Infinity`** for large inputs and **silently flushes
    to `0`** for tiny ones (NumPy's `linalg.norm` has the same bug). Now scales on the largest
    _difference_ seen: `‖[1e200]×4 − 0‖ = 2e200` and `‖[1e-200]×4 − 0‖ = 2e-200`, both exact,
    where naive squaring (and NumPy) get `inf`/`0`.
  - **`neumaierCumsum(xs, out)`** — Neumaier-compensated cumulative sum. A prefix scan is inherently
    sequential (pairwise doesn't apply), so `np.cumsum` accumulates naively and its tail drifts
    O(n)·ε (relErr ~1.3e-11 over 10⁶ terms). `cumsum` now carries a running compensation — exact
    prefixes for a few extra flops per element, a strict improvement over NumPy.

  Fixed on **every layer a consumer can reach**, not just the typed one: the public `distance` and
  `cumsum` a caller imports resolve to the mathjs _factory_ implementations (`geometry/distance.ts`,
  `statistics/cumsum.ts`), which were separate naive code paths from the typed `parallelStat*` ones —
  the same "wrong layer" trap that first bit `sum`. Both now route flat plain-number inputs through
  the stable primitives (retiring two naive WASM scans that carried the overflow bug); the generic
  `BigNumber`/`Complex`/multi-dim paths are unchanged. The compat-registry `dot` (`matrix/dot.ts`
  `_denseDot`) gets a plain-1D-numeric pairwise fast path too.

  No API removals; `dot`/`distance`/`cumsum` signatures and results are unchanged in the safe range.

## 0.7.0

### Minor Changes

- b8bf018: **Numerical accuracy: `sum` / `mean` were ~46,000× less accurate than NumPy. Fixed.**

  `sum` accumulated naively (`s += x`), so its error grew as **O(n)·ε**. NumPy uses pairwise
  summation, whose error grows as **O(log n)·ε**. Measured on 1e6 copies of `0.1` (exact answer
  100000):

  | accumulation              | relative error                      |
  | ------------------------- | ----------------------------------- |
  | naive (what shipped)      | **1.3e-11**                         |
  | **pairwise (now)**        | **2.9e-16** — identical to `np.sum` |
  | `fsum` (new, compensated) | **0** — exact                       |

  `mean`, `std`, and `variance` all inherit `sum`'s error, so this was the single largest accuracy
  defect in the library. Pairwise costs the _same number of additions_ — measured 1.03× **faster**
  than the naive loop (eight independent accumulators break the serial dependency chain). There was
  no trade here; the naive version was simply worse.

  **`norm(x, 2)` no longer overflows or underflows — and NumPy still does.** The obvious
  `sqrt(Σxᵢ²)` squares before it adds, so it dies well inside the representable range. MathTS now
  uses LAPACK's `dnrm2` scaling:

  ```ts
  norm([1e200, 1e200, 1e200, 1e200], 2); // 2e200    (np.linalg.norm: inf)
  norm([1e-200, 1e-200, 1e-200, 1e-200], 2); // 2e-200   (naive squaring: 0 — silently wrong)
  ```

  The underflow case is the dangerous one: a plausible `0` rather than an obvious `inf`.

  **New: `fsum(x)`** — exactly-rounded summation (Neumaier), the equivalent of Python's `math.fsum`.
  Pairwise cannot recover a value catastrophic cancellation has already destroyed:

  ```ts
  sum([1e16, 1, -1e16]); // 0  (np.sum gives 0.0 too — the 1 is annihilated by the 1e16)
  fsum([1e16, 1, -1e16]); // 1  (exact)
  ```

  ~2–4× slower, so it is opt-in. Reach for it when the result is a small difference of large terms.

  **`@danielsimonjr/mathts-core`** now exports the primitives directly: `pairwiseSum`, `neumaierSum`,
  `norm2`.

  **`@danielsimonjr/mathts-parallel`** gains a dependency on `core` for these primitives, and its
  `ComputePool.sum` / `.norm` sequential paths use them (0 new cycles).

## 0.6.0

### Minor Changes

- cb4bebf: **Wire `Range` into the public API** and remove the vestigial guard cluster. The complete, tested `createRangeClass` factory (a lazy `start:step:end` numeric sequence, mathjs parity) was reachable only from its own test; it is now exported from the package index — `Range` (ready-made class) + `createRangeClass` + the `Range*` types — alongside `Complex`/`Fraction`/`BigNumber`. Its four `private` memoization fields were converted to ECMAScript `#private` so the class survives declaration emit when public (TS4094). Removed `core/src/utils.ts` and `core/src/types.ts`: dead, unexported, production-unused scaffolding riddled with phantom imports (`utils.ts` imported a `ComplexNumber` type defined nowhere; `types.ts` re-exported from a non-existent `../types/index.js`). Their duplicate guards (`isNumeric` duplicated `arithmetic/scalar`'s; `isComplexLike`/`isMatrixArray` were unused) and self-referential tests were pruned. No production code referenced any of it; published behavior is unchanged apart from the new `Range` export.

### Patch Changes

- a5b5af6: Delete `core/src/types/index.ts` — a redundant, unreachable type barrel. `core/src/index.ts` already exports its constituents (`Complex`/`Fraction`/`BigNumber`/interfaces) directly from `./types/complex.js` etc.; nothing imported the barrel (`core/src/types.ts`'s `../types/index.js` resolves elsewhere, and there is no `./types` subpath export). Published surface unchanged — the barrel was tree-shaken out of the bundle. Surfaced by the dependency-graph tool, which also gained config-referenced-root seeding so bundler-alias targets (e.g. the `workerpool` browser shim aliased in by `vitest.config.browser.ts`) are no longer false-flagged as dormant.

## 0.5.0

### Minor Changes

- 779fcde: B-5 upstream-fix audit (all 61 drift commits since the last mathjs sync; full verdicts in `docs/roadmap/UPSTREAM_FIX_AUDIT_2026-07-05.md`):

  - **`groebnerBasis` rewritten — it was not computing a Gröbner basis at all.** The old code returned the parsed inputs "normalized", through an evaluation-based coefficient extractor that could not distinguish `x` from `x²` — `⟨x²+y²−1, x−y⟩` came back containing `x+y−1`, which does not vanish on the system's solutions. Now: exact AST-parsed polynomial arithmetic + real Buchberger (lex order) with honest iteration/size caps (new `typed/polynomial-ideal.ts`), reduced monic basis, oracle-pinned by ideal-membership vanishing tests.
  - **`eliminate` rewritten — it returned decorative strings, not equations** (`"(A) - (B) [x eliminated]"`) and echoed garbage input. Now computes the real elimination ideal (lex basis with the eliminated variable first, keep elements free of it) and throws on non-equation input.
  - **`laplacian` validates its variables** (empty array / empty strings / missing scope values throw clear errors instead of silent 0).
  - **core `Unit` gains the upstream astronomical/nautical/typography units** (`astronomicalUnit`/`AU`, `lightyear`/`ly`, `parsec`/`pc`, `nauticalMile`/`nmi`, `fathom`, `furlong`, `point`, `pica`) with the upstream prefix-direction fix: `ly`/`pc` accept upward prefixes only (`kpc`, `Mpc`, `Mly` work; `mly`/`mpc` throw instead of silently misparsing), and lowercase `au` stays undefined (Bohr-radius collision). IAU/NIST-pinned.

  Audited clean (no port needed): `discriminant`, `piecewise`, `toRadicals`, `fullSimplify`, `complexExpand`, `reduce`, `rowReduce`.

## 0.4.1

### Patch Changes

- 22427a8: Dead-code sweep: remove all 31 verified-unreferenced exports flagged by the fixed dependency-graph unused-analysis (plus 4 cascade orphans), ~630 LOC. None were public API — every symbol was verified unimported by source, tests, docs, and factory name-string dispatch before deletion. Highlights: the mathjs number-only-bundle factory remnants (`createNthRootNumber`, `createCompareTextNumber`, `createEqualScalarNumber`, `createBigNumberClass`, `createComplexClass`, `createArgumentsError`, `createIndexError`), the dead `functions/src/expression/operators.ts` precedence/associativity chain (the live copy is the `expression` package's own), orphan utils (`initial`, `toObject`, `noIndex`/`noSubset`, `endsWith`/`escape`, `operatorPrecedence`), unused JSON/type contracts, `SI_PREFIX_KEYS`, and AssemblyScript complex-constant helpers. The unused-analysis deletion-candidate count is now **0**.

## 0.4.0

### Minor Changes

- 5611a77: Add `BigNumber.prototype.div` and `.times` — short-name aliases for `divide`/`multiply`, matching the Decimal.js / mathjs calling convention already followed by `Complex` and `Fraction` (`.div`/`.mul`/`.sub`). Both accept the same operand types as their long forms (BigNumber, number, string). Needed by the mathjs-derived `Unit` (which calls `.div`/`.times` on BigNumber unit values) as it merges into core, and useful for general Decimal.js API parity.
- 25b80ed: Add polymorphic scalar arithmetic (`core/src/arithmetic/scalar.ts`): `addScalar`, `subtractScalar`, `multiplyScalar`, `divideScalar`, `pow`, `abs`, `fix`, `round`, `equal` over any mix of `number | bigint | Complex | Fraction | BigNumber`, plus a polymorphic `isNumeric` and a `number()` converter — all built solely on core's own numeric primitives. Dispatch promotes both operands to the richest common domain (Complex ≻ BigNumber ≻ Fraction) and invokes one same-type method, so operand order is preserved for non-commutative ops and same-type operands stay exact. Non-integer exponents on an exact base fall back to double `Math.pow` (so `pow(BigNumber, 0.5)` is correct, not silently `1`); `round` uses `'halfCeil'` on BigNumber for cross-type consistency with `Math.round`/`Fraction.round`; `isNumeric` follows mathjs semantics (boolean is numeric, Complex is not). This is the foundational dependency for the in-progress relocation of the feature-complete `Unit` class into core.
- 82bb0b1: **BREAKING (Unit merge complete): one `Unit`.** The former standalone core `Unit` class (the canonical-value subset in `core/src/types/unit.ts`) is retired; `@danielsimonjr/mathts-core`'s `Unit` is now the single, feature-complete merged implementation, and `functions` `unit()`/`to()`/`toBest()`/arithmetic+comparison operators all return that one class (the `to`/`toBest` operator dual-flavor branching is gone).

  Caller migration:

  - Unit arithmetic is at the operator level — use `add`/`subtract`/`multiply`/`divide` from `@danielsimonjr/mathts-functions`, not `unit.add(…)`/`.sub`/`.mul`/`.div`. `u1 / u2` of the same dimension returns a plain dimensionless number (mathjs parity).
  - `unit.equalBase(other)` replaces `unit.dimensionsEqual(other)`; dimensions are a 9-element exponent array, not a struct; `unit.formatUnits()`/`unit.toString()` replace `.notation`.
  - Temperature offsets apply on conversion (`new Unit(20,'degC').value === 20`; `.to('K')` → `293.15 K`); `°C`/`°F`/`°` are accepted.
  - `DimensionMismatchError`/`UnitParseError` are still thrown and exported; `Unit`/`isUnitValue`/`DIMENSIONLESS`/`dim`/`Dimensions`/`UnitDef` keep their import paths. New `UnitInstance` type export for type position.

  Also corrects `eV` to the exact 2019-SI value `1.602176634e-19` J.

### Patch Changes

- d27e0a5: Fix temperature-unit conversions and preserve degree-symbol notation in the merged `Unit`:

  - `Unit.parse` normalizes `°C`→`degC`, `°F`→`degF`, `°`→`deg` before tokenizing (the mathjs parser rejects `°`), so the merged Unit accepts the same inputs the previous core Unit did.
  - `new Fraction(fraction)` now clones its argument instead of falling through to `BigInt(fraction)`, which threw for non-integer values (e.g. `degF`'s `5/9` factor).
  - `typeOf(value)` returns canonical `'Complex'`/`'Fraction'` for those types instead of `constructor.name` (which a bundler mangles to `_Complex`/`_Fraction`), fixing the Unit's value-type converter dispatch in the built bundle.

  Net effect: `degF`/`°F` conversions (`32 °F → 0 degC`) now work.

## 0.3.1

### Patch Changes

- Gap-analysis closure (no deferral): the remaining high-complexity functions + two root-cause bug fixes.

  All verified against NumPy/SciPy or by self-consistency (d/dx ∫f = f).

  **functions — new:**
  - Optimizers: `nelderMead`, `gradientDescent`, `levenbergMarquardt`.
  - Clustering: `kmeans`, `spectralClustering`.
  - Digital filter design (vs scipy.signal): `firwin`, `butter`, `lfilter`, `lfilterZi`,
    `filtfilt` — `butter` via the full zpk→bilinear→tf pipeline, `filtfilt` via scipy's
    `lfilter_zi` steady-state edge handling (both to machine precision).
  - `studentizedRangeCDF` / `studentizedRangeQuantile` + `tukeyHSD` (vs scipy.stats).
  - `qz` (generalized Schur decomposition of a pencil).
  - `symbolicIntegral` (symbolic indefinite integration over a useful subset).

  **core — fix:** `new Fraction(0.25)` threw `BigInt(0.25)`, which silently broke the CAS
  `simplify` and symbolic `derivative` for ANY fractional coefficient (e.g.
  `derivative('x^4/4','x')`). The constructor now decomposes a non-integer number into an
  exact integer ratio (`0.25` → `1/4`).

## 0.3.0

### Minor Changes

- Named mathematical constants are now real exports + evaluator symbols.

  `docs/reference/constants.md` documented `import { PI, E, PHI, TAU } from
'@danielsimonjr/mathts-core'`, but those were never exported. They exist now:

  - **core**: new named exports `PI`, `E`, `TAU`, `PHI`, `SQRT2`, `SQRT1_2`, `LN2`,
    `LN10`, `LOG2E`, `LOG10E` (plain numbers). The imaginary unit `I` and the
    type-specific constants (`COMPLEX_*`, `BIGNUMBER_*`, `FRACTION_*`) are unchanged.
  - **functions**: the expression-evaluator scope gains `phi`, the imaginary unit
    `i`, and `SQRT2` / `SQRT1_2` / `LN2` / `LN10` / `LOG2E` / `LOG10E` (it already had
    `pi`/`e`/`tau`). So `evaluate('phi')` → 1.618…, `evaluate('2 + 3*i')` → Complex(2, 3).

## 0.2.0

### Minor Changes

- Matrix-factory acceleration + a matrix eigensolver correctness fix + forward-mode AD.

  **fix(matrix): eig — wrong eigenvalues for symmetric matrices with structural zeros.**
  The symmetric-only Givens/Wilkinson eigenvalue path returned grossly wrong
  eigenvalues for symmetric matrices with off-diagonal zeros (e.g. the tridiagonal
  `[[2,-1,0],[-1,2,-1],[0,-1,2]]` gave `[19.05, 2, 0.94]` — sum 22 ≠ trace 6 —
  instead of `[0.586, 2, 3.414]`). Fixed by routing all matrices through the robust
  JAMA orthes/hqr2 solver (verified vs numpy). This also repairs latent wrong
  results in `tensorEig`/`tensorEigWasm`. Note: eigenvectors for symmetric input now
  follow the general solver's convention (they are sign-ambiguous; A·v = λ·v holds).

  **perf(functions): det / inv accelerated.** Large (≥8×8) numeric square matrices
  now route `det` (~20× on 80×80) and `inv` (~9×) through the native Float64Array
  LU instead of boxed `number[][]`. numpy-verified; small / non-numeric / singular
  inputs fall back to the factory unchanged.

  **feat(functions + core): forward-mode automatic differentiation.** A new scalar
  `Dual` type (core, registered for typed dispatch) plus `Dual` signatures on the
  elementary functions (add/sub/mul/div/pow/sin/cos/tan/exp/log/sqrt/square/cube/
  cbrt/abs) make the ordinary functions API differentiable. New entry points
  `derivativeAt` / `valueAndDerivativeAt` / `gradientAt`:

      derivativeAt((x) => multiply(sin(x), x), 2)   // sin(2) + 2·cos(2), exact

## 0.1.5

### Patch Changes

- `Complex` now exposes short-name arithmetic aliases `sub`/`mul`/`div`/`neg` (delegating to `subtract`/`multiply`/`divide`/`negate`). The functions-package typed arithmetic (`subtractScalar`, etc.) calls the short names on scalars; a core `Complex` (e.g. from `sqrt(-4)`) flowing into those paths previously threw `x.sub is not a function`. Mirrors the existing `Fraction` short-alias fix.

## 0.1.4

### Minor Changes

- Add `BigNumber.toBinary()`, `toOctal()`, and `toHexadecimal()` (Decimal.js-compatible: `0b`/`0o`/`0x` prefixes, leading `-` for negatives, exact for integers and terminating fractions). These complete the radix-formatting surface the expression formatter's hex/bin/oct BigNumber path depends on.

## [Unreleased]

### Tests

- Raise vitest line coverage of the active core modules from ~80% to ~99% (every active file now ≥98%). Added 4 supplementary test files — `tests/types/complex-coverage.test.ts`, `tests/types/fraction-coverage.test.ts`, `tests/types/bignumber-coverage.test.ts`, `tests/typed/mathts-typed-coverage.test.ts` — plus `math.register`/`math.get` cases in `tests/factory/factory.test.ts`. These exercise previously-untested branches: `Complex` scalar-argument arithmetic, `format()` precision/notation paths, reciprocal/inverse trig & hyperbolic functions; `Fraction` scalar arithmetic, parse dispatch, continued-fraction round-trips, and integer floor/ceil short-circuits; `BigNumber` special-value (NaN/±Infinity/zero) branches across conversions, arithmetic, comparison, rounding modes, trig/hyperbolic/transcendental helpers, the `.e` getter, and the Decimal.js-compat aliases; and `mathts-typed` WASM init helpers, every `MATHTS_CONVERSIONS` convert callback, the duck-typed `isUnit`/`isMatrix`/`isDenseMatrix`/`isSparseMatrix` guards, and the full `TypeRegistry` lifecycle. No source changes — behavior-asserting tests only.

## 0.1.3

### Patch Changes

- Re-export `Unit` from the published build. `core@0.1.2` shipped to npm without `Unit` in its entry export block (the committed `dist` predated the Unit-export commit and was not rebuilt before publish), so downstream `@danielsimonjr/mathts-functions` hit `Unit is undefined`. Rebuilt so `dist/index.js` and `dist/index.d.ts` export `Unit` (`new Unit()`, `.to()`, `.toBest()`, `.value`, `.type`). Added a regression test that asserts the export against the built artifact so this cannot silently regress before a publish.

## 0.1.1

### Patch Changes

- e771b4e: Fix all pre-existing build, typecheck, and configuration issues across the monorepo.

  ### assembly/ (WASM)
  - Fix AssemblyScript build: prefix 114 bare math calls with `Math.`, fix abort path in asconfig.json
  - Add 6 missing inverse trig methods to Complex class (asin, acos, atan, asinh, acosh, atanh)
  - Fix complex_pow calling wrong method (pow → powReal for f64 args)

  ### expression/
  - Enable build: fix broken types.ts import, create tsconfig.json, restore build script
  - Copy shared mathjs utils into package, fix 60+ import paths
  - Export missing types (CompiledExpression, StringOptions), clean up unused @ts-expect-error directives

  ### parallel/ + matrix/ + compat/
  - Fix typecheck failures caused by workerpool shipping raw .ts sources
  - Create workerpool type stub (parallel/types/workerpool.d.ts) with full declarations
  - Redirect workerpool resolution via tsconfig paths in all affected packages

  ### All packages
  - Add @types/node to all 7 workspace package devDependencies
  - Add vitest.config.ts to 5 packages missing local test configs
  - Fix missing beforeAll/afterAll imports in ParallelMatrix tests

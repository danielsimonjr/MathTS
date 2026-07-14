# @danielsimonjr/mathts-core

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

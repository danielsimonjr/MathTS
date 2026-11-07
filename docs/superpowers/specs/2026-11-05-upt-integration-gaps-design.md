# UPT ↔ MathTS integration gaps — Design

**Status:** proposed 2026-11-05. Source of truth for the measurement is
[UPT PR #581](https://github.com/danielsimonjr/Universal-Physics-Tensor/pull/581),
merged as `4ceffef0`, file
`docs/audit/2026-11-05-mathts-integration-gaps.md` on Universal-Physics-Tensor
`master`. This spec is the MathTS response. It authorizes MathTS design and
the implementation plan at
`docs/superpowers/plans/2026-11-05-upt-integration-gaps.md`. It does not
authorize a UPT code change, a pin bump, a tag, or an npm publish.

**Goal:** Close every open MathTS-side gap in that audit (P0 N4; P1 U3, U4,
U5, U6, U7, U9, D1, D2; P2 U2, U10, N5, D4, D5, D6, D7), plus optional policy
U8, so a later UPT consumer can delete a local unit grammar or call
`searchScalars` without a silent wrong scale, a silent dimension pick, or a
`Promise` where a length-3 mean was required.

**Oracle:** MathTS `main` at `f6205fec` (matches `origin/main` on 2026-11-05)
and npm latest the same day: `@danielsimonjr/mathts-core@0.21.1`,
`mathts-functions@0.72.0`, `mathts-expression@0.12.1`,
`mathts-statistics@0.4.2`, `mathts-units@0.7.0`. Where the audit and this
tree disagree, this spec follows the tree and records the disagreement.

---

## 1. Why these are MathTS changes

UPT already delegates exact scales, `Unit.parse` for an agreed spelling set,
and most numerics. The rows below are the places where that delegation still
returns a wrong or unsafe answer, or where UPT still owns a grammar only
because MathTS cannot express the contract. UPT-track work (lockfile floors,
deleting a local splitter, probe opt-in) is a consumer note in §8. It is not
a task in the MathTS plan.

Closed on current npm and on this tree. Do not reopen them:

| ID  | Contract                                       | Where it is closed                                              |
| --- | ---------------------------------------------- | --------------------------------------------------------------- |
| U1  | `dB`, `dBm`, `dBW`, `Np`, `Mach`, `mach` throw | `REFUSED_UNIT_SPELLINGS` in `core/src/types/unit/unit-table.ts` |
| U12 | `d` = 86400 s                                  | built-in day row; `dm` stays decimetre                          |
| N1  | `gammaincp` is the upper tail, not `1 - P`     | functions since 0.68.3                                          |
| N2  | `findRoot` `xtol` is independent of `tol`      | `functions` root finder                                         |
| N3  | `quad` `atol` exists and may be `0`            | `functions/src/numeric/adaptive-quad.ts`                        |

---

## 2. Architecture — which package owns which gap

Re-export packages (`units/`, `statistics/`, `linalg/`, `numbers/`) contain
no implementation. Edits go in the package that owns the symbol.

```
core/src/types/unit/
  unit-table.ts     rows and prefix sets (U2 ton, U8 bit scale, U10 pc)
  Unit.ts           parse loop, glued split, superscripts, affine gate,
                    to(..., { reading }), cycles on the result (U3–U7, U9)
  errors.ts         AmbiguousUnitError next to UnitParseError (U2, U7)
  exact-scale.ts    unchanged; exactScale('Hz') stays 1 (U9)

core/src/types/si-dimension-vector.ts
                    length-10 ↔ 7-vector. Do not add an axis-8 special case
                    here. BIT stays index 8 of the Unit vector (D2).

core/src/numeric/stable.ts
                    pairwiseDot already takes ArrayLike and returns number.
                    N4 documents it; no algorithm change.

functions/src/typed/arithmetic.ts
                    public mean/sum/variance/std: sync number for Array,
                    Float32Array, and Float64Array (N4).

functions/src/typed/numeric.ts
                    leastSquares / linsolve soft pivot (N5, optional).

functions/src/numeric/rational-nullspace.ts
                    already accepts number | Fraction. Optional bigint
                    rows so a caller need not construct Fraction (D4).

functions/src/scalar-dimension.ts
                    unitToRationalDimension: optional mapUnit; stop treating
                    index 8 as the only information policy (D2).

functions/src/scalar-search.ts
                    dimensions.equal optional. admit, loss, and scalarToTex
                    already exist (D1, D5). Document; do not add a printer.

functions/src/typed/statistics.ts
                    parallelStatMean stays the async pool path. N4 points
                    callers here when they want a Promise.

statistics/src/index.ts
                    re-exports functions. D7 documents that owner; no second
                    CDF implementation.
```

`expression/` gains no grammar symbols. Scalar search stays string-free.
`mathts-units` is not a second unit table.

---

## 3. Verified behavior on this tree (do not re-derive)

Probed by reading source at `f6205fec`. npm `version` for the five packages
above matches each `package.json`.

| Claim in the audit                                                                          | This tree                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mean(Float32Array)` throws; `mean(Float64Array)` is a `Promise`                            | True. `functions/src/typed/arithmetic.ts` `mean` has `Array` (sync `pairwiseSum`) and `Float64Array` (`await computePool.mean`). No `Float32Array` signature. `ComputePool.mean` is `async`, so length 3 is still a Promise.                                                                                                                                                                                                                                |
| core `pairwiseDot` on `Float32Array` is sync                                                | True. `pairwiseDot(a, b, start?, end?)` takes `ArrayLike<number>` and returns `number` (`core/src/numeric/stable.ts`).                                                                                                                                                                                                                                                                                                                                      |
| `ton` is US short ton, 907.18474 kg                                                         | True. Row `ton` scale `2000*pound`. Alias `tons` → `ton`. `t` and `tonne` are 1000 kg and stay.                                                                                                                                                                                                                                                                                                                                                             |
| `degC/s` parses; `.to('K')` adds 273.15                                                     | True. `degC` has `offset: '273.15'`. `Unit.prototype.to` takes one argument. No `reading` option.                                                                                                                                                                                                                                                                                                                                                           |
| `m2K`, `Vs`, `cm^2/Vs`, `mmin`, `NN` are “not found”; `K²` is `Unexpected "²"`              | True today. After U5+U7 the answers are not all “parse as a product.” UPT `units.ts` (audit PR shape: copy that grammar): one legal product → parse (`m2K`, `Vs`, `NN`); two heterogeneous products → refuse (`mmin` is m·min or mm·in; `mAs` is mA·s or m·A·s). The audit U5 table listed `mmin` as a parse; that row is **wrong relative to UPT’s own grammar**. MathTS follows `units.ts`.                                                               |
| `mol/mL` is one reading (millilitre); `mAs` is “not found”                                  | True today. U7 is not “cuts only on a miss.” A **bare** token that is one factor stays that factor (`mm`). **Inside a compound**, a prefixed denominator factor competes with heterogeneous products (`mL` in `mol/mL` is millilitre or metre·litre). Homogeneous prefix-letter runs (`m·m`) are not readings.                                                                                                                                              |
| `exactScale('Hz') === 1`; `.to('rad/s')` multiplies by 2π                                   | True. `Hz` has `cycles: true` and scale `1`. `cycleAngleBridge` returns the cycle-count delta; `to` multiplies by `(2π)^k` and does not attach `k` to the result.                                                                                                                                                                                                                                                                                           |
| `mpc` not found; `kpc`/`Mpc`/`Gpc` parse                                                    | True. `pc` uses prefix set `SHORT_UP_ONLY` (`siShort(1, p => p >= 3)`).                                                                                                                                                                                                                                                                                                                                                                                     |
| `Unit.exactScale('bit')` is 1; information is axis 8                                        | True. Row `b` base `BIT` scale `1`. `BASE_DIMENSIONS` index 8 is `BIT`. `toSiDimensionVector` throws when index 7, 8, or 9 is nonzero unless `ignoreExtra`.                                                                                                                                                                                                                                                                                                 |
| `UNIT_PREFIX_SETS` is not exported, so UPT must split prefixes itself                       | **Disagree.** `UNIT_PREFIX_SETS` and `unitPrefixExactScale` are already exported from `@danielsimonjr/mathts-core` (`core/src/index.ts`). U10’s remaining work is the `pc` row, not a new export.                                                                                                                                                                                                                                                           |
| `searchScalars` has `grammar.admit` on 0.72                                                 | **True on npm 0.72.0 and on this tree.** `functions/package.json` is `0.72.0`. `functions/CHANGELOG.md` under `## 0.72.0` records `grammar.admit` on seeds and offspring, plus `loss`, `invalidRows`, `complexityWeights`, and `simplify`. The root `CHANGELOG.md` `[Unreleased]` section still repeats those SR-1–SR-7 bullets; that section is not evidence the package version is behind npm. D1 does not add `admit`. Do not write “0.72.0 lacks SR-1.” |
| `scalarToTex` exists; no new printable form                                                 | True. Exported from functions.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `dimensions` filter is a 7-vector of `Fraction`s; `unitToRationalDimension` throws on `bit` | True. `RationalDimension` is `SiDimensionVector` (seven `Fraction`s, BIPM `[L, M, T, I, Θ, N, J]`). `unitToRationalDimension` reads `vector[8]` and throws `UnitParseError` for a nonzero BIT exponent. There is no `mapUnit` and no `equal` hook.                                                                                                                                                                                                          |
| `leastSquares` throws `linsolve: singular matrix`                                           | True. `leastSquares` forms normal equations and calls `linsolve`, which throws when the partial-pivot magnitude is `< 1e-15` (absolute, on `AᵀA`, not on `A`). The audit’s `1e-8` throw / `1e-6` numeric split is that composed behavior, not a named `1e-8` constant. N5, if done, changes this threshold’s meaning; it does not invent a second solver.                                                                                                   |
| `rationalNullspace` needs a second `Fraction`                                               | **Disagree for plain integers.** The signature is `(matrix: ReadonlyArray<ReadonlyArray<number \| Fraction>>, options?)`. A 7-column integer `number[][]` does not import `Fraction`. `Fraction.fromNumber` is the continued-fraction path the audit refuses for irrationals; safe integers stay exact. D4’s optional extra is a `bigint` cell type so a large integer never goes through `fromNumber`.                                                     |
| statistics and functions are two CDF owners                                                 | **Disagree as implementations.** `statistics/src/index.ts` states the implementations live in functions and re-exports them (`mean`, `chiSquaredCDF`, hypothesis tests). D7 is a public owner sentence plus a binding test, not a new distribution.                                                                                                                                                                                                         |

`ly` stays `SHORT_UP_ONLY`. This spec changes `pc` only.

---

## 4. Contracts

### 4.1 N4 — typed reductions are numbers (P0)

Public typed reductions in `functions/src/typed/arithmetic.ts`:

- `mean`, `sum`, `variance`, `std` (the `Array` and `Float64Array` overloads that exist today).

Contract after MT-1:

```ts
mean(data: readonly number[] | Float32Array | Float64Array): number
sum(data: readonly number[] | Float32Array | Float64Array): number
variance(data: readonly number[] | Float32Array | Float64Array, normalization?: VarNormalization): number
std(data: readonly number[] | Float32Array | Float64Array, normalization?: VarNormalization): number
```

Rules:

1. The return value is a `number`, never a `Promise`, at every length including 0 and 3. `await` of that number still works. A caller that branches on `instanceof Promise` must switch to the async name below.
2. Empty input: `mean` / `sum` follow today’s `Array` path (`mean` → `NaN`; `sum` of `[]` stays the current `pairwiseSum([])` result). Do not special-case typed arrays.
3. Float32 and Float64 values convert with `new Float64Array(data)` (the constructor, not `TypedArray.from`) and then the existing `pairwiseSum` / `sumSquaredDeviations` path. Results match the `number[]` path bit-for-bit on values that are exactly representable in both types.
4. `pairwiseDot` stays synchronous `ArrayLike` → `number`. A test pins `pairwiseDot(Float32Array.of(1, 2, 3), Float32Array.of(1, 2, 3)) === 14`.
5. The async pool path keeps its name: `parallelStatMean`, `parallelStatSum`, `parallelStatVariance`, `parallelStatStd` in `functions/src/typed/statistics.ts`. They may still return `Promise<number>`. Docs name them as the only Promise-returning means.
6. WASM is not on these reductions. `loadWasm()` does not change `mean`. The doc sentence is: sync JS pairwise for the names above; async worker pool only for `parallelStat*`; no wasm dispatch.

`prod`, `min`, `max`, and `median` keep their current signatures in this sprint unless they share the `Float64Array → Promise` branch in the same function object. If they do, they get the same sync contract in the same PR. Do not leave `mean` sync and `std` async.

### 4.2 U6 — Unicode superscripts (P1, same PR as U5)

Before tokenization, rewrite a superscript run that sits on a unit factor:

| Character    | Replacement                                         |
| ------------ | --------------------------------------------------- |
| `⁰¹²³⁴⁵⁶⁷⁸⁹` | `^0` … `^9`                                         |
| `⁻`          | `^-` when the next character is a superscript digit |

`K²` parses as `K^2`. `m²` parses as `m^2`. ASCII `^` is unchanged. A superscript that is not on a factor (leading the string, or after an operator with no unit) still throws `UnitParseError`.

### 4.3 U5 — glued products (P1)

Copy the UPT `units.ts` splitter (audit MT-2 PR shape). Do **not** use greedy longest-left match (that reading of `mmin` is `mm·in`, not `m·min`).

Enumerate every segmentation of an alphanumeric token into one or more factors (`_findUnit` / prefix+unit, plus a trailing digit run as an integer power of the left factor). Then apply these filters:

1. A split that puts a prefix letter’s own unit twice in a row is **not** a reading (`m·m` beside `mm`; `m·m·in` beside `mmin`). A unit that is not a prefix letter still juxtaposes with itself (`NN` → N·N).
2. **A single unit wins.** A token that `_findUnit` resolves (an exact unit or prefix+unit) is that unit, on either side of a solidus, and products are not considered. `mm` is millimetre, `Hz` is hertz, `pc` is parsec, `mol/mL` is mole per millilitre, `m/ms` is metre per millisecond, `W/mK` is watt per millikelvin. Only a token that `_findUnit` does not resolve is split.
   2b. **A refused prefix is not a product.** A token that is not one factor and starts with a prefix symbol of any prefix set followed by a unit name is refused with "not found" and is not split. `mly`, `nly` and `mpc` are prefixes that `ly` and `pc` do not accept, and `dBs` is not deci-bel-second. The rule also refuses glued products that start with a prefix letter, such as `mAs`, `mPas` and `mNm`; the caller writes `mA*s`, `mPa*s` or `mN*m`. A refusal is safer than a reading that turns a refused prefix into a unit.
3. After the filters, **exactly one** reading → that product replaces the token. `Vs` → V·s, `m2K` → m^2·K, `NN` → N·N, `cm^2/Vs` → cm^2/(V·s). Powers and the solidus already around the token apply to the product as a parenthesized group (`m2K/s` → (m^2·K)/s).
4. **Zero** readings → today’s `UnitParseError` “not found.”
5. **Two or more** readings → U7 (MT-3). Until MT-3 ships, keep “not found” rather than silently picking one. `mmin` is two products (m·min and mm·in); it is **not** a U5 success.

Exact symbol still wins for `min`, `mol`, `bar`, and `ton` (until U2 refuses `ton`) as one-factor tokens.

### 4.4 U7 — dimensionally distinct readings (P1, after U5)

When the U5 enumerator, after the filters in §4.3, still has two or more readings, throw (do not require the vectors to differ before throwing: UPT names every remaining reading. If two spellings have the same length-10 vector, apply the tie-break below and keep one; throw only when at least two **distinct** dimension vectors remain):

```ts
class AmbiguousUnitError extends UnitParseError {
  readonly readings: readonly string[]; // canonical spellings, stable order
}
```

Message names every reading. Rule 2b refuses `mAs` and `mmin` before the splitter runs, so they throw "not found", not `AmbiguousUnitError`. `mol/mL` does not throw: rule 2 keeps the millilitre. `mm` as a **bare** token still parses (rule 2); `m·m` was never a reading (rule 1).

When every remaining reading has the same dimension vector, keep a single result. Tie-break: the reading with the fewest cuts; if still tied, the one-factor `_findUnit` hit; if still tied, the lexicographically first canonical spelling. Document the tie-break in the `Unit.parse` JSDoc. Do not pick among different dimensions.

`AmbiguousUnitError` is exported from `@danielsimonjr/mathts-core`.

### 4.5 U3 — affine bases in compounds (P1)

An affine built-in is a row with a nonzero `offset` (`degC`, `degF`, and any row that gains an offset later).

`Unit.parse` accepts an affine unit only as the sole unit factor, power `+1`, with an optional leading value (`25 degC`, `degC`). These throw `UnitParseError` unless `options.affine` is set:

- `degC/s`, `degC*m`, `1*degC` (product, not “value then unit”), `degC^2`, `(degC)`.

```ts
interface ParseOptions {
  affine?: 'absolute' | 'difference';
}
```

- Omitted: refuse the compound (the default).
- `'absolute'`: parse the compound and apply offsets the way a lone `degC` does today (each affine factor shifts). This is an explicit opt-in, not the silent default.
- `'difference'`: parse the compound and ignore offsets (a temperature interval).

`1 degC` with a space or with the leading-value production stays absolute. The flag does not change `25 degC` → 298.15 K.

### 4.6 U4 — difference conversion (P1, same PR as U3)

```ts
to(target: string | Unit, options?: { reading?: 'absolute' | 'difference' }): Unit
```

- Omitted or `'absolute'`: today’s behavior, including offset (`1 degC` → 274.15 K).
- `'difference'`: convert the interval. Offset of the source is not added; offset of the target is not added. `parse('25 degC').to('K', { reading: 'difference' })` has numeric value 25. `parse('18 degF').to('K', { reading: 'difference' })` has numeric value 10 (the 5/9 scale only).

`equalBase` still applies. A cycle bridge (U9) is orthogonal: difference does not strip the 2π factor.

### 4.7 U9 — cycles on the conversion result (P1)

`Unit.exactScale('Hz')` stays the scale of 1 Hz as a frequency, numeric 1. Do not fold 2π into `exactScale`.

`to` keeps multiplying by `(2π)^k` when `cycleAngleBridge` returns `k ≠ 0`. The returned unit gains:

```ts
readonly cycles: number; // the bridge k; 0 when the ordinary dimension path was used
```

`parse('1 Hz').to('rad/s').cycles === 1` and the value stays `2π`. `parse('1 Hz').to('1/s').cycles === 0` and the value stays 1. `cycles` is 0 on units that were not produced by `to`.

UPT’s acceptance: read `cycles` and apply 2π only for a parameter marked angular. MathTS does not change `convertValue`.

### 4.8 U10 — prefixes on `pc` (P2)

Change the `pc` row from `SHORT_UP_ONLY` to `SHORT`. Then `mpc` is milliparsec (`pc/1000`), and `kpc`, `Mpc`, `Gpc` stay. No new prefix-set export. `UNIT_PREFIX_SETS` remains the way a caller inspects the set. `ly` is unchanged.

### 4.9 U2 — `ton` (P2)

Bare `ton` and the alias `tons` throw `AmbiguousUnitError` (or `UnitParseError` with the refused-spelling reason if the ambiguous class is the wrong layer — prefer `AmbiguousUnitError` so U7 and U2 share one type). Readings named in the message:

- US short ton, 2000 lb, spelling `shortton`
- UK long ton, 2240 lb, spelling `longton`
- metric tonne, 1000 kg, spelling `t` or `tonne`

Add rows `shortton` and `longton` so the US short ton still has a spelling. Do not keep a silent `ton` → 2000 lb. `t` and `tonne` stay 1000 kg.

### 4.10 U8 — `bit` (policy, optional, not a blocker)

Default stays: `bit` is base `BIT`, scale 1, axis 8. UPT keeps `applyBitScaleOverride`. MathTS does not tell UPT to flip the 7-vector onto axis-8 scale 1.

Optional parse option, default off:

```ts
parse(text: string, options?: { bit?: 'storage' | 'ln2' }): Unit
```

- `'storage'` or omitted: today.
- `'ln2'`: that one parse treats `bit` as dimensionless with exact scale ln 2. It does not mutate the built-in row and does not call `Unit.createUnit`.

MathTS does not implement this option. UPT keeps `applyBitScaleOverride`, which is the policy. Shipping U3–U7 does not depend on it.

### 4.11 D1 — discovery API readiness (P1)

No new search feature. The contract to lock in docs and a characterization test:

- `searchScalars` rejects formula strings. Callers pass `ScalarNode`.
- `grammar.admit?: (node: ScalarNode) => boolean` runs on seeds and on mutation offspring. A rejected seed is skipped. A rejected child counts as a failed attempt inside the existing 10-attempt budget. `scalarGrammarAccepts` does not call `admit`. Enumeration already applies `admit`.
- `scalarToTex` / `nodeToScalar` / `scalarToNode` are the printable and lowering forms. Do not add another.
- A call that uses the expression 0.11 grammar (through `abs`, no `sqrt` / `atan`) and omits `dimensions` does not require a functions bump past the 0.70 line for the symbol `searchScalars` to exist. `sqrt` / `atan` and `runScalarSearch` and `dimensions` are 0.12 / 0.72 surfaces. `admit` on seeds and offspring **is** in published `0.72.0` (and on this tree). Acceptance text may say 0.72.0 has SR-1. D1 still only documents and characterizes; it does not add a hook.

UPT acceptance: pass `validate` as `admit`. Do not replace `upt discover` with `searchScalars`.

### 4.12 D2 — caller-supplied dimensions (P1)

`ScalarDimensionFilter` stays seven `Fraction`s. UPT passes the 7-vector it computed **after** its bit override, in `symbols` and `target`. MathTS does not hard-code “bit means axis 8 scale 1” inside that comparison.

Add two optional hooks; both default to today’s behavior:

```ts
interface ScalarDimensionFilter {
  readonly symbols: Readonly<Record<string, RationalDimension>>;
  readonly target: RationalDimension;
  readonly onUnderdetermined?: 'keep' | 'reject';
  /** Component-wise Fraction equality when omitted. */
  readonly equal?: (left: RationalDimension, right: RationalDimension) => boolean;
  /**
   * When set, unitToRationalDimension(name, { mapUnit }) returns this instead
   * of the built-in 7-vector. Used for names the built-in map rejects (`bit`).
   * The search does not parse unit literals inside ScalarNode; the hook is on
   * the helper UPT would call while filling `symbols`.
   */
  readonly mapUnit?: (unitName: string) => RationalDimension;
}
```

`unitToRationalDimension(unitName, options?: { mapUnit })`:

- No `mapUnit`: unchanged, including the throw when `vector[8] !== 0`.
- With `mapUnit`: call it and return its 7-vector. Do not consult index 8 for that call. A return that is not seven `Fraction`s throws `TypeError`.

The default path may still mention index 8. The hook path must not. Do not change `toSiDimensionVector`’s index list.

### 4.13 N5 — soft singularity (P2, optional)

`leastSquares` may keep throwing `Error('linsolve: singular matrix')`. Optional change: equilibrate each column of `A` before the normal equations, and treat a pivot as singular when it is `< 1e-13` times the equilibrated column scale (the UPT `solveWeighted` cutoff), instead of `< 1e-15` absolute on `AᵀA`.

If the measured change moves a currently accepted well-conditioned system into the throw, do not ship it. UPT is not required to switch off `solveWeighted`. Skipping MT-10 leaves N5 open on purpose.

### 4.14 D4 — integer nullspace without a second Fraction (P2, optional)

Plain integer `number[][]` remains the supported input. Document that a safe integer does not need `Fraction`, and that `fromNumber` is the wrong path for a non-integer.

Optional: accept `bigint` cells and convert with `new Fraction(cell, 1n)`, never `fromNumber`. A matrix that mixes `bigint` with a non-integer `number` throws `TypeError`. Do not import a second Fraction class. UPT’s irrational-denominator scan stays in UPT.

### 4.15 D5 — one loss (P2, docs)

SR-3 on `main` already uses one named `loss` (`'l2' | 'l1' | 'huber'`) for the hall and for `fitScalarParameters`. The unreleased changelog also says the fitter’s reported loss under `invalidRows: 'penalize'` excludes invalid rows while the ranker adds a penalty. That split is the exception to document in one sentence: the **named loss** is one objective; the invalid-row penalty is a ranker add-on, not a second loss function. Do not add a new loss. Do not tell UPT to drop holdout.

### 4.16 D6 — linalg (P2, defer)

No new decomposition. Functions already export `inv`, `det`, `ols`, `matrixRank`, `rationalNullspace`, `svd`, `eigs`, `leastSquares`. There is no export named `eig`. A missing primitive is not blocking search. A later PR needs a measured caller. This spec’s plan records a characterization test that those names exist, and no implementation task.

### 4.17 D7 — one distribution owner (P2, docs)

The implementation owner of every name `statistics` re-exports is `@danielsimonjr/mathts-functions`. `@danielsimonjr/mathts-statistics` is a curated entry. A test asserts `normalCDF` (and `chiSquaredCDF`) from the two packages are the same function. No second formula.

---

## 5. Algorithms that are easy to get wrong

**Glued split vs prefix.** Use §4.3. Enumerating every cut without dropping `m·m` makes `mm` ambiguous; rule 1 prevents that. The design is: a token that `_findUnit` resolves is that unit, on either side of a solidus (SI Brochure §3.1: a prefix symbol attached to a unit symbol forms a new inseparable unit symbol). The splitter runs only on a token that `_findUnit` does not resolve. The rejected alternative lets a prefixed denominator factor compete with products; it refuses `g/mL`, `mg/mL`, `mol/mL` and `m/ms`, which parse today. `W/mK` is watt per millikelvin under this design, as it is today; a caller who means W/(m·K) writes `W/(m*K)`.

**Affine vs value.** The leading-number production (`25 degC`) is a value. A `*` between a number and a unit is a product (`1*degC`) and is the compound U3 refuses. Tests must include both spellings.

**Difference `to`.** Subtract the source offset in the source’s own unit, scale by the dimensionless factor between the absolute scales, and do not add the target offset. Do this with the existing exact-scale helpers, not `value - 273.15` written out for Celsius only. Fahrenheit’s 5/9 has to fall out of the same path.

**Cycles.** `cycles` on the result is the integer `k` from `cycleAngleBridge`, including when exact SI multiplication already applied `(2π)^k`. Do not also divide the value by 2π. UPT applies 2π only when its parameter is angular; MathTS’s numeric `to('rad/s')` stays the angular reading.

**Float32 copy.** `new Float64Array(float32)` copies numeric values. `Float64Array.from(float32)` is the slow per-element path this repo has already mis-measured. The implementation and the tests use the constructor.

**Dimension equality.** Default `equal` is `left[i].equals(right[i])` for `i` in `0..6`. A caller hook that throws is a search failure (`Infinity` score, same bucket as an inconsistent solve), not an uncaught exception out of the generator, matching the other dimension violations.

---

## 6. Scope boundaries

### In scope (MathTS PRs)

MT-1 N4, MT-2 U5+U6, MT-3 U7, MT-4 U3+U4, MT-5 U8 optional, MT-6 U9, MT-7 U10, MT-8 U2, MT-9 D2, MT-10 N5 optional, plus D1 characterization, D4 optional bigint cells, D5 doc sentence, D6 export lock, D7 owner test. One grammar family or one API surface per PR. Details and commands are in the plan.

### Non-goals (stay UPT-local; not MathTS work)

From the audit §5. Do not schedule these:

- Kerr 2×2 Newton, `solveWeighted`, lattice/field stencils, finite-difference bridge gradient.
- `SCALAR_FUNCTIONS` dimension rules, `ExprNode`, the UPT 7-vector printers `siUnitOf` / `derivedUnitOf`.
- Natural and geometrized conventions, quantity-unit conventions, `data/units.json` admission, UPT error-class names.
- `applyBitScaleOverride` staying in the UPT wrapper even if MT-5 ships.
- Cycles applied only for angular parameters inside UPT.
- Lean, PhysJS, catalog, atlas, discovery vetting, Buckingham irrational refusal, `algebraic-equivalence` refusing `symbolicEqual`.
- Applied-case records. `Unit.createUnit` remains forbidden for UPT.
- Widening UPT admission to MathTS’s full table (`furlong` and the rest).
- Replacing `upt discover` with `searchScalars`.
- Deleting MathTS unit rows to match UPT.
- Pin bumps, deleting UPT’s direct wasm/parallel/workerpool deps, probe opt-in flags.
- GPU kernels, notebooks, `mathts-compat`.
- A new printable scalar form. A second Fraction package.

---

## 7. Testing strategy

TDD on every behavior change. Tests live in the package that owns the code:

- `core/tests/unit/` for parse, `to`, prefixes, `ton`, cycles, bit option.
- `functions/tests/` for `mean` typed arrays, `leastSquares`, `rationalNullspace` bigint, dimension `mapUnit` / `equal`, the D1 admit characterization, the D6 export list.
- `statistics/tests/` or `tests/integration/` for the D7 identity binding.

Each new test imports from the package entry (`@danielsimonjr/mathts-core` or the package `src/index.ts` the sibling tests already use). After a `core` edit, rebuild `core` before a `functions` test. Commands are in the plan.

Probes that must fail before the fix and pass after:

| ID  | Probe                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| N4  | `mean(Float32Array.of(1, 2, 3)) === 2` and `mean(Float64Array.of(1, 2, 3)) === 2` and the value is not a Promise                                             |
| U5  | `parse('m2K')`, `parse('Vs')`, `parse('cm^2/Vs')`, `parse('NN')` match the spelled-out products. `parse('mmin')` is **not** a U5 success (two products; U7). |
| U6  | `parse('K²')` matches `parse('K^2')`                                                                                                                         |
| U7  | `parse('mAs')` and `parse('mmin')` throw `AmbiguousUnitError` with 2 readings; `parse('mol/mL')` is mole per millilitre; `parse('mm')` still millimetre      |
| U3  | `parse('degC/s')` and `parse('1*degC')` throw; `parse('25 degC')` still 298.15 K                                                                             |
| U4  | `parse('25 degC').to('K', { reading: 'difference' }).value === 25`                                                                                           |
| U9  | `exactScale('Hz')` numeric 1; `to('rad/s').cycles === 1`; value still 2π                                                                                     |
| U10 | `parse('mpc')` scale is `parse('pc')` / 1000                                                                                                                 |
| U2  | `parse('ton')` throws; `parse('t')` still 1000 kg; `parse('shortton')` is 2000 lb                                                                            |
| D2  | `unitToRationalDimension('bit', { mapUnit: () => dimensionless })` returns the caller vector and does not throw                                              |
| N5  | only if MT-10 is attempted: a column pair whose equilibrated pivot is below `1e-13` throws; a well-conditioned 2×2 does not                                  |

No new npm dependency. No benchmark claim. No `RELEASES_ENABLED` change.

---

## 8. Release and sprint plan

Publish stays the owner’s decision. The plan’s tasks do not run `npm publish`, do not tag, and do not merge the Changesets version PR. Each behavior PR adds a changelog bullet under `[Unreleased]` and a changeset when the repo’s rule for that package requires one. A docs-only characterization PR does not bump a version by itself.

Suggested merge order, one PR each:

| PR    | IDs    | Package surface                                    |
| ----- | ------ | -------------------------------------------------- |
| MT-1  | N4     | `functions` typed reductions                       |
| MT-2  | U5, U6 | `core` unit parse, glued + superscripts            |
| MT-3  | U7     | `core` ambiguity, depends on MT-2’s splitter       |
| MT-4  | U3, U4 | `core` affine + difference `to`                    |
| MT-5  | U8     | `core` optional `bit: 'ln2'`, skippable            |
| MT-6  | U9     | `core` `cycles` on `to`                            |
| MT-7  | U10    | `core` `pc` prefix set                             |
| MT-8  | U2     | `core` `ton` plus `shortton` / `longton`           |
| MT-9  | D2     | `functions` `mapUnit` / `equal`                    |
| MT-10 | N5     | `functions` `leastSquares`, skippable              |
| D1    | D1     | docs + characterization test, no behavior change   |
| D4    | D4     | optional `bigint` cells                            |
| D5    | D5     | one paragraph in `docs/reference/scalar-search.md` |
| D6    | D6     | export characterization only                       |
| D7    | D7     | same-function binding test + README sentence       |

UPT can, after a release that contains the PR, flip the matching row in `tests/dimensional/mathts-unit-gaps.test.ts` and extend `A5_DELEGATED_TEXTS`. That UPT PR is out of scope here. One grammar family per UPT PR, matching the audit’s UPT-4.

### UPT acceptance checklist (consumer, not implemented here)

- N4: `mean` on a length-3 `Float64Array` column is a number; `numberFrom` does not see a Promise. `pairwiseDot` on `Float32Array` stays sync.
- U5–U7: `m2K`, `Vs`, `cm^2/Vs`, `NN`, and `K²` parse; `mAs` and `mmin` throw `AmbiguousUnitError`; `mol/mL` is mole per millilitre, so a UPT test that expects `mol/mL` to throw changes with the adoption (UPT may keep a stricter check in its own wrapper; that is UPT-local policy, not MathTS work); `mm` is unchanged.
- U3–U4: `degC/s` throws; difference `to` of `25 degC` to `K` is 25; absolute `to` of `1 degC` is still 274.15 K.
- U9: `exactScale('Hz')` is 1; `to('rad/s').cycles === 1`.
- U10: `mpc` parses as pc/1000.
- U2: `ton` throws; `t` is still the tonne.
- D1: `admit` is `validate`; no string formula; `scalarToTex` is the printer.
- D2: symbols are UPT 7-vectors after the bit override; `mapUnit('bit')` is how a helper call avoids axis 8. UPT does not delete `applyBitScaleOverride` as part of adopting the hook.
- D4–D7: no UPT change required. `solveWeighted` stays if N5 is skipped.

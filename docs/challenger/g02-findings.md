# CHALLENGER findings — G02 (PR #1759, `cursor/g02-bind-factories-d797`)

Adversarial review of builder head `9318eb1b3499c51852c6e53182145ec93046aea1` against
`origin/main` (`b86c8abc`). Oracle for compat is **mathjs 15.3.0**; the source of truth for
numeric correctness is **NumPy / SciPy / SymPy / fraction.js**.

This branch adds **falsifying tests only**. It pushes no fix to #1759. Two suites:

- `functions/tests/challenger-g02-native-findings.test.ts` — native (critical-library) findings.
- `compat/tests/parity/challenger-g02-compat.test.ts` — compat-vs-oracle findings.

On the builder head these fail 7 and 28 respectively (see "Failing tests" below).

Every claim below was measured three ways with one probe script: the mathjs 15.3.0 oracle, the
builder head `compat/dist`, and an `origin/main` worktree built at the same commit. A case is a
**REGRESSION** only when base matched the oracle and head does not; otherwise it is a
**pre-existing** gap that G02 does not have to close.

---

## Part 1 — Critical-library hunks, classified (a) genuine bug fix / (b) mathjs-matching

Policy: a native **bug** (wrong result, ignored argument, crash, wrong error type) is fixed at
root cause; a **mathjs quirk** is not a bug and the critical libraries are never changed to
match it (Daniel, 2026-11-25 12:25 PM CT).

| Hunk                                                                                     | Class                                                                          | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/src/types/fraction.ts` `floor(places)` / `ceil(places)`                            | **(a) genuine bug fix**                                                        | Confirmed. On `origin/main` `Fraction.ceil/floor` accept no argument, so `factory_floor(fraction(7,3), 2)` returned `2` and `factory_ceil(...)` returned `3` — the digits argument was silently dropped. Head matches fraction.js/mathjs exactly across a 288-case sweep (15 fractions × places 0–8, positive and negative, value compared to 1e-15). Negative places throw `RangeError: undefined must be positive`, matching fraction.js. Regression test exists (`core/tests/g02-rounding-places.test.ts`). **Keep.**                                                                                                                                                                                                                 |
| `core/src/types/complex.ts` `floor(decimals)` / `ceil(decimals)`                         | **(a) genuine bug fix**                                                        | Confirmed the same defect: the `decimals` argument was accepted but ignored (`ceil(complex(1.2345,2), 1)` returned `2 + 2i`). Head matches the oracle over 112 cases including fractional and negative counts; `decimals === 0` keeps the old path bit-for-bit. Regression test exists. **Keep.**                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `functions/src/statistics/variance.ts` — `re(diff * conj(diff))` → `diff * diff`         | **(b) mathjs-matching; must be reverted, with the adapter moved to `compat/`** | **Finding N1.** The removed expression is the textbook definition `E[                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | x−μ | ²]`; the replacement is mathjs's own quirk. NumPy is unambiguous: `np.var([1+2j,2], ddof=1) = 2.5`, `np.var([1+2j,3+4j], ddof=1) = 4.0`, `np.var([1+0j,0+1j,-1+2j], ddof=1) = 2.0`. `origin/main`returns exactly those (2.5, 4, 2); head returns Complex`−1.5−2i`, `4i`, `−2i`. The PR therefore replaces a **correct** native result with an incorrect one, which the policy forbids for a critical library. |
| `functions/src/typed/arithmetic.ts` — `variance`/`std` rest signatures `f64` → `unknown` | **(b) type-surface change driven by N1**                                       | Follow-on of N1. It exists only so a Complex can be returned from the varargs form. Reverting N1 lets the annotations go back to `f64`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `functions/types/public-overloads.generated.d.ts` + `.manifest.json`                     | **(b) published-type narrowing**                                               | **Finding N2.** `(...rest): number` → `unknown` and `(a: ExactData<Complex \| bigint>): number` → `(a: ExactData<Complex>): Complex`. The **bigint** overload is lost: `const v: number = variance([1n, 2n, 3n])` typechecked on `origin/main` and fails on head (`Type 'unknown' is not assignable to type 'number'`). No native bug justifies that.                                                                                                                                                                                                                                                                                                                                                                                    |
| `functions/tests/typed-arrays-variadic-1046.test.ts`                                     | **(b) test weakened**                                                          | **Finding N3a.** The file's own comment reads _"No cast: the typecheck of this file fails when the public types reject these calls."_ The PR adds `as number` to three of the four pins, so the file stops proving the public types — exactly the failure the comment says must be caught.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `functions/tests/reductions-exact-public-types-1049.test.ts`                             | **(b) test weakened**                                                          | **Finding N3b.** `const vi: number = variance(I)` became `const vi = variance(I) as number`, which asserts nothing. The file loses its bigint-list number pin.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `tools/create-dependency-graph/duplicate-allowlist.json`                                 | review note                                                                    | Adds a match-all-names allowlist entry naming **three** files (`compat/src/shims.ts`, `functions/src/typed/arithmetic.ts`, `core/src/arithmetic/scalar.ts`). Removing it makes `check:duplicates` fail with 3 `TRUE_DUPLICATE` (`round`, `ceil`, `floor`). On `origin/main` these were `ALIAS_DELEGATION` / `DISPATCH_VARIANT`, i.e. the gate needed no entry; binding the shims to the factories is what creates the duplicate. The reason text ("a re-export adapter with no independent body") is accurate for `compat/src/shims.ts` but the entry also suppresses the two native definers. Acceptable, but it should be scoped to the compat file plus a `filesGlob` for the two native files only if the gate genuinely needs them. |
| `tools/test/bundle-budget.json`                                                          | review note                                                                    | Compat grew **+13,127 B** (444,732 vs 431,605). The ceiling was raised by 16,384 B (both the node and the browser bundle). The budget check passes (`ceilingFor` rounding). Not a violation, but the growth is 8% of the file for adapters — the largest single G-group growth so far.                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### Failing native tests (7 of 8)

One test in the suite passes on purpose: `the #1049 exact-type overloads survive (Fraction and
BigNumber stay exact)`, a control that proves the file's own type reader works.

```
× N1 variance(complex(1, 2), 2) is the real NumPy value 2.5
× N1 variance of a Complex list is a real, non-negative number
× N1 std of a Complex list is the real NumPy value
× N2 the varargs form of variance/std returns number, not unknown
× N2 a bigint ExactData overload returning number exists for variance and std
× N3a typed-arrays-variadic-1046 keeps its no-cast public-type pins
× N3b reductions-exact-public-types-1049 keeps its uncast number pin
```

---

## Part 2 — Compat findings (oracle = mathjs 15.3.0)

The full-surface harness passes (6/6) because the pool sweeps **one arity width per function**
(`Math.max(fn.length, 1)`) and never calls a zero-argument form, `subtract` with three values,
or `erf` with a BigNumber. The gaps below therefore sit outside what the harness can see.

### R1–R3 — REGRESSIONS the PR introduces (`mad`)

| #   | Case                                | Oracle                                                                                 | Base (before PR) | Head (this PR)                                                              |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| R1  | `mad()`                             | `TypeError: Too few arguments in function mad (expected: any, index: 0)`               | **same**         | `Error: Cannot calculate median absolute deviation (mad) of an empty array` |
| R2  | `mad(complex(1,2), complex(3,4))`   | `TypeError: Cannot calculate mad, no ordering relation is defined for complex numbers` | **same**         | `TypeError: Unexpected type of argument in function compare (...)`          |
| R3  | `mad([complex(1,2), complex(3,4)])` | same as R2                                                                             | **same**         | same as R2                                                                  |

All three reproduce on all five configs (`{}`, BigNumber, Fraction, `matrix:'Array'`,
`precision:8`). The new `createCompatMad` flattens to an empty list and throws its own error
before the arity check, and it routes the median through native `compare`, which rejects a
Complex with the wrong message instead of mathjs's ordering error. #1583 was correct on base;
this is a net loss. Severity: **P2** (error-type contract, no wrong value).

### R4 — the new `bignumber` arity guard reports the parse error first

`bignumber('zzz', 3)` → oracle `TypeError: Too many arguments in function bignumber (expected: 1, actual: 2)`; head `SyntaxError: BigNumber cannot parse 'zzz'`. On base the same string also threw `SyntaxError`, but only because the extra argument was silently ignored — the arity check is new here, and it is ordered the wrong way. mathjs's typed dispatch reports the arity only when the value itself is well typed: `bignumber(2, 3)` correctly gives the `TypeError` on head, while `bignumber('zzz', 3)` gives the parse error. The code comment states the opposite rule ("reports the argument-type error of the one-argument signature before the arity error", which would be `Unexpected type`, not a parse failure). Severity **P3**.

### C1–C8 — Pre-existing / newly-exposed gaps inside G02's own scope

These were also wrong on base, so they are not regressions; they are gaps the PR claims to close.

| #   | Case                                                                       | Oracle                                                                                    | Head                                                           | Severity                                                                             |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| C1  | `size()` / `inv()` / `det()` / `transpose()` with no argument              | `Too few arguments in function size (expected: …, index: 0)`                              | `Too many arguments in function size (expected: 1, actual: 0)` | P3 — wrong arity text; `withFixedArity` cannot distinguish 0 from 3                  |
| C2  | `subtract(10, 2, 3)`                                                       | `Too many arguments in function subtract (expected: 2, actual: 3)`                        | `5`                                                            | P3 — the compat fold still extends `subtract`; only `add`/`multiply` fold in mathjs  |
| C3  | `variance([])` / `std([])`                                                 | `SyntaxError: Function variance requires one or more parameters (0 provided)`             | `number NaN`                                                   | P3                                                                                   |
| C4  | `variance(matrix, 0)` / `variance(matrix, 1)`                              | `DenseMatrix [2, 2]`                                                                      | `Array [2, 2]`                                                 | P3 — `std` re-boxes its sliced result, `variance` does not                           |
| C5  | `sqrt(fraction(1,3))`, `cbrt(...)`, `expm1(...)`, `gamma(...)`, `erf(...)` | Fraction→BigNumber `TypeError`                                                            | computes a number/Complex                                      | P2 — the #1587 guard list omits these five; the PR's own name loop stops short       |
| C6  | `erf(bignumber(2))`, `erf(bignumber(0.5))`                                 | `TypeError: Unexpected type of argument in function name (… actual: BigNumber, index: 0)` | computes `0.995…`                                              | P2 — the guard binds only in the expression scope; #1587 names the **instance** call |
| C7  | `gamma(bignumber(0.5))`                                                    | `Error: Integer BigNumber expected`                                                       | `BigNumber 1.772…`                                             | P3                                                                                   |
| C8  | `min(complex, complex)` / `max(complex, complex)`                          | `TypeError: Cannot calculate min, no ordering relation is defined for complex numbers`    | `Unexpected type of argument in function min (...)`            | P3                                                                                   |
| C9  | `min(2n)` / `max(2n)`                                                      | `bigint 2`                                                                                | `Fraction 2/1`                                                 | P3 — a lone bigint is coerced to a Fraction                                          |
| C10 | `count(true, true)`                                                        | `Too many arguments in function count (expected: 1, actual: 2)`                           | `Unexpected type of argument ... (actual: boolean, index: 0)`  | P3                                                                                   |
| C11 | `sum('abc')` / `mad('abc')`                                                | `SyntaxError: String "abc" is not a valid number`                                         | `Error: Cannot convert "abc" to a number`                      | P3                                                                                   |

### C12 — new wrong result: `arg(bignumber)` ignores the instance precision

| Case                                   | Oracle      | Base                                 | Head                                                                                     |
| -------------------------------------- | ----------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| `arg(bignumber(-2))` at `precision: 8` | `3.1415927` | throws (`y.atan2 is not a function`) | `3.1415926535897932384626433832795028841971693993751058209749445923078164…` (100 digits) |
| same at default precision              | 63 digits   | throws                               | 100 digits                                                                               |

`createCompatArg` builds `new CompatBigNumber(BIGNUMBER_PI.toString())` from a module constant,
so the value never passes through `config.precision`. At `precision: 8` this is a **wrong
result**, not a formatting difference — `c.format(c.arg(c.bignumber(-2)))` prints the full
constant. Fix direction: build the constant with the instance's declared precision (or divide a
precision-scaled π) instead of a literal 100-digit string. Severity **P2**.

Note `multiply(arg(bn), 1)` _does_ round to 8 digits, so the raw `BigNumber` carries the wrong
value and only arithmetic masking repairs it.

### Not reproduced / verified-good

- `ceil`/`floor`/`fix`/`round` with Units, `(x, n)` on numbers, and the BigNumber path: all
  match the oracle (including the `RangeError` texts at `n = -1` and `n = 16`).
- `identity()` / `identity(m, n)` / `identity([m, n])` / `identity('2')` / `identity(true)` /
  `identity(0)` / `identity(2, 'sparse')`; `zeros`/`ones` under `matrix: 'Array'`,
  `'Matrix'`, `'sparse'`, and `zeros(0)`.
- `expm(Array)` → DenseMatrix, `expm(Matrix)` → DenseMatrix, `expm(SparseMatrix)` → SparseMatrix.
  (`expm([])` and `expm(2)` still differ, but so did base: `RangeError` text and the
  `matrixExpm`-vs-`expm` function name in the argument error.)
- `variance`/`std` of Complex under the varargs form (now `4i` / `1.41…+1.41…i`, matching the
  oracle — but see N1: matching the oracle here is the defect).
- `mad` of Units (`0.015748031496063 inch`), of matrices, of bigint lists, of BigNumber lists.
- `config()` isolation between instances (own precision, own config), and `count(true) === 4`,
  `count(false) === 5`.
- The `known-gaps` removals sampled (the `log(Fraction, n)`, `nthRoot(bigint, n)`,
  `expm([[0,2],[0,0]])` under `matrix:'Array'`, BigNumber-config `+"2"`, `+true`,
  `compare(...)`, `erf(...)` labels) all now match the oracle. No unjustified removal found.

---

## Failing tests

Run:

```bash
cd compat  && bunx vitest run tests/parity/challenger-g02-compat.test.ts        # 28 failed | 2 passed
cd functions && bunx vitest run tests/challenger-g02-native-findings.test.ts    # 7 failed | 1 passed
```

Names (compat, 28): `C1 mad()…`, `C1 mad of Complex values…`, `C1 mad of a Complex list…`,
`C2 size()/inv()/det()/transpose()…`, `C2 subtract(10, 2, 3)…`, `C3 variance([])`, `C3 std([])`,
`C3 variance(matrix, 0)`, `C3 variance(matrix, 1)`, `C4 sqrt/cbrt/expm1/gamma/erf(fraction)`,
`C5 erf(bignumber(2))`, `C5 erf(bignumber(0.5)) BigNumber`, `C5 gamma(bignumber(0.5))`,
`C6 arg(bignumber(-2)) precision 8`, `C7 min/max(complex)`, `C7 min(2n)`, `C7 max(2n)`,
`C8 count(true, true)`, `C9 sum("abc")`, `C9 mad("abc")`.

Names (native, 6): `N1 variance(complex(1, 2), 2) is the real NumPy value 2.5`,
`N1 variance of a Complex list is a real, non-negative number`,
`N1 std of a Complex list is the real NumPy value`,
`N2 the varargs form of variance/std returns number, not unknown`,
`N2 a bigint ExactData overload returning number exists for variance and std`,
`N3a typed-arrays-variadic-1046 keeps its no-cast public-type pins`,
`N3b reductions-exact-public-types-1049 keeps its uncast number pin`.

Two compat tests pass and are kept as controls: `C6 arg(bignumber) at the default precision`
(formats equal at precision 14) and `C8 identity(2, 3, 4)`. The native suite's control is
`the #1049 exact-type overloads survive`.

---

## Repo hygiene checked

- `bunx prettier --check` clean on every file in this branch and on the PR's changed files.
- `git config core.hooksPath` → `.husky/_` (the dispatcher in the agent hooks dir); hooks active,
  no `--no-verify` used.
- `check:duplicates` passes (0 TRUE_DUPLICATE) with the PR's allowlist entry; **fails with 3** if
  that entry is removed, so the entry is load-bearing, not cosmetic.
- `node tools/test/check-bundle-budget.mjs` passes after the ceiling refresh.
- Changelog: the PR uses `changelog-fragments/2026-11-26-g02-factory-binding.md` (no
  `CHANGELOG.md` edit) — correct format. It does not add a `.changeset/*.md` for the
  `compat`/`functions`/`core` bumps the fragment announces `BREAKING`.

---

# Round 2 — verification of the fix commits

Fix commits `<code>a00903b7</code>` (revert native variance + compat adapters) and
`a75a2f11` (bundle budget) were verified against this branch's tests and against the builder's own
suites, in a clean worktree at `origin/cursor/g02-bind-factories-d797` after `bun run build`.

## Resolved

- **N1/N2/N3 (native).** `git diff origin/main..origin/cursor/g02-bind-factories-d797` is now
  **empty** for `functions/src/statistics/variance.ts`, `functions/src/typed/arithmetic.ts`,
  both `public-overloads` files, and both edited native tests. The critical-library diff versus
  `main` is only the two `core/` rounding fixes, which this review classifies as genuine bug fixes
  (a). Native variance of Complex data is again the NumPy value (`2.5`, `2`, `4`).
- **Round-1 compat findings.** All 28 cases pass, including R1–R3 (`mad()` and `mad` of Complex),
  C4–C5 (`sqrt`/`cbrt`/`expm1`/`gamma`/`erf` Fraction rejection), C6 (instance-level
  `erf`/`gamma` BigNumber), C12 (`arg` precision), and C1/C2/C3 arity and empty-input texts.
- My two test files are **byte-identical** to what landed on the builder branch (no test was
  weakened to make them pass).

## New failures introduced by the fix commits (builder suite is red)

All five reproduce on the fixed head and pass on the pre-fix head `9318eb1b`, so they are
regressions from `a00903b7`, not pre-existing gaps.

### 1. `compat/tests/shims.test.ts` → `subtract folds left-to-right over all arguments`

`subtract(10, 2, 3)` now throws `TypeError: Too many arguments in function subtract (expected: 2,
actual: 3)`. That is what mathjs 15.3.0 does, but this is a **pre-existing compat test** that pins
the compat fold, and the fix commit changed compat behavior without updating it. Either the test is
updated with a citation (the round-1 finding C2 asked for exactly this behavior) or the guard is
dropped. Leaving both is a red suite.

### 2. `compat/tests/dogfood-1337-compat-empty-shape.test.ts` → `0 x 0 and 2 x 2 operands, as inv and sqrtm`

`m.subtract(dense, dense)` no longer returns a native `DenseMatrix`; it returns the bridge
`MathJSDenseMatrix`. Reproduced for a 2×2 as well:
`subtract(A, A) instanceof DenseMatrix === false`, while `divide` is `true`. Cause: the new
`subtract = withTypedSurface(function (a, b) { … return subtractPair(a, b) }, _subtract)` calls
`subtractPair` directly and bypasses the `_matSubtract` matrix branch and the `withTypedSurface`
result boxing that `makeArithmetic('subtract', …)` used to apply. This is an internal-consistency
regression independent of mathjs.

### 3. `compat/tests/std-variance.test.ts` → `honours the dimension argument`

`expect(varianceOf(math.matrix(m), 0)).toEqual([2, 4.5])` receives a `MathJSDenseMatrix` and fails
`toEqual` against a plain array. `reboxMatrixStatistics` now boxes the sliced result, which matches
mathjs (`DenseMatrix [2, 2]`) — the round-1 finding C4 asked for it — but the existing compat test
pins the array shape. Same category as (1): behavior change without a test update.

### 4. `compat/tests/parity/full-surface.test.ts` → `every instance function matches the oracle over the argument pool` — **248 unrecorded labels**

The harness fails with 248 pool divergences that are not in `known-gaps/`:

| function   | labels | cause                                                                                                                                                                                                                                                                         |
| ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `count`    | 184    | `withFixedArity('count', 1, withCountBoolean(...))` reports `Too many arguments` before the type check. mathjs reports `Unexpected type of argument in function count (… actual: number, index: 0)` for `count(0, 0)`, `count(1, 2)`, … All 184 two-number pairs now diverge. |
| `sum`      | 16     | `withInvalidNumericStringGuard` throws `SyntaxError: String "abc" is not a valid number` for **every** string argument, but mathjs only does that for the unary form; `sum('abc', 0)` is `Error: Cannot convert "abc" to a number`.                                           |
| `variance` | 16     | same guard, same wrong scope: `variance('abc', 0)`                                                                                                                                                                                                                            |
| `std`      | 16     | same guard                                                                                                                                                                                                                                                                    |
| `mad`      | 16     | same guard (`mad('abc', 0)`)                                                                                                                                                                                                                                                  |

The guard should apply only when the string is the **sole** argument (the shape mathjs's unary
signature rejects); with a second argument mathjs takes the variadic path and gives the conversion
`Error`. And `count` should check the argument **type** before the arity.

### 5. `compat/tests/parity/full-surface.test.ts` → `every embedded-docs example matches the oracle` — one **stale** gap

`{"number":"BigNumber"} gamma(1/2)` is listed in `known-gaps/` but now matches the oracle, because
`createCompatGammaBigNumberGuard` was added. A gap that no longer diverges fails the harness by
design (`stale` assertion), so the label must be deleted in the same commit.

## Net

The round-1 findings are genuinely fixed, and the native critical libraries are clean. But the fix
commits leave `compat` with **4 failing test files / 5 failing tests** and **249 harness labels**
(248 unrecorded + 1 stale). The builder's "all green locally" claim did not hold in a clean worktree
build of `a75a2f11`.

Failing on `a75a2f11`:

```
compat/tests/shims.test.ts                                     > subtract folds left-to-right over all arguments
compat/tests/std-variance.test.ts                              > honours the dimension argument (1.707825127659933 before)
compat/tests/dogfood-1337-compat-empty-shape.test.ts           > 0 x 0 and 2 x 2 operands, as inv and sqrtm
compat/tests/parity/full-surface.test.ts                       > every embedded-docs example matches the oracle or a recorded gap
compat/tests/parity/full-surface.test.ts                       > every instance function matches the oracle over the argument pool or a recorded gap
```

`functions` (718 files / 14,076 tests) and the two challenger suites are green on `a75a2f11`.

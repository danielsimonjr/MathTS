# Proposal: Function & Auxiliary-Function Gaps

**Author:** MathTS maintenance
**Date:** 2026-05-24 · **Refreshed:** 2026-06-29 (see [§7 — Deep re-analysis](#7-deep-re-analysis-2026-06-29--new-gaps-post-wave-6))
**Status:** Original three slices ✅ landed (commit `1bfad1e`); §7 tracks a fresh batch of gaps surfaced by the 2026-06-29 re-analysis.
**Target packages:** `@danielsimonjr/mathts-autograd`, `@danielsimonjr/mathts-functions`, `@danielsimonjr/mathts-tensor`
**Companion analysis:** Based on the 2026-05-24 dep-graph audit of `docs/Architecture/`. Three categories of gaps were identified — promotion gaps, acceleration gaps, cross-cutting infrastructure gaps. This proposal scopes the three highest-leverage adds from that audit.

> **Note (2026-06-29):** Sections 0–6 below are the **original proposal**, now fully landed. The companion [`FUNCTION_GAPS_AUDIT.md`](./FUNCTION_GAPS_AUDIT.md) declared "no open gaps" as of Wave 6. A fresh four-dimension re-analysis on 2026-06-29 — type-dispatch breadth, mathjs canonical-name parity, expression/workbook parity, and external-oracle correctness coverage — found that while MathTS is functionally **complete** (no missing functions, full parser parity), it has real **dispatch-breadth, external-grounding, and cosmetic** gaps. Those are catalogued in **[§7](#7-deep-re-analysis-2026-06-29--new-gaps-post-wave-6)**.

---

## 0. TL;DR

The dep-graph audit found three classes of gap (full categorisation in the audit note):

| Class                           | What it is                                                                | Worst category                                        |
| ------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| A. Promotion gaps               | Synced mathjs categories with no `typed/<cat>.ts` wrapper                 | `set`, `relational`, `complex`                        |
| B. Acceleration gaps            | typed/ files running pure-JS that could route through ComputePool or WASM | `algebra`, `integration`, `hypothesis`                |
| C. Cross-cutting infrastructure | Decompositions / AD coverage / slicing primitives missing                 | `TapedTensor` reductions, `Tensor.qr/lu/cholesky/eig` |

This proposal scopes **three** concrete landings — one from each class — that maximise downstream value (especially for UPT v0.7's `differentiableEvaluator`) and stay clean against the existing architecture. The four landings, in priority order:

| Slice | Surface                                                                                  |           Effort | Value                                                                                               |
| ----- | ---------------------------------------------------------------------------------------- | ---------------: | --------------------------------------------------------------------------------------------------- |
| 1     | `TapedTensor` reductions + elementwise math AD                                           | ~250 LOC + tests | **Highest leverage** — closes the AD loop for any loss function. Direct unblock for UPT Proposal 8. |
| 2     | `typed/complex.ts` + `typed/set.ts` promotion                                            | ~100 LOC + tests | 14 leaf functions users will hit immediately (`arg`, `conj`, `im`, `re`, set ops).                  |
| 3     | Tensor decomposition wrappers (`tensorQr` / `tensorLU` / `tensorCholesky` / `tensorEig`) | ~300 LOC + tests | Rounds out the ITensor-parity decomposition story; uses the same pattern as `tensorSvd`.            |

---

## 1. Slice 1 — `TapedTensor` reductions + elementwise math

UPT Proposal 8 needs AD over arbitrary bridge equations. `TapedTensor` today exposes `add / sub / mul / scale / contract / matmul` — fine for linear combinations but missing reductions (which any loss function needs: `sum`, `mean`, `norm`) and elementwise transcendentals (which any nonlinear bridge needs: `log`, `exp`, `sin`, `cos`).

### 1.1 New methods on `autograd/src/tape.ts`

```ts
class TapedTensor {
  // Reductions
  sum(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor;
  mean(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor;
  prod(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor;
  max(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor;
  min(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): TapedTensor;
  norm(opts?: { p?: 1 | 2 | 'fro' | 'inf'; axis?: number; keepDims?: boolean }): TapedTensor;

  // Elementwise transcendentals
  log(): TapedTensor;
  exp(): TapedTensor;
  sin(): TapedTensor;
  cos(): TapedTensor;
  tan(): TapedTensor;
  sqrt(): TapedTensor;
  square(): TapedTensor;
  pow(k: number): TapedTensor; // fixed integer/real exponent; variable exponent is a future slice
  reciprocal(): TapedTensor; // 1 / x
  abs(): TapedTensor; // dY · sign(x); non-differentiable at 0, subgradient = 0
}
```

### 1.2 Adjoints

For each method, the closure captures the forward primal where needed:

| Method          | Adjoint                                                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sum(axis)`     | `dY` broadcast back to input shape (each input element gets `dY[reduce(idx)]`).                                                                                                                                                                                    |
| `mean(axis)`    | `dY / N` broadcast back, where `N` is the product of reduced-axis dimensions.                                                                                                                                                                                      |
| `prod(axis)`    | `dY · (prod_over_axes(x) / x_i)` per element. Document the `x_i = 0` corner: when exactly one input is zero, derivative w.r.t. that input is the product of the others; w.r.t. all others, derivative is 0. When two or more are zero, derivative is 0 everywhere. |
| `max(axis)`     | `dY` scattered to argmax position(s). Ties get a uniform split (or first-wins, choose one; document).                                                                                                                                                              |
| `min(axis)`     | `dY` scattered to argmin position(s).                                                                                                                                                                                                                              |
| `norm(p=2)`     | `dY · x / ‖x‖`                                                                                                                                                                                                                                                     |
| `norm(p=1)`     | `dY · sign(x)` (subgradient = 0 at exact zero).                                                                                                                                                                                                                    |
| `norm(p='inf')` | `dY · sign(x) · 1{abs(x_i) = max(abs(x))}` (scattered to max-abs index; ties first-wins).                                                                                                                                                                          |
| `norm(p='fro')` | Same as p=2 (Frobenius is the 2-norm of the flattened tensor).                                                                                                                                                                                                     |
| `log(x)`        | `dY / x`                                                                                                                                                                                                                                                           |
| `exp(x)`        | `dY · y` where `y = exp(x)` (cache the primal)                                                                                                                                                                                                                     |
| `sin(x)`        | `dY · cos(x)`                                                                                                                                                                                                                                                      |
| `cos(x)`        | `−dY · sin(x)`                                                                                                                                                                                                                                                     |
| `tan(x)`        | `dY · sec²(x) = dY / cos²(x)`                                                                                                                                                                                                                                      |
| `sqrt(x)`       | `dY / (2y)` where `y = sqrt(x)`                                                                                                                                                                                                                                    |
| `square(x)`     | `dY · 2x`                                                                                                                                                                                                                                                          |
| `pow(x, k)`     | `dY · k · x^(k−1)`                                                                                                                                                                                                                                                 |
| `reciprocal(x)` | `−dY / x²`                                                                                                                                                                                                                                                         |
| `abs(x)`        | `dY · sign(x)`; subgradient = 0 at exact zero                                                                                                                                                                                                                      |

### 1.3 Tests

`autograd/tests/tape-reductions-ad.test.ts` (NEW) and `autograd/tests/tape-elementwise-ad.test.ts` (NEW). Each method gets:

- A forward-correctness test against `Tensor`'s direct method.
- A gradient-check test against finite-difference (`(f(x+ε) − f(x−ε)) / 2ε` with ε ≈ 1e-6) to tolerance `1e-7`.
- A closed-form analytical gradient test where the math is exact (e.g. `square` → `dA = 2·a`).
- A composition test showing the new ops compose with `add / mul / contract / matmul`.

Minimum 30 tests across the two files.

### 1.4 Out of scope for Slice 1

- AD over `Tensor.tensordot` (depends on its index pairing — a future slice).
- AD over `Tensor.svd` / `eig` (decomposition adjoints have edge cases in the repeated-eigenvalue / singular-value case; bounded but its own slice).
- `TapedTensor.divide` (the dual of `mul`, easy but waits for the next slice).
- Variable-exponent `pow(x, y)` where `y` is also a `TapedTensor`.

---

## 2. Slice 2 — promote `complex` + `set` categories

### 2.1 `functions/src/typed/complex.ts` (NEW)

Mirror the pattern of `typed/bitwise.ts` / `typed/logical.ts`. Promote the four synced complex helpers:

```ts
export const arg = mathTyped('arg', {
  /* number | bigint | BigNumber | Complex */
});
export const conj = mathTyped('conj', {
  /* same */
});
export const im = mathTyped('im', {
  /* same */
});
export const re = mathTyped('re', {
  /* same */
});
export const typedComplex = { arg, conj, im, re };
```

Type semantics:

- `arg(number)` → `atan2(0, number)` (i.e. 0 for positive, π for negative, NaN for NaN).
- `arg(Complex)` → existing `Complex.arg()` method.
- `arg(BigNumber)` → 0 / π / NaN equivalents via BigNumber.
- `conj(real)` → identity (real numbers are self-conjugate).
- `conj(Complex)` → existing `Complex.conjugate()`.
- `im(real)` → 0.
- `re(real)` → the number itself.

### 2.2 `functions/src/typed/set.ts` (NEW)

Promote the ten synced set helpers. Set operations are conceptually flat-array-based and order-preserving in mathjs convention.

```ts
export const setUnion        = mathTyped('setUnion',        { 'Array, Array': /* deduped union */ });
export const setIntersect    = mathTyped('setIntersect',    { ... });
export const setDifference   = mathTyped('setDifference',   { ... });
export const setSymDifference = mathTyped('setSymDifference', { ... });
export const setIsSubset     = mathTyped('setIsSubset',     { 'Array, Array': /* boolean */ });
export const setMultiplicity = mathTyped('setMultiplicity', { ... });
export const setPowerset     = mathTyped('setPowerset',     { ... });
export const setDistinct     = mathTyped('setDistinct',     { ... });
export const setSize         = mathTyped('setSize',         { ... });
export const setCartesian    = mathTyped('setCartesian',    { ... });
export const typedSet = { setUnion, setIntersect, /* ... */ };
```

Set operations on Matrix: also support `Matrix`/`DenseMatrix` inputs (treat as flat-array).

### 2.3 Wiring + collision handling

Same as the bitwise+logical landing in 2a141d4: any of the 14 names (4 complex + 10 set) that already appear as `export const X = createX(factoryScope as any);` in `functions/src/factories/index.ts` need their `export` keyword stripped (factoryScope wiring stays). Tests in `functions/tests/{factories-leaf,factories-tier4}.test.ts` that import them from `factories/index.js` repoint to the typed/ versions.

### 2.4 Tests

`functions/tests/typed-complex.test.ts` (NEW, ≥ 15 tests) and `functions/tests/typed-set.test.ts` (NEW, ≥ 20 tests). Cover:

- Each function on each supported type signature.
- Edge cases: empty input, single-element input, duplicates handling, NaN propagation in `arg`/`conj`.
- Composition with the broader API (e.g. `arg(multiply(a, b))` works).

---

## 3. Slice 3 — Tensor decomposition wrappers

Mirror the `tensorSvd` pattern landed in commit `a21a844` for QR, LU, Cholesky, and Eigendecomposition. Each delegates to the matrix-package primitive when one exists; falls back to a clean local implementation otherwise.

### 3.1 `tensor/src/operations/qr.ts` (NEW)

```ts
export interface TensorQrOpts {
  mode?: 'reduced' | 'full'; // default 'reduced' (thin QR)
}

export interface TensorQrResult {
  Q: Tensor; // orthonormal, shape […rowDims, k] in reduced mode
  R: Tensor; // upper triangular, shape [k, …colDims]
}

export function tensorQr(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorQrOpts
): TensorQrResult;
```

The Phase-3 `randomTensor` agent already inlined a Gram-Schmidt-with-re-orthogonalisation QR. This slice promotes that to a proper `matrix/src/operations/qr.ts` primitive (so the inline version in `random.ts` can call it instead of duplicating the algorithm).

### 3.2 `tensor/src/operations/lu.ts` (NEW)

```ts
export interface TensorLUResult {
  L: Tensor; // unit lower-triangular
  U: Tensor; // upper-triangular
  P: Int32Array; // permutation as a length-n permutation array
  parity: 1 | -1; // sign of the permutation, useful for det()
}

export function tensorLU(t: Tensor, rowAxes: ReadonlyArray<number>): TensorLUResult;
```

Delegates to the existing `matrix/src/operations/lu.ts` (or its WASM equivalent). Requires the matrix-reshaped-to-2D input to be square. Throws otherwise.

### 3.3 `tensor/src/operations/cholesky.ts` (NEW)

```ts
export function tensorCholesky(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: { lower?: boolean } // default lower = true (return L such that A = L Lᵀ)
): { L: Tensor };
```

Delegates to either matrix's Cholesky or the AS WASM `matrix_cholesky` export landed in commit `b96b53a`. Requires the reshaped 2-D input to be symmetric positive-definite; throws "matrix is not positive definite" otherwise.

### 3.4 `tensor/src/operations/eig.ts` (NEW)

```ts
export interface TensorEigOpts {
  symmetric?: boolean; // hint; if true, uses the symmetric-eig fast path
  computeVectors?: boolean; // default true; when false, only eigenvalues are returned
}

export interface TensorEigResult {
  eigenvalues: Tensor; // 1-D, length n
  eigenvectors?: Tensor; // rank-2, shape [n, n] — columns are the eigenvectors; only present when computeVectors=true
}

export function tensorEig(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: TensorEigOpts
): TensorEigResult;
```

Routing:

- `symmetric: true` → matrix-package's symmetric eigendecomposition (real eigenvalues, orthogonal eigenvectors).
- `symmetric: false` (default) → matrix-package's general eigensolver. May return complex eigenvalues; document the convention (Float64Array for real path; if any eigenvalue is complex, return both `eigenvalues` real and an additional `eigenvaluesImaginary` Tensor).

### 3.5 Tests

`tensor/tests/operations/qr.test.ts` (NEW, ≥ 8 tests), `tensor/tests/operations/lu.test.ts` (NEW, ≥ 8 tests), `tensor/tests/operations/cholesky.test.ts` (NEW, ≥ 6 tests), `tensor/tests/operations/eig.test.ts` (NEW, ≥ 8 tests). Cover:

- Reconstruction (Q·R ≈ A, L·U ≈ P·A, L·Lᵀ ≈ A, V·diag(λ)·V⁻¹ ≈ A) to `1e-9`.
- Rectangular inputs for QR (rows > cols and rows < cols).
- Non-SPD failure for Cholesky throws.
- Non-square failure for LU/Cholesky/Eig throws with a clear message.
- Symmetric vs general eig produce matching real-eigenvalue sets on the same symmetric input.
- Output Tensors carry `axisLabels` correctly when input did (drop the row-axes' labels, insert a fresh "joining" Index between the two factors per the `tensorSvd` convention).

---

## 4. Non-goals (explicit)

- **TapedTensor.divide / sub** — easy follow-up after Slice 1 lands. Not in this proposal.
- **TapedTensor.tensordot / svd / eig** — adjoint complexity merits a dedicated slice.
- **`typed/probability.ts` / `typed/relational.ts` / `typed/unit.ts` / `typed/string.ts`** — promotion gap items (per the audit), held for a follow-up after the higher-leverage Slice 1+2 ship. These are mostly leaf functions and not blockers for UPT.
- **Acceleration of `algebra` / `integration` / `hypothesis`** (Slice B from the audit) — held for a separate slice; needs benchmark data to justify each routing decision.
- **Sparse-tensor decompositions** — out of scope; sparse-tensor is itself out of scope per the ITensor-parity proposal §8.

---

## 5. Sequencing + risk

- Slice 1 (autograd) modifies `autograd/src/tape.ts` only. Disjoint from Slices 2 + 3.
- Slice 2 (typed-layer promotion) modifies `functions/src/typed/index.ts` and `functions/src/factories/index.ts`. The factory-collision pattern is the same as the bitwise+logical landing (drop `export` from the synced factory entries that shadow the new typed names; keep factoryScope wiring; repoint factory-tier tests).
- Slice 3 (tensor decompositions) writes four new files under `tensor/src/operations/` and modifies `tensor/src/index.ts` to re-export. Disjoint from Slices 1 + 2.

The three slices can be dispatched concurrently. Central wiring of any new exports through `tensor/src/index.ts` and `functions/src/typed/index.ts` happens after all three return.

---

## 6. Acceptance criteria

Every slice:

- 12/12 packages build, 19/19 turbo test tasks green.
- Per-package `tsc --noEmit` clean.
- Per-package `eslint` 0 errors.
- The new tests pass at the stated tolerances.
- No regression in existing tests.

Specific acceptance:

- Slice 1: gradient-check against finite-difference within `1e-7` for every new method.
- Slice 2: every promoted function callable via `import { arg, conj, …, setUnion, … } from '@danielsimonjr/mathts-functions'`. The factory-collision rewrite leaves no `TS2308` ambiguous re-export errors.
- Slice 3: every decomposition reconstructs the input to `1e-9`. Symmetric-eig fast-path takes a measurably different code path than the general-eig path (same numerical result, different internal routine).

---

## 7. Deep re-analysis (2026-06-29) — new gaps post-Wave-6

**Method.** Four parallel evidence-gathering passes over the current `main` (HEAD `dd23b25`), each on an independent dimension, with every concrete claim backed by a `file:line` citation and spot-verified against the **built** packages (`functions/dist`, `matrix/dist`). mathjs is not installed, so mathjs-side claims are marked `[confident]` / `[verify-upstream]`.

1. **Type-dispatch breadth** — which `functions/src/typed/*.ts` functions are narrower than their mathjs equivalents.
2. **mathjs canonical-name parity** — mathjs functions with no MathTS export under the mathjs spelling.
3. **Expression / parser / workbook parity** — language features, AST nodes, serialization, sandbox.
4. **External-oracle correctness coverage** — numeric surfaces the [2026-06-29 math-correctness audit](../../MATH_CORRECTNESS_AUDIT_2026-06-29.md) did *not* ground against mpmath/scipy/numpy.

**Headline.** MathTS is functionally **complete** — *zero* missing functions (name-level mathjs parity is total) and *full* expression-parser parity (all 15 node types, all language features, 4 serialization formats, sandbox invariant intact). The library is **wide but unevenly deep**: the real gaps are one layer down — **dispatch breadth** (types not wired into operators), **external grounding** (whole categories tested only against their own implementation), and **cosmetic** (factory-only aliases, two stale doc lines). None block any documented use case; they are parity-ratchet and trust-hardening work.

### G1 — Type-dispatch breadth gaps (class A, `functions/src/typed/`)

The four core binary ops (`add`/`subtract`/`multiply`/`divide`) carry 5 numeric types + mixed coercion (`arithmetic.ts:51-191`), but three systematic holes remain. **Caveat checked:** these were verified against the *built* package (so the activated `factories/` layer is included) — e.g. `smaller(unit, unit)` throws *"expected: number or bigint or Fraction…"* (no `Unit` in the dispatch table), confirming the gap is real and not masked by factories.

| # | Gap | Evidence | mathjs |
| - | --- | -------- | ------ |
| G1a | **No `Unit` in arithmetic/comparison operators.** `add`/`subtract`/`multiply`/`divide` and `smaller`/`larger`/`equal`/`compare` reject `Unit`. `unit.ts` provides only `to`/`toBest`. | `add(5cm,2cm)` and `smaller(5cm,2cm)` throw on built pkg; `arithmetic.ts:51,798-854` | Unit arithmetic + comparison (`5 cm + 3 mm`, `5 cm > 40 mm`) is a flagship feature `[confident]` |
| G1b | **Comparison operators are number/bigint/Fraction/BigNumber-only** — no `Complex` (for `equal`), no `Unit`, no `Array`/`Matrix` broadcasting. (The richer `equalScalar` in `relational.ts:144` is a separate, unwired function.) | `arithmetic.ts:798-854` | mathjs `compare`/`equal` accept Unit, Array/Matrix, mixed numeric `[confident]` |
| G1c | **Entire `statistics.ts` is number/Float64Array/Array-only** (~18 reductions: `sum`/`mean`/`std`/`variance`/`median`/`prod`/`quantile`…). | `statistics.ts:185-217` | mathjs `sum`/`mean`/`prod`/`std`/`median` accept BigNumber/Fraction; sum/mean/prod accept Complex `[confident]` — but MathTS's parallel-first Float64Array design is a deliberate trade-off |
| G1d | **`round`/`floor`/`ceil`/`fix` lack `Complex` + `Unit`; `sign` lacks `Complex`; `atan2`/`gcd`/`lcm`/`log1p`/`expm1` are narrower** than mathjs. | `arithmetic.ts:526-605,273-289,624-661,482-517`; `trigonometry.ts:228` | `[confident]` |
| G1e | **Internal inconsistency:** `acsc`/`asec`/`acot` accept `number`+`Complex` but **not** `BigNumber`, while the forward `csc`/`sec`/`cot` *do* have a BigNumber path. | `trigonometry.ts:235-254` | cheap to close; pure consistency fix |

~30–40 typed functions are narrower than their mathjs counterparts (≈18 in statistics, ≈12 in the comparison/round/gcd cluster, the rest in trig). **Correctly number-only (no action):** nearly all of `special.ts` (Bessel/Airy/elliptic/Carlson/Fresnel — mathjs has no equivalent, so number+Float64Array is already a *superset*), the number-theory adds in `combinatorics.ts`, and `bitwise.ts` (already matches mathjs).

### G2 — mathjs canonical-name aliases (class A, cosmetic)

Name-level API parity is otherwise **total** (≈210 canonical mathjs functions checked against the combined 869-name export set of `functions`+`matrix`+`expression`; zero functionally absent). Six canonical names are only reachable under a `factory_`-prefixed or renamed export — a mathjs user calling `math.<name>` would not find them. Verified on built pkg (`cumsum`/`ctranspose`/`index`/`apply` all `undefined` bare; `factory_cumsum` present):

| mathjs name | MathTS export today |
| ----------- | ------------------- |
| `cumsum` | `factory_cumsum` only |
| `ctranspose` | `factory_ctranspose` only |
| `createUnit` | `factory_createUnit` only |
| `apply` | `mapSlices` |
| `index` | `indexFn` |
| `help` | `createHelpClass` |

**Fix:** add 6 bare-name re-export aliases → 100% canonical-name coverage. ~10 LOC + a parity test.

### G3 — External-oracle correctness coverage (extends the 2026-06-29 audit)

The [math-correctness audit](../../MATH_CORRECTNESS_AUDIT_2026-06-29.md) externally grounded **41 functions, real arguments only**. The surfaces below currently rest on **self-referential** tests (assertions derived from the same constants/helpers they verify — a shared misunderstanding passes both sides). Ranked by risk:

| # | Surface | Why it's a gap | Evidence | Scope |
| - | ------- | -------------- | -------- | ----- |
| **G3a** | **Probability distribution CDF/quantile vs `scipy.stats`** — *highest risk.* 10 dists in `distributions.ts` + 12 in `dist-objects.ts`; tests check only sum-to-1, monotonicity, and `cdf(quantile(p))≈p`. The incomplete-beta/gamma helpers are re-implemented **inline in the tests**, so a tail error passes both sides. | `distributions.ts:187-694`, `dist-objects.ts:322-1034`; `typed-distributions-wasm.test.ts:31-50` | ~2–3d; extend `tools/math-correctness-audit/` with one `reg(...)` per CDF/ppf |
| **G3b** | **Complex-valued `zeta`/`gamma`/`lgamma`** — the audit used real args only; these 3 have a `Complex` branch and `zeta`'s source self-documents only **~6-digit** complex accuracy, entirely unverified. | `special/zeta.ts:136,167`; `probability/gamma.ts:51,86`; `probability/lgamma.ts` | ~1d; mpmath complex oracle |
| **G3c** | **Decomposition *factors* vs LAPACK/scipy** — QR/LU/Cholesky tests check reconstruction + structure only; expm/logm/sqrtm/pinv check round-trip/axioms only. Wrong-but-self-consistent factors (sign/pivot conventions) would pass. The audit checked `det`/`norm`/`singularValues`/`eigvals` *values*, no factor matrices. | `matrix/tests/operations/{qr,lu,cholesky,expm,logm,sqrtm,pinv}.test.ts` | ~2d; pin a few scipy reference factors with fixed sign/pivot normalization |
| **G3d** | **CAS / symbolic vs sympy** — `cas.ts` 28 ops (derivative/integrate/simplify/limit/solve/laplace/groebner); tests are 100% author-expected string matches, zero symbolic oracle. | `cas.ts:157-1324`; `cas.test.ts:52,209` | ~2–3d; sympy `simplify(a-b)==0` harness |
| **G3e** | **Units numeric kernel external table** — conversion constants are standards-sourced but no test pins them to an external NIST/CODATA table; every assertion is `1/0.3048`-style self-derivation. A 10%-wrong factor would still pass. | `core/src/types/unit-definitions.ts:102,115,133,154`; `unit.test.ts:215-246` | ~1d; hard-code ~25 reference conversions + 3 temp anchors |

### G4 — Residual infrastructure (class C)

| # | Item | Status | Evidence |
| - | ---- | ------ | -------- |
| **G4a** | **`TapedTensor.pow(taped, taped)`** — variable-exponent AD (both inputs on tape). Only `pow(k: number)` exists. | **OPEN** (the one genuinely-open infra item) | `autograd/src/tape.ts:1057-1077` (docstring at `:1060` defers it) — ~30–40 LOC; adjoints `dA = dY·b·A^(b−1)`, `dB = dY·A^b·ln(A)` with an `A>0` / NaN policy |
| **G4b** | **`ComputePool.tensordot`** — the audit doc marks this "⏳ pending" but it is **fully implemented** (worker dispatch via `tensordotChunk`, threshold 8 192). Stale-doc only. | **CLOSED** | `parallel/src/ComputePool.ts:1061-1171,179`; audit-doc row fixed in this pass |
| **G4c** | **Dead `matrix/src/matrix.ts`** — abstract `Matrix` base with four `throw new Error('… not yet implemented')` statics; **not exported, not imported anywhere** (`index.ts` re-exports only `parallel-matrix.js`). | cleanup | removed in this pass (verified zero importers repo-wide) |

### G5 — Workbook deferred capabilities (presentation/IO, already tracked)

Not language gaps — the expression core is at full parity. Tracked at `TODO.md` (Scientific Workbook section): Electron GUI, `--expect-hash` optimistic lock, multi-doc serve, mid-run event streaming, PDF/markdown/ipynb export, SVG math typesetting, interactive JS charts, and a **hard run timeout** (the workbook sandbox exec is currently synchronous). One stale-doc defect found and fixed in this pass: `CLAUDE.md` claimed `serializeWorkbook` was "still deferred" — it shipped in `9d978f5` (`workbook/src/parser.ts:240`) and is used in 7 CLI sites.

### Sequencing (ranked by leverage / risk)

| Rank | Item | Class | Effort | Why |
| ---- | ---- | ----- | ------ | --- |
| 1 | **G3a** — distribution CDF/quantile vs scipy.stats | correctness | ~2–3d | Largest untested numeric surface; shared inline incomplete-beta/gamma is a classic shared-misunderstanding trap |
| 2 | **G1a** — `Unit` in arithmetic/comparison operators | dispatch | ~2–3d | Highest user-visible parity gap; flagship mathjs feature entirely absent from the operator layer |
| 3 | **G3b** — complex `zeta`/`gamma`/`lgamma` oracle | correctness | ~1d | `zeta` self-documents ~6-digit complex accuracy, unverified |
| 4 | **G2** — 6 canonical-name aliases | cosmetic | ~10 LOC | Cheap; closes 100% name parity |
| 5 | **G4a** — `TapedTensor.pow(taped, taped)` | infra | ~30–40 LOC | Only genuinely-open infra item; well-specified |
| 6 | **G1e** — `acsc`/`asec`/`acot` BigNumber | consistency | trivial | Closes an internal inconsistency at near-zero cost |
| 7 | **G3c / G3d / G3e** — decomposition-factor / CAS-sympy / units external-table oracles | correctness | ~2d / ~2–3d / ~1d | Trust-hardening; lower risk (constants standards-sourced, CAS output simple) |
| 8 | **G1c / G1d** — broaden statistics / round / gcd type signatures | dispatch | variable | Parity ratchet; statistics breadth is partly a deliberate Float64Array trade-off |

**What is explicitly NOT a gap** (verified this pass): every canonical mathjs *function* (name-level), the full expression language + all 15 AST node types + 4 serialization formats, the expression security sandbox, and the special-functions file's number-only typing (it's a superset of mathjs there).

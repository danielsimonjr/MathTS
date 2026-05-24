# Proposal: Function & Auxiliary-Function Gaps

**Author:** MathTS maintenance
**Date:** 2026-05-24
**Status:** Proposed
**Target packages:** `@danielsimonjr/mathts-autograd`, `@danielsimonjr/mathts-functions`, `@danielsimonjr/mathts-tensor`
**Companion analysis:** Based on the 2026-05-24 dep-graph audit of `docs/Architecture/`. Three categories of gaps were identified — promotion gaps, acceleration gaps, cross-cutting infrastructure gaps. This proposal scopes the three highest-leverage adds from that audit.

---

## 0. TL;DR

The dep-graph audit found three classes of gap (full categorisation in the audit note):

| Class | What it is | Worst category |
|---|---|---|
| A. Promotion gaps | Synced mathjs categories with no `typed/<cat>.ts` wrapper | `set`, `relational`, `complex` |
| B. Acceleration gaps | typed/ files running pure-JS that could route through ComputePool or WASM | `algebra`, `integration`, `hypothesis` |
| C. Cross-cutting infrastructure | Decompositions / AD coverage / slicing primitives missing | `TapedTensor` reductions, `Tensor.qr/lu/cholesky/eig` |

This proposal scopes **three** concrete landings — one from each class — that maximise downstream value (especially for UPT v0.7's `differentiableEvaluator`) and stay clean against the existing architecture. The four landings, in priority order:

| Slice | Surface | Effort | Value |
|---|---|---:|---|
| 1 | `TapedTensor` reductions + elementwise math AD | ~250 LOC + tests | **Highest leverage** — closes the AD loop for any loss function. Direct unblock for UPT Proposal 8. |
| 2 | `typed/complex.ts` + `typed/set.ts` promotion | ~100 LOC + tests | 14 leaf functions users will hit immediately (`arg`, `conj`, `im`, `re`, set ops). |
| 3 | Tensor decomposition wrappers (`tensorQr` / `tensorLU` / `tensorCholesky` / `tensorEig`) | ~300 LOC + tests | Rounds out the ITensor-parity decomposition story; uses the same pattern as `tensorSvd`. |

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
  pow(k: number): TapedTensor;   // fixed integer/real exponent; variable exponent is a future slice
  reciprocal(): TapedTensor;     // 1 / x
  abs(): TapedTensor;            // dY · sign(x); non-differentiable at 0, subgradient = 0
}
```

### 1.2 Adjoints

For each method, the closure captures the forward primal where needed:

| Method | Adjoint |
|---|---|
| `sum(axis)` | `dY` broadcast back to input shape (each input element gets `dY[reduce(idx)]`). |
| `mean(axis)` | `dY / N` broadcast back, where `N` is the product of reduced-axis dimensions. |
| `prod(axis)` | `dY · (prod_over_axes(x) / x_i)` per element. Document the `x_i = 0` corner: when exactly one input is zero, derivative w.r.t. that input is the product of the others; w.r.t. all others, derivative is 0. When two or more are zero, derivative is 0 everywhere. |
| `max(axis)` | `dY` scattered to argmax position(s). Ties get a uniform split (or first-wins, choose one; document). |
| `min(axis)` | `dY` scattered to argmin position(s). |
| `norm(p=2)` | `dY · x / ‖x‖` |
| `norm(p=1)` | `dY · sign(x)` (subgradient = 0 at exact zero). |
| `norm(p='inf')` | `dY · sign(x) · 1{|x_i| = max(|x|)}` (scattered to max-abs index). |
| `norm(p='fro')` | Same as p=2 (Frobenius is the 2-norm of the flattened tensor). |
| `log(x)` | `dY / x` |
| `exp(x)` | `dY · y` where `y = exp(x)` (cache the primal) |
| `sin(x)` | `dY · cos(x)` |
| `cos(x)` | `−dY · sin(x)` |
| `tan(x)` | `dY · sec²(x) = dY / cos²(x)` |
| `sqrt(x)` | `dY / (2y)` where `y = sqrt(x)` |
| `square(x)` | `dY · 2x` |
| `pow(x, k)` | `dY · k · x^(k−1)` |
| `reciprocal(x)` | `−dY / x²` |
| `abs(x)` | `dY · sign(x)`; subgradient = 0 at exact zero |

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
export const arg  = mathTyped('arg',  { /* number | bigint | BigNumber | Complex */ });
export const conj = mathTyped('conj', { /* same */ });
export const im   = mathTyped('im',   { /* same */ });
export const re   = mathTyped('re',   { /* same */ });
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
  mode?: 'reduced' | 'full';   // default 'reduced' (thin QR)
}

export interface TensorQrResult {
  Q: Tensor;  // orthonormal, shape […rowDims, k] in reduced mode
  R: Tensor;  // upper triangular, shape [k, …colDims]
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
  L: Tensor;  // unit lower-triangular
  U: Tensor;  // upper-triangular
  P: Int32Array;  // permutation as a length-n permutation array
  parity: 1 | -1;  // sign of the permutation, useful for det()
}

export function tensorLU(t: Tensor, rowAxes: ReadonlyArray<number>): TensorLUResult;
```

Delegates to the existing `matrix/src/operations/lu.ts` (or its WASM equivalent). Requires the matrix-reshaped-to-2D input to be square. Throws otherwise.

### 3.3 `tensor/src/operations/cholesky.ts` (NEW)

```ts
export function tensorCholesky(
  t: Tensor,
  rowAxes: ReadonlyArray<number>,
  opts?: { lower?: boolean }   // default lower = true (return L such that A = L Lᵀ)
): { L: Tensor };
```

Delegates to either matrix's Cholesky or the AS WASM `matrix_cholesky` export landed in commit `b96b53a`. Requires the reshaped 2-D input to be symmetric positive-definite; throws "matrix is not positive definite" otherwise.

### 3.4 `tensor/src/operations/eig.ts` (NEW)

```ts
export interface TensorEigOpts {
  symmetric?: boolean;   // hint; if true, uses the symmetric-eig fast path
  computeVectors?: boolean;   // default true; when false, only eigenvalues are returned
}

export interface TensorEigResult {
  eigenvalues: Tensor;        // 1-D, length n
  eigenvectors?: Tensor;      // rank-2, shape [n, n] — columns are the eigenvectors; only present when computeVectors=true
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

# Proposal: ITensor-inspired tensor primitives in MathTS

**Author:** MathTS maintenance
**Date:** 2026-05-23
**Status:** Proposed
**Target package:** `@danielsimonjr/mathts-tensor` (with auxiliary additions to `@danielsimonjr/mathts-matrix`)
**Related external project:** [ITensors.jl](https://github.com/ITensor/ITensors.jl) — Julia tensor-network library that pioneered the named-index + automatic-contraction surface this proposal borrows from.

---

## 0. TL;DR

ITensor has been the standard for tensor-network programming in Julia for almost a decade. Its core insight — that indices should be **first-class objects with identity**, so contractions can be expressed by name instead of by axis position — generalises well beyond physics. MathTS's `Tensor` is currently positional-only (axes addressed by integer index, contractions specified via `einsum("ij,jk->ik", a, b)` spec strings). This proposal adds an **opt-in named-index layer** plus two small primitives (truncated SVD on Tensor, random-tensor constructors) that round out parity with the general-purpose pieces of ITensor.

What we are **not** adding: MPS/MPO, DMRG/TEBD/TDVP, fermion anticommutation, quantum-number block-sparse storage. Those are physics-specific and belong in the UPT layer or a sibling package, not in `mathts-tensor`. The UPT v0.70 proposal §1.3 explicitly disclaims wanting them upstream.

The four landings in this proposal, in priority order:

| Phase | Surface                                          | Effort       | Value |
| ----- | ------------------------------------------------ | ------------ | ----- |
| 1     | `Index` value type + `Tensor.contract(other)`    | ~150 LOC + tests | Highest leverage: makes tensor algebra readable, type-checkable, position-independent |
| 2     | `tensorSvd(t, {maxdim, cutoff})` truncated SVD   | ~80 LOC + tests  | Low-rank approximation primitive every downstream consumer wants (PCA, compression, …) |
| 3     | `randomTensor(shape, {distribution, seed})`      | ~40 LOC + tests  | Trivial, blocks no one but unblocks testing + ML |
| 4     | Optimal contraction-sequence solver              | ~300 LOC + tests | Big algorithmic win for any user composing 3+ tensors; **deferred to a follow-up slice** after Phase 1 lands |

---

## 1. Motivation

### 1.1 Current MathTS tensor surface

```ts
import { Tensor } from '@danielsimonjr/mathts-tensor';

const A = Tensor.fromNested([[1, 2], [3, 4]], [2, 2]);
const B = Tensor.fromNested([[5, 6], [7, 8]], [2, 2]);

const C = Tensor.einsum('ij,jk->ik', A, B);
```

Problems:

1. The `'ij,jk->ik'` spec string is stringly-typed — typos are runtime errors.
2. Axis identity is implicit in position. If a downstream developer adds a new axis to `A` (e.g. a batch dimension), every `einsum` call that consumed `A` needs to be re-spelled.
3. The contraction *intent* ("contract the inner dimension") is hidden in the letters of the spec string. Reading code, you have to mentally map indices to axes.

### 1.2 What ITensor does

```julia
i = Index(2, "i")
j = Index(3, "j")
k = Index(4, "k")

A = randomITensor(i, j)
B = randomITensor(j, k)

C = A * B   # automatically contracts on j because both A and B share it
```

`Index` is a value type carrying an immutable id, a dimension, and arbitrary tag strings. The `*` operator looks at both operands' indices and contracts every axis whose id appears in both. The result carries the union of the non-contracted indices, so the algebra composes naturally.

This is what we want.

### 1.3 Where ITensor goes that MathTS deliberately does not

ITensor's flagship features beyond named indices — MPS/MPO state representations, DMRG/TEBD/TDVP variational algorithms, fermionic anticommutation, quantum-number block-sparse storage — are physics-specific. They belong downstream of `mathts-tensor` (in UPT or a sibling) consuming the primitives this proposal adds, not in the core.

---

## 2. Phase 1 — `Index` + `Tensor.contract`

### 2.1 New file: `tensor/src/Index.ts`

```ts
export interface IndexOpts {
  /** Human-readable name; not used for matching but useful in errors / debug. */
  name?: string;
  /** Free-form tag list. Two indices with the SAME id but DIFFERENT tags still match by id. */
  tags?: ReadonlyArray<string>;
  /** Prime level (ITensor's "prime"). Two indices with the same id but different prime levels do NOT match. */
  primeLevel?: number;
}

/**
 * A `Index` is a value object carrying an immutable id, a dimension,
 * and optional tags / prime level. Two indices match (and are
 * contracted by `Tensor.contract`) iff their ids and prime levels
 * agree. Dimension must also agree at contraction time or the
 * library throws.
 */
export class Index {
  readonly id: symbol;
  readonly dim: number;
  readonly name?: string;
  readonly tags: ReadonlyArray<string>;
  readonly primeLevel: number;

  constructor(dim: number, opts?: IndexOpts);
  prime(by?: number): Index;        // returns a new Index with primeLevel + by
  noprime(): Index;                  // returns a new Index with primeLevel = 0
  addTag(tag: string): Index;
  removeTag(tag: string): Index;
  hasTag(tag: string): boolean;
  matches(other: Index): boolean;    // id === other.id && primeLevel === other.primeLevel
  toString(): string;
}

/** Convenience constructor: `const i = idx(3, 'i')`. */
export function idx(dim: number, name?: string, opts?: Omit<IndexOpts, 'name'>): Index;
```

### 2.2 Modifications to `tensor/src/Tensor.ts`

Add an **optional** `axisLabels?: ReadonlyArray<Index>` property and corresponding constructor / static-factory overloads. Existing positional Tensors continue to work unchanged — labels are opt-in.

```ts
export class Tensor {
  readonly shape: ReadonlyArray<number>;
  readonly data: Float64Array;
  readonly axisLabels?: ReadonlyArray<Index>;  // NEW, optional

  constructor(shape: ReadonlyArray<number>, data: Float64Array, axisLabels?: ReadonlyArray<Index>);

  /** New: contract this with `other` over every shared Index. */
  contract(other: Tensor): Tensor;

  /** New: rename / re-prime an axis. */
  replaceIndex(oldIndex: Index, newIndex: Index): Tensor;

  /** New: get the position of a labelled axis (throws if not found). */
  axisOf(index: Index): number;
}
```

`Tensor.contract(other)` implementation:

1. Require both operands to have `axisLabels` set; throw otherwise (the labelled API is opt-in).
2. Find the set of indices that appear in BOTH `axisLabels` (matching by `Index.matches`).
3. If no shared indices: throw "no shared indices to contract" (this is an outer product; user should use a separate `outer()` to be explicit — different from ITensor which returns the outer product silently).
4. Validate dimensions agree on shared axes.
5. Build an einsum spec string under the hood by lettering all axes and using the existing `Tensor.einsum`. The result Tensor's `axisLabels` is the concatenation of `this.axisLabels` and `other.axisLabels` with shared indices removed.

This **delegates to existing einsum** rather than reimplementing contraction — keeps the dispatch path consistent (worker pool above threshold, WASM tier when applicable).

### 2.3 Tests (new): `tensor/tests/Index.test.ts` + `tensor/tests/Tensor-contract.test.ts`

- `Index`: construction, id immutability, two indices with same dim/name have *different* ids (unless you reuse a reference); `prime` / `noprime` / `addTag` / `removeTag` return new instances; `matches` honours both id and primeLevel.
- `Tensor.contract`: matrix-matrix product via shared index, 3-tensor chain (a × b × c with two shared indices), prime-level distinction (a tensor with `i` does NOT contract with a tensor carrying `prime(i)`), dimension-mismatch error, no-shared-indices error.

### 2.4 Out of scope for Phase 1

- The `*` operator is not overrideable in TypeScript; we cannot mimic ITensor's `A * B` syntax. `contract(other)` is the closest readable surface.
- Inferring axis labels from a positional einsum spec — we keep positional einsum strings alone for back-compat; new code uses `contract`.

---

## 3. Phase 2 — `tensorSvd` with truncation

### 3.1 New file: `tensor/src/operations/svd.ts`

```ts
import { Tensor } from '../Tensor.js';
import { Index } from '../Index.js';

export interface TensorSvdOpts {
  /** If set, keep at most `maxdim` singular values. */
  maxdim?: number;
  /** If set, drop singular values smaller than `cutoff` (absolute). */
  cutoff?: number;
  /** If set, the returned U, S, V tensors will carry this index name in their "joining" axis. */
  joiningIndexName?: string;
}

export interface TensorSvdResult {
  U: Tensor;
  S: Tensor;     // 1-D, holds the singular values
  V: Tensor;
  truncatedDim: number;
  truncationError: number;  // Frobenius-norm squared of dropped singular values
}

/**
 * Reshape `t` into a matrix by partitioning its axes into "row" and
 * "col" groups, then compute the truncated SVD. The `rowAxes` indices
 * (or named Indices) join with U; the remaining axes join with V.
 */
export function tensorSvd(
  t: Tensor,
  rowAxes: ReadonlyArray<number> | ReadonlyArray<Index>,
  opts?: TensorSvdOpts
): TensorSvdResult;
```

Implementation:

1. Compute the row/col axis partition (accept positional or named).
2. Permute `t.data` so the row axes come first.
3. Reshape into a 2-D `DenseMatrix`.
4. Call the existing `matrix/src/operations/svd.ts` (which has the WASM-aware fast path).
5. Truncate per `{maxdim, cutoff}`: keep the largest `k` singular values where `k = min(maxdim ?? Infinity, count(s_i ≥ cutoff))`.
6. Return `U` (rank-r+1), `S` (rank-1 of length k), `V` (rank-r'+1) Tensors. If the input carried `axisLabels`, propagate them onto U and V; insert a new `Index` for the "joining" axis between U and V, parameterised on `joiningIndexName`.

### 3.2 Tests (new): `tensor/tests/operations/svd.test.ts`

- Rank-2 matrix SVD reconstruction: `U·diag(S)·Vᵀ ≈ original` to `1e-9`.
- Rank-3 tensor SVD with `rowAxes=[0]` (i.e. reshape to (d0, d1·d2)).
- Truncation: known-rank matrix with one zero singular value, `cutoff=1e-10` should drop it; `maxdim=k` should keep exactly k.
- Truncation error: returned value matches the sum of squared dropped singular values.
- Named-axis form: if input has `axisLabels`, U / V carry the right labels and a fresh joining `Index`.

---

## 4. Phase 3 — random tensor constructors

### 4.1 New file: `tensor/src/operations/random.ts`

```ts
import { Tensor } from '../Tensor.js';
import { Index } from '../Index.js';

export interface RandomTensorOpts {
  /** 'uniform' = U(0, 1); 'normal' = N(0, 1) via Box–Muller; 'orthogonal' = uniform on the orthogonal group via QR of a normal random matrix (rank-2 only). */
  distribution?: 'uniform' | 'normal' | 'orthogonal';
  /** Optional seed for reproducibility — when set, uses a deterministic PRNG (Mulberry32 or similar). */
  seed?: number;
  /** Optional axis labels (forwarded into the new Tensor). */
  axisLabels?: ReadonlyArray<Index>;
}

export function randomTensor(
  shape: ReadonlyArray<number>,
  opts?: RandomTensorOpts
): Tensor;
```

Implementation:

1. Default distribution is `'uniform'`.
2. `'normal'`: Box–Muller transform on the underlying seeded RNG.
3. `'orthogonal'`: only valid for rank-2 shapes; generates a normal random matrix and QR-decomposes via `matrix/src/operations/qr.ts`, returning Q.
4. Seeded RNG: Mulberry32 (small, fast, good enough for test data). Document that the seeded path is *not* cryptographic.

### 4.2 Tests (new): `tensor/tests/operations/random.test.ts`

- `randomTensor([2, 3])` returns the right shape and rank.
- Uniform: values in `[0, 1)`.
- Normal: sample mean ≈ 0 and sample variance ≈ 1 on a large sample (5000 elements).
- Orthogonal: `Q · Qᵀ ≈ I` to `1e-9` for a 16×16 random orthogonal.
- Seeded: same seed twice yields the same data; different seeds yield different data.
- `axisLabels` round-trip.

---

## 5. Phase 4 — optimal contraction-sequence solver (DEFERRED)

For a list of tensors and a target output index set, find the pairwise-contraction order minimising the total FLOP count. NP-hard in general; the standard algorithm is a depth-first branch-and-bound (Hendrickson–Sundaram) or for small networks (≤ ~16 tensors) a dynamic-programming exact solver. ITensor uses `TensorOperations.optimaltree`.

Surface:

```ts
function contractNetwork(
  tensors: ReadonlyArray<Tensor>,
  opts?: { maxIntermediateSize?: number }
): Tensor;
```

This phase **depends on Phase 1's `Index`** because the solver needs index labels to identify shared axes across the network. Held for a separate slice after Phase 1 lands.

---

## 6. Non-goals (explicit)

- **MPS / MPO** state representations → live in UPT or a sibling package; consume the primitives from this proposal.
- **DMRG / TEBD / TDVP** variational algorithms → physics-specific.
- **Quantum-number block-sparse storage** → UPT proposal §1.3 explicitly disclaims wanting this in MathTS.
- **Fermionic anticommutation / particle-conservation arithmetic** → physics.
- **HDF5 I/O** → JSON suffices for browser; HDF5 is interop with Python/Julia. Tracked as a long-term open item, not in scope here.
- **Non-abelian symmetry sector contraction** → still in dev in ITensor itself; far out of scope.

---

## 7. Sequencing + risk

- Phases 1 / 2 / 3 are independently writable: Phase 2 and 3 do not depend on Phase 1's `Index` (they accept positional axis sets but *opt to* carry `axisLabels` through if present).
- Phase 4 strictly depends on Phase 1.
- Backwards-compatibility: every existing positional Tensor consumer keeps working. `axisLabels` is opt-in.
- Build/test risk: the only file with concurrency risk is `tensor/src/Tensor.ts`. Phase 1 alone modifies it; Phases 2 + 3 write new files. Index re-exports from `tensor/src/index.ts` are wired centrally after all three phases land.

---

## 8. Acceptance criteria

- Each phase: 0 lint errors, 0 tsc errors in `tensor/`; full `npx turbo build` and `npx turbo test` remain green.
- Phase 1: a chained `A.contract(B).contract(C)` returns the same numerical result as the equivalent einsum spec.
- Phase 2: `tensorSvd` truncation error within `1e-12` of the analytical value (sum of squared dropped singular values).
- Phase 3: orthogonal-distribution Q passes `Q·Qᵀ ≈ I` to `1e-9` at 16×16.
- Phase 4 (when it lands): chooses the same contraction order as ITensor's `optimal_contraction_sequence` for a representative set of 5–8 tensor networks; ≥ 2× speedup vs naive left-to-right contraction on at least one of them.

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

The six landings in this proposal, in priority order:

| Phase | Surface                                                         | Effort           | Status / Value                                                                           |
| ----- | --------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| 1     | `Index` value type + `Tensor.contract(other)`                   | ~150 LOC + tests | ✅ LANDED (`a21a844`) — readable, type-checkable, position-independent tensor algebra    |
| 2     | `tensorSvd(t, rowAxes, {maxdim, cutoff})` truncated tensor SVD  | ~80 LOC + tests  | ✅ LANDED (`a21a844`) — low-rank approximation primitive every downstream consumer wants |
| 3     | `randomTensor(shape, {distribution, seed})`                     | ~40 LOC + tests  | ✅ LANDED (`a21a844`) — uniform / normal / orthogonal with Mulberry32 seeding            |
| 4     | `contractNetwork(tensors)` — optimal pairwise-contraction order | ~300 LOC + tests | In flight — DP exact for N ≤ 16, Hendrickson–Sundaram greedy beyond                      |
| 5     | `TapedTensor.contract` + `TapedTensor.matmul` (AD closure)      | ~120 LOC + tests | In flight — closes the AD loop for UPT v0.7 Proposal 8                                   |
| 6     | Tensor reductions, NumPy broadcasting, `tensordot(other, axes)` | ~300 LOC + tests | In flight — biggest single jump in everyday usability                                    |

---

## 1. Motivation

### 1.1 Current MathTS tensor surface

```ts
import { Tensor } from '@danielsimonjr/mathts-tensor';

const A = Tensor.fromNested(
  [
    [1, 2],
    [3, 4],
  ],
  [2, 2]
);
const B = Tensor.fromNested(
  [
    [5, 6],
    [7, 8],
  ],
  [2, 2]
);

const C = Tensor.einsum('ij,jk->ik', A, B);
```

Problems:

1. The `'ij,jk->ik'` spec string is stringly-typed — typos are runtime errors.
2. Axis identity is implicit in position. If a downstream developer adds a new axis to `A` (e.g. a batch dimension), every `einsum` call that consumed `A` needs to be re-spelled.
3. The contraction _intent_ ("contract the inner dimension") is hidden in the letters of the spec string. Reading code, you have to mentally map indices to axes.

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
  prime(by?: number): Index; // returns a new Index with primeLevel + by
  noprime(): Index; // returns a new Index with primeLevel = 0
  addTag(tag: string): Index;
  removeTag(tag: string): Index;
  hasTag(tag: string): boolean;
  matches(other: Index): boolean; // id === other.id && primeLevel === other.primeLevel
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
  readonly axisLabels?: ReadonlyArray<Index>; // NEW, optional

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

- `Index`: construction, id immutability, two indices with same dim/name have _different_ ids (unless you reuse a reference); `prime` / `noprime` / `addTag` / `removeTag` return new instances; `matches` honours both id and primeLevel.
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
  S: Tensor; // 1-D, holds the singular values
  V: Tensor;
  truncatedDim: number;
  truncationError: number; // Frobenius-norm squared of dropped singular values
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

export function randomTensor(shape: ReadonlyArray<number>, opts?: RandomTensorOpts): Tensor;
```

Implementation:

1. Default distribution is `'uniform'`.
2. `'normal'`: Box–Muller transform on the underlying seeded RNG.
3. `'orthogonal'`: only valid for rank-2 shapes; generates a normal random matrix and QR-decomposes via `matrix/src/operations/qr.ts`, returning Q.
4. Seeded RNG: Mulberry32 (small, fast, good enough for test data). Document that the seeded path is _not_ cryptographic.

### 4.2 Tests (new): `tensor/tests/operations/random.test.ts`

- `randomTensor([2, 3])` returns the right shape and rank.
- Uniform: values in `[0, 1)`.
- Normal: sample mean ≈ 0 and sample variance ≈ 1 on a large sample (5000 elements).
- Orthogonal: `Q · Qᵀ ≈ I` to `1e-9` for a 16×16 random orthogonal.
- Seeded: same seed twice yields the same data; different seeds yield different data.
- `axisLabels` round-trip.

---

## 5. Phase 4 — optimal contraction-sequence solver

For a network of tensors with named indices, find the pairwise-contraction order minimising the total FLOP count. NP-hard in general; standard approach is depth-first branch-and-bound (Hendrickson–Sundaram) or, for small networks (≤ ~16 tensors), an exact dynamic-programming solver. ITensor uses `TensorOperations.optimaltree`.

### 5.1 New file: `tensor/src/contraction-sequence.ts`

```ts
import { Tensor } from './Tensor.js';

export interface ContractNetworkOpts {
  /** Cap intermediate-tensor element count to avoid blowups (default: 2^31). */
  maxIntermediateSize?: number;
  /** 'exact' = DP optimal (≤ ~16 tensors); 'greedy' = Hendrickson–Sundaram heuristic (any N).
   *  Default 'exact' when N ≤ 16, otherwise 'greedy'. */
  algorithm?: 'exact' | 'greedy' | 'auto';
}

export interface ContractNetworkResult {
  result: Tensor;
  contractionOrder: ReadonlyArray<readonly [number, number]>; // sequence of pairwise contractions in input indices
  totalFlops: number;
  intermediateSizes: ReadonlyArray<number>; // element count of each intermediate
}

/**
 * Contract a list of tensors (each with `axisLabels`) in the FLOP-optimal pairwise order.
 * Equivalent in output to applying `Tensor.contract` in some order until one tensor remains,
 * but chooses an order minimising total FLOPs.
 */
export function contractNetwork(
  tensors: ReadonlyArray<Tensor>,
  opts?: ContractNetworkOpts
): ContractNetworkResult;
```

### 5.2 Algorithm

- **Exact (DP)** — Pearl's bitmask DP. For N tensors, state space is `2^N`; for each subset S of tensors, store the cheapest sequence to contract them. Transition: split S into S₁ ∪ S₂, recursively get the cheapest contractions for each, plus the cost of one final pairwise contraction. O(N · 3^N) time. Practical for N ≤ ~16.
- **Greedy / Hendrickson–Sundaram** — at each step, pick the pair (i, j) minimising the cost of contracting `T_i` and `T_j` given their current intermediate shapes. O(N³) per step, N-1 steps. Suboptimal but fast.
- Cost model: for a single pairwise contraction with shared dim products `D_shared` and free dim products `D_free_left`, `D_free_right`, FLOP cost ≈ `D_shared · D_free_left · D_free_right` (the volume of the output × the contraction depth, equivalent to `2 · result_elements · shared_dim_product` to leading order).

### 5.3 Acceptance

- Reproduces the same optimal order as ITensor's `optimal_contraction_sequence` on a handful of representative networks (we'll fix a small test corpus).
- ≥ 2× speedup vs naive left-to-right contraction on at least one network in the corpus (a chain where the best order is "middle out").
- Throws if any input lacks `axisLabels` (require Phase 1 surface).

---

## 6. Phase 5 — Autograd over named-index contractions

UPT v0.7 Proposal 8 (`differentiableEvaluator`) needs reverse-mode AD to traverse bridge equations whose primitive ops include `contract` and `matmul`. `TapedTensor` today exposes `add / sub / mul / scale` but neither. This phase closes the loop.

### 6.1 Modifications to `autograd/src/tape.ts`

Add two new methods on `TapedTensor`:

```ts
class TapedTensor {
  /**
   * Reverse-mode AD over `Tensor.contract`. Both operands must have axisLabels;
   * the resulting TapedTensor inherits the contracted-output axisLabels.
   *
   * Adjoints (T-base notation, treating contract as "matmul on shared axes"):
   *   dA = dY.contract(B')   where B' has shared indices restored
   *   dB = A'.contract(dY)
   * Implemented in the closure by einsum'ing dY against the appropriate operand
   * with index identities preserved (we have axisLabels — match-by-id makes this exact).
   */
  contract(other: TapedTensor): TapedTensor;

  /**
   * Reverse-mode AD over matmul (a generalisation of contract on rank-2 inputs;
   * also accepts rank-N inputs as batched matmul, similar to NumPy's @).
   *
   * Adjoints (classical):
   *   dA = dY · Bᵀ
   *   dB = Aᵀ · dY
   */
  matmul(other: TapedTensor): TapedTensor;
}
```

### 6.2 Tests (new): `autograd/tests/tensor-contract-ad.test.ts`

- `contract`: 2-tensor product (3×4 ⊗ 4×5 → 3×5) gradients match numerical AD via small perturbations.
- `contract`: 3-tensor chain reverse-mode = analytical adjoint to 1e-9.
- `matmul`: 2-D classic, 3-D batched matmul, gradient correctness vs the closed-form `dA = dY · Bᵀ`, `dB = Aᵀ · dY`.
- Both ops compose cleanly with the existing `add` / `mul` / `scale` (a chain `(A · B) + C` returns correct gradients across all leaves).
- Error: contracting two `TapedTensor`s without overlapping axisLabels throws.

---

## 7. Phase 6 — Tensor arithmetic completeness

The biggest single jump in usability — bringing `Tensor` from "scalar + elementwise + einsum-only" to the surface NumPy / JAX users expect. Three closely-related sub-deliverables on a single Tensor.ts pass.

### 7.1 Reductions

```ts
class Tensor {
  /** Reduce over the given axis (or all axes if omitted). `keepDims=true` preserves axis as length 1. */
  sum(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor;
  mean(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor;
  max(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor;
  min(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor;
  prod(axis?: number | ReadonlyArray<number>, opts?: { keepDims?: boolean }): Tensor;

  /** Vector p-norm (default p=2). When `axis` is a single dim, reduces along it. */
  norm(opts?: { p?: number | 'inf' | '-inf' | 'fro'; axis?: number; keepDims?: boolean }): Tensor;
}
```

The reductions over a scalar axis-set produce a rank-0 Tensor. `axisLabels` (if set) drop the contracted axes, exactly like `Tensor.contract` does.

### 7.2 Broadcasting

`add` / `sub` / `mul` (elementwise) currently require exact shape match. Extend them with NumPy broadcasting semantics:

1. Right-align shapes by axis.
2. A dimension of 1 broadcasts against any other dimension.
3. Missing axes are treated as length-1.

```ts
class Tensor {
  /** Now broadcasts both operands per NumPy rules. */
  add(other: Tensor | number): Tensor;
  sub(other: Tensor | number): Tensor;
  mul(other: Tensor | number): Tensor;
}
```

Backwards-compat: same-shape inputs still hit the existing fast path; broadcasting is the new fallback.

### 7.3 `tensordot`

```ts
class Tensor {
  /**
   * Generalised dot product over the listed axis pairs.
   *   tensordot(b, [[0, 2], [1, 0]]) contracts axis 0 of `this` with axis 1 of `b`
   *   and axis 2 of `this` with axis 0 of `b`. Equivalent to NumPy's tensordot.
   */
  tensordot(other: Tensor, axes: ReadonlyArray<readonly [number, number]>): Tensor;
}
```

Implementation delegates to `einsum` under the hood (build the spec string from the axis-pair list).

### 7.4 Tests (new): three files

- `tensor/tests/reductions.test.ts`: each reduction over each axis-set shape, `keepDims=true/false`, `norm` for p ∈ {1, 2, Infinity, 'fro'}, axisLabels propagation drops the contracted axes.
- `tensor/tests/broadcasting.test.ts`: scalar + tensor, rank-2 + rank-1 vector along each axis, rank-3 + rank-2, error on incompatible shapes.
- `tensor/tests/tensordot.test.ts`: rank-2 matrix multiply via `tensordot(b, [[1, 0]])`, rank-3 with multiple axis pairs, equivalence with the corresponding einsum spec.

### 7.5 Acceptance

- Reductions: identical numerical result to a hand-written reference loop, within `1e-12` (no truncation other than IEEE rounding).
- Broadcasting: all NumPy-style shape combinations succeed; the spec is the same as `numpy.broadcast_shapes`.
- `tensordot`: numerical equivalence to einsum spec to `1e-12` on rank-3 test inputs.

---

---

## 8. Non-goals (explicit)

- **MPS / MPO** state representations → live in UPT or a sibling package; consume the primitives from this proposal.
- **DMRG / TEBD / TDVP** variational algorithms → physics-specific.
- **Quantum-number block-sparse storage** → UPT proposal §1.3 explicitly disclaims wanting this in MathTS.
- **Fermionic anticommutation / particle-conservation arithmetic** → physics.
- **HDF5 I/O** → JSON suffices for browser; HDF5 is interop with Python/Julia. Tracked as a long-term open item, not in scope here.
- **Non-abelian symmetry sector contraction** → still in dev in ITensor itself; far out of scope.

---

## 9. Sequencing + risk

- Phases 1 / 2 / 3 LANDED in commit `a21a844`.
- Phase 4 (contraction-sequence solver) depends on Phase 1's `Index`. Self-contained algorithm in a new file `tensor/src/contraction-sequence.ts`; does not modify `Tensor.ts`.
- Phase 5 (AD closure) modifies `autograd/src/tape.ts` and adds tests under `autograd/tests/`. Disjoint from Phase 4 and Phase 6 file scopes.
- Phase 6 (reductions + broadcasting + tensordot) modifies `Tensor.ts` heavily. Phase 4 explicitly avoids `Tensor.ts` to make the two phases concurrently writable.

- Backwards-compatibility:
  - Phase 1 was opt-in (`axisLabels` is optional). Same applies forward.
  - Phase 6 extends `add` / `sub` / `mul` with broadcasting; the same-shape fast path is preserved.

- Build/test risk: Phases 4-6 are concurrently writable because each owns disjoint files. After all three land, `tensor/src/index.ts` is wired centrally to re-export the new symbols.
- Phase 4 strictly depends on Phase 1.
- Backwards-compatibility: every existing positional Tensor consumer keeps working. `axisLabels` is opt-in.
- Build/test risk: the only file with concurrency risk is `tensor/src/Tensor.ts`. Phase 1 alone modifies it; Phases 2 + 3 write new files. Index re-exports from `tensor/src/index.ts` are wired centrally after all three phases land.

---

## 10. Acceptance criteria

- Each phase: 0 lint errors, 0 tsc errors in `tensor/`; full `npx turbo build` and `npx turbo test` remain green.
- Phase 1: a chained `A.contract(B).contract(C)` returns the same numerical result as the equivalent einsum spec.
- Phase 2: `tensorSvd` truncation error within `1e-12` of the analytical value (sum of squared dropped singular values).
- Phase 3: orthogonal-distribution Q passes `Q·Qᵀ ≈ I` to `1e-9` at 16×16.
- Phase 4 (when it lands): chooses the same contraction order as ITensor's `optimal_contraction_sequence` for a representative set of 5–8 tensor networks; ≥ 2× speedup vs naive left-to-right contraction on at least one of them.

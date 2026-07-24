# @danielsimonjr/mathts-tensor API Reference

Rank-N, row-major `Float64Array`-backed dense tensors with einsum/broadcasting,
decompositions routed through `matrix`, and an ITensor-inspired named-index
labelling system for tensor-network-style contraction.

## Installation

```bash
npm install @danielsimonjr/mathts-tensor
```

## Overview

`Tensor` is the compute primitive; element-wise and data-movement ops are plain
O(n) loops, while heavy ops (`matMul`, all decompositions) delegate to
`@danielsimonjr/mathts-matrix`'s already-optimized (SIMD-WASM-capable)
primitives rather than reimplementing them.

```typescript
import { Tensor, Index, idx } from '@danielsimonjr/mathts-tensor';
```

## Classes

### Tensor

The rank-N dense compute primitive.

```typescript
import { Tensor } from '@danielsimonjr/mathts-tensor';
```

#### Constructor

```typescript
new Tensor(shape: number[], data: Float64Array, axisLabels?: Index[])
```

#### Properties

| Property     | Type                    | Description                          |
| ------------ | ----------------------- | ------------------------------------ |
| `shape`      | `ReadonlyArray<number>` | Tensor shape                         |
| `data`       | `Float64Array`          | Underlying row-major buffer          |
| `axisLabels` | `ReadonlyArray<Index>?` | Optional named-index labels per axis |

#### Static Methods

| Method            | Signature                                             | Description                       |
| ----------------- | ----------------------------------------------------- | --------------------------------- |
| `sizeOf`          | `(shape: number[]) => number`                         | Total element count               |
| `rowMajorStrides` | `(shape: number[]) => number[]`                       | Strides for a row-major layout    |
| `fromNested`      | `(data: NestedArray, shape: number[]) => Tensor`      | Build from nested arrays          |
| `identity`        | `(n: number) => Tensor`                               | Rank-2 identity                   |
| `fromDenseMatrix` | `(m: DenseMatrix) => Tensor`                          | Rank-2 bridge from `matrix`       |
| `broadcastShape`  | `(a: number[], b: number[]) => number[]`              | NumPy right-align broadcast rules |
| `einsum`          | `(spec: EinsumSpec, ...operands: Tensor[]) => Tensor` | Einstein summation                |

#### Conversion

| Method          | Signature           | Description                               |
| --------------- | ------------------- | ----------------------------------------- |
| `toNested`      | `() => NestedArray` | Convert to nested arrays                  |
| `toDenseMatrix` | `() => DenseMatrix` | Rank-2 → DenseMatrix (throws if rank ≠ 2) |

#### Arithmetic & Reductions

| Method    | Signature                                  | Description                                                  |
| --------- | ------------------------------------------ | ------------------------------------------------------------ |
| `add`     | `(other: Tensor \| number) => Tensor`      | Element-wise addition (broadcasting)                         |
| `sub`     | `(other: Tensor \| number) => Tensor`      | Element-wise subtraction                                     |
| `mul`     | `(other: Tensor \| number) => Tensor`      | Element-wise multiplication                                  |
| `scale`   | `(k: number) => Tensor`                    | Scalar multiplication                                        |
| `normInf` | `() => number`                             | Infinity norm                                                |
| `sum`     | `(axis?, opts?: {keepDims?}) => Tensor`    | Strided reduction                                            |
| `mean`    | `(axis?, opts?: {keepDims?}) => Tensor`    | Mean reduction                                               |
| `max`     | `(axis?, opts?: {keepDims?}) => Tensor`    | Max (NaN-propagating)                                        |
| `min`     | `(axis?, opts?: {keepDims?}) => Tensor`    | Min (NaN-propagating)                                        |
| `prod`    | `(axis?, opts?: {keepDims?}) => Tensor`    | Product reduction                                            |
| `norm`    | `(opts?: {p, axis?, keepDims?}) => Tensor` | `p = 2` (default) / `'fro'` / `'inf'` / `'-inf'` / numeric p |

#### Shape / Contraction

| Method         | Signature                                      | Description                                              |
| -------------- | ---------------------------------------------- | -------------------------------------------------------- |
| `reshape`      | `(shape: number[]) => Tensor`                  | Reshape (same element count)                             |
| `transpose`    | `(perm?: number[]) => Tensor`                  | Permute axes                                             |
| `matMul`       | `(other: Tensor) => Tensor`                    | Uses matrix's backend-selected multiply for large inputs |
| `tensordot`    | `(other: Tensor, axes) => Tensor`              | NumPy `tensordot` semantics (delegates to `einsum`)      |
| `axisOf`       | `(index: Index) => number`                     | Axis position of a named index                           |
| `replaceIndex` | `(oldIndex: Index, newIndex: Index) => Tensor` | Swap a named index                                       |
| `contract`     | `(other: Tensor) => Tensor`                    | Named-index contraction over ALL shared indices          |

> `contract` throws if either operand has no `axisLabels`, there are no shared
> indices, or a shared index has mismatched dimensions.

---

### Index

Immutable value type for named-index labelling. Matching is by identity
(`Symbol`) **and** `primeLevel` — NOT by dimension. Dimension mismatches on a
shared index are only caught at `contract()` time.

```typescript
import { Index, idx } from '@danielsimonjr/mathts-tensor';
```

#### Constructor

```typescript
new Index(dim: number, opts?: IndexOpts)
```

#### Properties & Methods

| Member       | Type / Signature            | Description                               |
| ------------ | --------------------------- | ----------------------------------------- |
| `id`         | `symbol`                    | Unique identity                           |
| `dim`        | `number`                    | Dimension                                 |
| `name`       | `string?`                   | Optional label                            |
| `tags`       | (set)                       | Optional tags                             |
| `primeLevel` | `number`                    | Prime level (part of matching)            |
| `prime`      | `(by?: number) => Index`    | Increase prime level                      |
| `noprime`    | `() => Index`               | Reset prime level                         |
| `addTag`     | `(tag: string) => Index`    | Add a tag                                 |
| `removeTag`  | `(tag: string) => Index`    | Remove a tag                              |
| `hasTag`     | `(tag: string) => boolean`  | Tag membership                            |
| `matches`    | `(other: Index) => boolean` | Match iff same `id` AND same `primeLevel` |
| `toString`   | `() => string`              | String form                               |

`idx(dim, name?, opts?): Index` is a convenience factory.

## Decompositions

Routed through `matrix`'s DenseMatrix primitives — tensor axes are partitioned
into "row"/"col" groups, reshaped to 2-D, passed to the matrix primitive, then
reshaped back.

| Function         | Signature                                         | Result                                                |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `tensorSvd`      | `(t, rowAxes, opts?) => TensorSvdResult`          | `{U, S, V, truncatedDim, truncationError}`            |
| `tensorSvdWasm`  | `(t, rowAxes, opts?) => Promise<TensorSvdResult>` | Async variant (via `svdWasm`)                         |
| `tensorQr`       | `(t, rowAxes, opts?) => TensorQrResult`           | `{Q, R}` — `mode: 'reduced' \| 'full'`                |
| `tensorLU`       | `(t, rowAxes, opts?) => TensorLUResult`           | `{L, U, P, parity}` — reshaped matrix must be square  |
| `tensorCholesky` | `(t, rowAxes, opts?) => TensorCholeskyResult`     | `{L}` — SPD only                                      |
| `tensorEig`      | `(t, rowAxes, opts?) => TensorEigResult`          | `{eigenvalues, eigenvectors?, eigenvaluesImaginary?}` |
| `tensorEigWasm`  | `(t, rowAxes, opts?) => Promise<TensorEigResult>` | Async variant                                         |
| `tensorPinv`     | `(t, rowAxes, opts?) => Tensor`                   | Moore-Penrose via full SVD + rcond                    |
| `tensorSolve`    | `(A, b, opts?) => TensorSolveResult`              | `{x}` — LU-based linear solve                         |

## Tensor-Network Utilities

| Function          | Signature                                   | Description                                                                                                                                                    |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contractNetwork` | `(tensors, opts?) => ContractNetworkResult` | `{result, contractionOrder, totalFlops, intermediateSizes}` — optimal pairwise order via bitmask DP (`'exact'`, N≤16) or greedy (`'greedy'`); `'auto'` chooses |

## Construction & Manipulation

| Function       | Signature                                      | Description                                                                                    |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `randomTensor` | `(shape, opts?) => Tensor`                     | Mulberry32 seeded PRNG; `'uniform' \| 'normal' \| 'orthogonal'` (NOT cryptographically secure) |
| `tensorKron`   | `(a, b, opts?) => Tensor`                      | Kronecker product                                                                              |
| `slice`        | `(t, ranges) => Tensor`                        | NumPy/JAX basic slicing                                                                        |
| `gather`       | `(t, axis, indices) => Tensor`                 | Gather along an axis (primes the gathered axis's label)                                        |
| `stack`        | `(tensors, axis, opts?) => Tensor`             | Stack along a new axis                                                                         |
| `concatenate`  | `(tensors, axis) => Tensor`                    | Concatenate along an existing axis                                                             |
| `scatter`      | `(t, axis, indices, updates, opts?) => Tensor` | Scatter — `reduce: 'overwrite' \| 'add'`                                                       |
| `pad`          | `(t, padWidths, opts?) => Tensor`              | `'constant' \| 'edge' \| 'reflect'`                                                            |
| `roll`         | `(t, shifts, axes?) => Tensor`                 | Cyclic shift                                                                                   |
| `flip`         | `(t, axes) => Tensor`                          | Reverse along axes                                                                             |

## Types

`EinsumSpec`, `IndexOpts`, `NestedArray` (= core's `NestedArray<number>`), plus
one options/result interface pair per decomposition/manipulation function.

## Example

```typescript
import { Tensor, idx } from '@danielsimonjr/mathts-tensor';

// Named-index contraction (ITensor-style)
const i = idx(2, 'i');
const j = idx(3, 'j');
const k = idx(4, 'k');

const A = Tensor.fromNested(
  [
    [1, 2, 3],
    [4, 5, 6],
  ],
  [2, 3]
);
// attach labels, contract over the shared index j...

// einsum matrix multiply
const C = Tensor.einsum('ij,jk->ik', A /* [2,3] */ /* B [3,4] */);
console.log(C.shape); // [2, 4]

// reductions with keepDims
const rowSums = A.sum(1, { keepDims: true }); // shape [2, 1]
```

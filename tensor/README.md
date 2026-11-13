# @danielsimonjr/mathts-tensor

Rank-n tensor for [MathTS](https://github.com/danielsimonjr/mathts).

Rank-N dense tensors for MathTS, backed by a single `Float64Array` with shape/stride metadata. Built on `@danielsimonjr/mathts-matrix`.

> **Float64 storage:** Tensors always store values in a `Float64Array`. There is no `float32` dtype; the `dtype` getter reports `'float64'`. A `Float32Array` passed to the constructor is copied to a new `Float64Array`, so the tensor does not share memory with the source. Use `Tensor.zeros` / `ones` / `full` / `arange` for construction.

## Install

```sh
npm install @danielsimonjr/mathts-tensor
```

## Example

```ts
import { Tensor } from '@danielsimonjr/mathts-tensor';

const t = Tensor.fromNested([
  [1, 2],
  [3, 4],
]);
console.log(t.shape, t.sum().toNested()); // [2, 2] 10
```

## What it provides

- `Tensor` construction: `Tensor.fromNested([[1, 2], [3, 4]])` infers shape, or
  `new Tensor(shape, data)`. `data` is a `Float64Array` (stored by reference) or a
  `Float32Array` (copied to a new `Float64Array`; each value widens exactly).
  Other types throw a `TypeError`.
- Elementwise ops, reshaping, broadcasting, reductions, contraction, and `matMul`
  (routes through `backendManager.multiply` for WASM GEMM when gated).
- Tensor decompositions and `tensorSvdWasm` / `tensorEigWasm` (async JS delegates).
- Substrate for `@danielsimonjr/mathts-autograd` (`randomTensor` uses Mulberry32).

## License

MIT (c) Daniel Simon Jr.

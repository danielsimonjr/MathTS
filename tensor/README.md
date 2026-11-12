# @danielsimonjr/mathts-tensor

Rank-n tensor for [MathTS](https://github.com/danielsimonjr/mathts).

Rank-N dense tensors for MathTS, backed by a single `Float64Array` with shape/stride metadata. Built on `@danielsimonjr/mathts-matrix`.

> **Float64 only:** Tensors always use `Float64Array` storage. There is no `float32` dtype on this type yet; the `dtype` getter reports `'float64'`. Use `Tensor.zeros` / `ones` / `full` / `arange` for construction.

## Install

```sh
npm install @danielsimonjr/mathts-tensor
```

## What it provides

- `Tensor` construction: `Tensor.fromNested([[1, 2], [3, 4]])` infers shape, or
  `new Tensor(shape, new Float64Array(...))` (constructor requires `Float64Array`).
- Elementwise ops, reshaping, broadcasting, reductions, contraction, and `matMul`
  (routes through `backendManager.multiply` for WASM GEMM when gated).
- Tensor decompositions and `tensorSvdWasm` / `tensorEigWasm` (async JS delegates).
- Substrate for `@danielsimonjr/mathts-autograd` (`randomTensor` uses Mulberry32).

## License

MIT (c) Daniel Simon Jr.

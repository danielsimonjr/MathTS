# @danielsimonjr/mathts-tensor

Rank-n tensor for [MathTS](https://github.com/danielsimonjr/mathts).

Rank-N dense tensors for MathTS, backed by a single `Float64Array` with shape/stride metadata. Built on `@danielsimonjr/mathts-matrix`.

## Install

```sh
npm install @danielsimonjr/mathts-tensor
```

## What it provides

- `Tensor` construction from nested arrays / flat data + shape.
- Elementwise ops, reshaping, broadcasting, reductions, contraction, and `matMul`
  (routes through `backendManager.multiply` for WASM GEMM when gated).
- Tensor decompositions and `tensorSvdWasm` / `tensorEigWasm` (async JS delegates).
- Substrate for `@danielsimonjr/mathts-autograd` (`randomTensor` uses Mulberry32).

## License

MIT (c) Daniel Simon Jr.

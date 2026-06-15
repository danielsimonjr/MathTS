# @danielsimonjr/mathts-tensor

Rank-n tensor for [MathTS](https://github.com/danielsimonjr/mathts).

Rank-N dense tensors for MathTS, backed by a single `Float64Array` with shape/stride metadata. Built on `@danielsimonjr/mathts-matrix`.

## Install

```sh
npm install @danielsimonjr/mathts-tensor
```

## What it provides

- `Tensor` construction from nested arrays / flat data + shape.
- Elementwise ops, reshaping, broadcasting, reductions, and contraction.
- The substrate for `@danielsimonjr/mathts-autograd`.

## License

MIT (c) Daniel Simon Jr.

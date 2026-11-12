# @danielsimonjr/mathts-autograd

Automatic differentiation for [MathTS](https://github.com/danielsimonjr/mathts).

Forward- and reverse-mode automatic differentiation over `@danielsimonjr/mathts-tensor`.

## Install

```sh
npm install @danielsimonjr/mathts-autograd
```

## What it provides

- Forward mode via `DualTensor` (dual numbers, `core` dual rules).
- Reverse mode via `Tape`, `TapedTensor`, `grad`, `valueAndGrad`, `jacobian`,
  `derivative`, `reverseGrad` (see `docs/api/autograd.md`).
- Gradients of tensor-valued expressions for optimization / ML workloads.
- `TapedTensor.add` / `mul` and `DualTensor.add` / `mul` follow the same NumPy-style
  broadcasting rules as `Tensor`, including scalar `add(n)` without a second tape.

## License

MIT (c) Daniel Simon Jr.

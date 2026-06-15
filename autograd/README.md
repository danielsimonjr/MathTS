# @danielsimonjr/mathts-autograd

Automatic differentiation for [MathTS](https://github.com/danielsimonjr/mathts).

Forward- and reverse-mode automatic differentiation over `@danielsimonjr/mathts-tensor`.

## Install

```sh
npm install @danielsimonjr/mathts-autograd
```

## What it provides

- Forward mode via `DualTensor` (dual numbers).
- Reverse mode via a `Tape` / `TapedTensor` (backprop).
- Gradients of tensor-valued expressions for optimization / ML workloads.

## License

MIT (c) Daniel Simon Jr.

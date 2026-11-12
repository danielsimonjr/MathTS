# @danielsimonjr/mathts-autograd

Automatic differentiation for [MathTS](https://github.com/danielsimonjr/MathTS).

Forward- and reverse-mode AD over `@danielsimonjr/mathts-tensor` (`f64` dense tensors only).

## Install

```sh
npm install @danielsimonjr/mathts-autograd
```

## What it provides

- **Forward mode** via `DualTensor` (dual numbers wired through `core`).
- **Reverse mode** via `Tape`, `TapedTensor`, `reverseGrad`.
- **JAX-style helpers**: `grad`, `valueAndGrad`, `derivative`, `jacobian` (see `docs/api/autograd.md`).
- **ML-shaped ops on the tape**: `relu`, `gelu`, `sigmoid`, `softmax`, `logSoftmax`, `crossEntropy`, `binaryCrossEntropy`, plus `reshape` and reductions with `keepDims`.
- **`detach()`** and **`Tape.noGrad()`** to stop gradients through a subgraph.

## Current limitations (read before assuming “PyTorch in TS”)

| Area                              | Status                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elementwise `add` / `sub` / `mul` | Same-shape or **NumPy broadcast** between two `TapedTensor`s; scalars via `add(n)` / `scale(n)`.                                                        |
| Mixed precision                   | **Float64 only** — no `float32` tensors on the tape.                                                                                                    |
| `grad()` / `valueAndGrad()`       | Accept a `Tensor` of any rank (Jacobian helpers too); practical training still uses explicit `Tape` + `matmul` for weights.                             |
| GPU                               | Autograd runs on CPU tensor data.                                                                                                                       |
| Tape reuse                        | After `backward()`, the graph is **sealed** — call `Tape.reset()` (or `new Tape()`) before another forward. Stale `TapedTensor`s throw after `reset()`. |
| Second `backward()`               | Input grads **accumulate**; pass `{ retainGraph: true }` to keep the graph for another backward (intermediate cotangent slots are cleared each replay). |

## Minimal XOR (ReLU + BCE)

```ts
import { Tensor } from '@danielsimonjr/mathts-tensor';
import { Tape, TapedTensor } from '@danielsimonjr/mathts-autograd';

const tape = new Tape();
const x = TapedTensor.fromTensorAsInput(new Tensor([1, 2], new Float64Array([0, 1])), tape);
const w = TapedTensor.fromTensorAsInput(new Tensor([2, 4], new Float64Array(8).fill(0.1)), tape);
const y = x.matmul(w).relu().sum();
tape.backward(y.id, Float64Array.of(1));
```

See `autograd/tests/dogfood-g13.test.ts` for a full trainable XOR example.

## License

MIT (c) Daniel Simon Jr.

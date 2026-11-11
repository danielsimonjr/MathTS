# ML engineer — npm dogfood, 2026-11-11

I came in as a PyTorch / JAX / TensorFlow.js user who wanted to train small models in TypeScript. Label: `persona:ml-engineer`. I did **not** build MathTS from this clone. I made a fresh ESM project at `/tmp/mathts-ml-dogfood` on Node v22.23.4 and installed the published packages:

`@danielsimonjr/mathts-tensor@0.3.5`, `autograd@0.4.5`, `gpu@0.2.1`, `parallel@0.10.0`, `workerpool@0.4.0`, `matrix@0.10.0`, `linalg@0.2.5` (core `0.26.0` as a transitive). Host: Linux 6.12.113+, 4× Intel Xeon. Repo SHA I compared against: `fef4010b8a468215a26bcdb9642db0556055b9bb`.

Oracle: PyTorch-style broadcasting / `zeros` / `view(-1)` / `relu` / `detach` / `no_grad` / `matmul` naming, plus finite-difference gradients. I also typechecked a strict NodeNext consumer (`skipLibCheck: false`).

I could not comment on existing issues (#696, #710): `GraphQL: Resource not accessible by integration (addComment)`. Duplicates are noted below instead of new issues.

## What I tried, in order

1. `npm i` the stack. Reading versions via `import …/package.json` threw `ERR_PACKAGE_PATH_NOT_EXPORTED` (same as **#696**). I read the files with `fs`.
2. Tensor construction, broadcasting, reductions, reshape, slice, stack, flip, pad, roll, randomTensor.
3. Autograd: `grad` vs central finite differences on ~16 ops; `reverseGrad` / `forwardGrad`; `Tape.backward` twice; nested `grad`; DualTensor `x³`.
4. Linear regression, XOR MLP, 2-D spiral MLP — first as `X@W+b`, then with `ones @ b` because broadcast AD does not exist.
5. Memory: 200 steps of `p.mul(p).sum()` on `[64,64]` with `--expose-gc`, new Tape vs reuse vs `reset()`.
6. GPU detect / `enableGpu` / `GPUContext` in Node (no adapter).
7. `ComputePool` sin/map/matmul, with and without `initialize()`, `forceParallel`, terminate, plus a tiny custom `WorkerPool` script for errors/timeouts.

## What worked

- `Tensor.fromNested`, `identity`, NumPy-style broadcast on **primal** tensors (`[2,3]+[1,3]`, `[3]+[3,1]→[3,3]`), `sum`/`mean`/`max`/`min`/`prod` with `keepDims`, `clone`, `slice` copy, `concatenate`, `pad`, `roll`, seeded `randomTensor`.
- Reverse-mode grads of `square/sin/cos/exp/log/tanh/abs/sqrt/reciprocal/pow/log1p/expm1/sinh/mean/prod` matched finite differences to ~1e-10 relative.
- `matmul` adjoint on the tape matched `dA = 1 @ Bᵀ`.
- `derivative(x³, 2) === 12`; DualTensor tangent of `x³` at 2 is 12; `jacobian` of `3x²` is `diag(6x)`.
- Linear regression `y=3x+2` (400 SGD steps, `ones@b` bias): `w=3`, `b=2`, final MSE `9.8e-26`, **0.049 ms/step**.
- XOR 2-8-1 `tanh` MLP (2500 steps): predictions `[-0.012, 0.985, 0.984, -0.020]`, **0.020 ms/step**.
- WorkerPool (custom worker): execute, error propagation (`task-failed`), 200 ms timeout, terminate rejects new work. Map errors from `ComputePool.map` surfaced `boom-2`. Bit-identical `sin` vs a JS loop when sequential. `matmul` 256² after `initialize()`: parallel `chunks: 4`, ~20 ms vs ~33 ms naive, `maxDiff` on `c00` 0.

## Findings

### 1. P0 — taped elementwise ops do not broadcast ([#747](https://github.com/danielsimonjr/MathTS/issues/747))

`Tensor.add` broadcasts; `TapedTensor.add` / `DualTensor.add` require identical shapes. `x.matmul(W).add(b)` with `b` `[1,H]` throws `TapedTensor.add: shape mismatch [4,4] vs [1,4]`. Linear `x.mul(w)` with `w` length 1 throws too. I had to write `ones([N,1]).matmul(b[1,H])`. That is not an affine layer anyone from PyTorch would invent.

### 2. P1 — `stack()` without axis returns zeros ([#749](https://github.com/danielsimonjr/MathTS/issues/749))

`stack([a,b])` → shape `[2]`, data `[0,0]`. `stack([a,b], 0)` is correct. Silent wrong answer.

### 3. P1 — constructor does not check Float64Array ([#748](https://github.com/danielsimonjr/MathTS/issues/748))

Runtime accepts `Float32Array`, `Int32Array`, `number[]`, and `{length,0,1}`. `tsc` rejects `Float32Array` (`TS2345`). Types and runtime disagree.

### 4. P1 — `flip(t, 0)` is `TypeError: axes is not iterable` ([#750](https://github.com/danielsimonjr/MathTS/issues/750))

`flip(t, [0])` works. The crash has no `flip:` prefix.

### 5. P1 — no `zeros`/`ones`/`arange` ([#751](https://github.com/danielsimonjr/MathTS/issues/751))

Biases are `new Tensor(shape, new Float64Array(n))`.

### 6. P1 — `reshape` copies and rejects `-1` ([#752](https://github.com/danielsimonjr/MathTS/issues/752))

Unlike a PyTorch view. `reshape([-1,2])` on `[2,3]` → size mismatch.

### 7. P1 — `matMul` vs `matmul`, rank-2 vs batched ([#753](https://github.com/danielsimonjr/MathTS/issues/753))

`Tensor.matMul` is rank-2 only. `TapedTensor.matmul` batches `[2,2,2]`. `div` vs `divide` is the same split.

### 8. P1 — no relu / softmax / CE ([#754](https://github.com/danielsimonjr/MathTS/issues/754))

Spiral net with `tanh`+MSE topped out around 62% accuracy then drifted to 50%. XOR only worked because `tanh` can sit on `{0,1}`.

### 9. P1 — no `detach` / `no_grad`; `add(1)` says “different Tapes” ([#755](https://github.com/danielsimonjr/MathTS/issues/755))

### 10. P1 — second `backward` triples grads ([#756](https://github.com/danielsimonjr/MathTS/issues/756))

`x.square().sum()`, `x=[1,2]`: first `[2,4]`, second `[6,12]` not `[4,8]`. Accumulation is wrong.

### 11. P1 — ComputePool is sequential until `initialize()`; terminate still answers ([#757](https://github.com/danielsimonjr/MathTS/issues/757))

`forceParallel` is ignored while `isReady()===false`. Related to **#710** (default `sin` threshold `'never'` even after init).

### 12. P1 — forced parallel `sin` n=1e6 is 6× slower ([#758](https://github.com/danielsimonjr/MathTS/issues/758))

58.8 ms / 100 chunks vs 9.9 ms sequential, `maxDiff 0`.

### 13. P2 — GPU status `'error'` in Node ([#759](https://github.com/danielsimonjr/MathTS/issues/759))

`hasWebGPU()===false`, `getGpuDevice()===null`, `initialize()` false (as README said). `GPUContext.status` is `'error'`. No GPU numeric agreement to measure. `isGPUSuitableForMatrixOps()` with no args throws.

### 14. P1 — f64-only, no `.dtype` ([#760](https://github.com/danielsimonjr/MathTS/issues/760))

### 15. P2 — no in-place ops ([#761](https://github.com/danielsimonjr/MathTS/issues/761))

SGD is a loop on `param.data`. Constructor aliases the buffer (PyTorch `torch.tensor` copies).

### 16. P2 — `slice` is a free function; negative step rejected ([#762](https://github.com/danielsimonjr/MathTS/issues/762))

### 17. P1 — no taped `reshape`; `grad()` is rank-1 only ([#763](https://github.com/danielsimonjr/MathTS/issues/763))

### 18. P1 — Tape reuse without `reset()` grows RSS ([#764](https://github.com/danielsimonjr/MathTS/issues/764))

~16 MiB over 180 steps at 64×64. New Tape / `reset()` are flat.

### 19. P2 — README “ML workloads” vs the missing affine layer ([#765](https://github.com/danielsimonjr/MathTS/issues/765))

### Duplicate (no new issue)

- **#696** `./package.json` not exported — reproduced on `mathts-tensor`.
- **#710** public/elementwise `sin` not actually parallel — confirmed via `DEFAULT_THRESHOLD_BY_OP.sin === 'never'`.

## Summary table

| #    | Sev | Topic                          |
| ---- | --- | ------------------------------ |
| #747 | P0  | No AD broadcast (`X@W+b`)      |
| #748 | P1  | Ctor accepts non-f64           |
| #749 | P1  | `stack` omit axis → zeros      |
| #750 | P1  | `flip(t,0)` TypeError          |
| #751 | P1  | No zeros/ones                  |
| #752 | P1  | reshape copy, no `-1`          |
| #753 | P1  | matMul vs matmul / batched     |
| #754 | P1  | No relu/softmax/CE             |
| #755 | P1  | No detach; `add(1)` message    |
| #756 | P1  | Double backward 3×             |
| #757 | P1  | ComputePool init/terminate     |
| #758 | P1  | forceParallel sin 6× slower    |
| #759 | P2  | GPU status `error` in Node     |
| #760 | P1  | No dtype                       |
| #761 | P2  | No in-place                    |
| #762 | P2  | slice step                     |
| #763 | P1  | No taped reshape / rank-1 grad |
| #764 | P1  | Tape leak without reset        |
| #765 | P2  | README ML claim                |
| #696 | —   | duplicate comment (blocked)    |
| #710 | —   | duplicate comment (blocked)    |

Raw timings: `docs/persona-sessions/bench/2026-11-11-ml-engineer.json`.

## Verdict

I can differentiate a vector of elementary ops and, with enough shape yoga, fit XOR and a line. I would not ship a training loop on this API yet: **broadcasting is missing on the tape**, there is **no ReLU**, **`stack` can silently return zeros**, and **workers look parallel while running sequential** until you find `initialize()`. GPU in Node is a clean null with a misleading `'error'` status. Finite-difference agreement on the ops that exist is excellent; the gaps are product-shaped, not numeric noise.

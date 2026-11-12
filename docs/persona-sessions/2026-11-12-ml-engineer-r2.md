# ML engineer — npm dogfood round 2, 2026-11-12

I am a PyTorch / JAX / TensorFlow.js engineer trying to train small models in TypeScript. Label: `persona:ml-engineer`. Round 2 rules required **published npm only** (no monorepo build). I used a fresh ESM project at `/tmp/mathts-ml-engineer-r2` on Node v22.23.4 (Linux 6.12.113+).

Installed versions (verified with `npm ls`):

| Package | Version |
| ------- | ------- |
| `@danielsimonjr/mathts-tensor` | 0.4.0 |
| `@danielsimonjr/mathts-autograd` | 0.5.0 |
| `@danielsimonjr/mathts-gpu` | 0.3.0 |
| `@danielsimonjr/mathts-parallel` | 0.10.1 |
| `@danielsimonjr/mathts-workerpool` | 0.4.1 |
| `@danielsimonjr/mathts-matrix` | 0.10.1 |
| `@danielsimonjr/mathts-linalg` | 0.2.6 |
| `@danielsimonjr/mathts-core` | 0.27.0 |

Oracle: PyTorch/NumPy broadcasting, finite-difference gradients, and convergence on XOR / spiral / linear regression. I did **not** fix code in the repo this round.

## What I tried, in order

1. Confirmed version pins against persona-common-r2.
2. Re-ran round-1 repros (#747–#765) on the published stack.
3. Finite-difference checks on taped ops (`square`, `sin`, `relu`, `gelu`).
4. Manual `Tape` training loops (ReLU MLP XOR, linear regression, 2-class spiral) using `TapedTensor.fromTensorAsInput` + `tape.backward` + `getInputGrad`.
5. `ComputePool` init/terminate, `map` error propagation, `forceParallel` `sin` at 1e6.
6. GPU detect/init in Node (`GPUContext`, `hasWebGPU`).
7. Filed new regressions and API gaps; could not post comments on closed issues (integration 403).

## Round-1 re-check

| Issue | Fixed? | Notes |
| ----- | ------ | ----- |
| [#747](https://github.com/danielsimonjr/MathTS/issues/747) | yes | `X.matmul(W).add(b)` on tape works; bias grad non-zero |
| [#748](https://github.com/danielsimonjr/MathTS/issues/748) | yes | `Float32Array` ctor rejected at runtime |
| [#749](https://github.com/danielsimonjr/MathTS/issues/749) | yes | Omitted `axis` now matches `stack(..., 0)` → `[2,2]`, data correct |
| [#750](https://github.com/danielsimonjr/MathTS/issues/750) | yes | `flip(t, 0)` works |
| [#751](https://github.com/danielsimonjr/MathTS/issues/751) | yes | `Tensor.zeros` / `ones` / `arange` |
| [#752](https://github.com/danielsimonjr/MathTS/issues/752) | yes | `reshape([-1, 2])`; view shares buffer |
| [#753](https://github.com/danielsimonjr/MathTS/issues/753) | yes | Batched `TapedTensor.matmul` OK |
| [#754](https://github.com/danielsimonjr/MathTS/issues/754) | yes | `relu`, `gelu`, `softmax` on tape |
| [#755](https://github.com/danielsimonjr/MathTS/issues/755) | yes | `detach`, `noGrad`, scalar `add(1)` |
| [#756](https://github.com/danielsimonjr/MathTS/issues/756) | yes | Second backward accumulates 2× |
| [#757](https://github.com/danielsimonjr/MathTS/issues/757) | yes | `initialize()` then `terminate()` rejects work |
| [#758](https://github.com/danielsimonjr/MathTS/issues/758) | **no** | Regressed; see [#903](https://github.com/danielsimonjr/MathTS/issues/903) |
| [#759](https://github.com/danielsimonjr/MathTS/issues/759) | yes | `GPUContext.status === 'unavailable'` in Node |
| [#760](https://github.com/danielsimonjr/MathTS/issues/760) | partial | `dtype: 'float64'` only — still no f32 training |
| [#761](https://github.com/danielsimonjr/MathTS/issues/761) | yes | `add_` in-place without aliasing untouched clone |
| [#762](https://github.com/danielsimonjr/MathTS/issues/762) | **no** | Negative `slice` step still identity; [#902](https://github.com/danielsimonjr/MathTS/issues/902) |
| [#763](https://github.com/danielsimonjr/MathTS/issues/763) | yes | Taped `reshape` + rank-2 `grad` |
| [#764](https://github.com/danielsimonjr/MathTS/issues/764) | yes | `Tape.reset()` documented; no RSS regression run |
| [#765](https://github.com/danielsimonjr/MathTS/issues/765) | yes | README matches relay (ReLU, BCE, limitations table) |

## New findings (round 2)

### 1. P1 — negative `slice` regression ([#902](https://github.com/danielsimonjr/MathTS/issues/902))

`slice(t, [{ step: -1 }])` on `[0,1,2,3,4]` returns forward order. NumPy `t[::-1]` is `[4,3,2,1,0]`.

### 2. P1 — `forceParallel` `sin` still slower ([#903](https://github.com/danielsimonjr/MathTS/issues/903))

At n=1e6 after `initialize()`, median ~75 ms (`forceParallel: true`) vs ~27 ms (default). `DEFAULT_THRESHOLD_BY_OP.sin` remains `'never'`.

### 3. P2 — `Tensor.matmul` vs `TapedTensor` ([#904](https://github.com/danielsimonjr/MathTS/issues/904))

`X.matmul(W)` throws `other.contiguous is not a function` when `W` is taped. Workaround: wrap batch `X` on the tape too.

### 4. P2 — `package.json` import attribute ([#905](https://github.com/danielsimonjr/MathTS/issues/905))

Export exists (post-#696) but Node 22 needs `import … with { type: 'json' }`.

## What worked well

- Broadcast AD for affine layers; ReLU MLP XOR to ~1.0 in 2500 steps (~0.044 ms/step).
- Linear regression: `w≈3`, `b≈2`, MSE ~3e-24.
- Spiral (ReLU, 4 hidden): **100%** accuracy after 4000 steps.
- Finite-difference agreement ~1e-11 rel on `square`/`sin`/`relu`/`gelu`.
- GPU status quiet `'unavailable'` in Node; `grad()` accepts matrix-shaped inputs when reduced to scalar.

## Summary table (round-2 issues)

| # | Sev | Topic |
| --- | --- | ----- |
| [#902](https://github.com/danielsimonjr/MathTS/issues/902) | P1 | Slice negative step regression |
| [#903](https://github.com/danielsimonjr/MathTS/issues/903) | P1 | `forceParallel` sin perf regression |
| [#904](https://github.com/danielsimonjr/MathTS/issues/904) | P2 | `Tensor.matmul` vs `TapedTensor` |
| [#905](https://github.com/danielsimonjr/MathTS/issues/905) | P2 | `package.json` import attribute |

Timings: `docs/persona-sessions/bench/2026-11-12-ml-engineer-r2.json`.

## Verdict

The relay release is a **real step up** for training: broadcast tape, ReLU, factory tensors, and XOR/spiral convergence are credible on CPU autograd. Two round-1 items are **still open on npm** (slice reverse, parallel `sin`), and mixed `Tensor`/`TapedTensor` matmul remains awkward versus PyTorch. I would prototype small models here; I would still wrap every batch in the tape and avoid `forceParallel` `sin` until [#903](https://github.com/danielsimonjr/MathTS/issues/903) is addressed.

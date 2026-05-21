# Remaining Acceleration Candidates — Survey & Plan

**Status**: Survey + implementation plan. Build tier scoped; blocked tier
documented with prerequisites.
**Goal**: Triage every function still carrying `—` in the function-reference
`Accel` column — decide, honestly, which deserve Web Worker / WASM / WebGPU
acceleration and which do not.

> **Context.** The high-value parallelization is already done — matmul,
> the matrix-ops decompositions, the FFT family (`spectrogram`, `fft2d`,
> `parallelConv`, the four-step `parallelFFT`/`parallelIFFT`), and
> `distanceMatrix`. What remains is a long tail. Most of it is **marginal,
> cosmetic, or blocked**, and this document says plainly which is which rather
> than implying the whole list is worth building.

---

## 1. Principle

Acceleration pays off only for **compute-bound** work — where arithmetic grows
faster than data movement. Element-wise O(n) maps and cheap scalar functions are
transfer-bound: worker dispatch (and, for GPU, the f32 conversion) costs more
than it saves. WebGPU is additionally f32-only and async-only. These rules,
applied to the remaining functions, leave a small genuine set.

---

## 2. Survey

### 2.1 Genuine candidates

**Element-wise arithmetic / trigonometry — `Float64Array` overloads.**
`sign`, `cube`, `cbrt`, `expm1`, `log2`, `log10`, `log1p`, `round`, `floor`,
`ceil`, `fix`; `csc`/`sec`/`cot`, `asin`/`acos`/`atan`, `sinh`/`cosh`/`tanh`,
`asinh`/`acosh`/`atanh`. These are trivially parallelizable via the existing
`computePool.applyKernel`, exactly as `add`/`sin`/`exp` already are. Real-world
value is **low** (transfer-bound); the justification is **API consistency** —
right now some element-wise functions accept a parallel `Float64Array` and
their siblings do not.

**Product reduction — `parallelStatProd`.** A genuine reduction; needs a small
`prodChunk` worker kernel (the multiplicative analogue of `sumChunk`). Reductions
return a scalar, so only the input transfers — the most worker-friendly shape
left.

### 2.2 Not worth accelerating

| Category / function | Why not |
|---|---|
| Relational, Logical & Bitwise | O(1)/element — pure transfer-bound. |
| Algebra, CAS | Symbolic tree/string work — not data-parallel. |
| Graph Theory | Dijkstra / DFS / MST are inherently sequential. |
| Set Operations | Sort/hash-bound; `setPowerset` exponential. |
| Matrix Construction | Memory/structural — bandwidth-bound. |
| Units, Constants, Complex utils, Type Conversion/Checking, Expression | Scalar or structural; not numeric-array work. |
| `cholesky`, `rowReduce`, `matrixRank` | Sequential pivoting / column dependencies. |
| `findRoot`, `minimize`, ODE solvers, `curvefit` | Iterative — each step depends on the last. |
| `quickSelect`, `medianSelect`, `parallelStatQuantile` | Selection/sort don't parallelize cleanly at these sizes. |
| `entropy`, `jsDivergence`, `kldivergence` | Reductions, but over **probability vectors**, which are typically small (a handful to a few thousand outcomes). The parallel threshold would essentially never trigger. |
| `parallelStatCumsum` | Prefix sum — O(n) work, O(n) output: transfer-bound. |
| `hessenbergForm` | Its Householder updates are rank-1 (matrix-vector + outer product), not a clean `matMul` call; one worker dispatch per reduction step would be dominated by round-trip latency. |
| Numerical integration (`simpson`, `gaussQuad`), `globalMinimize` | The integrand / objective is a **user callback**, usually a closure over outer variables — it cannot be safely serialized to a worker. Function-shipping parallelism is fragile here. |

---

## 3. Implementation plan

### Tier 1 — Build now (clean, verifiable in Node CI)

| Item | Change | Effort |
|---|---|---|
| Element-wise arithmetic overloads | Add `Float64Array` overloads to `sign`, `cube`, `cbrt`, `expm1`, `log2`, `log10`, `log1p`, `round`, `floor`, `ceil`, `fix` in `functions/src/typed/arithmetic.ts`, dispatching to `computePool.applyKernel` with a self-contained `(x) => number` source; sequential fallback below threshold. Pattern: `distributions.ts` / `special.ts`. | Low (mechanical) |
| Element-wise trig overloads | Same for `csc`, `sec`, `cot`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`, `asinh`, `acosh`, `atanh` in `functions/src/typed/trigonometry.ts`. | Low (mechanical) |
| `parallelStatProd` | Add a `prodChunk` worker kernel + `MathWorkerPool.prod` + `ComputePool.prod`; wire `parallelStatProd`'s `Float64Array` overload (currently sequential). | Low |

Each is fully verifiable in Node — no WASM build, no browser needed — against
the sequential reference, exactly as the prior acceleration work was tested.

### Tier 2 — Blocked (needs a prerequisite)

**WASM kernel wiring** — *not low-effort, despite an earlier estimate.* The
AssemblyScript kernels for number theory and orthogonal polynomials/integral
functions do exist in source (`assembly/src/ops/number-theory.ts`,
`assembly/src/ops/special.ts`), **but**:

- No `.wasm` artifact is built in this environment (`npm run build:wasm` has not
  been run; `lib/wasm/*.wasm` is absent).
- The Rust WASM path (`getRustWasm` in the old `special.ts`) was **deliberately
  disabled** — ESM cannot `require()` it and its loader API did not match
  (`wasm.exports.x` vs `getExports()?.x`). It was removed as dead code.
- Wiring therefore cannot be written *and verified* without first producing a
  working WASM build and re-validating the `WasmLoader` integration (including
  the SHA-384 manifest integrity check, a security invariant).

**Prerequisite before this is buildable:** confirm `npm run build:wasm`
succeeds, the AS module exports the expected number-theory/poly symbols, and
`WasmLoader.getModule()` returns them — *then* wire `combinatorics.ts` /
`special.ts` the way `signal.ts` already wires `dct` / `dwt`.

### Tier 3 — Considered, not pursued

The "Not worth accelerating" rows in §2.2 — recorded so the analysis is not
repeated. The WebGPU angle adds nothing new: the only GPU-worthy remaining
shapes (element-wise maps, tree reductions) are already scoped in
[`UNIFIED_WEBGPU_PATH.md`](./UNIFIED_WEBGPU_PATH.md).

---

## 4. Recommendation

Build **Tier 1** — it completes the element-wise `Float64Array` surface
consistently and adds the one genuine missing reduction. It is mechanical, low
risk, and fully testable. Be clear-eyed that its runtime value is modest;
the reason to do it is a coherent, predictable API, not speed.

**Tier 2** should not start until its WASM-build prerequisite is met — handing
it to an implementer who cannot verify the result would just produce unverified
code.

**Tier 3** is closed: documented, with reasons, not to be revisited unless the
workload profile changes.

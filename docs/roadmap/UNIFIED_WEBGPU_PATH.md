# Unified WebGPU Path — Design Spec

**Status**: Proposal / not scheduled — research effort, decision pending.
**Author**: design brainstorm (acceleration roadmap, high-effort tier).
**Goal**: Extend WebGPU acceleration from the four isolated matrix kernels it
covers today into a coherent, GPU-resident compute path spanning the
compute-bound operations across MathTS — element-wise math, reductions, linear
algebra, FFT, and distance matrices — without silently degrading the f64 API.

> This is a **design document**, not a committed plan. It exists so the work can
> be scoped honestly. Read the _Constraints_ and _Recommendation_ sections
> first — a unified GPU path is genuinely valuable only for a specific class of
> workload, and the cost is real.

---

## 1. TL;DR

WebGPU compute shaders can deliver large speedups for sustained, compute-bound
work, but only if (a) data stays **resident on the GPU** across a chain of
operations rather than round-tripping to CPU memory per call, and (b) the caller
accepts **32-bit float** precision (WGSL has no f64). Today MathTS has WebGPU
for `add` / `matmul` / `transpose` / `scale` only, each a one-shot CPU→GPU→CPU
call. A "unified path" means: a shared WGSL **shader library**, a **GPU-resident
array handle** so ops compose without transfer overhead, and a **router** that
picks JS / worker-pool / WASM / WebGPU per operation. It is a multi-phase effort
and should be built only if MathTS is targeting browser-hosted, large-scale
numerical workloads.

---

## 2. Current state (what exists today)

| Component                                            | Location                                   | What it does                                                                                 |
| ---------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `GPUBackend`                                         | `matrix/src/backends/GPUBackend.ts`        | WebGPU compute shaders for `add`, `matmul`, `transpose`, `scale` (f32, flat `Float32Array`). |
| `GPUMatrixBackend` / `gpuMatrixBackend`              | `matrix/src/backends/GPUMatrixBackend.ts`  | `DenseMatrix`-level wrappers; `*Async` methods with a JS fallback via `executeWithFallback`. |
| `GPUContext`                                         | `matrix/src/backends/gpu/GPUContext.ts`    | Device / adapter acquisition, queue, buffer writes.                                          |
| `BufferPool`                                         | `matrix/src/backends/gpu/BufferPool.ts`    | Reuses `GPUBuffer`s across dispatches to avoid alloc churn.                                  |
| `ShaderManager`                                      | `matrix/src/backends/gpu/ShaderManager.ts` | Compiles + caches pipelines; holds the builtin WGSL shaders.                                 |
| `BatchExecutor`                                      | `matrix/src/backends/gpu/BatchExecutor.ts` | Groups multiple dispatches into one submission.                                              |
| `detect.ts`                                          | `matrix/src/backends/gpu/detect.ts`        | `hasWebGPU()` and capability detection.                                                      |
| `BackendManager`                                     | `matrix/src/backends/BackendManager.ts`    | Size-thresholded JS / WASM / GPU routing — **matrix ops only**.                              |
| `gpuMatmul` / `gpuAdd` / `gpuTranspose` / `gpuScale` | `functions/src/typed/gpu.ts`               | Opt-in async `functions`-package entry points.                                               |

**Gaps.** GPU coverage stops at four matrix ops. Every call is a standalone
CPU→GPU→CPU round trip — no way to keep an intermediate on the device. There is
no GPU path for FFT, reductions, element-wise unary/binary maps, or distance
matrices. The router (`BackendManager`) is matrix-specific and unaware of the
worker pool.

---

## 3. Motivation — what "unified" buys

1. **Coverage** — the compute-bound operations that today use the worker pool
   (matmul, FFT batches, distance matrices) or run sequentially could share one
   GPU path.
2. **Composition** — the decisive win. A chain such as
   `normalize(A·B + bias)` currently costs three CPU↔GPU transfers if each op is
   GPU-accelerated independently; transfer then dominates and the GPU loses to
   the worker pool. A GPU-resident handle collapses that to one upload and one
   download.
3. **One mental model** — callers reason about a single `gpu*` surface and a
   single backend-selection policy instead of per-package ad-hoc wiring.

---

## 4. Hard constraints (read before scoping)

These are not solvable; they shape every decision below.

- **WGSL is f32-only.** There is no `f64` in WGSL (and `f16` only with the
  `shader-f16` feature). Every GPU result carries ~7 significant decimal digits.
  This is acceptable for graphics-style bulk math (matmul, FFT) but is a real,
  silent regression if substituted for an f64 CPU path. → GPU must stay
  **opt-in**, never an automatic substitution. (See §6.)
- **WebGPU is async-only.** No synchronous compute, no synchronous buffer
  readback. Every GPU-accelerated function returns a `Promise`. `Sync.ts`'s
  block-on-async tricks do not apply to compute submission.
- **Transfer cost dominates single ops.** A standalone op pays
  `Float64Array → Float32Array` conversion + upload + dispatch + download +
  `Float32Array → Float64Array`. For an O(n) element-wise op this swamps the
  compute. GPU wins only when compute ≫ transfer (O(n³) matmul, O(n² log n)
  batched FFT) **or** when the data is already resident (§7).
- **Availability.** `navigator.gpu` exists in modern browsers and in
  Deno; Node has no built-in WebGPU. CI on Node can therefore only exercise the
  CPU fallback. (See §9.)
- **Device limits.** `maxComputeWorkgroupStorageSize`, `maxStorageBufferBindingSize`
  (often 128 MiB), `maxComputeInvocationsPerWorkgroup` (256), buffer-count
  limits. Large problems must be tiled; the shader library must query limits at
  init and adapt.

---

## 5. Proposed architecture

A four-layer stack, most of which extends what `matrix/src/backends/gpu/`
already has.

```
  functions/  ── gpu* entry points (gpuMatmul, gpuFft, gpuDistanceMatrix, …)
       │
  ┌────▼─────────────────────────────────────────────────┐
  │ GpuCompute            unified dispatch + op router    │  ← new
  │   ├─ GpuArray         GPU-resident buffer handle       │  ← new
  │   ├─ ShaderLibrary    WGSL kernel modules + pipelines  │  ← extends ShaderManager
  │   └─ BackendRouter    JS / worker / WASM / WebGPU      │  ← generalizes BackendManager
  └────┬─────────────────────────────────────────────────┘
       │
  GPUContext · BufferPool · BatchExecutor   (exist today, reused as-is)
```

### 5.1 `GpuArray` — the GPU-resident handle (the core idea)

A lightweight handle: `{ buffer: GPUBuffer, shape: number[], dtype: 'f32' }`.
Operations accept and return `GpuArray`. Data crosses the PCIe boundary only at
explicit edges:

```ts
const ga = await GpuArray.upload(cpuFloat64Array, shape); // one upload
const r = await gpuMatmul(gpuAdd(ga, bias), weights); // stays on device
const out = await r.toFloat64Array(); // one download
```

This is what makes WebGPU pay off. Without it, every `gpu*` call is a fresh
round trip and the worker pool usually wins.

### 5.2 `ShaderLibrary` — WGSL kernel modules

Extends `ShaderManager`'s builtin-pipeline cache into a catalogue of WGSL
modules, compiled lazily and keyed by `(kernel, workgroupSize, dtypeVariant)`.
See §6 for the kernel families.

### 5.3 `BackendRouter` — generalized selection

Generalize `BackendManager` (today: matrix-only, JS/WASM/GPU) into an operation
router keyed on `(operationType, elementCount, dataResidency)`:

- input already a `GpuArray` → prefer GPU even below the size threshold (the
  data is there already);
- large CPU input, GPU available, op is compute-bound → GPU;
- large CPU input, no GPU → worker pool;
- small input → JS.

The worker pool (`ComputePool`) becomes a peer backend in this router rather
than a separate subsystem.

---

## 6. Kernel families — the WGSL to write

Listed cheapest-to-hardest. Each is a WGSL module in the `ShaderLibrary`.

| Family                | Kernels                                          | Notes                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Element-wise unary    | `abs`, `sqrt`, `exp`, `log`, `sin`, …            | One invocation per element. Trivial WGSL. Only worth GPU when fused (§7) or when the input is already a `GpuArray`.                                                                                                                                                                                                                              |
| Element-wise binary   | `add`, `sub`, `mul`, `div`                       | `add` exists. Same fusion caveat.                                                                                                                                                                                                                                                                                                                |
| Reductions            | `sum`, `min`/`max`, `norm`, `mean`/`variance`    | Tree reduction: workgroup-local reduce in shared memory, then a second pass over partials. Multi-dispatch — drive via `BatchExecutor`.                                                                                                                                                                                                           |
| Linear algebra        | `matmul` (tiled), `matvec`, `transpose`, `outer` | `matmul`/`transpose` exist; make them tiled with shared-memory blocking for large sizes.                                                                                                                                                                                                                                                         |
| **FFT**               | radix-2 **Stockham autosort**, batched           | The hard one. Use Stockham (not Cooley-Tukey-with-bit-reversal): it ping-pongs between two buffers and avoids the scattered bit-reversal permutation, which is hostile to GPU memory access. `log2(N)` dispatches per transform; one workgroup per frame for batched FFT (`spectrogram`, `fft2d`). Reference designs: VkFFT, GPU-FFT literature. |
| Distance / similarity | `distanceMatrix`, `cosineSimilarity`             | Tiled pairwise: load point blocks into shared memory, accumulate. Maps cleanly to the existing `distanceMatrixRowsChunk` row-block decomposition.                                                                                                                                                                                                |
| Scan / convolution    | prefix-sum, 1-D convolution                      | Blelloch scan; convolution either direct (small kernels) or via the FFT module.                                                                                                                                                                                                                                                                  |

---

## 7. Precision strategy

Non-negotiable: **the GPU path never silently replaces an f64 result.**

1. **Opt-in surface.** Keep the established `gpu*` naming (`gpuMatmul`, …) — a
   `gpu`-prefixed function is a contract that the result is f32-precision. Never
   reroute `multiply` / `fft` / etc. through WebGPU automatically.
2. **Documented precision.** Every `gpu*` function's JSDoc and the function
   reference's `Accel` column state f32.
3. **Optional `f64`-emulation mode.** For accuracy-sensitive callers, offer a
   _double-single_ (two-f32 / compensated-arithmetic, à la Dekker) variant of
   the hot kernels — ~1e-13 effective precision at ~3–10× the f32 cost. This is
   a per-kernel opt-in (`{ precision: 'extended' }`), not the default.
4. **Mixed precision.** For iterative algorithms, a GPU f32 bulk pass followed
   by one CPU f64 refinement step (a known pattern for linear solves) recovers
   most of the accuracy at most of the speed.

---

## 8. Operation fusion

Two levels, increasing payoff and effort:

- **Residency fusion (Phase 3).** `GpuArray` handles alone already remove the
  per-op round trips — the chain stays on-device. This is most of the win and
  needs no compiler.
- **Kernel fusion (Phase 5, optional).** A small lazy graph: element-wise chains
  (`a*b + c`, `exp(-x)`) compile to a _single_ generated WGSL shader instead of
  one dispatch per op, eliminating intermediate buffers entirely. This is a real
  mini-compiler — only justified if profiling shows element-wise dispatch
  overhead dominating.

---

## 9. Testing strategy

The Node-has-no-WebGPU gap is the main friction.

- **Fallback parity (CI, Node).** Every `gpu*` function must return correct
  results through the CPU fallback; this is already how `functions/tests/gpu.test.ts`
  works and runs in normal CI.
- **Real GPU coverage.** Pick one:
  - a native WebGPU binding for Node (Dawn-based `webgpu` npm package, or run
    the GPU suite under Deno, which ships WebGPU) — best for CI;
  - Playwright headless-browser tests — closest to the real target, heavier.
- **Numerical tolerance.** GPU tests assert against the f64 CPU result within an
  f32-appropriate tolerance (relative ~1e-5–1e-6), not `toBeCloseTo(…, 12)`.
- **Determinism caveat.** Floating-point reduction order differs across GPUs;
  tests must not assume bit-exact GPU results.

---

## 10. Phased delivery

| Phase          | Scope                                                                                          | Depends on            |
| -------------- | ---------------------------------------------------------------------------------------------- | --------------------- |
| 1              | `ShaderLibrary` skeleton; element-wise unary/binary + reduction WGSL; tiled `matmul`.          | existing `gpu/` infra |
| 2              | `GpuArray` resident handle; `upload` / `toFloat64Array`; route the Phase-1 kernels through it. | 1                     |
| 3              | Stockham FFT module (single + batched); wire opt-in `gpuFft` / batched paths.                  | 1, 2                  |
| 4              | `BackendRouter` generalization; `gpuDistanceMatrix`; residency-aware selection.                | 2                     |
| 5 _(optional)_ | Element-wise kernel fusion (lazy graph → generated WGSL).                                      | 2                     |
| —              | Native-WebGPU CI lane (Deno or Dawn).                                                          | parallel with 1       |

Phases 1–2 are the minimum that delivers value (coverage + residency). Phase 3
(FFT) is the largest single piece. Phase 5 is speculative.

---

## 11. Risks & open questions

- **Maintenance cost.** WGSL is a second shading language to maintain alongside
  the AssemblyScript WASM kernels. Each numerical kernel now has up to four
  implementations (JS, WASM, worker, WGSL).
- **Is f32 acceptable?** If most MathTS users need f64, the GPU path stays a
  niche opt-in and the ROI is low.
- **Target environment.** If MathTS is primarily server/Node, WebGPU is unused
  in the main runtime and only the fallback ever runs there.
- **Browser variance.** WebGPU is recent; capability and performance differ
  across Chrome / Safari / Firefox and across hardware.
- **Open question.** Should `GpuArray` be a public API type, or stay internal
  behind the `gpu*` functions? Public enables user-controlled fusion; internal
  keeps the surface small.

---

## 12. Recommendation

Build the unified WebGPU path **only if** MathTS is targeting browser-hosted
workloads that do _sustained, large, compute-bound_ numerical work — big dense
linear algebra, large or batched FFTs, ML-style pipelines — where f32 precision
is acceptable and data can stay resident across many operations.

**Do not** build it if the primary target is Node/server (WebGPU absent),
if typical problem sizes are small (transfer-bound — the worker pool already
wins), or if the team cannot commit to maintaining a WGSL kernel set.

If it is pursued, **Phases 1–2 alone** (shader library + `GpuArray` residency)
are the honest minimum viable slice: they make the existing `gpu*` matrix
functions genuinely composable. Phase 3 (FFT) should be a separate, explicitly
funded effort. Until then, the existing opt-in `gpuMatmul` / `gpuAdd` /
`gpuTranspose` / `gpuScale` functions remain the supported WebGPU surface, and
the worker pool remains the default acceleration path.

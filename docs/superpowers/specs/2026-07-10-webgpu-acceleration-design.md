# WebGPU Acceleration — Design

**Date:** 2026-07-10
**Status:** Reviewed (brainstorming → design; Adam + Eve adversarial review, both SHIP-WITH-CHANGES, incorporated). First implementation slice: **Spec 1a** below.

## Goal

Add WebGPU as a **third acceleration tier** behind the existing WASM (`*Dispatch` bridges)
and parallel (`computePool`) tiers, so data-parallel MathTS work can run on the GPU in the
browser. This is an **epic**, decomposed below; this document is the overall design plus the
detailed **Spec 1a** (the first, GPU-free refactor slice). Specs 1b and 2+ are sketched here
and each gets its own spec/plan when reached.

## Decisions (settled — do not relitigate)

1. **Precision = f32 fast path, explicit opt-in.** GPU-accelerated ops return **f32** results;
   the default f64 API stays exact (JS/WASM). The opt-in signal is the **input type**: a
   `Float32Array` input is GPU-eligible; a `Float64Array` input stays on the exact path.
   Correctness is tested within f32 tolerance. _(Verified feasible: `Float32Array` is already a
   registered typed-function type with a guard — `core/src/typed/mathts-typed.ts:166,263` — and
   **no function has a `Float32Array` signature today** (greenfield, no collision), and there is
   **no `Float32Array→Float64Array` conversion** in `MATHTS_CONVERSIONS` (`:282+`), so an f32
   input is never silently coerced onto the exact path.)_ **Honesty note:** wiring a function
   for GPU DOES add a new `Float32Array` signature to it — that is real (if type-driven) API
   surface, not "no new API."

2. **Foundation home = a new `@danielsimonjr/mathts-gpu` leaf package.** The WebGPU
   device/context/buffers/shaders foundation moves out of `matrix/src/backends/gpu/` into a
   shared leaf that **matrix** and **functions** both depend on → **one shared GPU device**
   library-wide. CDG: `matrix → gpu`, `functions → gpu`, gpu depends on nothing back → no cycle.

3. **First GPU proof = matmul routing** (not elementwise). Elementwise-unary is memory-bound —
   a single op is pure upload/readback transfer tax; the repo already retired elementwise from
   the WASM backend as 0.2–6× _slower_, and WGSL transcendentals have fuzzy f32 oracles. matmul
   is compute-bound (O(n³)/O(n²)), its kernel + the `tools/benchmark/gpu/bench-3way.*` page
   already exist, so it's an honest, winnable, testable proof of the infra end-to-end.

4. **Enable flag** = a global `enableGpu()` / `isGpuEnabled()` (mirrors the existing
   `isWasmEnabled()` on the typed instance), OFF by default. "The browser flag."

## Architecture

```
@danielsimonjr/mathts-gpu   (leaf: GPUContext[shared device] · BufferPool · ShaderManager[generic] · detect)
        ↑                        ↑
     matrix                   functions
  (GPUBackend + builtin       (*GpuDispatch bridges: matmul routing first,
   matmul/transpose WGSL,       then fused-chain / reductions / FFT kernels)
   registered at init)
```

- **Tier dispatch** (per typed function, mirrors the WASM pattern): try GPU **iff**
  `isGpuEnabled()` **and** input is `Float32Array` **and** `n ≥ GPU_THRESHOLD`; else fall to the
  existing wasm/parallel/JS path. GPU is orthogonal to the f64 WASM tier (they never compete —
  different input types).
- **`*GpuDispatch` bridges are `async` and never-throw**: return `Promise<Float32Array|null>`;
  `null`/any failure (no device, device lost, kernel error) → the caller falls through to JS-f32.
  This mirrors the wasm bridge's null-on-any-failure (`functions/src/wasm/elementwise/wasm-bridge.ts:52`).
  Async is a non-issue: the array-typed overloads are **already async** (`functions/src/typed/arithmetic.ts:206,476`).
- **CDG `webgpu-pairing` report** already scans for the `*GpuDispatch` marker → the acceleration
  coverage auto-populates as functions are wired.

## Decomposition

| Spec   | Scope                                                                                                              | GPU? | CI                                            |
| ------ | ------------------------------------------------------------------------------------------------------------------ | ---- | --------------------------------------------- |
| **1a** | Extract `mathts-gpu`; rewire matrix `GPUBackend`; harden shared device. **No behavior change.**                    | none | ✅ headless-green                             |
| **1b** | `enableGpu()` flag + **Float32 matmul routing** via matrix `BackendManager`; bench proof.                          | yes  | dispatch-logic headless; kernel browser-gated |
| **2+** | functions `*GpuDispatch`: fused elementwise chain first, then reductions → FFT → the ~28 GPU-friendly special fns. | yes  | same split                                    |

Rationale (both reviewers): 1a is a pure refactor, fully verifiable in headless CI, de-risking
the package boundary + shared device + 0-cycle gate **before** any browser-only GPU code. It
holds the safe 80% out of hostage to the unproven 20%.

---

## Spec 1a — Extract `@danielsimonjr/mathts-gpu` (the first slice to plan)

**Goal:** move the WebGPU foundation into a shared leaf package with matmul still working and
the repo fully green in headless CI. No new GPU behavior, no flag, no functions changes.

**What to extract** (from `matrix/src/backends/gpu/` → `gpu/src/`):

- `GPUContext.ts` (shared device/adapter lifecycle), `BufferPool.ts`, `detect.ts`, and the
  **generic** half of `ShaderManager.ts` (pipeline compile/cache/dispatch infra).
- **Split `ShaderManager`** (Adam, code-verified `ShaderManager.ts:47-181`): the generic
  compile/cache/pool infra moves to `gpu`; the **`BUILTIN_SHADERS` matmul/transpose/reduce WGSL
  strings stay in matrix** and are registered by `GPUBackend` at init via the gpu package's
  registration API. `gpu` ships zero domain kernels.
- **Do NOT extract `BatchExecutor.ts` or `Sync.ts`** yet (YAGNI — unused by matmul; ~23KB of
  surface deferred until a consumer needs them).

**Breaking-change handling** (Adam, code-verified `matrix/src/index.ts:21` → `backends/index.ts:34-79`):
the GPU foundation is currently **publicly re-exported** from `@danielsimonjr/mathts-matrix`.
Extraction is therefore a **breaking change to matrix's public surface**. Mitigate:

- Keep `GPUContext` / `GPUBackend` / `getGlobalGPUContext` / `getGlobalGPUBackend` /
  `GPUCapabilities` **re-exported from matrix** (now re-exporting from `mathts-gpu`) for
  back-compat, so no downstream consumer breaks.
- **matrix changeset = minor** (new dep + surface reshuffle, back-compat preserved).
  **New `gpu` package changeset = the initial `0.1.0`** (publishes). No cycle, so `changeset
version` stays clean.

**Shared-device hardening** (Adam, `GPUContext.ts:105-107`): `GPUContext.initialize()` currently
**throws `'Already initializing'`** on a concurrent second call. The shared `getGpuDevice()`
singleton must **cache and await a single in-flight `Promise<GPUDevice|null>`** so two consumers
(matrix + functions) racing the first call both await it; on device-lost/error it resolves to
`null` (never throws).

**Package shape:** `gpu/package.json` (ESM, `type:module`, tsup `--dts`), depends only on
`@webgpu/types` (dev) — a true leaf. matrix already has `@webgpu/types`. Wire `gpu` into the
workspace list, turbo, and matrix's dep + tsconfig references. **1a touches only `gpu` + `matrix`
— `functions` is untouched** (its `@webgpu/types` + GPU bridges land in Spec 2).

**Gates (Spec 1a):** `npm run typecheck` (all pass), `npm run build`, `npm run test` (matrix
suite green — matmul/decompositions unchanged), `npm run docs:deps` → **0 cycles, 0 new dormant**
(`matrix → gpu`, no back-edge), `eslint .` = 0. **No GPU execution needed** — this slice is a
pure refactor; the existing matrix tests (which run matmul on JS/WASM, GPU skipped in Node) stay
green.

**Out of scope for 1a:** the flag, any `*GpuDispatch`, any functions change, any new kernel.

---

## Spec 1b — GPU tier proof via matmul (sketch)

`enableGpu()`/`isGpuEnabled()` on the typed instance; a `Float32Array` matmul signature routes
through matrix's `BackendManager` to the shared GPU device (existing `GPUBackend.matmul`,
`matrix/src/backends/GPUBackend.ts:253`). **Dispatch logic** (flag gating, threshold, fallback
when GPU absent) unit-tested headless (Node → `hasWebGPU()` false → falls to JS/WASM).
**Kernel correctness** validated in-browser via the `bench-3way` page (already has JS/WASM
columns): f32 result vs a JS f32 reference within tolerance, + speedup at n ≥ 512. Never-throw
dispatch on device-lost.

## Spec 2+ — functions kernels (sketch)

The functions-tier `*GpuDispatch` integration. **First kernel = a fused elementwise chain**
(e.g. `exp(sin(x))`) — upload-once/readback-once amortizes transfer, so it can beat WASM (the
WASM side already mirrors this shape via `elementwiseChainDispatch`, `wasm-bridge.ts:74`),
_unlike_ single-op elementwise. Then reductions → FFT → the ~28 GPU-friendly special functions
(deferred — small arrays, transfer-dominated, low value).

## Testing strategy (whole epic)

- **Headless CI:** the dispatch logic of every wired function — flag gating, threshold,
  never-throw fall-through when GPU is unavailable — runs in the normal vitest suite (GPU is
  absent in Node → the JS-f32 path is exercised).
- **Browser release-gate:** GPU **kernel** correctness (WGSL, upload/readback, buffer lifecycle)
  is validated in a real browser via the `bench-3way` page + the `claude-in-chrome` plugin,
  comparing f32 results to a JS f32 oracle within tolerance. This is an explicit release-gate
  step, not ad-hoc. _We do NOT add a native Dawn/Node-WebGPU dep (rejected earlier — heavy,
  platform-fragile, install-script/security override)._ Acknowledged soft spot: the risk-bearing
  kernel code is not in headless CI; the browser gate is the compensating control.

## Error handling

- `*GpuDispatch` and the shared device are **never-throw**: any failure (no adapter, device
  lost via `GPUContext` `status:'lost'` / `onuncapturederror`, kernel error) → `null` → the
  typed function falls through to the exact/parallel/JS path. GPU is always a best-effort fast
  path, never a hard dependency.

## Non-goals / out of scope

- f64 emulation on GPU (double-single) — rejected (slow, complex).
- Auto-converting `Float64Array` inputs to f32 — no; the caller must pass `Float32Array` to
  opt in. f64 stays exact.
- A native Node WebGPU (Dawn) runtime dep — rejected.
- The ~28 special functions as an early target — deferred (low value at their array sizes).

## Review record

Adversarial design review by **Adam** (feasibility/correctness) and **Eve** (scope/value),
both **SHIP-WITH-CHANGES**, all findings incorporated above:

- Proof kernel changed elementwise → matmul (both HIGH: elementwise proves GPU loses).
- Spec split into 1a (refactor, CI-green) + 1b (GPU proof) (both).
- Extraction re-scoped as a breaking change + ShaderManager split + BatchExecutor/Sync cut (Adam/Eve).
- Shared-device singleton hardened (cache+await; `GPUContext.initialize` throw) (Adam).
- Testing story made explicit (headless dispatch + browser kernel gate; no Dawn) (both).
- "No new API surface" corrected; reconciled with `ROADMAP.md:81` "Unified f32 WebGPU path —
  not pursued" (this supersedes it) (Eve).
- Validated: f32-by-input-type is greenfield/clean; async is a non-issue; CDG cycle claim holds.

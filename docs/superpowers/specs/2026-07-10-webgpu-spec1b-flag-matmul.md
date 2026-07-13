# WebGPU Spec 1b — Enable Flag + Float32 matmul GPU proof

**Date:** 2026-07-10
**Status:** **RETIRED / re-scoped after Adam+Eve review** (see "Review record + RE-SCOPE" at the end). The `enableGpu()` flag + threshold work moved to Spec 2 (its real home); what ships now is a small honest slice — fix the preexisting never-throw bug on the GPU matmul path + accurate `functions.md` docs. Kept as the design record of why. Supersedes the Spec 1b sketch in `2026-07-10-webgpu-acceleration-design.md`.
**Parent epic:** `docs/superpowers/specs/2026-07-10-webgpu-acceleration-design.md` (Spec 1a shipped: `@danielsimonjr/mathts-gpu` foundation).

## Goal

Make the GPU a **real, opt-in acceleration path for matrix multiply**: a global `enableGpu()` flag (OFF by default) that, when on, routes large-enough matrix multiplies to the shared WebGPU device (f32), falling back transparently to JS/WASM otherwise. This is the first honest, end-to-end GPU proof of the epic's tier — dispatch logic verified in headless CI, kernel correctness browser-gated.

## Reality check (recon vs the epic's 1b sketch)

The epic sketch said "a `Float32Array` matmul signature routes through matrix's `BackendManager` to the shared GPU device." Reconnaissance against the actual code found that path does **not** exist and cannot be used as-is:

1. **`BackendManager` GPU routing is dead.** `matrix/src/backends/register-backends.ts` registers only `jsBackend` + `wasmBackend`; `gpuMatrixBackend` is **never** `backendRegistry.register()`-ed, so `backendRegistry.has('gpu')` in `BackendManager.selectBackend` is always `false`. And `BackendManager.multiply` is **synchronous** — GPU is inherently async, so it can't route there without an API break.
2. **The GPU matmul proof already largely exists.** `functions/src/typed/gpu.ts` exports `gpuMatmul(a, b)` → `gpuMatrixBackend.multiplyAsync` (`matrix/src/backends/GPUMatrixBackend.ts:287`), which already: converts to `Float32Array`, gates on `shouldUseGPU(elementCount ≥ minElements)`, runs `GPUBackend.matmul` (WGSL), and falls back to `jsBackend.multiply` on any failure. It is exported (`functions` barrel) and has a Node fallback test (`functions/tests/gpu.test.ts`) + a browser smoke test.
3. **No flag gates it.** `gpuMatmul` self-selects purely on `hasWebGPU()` + size — there is no `enableGpu()`/`isGpuEnabled()` anywhere. The `isWasmEnabled()` precedent the sketch cited is **dormant** (it lives in the forked `typed-function` dep; nothing in MathTS calls `initTypedWasm`/`isTypedWasmAvailable`).
4. **Three un-unified GPU thresholds.** `GPUMatrixBackend` uses `minElements: 65536` (256²); `Backend.ts` `DEFAULT_BACKEND_HINTS.gpuThreshold: 100000`; `BackendManager` `operationThresholds.multiply.gpu: 50000`. Only the first is on the live path; the other two are dead defaults on the dead BackendManager GPU route.
5. **Shared device already shared (cosmetically disconnected).** `GPUBackend.initialize()` uses `getGlobalGPUContext()` directly; the 1a `getGpuDevice()` singleton wraps the _same_ `getGlobalGPUContext()`. So they already share one device — `getGpuDevice()` just adds concurrent-init coalescing. No rewire is required for correctness; wiring `GPUBackend` to `getGpuDevice()` is optional consistency, deferred (YAGNI) unless a concrete race appears.

**Consequence:** Spec 1b is smaller and different than sketched. It does **not** build BackendManager GPU routing. It adds the flag, gates the _existing_ GPU matmul path on it, unifies the threshold, and adds headless dispatch-logic tests. The `Float32Array`-by-input-type opt-in from the epic is deferred to **Spec 2** (elementwise, where a flat typed array is the natural input); for matmul the opt-in signal is the **flag + a `DenseMatrix`/`Array` large enough to clear the threshold**.

## Decisions

1. **Flag lives in the `gpu` leaf.** New `gpu/src/flag.ts`: `enableGpu()`, `disableGpu()`, `isGpuEnabled()` — a module-level boolean, **OFF by default**. Re-exported from `gpu/src/index.ts`, then from `matrix` (via `backends/gpu/index.ts`) and consumed by `functions`. Rationale: the flag is the shared GPU foundation's concern; both matrix and functions read it, and `gpu` is the common leaf they both already depend on (core does not depend on gpu, so the dormant typed-instance location is out).
2. **The flag is a hard gate on the GPU path.** GPU engages **iff** `isGpuEnabled()` AND `hasWebGPU()` AND `elementCount ≥ GPU_MIN_ELEMENTS`. Flag off ⇒ the JS/WASM path always, even in a browser. This makes the GPU path explicitly opt-in (the epic's "browser flag").
3. **matmul is the proof (unchanged from epic).** Gate the existing `gpuMatmul` + its 3 siblings (`gpuAdd`/`gpuTranspose`/`gpuScale`) on `isGpuEnabled()`; wire `GPUMatrixBackend.shouldUseGPU` to also require the flag.
4. **Unify the GPU threshold at root.** One canonical `GPU_MIN_ELEMENTS = 65536` (256², the live value) exported from the `gpu` leaf. `GPUMatrixBackend` consumes it; the dead `Backend.ts` `gpuThreshold: 100000` and `BackendManager` `multiply.gpu: 50000` are reconciled to reference/equal it (RFL root-cause: no fourth constant, no divergent dead defaults).
5. **Browser kernel validation deferred** (per user): headless CI tests the dispatch logic (flag/threshold/fallback); f32 kernel correctness is a browser release-gate via `tools/benchmark/gpu/bench-3way.*` + claude-in-chrome.

## Architecture

```
gpu (leaf)  ── flag.ts: enableGpu/disableGpu/isGpuEnabled + GPU_MIN_ELEMENTS
   ↑                        ↑
 matrix                  functions
 GPUMatrixBackend.shouldUseGPU()   gpuMatmul/gpuAdd/gpuTranspose/gpuScale
   now also requires isGpuEnabled()   (already flag-gated transitively via the backend)
```

- **Gate point (single source of truth):** `GPUMatrixBackend.shouldUseGPU(elementCount)` becomes `isGpuEnabled() && this.backend?.isReady && elementCount >= GPU_MIN_ELEMENTS`. Because `gpuMatmul`/`gpuAdd`/`gpuTranspose`/`gpuScale` all route through this backend, gating it here flag-gates all four in one place (no per-function flag checks).
- **Never-throw preserved:** the existing `executeWithFallback(gpuThunk, jsThunk)` in `GPUMatrixBackend` already catches GPU errors → JS. Unchanged.
- **f32 precision:** unchanged — the GPU path is f32; `gpuMatmul` already documents this; callers wanting f64 use `multiply`.

## Components / changes

| File                                                   | Change                                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gpu/src/flag.ts` (new)                                | `enableGpu()`/`disableGpu()`/`isGpuEnabled()` (module `let gpuEnabled = false`) + `GPU_MIN_ELEMENTS = 65536`.                                                  |
| `gpu/src/index.ts`                                     | Re-export the flag surface + `GPU_MIN_ELEMENTS`.                                                                                                               |
| `matrix/src/backends/gpu/index.ts`                     | Re-export the flag surface from the gpu package (matrix public surface superset).                                                                              |
| `matrix/src/backends/GPUMatrixBackend.ts`              | `shouldUseGPU` also requires `isGpuEnabled()`; `minElements` sourced from `GPU_MIN_ELEMENTS`.                                                                  |
| `matrix/src/backends/Backend.ts` / `BackendManager.ts` | Reconcile the dead `gpuThreshold: 100000` / `multiply.gpu: 50000` to reference `GPU_MIN_ELEMENTS` (unify; no behavior change on the live path).                |
| `functions/src/typed/gpu.ts`                           | No logic change needed (gating is in the backend); update the doc-comment to note the `enableGpu()` opt-in. Optionally re-export the flag for discoverability. |
| tests                                                  | New headless dispatch tests (below).                                                                                                                           |
| docs                                                   | `docs/reference/functions.md` — add the `enableGpu()` opt-in note to the WebGPU section + the honest "browser-gated" caveat; CHANGELOG; TODO; ROADMAP.         |

## Testing

**Headless (vitest, Node — GPU absent):**

- `isGpuEnabled()` is `false` by default; `enableGpu()` flips it; `disableGpu()` clears it.
- With the flag ON but no `navigator.gpu` (Node), `gpuMatmul` still returns the correct product via JS fallback (existing `gpu.test.ts` assertion holds) — proving never-throw fallthrough.
- `GPUMatrixBackend.shouldUseGPU(n)` returns `false` when the flag is off (even if a device were ready) and when `n < GPU_MIN_ELEMENTS`. (Unit-test the gate directly with the flag toggled; the backend's `isReady` is false in Node so this isolates the flag+threshold logic.)
- Threshold unification: `GPU_MIN_ELEMENTS === 65536` and the reconciled constants reference it.

**Browser release-gate (deferred, per user):** `bench-3way` page + claude-in-chrome — f32 `gpuMatmul` vs a JS f32 oracle within tolerance at n ≥ 256, and a speedup check. Documented as a release-gate step, not headless CI.

## Error handling

Unchanged and preserved: `GPUMatrixBackend.executeWithFallback` catches any GPU error and returns the JS result; `getGpuDevice()`/`GPUContext.initialize()` are never-throw (Spec 1a). The flag never causes a throw — off simply means "JS path."

## Non-goals (Spec 1b)

- No `*GpuDispatch` bridge, no elementwise/reductions/FFT — that is **Spec 2**.
- No `Float32Array`-by-input-type typed signature on `multiply` (deferred to Spec 2's elementwise, where a flat array is the natural input).
- No registration of `gpuMatrixBackend` into `BackendManager` / no async `BackendManager.multiply` (the dead sync route stays dead; not worth an API break for a path `gpuMatmul` already covers).
- No `GPUBackend`→`getGpuDevice()` rewire (already shares the same global context; cosmetic, YAGNI).
- No browser CI / native Dawn.

## CDG / coverage note

The 4 `gpu*` functions are standalone helpers, **not** `mathTyped` typed-dispatch entries, so CDG's `webgpu-pairing` (which tracks the 218 typed functions for `*GpuDispatch`) still reports 0 after 1b — correctly. The typed-layer count populates in **Spec 2** when the first `*GpuDispatch` bridge lands. `functions.md` will document the 4 flag-gated GPU ops honestly as a separate standalone surface with the browser-gated + f32 caveats.

## Review record + RE-SCOPE (2026-07-10)

Adversarial review by **Adam** (feasibility) and **Eve** (scope/value), both **SHIP-WITH-CHANGES**, **converging** that the flag does not belong in a standalone 1b:

- **Adam HIGH — flag bypassed on device init (a real preexisting bug):** `functions/src/typed/gpu.ts:22-26` `ensureGpu()` calls `gpuMatrixBackend.initialize()` guarded only by `isAvailable()` (`hasWebGPU()`), NOT any flag; `GPUMatrixBackend.doInitialize()` **throws** on failure (`GPUMatrixBackend.ts:96,105,111,119`) and is **not** wrapped by `executeWithFallback` (`:134-145`). So `gpuMatmul` can already reject out of a device-init failure in a browser — the "GPU is best-effort, never-throw" contract is violated today, independent of any flag. **This is a preexisting root-cause bug to fix.**
- **Adam HIGH — the headless flag test is vacuous:** `shouldUseGPU` is private and returns false via `backend === null` in Node regardless of flag/threshold, so the specified flag-gate assertions test nothing without a mock-ready-backend seam.
- **Eve HIGH — default-OFF flag silently regresses the working `gpuMatmul`** in browsers (CI can't see it) — a mislabeled behavior change to a published export.
- **Eve HIGH — the flag's real home is Spec 2** (implicit `*GpuDispatch` typed-dispatch routing, where a caller invokes `multiply`/`add` and might get f32 GPU — there a default-OFF opt-in is essential). The explicit `gpu*` helpers are already opt-in by name; gating them adds ceremony + the regression.
- **Both — threshold "unification" is scope creep** into matrix's public `Backend.ts`/`BackendManager.ts` surface for **dead** constants (the gpu backend is never registered). Adam also found MORE dead divergent gpu thresholds (10000/200000/`Math.max(1000)`/`config.ts`) than the 3 cited — a partial unify wouldn't even satisfy the stated goal.

### Decision (re-scope)

**This standalone "Spec 1b" is retired.** Its pieces are redistributed:

1. **The `enableGpu()`/`isGpuEnabled()` flag + `GPU_MIN_ELEMENTS` + threshold reconciliation → moved to Spec 2**, where the first implicit `*GpuDispatch` typed-dispatch consumer justifies a default-OFF global opt-in and makes the flag observable/testable.
2. **What ships NOW as a small, honest, headless-verifiable slice (this doc's residue):**
   - **Fix the preexisting never-throw bug** (Adam HIGH #1): make the GPU matmul path (`gpuMatmul`/`gpuAdd`/`gpuTranspose`/`gpuScale` via `ensureGpu`) truly never-throw — a device-init failure must degrade to the JS fallback, not reject. Root-cause fix in `functions/src/typed/gpu.ts` (guard `ensureGpu()` init in try/catch so a throw leaves `backend` null → `shouldUseGPU` false → JS path) and/or make `GPUMatrixBackend.initialize()` never-throw. Headlessly testable via the existing Node-fallback test + a new "init failure still returns the correct product" test using an injected failing backend.
   - **Honest documentation** (the user's original ask): update `docs/reference/functions.md` so the 4 `gpu*` helpers are documented accurately — f32 precision, **browser-only** (no GPU in Node → CPU fallback), routing through matrix's **experimental** GPUBackend, and NOT part of the CDG-tracked typed-dispatch layer (0 of 218 typed functions are GPU-accelerated; the WebGPU tier populates in Spec 2).
3. **No flag, no threshold edits, no BackendManager changes in this slice** (Eve's scope + regression concerns fully honored).

The matmul GPU kernel itself already exists and already works in-browser; its f32 correctness validation stays a deferred browser release-gate (per the user's "headless now, browser-gate later" choice).

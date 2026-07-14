---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-matrix': minor
---

Fix a 12× JS conversion tax on the GPU path, and correct the acceleration tier order.

**The bug.** `elementwiseChainGpuDispatch` converted its input with
`Float32Array.from(f64array)`. That is not the typed-array fast path — it is the generic
`Array.from` algorithm, which walks the source through the ArrayLike/iterator protocol and
runs `ToNumber` on every element. Naming the denominators, since they differ:

- the **conversion alone** was **73× slower** — 433.32 ms versus 5.92 ms for
  `new Float32Array(x)` at n=2²⁰, for an identical result;
- which made the **end-to-end dispatch 12.2× slower** — **439.80 ms → 36.06 ms** once fixed.

Three sites were paying it, all on typed-array inputs: the f64→f32 input conversion, the
f32→f64 conversion on the way back out, and `jsChain`'s copy — that last one slowing the
**JS fallback tier for every user**, GPU or not.

**The consequence.** That inflated figure is what made WASM appear to beat the GPU, and
`functions@0.18.0` shipped a `fuseUnaryChainAsync` tier order of WASM → GPU → JS on the
strength of it. With the tax removed the GPU is **3.2–8.3× faster than WASM**, so the order
is now **GPU → WASM → JS**.

**What changes for you.** Only if you call `enableGpu()`. That flag is the f32-precision
consent, and the GPU tier will now actually run — so results carry ~7 significant digits
instead of full f64, and are several times faster. With the flag off (the default) the path
is exactly WASM → JS and results are bit-identical f64, as before. No result was ever
incorrect; this is a performance and tier-selection change.

⚠️ **The blast radius of the process-global flag grew.** Previously a stray `enableGpu()`
from a transitive dependency was largely harmless, because WASM ran first and shielded you.
Now it silently downgrades every chain of ≥65,536 elements to f32. If that matters, pass
`{ gpu: false }` per call — it overrides the global — or call `disableGpu()`.

**matrix** (minor, not patch): the exported `DEFAULT_BACKEND_HINTS.gpuThreshold` changes
100,000 → 65,536 and `DEFAULT_EXTENDED_HINTS.operationThresholds.transpose.gpu` 200,000 →
65,536, so all GPU thresholds single-source `GPU_MIN_ELEMENTS`. The route is dormant in-tree
(no `'gpu'` backend is ever registered), but `backendRegistry.register()` is public, so a
consumer registering `GPUMatrixBackend` would see different routing.

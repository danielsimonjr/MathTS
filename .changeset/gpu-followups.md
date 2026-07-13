---
'@danielsimonjr/mathts-functions': minor
---

**GPU element-wise tier: correctness, ergonomics, and architecture follow-ups.**

- **Domain edges now match JS exactly.** WGSL leaves `log(x<=0)`, `atanh(|x|>=1)` and
  division-by-zero **indeterminate** — an implementation may return anything, and zeros
  in real data are common. The kernels now pin IEEE semantics, so `log(0)` is `-Infinity`
  and `atanh(2)` is `NaN` on every device, not just the one we happened to test. (The old
  oracle test _skipped non-finite expectations_, so this was structurally invisible.)
  Subtlety: the NaN/±Inf bit patterns ride in a **uniform** — WGSL const-folds
  `bitcast<f32>(0x7fc00000u)` even inside a function body and then rejects the result
  ("value nan cannot be represented as 'f32'").
- **`fuseUnaryChainAsync` now always returns `Float64Array`** (was
  `Float64Array | Float32Array`). That union was a footgun: `.map`/`.filter`/`.set` on it
  are TS2349 errors, so _every_ caller had to `instanceof`-narrow, and
  `new Float64Array(r.buffer)` silently produced garbage on the f32 branch. When the GPU
  runs, the values carry f32 precision inside the f64 container. Callers who want the raw
  f32 buffer can call `elementwiseChainGpuDispatch` directly.
- **Per-call `{ gpu }` override.** `enableGpu()` is process-global mutable state — any
  dependency flipping it changed _your_ call. `fuseUnaryChainAsync(ops, xs, { gpu })` and
  `elementwiseChainGpuDispatch(..., { gpu })` are now self-describing.
- **Uses the `mathts-gpu` foundation it was meant to.** The dispatcher had built a private
  pipeline cache and raw `createBuffer` calls, using neither the `ShaderManager` nor the
  `BufferPool` extracted for exactly this. It now uses both: pipelines are compiled **once**
  (no per-call shader compile) and buffers are **recycled**. Pooling is only safe because the
  kernel now bounds-checks against an `n` **uniform** rather than `arrayLength(&inp)` — the
  pool rounds sizes up, so an `arrayLength` guard would have run threads past the real data.
  Net effect is also a large speedup: the GPU chain went from 30.2 ms → **10.5 ms** at
  n=65,536 and 470 ms → **306 ms** at n=1M. (WASM still wins; the tier order is unchanged.)
- Added `resetGpuElementwise()` to drop cached GPU resources.

---
'@danielsimonjr/mathts-functions': minor
---

Add the opt-in **WebGPU f32 acceleration tier** for fused element-wise chains.

- `enableGpu()` / `disableGpu()` / `isGpuEnabled()` — the GPU tier is **OFF by
  default**. Opting in is required because the GPU computes in f32 (WGSL has no
  f64), and silently changing an f64 API's precision is not something a caller
  should get by accident.
- `fuseUnaryChainAsync(ops, xs)` — async sibling of `fuseUnaryChain` that tries
  **GPU (f32) → WASM (f64) → JS (f64)**. It returns a `Float32Array` only when the
  GPU path ran, so the return type _is_ the precision contract. Added as a new
  async function rather than changing `fuseUnaryChain`'s synchronous signature.
- `elementwiseChainGpuDispatch(ops, xs)` — the never-throw bridge (returns `null`
  to fall back), mirroring the WASM `elementwiseChainDispatch` pattern.

Only a _fused chain_ is accelerated: a lone element-wise op on the GPU is pure
transfer tax, while a chain uploads once, runs every op on-device via ping-ponged
buffers, and reads back once. Measured on an NVIDIA Pascal adapter for
`sin→exp→tanh→log1p` vs the browser CPU path: **1.97x at 65,536 elements, 2.47x at
262,144, 2.30x at 1M**. The 65,536-element threshold is set from these numbers.

All 17 supported kernels are validated against JS oracles on a real GPU. `erfc` is
deliberately excluded (no WGSL builtin; approximating it would silently change the
accuracy contract) — chains containing it fall back.

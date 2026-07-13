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
`sin→exp→tanh→cos` vs the browser CPU path: **2.33x at 65,536 elements, 2.88x at
262,144, 2.54x at 1M**. The 65,536-element threshold is set from these numbers.

All 15 supported kernels are validated against JS oracles on a real GPU.
`erfc`, `expm1` and `log1p` are deliberately excluded: WGSL has no builtin for any of
them, and for expm1/log1p even the Kahan-compensated forms measured 38%/62% max
relative error near zero on real hardware (the GPU's fast-math `log()` is inaccurate
near 1.0). An f32 fast path may be less precise; it may not be wrong. Chains containing
them fall back to the exact CPU tiers.

Hardened after adversarial review: device-limit guards + a validation error scope
(a WebGPU validation error does NOT throw — it invalidates the command buffer, and the
zero-initialized staging buffer would have been returned as a silently WRONG all-zeros
result); buffer cleanup on every error path; and device-lost now clears the cached
device so the tier can recover.

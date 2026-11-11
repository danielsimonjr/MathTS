---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-parallel': minor
'@danielsimonjr/mathts-matrix': minor
---

Add a deterministic mode (issue 380). `setDeterministic(true)` from `@danielsimonjr/mathts-core` makes results bit-identical whether or not the WASM tier is loaded: only the WASM kernels measured bit-identical to JS (`abs` on a `Float64Array`) still runs, and implicit WebGPU, worker-pool parallelism, the integration and sampling fan-outs, and the WASM matrix backend are skipped. See `docs/determinism.md`.

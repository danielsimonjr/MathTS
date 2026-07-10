---
'@danielsimonjr/mathts-matrix': minor
---

Extract the WebGPU foundation (device/context, buffer pool, and a generic
shader manager) into a new shared `@danielsimonjr/mathts-gpu` leaf package.
matrix's `GPUBackend` now imports the foundation from that package and registers
its builtin matrix kernels onto the shared `ShaderManager`; the shared GPU device
is coalesced behind a single, never-throw in-flight `getGpuDevice()`. Every GPU
foundation symbol remains re-exported from `@danielsimonjr/mathts-matrix`, so no
downstream consumer breaks. Pure refactor — no behavior change.

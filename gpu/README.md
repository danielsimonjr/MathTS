# @danielsimonjr/mathts-gpu

The shared WebGPU foundation for MathTS: `GPUContext` (device/adapter
lifecycle), a shared `getGpuDevice()` singleton, `BufferPool`, `detect`
(capability probing), and a **generic** `ShaderManager` (compile/cache/pipeline
infra + a name→code shader registration API). This package ships **no domain
kernels** — matrix-specific WGSL (matmul/transpose/reduce) lives in
`@danielsimonjr/mathts-matrix`, which registers those shaders onto a
`ShaderManager` at backend init.

WebGPU is browser-only (`navigator.gpu`); in Node every entry point degrades
gracefully — `getGpuDevice()` resolves to `null` and `GPUContext.initialize()`
resolves `false` without throwing.

Tracked by CDG/DGT (`create-dependency-graph`) as a leaf: `matrix → gpu`,
`functions → gpu` (functions edge lands in a later spec), with no back-edge.

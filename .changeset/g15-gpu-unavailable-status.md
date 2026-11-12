---
'@danielsimonjr/mathts-gpu': minor
---

GPU init without an adapter now reports `GPUContext.status === 'unavailable'` instead of `'error'`, updates `hasWebGPU()` after a failed adapter probe, adds `initializeGlobalGPUWithReason()`, and makes `isGPUSuitableForMatrixOps()` safe with no arguments.

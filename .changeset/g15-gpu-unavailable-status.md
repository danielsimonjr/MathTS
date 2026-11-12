---
'@danielsimonjr/mathts-gpu': minor
---

GPU init without an adapter now reports `GPUContext.status === 'unavailable'` instead of `'error'`, updates `hasWebGPU()` after a failed adapter probe, adds `initializeGlobalGPUWithReason()`, and makes `isGPUSuitableForMatrixOps()` safe with no arguments. A rejected `requestAdapter` or `requestDevice` stays `'error'` with `lastError` set. `enableGpuUnavailableWarnings()` is off by default.

---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Internal refactor, no change in behaviour (Refs #1212): the scale, run and unscale step of the power-of-2 scaled kernels is one helper, `withPow2ScaledKernel` in `core/src/pow2-scale.ts`. Eleven call sites in `qr`, `inv`, `condest`, `logm`, `qrPivoted`, `schur` and the WASM backend use it, and each one states only how it scales the input and the result.

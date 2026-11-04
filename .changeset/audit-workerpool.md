---
'@danielsimonjr/mathts-workerpool': minor
---

The `sumChunk`, `dotChunk`, `normChunk` and `distanceChunk` kernels use the same stable accumulation as `ComputePool`'s sequential path: pairwise sum and dot, and BLAS-style scaled partials combined scale-aware for `norm` and `distance`. A parallel `norm` of a 1e200-scaled vector is now finite and matches the sequential result; sums and dots can differ in the last bits from before. `normChunk` and `distanceChunk` now return `[scale, ssq]` partials instead of a sum of squares. The copies live in `worker-numerics.ts` and are pinned bit-for-bit to core by a parity test.

Slices that a method owns are moved to the worker by transfer instead of cloned, and kernels return their fresh result buffers by transfer. `matmul`, `transpose`, `matvec` and `outer` send each task only its own row block; operands every task needs are copied once from an exact buffer. Passing a `subarray` view with a non-zero `byteOffset` (matmul, transpose, matvec, outer, distanceMatrix) no longer reads the wrong region. `matmul`, `transpose` and `matvec` validate buffer sizes; `histogram` requires a positive integer `bins`, ignores non-finite samples and handles a constant range. Length-mismatch errors read `<op>: lengths must match (<a> vs <b>)`.

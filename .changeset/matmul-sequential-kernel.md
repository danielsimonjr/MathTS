---
'@danielsimonjr/mathts-workerpool': minor
'@danielsimonjr/mathts-parallel': minor
---

New export `matmulSequential(a, aRows, aCols, b, bCols)`: the sequential row-major matrix product. `@danielsimonjr/mathts-workerpool` exports it, and `@danielsimonjr/mathts-parallel` re-exports it. The inline branch of `MathWorkerPool.matmul` (below the worker threshold) now calls it, and the synchronous `matmul` of `@danielsimonjr/mathts-functions` uses it at every size. The function throws the same shape errors as `MathWorkerPool.matmul`. The worker kernel uses the same loop order, so the results are equal bit for bit.

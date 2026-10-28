---
'@danielsimonjr/mathts-matrix': patch
---

Consolidate ParallelBackend sequential fallbacks (divide via parallelBinary, dot via jsBackend, whenParallel for scale/multiply/transpose/sum). Sparse Hadamard stays an inlined CSR walk (mapNonZeros was >10% slower at 2000×2000 nnz≈40k).

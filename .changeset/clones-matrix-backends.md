---
'@danielsimonjr/mathts-matrix': patch
---

Consolidate ParallelBackend sequential fallbacks (divide via parallelBinary, dot via jsBackend, whenParallel for scale/multiply/transpose/sum) and sparse Hadamard via mapNonZeros (clone batch B/C).

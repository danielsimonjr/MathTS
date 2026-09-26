---
'@danielsimonjr/mathts-matrix': patch
---

WASM decompositions no longer grow memory on every call. The AS binary's stub runtime never frees, and although the backend pools its input and output buffers, the kernels allocated their own scratch and LU's permutation buffer was not pooled. Over 300 calls on a 64×64 matrix, memory grew by 16 MiB for LU, 0.9 MiB for inverse, 0.4 MiB for QR and 0.1 MiB for the determinant. The backend now passes scratch buffers to the rebuilt kernels (QR's Householder vector, and inverse's permutation in `work`) and pools the permutation buffer. A regression test runs 3,000 calls of each operation and requires zero growth. Results are unchanged.

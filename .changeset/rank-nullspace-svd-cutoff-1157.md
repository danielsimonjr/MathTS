---
'@danielsimonjr/mathts-functions': patch
---

`rank` and `nullspace` of a matrix of finite numbers use a cutoff that is relative to the matrix: the number of singular values above `max(S) * max(m, n) * eps`, as NumPy `matrix_rank` counts. Before, both used the absolute pivot cutoff 1e-10. Three classes of result change:

- A small trailing singular value of a graded matrix now counts. `rank([[1e-6, 0], [0, 1e-11]])` is 2 (was 1), and `rank([[0.5, 0], [0, 5e-11]])` is 2 (was 1).
- The rounding residue of a large low-rank matrix no longer counts. The 3 x 3 product of two rank 2 factors, scaled by 2^34, has rank 2 (was 3).
- `nullspace` always has `n - rank(A)` vectors. Before, `rank` and `nullspace` of the same matrix could disagree: the product above at 2^20 had rank 2 and no null vector.

An explicit `tol` of `rank` keeps its absolute elimination, and a matrix with a NaN or infinite entry keeps the old elimination. (Refs #1157)

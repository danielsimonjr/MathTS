---
'@danielsimonjr/mathts-linalg': minor
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': minor
---

`@danielsimonjr/mathts-linalg` exports `DenseMatrix`. `lstsq(A, b)` is a new export of matrix, linalg and functions: the column-pivoted Householder QR least-squares solution of `A x ≈ b`. It accepts any shape and a vector or matrix `b`, and returns the minimum-norm solution for rank-deficient or wide input, as NumPy does. The rectangular `lsolve` error names `lstsq`.

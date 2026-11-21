---
'@danielsimonjr/mathts-expression': patch
---

Safe evaluate returns a matrix of the matrix package. Before, it refused the matrix as a host object, so `inv(A)`, `pinv(A)` and `transpose(A)` threw for a DenseMatrix or SparseMatrix `A` in scope. Safe evaluate accepts the typed arrays that hold the entries of such a matrix. A typed array that stands alone, or sits in any other value, stays refused. (Refs #1036)

---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` throws `RangeError: Dimension mismatch` for a right-hand side of more than one column, on every input kind (Fixes #1231). `lusolve`, `lsolve` and `usolve` solve one column vector, as in mathjs. Before, `lusolve([[2,1],[1,3]], [[1,2],[3,4]])` with an Array `A` returned `[[0],[1]]`, the solution of column 1 only, and dropped column 2. This held for an Array, DenseMatrix or SparseMatrix `b`. A DenseMatrix or SparseMatrix `A` already threw `Dimension mismatch`. A 1-D DenseMatrix `b` of the wrong length now throws too.

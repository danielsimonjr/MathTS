---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` with an Array `A` and a right-hand side of more than one column throws `RangeError: Dimension mismatch` (Fixes #1231). `lusolve`, `lsolve` and `usolve` solve one column vector, as in mathjs, and every input kind now rejects extra columns. The prior results on main: `lusolve([[2,1],[1,3]], [[1,2],[3,4]])` returned `[[-0.4],[1.4]]` and dropped column 2, for an Array, DenseMatrix or SparseMatrix `b`. A wrong-length `b` of a 1-D DenseMatrix `b` is also checked. A DenseMatrix or SparseMatrix `A` already threw `Dimension mismatch`.

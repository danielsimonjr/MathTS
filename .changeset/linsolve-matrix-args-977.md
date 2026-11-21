---
'@danielsimonjr/mathts-functions': patch
---

`linsolve` accepts a DenseMatrix, a SparseMatrix or a MathJS matrix as `A`. It accepts a vector, an `n x 1` column, a DenseMatrix of one column or one row, or a MathJS matrix as `b`. Before, a DenseMatrix `b` gave `NaN`, a MathJS matrix `b` gave `dimension mismatch`, and a DenseMatrix `A` threw `reading 'length'`. A `b` of another shape, such as `n x 2`, now throws a TypeError that names the accepted shapes. (Refs #977)

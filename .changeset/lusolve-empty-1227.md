---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` of an empty system no longer throws "Linear system cannot be solved since matrix is singular". A 0 x 0 system has the empty solution. `lusolve([], [])` returns `[]`. For a `DenseMatrix` or `SparseMatrix` `A` (also with `order` and `threshold`), and for an `lup`/`slu` style factor object with 0 x 0 factors, it returns a 0 x 1 `DenseMatrix`. The right-hand side can be `[]` or `matrix([])`. An empty input that is not square (`[[]]`, `matrix([[]])`, `sparse([[]])`, factors that are 1 x 0) throws the same dimension error as a non-empty non-square input. A right-hand side of the wrong length still throws `Dimension mismatch`. Non-empty systems are unchanged.

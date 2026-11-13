---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-linalg': patch
---

`linsolve`, `lsolve` and `lu` / `luSolve` accept a `SparseMatrix` from `@danielsimonjr/mathts-matrix`. The sparse input is densified with `toDense()` before the solve. The shared decomposition input also accepts a `SparseMatrix`, so `qr`, `eig`, `svd` and `cholesky` densify it too. Previously these threw `Cannot read properties of undefined (reading 'length')`, `m.size is not a function` or a shape error.

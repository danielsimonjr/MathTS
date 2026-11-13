---
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-linalg': minor
---

`linsolve`, `lsolve` and `lu` / `luSolve` accept a `SparseMatrix` from `@danielsimonjr/mathts-matrix`. The sparse input is densified with `toDense()` before the solve; `usolve`, `lsolveAll` and `usolveAll` do the same. `densifyForSolver(input, { maxElements })` is the one helper behind them: it tests the input by shape, so it works with a second copy of the matrix package, and it throws a `RangeError` above `maxElements` (default 4096 x 4096). The shared decomposition input also accepts a `SparseMatrix`, so `qr`, `eig`, `svd` and `cholesky` densify it too. Previously these threw `Cannot read properties of undefined (reading 'length')`, `m.size is not a function` or a shape error.

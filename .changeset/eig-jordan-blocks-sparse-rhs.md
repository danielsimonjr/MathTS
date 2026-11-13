---
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': patch
---

`eig().repeatedEigenvalues` finds Jordan blocks of size 3 and more: a cluster of `m` eigenvalues links up to `2 * eps^(1/m) * ||A||_F` and is accepted when an orthogonal staircase of column-pivoted QR factorizations counts the multiplicity `m`. Distinct eigenvalues at the same spacing are not grouped.

Breaking: `eig` and `eigvals` throw a `RangeError` on `NaN` or infinite input. Previously they returned `null` eigenvalues.

`eig`, `svd`, `qr`, `cholesky`, `lu`, `lstsq` and `condest` accept a `SparseMatrix` from a second loaded copy of the package, and the element limit of `densifyForSolver` applies to them. `lsolve`, `usolve`, `lsolveAll`, `usolveAll` and `lusolve` accept a matrix-package `SparseMatrix` as the right-hand side.

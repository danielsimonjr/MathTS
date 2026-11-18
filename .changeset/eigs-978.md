---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
---

`eigs` returns the eigenvector of a complex eigenvalue as `Complex` entries, so that `A v = lambda v` holds. Before, the vector held only the real part and was wrong (Fixes #978). The vector of a real eigenvalue stays a `number[]`. The doc comment of `eig` now says that `vectors[k]` is a row, not a column.

Value change: `eigs(A).eigenvectors[k].vector` is `Complex[]` when `eigenvectors[k].value` is a `Complex`.

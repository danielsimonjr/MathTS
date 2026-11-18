---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': patch
---

`eigs` returns the eigenvector of a complex eigenvalue as `Complex` entries, so that `A v = lambda v` holds. Before, the vector held only the real part and was wrong (Fixes #978). When one eigenvalue is complex, every eigenvector holds `Complex` entries, as in mathjs; the vector of a real eigenvalue then has zero imaginary parts. A real spectrum keeps `number[]` vectors. The doc comment of `eig` now says that `vectors[k]` is a row, not a column.

Value change: `eigs(A).eigenvectors[k].vector` is `Complex[]` for every `k` when any eigenvalue is a `Complex`.

---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-tensor': patch
'@danielsimonjr/mathts-autograd': patch
---

`expm` of a matrix returns a matrix of the same class and storage. Before, `expm(matrix(A))` returned a native `DenseMatrix` with no `size` method, and `expm(sparse(A))` returned an Array. Now a dense matrix gives a dense matrix, a sparse matrix gives a sparse matrix of its own kind, and an Array gives an Array. A matrix with one or three dimensions now throws the square error with its real size. A matrix that is not square throws a `RangeError` at every site, as in mathjs; before, the same rule threw a plain `Error` at some sites. Each message stays the same, and a `catch` of `Error` still catches the error. `pinv`, `re`, `im`, `arg` and `setDistinct` of a matrix give a matrix (they gave an Array); `pinv([])` is `[]`, and a 1-D matrix gives a 1-D result. (Refs #1264)

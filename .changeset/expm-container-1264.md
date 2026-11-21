---
'@danielsimonjr/mathts-functions': patch
---

`expm` of a matrix returns a matrix of the same class and storage. Before, `expm(matrix(A))` returned a native `DenseMatrix` with no `size` method, and `expm(sparse(A))` returned an Array. Now a dense matrix gives a dense matrix, a sparse matrix gives a sparse matrix of its own kind, and an Array gives an Array. A matrix with one or three dimensions now throws the square error with its real size. (Refs #1264)

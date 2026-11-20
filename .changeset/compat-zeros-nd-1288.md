---
'@danielsimonjr/mathts-compat': patch
---

`zeros` and `ones` take an Array size, three or more sizes and a format, as in mathjs. `zeros([2, 3, 2])` is a 2 x 3 x 2 Array, `zeros(2, 3, 2)` is a matrix of size [2, 3, 2], `zeros([])` is `[]` and `zeros(2, 2, 'sparse')` is a sparse matrix. `zeros(n)` is still a `number[]` and `zeros(r, c)` is still a native DenseMatrix. (Fixes #1288)

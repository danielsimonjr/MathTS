---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` judges each pivot against the scale of its own row of the factorization, not against one scale of the whole matrix. `lusolve([[1e10, 0], [0, 1e-7]], [1, 1])` threw `Linear system cannot be solved since matrix is singular`: the pivot 1e-7 is below 1e-15 times the largest entry 1e10. It now returns `[[1e-10], [1e7]]`, as mathjs 15.2.0 does, for an Array, a DenseMatrix, a SparseMatrix (with `lup` and with `slu`) and a factorization from `lup`. The row scale comes from `L` and `U` together: the larger of the largest entry of the row of `U` and the products `|L[i][k]|` times the largest entry of row `k` of `U`. So `[[1, 2], [2, 4]]` and `[[1, 2], [2, 4 + 1e-15]]` still throw. A pivot that is small against the multipliers that built it also throws, which makes the test stricter than before for a matrix with large element growth. (Refs #1287)

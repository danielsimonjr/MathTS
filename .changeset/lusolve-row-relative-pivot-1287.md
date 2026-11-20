---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` judges each pivot against the terms that cancelled in it, not against one scale of the whole matrix. `lusolve([[1e10, 0], [0, 1e-7]], [1, 1])` threw `Linear system cannot be solved since matrix is singular`: the pivot 1e-7 is below 1e-15 times the largest entry 1e10. It now returns `[[1e-10], [1e7]]`, as mathjs 15.2.0 does, for an Array, a DenseMatrix, a SparseMatrix (with `lup` and with `slu`) and a factorization from `lup`. The scale of the pivot `U[i][i]` comes from `L` and `U`: the largest product `|L[i][k] * U[k][i]|` for `k < i`. The floor is `8 * n * eps` times that scale, and `linsolve` uses the same rule. So `[[1, 2], [2, 4]]` and `[[1, 2], [2, 4 + 1e-15]]` still throw, and the test does not change when a row or a column is multiplied by a constant: `lusolve([[1e12, 1e-5], [1e12, 2e-5]], [[1], [2]])` threw and now returns `[[0], [1e5]]`. (Refs #1287)

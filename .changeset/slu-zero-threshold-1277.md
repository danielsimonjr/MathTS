---
'@danielsimonjr/mathts-functions': patch
---

`slu` and `lusolve(sparse, b, order, threshold)` with the pivot threshold 0 never take a zero diagonal entry as the pivot. The test `|x[col]| >= max * threshold` reads `0 >= 0` for the threshold 0, so a zero diagonal entry won although the column had a nonzero entry. Before, on main, `slu(sparse([[0, 1], [1, 0]]), 0, 0)` returned an `L` with `Infinity` and a `U` with `-Infinity`, and `lusolve` of it threw the singular-matrix error. `lusolve` now returns `[[2], [1]]`. A singular matrix, such as `[[1, 2, 3], [0, 0, 0], [4, 5, 7]]`, throws the singular-matrix error of `slu` at the threshold 0 too. (Refs #1277)

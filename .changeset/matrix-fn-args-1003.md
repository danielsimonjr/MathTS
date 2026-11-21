---
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': patch
---

`lstsq` reads `b` with `readRightHandSide`, so a DenseMatrix, SparseMatrix, typed-array, BigNumber or numeric-string `b` gives the solution. Before, a typed-array or BigNumber `b` gave zeros. `matrixExpm`, `matrixLogm` and `matrixSqrtm` accept a nested array, a SparseMatrix and a MathJS matrix, as the decompositions do. The decomposition reader and the `new DenseMatrix(rows, cols, array)` constructor now throw a TypeError for an entry that is not a number. Before, a string entry became NaN or a number. The matrix package exports `nestedMatrixShape`. (Refs #1003)

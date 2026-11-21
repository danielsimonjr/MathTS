---
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': patch
---

`lstsq` reads `b` with `readRightHandSide`, so a DenseMatrix, SparseMatrix, typed-array or numeric-string `b` gives the solution. Before, a typed-array `b` gave zeros. A BigNumber, Fraction or Complex entry of `b` throws a TypeError that names the type (a BigNumber `b` gave zeros before). `matrixExpm`, `matrixLogm` and `matrixSqrtm` accept a nested array, a SparseMatrix and a MathJS matrix, as the decompositions do. The decomposition reader applies the implicit rule of mathjs: a numeric string, a boolean and null convert, and a non-numeric string throws `Cannot convert` (before, it became NaN). The `new DenseMatrix(rows, cols, array)` constructor throws a TypeError for an entry that is not a number. The matrix package exports `nestedMatrixShape`. (Refs #1003)

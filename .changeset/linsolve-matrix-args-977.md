---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-core': minor
---

`linsolve` accepts a DenseMatrix, a SparseMatrix or a MathJS matrix as `A`. It reads `b` with the new matrix-package reader `readRightHandSide`: a vector, a typed array of numbers, an `n x 1` column, a DenseMatrix or SparseMatrix of one column or one row, or a MathJS matrix. An entry of `b` converts to a number as in mathjs `lusolve` (numeric string, boolean, BigNumber, Fraction, null). A non-numeric string throws `Cannot convert`, and an array inside a vector, a Complex or an undefined entry throws a TypeError. Core exports `convertToNumber` and `isNumberTypedArray` from `/internal`. (Refs #977)

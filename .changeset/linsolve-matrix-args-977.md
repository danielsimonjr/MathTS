---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-core': minor
---

`linsolve` accepts a DenseMatrix, a SparseMatrix or a MathJS matrix as `A`. It reads `b` with the new matrix-package reader `readRightHandSide`: a vector, a typed array of numbers, an `n x 1` column, a DenseMatrix or SparseMatrix of one column or one row, or a MathJS matrix. Entries of `A` and `b` follow the implicit rule of mathjs `lusolve`: a numeric string, a boolean, null and undefined convert (null and undefined are 0), and a non-numeric string throws `Cannot convert`. A BigNumber, Fraction or Complex entry is solved by the typed `lusolve`, and the result keeps that type, as in mathjs. An array inside a vector throws a TypeError. Core exports `convertToNumber` (number, string, boolean, bigint) and `isNumberTypedArray` from `/internal`; the matrix package exports `implicitNumber` and `isTypedScalar`. (Refs #977)

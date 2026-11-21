---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

`lstsq` accepts a DenseMatrix `b`. `matrixExpm`, `matrixLogm` and `matrixSqrtm` accept a nested array, a SparseMatrix and a MathJS matrix, as the decompositions do. Before, `matrixExpm([[0, 1], [0, 0]])` threw `A.toArray is not a function`. The functions package re-exports `lstsq`, and its `linsolve` accepts a DenseMatrix `A` (see #977). (Refs #1003)

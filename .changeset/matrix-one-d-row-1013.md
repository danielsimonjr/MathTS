---
'@danielsimonjr/mathts-matrix': patch
---

`matrix([1, 2])`, `DenseMatrix.fromArray([1, 2])` and `new DenseMatrix([1, 2])` give a 1 x n row matrix. Before, they threw "DenseMatrix nested array must be a non-empty rectangular array of numbers". An empty array still throws, and a mix of numbers and rows throws a rectangular error. (Refs #1013)

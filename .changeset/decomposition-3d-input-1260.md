---
'@danielsimonjr/mathts-matrix': patch
---

A matrix decomposition throws for a nested array that is not two dimensional. Before, `qr`, `qrPivoted`, `lu`, `cholesky`, `svd`, `lq`, `rq`, `ql`, `eig`, `lstsq`, `condest`, `matrixSchur` and the other functions that take a nested array checked each row and not its entries. They returned a factorization of `[[[1], [2]]]`, of two 2 x 2 layers and of a row that mixes numbers and Arrays. Now a tensor throws `RangeError: Matrix must be two dimensional (size: [1, 2, 1])`, and a row that mixes numbers and Arrays throws the jagged `TypeError` of that row. A first row that mixes an Array and a number, such as `[[[1], 2], [3, 4]]`, also throws the jagged `TypeError`. The shape check `nestedMatrixShape` holds the depth test, so `lusolve` gets it too. The check converts no entry. (Refs #1260)

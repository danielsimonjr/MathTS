---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Normalize decomposition inputs: `svd`, `lu`, `qr`, `cholesky`, `eig`, and `matrixSchur` accept `DenseMatrix`, nested arrays, square `Float64Array`, and `{ data, rows, cols }`; ragged and unknown inputs throw `TypeError`. `lusolve` accepts square packed `Float64Array` and that descriptor, and still accepts an `{ L, U, p }` decomposition.

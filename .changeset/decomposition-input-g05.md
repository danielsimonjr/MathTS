---
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
---

Normalize decomposition inputs: `svd` and `lu` accept `DenseMatrix`, nested arrays, square `Float64Array`, and `{ data, rows, cols }`; unknown types throw `TypeError`. `lusolve` accepts square packed `Float64Array`.

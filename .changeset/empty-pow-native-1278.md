---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`pow` of a 0 x 0 matrix returns a 0 x 0 matrix of the same kind: `pow([], 2)` is `[]`, and a Matrix gives a Matrix. Before, the call threw `TypeError`. A 0 x 3 matrix throws the square `RangeError`, and the exponent rule (a non-negative integer) holds for an empty matrix too. `pow` and `sqrtm` of a non-empty Matrix now return a Matrix, as mathjs does (a sparse matrix gives a dense matrix); an Array still gives an Array. A call of the `compat` adapter with a native `DenseMatrix` now returns a public `DenseMatrix` for a result with a zero dimension, where it returned `[]` or threw: `sqrtm`, `sylvester`, `kron`, `inv`, `map`, `larger`, `equal` and the factors of `qr`. (Refs #1278)

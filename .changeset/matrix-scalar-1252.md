---
'@danielsimonjr/mathts-functions': patch
---

`matrix` throws `TypeError` for a scalar (`matrix(5)`, `matrix(bignumber(5))`, `matrix(complex(1, 2))`, `matrix(0)`, `matrix(null)`), as mathjs does (Fixes #1252). Before, `matrix(5)` returned a dense matrix with no `_size`, so `qr`, `lup`, `eigs`, `schur` and `trace` threw `TypeError: Cannot read properties of undefined (reading 'length')`, and `lusolve`, `lsolve`, `usolve`, `det`, `inv` and `sqrtm` threw `TypeError: this._size is not iterable`; `expm` threw `reading '0'`. `matrix(0)` and `matrix(null)` returned an empty matrix. `matrix()`, `matrix([])`, `matrix('sparse')` and array input are unchanged.

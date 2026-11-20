---
'@danielsimonjr/mathts-functions': patch
---

`subset`, `reshape` and `resize` of a dense matrix read every axis, not the first two. A scalar index drops its axis, so `subset(d3, index(1, 0, 1))` is a number and `subset(d3, index(0, [0, 1], 1))` has size [2]. A wrong number of indices throws the mathjs `DimensionError`, and an index out of range throws an `IndexError`. `subset` assignment writes every selected entry of a 3-D matrix and broadcasts a replacement to the shape of the selection. `reshape` of a matrix with three or more axes keeps the values, and a size with the wrong number of entries throws `Dimension mismatch`. (Refs #1155)

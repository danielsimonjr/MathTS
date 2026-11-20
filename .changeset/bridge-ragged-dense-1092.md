---
'@danielsimonjr/mathts-functions': patch
---

`matrix([[1], [2, 3]])` and every other ragged nested array throw the RangeError "Dimension mismatch", as mathjs does. Before, the matrix kept rows of different lengths. Compat `matrix`, the expression `matrix(...)` and `fft` of such a matrix give the same error. (Refs #1092, #1273)

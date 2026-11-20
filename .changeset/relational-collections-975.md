---
'@danielsimonjr/mathts-functions': patch
---

`equal`, `unequal`, `smaller`, `larger`, `smallerEq`, `largerEq` and `compare` take an Array, a dense matrix and a sparse matrix, element by element, with the values and the result storage of the mathjs port. Before, six of them threw `TypeError` for a collection and `unequal` of two collections gave one boolean. `sqrt`, `log` and the other element-wise functions of `unaryCollection` keep the class of a factory matrix (dense or CSC) when an entry leaves the real domain: `sqrt` of a CSC matrix with a `-1` entry is a CSC matrix with Complex `i` there, where it was a plain Array. `sqrt(matrix([4, -1]))` of a 1-D matrix gave `[2, NaN]` and now gives `2` and `i`. `dotDivide` of a sparse zero matrix by an Array is a sparse zero matrix, as in mathjs (documented). `unequal` of two Units compares the quantity, as `equal` does: `unequal(unit('1 m'), unit('100 cm'))` was `true` and is now `false`. (Refs #975)

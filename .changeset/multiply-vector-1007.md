---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`multiply` takes a 1-D operand, as mathjs does. A vector times a vector is the scalar product (`multiply([1, 2], [3, 4])` is 11, and it conjugates a Complex entry of the left vector, as `dot` does). A matrix times a vector and a vector times a matrix give a vector. A length mismatch throws `RangeError` with the mathjs text, and an operand of 3 or more dimensions throws `Error` with the mathjs text. `evaluate('[1,2]*[3,4]')` gives 11. The compat instance sends a 1-D operand to the same function: `create(all).multiply([[1, 2], [3, 4]], [1, 1])` threw `TypeError` and is now `[3, 7]`. A compat result of a 1-D matrix now has the mathjs shape, not a 1 x n row: `subtract(matrix([3, 4]), 1)` was `[[2, 3]]` and is `[2, 3]`, `multiply(matrix([1, 3, 4]), matrix([[-1], [0], [-2]]))` was `[[-9]]` and is `[-9]`, and `multiply(matrix([-3, 4, 4]), matrix([0, -4, 0]))` threw and is `-16`. A product with an empty axis follows mathjs: `multiply([[1], [2]], [[]])` threw `TypeError` and is `[[], []]`, and `multiply([[], []], [])` was `[0, 0]` and throws `TypeError`. (Refs #1007)

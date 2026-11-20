---
'@danielsimonjr/mathts-functions': patch
---

`divide` of a collection by a collection is `a * inv(b)`, as in mathjs. `divide([[1, 2], [3, 4]], [[1, 2], [3, 4]])` is the identity matrix, and `evaluate('A / B')` of two matrices works. A divisor that is not square throws `RangeError` and a singular divisor throws `Error`, with the text of `inv`. `eigs` of a defective Complex matrix multiplies the back transform by a vector or a column, which the new `multiply` accepts. (Refs #975)

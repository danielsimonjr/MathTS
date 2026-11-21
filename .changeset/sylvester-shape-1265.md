---
'@danielsimonjr/mathts-functions': patch
---

`sylvester` checks the shapes of A, B and C before it solves. A matrix A or B that is not square, and a matrix C that is not m x n, now throw `RangeError: Dimension mismatch: ...` that names the operand and its size. Before, the call threw a generic `Error` from `schur` or `multiply`, and printed a `Backend operation failed` line. (Refs #1265)

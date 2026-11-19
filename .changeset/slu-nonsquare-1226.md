---
'@danielsimonjr/mathts-functions': patch
---

`slu` of a non-empty non-square sparse matrix throws `RangeError: Matrix must be square (size: [m, n])`, the same error as `lusolve`, for every order (Fixes #1226). The CSparse LU is square-only. Use `lup` for a rectangular matrix. The empty-matrix factorization is unchanged.

Prior result, for `threshold` 1:

- 2x3 and 1x3 input: orders 0, 1 and 3 threw `Cannot read properties of null (reading 'L')`. Order 2 threw `Cannot set properties of undefined (setting '0')`.
- 3x2 and 3x1 input: orders 0, 1 and 3 threw `Unexpected type of argument in function divideScalar` (actual: undefined). Order 2 threw `Cannot set properties of undefined (setting '0')`.

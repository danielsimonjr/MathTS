---
'@danielsimonjr/mathts-functions': patch
---

`slu` of a non-empty non-square sparse matrix throws `RangeError: Matrix must be square (size: [m, n]); use lup for a rectangular matrix` for every order (Fixes #1226). The CSparse LU is square-only. The order and threshold checks still run first, and the empty-matrix factorization is unchanged. `lusolve(A, b, order, threshold)` of a non-square sparse `A` now throws the solver error `RangeError: Matrix must be square (size: [m, n]); for a rectangular least-squares system use lstsq` before it calls `slu`. That is the error of `lusolve(A, b)` of a non-square sparse `A`. This shape check runs before the order check and the threshold check.

Prior result, for `threshold` 1:

- 2x3 and 1x3 input: orders 0, 1 and 3 threw `Cannot read properties of null (reading 'L')`. Order 2 threw `Cannot set properties of undefined (setting '0')`.
- 3x2 and 3x1 input: orders 0, 1 and 3 threw `Unexpected type of argument in function divideScalar` (actual: undefined). Order 2 threw `Cannot set properties of undefined (setting '0')`.
- Order 2 throws the same `Cannot set properties of undefined` error for a square input. That error is unchanged for a square input.
- `lusolve(A, b, order, threshold)` of a 2x3 sparse `A` threw `TypeError: Cannot read properties of null (reading 'L')`.

---
'@danielsimonjr/mathts-functions': patch
---

`slu` throws `Error('Linear system cannot be solved since matrix is singular')` when the factorization finds no nonzero pivot for a column, the same error as the dense `lusolve`. Before, `slu` threw `TypeError: Cannot read properties of null (reading 'L')` (Fixes #1235). `lusolve(sparse, b, order, threshold)` with an explicit order inherits the fix.

Prior result on main, for `[[1,2],[2,4]]`, `[[1,0,0],[0,0,0],[0,0,1]]`, a matrix with a zero column and a matrix with two equal rows, with orders 0, 1, 3 and thresholds 0, 0.001 and 1: `TypeError: Cannot read properties of null (reading 'L')` from both `slu` and `lusolve`. For a zero matrix (`[[0]]`, `[[0,0],[0,0]]`) only `slu` threw the `TypeError`; `lusolve` already threw the singular `Error`. Order 2 reaches the factorization for a zero matrix and for `[[1,0,0],[0,0,0],[0,0,1]]`, and has the same fix; for the other matrices it throws `TypeError: Cannot set properties of undefined (setting '0')` from `csAmd` (a separate issue, #1239, not changed here). Dense `lusolve` and sparse `lusolve` with the default order already threw the singular `Error`.

Not changed: with threshold 0, the pivot rule can take a diagonal entry that is exactly zero, and `slu` then returns factors with a zero pivot and no error (#1277). With threshold 1, a matrix that is singular only to rounding error (`[[1,2,3],[4,5,6],[7,8,9]]`) still factorizes, as in mathjs.

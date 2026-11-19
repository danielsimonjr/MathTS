---
'@danielsimonjr/mathts-functions': patch
---

`slu` throws `Error('Linear system cannot be solved since matrix is singular')` for a singular sparse matrix, the same error as the dense `lusolve`. Before, `slu` threw `TypeError: Cannot read properties of null (reading 'L')` (Fixes #1235). `lusolve(sparse, b, order, threshold)` with an explicit order inherits the fix.

Prior result on main, for `[[1,2],[2,4]]`, `[[0,0],[0,0]]`, `[[1,0,0],[0,0,0],[0,0,1]]` with orders 0, 1, 3 and thresholds 0.001 and 1: `TypeError: Cannot read properties of null (reading 'L')` from both `slu` and `lusolve`. Order 2 on `[[1,2],[2,4]]` threw `TypeError: Cannot set properties of undefined (setting '0')` from `csAmd` (a separate issue, #1239, not changed here). Dense `lusolve` and sparse `lusolve` with the default order already threw the singular `Error`.

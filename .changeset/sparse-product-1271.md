---
'@danielsimonjr/mathts-functions': patch
---

`multiply` of two sparse matrices builds no dense matrix. The product is a column Gustavson kernel that reads the stored entries only. A pair of 2000 x 2000 CSC matrices with 0.1% extra entries took 11370 ms and now takes 8 ms. A sum that cancels to zero stays a stored entry, as in mathjs, so the structure of the product no longer depends on the values and `slu` with the AMD order gives the same column order for any values of one pattern. A zero that the matrix does not store is never multiplied, so a product with an `Infinity` entry has no `NaN`, as in mathjs. A tall left operand (more than 65536 rows, and more rows than four times the sum of its stored entries and its columns) uses a workspace of one slot for each stored row. A 1e9 x 1 matrix with one stored entry threw `RangeError` (the buffer allocation failed) and now multiplies, as in mathjs. (Refs #1271)

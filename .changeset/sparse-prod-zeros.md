---
'@danielsimonjr/mathts-functions': patch
---

The sparse matrix `forEach` visits every element by default, column by column, as mathjs does. It visits only the stored entries when `skipZeros` is true. The sparse matrix `map` does the same, and it does not store a result that equals zero. This fixes `prod` of a sparse matrix with an implicit zero (it is now 0), `matrixFromFunction(size, fn, 'sparse')` (it returned zeros and did not call `fn`), `math.forEach` and `math.map` of a sparse matrix, and elementwise functions with a non-zero value at zero, such as `log10`, `log2`, `bitNot`, `factorial` and `not` (#985).

---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`matrix(data, format)` checks its format, as in mathjs. A format other than `'dense'`, `'default'` or `'sparse'` throws `Unknown matrix type "foo".` (a boolean is read as a string), and a format that is not a string or boolean throws a `TypeError`. `matrix(sparseMatrix, 'dense')` and `matrix(sparseMatrix, 'default')` return a dense matrix with the same entries; before, they returned the sparse matrix. `matrix(m)` of a matrix, and `matrix(data)` of an Array, give a copy, as in mathjs. (Refs #1284)

---
'@danielsimonjr/mathts-functions': patch
---

`slu` of an empty sparse matrix no longer throws an internal error (`Cannot transpose a 2D matrix with no columns` for an input with no columns at order 1, 2 or 3; other internal errors for an input with no rows and one or more columns). For an m x n input with k = min(m, n), it returns an empty factorization with the shapes `lup` uses: `L` is m x k, `U` is k x n, `p` is the identity on the m rows, and `q` is the identity on the n columns (`null` for order 0). An input with no columns at order 0 did not throw: it returned 0 x 0 factors and an empty `p` whatever its row count, and now returns these shapes too. Validation of `order` and `threshold` still runs first.

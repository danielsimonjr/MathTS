---
'@danielsimonjr/mathts-functions': patch
---

`slu` of an empty sparse matrix no longer throws `Cannot transpose a 2D matrix with no columns`. For an m x n input with k = min(m, n), it returns an empty factorization with the shapes `lup` uses: `L` is m x k, `U` is k x n, `p` is the identity on the m rows, and `q` is the identity on the n columns (`null` for order 0). Validation of `order` and `threshold` still runs first.

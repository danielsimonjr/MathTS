---
'@danielsimonjr/mathts-functions': patch
---

`lup` of an empty matrix returns the factor shapes `L` m x k and `U` k x n (k = min(m, n)), with `p` the identity on the m rows, as `slu` and `qr` do. `lup(matrix([]))` gave an `L` with size `[0, undefined]` and a `U` with size `[undefined, undefined]`; both are now `[0, 0]`. An input with rows and no columns (`[[]]`, `[[], [], []]`) lost the row count of `L` in `valueOf()` and in the Array result (`L` was `[]`); `L` is now `[[]]` or `[[], [], []]`. `U` of those inputs stays `[]` (0 x 0). Sparse and 0 x n inputs are unchanged.

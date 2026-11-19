---
'@danielsimonjr/mathts-functions': patch
---

`qr` of an empty matrix (`[]`, `[[]]`, `matrix([])`, `m x 0`, `0 x n`, dense or sparse) returns the complete factorization (Q is the m x m identity, 0 x 0 when m is 0; R has the input size) and no longer throws an internal error. Fixes #1205.

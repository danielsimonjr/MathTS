---
'@danielsimonjr/mathts-functions': patch
---

`qr` of an empty matrix (`[]`, `[[]]`, `matrix([])`, `m x 0`) returns the complete factorization (Q is m x m, R is the input shape) and no longer throws an internal error. Fixes #1205.

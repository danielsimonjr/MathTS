---
'@danielsimonjr/mathts-functions': patch
---

`divide(scalar, M)` for a square matrix is `scalar * inv(M)`, as in mathjs. A non-square collection throws mathjs's RangeError (#960).

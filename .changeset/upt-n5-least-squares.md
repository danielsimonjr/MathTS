---
'@danielsimonjr/mathts-functions': patch
---

`leastSquares` equilibrates the columns before the normal equations, so a well-conditioned system with entries near 1e-9 no longer throws "singular matrix".

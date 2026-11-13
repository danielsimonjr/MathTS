---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-compat': patch
---

`evaluate('0.75 inch')` and `unit(0.75, 'inch')` store one exact value, and `60 mile/hour` agrees on both paths (#955). The `sin(200 grad)` result moves to the exact value, which is closer to sin(π) = 0.

---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

Document `gammaDist` rate parameterization and add `{ scale }` option for SciPy parity. Positional second argument remains **rate**; `gammaDist(2, { scale: 2 })` matches SciPy `stats.gamma(a=2, scale=2)`.

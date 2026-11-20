---
'@danielsimonjr/mathts-functions': patch
---

`chiSquareTest`, `kolmogorovSmirnovTest`, `mannWhitneyTest` and `shapiroWilkTest` throw when `bootstrap` is not a non-negative integer, or is above 10,000,000. `chiSquareTest` also throws when the bootstrap needs more than 1,000,000,000 draws. `fisherExact` throws a `RangeError` for an entry that is not a non-negative integer. (Refs #1154)

---
'@danielsimonjr/mathts-functions': patch
---

`chiSquareTest`, `kolmogorovSmirnovTest`, `mannWhitneyTest` and `shapiroWilkTest` throw when `bootstrap` is not a non-negative integer, or is above 10,000,000. `chiSquareTest` also throws when the bootstrap needs more than 200,000,000 draws. `fisherExact` throws a `RangeError` for an entry that is not a non-negative integer. `kolmogorovSmirnovTest`, `shapiroWilkTest` and `mannWhitneyTest` throw a `RangeError` when `bootstrap` times the sample size is above 20,000,000, 100,000,000 and 300,000,000 (pooled size) respectively: each limit is 5 to 23 s of work on the build machine, depending on its load. `chiSquareTest` with a NaN statistic gives NaN for `pValueEmpirical`, `bootstrapMean` and `bootstrapStd`, and B NaN statistics, as `mannWhitneyTest` does for a NaN sample (it gave 0). (Refs #1154)

---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-workerpool': patch
---

`std`, `corr`, `skewness`, `kurtosis`, `describe`, the factory 2-norm, `parallelStatStd`, `parallelStatNorm`, the pool `variance` and the statistics that use the same sum now compute the result again with an exact power-of-2 scale when a sum of squares is below 2^-800 or overflows. Before, subnormal squares lost digits: `std([1e-160, 3e-160])` had a relative error of 5.6e-6, and `std` of data of order 1e-170 was 0. `skewness` and `kurtosis` do the same when the third or fourth powers leave the range. `linregress`, `linearRegression`, `partialCorrelation`, the effect sizes, the t tests, `fTest`, `bartlettTest`, `jarqueBera`, `dagostinoTest`, `acf`, `pacf`, `ljungBox`, `distance2D`, `distance3D`, `distanceND` and `gaussianKDE` use the same core helpers. Core adds `SQUARES_SAFE_MIN`, `ROOT_SAFE_MIN`, `powerOfTwoBelow`, `powerOfTwoScaleOf`, `scaleForVariance`, `divideByScale` and `stdFromSquaredDeviations`. Compat `std` and `variance` now use the functions implementations: they honour the dimension argument, the variadic form and BigNumber data, as mathjs does. (Refs #1280)

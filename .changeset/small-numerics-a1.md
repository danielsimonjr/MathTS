---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-matrix': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-parallel': patch
---

Four small numeric defects.

- A number as the data argument of a stable reduction in core (`pairwiseSum`, `pairwiseDot`, `sumSquaredDeviations`, their `Checked` variants, `neumaierSum`, `neumaierCumsum`, `norm2`, `scaledDistance`, `extrema`) now throws a `TypeError` that names the function. A string, and an object whose `length` is not a non-negative integer, throw the same error. Before, `pairwiseSum(0)` and `sumSquaredDeviations(0)` threw `RangeError: Maximum call stack size exceeded`, and `norm2(5)` gave `0` (#1011).
- `numberVector` rejects a value that is not an array, typed array, array-like or iterable object. The statistics, signal and linear-algebra functions that take a number vector read a number as `[]`. Before, `zscore(5)` was `[]`, `skewness(5)` was `NaN`, `trapz(5)` was `0` and `signTest(5)` was `{ statistic: 0, pValue: 1 }`. Now each throws a `TypeError` that names the function, for example `zscore: expects an array of numbers, got a number` (#1083).
- The SVD gave wrong singular values for a matrix whose leading column entry is negative with zeros below it, because the Householder helper returned the non-orthogonal `beta = -2` for that column. Before, `norm([[-3,0],[0,1]], 2)` was `9`, and the singular values were `[9, 1]`. Now the norm is `3` and the singular values are `[3, 1]` (NumPy and mathjs). `pinv`, `lowRankApprox` and `svd` rebuild such a matrix correctly. The default `norm` of a matrix was already the spectral norm (`p = 2`), as in mathjs. A new test pins that default, and the fix above corrects its value for such a matrix: `norm([[-3,0],[0,1]])` was `9` and is `3`. `norm([[1,0],[0,2]])` is `2` (#1082, #995).
- In `parallel`, `parallelMean`, `parallelVariance` and `parallelStd` on the sequential path pass the data to `pairwiseSum` before they read its length. A number now throws the `TypeError` of core. Before, `parallelMean(1)` gave `0` (#1011).

---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-statistics': minor
---

**Statistics/probability gap-closure** (vs NumPy/SciPy, MATLAB, Mathematica — see `docs/roadmap/STATISTICS_GAP_AUDIT_2026-07-06.md`). Closes the audit's ranked P1/P2 gaps, each externally scipy-pinned:

- **Surfaced 16 already-implemented functions** in the statistics library: `linearRegression`, `polyFit`, `cummax`/`cummin`/`cumprod`, `cumtrapz`, `trapzF64`, `movingAverage`, `ewma`, `detrend`, `acf`, `logsumexp`, `softmax`, `kmeans`, `spectralClustering`, `beta`, `digamma`.
- **Regression + inference**: `linregress` (slope/intercept/r/pValue/stdErr + CI).
- **Correlation tests with p-values**: `pearsonr`, `spearmanr`, `kendalltau` → `(coefficient, pValue)`.
- **Descriptive conveniences**: `ptp`, `variation`, `describe`, `histogram`, `trimmedMean`.
- **Normality & repeated-measures tests**: `andersonDarlingTest`, `dagostinoTest`, `friedmanTest`, `anova2`, `multipleComparison`.
- **Common distributions**: `paretoDist`, `rayleighDist`, `triangularDist`, `discreteUniformDist`, `gumbelDist`, `invGaussDist`, `multivariateNormal`.
- **Resampling & CI**: `bootstrapCI`, `meanCI`, `proportionCI`, `permutationTest`.
- **Multivariate**: `mahalanobis`, `hotellingT2`.

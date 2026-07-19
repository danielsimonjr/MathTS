# @danielsimonjr/mathts-statistics

## 0.3.34

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.50.0

## 0.3.33

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.49.0

## 0.3.32

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.48.0

## 0.3.31

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.47.0

## 0.3.30

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.46.0

## 0.3.29

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.45.0

## 0.3.28

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.44.0

## 0.3.27

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.43.0

## 0.3.26

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.42.0

## 0.3.25

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.41.0

## 0.3.24

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.40.0

## 0.3.23

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.39.0

## 0.3.22

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.38.0

## 0.3.21

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.37.0

## 0.3.20

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.36.0

## 0.3.19

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.35.0

## 0.3.18

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.34.0

## 0.3.17

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.33.0

## 0.3.16

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.32.0

## 0.3.15

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.31.0

## 0.3.14

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.30.0

## 0.3.13

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.29.0

## 0.3.12

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.28.0

## 0.3.11

### Patch Changes

- Updated dependencies [1174c41]
  - @danielsimonjr/mathts-functions@0.27.0

## 0.3.10

### Patch Changes

- Updated dependencies [199da08]
  - @danielsimonjr/mathts-functions@0.26.0

## 0.3.9

### Patch Changes

- Updated dependencies [000679d]
  - @danielsimonjr/mathts-functions@0.25.0

## 0.3.8

### Patch Changes

- Updated dependencies [397493e]
  - @danielsimonjr/mathts-functions@0.24.0

## 0.3.7

### Patch Changes

- Updated dependencies [a726fd7]
  - @danielsimonjr/mathts-functions@0.23.0

## 0.3.6

### Patch Changes

- Updated dependencies [b8bf018]
  - @danielsimonjr/mathts-functions@0.22.0

## 0.3.5

### Patch Changes

- Updated dependencies [ea044c4]
  - @danielsimonjr/mathts-functions@0.21.0

## 0.3.4

### Patch Changes

- Updated dependencies [b7784ef]
  - @danielsimonjr/mathts-functions@0.20.0

## 0.3.3

### Patch Changes

- Updated dependencies [abbe883]
  - @danielsimonjr/mathts-functions@0.19.0

## 0.3.2

### Patch Changes

- Updated dependencies [7c53d7f]
  - @danielsimonjr/mathts-functions@0.18.0

## 0.3.1

### Patch Changes

- Updated dependencies [2353e0a]
- Updated dependencies [908f19b]
  - @danielsimonjr/mathts-functions@0.17.0

## 0.3.0

### Minor Changes

- 557e27f: **Statistics/probability gap-closure** (vs NumPy/SciPy, MATLAB, Mathematica — see `docs/roadmap/STATISTICS_GAP_AUDIT_2026-07-06.md`). Closes the audit's ranked P1/P2 gaps, each externally scipy-pinned:

  - **Surfaced 16 already-implemented functions** in the statistics library: `linearRegression`, `polyFit`, `cummax`/`cummin`/`cumprod`, `cumtrapz`, `trapzF64`, `movingAverage`, `ewma`, `detrend`, `acf`, `logsumexp`, `softmax`, `kmeans`, `spectralClustering`, `beta`, `digamma`.
  - **Regression + inference**: `linregress` (slope/intercept/r/pValue/stdErr + CI).
  - **Correlation tests with p-values**: `pearsonr`, `spearmanr`, `kendalltau` → `(coefficient, pValue)`.
  - **Descriptive conveniences**: `ptp`, `variation`, `describe`, `histogram`, `trimmedMean`.
  - **Normality & repeated-measures tests**: `andersonDarlingTest`, `dagostinoTest`, `friedmanTest`, `anova2`, `multipleComparison`.
  - **Common distributions**: `paretoDist`, `rayleighDist`, `triangularDist`, `discreteUniformDist`, `gumbelDist`, `invGaussDist`, `multivariateNormal`.
  - **Resampling & CI**: `bootstrapCI`, `meanCI`, `proportionCI`, `permutationTest`.
  - **Multivariate**: `mahalanobis`, `hotellingT2`.

### Patch Changes

- Updated dependencies [557e27f]
  - @danielsimonjr/mathts-functions@0.16.0

## 0.2.0

### Minor Changes

- f691f6c: **`@danielsimonjr/mathts-statistics` is now a comprehensive statistics & probability library.** Previously it re-exported only the narrow `parallelStat*` reductions (~23 names). It now surfaces the full statistics/probability domain as a focused, standalone package (~100 exports), curated over `@danielsimonjr/mathts-functions`:

  - **Descriptive statistics** — `mean`/`median`/`mode`/`variance`/`std`/`quantileSeq`/`mad`/`iqr`/`sem`/`zscore`/`moment`/`skewness`/`kurtosis`/`gmean`/`hmean`/`cov`/`corr`/`corrcoef`/`rankdata`, and all three correlations `corr` (Pearson) / `spearman` / `kendallTau`.
  - **Probability distributions** — 14 distribution objects (`normalDist` … `hypergeometricDist`, `negativeBinomialDist`) with `.pdf/.cdf/.quantile/.mean/.variance/.sample`, plus free CDF/quantile functions and `entropy`/`jsDivergence`.
  - **Hypothesis tests** — `studentTTest`, `studentTTestPaired`, `anova`, `chiSquareTest`, `kolmogorovSmirnovTest` + `kolmogorovSmirnov2Test`, `mannWhitneyTest`, `shapiroWilkTest`, `leveneTest`, `bartlettTest`, `proportionZTest`, `binomialTest`, `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`, `tukeyHSD`, `principalComponentAnalysis`.
  - **Probability & combinatorics** — `combinations`/`permutations`/`multinomial`/`factorial`/`doubleFactorial`/`risingFactorial`/`fallingFactorial`/`subfactorial`/`bernoulli`/`gamma`/`lgamma`/`kldivergence` + seedable RNG.

  Every function is externally-oracle-pinned (SciPy/NumPy/mpmath/closed-form) in the functions package's suite. Implementations are re-exported, not duplicated.

## 0.1.16

### Patch Changes

- Updated dependencies [86f786e]
  - @danielsimonjr/mathts-functions@0.15.0

## 0.1.15

### Patch Changes

- Updated dependencies [1df691c]
- Updated dependencies [f2211c8]
  - @danielsimonjr/mathts-functions@0.14.0

## 0.1.14

### Patch Changes

- Updated dependencies [598e72d]
- Updated dependencies [ce8f929]
  - @danielsimonjr/mathts-functions@0.13.0

## 0.1.13

### Patch Changes

- Updated dependencies [779fcde]
- Updated dependencies [5f3b401]
  - @danielsimonjr/mathts-functions@0.12.0

## 0.1.12

### Patch Changes

- Updated dependencies [dc14440]
- Updated dependencies [18871e1]
  - @danielsimonjr/mathts-functions@0.11.0

## 0.1.11

### Patch Changes

- Updated dependencies [dfb1b25]
- Updated dependencies [23642f2]
  - @danielsimonjr/mathts-functions@0.10.0

## 0.1.10

### Patch Changes

- Updated dependencies [c041b4e]
- Updated dependencies [82bb0b1]
  - @danielsimonjr/mathts-functions@0.9.0

## 0.1.9

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.8.0

## 0.1.8

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.7.0

## 0.1.7

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.6.0

## 0.1.6

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.5.0

## 0.1.5

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.4.0

## 0.1.4

### Patch Changes

- Updated dependencies
  - @danielsimonjr/mathts-functions@0.3.0

## 0.1.3

### Patch Changes

- Switch inter-package dependencies from exact pins to caret (`^`) ranges so compatible patch releases of MathTS packages propagate without a full-tree republish.

## 0.1.2

### Patch Changes

- Matched-set repin to `@danielsimonjr/mathts-core@0.1.4` (adds BigNumber `toBinary`/`toOctal`/`toHexadecimal`) and updated internal pins.

## 0.1.1

### Patch Changes

- Re-pin `@danielsimonjr/mathts-functions` to `0.2.5` (special-function fixes) for the matched set.

## 0.1.0

### Minor Changes

- Initial release. Exposes the MathTS statistics functions as a focused package that re-exports the 23 `statistics` typed-function operations from `@danielsimonjr/mathts-functions` (pinned `0.2.4`). Not a copy.

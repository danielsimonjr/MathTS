# @danielsimonjr/mathts-statistics

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

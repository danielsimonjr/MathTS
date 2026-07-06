---
'@danielsimonjr/mathts-statistics': minor
---

**`@danielsimonjr/mathts-statistics` is now a comprehensive statistics & probability library.** Previously it re-exported only the narrow `parallelStat*` reductions (~23 names). It now surfaces the full statistics/probability domain as a focused, standalone package (~100 exports), curated over `@danielsimonjr/mathts-functions`:

- **Descriptive statistics** — `mean`/`median`/`mode`/`variance`/`std`/`quantileSeq`/`mad`/`iqr`/`sem`/`zscore`/`moment`/`skewness`/`kurtosis`/`gmean`/`hmean`/`cov`/`corr`/`corrcoef`/`rankdata`, and all three correlations `corr` (Pearson) / `spearman` / `kendallTau`.
- **Probability distributions** — 14 distribution objects (`normalDist` … `hypergeometricDist`, `negativeBinomialDist`) with `.pdf/.cdf/.quantile/.mean/.variance/.sample`, plus free CDF/quantile functions and `entropy`/`jsDivergence`.
- **Hypothesis tests** — `studentTTest`, `studentTTestPaired`, `anova`, `chiSquareTest`, `kolmogorovSmirnovTest` + `kolmogorovSmirnov2Test`, `mannWhitneyTest`, `shapiroWilkTest`, `leveneTest`, `bartlettTest`, `proportionZTest`, `binomialTest`, `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`, `tukeyHSD`, `principalComponentAnalysis`.
- **Probability & combinatorics** — `combinations`/`permutations`/`multinomial`/`factorial`/`doubleFactorial`/`risingFactorial`/`fallingFactorial`/`subfactorial`/`bernoulli`/`gamma`/`lgamma`/`kldivergence` + seedable RNG.

Every function is externally-oracle-pinned (SciPy/NumPy/mpmath/closed-form) in the functions package's suite. Implementations are re-exported, not duplicated.

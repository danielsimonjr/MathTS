# @danielsimonjr/mathts-statistics

**Statistics & probability** for [MathTS](https://github.com/danielsimonjr/mathts) — a focused,
standalone library covering descriptive statistics, probability distributions, hypothesis tests,
and combinatorics.

The implementations live in
[`@danielsimonjr/mathts-functions`](https://www.npmjs.com/package/@danielsimonjr/mathts-functions)
and are **re-exported here, not duplicated** — this package is a curated entry point over the
statistics/probability surface. Every function is **externally oracle-pinned** (SciPy / NumPy /
mpmath / closed form) in the functions package's test suite, so the numbers are trustworthy, not
just green.

## Install

```sh
npm install @danielsimonjr/mathts-statistics
```

## What's included

- **Descriptive statistics** — `mean`, `median`, `mode`, `variance`, `std`, `quantileSeq`, `mad`
  (median absolute deviation), `iqr`, `sem`, `zscore`, `moment`, `skewness`, `kurtosis`, `gmean`,
  `hmean`, `cov`, `corr`, `corrcoef`, `rankdata`, `ptp`, `trimmedMean`, `variation`, `describe`,
  `logsumexp`, `softmax`, `detrend`, `movingAverage`, `ewma`, `acf`, and the correlation helpers
  `pearsonr`, `spearman`, `spearmanr`, `kendalltau` / `kendallTau`.
- **Parallel reductions** — `parallelStat*` helpers mirror the typed reductions on `Float64Array`;
  most op thresholds in `ComputePool` are `'never'` today (inline JS), but the API stays
  `async`-friendly where the typed layer returns a `Promise`. `quickSelect` / `medianSelect` /
  `minSelect` / `maxSelect` are synchronous selection utilities.
- **Regression & resampling** — `linearRegression`, `polyFit`, `linregress`, `pearsonr`,
  `spearman`, `spearmanr`, `kendalltau`, `meanCI`, `proportionCI`, `bootstrapCI`,
  `permutationTest`, `mahalanobis`, `hotellingT2`, `kmeans`, `spectralClustering`.
- **Probability distributions** — distribution objects with `.pdf/.cdf/.quantile/.mean/.variance/.sample`
  (`normalDist`, `gammaDist`, `betaDist`, `binomialDist`, `poissonDist`, `exponentialDist`,
  `chiSquaredDist`, `fDist`, `tDist`, `logNormalDist`, `uniformDist`, `weibullDist`,
  `hypergeometricDist`, `negativeBinomialDist`, `paretoDist`, `rayleighDist`, `triangularDist`,
  `discreteUniformDist`, `gumbelDist`, `invGaussDist`, `multivariateNormal`), plus free CDF/quantile
  functions, `studentizedRangeCDF` / `studentizedRangeQuantile`, and `entropy` / `jsDivergence`.
- **Hypothesis tests** — `studentTTest` (one/two-sample), `studentTTestPaired`, `anova`, `anova2`,
  `chiSquareTest`, `kolmogorovSmirnovTest` + `kolmogorovSmirnov2Test`, `mannWhitneyTest`,
  `shapiroWilkTest`, `leveneTest`, `bartlettTest`, `proportionZTest`, `binomialTest`, `fTest`,
  `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`, `tukeyHSD`, `andersonDarlingTest`,
  `dagostinoTest`, `friedmanTest`, `multipleComparison`, `principalComponentAnalysis`.
- **Probability & combinatorics** — `combinations`, `combinationsWithRep`, `permutations`,
  `multinomial`, `factorial`, `doubleFactorial`, `risingFactorial`, `fallingFactorial`,
  `subfactorial`, `bernoulli`, `gamma`, `lgamma`, `kldivergence`, and seedable RNG (`random`,
  `randomInt`, `pickRandom`, `seedProbabilityRng`).

## Example

```ts
import {
  anova,
  kendallTau,
  hypergeometricDist,
  kolmogorovSmirnov2Test,
} from '@danielsimonjr/mathts-statistics';

anova([
  [8.1, 8.3, 7.9],
  [9.1, 9.5, 8.9],
]); // one-way ANOVA F + p
kendallTau([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]); // 0.6
hypergeometricDist(50, 5, 10).pdf(1); // 0.4313371972
kolmogorovSmirnov2Test([1, 2, 3], [2, 3, 4]); // { statistic, pValue }
```

## License

MIT

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

- **Descriptive statistics** — `mean`, `median`, `mode`, `variance`, `std`, `quantileSeq`, `mad`,
  `iqr`, `sem`, `zscore`, `moment`, `skewness`, `kurtosis`, `gmean`, `hmean`, `cov`, `corr`,
  `corrcoef`, `rankdata`, and the three correlation coefficients `corr` (Pearson), `spearman`,
  `kendallTau` (τ_b).
- **Parallel-first reductions** — worker-pool-accelerated `parallelStat*` (`Mean`, `Variance`,
  `Std`, `Median`, `Quantile`, `Histogram`, `Corr`, …) plus `quickSelect`/`medianSelect`.
- **Probability distributions** — 14 distribution objects with
  `.pdf/.cdf/.quantile/.mean/.variance/.sample` (`normalDist`, `gammaDist`, `betaDist`,
  `binomialDist`, `poissonDist`, `exponentialDist`, `chiSquaredDist`, `fDist`, `tDist`,
  `logNormalDist`, `uniformDist`, `weibullDist`, `hypergeometricDist`, `negativeBinomialDist`),
  plus free CDF/quantile functions and the `entropy`/`jsDivergence` divergences.
- **Hypothesis tests** — `studentTTest` (one/two-sample), `studentTTestPaired`, `anova`,
  `chiSquareTest`, `kolmogorovSmirnovTest` (one-sample) + `kolmogorovSmirnov2Test` (two-sample),
  `mannWhitneyTest`, `shapiroWilkTest`, `leveneTest`, `bartlettTest`, `proportionZTest`,
  `binomialTest`, `fTest`, `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`, `tukeyHSD`,
  `principalComponentAnalysis`.
- **Probability & combinatorics** — `combinations`, `permutations`, `multinomial`, `factorial`,
  `doubleFactorial`, `risingFactorial`, `fallingFactorial`, `subfactorial`, `bernoulli`, `gamma`,
  `lgamma`, `kldivergence`, and seedable RNG (`random`, `randomInt`, `pickRandom`,
  `seedProbabilityRng`).

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
hypergeometricDist(50, 5, 10).pmf(1); // 0.4313371972
kolmogorovSmirnov2Test([1, 2, 3], [2, 3, 4]); // { statistic, pValue }
```

## License

MIT

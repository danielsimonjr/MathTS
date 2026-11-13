# @danielsimonjr/mathts-statistics

**Statistics & probability** for [MathTS](https://github.com/danielsimonjr/mathts) — a focused,
standalone library covering descriptive statistics, probability distributions, hypothesis tests,
and combinatorics.

Every name this package exports is implemented in `@danielsimonjr/mathts-functions`. This package does not define a second copy of a distribution.

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

## Conventions (NumPy / pandas)

- **`variance` / `std` / `cov` and `ddof`:** `{ ddof: k }` divides by `n - k` (NumPy). `k` is any non-negative integer: `0` is population, `1` is sample (the default), `2` divides by `n - 2`. When `k >= n` the result is `NaN`. The mathjs strings `'uncorrected' | 'unbiased' | 'biased'` remain accepted. Passing a string and `{ ddof }` that name different divisors throws `TypeError`. The string `'unbiased'` on a single finite value stays mathjs's `0`; `{ ddof: 1 }` on that input is `NaN`.
- **Missing data:** `mean` / `median` / `variance` / `std` propagate `NaN` by default. `{ skipNaN: true }` or `{ skipna: true }` omits `NaN` and keeps `±Infinity` (`numpy.nanmean`). The same option works with a dimension: `mean(A, dim, { skipna: true })`. Helpers: `nanmean`, `nanmedian`, `nanvariance`, `nanstd` (default sample `ddof=1`). An all-NaN input is `NaN`.
- **Empty input:** `mean`, `median`, `mode`, `variance`, and `std` return `NaN` (no throw). `mode` of a non-empty sample is still an array of modes.
- **`kendalltau` p-value:** default matches SciPy `method='auto'` — exact enumeration when n ≤ 33 and there are no ties, otherwise the normal approximation. `describe` adds sample `std` (ddof = 1) and `q25` / `q50` / `q75` (NumPy `linear`). `quantileSeq` accepts `{ method, sorted }` and the NumPy method names (`weibull`, `hazen`, `averaged_inverted_cdf`, …) plus `inclusive` (linear) and `exclusive` (weibull). One-sample `kolmogorovSmirnovTest` accepts `'norm'` and `'normal'` as N(0, 1). Two-sample `kolmogorovSmirnov2Test` defaults to SciPy `auto` (exact when n₁·n₂ ≤ 10000).

## What's included

- **Descriptive statistics** — `mean`, `median`, `mode`, `variance`, `std`, `nanmean`, `nanmedian`,
  `nanvariance`, `nanstd`, `quantileSeq`, `mad` (median absolute deviation), `iqr`, `sem`, `zscore`, `moment`,
  `skewness`, `kurtosis`, `gmean`,
  `hmean`, `cov`, `corr`, `corrcoef`, `rankdata`, `ptp`, `trimmedMean`, `variation`, `describe`,
  `logsumexp`, `softmax`, `detrend`, `movingAverage`, `ewma`, `acf`, and the correlation helpers
  `pearsonr`, `spearman`, `spearmanr`, `kendalltau` / `kendallTau`.
- **Parallel reductions** — `parallelStat*` helpers mirror the typed reductions on `Float64Array`;
  most op thresholds in `ComputePool` are `'never'` today (inline JS), but the API stays
  `async`-friendly where the typed layer returns a `Promise`. Factory `mad` is **median**
  absolute deviation; `parallelStatMAD` / `parallelStatMeanAD` are **mean** absolute deviation
  from the mean (not the same statistic). `quickSelect` / `medianSelect` / `minSelect` /
  `maxSelect` are synchronous selection utilities.
- **Regression & resampling** — `linearRegression`, `polyFit`, `linregress`, `pearsonr`,
  `spearman`, `spearmanr`, `kendalltau`, `meanCI`, `proportionCI`, `bootstrapCI`,
  `permutationTest`, `mahalanobis`, `hotellingT2`, `kmeans`, `spectralClustering`.
- **Probability distributions** — distribution objects with `.pdf`, `.cdf`, `.quantile`, `.mean`,
  `.variance`, `.sample` (one draw), and `.sampleN(n, { seed })` (batch, optionally seeded)
  (`normalDist`, `gammaDist`, `betaDist`, `binomialDist`, `poissonDist`, `exponentialDist`,
  `chiSquaredDist`, `fDist`, `tDist`, `logNormalDist`, `uniformDist`, `weibullDist`,
  `hypergeometricDist`, `negativeBinomialDist`, `paretoDist`, `rayleighDist`, `triangularDist`,
  `discreteUniformDist`, `gumbelDist`, `invGaussDist`, `multivariateNormal`), plus free CDF/quantile
  functions, `studentizedRangeCDF` / `studentizedRangeQuantile`, and `entropy` / `jsDivergence`.
  **`gammaDist` parameterization:** the positional second argument is **rate** (`scale = 1/rate`).
  SciPy `stats.gamma(a=2, scale=2)` maps to `gammaDist(2, { scale: 2 })` or `gammaDist({ shape: 2, scale: 2 })`;
  `gammaDist(2, 2)` is rate `2` (SciPy `scale=0.5`, pdf(1) ≈ 0.541). Passing `rate` and `scale`
  together throws. Shape, rate, and scale must be finite and strictly positive.
- **Hypothesis tests** — `studentTTest` (one-sample vs `popmean` or two-sample Welch), `studentTTestPaired`, `anova`, `anova2`,
  `chiSquareTest`, `kolmogorovSmirnovTest` + `kolmogorovSmirnov2Test`, `mannWhitneyTest`,
  `shapiroWilkTest`, `leveneTest`, `bartlettTest`, `proportionZTest`, `binomialTest`, `fTest`,
  `jarqueBera`, `kruskalWallis`, `wilcoxon`, `fisherExact`, `tukeyHSD`, `andersonDarlingTest`,
  `dagostinoTest`, `friedmanTest`, `multipleComparison`, `principalComponentAnalysis`.
- **Probability & combinatorics** — `combinations`, `combinationsWithRep`, `permutations`,
  `multinomial`, `factorial`, `doubleFactorial`, `risingFactorial`, `fallingFactorial`,
  `subfactorial`, `bernoulli`, `gamma`, `lgamma`, `kldivergence`, and seedable RNG (`random`,
  `randomInt`, `pickRandom`, `seedProbabilityRng`).

## Example

```ts node
import {
  anova,
  kendallTau,
  hypergeometricDist,
  kolmogorovSmirnov2Test,
  normalDist,
} from '@danielsimonjr/mathts-statistics';

anova([
  [8.1, 8.3, 7.9],
  [9.1, 9.5, 8.9],
]); // one-way ANOVA F + p
kendallTau([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]); // 0.6
hypergeometricDist(50, 5, 10).pdf(1); // 0.4313371972
kolmogorovSmirnov2Test([1, 2, 3], [2, 3, 4]); // { statistic, pValue }

const d = normalDist(0, 1);
d.sample(); // one U(…) draw mapped to N(0,1)
const batch = await d.sampleN(5, { seed: 1 }); // Float64Array length 5, reproducible
console.log(batch.length);
```

## License

MIT

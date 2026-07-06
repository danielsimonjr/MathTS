/**
 * @danielsimonjr/mathts-statistics
 *
 * Standalone **statistics & probability** library for MathTS — descriptive
 * statistics, probability distributions, hypothesis tests, and combinatorics,
 * as a focused package. The implementations live in
 * {@link @danielsimonjr/mathts-functions}; this is a curated entry point over
 * the statistics/probability surface, not a copy.
 *
 * Every function here is externally-oracle-pinned (SciPy / NumPy / mpmath /
 * closed form) in the functions package's test suite.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Descriptive statistics — central tendency, dispersion, shape, association
// ---------------------------------------------------------------------------
export {
  // reductions
  mean,
  median,
  mode,
  variance,
  std,
  quantileSeq,
  mad,
  corr,
  cumsum,
  sum,
  prod,
  min,
  max,
  // richer descriptive measures
  rankdata,
  spearman,
  kendallTau,
  gmean,
  hmean,
  moment,
  skewness,
  kurtosis,
  iqr,
  sem,
  zscore,
  cov,
  corrcoef,
} from '@danielsimonjr/mathts-functions';

// ---------------------------------------------------------------------------
// Parallel-first statistics (worker-pool accelerated reductions & selection)
// ---------------------------------------------------------------------------
export {
  parallelStatSum,
  parallelStatMean,
  parallelStatVariance,
  parallelStatStd,
  parallelStatMin,
  parallelStatMax,
  parallelStatMinMax,
  parallelStatMedian,
  parallelStatMode,
  parallelStatProd,
  parallelStatNorm,
  parallelStatDistance,
  parallelStatCorr,
  parallelStatMAD,
  parallelStatCumsum,
  parallelStatQuantile,
  parallelStatPercentile,
  parallelStatHistogram,
  quickSelect,
  medianSelect,
  minSelect,
  maxSelect,
  typedStatistics,
} from '@danielsimonjr/mathts-functions';

// ---------------------------------------------------------------------------
// Probability distributions — objects (.pdf/.cdf/.quantile/.mean/.variance/.sample),
// PDF/PMF/CDF/quantile free functions, and the distribution divergences
// ---------------------------------------------------------------------------
export {
  // distribution objects
  normalDist,
  betaDist,
  binomialDist,
  chiSquaredDist,
  exponentialDist,
  fDist,
  gammaDist,
  logNormalDist,
  poissonDist,
  tDist,
  uniformDist,
  weibullDist,
  hypergeometricDist,
  negativeBinomialDist,
  DIST_WORKER_THRESHOLD,
  // typed PDF/PMF/CDF + divergences
  normalPDF,
  normalCDF,
  exponentialPDF,
  exponentialCDF,
  poissonPMF,
  binomialPMF,
  geometricPMF,
  bernoulliPMF,
  betaPDF,
  gammaPDF,
  studentTPDF,
  noncentralChi2PDF,
  entropy,
  jsDivergence,
  typedDistributions,
  // free CDF / quantile functions
  normalQuantile,
  studentTCDF,
  studentTQuantile,
  chiSquaredCDF,
  chiSquaredQuantile,
  fCDF,
  fQuantile,
  gammaCDF,
  gammaQuantile,
  betaCDF,
  betaQuantile,
  cauchyPDF,
  cauchyCDF,
  cauchyQuantile,
  laplacePDF,
  laplaceCDF,
  laplaceQuantile,
  logisticPDF,
  logisticCDF,
  logisticQuantile,
} from '@danielsimonjr/mathts-functions';

export type { Distribution, SampleNOptions } from '@danielsimonjr/mathts-functions';

// ---------------------------------------------------------------------------
// Hypothesis tests — parametric, non-parametric, variance-homogeneity, GoF
// ---------------------------------------------------------------------------
export {
  studentTTest,
  studentTTestPaired,
  chiSquareTest,
  anova,
  kolmogorovSmirnovTest,
  kolmogorovSmirnov2Test,
  mannWhitneyTest,
  shapiroWilkTest,
  leveneTest,
  bartlettTest,
  proportionZTest,
  binomialTest,
  principalComponentAnalysis,
  fTest,
  jarqueBera,
  kruskalWallis,
  wilcoxon,
  fisherExact,
  studentizedRangeCDF,
  studentizedRangeQuantile,
  tukeyHSD,
} from '@danielsimonjr/mathts-functions';

// ---------------------------------------------------------------------------
// Probability & combinatorics — counting, RNG, special functions
// ---------------------------------------------------------------------------
export {
  combinations,
  combinationsWithRep,
  permutations,
  multinomial,
  factorial,
  doubleFactorial,
  risingFactorial,
  fallingFactorial,
  subfactorial,
  bernoulli,
  gamma,
  lgamma,
  kldivergence,
  random,
  randomInt,
  pickRandom,
  seedProbabilityRng,
  typedProbability,
} from '@danielsimonjr/mathts-functions';

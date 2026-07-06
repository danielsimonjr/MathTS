# Statistics Library Gap Audit — vs NumPy/SciPy, MATLAB, Mathematica

**Date:** 2026-07-06 · **Package:** `@danielsimonjr/mathts-statistics@0.2.0` (138 exports) ·
**Reference libraries:** `numpy` + `scipy.stats` (1.17), MATLAB _Statistics & Machine Learning
Toolbox_ (R2024), _Mathematica_ 14.

> **Method.** The current surface was enumerated from the published package. Each reference
> library's _standard_ statistics surface (not its long tail of obscure distributions) was diffed
> against it. Every "missing" row was grep-verified absent from `functions/src`. Gaps split into
> **re-export gaps** (implemented in `functions/`, not surfaced here — trivial to close) and
> **true gaps** (not implemented anywhere). Priority: **P1** = everyday/standard, expected in any
> stats library · **P2** = common, frequently needed · **P3** = specialist.

---

## Verdict

The library **covers the everyday statistics surface well** — core descriptives, the 14 most-used
distributions (all scipy-oracle-pinned), 20 hypothesis tests, and combinatorics. Measured against
the three references it is **roughly at parity for teaching / applied statistics**, but has real
gaps in five areas that a "complete like NumPy/MATLAB/Mathematica" library ships:

1. **Regression & model fitting** — the biggest structural gap (only `linearRegression` exists,
   and it isn't even re-exported).
2. **A dozen standard hypothesis tests** — normality (Anderson–Darling, D'Agostino), Friedman,
   two-way ANOVA, sign/runs/Mood, correlation **tests** (p-values), multiple-comparison correction.
3. **Multivariate** — Mahalanobis, Hotelling's T², MANOVA, multivariate normal, canonical corr.
4. **Resampling & confidence intervals** — standalone bootstrap CI, permutation test, jackknife;
   any explicit CI.
5. **~15 common distributions** — Pareto, Rayleigh, Gumbel/GEV, triangular, discrete-uniform,
   von Mises, inverse-gamma/Wald, skew-normal, truncated-normal; discrete Zipf/logarithmic/Skellam.

Plus a handful of descriptive conveniences (range/ptp, coefficient of variation, trimmed mean,
partial correlation, `describe`, histogram, Mahalanobis).

---

## 0. Re-export gaps (implemented in `functions/`, NOT surfaced in the statistics library)

These already exist and are tested — closing them is a one-line re-export each. **P1**, near-zero cost.

| Function                                  | Domain                                  | np/scipy                               | MATLAB                         | Mma                |
| ----------------------------------------- | --------------------------------------- | -------------------------------------- | ------------------------------ | ------------------ |
| `linearRegression`                        | OLS regression                          | `linregress`                           | `regress`/`fitlm`              | `LinearModelFit`   |
| `polyFit`                                 | polynomial fit                          | `np.polyfit`                           | `polyfit`                      | `Fit`              |
| `cummax`, `cummin`, `cumprod`             | cumulative reductions                   | `np.maximum.accumulate` etc.           | `cummax`/`cummin`/`cumprod`    | `Accumulate`       |
| `logsumexp`, `softmax`                    | numerically-stable log-domain           | `scipy.special.{logsumexp,softmax}`    | —                              | —                  |
| `kmeans`, `spectralClustering`            | clustering                              | `scipy.cluster` / sklearn              | `kmeans`                       | `FindClusters`     |
| `movingAverage`, `ewma`, `detrend`, `acf` | time-series descriptives                | `scipy.signal`/statsmodels             | `movmean`/`detrend`/`autocorr` | —                  |
| `cumtrapz`, `trapzF64`                    | cumulative integration                  | `scipy.integrate.cumulative_trapezoid` | `cumtrapz`                     | —                  |
| `beta`, `digamma`                         | special functions used by distributions | `scipy.special.{beta,digamma}`         | `beta`/`psi`                   | `Beta`/`PolyGamma` |

---

## 1. Descriptive statistics

**Have:** mean, median, mode, variance, std, min, max, sum, prod, quantileSeq, mad, iqr, sem,
zscore, moment, skewness, kurtosis, gmean, hmean, rankdata, cumsum. ✅ strong.

| Missing                                                                                                                             | np/scipy                    | MATLAB                | Mma                   | Priority |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------- | --------------------- | -------- |
| **statistical range / ptp** (max − min) — NB: the name `range` is already taken by the sequence generator, so use `ptp`/`statRange` | `np.ptp`                    | `range`               | `Max−Min`             | **P1**   |
| **coefficient of variation** (std/mean)                                                                                             | `scipy.stats.variation`     | —                     | —                     | **P1**   |
| **trimmed / winsorized mean**                                                                                                       | `trim_mean`, `tmean`/`tstd` | `trimmean`            | `TrimmedMean`         | **P2**   |
| **weighted mean / quantile**                                                                                                        | `np.average(w=)`            | `mean(...,'Weights')` | `Mean[…Weights]`      | **P2**   |
| **describe** (summary bundle)                                                                                                       | `scipy.stats.describe`      | `summary`/`grpstats`  | —                     | **P2**   |
| **histogram / bincount / digitize**                                                                                                 | `np.histogram`              | `histcounts`          | `HistogramList`       | **P2**   |
| power/generalized mean                                                                                                              | `scipy.stats.pmean`         | —                     | —                     | P3       |
| geometric std, gstd/gzscore                                                                                                         | `gstd`, `gzscore`           | —                     | —                     | P3       |
| circular stats (circmean/var/std)                                                                                                   | `circmean` etc.             | `circ_*` (CircStat)   | `MeanAngle`           | P3       |
| k-statistics (kstat/kstatvar)                                                                                                       | `kstat`                     | —                     | —                     | P3       |
| differential entropy                                                                                                                | `differential_entropy`      | —                     | `DifferentialEntropy` | P3       |

## 2. Correlation & association

**Have:** corr (Pearson coefficient), spearman, kendallTau, cov, corrcoef.

| Missing                                                                                         | np/scipy                                            | MATLAB            | Mma                   | Priority |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------- | --------------------- | -------- |
| **correlation TESTS with p-values** (pearson/spearman/kendall return only the coefficient here) | `pearsonr`/`spearmanr`/`kendalltau` return `(r, p)` | `[r,p]=corr(...)` | `CorrelationTest`     | **P1**   |
| **partial correlation**                                                                         | `pingouin`/statsmodels                              | `partialcorr`     | —                     | **P2**   |
| point-biserial                                                                                  | `pointbiserialr`                                    | —                 | —                     | P2       |
| Theil–Sen / Siegel slopes (robust)                                                              | `theilslopes`/`siegelslopes`                        | —                 | —                     | P3       |
| distance correlation                                                                            | (dcor)                                              | —                 | `DistanceCorrelation` | P3       |
| Cramér's V / contingency association                                                            | `stats.contingency.association`                     | —                 | `CramerV`             | P2       |

## 3. Probability distributions

**Have (14 objects + free CDF/PDF/quantile):** normal, beta, binomial, chiSquared, exponential,
f, gamma, logNormal, poisson, t, uniform, weibull, hypergeometric, negativeBinomial; free cauchy,
laplace, logistic; geometric/bernoulli/noncentralChi2 PMF. ✅ the 14 most-used.

| Missing (continuous)                        | np/scipy                              | MATLAB            | Mma                        | Priority |
| ------------------------------------------- | ------------------------------------- | ----------------- | -------------------------- | -------- |
| **Pareto**                                  | `pareto`/`lomax`                      | `Pareto`          | `ParetoDistribution`       | **P1**   |
| **Rayleigh**                                | `rayleigh`                            | `Rayleigh`        | `RayleighDistribution`     | **P1**   |
| **triangular**                              | `triang`                              | `Triangular`      | `TriangularDistribution`   | **P1**   |
| **Gumbel / GEV / generalized Pareto**       | `gumbel_r`, `genextreme`, `genpareto` | `gevcdf`, `gpcdf` | `ExtremeValueDistribution` | **P2**   |
| **inverse-gamma, inverse-Gaussian (Wald)**  | `invgamma`, `invgauss`                | `InverseGaussian` | `InverseGammaDistribution` | P2       |
| **skew-normal, truncated-normal**           | `skewnorm`, `truncnorm`               | —                 | `SkewNormalDistribution`   | P2       |
| **von Mises** (circular)                    | `vonmises`                            | —                 | `VonMisesDistribution`     | P3       |
| Nakagami, Rice (signal)                     | `nakagami`, `rice`                    | —                 | —                          | P3       |
| Student-t location-scale, noncentral t/F/χ² | `nct`, `ncf`, `ncx2`                  | `nctcdf` etc.     | —                          | P3       |

| Missing (discrete)             | np/scipy                    | MATLAB    | Mma                           | Priority |
| ------------------------------ | --------------------------- | --------- | ----------------------------- | -------- |
| **discrete uniform (randint)** | `randint`                   | `unidrnd` | `DiscreteUniformDistribution` | **P1**   |
| **beta-binomial**              | `betabinom`                 | —         | `BetaBinomialDistribution`    | P2       |
| Zipf / logarithmic / Skellam   | `zipf`, `logser`, `skellam` | —         | `ZipfDistribution`            | P3       |

| Missing (multivariate)                | np/scipy                                 | MATLAB            | Mma                       | Priority |
| ------------------------------------- | ---------------------------------------- | ----------------- | ------------------------- | -------- |
| **multivariate normal** (pdf/cdf/rnd) | `multivariate_normal`                    | `mvnpdf`/`mvnrnd` | `MultinormalDistribution` | **P1**   |
| Dirichlet, Wishart, multivariate-t    | `dirichlet`, `wishart`, `multivariate_t` | —                 | `DirichletDistribution`   | P3       |

## 4. Hypothesis tests

**Have:** studentTTest (1/2-sample), studentTTestPaired, anova (one-way), chiSquareTest,
kolmogorovSmirnovTest (+2-sample), mannWhitneyTest, shapiroWilkTest, leveneTest, bartlettTest,
proportionZTest, binomialTest, fTest, jarqueBera, kruskalWallis, wilcoxon, fisherExact, tukeyHSD. ✅ broad.

| Missing                                                     | np/scipy                                   | MATLAB                    | Mma                      | Priority |
| ----------------------------------------------------------- | ------------------------------------------ | ------------------------- | ------------------------ | -------- |
| **Anderson–Darling** (normality/GoF)                        | `anderson`, `anderson_ksamp`               | `adtest`                  | `AndersonDarlingTest`    | **P1**   |
| **D'Agostino–Pearson normality**                            | `normaltest` (+ `skewtest`/`kurtosistest`) | —                         | `DAgostinoTest`          | **P1**   |
| **Friedman test** (repeated-measures NP)                    | `friedmanchisquare`                        | `friedman`                | `—`                      | **P1**   |
| **two-way / N-way ANOVA**                                   | (statsmodels)                              | `anova2`, `anovan`        | `ANOVA`                  | **P1**   |
| **multiple-comparison correction** (Bonferroni/Holm/BH-FDR) | `false_discovery_control` / statsmodels    | `multcompare`             | —                        | **P1**   |
| **Cramér–von Mises** (1- & 2-sample)                        | `cramervonmises(_2samp)`                   | —                         | `CramerVonMisesTest`     | P2       |
| **sign test / runs test / Mood median**                     | `median_test`, (runs in statsmodels)       | `signtest`, `runstest`    | `SignTest`               | P2       |
| **Fligner–Killeen** (robust scale)                          | `fligner`                                  | `vartestn(...,'Fligner')` | —                        | P2       |
| **McNemar / Cochran's Q** (paired categorical)              | statsmodels                                | `testcholdout`            | —                        | P2       |
| **Lilliefors** (KS w/ estimated params)                     | (statsmodels)                              | `lillietest`              | —                        | P2       |
| Ansari–Bradley, Mood scale, Brunner–Munzel                  | `ansari`, `mood`, `brunnermunzel`          | `ansaribradley`           | —                        | P3       |
| G-test / power-divergence family                            | `power_divergence`                         | —                         | `LogLikelihoodRatioTest` | P3       |
| Welch ANOVA / Alexander–Govern                              | `alexandergovern`                          | —                         | —                        | P3       |
| Dunnett, Games–Howell post-hoc                              | `dunnett`                                  | `multcompare`             | —                        | P3       |

## 5. Regression & model fitting _(largest structural gap)_

**Have:** `linearRegression` (exists in `functions/`, **not re-exported**); `principalComponentAnalysis`.

| Missing                                                                                                                                                                                  | np/scipy                            | MATLAB                      | Mma                         | Priority |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------- | --------------------------- | -------- |
| **simple linear regression w/ inference** (slope/intercept/r/p/stderr/CI) — `linearRegression` exists in `functions/` but returns coefficients only, no inference; and isn't re-exported | `linregress`                        | `regress`/`fitlm`           | `LinearModelFit`            | **P1**   |
| polynomial fit — `polyFit` **already implemented** (re-export gap, §0)                                                                                                                   | `np.polyfit`                        | `polyfit`                   | `Fit`                       | —        |
| **multiple linear regression**                                                                                                                                                           | `np.linalg.lstsq` / statsmodels OLS | `fitlm`/`regress`           | `LinearModelFit`            | **P2**   |
| **logistic / GLM regression**                                                                                                                                                            | statsmodels GLM                     | `fitglm`                    | `GeneralizedLinearModelFit` | **P2**   |
| **nonlinear least squares / curve fit**                                                                                                                                                  | `scipy.optimize.curve_fit`          | `nlinfit`/`lsqcurvefit`     | `NonlinearModelFit`         | **P2**   |
| robust regression, ridge/lasso                                                                                                                                                           | statsmodels/sklearn                 | `robustfit`/`ridge`/`lasso` | —                           | P3       |

## 6. Multivariate

**Have:** `principalComponentAnalysis`.

| Missing                         | np/scipy                             | MATLAB                 | Mma                    | Priority |
| ------------------------------- | ------------------------------------ | ---------------------- | ---------------------- | -------- |
| **Mahalanobis distance**        | `scipy.spatial.distance.mahalanobis` | `mahal`                | `MahalanobisDistance`  | **P2**   |
| **Hotelling's T²**              | (statsmodels)                        | (via `manova`)         | `HotellingTSquareTest` | P2       |
| **MANOVA**                      | statsmodels                          | `manova1`              | —                      | P3       |
| canonical correlation           | (sklearn)                            | `canoncorr`            | —                      | P3       |
| covariance shrinkage estimators | (sklearn)                            | `cov1para`/`shrinkage` | —                      | P3       |

## 7. Resampling, Monte Carlo & confidence intervals

**Have:** `{ bootstrap }` permutation option baked into several hypothesis tests (KS/MW/SW). No
standalone resampling or CI functions.

| Missing                                         | np/scipy                           | MATLAB                     | Mma                                            | Priority |
| ----------------------------------------------- | ---------------------------------- | -------------------------- | ---------------------------------------------- | -------- |
| **bootstrap confidence intervals** (standalone) | `scipy.stats.bootstrap`            | `bootci`/`bootstrp`        | —                                              | **P1**   |
| **confidence interval for mean / proportion**   | `t.interval`, `proportion_confint` | CI outputs on `ttest` etc. | `MeanCI`/`StudentTCI` (via ConfidenceInterval) | **P1**   |
| **permutation test** (standalone)               | `permutation_test`                 | —                          | —                                              | P2       |
| jackknife, Monte-Carlo test                     | `monte_carlo_test`, (jackknife)    | `jackknife`                | —                                              | P3       |

---

## Ranked closeout plan

If you want statistics/probability to reach genuine "complete like NumPy/MATLAB/Mathematica"
completeness, the P1 waves in order of value/effort:

1. **Re-export the 16 already-implemented functions** (0. above) — one commit, near-zero risk.
2. **Regression & inference**: `linregress` (slope/intercept/r/p/stderr/CI) + `polyfit` — the
   single most-conspicuous gap; every reference ships it. Pin to scipy `linregress`.
3. **Correlation tests with p-values**: make `pearsonr`/`spearmanr`/`kendalltau` return `(r, p)`.
4. **Descriptive conveniences**: `range`/`ptp`, `variation`, `describe`, `histogram`, `trimmean`.
5. **Normality & repeated-measures tests**: Anderson–Darling, D'Agostino `normaltest`, Friedman,
   two-way ANOVA, multiple-comparison correction (Bonferroni/Holm/BH-FDR).
6. **Common distributions**: Pareto, Rayleigh, triangular, discrete-uniform, Gumbel/GEV,
   inverse-Gaussian, multivariate-normal.
7. **Resampling & CI**: standalone `bootstrap` CI + mean/proportion confidence intervals.
8. **Multivariate**: Mahalanobis, Hotelling's T².

Each new function follows the established discipline: implement in `functions/`, **externally
pin to SciPy** in `gap-stats-completeness.test.ts`, re-export from the statistics library.

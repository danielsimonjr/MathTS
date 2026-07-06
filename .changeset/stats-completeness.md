---
'@danielsimonjr/mathts-functions': minor
---

**Statistics/probability completeness — close the breadth gap to matrix-level parity.** Adds the standard distributions, hypothesis tests, and correlation measures a complete package ships, each pinned to an EXTERNAL oracle (scipy 1.17.1), matching the domain's existing scipy-oracle discipline:

- **Two-sample Kolmogorov–Smirnov** (`kolmogorovSmirnov2Test`) — the commonly-used form; the prior KS was one-sample only.
- **Levene + Bartlett** variance-homogeneity tests (`leveneTest`, `bartlettTest`).
- **Hypergeometric + negative-binomial** distributions (`hypergeometricDist`, `negativeBinomialDist`).
- **Paired t-test** (`studentTTestPaired`), **proportion z-tests** (`proportionZTest`), **binomial test** (`binomialTest`).
- **Kendall's τ** (`kendallTau`) — completing Pearson/Spearman/Kendall.

Also adds external scipy pins for three distribution methods previously verified only by inversion round-trips (`poissonDist.cdf`, `logNormalDist.quantile`, `weibullDist.quantile`).

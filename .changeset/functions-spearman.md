---
'@danielsimonjr/mathts-functions': minor
---

Add `spearman(x, y)` — the Spearman rank correlation coefficient (Pearson correlation of the rank-transformed inputs, ties handled via average ranks). Unlike Pearson, it captures any monotonic relationship, so a monotonic non-linear pair returns ρ = 1. This closes the one remaining gap in the descriptive-statistics domain (`skewness`/`kurtosis`/`cov`/`gmean`/`iqr`/`zscore`/`kruskalWallis`/`wilcoxon`/`fTest` already shipped).

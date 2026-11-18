---
'@danielsimonjr/mathts-functions': patch
---

`rankdata`, `spearman`, `spearmanr`, `wilcoxon`, `kruskalWallis`, `mannWhitneyTest`, `friedmanTest`, `wassersteinDistance` and `unwrapPhase` return on NaN or Infinity input instead of running forever (Fixes #979). The tie scans did `while (a[j] === a[i])` from `j = i`, and `NaN === NaN` is false, so the index never moved. `unwrapPhase` subtracted `2*pi` from an infinite step for ever.

- `rankdata([3, 1, NaN])` returns `[NaN, NaN, NaN]` (SciPy `nan_policy='propagate'`). It did not return before.
- `spearman([1, NaN, 2, 3], [1, 2, 3, 4])` returns `NaN`. `spearmanr` returns `{ coefficient: NaN, pValue: NaN }`.
- `wilcoxon([1, NaN, 3, 4], [2, 3, 1, 5])` returns `NaN` for `statistic`, `pValue` and `zStatistic`.
- `kruskalWallis`, `mannWhitneyTest`, `friedmanTest` and `wassersteinDistance` return `NaN` for a sample with NaN. The first three did not return before.
- `kendallTau`, `kendalltau` and `kendallTauTest` return `NaN` for NaN input. Before, the NaN pairs were skipped and `kendallTau([1, NaN, 2, 3], [1, 2, 3, 4])` gave `0.5`.
- `unwrapPhase([Infinity, 1, 2, -Infinity])` returns `[Infinity, NaN, NaN, NaN]` (NumPy: `[inf, nan, nan, nan]`). `unwrapPhase([1, NaN, 2])` returns `[1, NaN, NaN]`. A finite difference between a sample and the previous unwrapped value that is larger than `2*pi * 2^20` (about `6.59e6`) is reduced with one exact remainder, so `unwrapPhase([0, 1e300])` returns at once. Results for smaller differences do not change.

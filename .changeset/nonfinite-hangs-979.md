---
'@danielsimonjr/mathts-functions': patch
---

`rankdata`, `spearman`, `spearmanr`, `wilcoxon`, `kruskalWallis`, `mannWhitneyTest`, `friedmanTest`, `wassersteinDistance`, `unwrapPhase`, `kolmogorovSmirnov2Test`, `fisherExact` and `peakWidths` return or throw on NaN, Infinity or an invalid index instead of running forever, and `theilSen` and `rankBiserial` return NaN for NaN input (Fixes #979). The tie scans did `while (a[j] === a[i])` from `j = i`, and `NaN === NaN` is false, so the index never moved. `unwrapPhase` subtracted `2*pi` from an infinite step for ever.

- `rankdata([3, 1, NaN])` returns `[NaN, NaN, NaN]` (SciPy `nan_policy='propagate'`). It did not return before.
- `spearman([1, NaN, 2, 3], [1, 2, 3, 4])` returns `NaN`. `spearmanr` returns `{ coefficient: NaN, pValue: NaN }`.
- `wilcoxon([1, NaN, 3, 4], [2, 3, 1, 5])` returns `NaN` for `statistic`, `pValue` and `zStatistic`.
- `kruskalWallis`, `mannWhitneyTest`, `friedmanTest` and `wassersteinDistance` return `NaN` for a sample with NaN. The first three did not return before.
- `kendallTau`, `kendalltau` and `kendallTauTest` return `NaN` for NaN input. Before, the NaN pairs were skipped and `kendallTau([1, NaN, 2, 3], [1, 2, 3, 4])` gave `0.5`.
- `unwrapPhase([Infinity, 1, 2, -Infinity])` returns `[Infinity, NaN, NaN, NaN]` (NumPy: `[inf, nan, nan, nan]`). `unwrapPhase([1, NaN, 2])` returns `[1, NaN, NaN]`. A finite difference between a sample and the previous unwrapped value that is larger than `2*pi * 2^20` (about `6.59e6`) is reduced with one exact remainder, so `unwrapPhase([0, 1e300])` returns at once. Results for smaller differences do not change.
- `kolmogorovSmirnov2Test([1, NaN, 2, 3], [1, 2, 3, 4])` returns `{ statistic: NaN, pValue: NaN }`, also for a NaN in the second sample. It did not return before. Infinity stays an ordinary value: `kolmogorovSmirnov2Test([1, Infinity, 2, -Infinity], [1, 2, 3, 4])` is `{ statistic: 0.25, pValue: 1 }`.
- `fisherExact` throws a `RangeError` unless every table entry is a finite number `>= 0`. Before, `fisherExact([[Infinity, 0], [0, 5]])` did not return, and `[[NaN, 1], [2, 5]]` and `[[-1, 1], [2, 5]]` returned `pValue: 0`. SciPy also raises for a negative entry. Valid tables do not change.
- `peakWidths` throws a `RangeError` (`peakWidths: peak <k> is not a valid index for x`, where `k` is the position in `peaks`) unless each index is an integer in `[0, x.length)`. Before, `peakWidths([1, 3, 1], [Infinity])` did not return, and `[7]`, `[-1]` and `[1.5]` returned `[0]`, `[NaN]` and `[0]`.
- `theilSen([1, NaN, 2, 3], [1, 2, 3, 4])` returns `{ slope: NaN, intercept: NaN }`. Before, the NaN pairs were dropped and the slope was `1.75`. A NaN in `y` gives the same result.
- `rankBiserial([1, NaN, 2, 3], [2, 3, 4, 5])` returns `NaN`. Before, it gave `-0.75`, and `0.25` with the samples swapped.

Other functions that still give a silent value for NaN input are tracked in #1146.

---
'@danielsimonjr/mathts-functions': patch
---

`peakWidths` now returns the widths of `scipy.signal.peak_widths`. The old code walked outward from the peak until it found a sample at or below the reference height. It did not stop at the base of the peak. It looked at the neighbour of each sample, not at the sample. And it did not check `relHeight`. Results before the change:

- `peakWidths([1, 3, 1], [0])` returned `[2]`. A peak at the edge has no prominence, so the width is now `[0]`.
- `peakWidths([5, 1, 3, 1, 5], [2], 1.5)` returned `[4]`. The walk passed the base of the peak. The width is now `[2]`.
- `peakWidths([0, 1, 2, 3, 4], [2])` returned `[2]` for an index that is not a peak. The width is now `[0]`.
- `peakWidths([1, 3, 1], [1], -1)` returned `[-2]`. A negative `relHeight` now throws `RangeError`, as SciPy does. A `relHeight` of NaN returned `[NaN]` and now throws `RangeError` too (SciPy returns `[0]` for NaN; a NaN has no meaning as a fraction of a height, so this function rejects it).

The widths now match SciPy 1.16.3 to the last bit on every probe, including plateaus, nested peaks and a `relHeight` of 1e308. The `prominence` option of `findPeaks` is unchanged.

(Refs #1153)

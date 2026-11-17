---
'@danielsimonjr/mathts-functions': minor
---

`quantileSeq`, `ptp`, `iqr` and `histogram` follow the NaN policy of `mean`, `median` and `describe` (Fixes #1098). NaN propagates by default. `{ skipNaN: true }` or `{ skipna: true }` omits NaN and keeps `±Infinity`. `quantileSeq` takes the option in its options object (`quantileSeq(x, p, { skipNaN: true })`, also with an array of probabilities), `ptp(x, opts)`, `iqr(x, opts)` and `histogram(x, bins, opts)` take it as the last argument.

`quantileSeq` with infinite values now blends from the nearer end, as NumPy does, so `quantileSeq([-Infinity, Infinity, 2, 3], 0.25)` is `-Infinity` and not `NaN`. A quantile with a zero fraction, or with two equal ends (`[Infinity, Infinity, 2, 3]` at 0.75), returns that value.

BREAKING:

- `quantileSeq` and `iqr` with NaN return `NaN`, not a number (`quantileSeq([1, NaN, 2, 3], 0.75)` was 2.25).
- `ptp` of an array with NaN is `NaN` at any position (`ptp([1, NaN, 2, 3])` was 2).
- `histogram` with NaN throws `Error` (as `numpy.histogram`); it dropped the NaN before. Pass `{ skipNaN: true }` to keep the old counts.
- `histogram` with an infinite value throws `Error` (the range is not finite); it returned NaN edges before.

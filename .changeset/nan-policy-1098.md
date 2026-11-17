---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-statistics': patch
---

`quantileSeq`, `ptp`, `iqr` and `histogram` follow the NaN policy of `mean`, `median` and `describe` (Fixes #1098). NaN propagates by default. `{ skipNaN: true }` or `{ skipna: true }` omits NaN and keeps `±Infinity`. `quantileSeq` takes the option in its options object, also with an array of probabilities and with BigNumber data or probabilities. `ptp(x, opts)`, `iqr(x, opts)` and `histogram(x, bins, opts)` take it as the last argument. A last argument that is not an object is ignored, so `rows.map(ptp)` works as before.

`quantileSeq` interpolates as NumPy `_lerp` does, so `quantileSeq([-Infinity, Infinity, 2, 3], 0.25)` is `-Infinity` and not `NaN`, and `describe` gives the same `q25`. A result can change by one unit in the last place (`quantileSeq([3, -1, 5, 7, 2], 0.25, 'median_unbiased')` was 1, is 1.0000000000000002, as NumPy). `histogram` with an infinite value throws `Error`; it returned NaN edges before. `histogram` has no range option, so NaN or an infinite value always makes the range not finite (the `numpy.histogram` error for an automatic range).

BREAKING:

- `quantileSeq` and `iqr` with NaN return `NaN` (`quantileSeq([1, NaN, 2, 3], 0.75)` was 2.25). This includes `sorted: true` (`quantileSeq([1, 2, 3, NaN], 0.5, true)` was 2.5) and Matrix data.
- `ptp` with NaN is `NaN` at any position (`ptp([1, NaN, 2, 3])` was 2; `ptp([1, NaN, Infinity])` was `Infinity`).
- `histogram` with NaN throws `Error`; it dropped the NaN before. Pass `{ skipNaN: true }` to keep the old counts.

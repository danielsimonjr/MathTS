---
'@danielsimonjr/mathts-functions': patch
---

`signTest`, `moodMedianTest`, `cummax`, `cummin` and `medianSelect` return NaN for a NaN input, as SciPy and NumPy do. `ecdf` throws a `RangeError` for a NaN input. `wassersteinDistance` returns NaN when the same infinite value occurs twice. `fisherExact` sums only the tail tables, so a table with large counts (`[[1e9, 1e9], [1e9, 1e9]]`) returns at once. (Refs #1146)

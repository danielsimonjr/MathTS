---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

Descriptive statistics: NumPy `{ ddof }` on typed `variance`/`std`, `{ skipNaN: true }` and `nanmean`/`nanmedian`/`nanvariance`, `Float64Array` on median/mode/quantileSeq/mad/corr, constant-input variance fast path for huge magnitudes, and empty `median`/`mad` return `NaN` (empty `mode` returns `[]`).

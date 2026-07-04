---
'@danielsimonjr/mathts-functions': patch
---

`kolmogorovSmirnovTest` now throws a clear `TypeError` when its `cdfFn` argument is not a function (e.g. a second sample array passed under the mistaken assumption it is a two-sample test) instead of crashing with an opaque `cdf is not a function`. It remains a one-sample test against a CDF function (default: standard normal).

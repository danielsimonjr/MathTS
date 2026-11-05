---
'@danielsimonjr/mathts-functions': patch
---

SR-16: add `runScalarSearch`, a thin wrapper that consumes the `searchScalars` generator and returns the final `ScalarSearchResult`. It accepts `seed` instead of a required `rng` (exactly one of the two), accepts `columns` as a record keyed by variable name, and adds the `bestLossFactor` search option, forwarded to `selectFrontModel` when `modelSelection` is set (a non-finite factor throws `RangeError` before the search starts).

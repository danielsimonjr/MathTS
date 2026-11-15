---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-workerpool': patch
'@danielsimonjr/mathts-parallel': patch
'@danielsimonjr/mathts-functions': patch
---

`min` and `max` of a Float64Array propagate NaN on every sequential and parallel path, as the Array path and mathjs do (#1048). This change adds the core primitive `extrema`.

---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

`describe` gives NaN in every field except `nobs` when the input holds a NaN, where the NaN gave wrong values in some fields only. `nobs` is the input length. The new option `{ skipNaN: true }` (or `{ skipna: true }`) drops the NaN values first, as `scipy.stats.describe` with `nan_policy='omit'`. `nobs` counts the values that remain. Unknown options throw `TypeError` (#1004).

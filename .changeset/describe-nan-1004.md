---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-statistics': patch
---

`describe` gives NaN in every field except `nobs` when the input holds a NaN, Before, a NaN gave wrong values in some fields only. `nobs` is the input length. The new option `{ skipNaN: true }` (or `{ skipna: true }`) drops the NaN values first and gives `describe` of the values that remain (`Infinity` is kept). `nobs` counts them. Options that are not a plain object, and unknown options, throw `TypeError` (#1004).

---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts an opt-in `invalidRows` policy (`'reject'` or `'penalize'`, default `'reject'`). `'penalize'` ranks a tree that is invalid on some rows as the fitter's existing invalid-row penalty (`1e8`) times the number of invalid rows a positive weight covers, plus the chosen `loss` on the valid rows, instead of `+Infinity`. Omitted, the seed-7 pin is unchanged.

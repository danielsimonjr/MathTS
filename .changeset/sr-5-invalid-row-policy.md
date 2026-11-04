---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts an opt-in `invalidRows` policy (`'reject'` or `'penalize'`, default `'reject'`). `'penalize'` ranks a tree that is invalid on some rows as `INVALID_ROW_PENALTY` (`1e8`) times each invalid row with positive weight, plus the chosen `loss` on the valid rows, instead of `+Infinity`. Zero-weight rows are omitted. Omitted, the seed-7 pin is unchanged.

---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` accepts opt-in `loss` (`'l2' | 'l1' | 'huber'`, default `'l2'`) and `rowWeights`. Ranking and every parameter refit use that same named loss from `fitScalarParameters`. Omitted options leave the seed-7 pin unchanged.

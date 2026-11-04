---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` keeps one front row per canonical tree. When two evaluated trees share a `scalarCanonicalKey`, the hall of fame keeps the one with the smaller stored complexity, then the smaller loss, then the one recorded first, and the survivor reports its own stored complexity (with `complexityWeights` when given). The population already kept one tree per key; the reported front now does the same. Omitted options: the seed-7 pin is unchanged.

---
'@danielsimonjr/mathts-functions': patch
---

`searchScalars` keeps one hall entry per canonical tree at add time. When two evaluated trees share a `scalarCanonicalKey`, the survivor has the smaller loss, then the smaller stored complexity, then the one recorded first; a better same-key arrival evicts the old tree and frees its complexity slot. Complexity weights affect reported complexity only, not dedup. Negative complexity weights throw `RangeError`. Omitted options: the seed-7 pin is unchanged.

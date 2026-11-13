---
'@danielsimonjr/mathts-core': patch
---

`Unit._findUnit` keeps the length of the longest unit name in its index, so a miss no longer reads every `UNITS` name. The 577,000 miss calls of the reading oracle take 3.8 s, not 24.5 s (#956). The JSDoc of `UnitInstance.value`, `toNumber` and `toNumeric` states that `value` is the SI magnitude and that `toNumeric()` is the number in the shown unit (#921). Unit conversion rounds the exact scale once; the tests pin `5 cm` to `inch` (#742).

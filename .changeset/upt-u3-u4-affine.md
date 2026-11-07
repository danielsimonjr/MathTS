---
'@danielsimonjr/mathts-core': minor
---

Compounds with an affine unit (degC, degF) now throw `UnitParseError` unless parsed with `{ affine: 'difference' }`, and `to(target, { reading: 'difference' })` converts a temperature interval.

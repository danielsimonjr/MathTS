---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

G07 `nullish` and logical Unit parity (#1555): typed `nullish` now routes scalar and collection calls through `createNullish` (same path as `??`, element-wise fill, dimension mismatch, TypeError on plain objects). `not`/`and`/`or`/`xor` gain `Unit` signatures that test the unit value. Fraction `format` (`2/1`) remains G15 (#1721).

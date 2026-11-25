---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

Preserve Fraction and Unit in `nullish` (#1555): added explicit `Fraction, any` and `Unit, any` signatures to `nullish` so a non-nullish Fraction is not converted to Complex. `nullish(fraction(1,3), 2)` was `Complex 0.33333333333333` and is `Fraction 1/3`, as mathjs 15.3.0 returns.

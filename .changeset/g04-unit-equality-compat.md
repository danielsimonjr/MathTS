---
'@danielsimonjr/mathts-compat': patch
'@danielsimonjr/mathts-functions': patch
---

**Unit equality and ordering (#1552):** Typed `unitsEqual` compares normalized unit values with `coreEqual` instead of `===`; `unitCmp` uses value-type-aware `unitValuesCompare` and throws when ordering Complex-valued units. On the compat instance, relational exports wrap activated mathjs factories (`unit-relational.ts`); integral Fraction `format` uses an `n/1` suffix (`format-parity.ts`).

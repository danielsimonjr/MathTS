---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`isPositive` and `isNegative` of a Fraction now call `Fraction.isPositive()` / `Fraction.isNegative()` instead of reading the undefined `fraction.js` fields `.s`/`.n` (#1551): `isPositive(fraction(1, 3))` was `false` and is `true`. The same field-name reads on Fraction values in `isInteger` (`.d` → `isInteger()`), `fix` (`.s` → `isNegative()`) and the `predictable`-mode `pow` fraction shortcut (`.d`/`.n` → `denominator`/`numerator`) use the Fraction's own API now, so `isInteger(fraction(2))` was `false` and is `true`, as mathjs 15.3.0 returns.

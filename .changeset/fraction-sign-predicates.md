---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

Fix Fraction field reads (`isPositive`/`isNegative`/`isInteger`/`fix`, Unit BigNumber converter) to use `numerator`/`denominator`, and exact rational `pow` via `rationalPow` (#1551). Compat still prints whole fractions as `n/1`.

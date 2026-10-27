---
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-statistics': minor
---

Fix `simplify` `exactFractions` to read core `Fraction` `numerator`/`denominator` (fixes `0.4 * x` → 2/5). Document `fractionsLimit` default as `Infinity`.

Add `parallelStatMeanAD` as an alias of `parallelStatMAD` and clarify TSDoc: factory `mad` is median absolute deviation; parallel stats are mean absolute deviation.

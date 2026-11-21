---
'@danielsimonjr/mathts-expression': patch
---

The default expression scope returns a Complex for `sqrt` and `log` of a negative real and for a negative real to a non-integer power, as mathjs does: `sqrt(-4)` is `2i`, `log(-1)` is `πi` and `(-8)^(1/3)` is `1 + 1.732i`. These calls gave `NaN`. An integer power stays real, the real limits `(-0.5)^Infinity` and `(-8)^(-Infinity)` stay 0, and a `NaN` argument stays the number `NaN`. (Refs #1086)

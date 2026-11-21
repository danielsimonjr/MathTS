---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-expression': patch
---

The default expression scope returns a Complex for `sqrt` and `log` of a negative real and for a negative real to a non-integer power, as mathjs does: `sqrt(-4)` is `2i`, `log(-1)` is `πi` and `(-8)^(1/3)` is `1 + 1.732i`. These calls gave `NaN`. An integer power stays real, the real limits `(-0.5)^Infinity` and `(-8)^(-Infinity)` stay 0, and a `NaN` argument stays the number `NaN`.

`Complex.pow` uses the algorithm of complex.js, so `pow` of a Complex equals mathjs bit for bit on core, the typed functions, compat and the evaluators: `sqrt(-4)^2` is `-4` and was `-4 + 4.9e-16i`, `i^2` is `-1`, and `pow(-8, 1/3)` is `1 + 1.732050807568877i` and was `1.0000000000000002 + 1.7320508075688772i`. Many other results change by one unit in the last place. A zero base follows the IEEE 754 pow rules: `0^y` is 0 for `y > 0` and `Infinity` for `y < 0`. mathjs gives `-0 + 0i` for `0^2` and `0 - Infinity i` for `0^(-1)`. Where complex.js computes `Infinity * 0` and gives `NaN + NaN i`, the result keeps the IEEE value: `(1e300 + 1e300i)^2` stays `Infinity + Infinity i`, and `(1e300 + 1e300i)^0.5` is finite (a part above about 2.7e154 made the squares in complex.js overflow). The new methods `Complex.cbrt()` and `Complex.cbrtRoots()` hold the mathjs cube root, and the typed, factory and default-scope `cbrt` of a Complex call them, so all three equal mathjs. (Refs #1086)

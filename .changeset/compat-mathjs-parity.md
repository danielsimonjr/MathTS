---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-matrix': minor
'@danielsimonjr/mathts-functions': minor
'@danielsimonjr/mathts-compat': minor
---

Compat output matches mathjs for `toString` and scalar trig (#889, #891, #892). Breaking: `Fraction#toString` prints the decimal form (`1/3` is now `0.(3)`), and `Matrix#toString` prints nested brackets (`[[1, 2], [3, 4]]`). Compat scalar `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp` and `log` take a number fast path.

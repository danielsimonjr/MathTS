---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-workerpool': patch
---

`hypot`, the modulus of a Complex (`abs`), `norm` (the vector 2-norm, the Frobenius norm and the matrix 2-norm) and `distance` follow one rule on every path and type: the IEEE 754 rule of `hypot`. An infinite argument gives `Infinity`, also when another argument is `NaN`. Else a `NaN` argument gives `NaN`. Before, the paths did not agree: `hypot(Infinity, Infinity)` was `NaN` on the factory path, `hypot(bignumber(Infinity), bignumber(NaN))` was `NaN`, `norm([Infinity, Infinity])` and `distance([0, 0], [Infinity, Infinity])` were `NaN` for numbers and `Infinity` for BigNumbers. This rule is different from mathjs, which gives `NaN` for `hypot(Infinity, NaN)` and for `hypot(Infinity, Infinity)`. `hypot` of a list longer than 32768 numbers no longer overflows the call stack, and `distance2D`, `distance3D` and `distanceND` no longer overflow to `Infinity` for a large finite difference. (Refs #1259)

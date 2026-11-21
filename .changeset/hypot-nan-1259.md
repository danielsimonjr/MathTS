---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`hypot` returns `NaN` when an argument is `NaN`, also when another argument is infinite, on the two-argument, the variadic, the Array and the Matrix paths. `hypot(Infinity, NaN)` was `Infinity`, because `Math.hypot` gives `Infinity` when any argument is infinite. mathjs gives `NaN`. The modulus of a Complex has the same cause: `abs(complex(Infinity, NaN))` and `norm` were `Infinity`, and `log` and `sqrt` of such a number had an `Infinity` part. They are `NaN` now, as in mathjs. A Complex with two infinite parts keeps the modulus `Infinity`. (Refs #1259)

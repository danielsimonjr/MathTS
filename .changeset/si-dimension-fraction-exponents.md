---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-units': minor
---

BREAKING: `SiDimensionVector` is now a readonly 7-tuple of `Fraction` exponents; use `vec.map((f) => f.toNumber())` instead of comparing tuple elements with `===` on numbers. `fromSiDimensionVector` accepts `SiDimensionExponent` (`number | Fraction`) and still returns the length-10 `number[]` for `Unit`. There is no `toSiDimensionNumbers` helper.

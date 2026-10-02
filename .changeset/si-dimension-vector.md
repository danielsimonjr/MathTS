---
'@danielsimonjr/mathts-core': minor
'@danielsimonjr/mathts-units': minor
---

Add a conversion between the length-10 `Unit` exponent vector and the 7 SI base dimensions, exported from core and re-exported from units. `toSiDimensions` / `toSiDimensionVector` produce the BIPM order `[L, M, T, I, Θ, N, J]`; `fromSiDimensions` / `fromSiDimensionVector` go the other way. Nonzero angle, bit, or solid-angle exponents throw unless `ignoreExtra` is set.

---
'@danielsimonjr/mathts-functions': patch
---

Share `mapBinaryF64` for FFT magnitude/power. Unary `Float64Array` overloads stay as inlined `Math.*` loops: a shared callback was measured megamorphic and slower on the sequential n<50k path.

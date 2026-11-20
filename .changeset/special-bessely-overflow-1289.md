---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-wasm': patch
---

`besselY(n, x)` returns `-Infinity` when `Y_n(x)` is outside the double range, and it returned `NaN`. `besselY(154, 1)`, `besselY(400, 1)`, `besselY(1000, 100)` and `besselY(400.5, 1)` are `-Infinity`; `besselY(-401, 1)` is `Infinity` (the sign of a negative odd order). Values below the overflow keep their digits: `besselY(151, 1)` is -5.1999e307. The AssemblyScript kernel `bessel_yn_f64` returns the same infinities as the JS scalar. A negative non-integer order with an overflowed `Y_nu` stays `NaN`, and a non-finite `x` stays `NaN`. (Refs #1289)

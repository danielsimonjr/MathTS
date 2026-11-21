---
'@danielsimonjr/mathts-functions': patch
---

`besselJ` and `besselY` give the value for a very small `x`. Before, `besselJ(-0.5, 1e-300)` and `besselY(-0.3, 1e-300)` were `NaN`, `besselJ(0.5, 5e-324)` was `0`, `besselJ(2, 1e-16)` was `0` (the value is `1.25e-33`) and `besselY(2, 5e-324)` was `NaN`. Now a power series (J) and Temme's series (Y) run for `x < 1e-5`, every division is by `x`, and a result outside the double range is a signed `Infinity`. `sin(pi x)` of a number next to a non-zero integer loses digits when `pi * x` is rounded first. A new helper reduces `x` exactly and then multiplies. `gamma(-1.0000001)` is `9999999.5713771343` and was `9999999.569845542`. `lgamma(-1.0000001)`, `gamma` of a Complex number, `zeta` of a negative argument and `besselJ(-1.0000001, 1e-10)` have the same correction. (Refs #1334)

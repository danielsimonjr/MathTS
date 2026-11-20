---
'@danielsimonjr/mathts-functions': patch
---

`taylor`, `series` and `seriesCoefficient` get the coefficients from symbolic derivatives (f^(k)(x0)/k!) instead of a Cauchy contour sum that aliased near a singularity. `taylor('1/(1-x)', 'x', 0, 6)` is now `1 + x + x^2 + x^3 + x^4 + x^5 + x^6`. The text of a coefficient keeps its exponent (`1.605904384e-10*x^13`, it was `1.605904384e-1*x^13`), and a coefficient between 1e-12 and 1e-10 is no longer written as `0`. (Refs #1023)

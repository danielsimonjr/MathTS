---
'@danielsimonjr/mathts-functions': patch
---

`taylor`, `series` and `seriesCoefficient` get the coefficients from symbolic derivatives (f^(k)(x0)/k!) instead of a Cauchy contour sum that aliased near a singularity. `taylor('1/(1-x)', 'x', 0, 6)` is now `1 + x + x^2 + x^3 + x^4 + x^5 + x^6`. (Refs #1023)

---
'@danielsimonjr/mathts-functions': patch
---

`taylor`, `series` and `seriesCoefficient` get the coefficients from three tiers. Power-series arithmetic on the syntax tree comes first: it handles + - * / ^ and the elementary functions, exact to rounding at any order. Symbolic derivatives (f^(k)(x0)/k!) come next, for other functions. A Cauchy contour sum comes last; it doubles its points until two sums agree. `taylor('1/(1-x)', 'x', 0, 30)` now has every coefficient 1, and `taylor('x/(1-x-x^2)', 'x', 0, 10)` gives the Fibonacci numbers. The text of a coefficient keeps its exponent (`1.605904384e-10*x^13`, it was `1.605904384e-1*x^13`). A small true coefficient (`7.647163732e-13*x^15` of `exp(x)`) is no longer dropped; only a coefficient that is rounding noise is left out. A Fraction center works, and a Complex center off the real line throws a `TypeError`. (Refs #1023)

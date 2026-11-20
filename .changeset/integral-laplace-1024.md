---
'@danielsimonjr/mathts-functions': patch
---

`symbolicIntegral` now integrates a power of `sin(a*x+b)` or `cos(a*x+b)` (integer power 2 to 64) and a polynomial times `log(a*x+b)`. `laplace` now applies linearity, the shift theorem and `t^n*exp(a*t)`. `inverseLaplace` now reads a rational function of `s` by partial fractions (real poles with multiplicity, one complex pair). An input that none of these rules covers keeps the `integral(...)`, `L{...}` and `L^-1{...}` marker. A `log` with a base (`x*log(x, 2)`) keeps the marker; it gave the antiderivative of the natural logarithm. (Refs #1024)

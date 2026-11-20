---
'@danielsimonjr/mathts-functions': patch
---

`owensT(h, a)` is accurate for a large `h`. Before, on main, `owensT(30, 1)` returned 2.4488e-198, and the closed form `Phi(h) Phi(-h) / 2` gives 2.4534e-198 (relative error 1.9e-3). The integrand has the factor `exp(-h^2 / 2)`, so its values were near 1e-196 and each panel of the quadrature met the absolute floor 1e-14. `owensT` now takes `exp(-h^2 / 2)` out of the integral. For `h` from 5 to 37 and `a = 1`, the relative error against the closed form is below 1e-10. (Refs #1294)

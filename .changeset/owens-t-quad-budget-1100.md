---
'@danielsimonjr/mathts-functions': minor
---

`owensT` of a large `a` returns the value, and `quad` and `nintegrate` take a new option `maxPanels`. Before, on main:

- `owensT(1, 1e4)` and `owensT(1e-3, 1e12)` returned 0, because the quadrature over `[0, a]` missed the peak of the integrand near 0. They now return 0.07932762696572854 and 0.24980052889304447, as SciPy does. For `a > 1`, `owensT` uses the identity of Owen (1956) that maps `T(h, a)` to `T(a h, 1 / a)`. It uses the symmetry of `T` for a negative `a` or `h`. `skewNormalCDF` of a large shape is correct as a result.
- `nintegrate(x => Math.sin(1 / x), 0, 1)` took 19 to 37 s, because every panel near 0 was bisected to the depth limit. `maxPanels` (default 100000) is the number of panels after which no panel is bisected. This integral now throws `RangeError: the integral did not converge` after 0.25 s, and `quad` returns `converged: false`. Pass a larger `maxPanels` to integrate a hard convergent integral. Every other integral in the test suite needs fewer than 2000 panels, so its result does not change. `maxPanels` must be a positive integer or `Infinity`. Another value, for example 0, a negative value, 2.5 or NaN, throws a RangeError. Before, 0 or a negative value stopped after the first panel with no error. (Refs #1100)

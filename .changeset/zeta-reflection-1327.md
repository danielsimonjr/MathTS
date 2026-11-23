---
'@danielsimonjr/mathts-functions': patch
---

`zeta` of a negative argument uses the symmetric form of the functional equation, `zeta(s) = pi^(s - 3/2) sin(pi s / 2) Gamma((1 - s) / 2) Gamma(1 - s / 2) zeta(1 - s)`, for a number, a BigNumber and a Complex number. One code path serves all three types, and the intermediate values do not overflow. Before, `zeta(-170.5)` was `Infinity` (the value is `1.7363e171`), `zeta(-200.5)` was `-Infinity`, `zeta(complex(-200.5, 1))` was `NaN`, and `zeta(-1000)` was a noise value (the value is `0`). Now a negative even integer gives `0`, and a value outside the double range gives a signed `Infinity`. `zeta(bignumber('-630000000000000.5'))` is correct. Before, the BigNumber result was wrong from `|s|` near 6.25e14. (Refs #1327)

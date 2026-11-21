---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`round` rounds a tie of a number and of a BigNumber away from zero, as mathjs does: `round(-2.5)` is -3 and was -2, `round(1.005, 2)` is 1.01 and was 1, and `round([-2.5, 1.5])` is `[-3, 2]`. The cause was `Math.round`, which rounds a tie toward `+Infinity`, and a scaling by `10^decimals` that is not exact. A value within `relTol` below a tie rounds up: `round(0.49999999999999994)` is 1. `round(-0)` and a value below `absTol` give 0 and not -0. Core `round` of a BigNumber rounds a tie away from zero and rounded it toward `+Infinity`. A Fraction and a Complex keep the rule of fraction.js and complex.js, so a tie goes toward `+Infinity`. The typed `round` and `factory_round` share one kernel, `roundNumberTol` of core `./internal`, and a `relTol` below `1e-15` no longer makes `factory_round` throw. (Refs #996)

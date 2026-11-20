---
'@danielsimonjr/mathts-functions': patch
---

BigNumber `gamma` and `factorial` of a value that is not an integer return a value and no longer throw. `zeta` of a negative BigNumber that is not an integer returns its value: before, `zeta(-0.5)` threw and `zeta(-1e-40)` gave `-0.5`. `gamma(NaN)` and `factorial(NaN)` give `NaN`. `zeta` of a large negative odd integer gives a signed `Infinity` and gave `NaN`. (Refs #1291)

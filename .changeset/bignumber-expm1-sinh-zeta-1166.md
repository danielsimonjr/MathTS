---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

BigNumber `sinh` keeps a small argument: `sinh(1e-40)` at precision 20 is `1e-40` and was `0`. The `expm1` of the functions package calls the BigNumber method, so `expm1(1e-70)` is `1e-70` and was `0`. `expm1`, `sinh`, `cosh` and `tanh` of `1e10` return a value and no longer throw `RangeError`. `zeta` of a BigNumber takes the number of Borwein terms from the precision, so `zeta(2)` at precision 64 is correct to 64 digits and was correct to 8 digits. (Refs #1166)

---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`BigNumber.isInteger()` returns false for NaN and Infinity. `gcd` and `lcm` of a BigNumber that is not an integer throw as mathjs does, where they never ended. `nthRoot` of a BigNumber with root 0 throws "Root must be non-zero". `permutations(n, k)` with n above 2^53 ends (#1002). `permutations(n, 0)` is 1 for every n, where mathjs returns n when `n + 1 === n`, and each factor above 2^53 has one rounding. `gcd` and `lcm` of a number that is not an integer (NaN, Infinity, 2.5) throw the mathjs error, where they returned NaN or a snapped value. Because a BigNumber NaN is not an integer, `pow` of a negative BigNumber with a NaN BigNumber exponent gives Complex NaN, and `gamma` and `factorial` of a BigNumber NaN give Infinity, as in mathjs.

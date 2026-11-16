---
'@danielsimonjr/mathts-core': patch
'@danielsimonjr/mathts-functions': patch
---

`BigNumber.isInteger()` returns false for NaN and Infinity. `gcd` and `lcm` of a BigNumber that is not an integer throw as mathjs does, where they never ended. `nthRoot` of a BigNumber with root 0 throws "Root must be non-zero". `permutations(n, k)` with n above 2^53 ends (#1002).

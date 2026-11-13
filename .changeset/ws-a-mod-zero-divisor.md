---
'@danielsimonjr/mathts-functions': patch
---

mod(x, 0) returns x on every path (#923): the typed number, bigint, Fraction and BigNumber kernels now follow the factory and mathjs. lcm(0, 0) and lcm(0n, 0n) return 0, not NaN or a throw. The public mod takes an Array or a matrix and applies the rule to each element, as the factory mod does, so mod([10, 20], 0) is [10, 20].

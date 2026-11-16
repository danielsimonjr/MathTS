---
'@danielsimonjr/mathts-functions': patch
---

`multinomial` returns Infinity in about 1024 steps at most when the result overflows a double, instead of looping over the sum of the counts (#1001). `multinomial([1e7, 1e7])` took about 0.75 s and `multinomial([1e9, 1e9])` did not finish. The value is exact for every result that fits a double, as a BigInt product of binomials, and is Infinity when the exact value rounds to Infinity. `parse()` and `compile()` now give the same result as `evaluate()` for plain-number entries. This is a deliberate difference from mathjs, which returns NaN above 170!. Below 170! the result is the correctly rounded value, so it can differ from mathjs in the last bit (`[33, 13]` is 101766230790; mathjs gives 101766230789.99998). BigNumber and boolean entries keep their results on the `parse()` path.

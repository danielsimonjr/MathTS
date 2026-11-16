---
'@danielsimonjr/mathts-functions': patch
---

`multinomial` returns Infinity in constant time when the result overflows a double, instead of looping over the sum of the counts (#1001). `multinomial([1e7, 1e7])` took about 0.75 s and `multinomial([1e9, 1e9])` did not finish. The value is now exact for every result that fits a double, as a BigInt product of binomials. Results at or above 2^1024 are Infinity. The error for a non-positive-integer entry uses the mathjs text.

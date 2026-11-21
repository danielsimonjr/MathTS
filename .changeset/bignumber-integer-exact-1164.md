---
'@danielsimonjr/mathts-functions': patch
---

`xgcd`, `combinations` and `isPrime` give exact results for BigNumber integers of any size. `xgcd` of BigNumbers computes the Bezout coefficients as exact integers, so `a*x + b*y = g` holds at every precision and for a negative operand (`xgcd(-1, 2)` is `[1, 1, 1]`, and `xgcd(0, 0)` is `[0, 0, 0]`). `xgcd` throws `Parameters in function xgcd must be integer numbers` for NaN, Infinity and a non-integer number; before, it returned NaN values or floored the operand. `combinations` of two BigNumbers computes the exact binomial coefficient and rounds the result one time to the precision. `isPrime` of a BigNumber of 2^32 or more runs the Miller-Rabin test on bigint, so no product rounds, and NaN, Infinity and a non-integer value of that size give `false`. Below 3317044064679887385961981 the 13 prime bases 2 to 41 are a proof; from that value the test adds the base of mathjs and is probabilistic, as in mathjs.

The return type of a call with one BigNumber and one number changes. `xgcd(bignumber(12), 8)` and `combinations(bignumber(200), 100)` now return BigNumbers, as mathjs does. Before, the BigNumber was converted to a number and the call returned numbers. A bigint or a Fraction argument of `combinations` still gives a number. (Refs #1164)

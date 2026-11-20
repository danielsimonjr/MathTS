---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-expression': patch
---

`quantileSeq` now uses the NumPy `method` for BigNumber, Fraction and Unit data and for a BigNumber probability. Before, these inputs gave the `linear` result for eight of the 13 methods: `quantileSeq([1, 2, 3, 4], bignumber(0.1), 'inverted_cdf')` gave 1.3 and the NumPy result is 1. One plan (`quantilePlan`) now gives the two order statistics and the weight for every type. A BigNumber probability uses exact BigNumber arithmetic.

Every dimension form now accepts a method, an options object, and `sorted` with a method. `quantileSeq([[5, 2], [9, 1]], 0, 'hazen', 1)` threw "Too many arguments" and now gives `[2, 1]`. The expression language passes the method and the options object, and it counts `dim` from one.

A NaN probability gives NaN. A BigNumber NaN probability gives a BigNumber NaN. Before, the result was `undefined`. NumPy raises `ValueError` for a NaN probability, and mathjs returns `undefined`. A probability outside 0 to 1 in a list now throws for every type of value.

(Refs #1130)

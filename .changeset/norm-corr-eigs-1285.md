---
'@danielsimonjr/mathts-functions': patch
---

The matrix 2-norm of a matrix with a NaN entry is NaN, and with an infinite entry it is Infinity. Before, a BigNumber NaN entry gave 1. `corr` of number lists near `Number.MAX_VALUE` no longer returns NaN, because the lists are scaled by an exact power of 2 before the mean. `eigs` of a BigNumber matrix with a complex pair of order 1e200 gives the pair, not NaN. (Refs #1285)

---
'@danielsimonjr/mathts-functions': patch
---

`bignumber` converts an Array or a Matrix element by element and keeps the shape and storage. It converts the value of a Unit and keeps the unit. `bignumber(null)` returns 0. A Fraction converts at the BigNumber precision (it had 16 digits), also through `numeric(x, 'BigNumber')`. A bigint converts without loss. Before, a collection of two or more elements gave a BigNumber NaN, and a one-element or empty collection collapsed to a scalar. A Unit gave a BigNumber NaN and null threw.

quantileSeq with a BigNumber N returns the N quantiles (it returned a BigNumber NaN, #1112). With a BigNumber N or a BigNumber probability, number, bigint and Fraction data give BigNumbers, and Unit data gives Units with a BigNumber value.

solveODE accepts BigNumber `tspan` and `y0` (it threw "multiply: unexpected type undefined").

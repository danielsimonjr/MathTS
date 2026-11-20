---
'@danielsimonjr/mathts-functions': patch
---

`chebyshevT(n, xs)`, `legendreP(n, xs)` and `laguerreL(n, xs)` with an array now count the recurrence steps of the whole array. A call that needs more steps than the order limit of the scalar (4e9, 2.5e9 and 1e9) throws a RangeError before any recurrence runs. Before, each element had the scalar limit only, so an array of 1000 elements at the largest degree ran for hours. For `|x| > 1`, `chebyshevT` and `legendreP` count the steps up to the first overflow, so `chebyshevT(3e9, 1000 elements at 1.5)` still returns `Infinity` for every element. A degree above the limit of the scalar keeps the message of the scalar. (Refs #1290)

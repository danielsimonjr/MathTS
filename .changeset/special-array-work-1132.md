---
'@danielsimonjr/mathts-functions': patch
---

`besselJ(n, xs)` and `besselY(n, xs)` with an integer order of at least 2 now count the recurrence steps of the whole array. A call that needs more than 2.5e9 steps in all throws a RangeError before any recurrence runs. Before, each element had its own limit only, so `besselY(2.4e9, 1024 elements)` ran for hours. The message names the order, the element count and the maximum. An element that ends at once (a zero result, a non-finite `x`, `x <= 0` for `besselY`) counts no steps, and an element above its own limit keeps its own message. (Refs #1132)

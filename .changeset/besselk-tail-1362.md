---
'@danielsimonjr/mathts-functions': patch
---

`besselK` is correct above `x = 700`, and so is the negative-order `besselI` that uses it. Before, the start values of the recurrence included `exp(-x)`, which is `0` from `x = 745.2`: `besselK(2000.5, 1200)` was `0` (the value is `6.975e100`) and `besselI(-2000.5, 1200)` was `3.07e-105` (the value is `4.441e100`). Now the recurrence carries `e^x K` and applies `exp(-x)` at the end. A gate before the loop gives `0` or `Infinity` at once for a value far outside the double range, so `besselK(1e15, 701)` is `Infinity` and `besselK(0, 1e308)` is `0` (it was `NaN`). An order above 2500000000 that passes the gate throws `RangeError`, and the array form counts the steps of its elements. (Refs #1362)

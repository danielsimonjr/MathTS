---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` of a 3-D Array `A` of numbers throws `RangeError: Matrix must be two dimensional (size: [2, 2, 1])`, as it already did for Complex, BigNumber and bigint entries, a DenseMatrix and `lup` (Refs #1247). Before, `lusolve([[[2], [0]], [[0], [1]]], [1, 2])` returned `[[0.5], [2]]`, because the number fast path read a nested Array entry as a number row. A 3-D `b` and every 3-D input of `lsolve`, `usolve`, `lsolveAll`, `usolveAll` and `lup` threw before and still throw.

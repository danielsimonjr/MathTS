---
'@danielsimonjr/mathts-functions': patch
---

`lusolve` of a 3-D Array `A` of numbers throws `RangeError: Matrix must be two dimensional (size: [2, 2, 1])`, as it already did for Complex, BigNumber and bigint entries, a DenseMatrix and `lup` (Refs #1247). Before, `lusolve([[[2], [0]], [[0], [1]]], [1, 2])` returned `[[0.5], [2]]`, because the number fast path read a nested Array entry as a number row. A 3-D `b` and every 3-D input of `lsolve`, `usolve`, `lsolveAll`, `usolveAll` and `lup` threw before and still throw.

Every Array `A` whose depth is not 2 now throws before the right-hand side and square checks: a 4-D `A` and `[[[]], [[]]]` throw the two-dimensional `RangeError` (before, `[[[]], [[]]]` threw `lu: matrix must be square (got 2×1)`), and an `A` of mixed depth such as `[[2, 0], [0, [1]]]` throws `TypeError: Matrix decomposition: jagged nested array at row 1` (before, it returned `[[0.5], [2]]`). The check runs only on the typed path, so the number fast path does no extra pass.

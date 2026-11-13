---
'@danielsimonjr/mathts-functions': patch
---

`add`, `subtract`, `multiply` and `divide` take a scalar and an Array, a `DenseMatrix` or a `SparseMatrix` and give the per-element results. The scalar is a `number`, `Unit`, `Complex`, `Fraction` or `BigNumber`. `add`, `subtract` and `multiply` accept both operand orders; `divide` accepts the collection first (`divide([1, 2], 2)` is `[0.5, 1]`). `multiply(new Unit(2, 'm'), [1, 2, 3])` threw `Too few arguments` because only `number` had a scalar-by-collection signature (#911). `divide(scalar, collection)` is a matrix division, which mathjs rejects for a vector; it throws a `TypeError` that names `dotDivide`.

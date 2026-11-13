---
'@danielsimonjr/mathts-functions': patch
---

`multiply` scales an array or a matrix by a `Unit`, `Complex`, `Fraction` or `BigNumber`, in both operand orders. `multiply(new Unit(2, 'm'), [1, 2, 3])` threw `Too few arguments` because only `number` had a scalar-by-collection signature (#911).

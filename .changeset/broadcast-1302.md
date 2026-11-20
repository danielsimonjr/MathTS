---
'@danielsimonjr/mathts-functions': patch
'@danielsimonjr/mathts-compat': patch
---

`add`, `subtract` and `mod` of two Arrays broadcast like mathjs and NumPy. The axes are right-aligned and an axis of size 1 stretches, so `add([9, 8], zeros([2, 1]))` is `[[9, 8], [9, 8]]` and `add([[1, 2], [3, 4]], [10, 20])` is `[[11, 22], [13, 24]]`. Before, the walk paired the first axes. Shapes that cannot broadcast throw `RangeError`, for example `add([[1, 2, 3]], [1, 2])`. `add(matrix([1, 2]), [[1, 2], [3, 4]])` follows from the same rule. The compat `add` and `subtract` send operands of different sizes to the same function: `create(all).add(matrix([1, 2]), matrix([[1, 2], [3, 4]]))` threw `Matrix dimensions must match` and is now `[[2, 4], [4, 6]]`. (Refs #1302)

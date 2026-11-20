---
'@danielsimonjr/mathts-functions': patch
---

`add`, `subtract` and `mod` of two Arrays broadcast like mathjs and NumPy. The axes are right-aligned and an axis of size 1 stretches, so `add([9, 8], zeros([2, 1]))` is `[[9, 8], [9, 8]]` and `add([[1, 2], [3, 4]], [10, 20])` is `[[11, 22], [13, 24]]`. Before, the walk paired the first axes. Shapes that cannot broadcast throw `RangeError`, for example `add([[1, 2, 3]], [1, 2])`. `add(matrix([1, 2]), [[1, 2], [3, 4]])` follows from the same rule. (Refs #1302)

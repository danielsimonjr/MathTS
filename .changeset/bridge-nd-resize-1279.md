---
'@danielsimonjr/mathts-functions': patch
---

`resize` and `zeros` keep every axis of a size with three or more dimensions. `zeros([1, 0, 0], 'dense')`, `zeros(1, 0, 0)` and `matrix([]).resize([2, 0, 3])` now have the size that is asked for, and `zeros(2, 3, 4)` is filled on all three axes. `resize` of a 1-D or 2-D matrix to more axes pads the new axes, as in mathjs, and the `resize` function does not change its input. (Refs #1279, #1102)

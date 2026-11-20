---
'@danielsimonjr/mathts-functions': patch
---

`inv` of a matrix of numbers with entries that span more than the double range returns the inverse. `inv([[1e300, 1e-300], [0, 1e300]])` gave a zero matrix: the unscaled determinant overflows, the scaled run flushes 1e-300 to zero, and the finite unscaled result was kept without a check. It now gives `[[1e-300, 0], [0, 1e-300]]`, as NumPy does. The unscaled result is kept only when the scaled run fails or is not finite, so `inv([[1e300, 0], [0, 1e-300]])` and a singular matrix give the same result as before. (Refs #1162)
